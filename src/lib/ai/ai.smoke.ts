/**
 * Смоук-проверки чистых функций AI-слоя (node --experimental-strip-types).
 * Сеть не трогаем: только нормализация, группировка, определение модели,
 * сборка контекста и стоимость.
 */
import {
	normalizeBaseUrl,
	isValidBaseUrl,
	hostOf,
	providerTitle,
	modelFamily,
	isAnthropicModel,
	supportsThinking,
	supportsVision,
	computeCost,
	DEFAULT_BASE_URL
} from './api.ts';
import { buildJournalContext, collectAttachmentIds } from './context.ts';
import { formatBytes, historyStats } from './sessions.ts';
import { isCacheUsable, MODELS_TTL_MS, type ModelsCache } from './modelsCache.ts';
import { normalizeTrade, type Trade } from '../domain/trades.ts';

let pass = 0,
	fail = 0;
const eq = (name: string, a: unknown, b: unknown) => {
	const ok = JSON.stringify(a) === JSON.stringify(b);
	if (ok) pass++;
	else {
		fail++;
		console.log('FAIL', name, '→', a, '≠', b);
	}
};

// Base URL
eq('base trim', normalizeBaseUrl(' https://api.openai.com/v1/ '), 'https://api.openai.com/v1');
eq('base valid https', isValidBaseUrl('https://api.openai.com/v1'), true);
eq('base valid local http', isValidBaseUrl('http://127.0.0.1:1234/v1'), true);
eq('base invalid', isValidBaseUrl('api.openai.com'), false);
eq('default', DEFAULT_BASE_URL, 'https://api.openai.com/v1');
eq('host', hostOf('https://api.openai.com/v1'), 'api.openai.com');

// Поставщики
eq('provider openai', providerTitle('https://api.openai.com/v1'), 'OpenAI');
eq('provider local', providerTitle('http://127.0.0.1:11434/v1'), 'Локальный сервер');
eq('provider unknown host', providerTitle('https://ai.example.dev/v1'), 'ai.example.dev');

// Семейства / Anthropic / возможности
eq('family gpt', modelFamily('gpt-4o-mini'), 'GPT');
eq('family o-серия', modelFamily('o3-mini'), 'OpenAI o-серия');
eq('family claude', modelFamily('claude-sonnet-4'), 'Claude');
eq('family other', modelFamily('mystery-model'), 'Другие');
eq('anthropic claude', isAnthropicModel('claude-opus-4'), true);
eq('anthropic sonnet alias', isAnthropicModel('vendor-sonnet-x'), true);
eq('anthropic gpt', isAnthropicModel('gpt-4o'), false);
eq('thinking o3', supportsThinking('o3-mini'), true);
eq('thinking gpt-4o', supportsThinking('gpt-4o'), false);
eq('thinking unknown', supportsThinking('some-proxy-model'), null);
eq('thinking gpt-6-luna', supportsThinking('gpt-6-luna'), true);
eq('thinking gpt-4o всё ещё false', supportsThinking('gpt-4o'), false);
eq('thinking glm flash false', supportsThinking('glm-5.3-flash'), false);
eq('thinking glm обычный true', supportsThinking('glm-5'), true);
eq('vision gpt-4o', supportsVision('gpt-4o'), 'yes');
eq('vision claude', supportsVision('claude-opus-4'), 'yes');
eq('vision gpt-3.5', supportsVision('gpt-3.5-turbo'), 'no');
eq('vision unknown', supportsVision('mystery-model'), 'unknown');

// Стоимость
eq('cost known', computeCost({ prompt_tokens: 1000, completion_tokens: 500 }, { prompt: 0.000001, completion: 0.000002 }), 0.002);
eq('cost no pricing', computeCost({ prompt_tokens: 10, completion_tokens: 5 }, null), null);
eq('cost no usage', computeCost(null, { prompt: 1, completion: 1 }), null);

// Контекст журнала
const trades: Trade[] = [
	normalizeTrade({
		id: 't1',
		pair: 'EURUSD',
		direction: 'long',
		volume: 0.1,
		priceOpen: 1.1,
		priceClose: 1.105,
		status: 'closed',
		dateOpen: '2026-01-05 09:00:00',
		dateClose: '2026-01-05 10:00:00',
		comment: 'по тренду',
		tags: ['plan']
	}),
	normalizeTrade({
		id: 't2',
		pair: 'XAUUSD',
		direction: 'short',
		volume: 0.01,
		priceOpen: 2000,
		status: 'open',
		dateOpen: '2026-01-06 09:00:00',
		attachments: ['a1', 'a2']
	})
];
const all = new Set(['trades', 'comments', 'notes', 'attachments'] as const);

const withAll = buildJournalContext({ sections: all, trades, note: 'день хороший' });
eq('ctx has trades header', withAll.includes('# Сделки (2)'), true);
eq('ctx has comment', withAll.includes('по тренду'), true);
eq('ctx has note', withAll.includes('день хороший'), true);
eq('ctx open status', withAll.includes('СТАТУС: открыта'), true);

const tradesOnly = buildJournalContext({ sections: new Set(['trades']), trades, note: 'скрыто' });
eq('ctx min hides note', tradesOnly.includes('скрыто'), false);
eq('ctx min hides comments', tradesOnly.includes('по тренду'), false);

const empty = buildJournalContext({ sections: new Set(), trades, note: '' });
eq('ctx empty', empty.includes('ни один раздел'), true);

// Вложения
eq('attachments ids', collectAttachmentIds(trades), ['a1', 'a2']);

// История: статистика и формат размера
const stats = historyStats([
	{
		id: 's1',
		title: 'Сессия',
		createdTs: 1,
		messages: [{ id: 'm1', role: 'user', content: 'привет', ts: 1, status: 'ok' }]
	}
]);
eq('stats sessions', stats.sessions, 1);
eq('stats messages', stats.messages, 1);
eq('stats bytes > 0', stats.bytes > 0, true);
eq('format bytes small', formatBytes(512), '512 Б');
eq('format bytes kb', formatBytes(2048), '2.0 КБ');
eq('format bytes mb', formatBytes(2 * 1024 * 1024), '2.0 МБ');

// ── Уровни мышления (thinking.ts) ─────────────────────────────────────────
import {
	getSupportedThinkingLevels,
	clampThinkingLevel,
	effortThinkingLevelMap,
	isThinkingLevel,
	MODEL_THINKING_LEVELS
} from './thinking.ts';
import { catalogForFamily, MODEL_CATALOG } from './modelCatalog.ts';
import { MemoryCredentialStore, findEnvKeys, providerIdForHost, PROVIDER_ENV_KEYS } from './credentials.ts';

const openai = catalogForFamily('OpenAI o-серия')!;
const claude = catalogForFamily('Claude')!;

eq('levels off', getSupportedThinkingLevels({ reasoning: false }), ['off']);
eq('levels openai', getSupportedThinkingLevels(openai), ['low', 'medium', 'high']); // off: null — нельзя выключить
eq('levels claude', getSupportedThinkingLevels(claude), ['minimal', 'low', 'medium', 'high', 'max']);
eq('clamp openai max→high', clampThinkingLevel(openai, 'max'), 'high');
eq('clamp openai xhigh→high', clampThinkingLevel(openai, 'xhigh'), 'high');
eq('clamp claude xhigh→max', clampThinkingLevel(claude, 'xhigh'), 'max');
eq('clamp no-op', clampThinkingLevel(claude, 'high'), 'high');
eq('isLevel', isThinkingLevel('medium') && !isThinkingLevel('off'), true);
eq('effort map', effortThinkingLevelMap([{ type: 'effort', values: ['low', 'medium', 'high', 'none'] }]), {
	off: 'none',
	minimal: null,
	low: 'low',
	medium: 'medium',
	high: 'high',
	xhigh: null,
	max: null
});
eq('effort map toggle', effortThinkingLevelMap([{ type: 'toggle' }]), undefined);
eq('catalog all ordered', MODEL_CATALOG.length > 5, true);
eq('off is in track', MODEL_THINKING_LEVELS[0], 'off');

// Креденшлы
const store = new MemoryCredentialStore();
await store.modify('openai', async () => ({ type: 'api_key', key: 'sk-test' }));
eq('cred read', (await store.read('openai'))?.type, 'api_key');
eq('cred missing', await store.read('nope'), undefined);
eq('cred list', (await store.list())[0].providerId, 'openai');
await store.delete('openai');
eq('cred deleted', await store.read('openai'), undefined);
eq('env keys openai', findEnvKeys('openai', { OPENAI_API_KEY: 'x' }), ['OPENAI_API_KEY']);
eq('env keys none', findEnvKeys('openai', {}), undefined);
eq('host provider', providerIdForHost('api.openai.com'), 'openai');
eq('host unknown', providerIdForHost('example.dev'), undefined);
eq('env secrets not in provider table', JSON.stringify(PROVIDER_ENV_KEYS).includes('sk-'), false);

// Кэш моделей: свежий используется без запроса, устаревший/чужой — нет.
const now = 1_000_000_000_000;
const mkCache = (over: Partial<ModelsCache> = {}): ModelsCache => ({
	baseUrl: 'https://api.openai.com/v1',
	fetchedTs: now - 1000,
	models: [{ id: 'gpt-4o', pricing: null }],
	...over
});
eq('cache fresh usable', isCacheUsable(mkCache(), 'https://api.openai.com/v1', now), true);
eq('cache stale rejected', isCacheUsable(mkCache({ fetchedTs: now - MODELS_TTL_MS - 1 }), 'https://api.openai.com/v1', now), false);
eq('cache other host rejected', isCacheUsable(mkCache(), 'https://openrouter.ai/api/v1', now), false);
eq('cache empty rejected', isCacheUsable(mkCache({ models: [] }), 'https://api.openai.com/v1', now), false);
eq('cache null rejected', isCacheUsable(null, 'https://api.openai.com/v1', now), false);

console.log(`\nAI-смоук: ${pass} ok, ${fail} fail`);
if (fail) process.exit(1);
