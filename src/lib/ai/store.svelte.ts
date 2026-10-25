/**
 * AI-стор: настройки, подключение, модели, сессии чата, генерация.
 * Svelte 5 runes (.svelte.ts). Настройки — localStorage; история — sessions.ts;
 * ключ — keyStorage.ts.
 */
import {
	ApiError,
	DEFAULT_BASE_URL,
	chatOnce,
	chatStream,
	computeCost,
	fetchModels,
	isAnthropicModel,
	normalizeBaseUrl,
	supportsVision,
	type ChatResult
} from './api.ts';
import {
	PRESETS,
	defaultSettings,
	type AiSettings,
	type ChatMessage,
	type ChatSession,
	type ModelInfo,
	type MsgUsage,
	type SectionKey,
	type ThinkingLevel
} from './types.ts';
import { clearKey, getKey, memoryHasKey, restoreKey, saveKey, type KeyPlace } from './keyStorage.ts';
import { clearSessions, loadSessions, saveSessions } from './sessions.ts';
import { isCacheUsable, loadModelsCache, saveModelsCache } from './modelsCache.ts';
import { attachmentsToDataUrls, buildJournalContext, collectAttachmentIds } from './context.ts';
import { parseStamp, uuid, type Trade } from '../domain/trades.ts';
import { namespaced } from '../storage/local.ts';

const ns = namespaced('ndtj:ai:');
const SETTINGS_KEY = 'settings';

// ── Состояние ────────────────────────────────────────────────────────────────

function loadSettings(): AiSettings {
	const raw = ns.get(SETTINGS_KEY);
	if (!raw) return defaultSettings();
	try {
		const saved = JSON.parse(raw) as Partial<AiSettings>;
		const d = defaultSettings();
		return {
			...d,
			...saved,
			files: {
				agent: { ...d.files.agent, ...saved.files?.agent },
				claude: { ...d.files.claude, ...saved.files?.claude }
			},
			sections: Array.isArray(saved.sections) ? saved.sections : d.sections
		};
	} catch {
		return defaultSettings();
	}
}

let settings = $state<AiSettings>(loadSettings());
let sessions = $state<ChatSession[]>([]);
let activeId = $state<string | null>(null);

let keyReady = $state(false);
let keyPlace = $state<KeyPlace>(null);
/** Ключ, прошедший проверку, но ещё без выбранного места хранения. */
let stagedKey = $state('');

let models = $state<ModelInfo[]>([]);
let modelsState = $state<'idle' | 'loading' | 'ok' | 'error'>('idle');
let connError = $state<ApiError | null>(null);
let connNotice = $state('');

let generating = $state(false);
let streamFallback = $state(false); // endpoint не поддержал стрим — ответ получен целиком
let lastError = $state<ApiError | null>(null); // тело — только для живой сноски, не сохраняется

let ready = $state(false);

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let histTimer: ReturnType<typeof setTimeout> | null = null;
let abortCtl: AbortController | null = null;

// Настройки — реактивная запись (localStorage на обеих платформах: WebView хранит локально)
$effect.root(() => {
	$effect(() => {
		const snap = JSON.stringify($state.snapshot(settings) as AiSettings);
		if (saveTimer) clearTimeout(saveTimer);
		saveTimer = setTimeout(() => ns.set(SETTINGS_KEY, snap), 200);
	});
});

// История — отложенная запись (браузер → localStorage, Tauri → AppData-файл)
function scheduleHistorySave() {
	if (histTimer) clearTimeout(histTimer);
	histTimer = setTimeout(async () => {
		histTimer = null;
		try {
			await saveSessions($state.snapshot(sessions) as ChatSession[]);
		} catch (e) {
			console.error('ai.history save failed', e);
		}
	}, 250);
}

export async function initAi(): Promise<void> {
	if (ready) return;
	sessions = await loadSessions();
	// Возврат в приложение продолжает последнюю сессию, а не пустой чат.
	if (sessions.length && !activeId) activeId = sessions[0].id;
	keyReady = await restoreKey();
	if (keyReady) {
		keyPlace = 'device';
		// Кэш поднимаем сразу; сеть дёргаем только если он устарел или отсутствует.
		const cached = await loadModelsCache();
		if (isCacheUsable(cached, effectiveBaseUrl())) {
			models = cached.models;
			modelsState = 'ok';
			connNotice = String(cached.models.length);
		} else {
			void refreshModels();
		}
	}
	ready = true;
}

// ── Доступ ───────────────────────────────────────────────────────────────────

export const aiState = {
	get settings() {
		return settings;
	},
	get sessions() {
		return sessions;
	},
	get activeId() {
		return activeId;
	},
	get keyReady() {
		return keyReady;
	},
	get keyPlace() {
		return keyPlace;
	},
	/** Есть проверенный ключ, ожидающий выбора места хранения. */
	get staged() {
		return stagedKey.length > 0;
	},
	get models() {
		return models;
	},
	get modelsState() {
		return modelsState;
	},
	get connError() {
		return connError;
	},
	get connNotice() {
		return connNotice;
	},
	get generating() {
		return generating;
	},
	get streamFallback() {
		return streamFallback;
	},
	get lastError() {
		return lastError;
	},
	get activeSession() {
		return sessions.find((s) => s.id === activeId) ?? null;
	},
	/** Выбранная модель есть в текущем списке поставщика. */
	get modelAvailable(): boolean {
		if (!settings.model) return false;
		if (!models.length) return true; // список ещё не получен — не блокируем
		return models.some((m) => m.id === settings.model);
	}
};

export function effectiveBaseUrl(): string {
	return normalizeBaseUrl(settings.baseUrl) || DEFAULT_BASE_URL;
}

/**
 * Проверка подключения. Ключ НЕ активируется: сначала пользователь выбирает
 * место хранения (persistKey), и только потом AI работает.
 */
export async function probe(baseUrl: string, apiKey: string): Promise<number> {
	if (!apiKey.trim()) throw new ApiError('Введите API-ключ', 0, '');
	connError = null;
	connNotice = '';
	modelsState = 'loading';
	try {
		const list = await fetchModels(baseUrl, apiKey);
		models = list;
		modelsState = 'ok';
		await saveModelsCache({ baseUrl: normalizeBaseUrl(baseUrl), fetchedTs: Date.now(), models: list });
		stagedKey = apiKey.trim();
		if (settings.baseUrl !== baseUrl) settings.baseUrl = baseUrl;
		connNotice = String(list.length);
		return list.length;
	} catch (e) {
		modelsState = 'error';
		stagedKey = '';
		connError = e instanceof ApiError ? e : new ApiError(String(e), 0, '');
		throw connError;
	}
}

/** Активировать ключ с выбранным местом хранения (единственный путь к keyReady). */
export async function persistKey(place: KeyPlace): Promise<void> {
	const key = stagedKey || getKey();
	if (!key) return;
	await saveKey(key, place === 'device' ? 'device' : 'memory');
	stagedKey = '';
	keyPlace = place === 'device' ? 'device' : 'memory';
	keyReady = true;
	// Первичное подключение без сохранённого выбора — preselect первой модели.
	if (!settings.model || !models.some((m) => m.id === settings.model)) {
		settings.model = models[0]?.id ?? null;
	}
}

/** Обновить список моделей текущим ключом (кнопка «Обновить»). */
export async function refreshModels(force = false): Promise<void> {
	if (!memoryHasKey()) return;
	if (!force && isCacheUsable(await loadModelsCache(), effectiveBaseUrl())) {
		return; // кэш свежий — лишний запрос не нужен
	}
	// При уже загруженном списке не показываем «пусто»: обновление идёт в фоне.
	if (!models.length) modelsState = 'loading';
	connError = null;
	try {
		const list = await fetchModels(effectiveBaseUrl(), getKey());
		models = list;
		modelsState = 'ok';
		connNotice = String(list.length);
		await saveModelsCache({ baseUrl: effectiveBaseUrl(), fetchedTs: Date.now(), models: list });
	} catch (e) {
		modelsState = 'error';
		connError = e instanceof ApiError ? e : new ApiError(String(e), 0, '');
	}
}

// ── Настройки ────────────────────────────────────────────────────────────────

export function updateSettings(patch: Partial<AiSettings>): void {
	settings = { ...settings, ...patch };
}

export function setModel(id: string | null): void {
	settings.model = id;
}

export function setThinking(level: ThinkingLevel | null): void {
	settings.thinking = level;
}

/** Пресет → разделы; ручной клик по чекбоксу → 'custom'. */
export function applyPreset(preset: AiSettings['preset']): void {
	const p = PRESETS.find((x) => x.id === preset);
	if (!p) return;
	settings.preset = preset;
	settings.sections = [...p.sections];
}

export function toggleSection(key: SectionKey): void {
	const has = settings.sections.includes(key);
	settings.sections = has
		? settings.sections.filter((s) => s !== key)
		: [...settings.sections, key];
	settings.preset = 'custom';
}

export function saveContextFile(which: 'agent' | 'claude', text: string): void {
	settings.files[which].text = text;
}

export function setContextFileEnabled(which: 'agent' | 'claude', enabled: boolean): void {
	settings.files[which].enabled = enabled;
}

export function resetContextFiles(): void {
	settings.files = {
		agent: { text: '', enabled: false },
		claude: { text: '', enabled: false }
	};
}

export async function forgetKey(): Promise<void> {
	await clearKey();
	stagedKey = '';
	keyReady = false;
	keyPlace = null;
	models = [];
	modelsState = 'idle';
	connNotice = '';
}

// ── Сессии ───────────────────────────────────────────────────────────────────

export function selectSession(id: string | null): void {
	activeId = id;
}

export function renameSession(id: string, title: string): void {
	sessions = sessions.map((s) => (s.id === id ? { ...s, title: title.trim() || s.title } : s));
	scheduleHistorySave();
}

export async function deleteSession(id: string): Promise<void> {
	sessions = sessions.filter((s) => s.id !== id);
	if (activeId === id) activeId = null;
	await saveSessions($state.snapshot(sessions) as ChatSession[]);
}

export async function deleteAllHistory(): Promise<void> {
	sessions = [];
	activeId = null;
	await clearSessions();
}

/** Остановить текущую генерацию. */
export function stopGenerating(): void {
	abortCtl?.abort();
}

// ── Отправка ─────────────────────────────────────────────────────────────────

export type QuickKind = 'analyze-open' | 'mistakes' | 'summary' | 'advice' | 'free';

export interface SendPayload {
	kind: QuickKind;
	/** Для analyze-open: id выбранных открытых сделок; пусто → все открытые. */
	tradeIds?: string[];
	/** Для summary: окно в днях; null → вся история. */
	periodDays?: number | null;
	/** Подпись периода для текста запроса. */
	periodLabel?: string;
}

function quickPrompt(payload: SendPayload): string {
	switch (payload.kind) {
		case 'analyze-open':
			return 'Проанализируй открытые сделки из контекста: по каждой оцени риск (направление, объём, расстояние до SL/TP), текущий результат и что делать дальше. Кратко и по делу.';
		case 'mistakes':
			return 'Найди в журнале повторяющиеся ошибки и паттерны: серии убытков, нарушение риск-менеджмента, типы сделок и инструменты, которые чаще всего в минусе. Приведи конкретные примеры из сделок и что исправить.';
		case 'summary':
			return `Сведи итоги торгов за период: ${payload.periodLabel ?? 'весь журнал'}. Нужны: винрейт, суммарный результат, средний профит и средний убыток, лучшая и худшая сделки, динамика. Кратко и по делу.`;
		case 'advice':
			return 'На основе журнала дай рекомендации по улучшению торговли: какие привычки усилить, что убрать, на что смотреть перед входом. Опирайся на конкретные сделки из контекста.';
		default:
			return '';
	}
}

/** Сделки, которые уходят в контекст для этого запроса. */
function tradesForRequest(payload: SendPayload, all: Trade[]): Trade[] {
	const allowed = new Set<SectionKey>(settings.sections);
	if (!allowed.has('trades')) return [];
	if (payload.kind === 'analyze-open') {
		const open = all.filter((t) => t.status === 'open');
		if (!payload.tradeIds?.length) return open;
		const set = new Set(payload.tradeIds);
		return open.filter((t) => set.has(t.id));
	}
	if (payload.kind === 'summary' && payload.periodDays != null) {
		const since = Date.now() - payload.periodDays * 86_400_000;
		return all.filter((t) => (parseStamp(t.dateClose || t.dateOpen)?.getTime() ?? 0) >= since);
	}
	return all;
}

/**
 * Ядро отправки: собирает контекст, создаёт сессию при первом сообщении,
 * стримит ответ, пишет usage/статус в сообщение. Бросает только при
 * предусловиях (нет модели/ключа); ошибки API пишутся в сообщение.
 */
export async function send(
	allTrades: Trade[],
	dayNote: string,
	payload: SendPayload,
	freeText: string
): Promise<void> {
	if (generating) throw new Error('Уже идёт генерация');
	if (!keyReady || !memoryHasKey()) throw new Error('Нет подключённого ключа');
	const model = settings.model;
	if (!model) throw new Error('Модель не выбрана');

	lastError = null;
	streamFallback = false;

	const prompt = payload.kind === 'free' ? freeText.trim() : quickPrompt(payload);
	if (!prompt) return;

	const reqTrades = tradesForRequest(payload, allTrades);
	const sections = new Set<SectionKey>(settings.sections);
	const contextText = buildJournalContext({ sections, trades: reqTrades, note: dayNote });

	// Вложения — только vision-моделям (выбор «убрать/сменить модель» делает UI до вызова).
	let images: string[] = [];
	if (sections.has('attachments') && supportsVision(model) === 'yes') {
		images = await attachmentsToDataUrls(collectAttachmentIds(reqTrades));
	}

	// Сессия создаётся первым сообщением; название — из первой фразы.
	let session = sessions.find((s) => s.id === activeId) ?? null;
	const now = Date.now();
	const userMsg: ChatMessage = {
		id: uuid(),
		role: 'user',
		content: prompt,
		ts: now,
		status: 'ok',
		contextChars: contextText.length
	};
	if (!session) {
		session = {
			id: uuid(),
			title: prompt.slice(0, 60) + (prompt.length > 60 ? '…' : ''),
			createdTs: now,
			messages: []
		};
		sessions = [session, ...sessions];
		activeId = session.id;
	}
	const sId = session.id;
	sessions = sessions.map((s) => (s.id === sId ? { ...s, messages: [...s.messages, userMsg] } : s));

	const replyId = uuid();
	const reply: ChatMessage = {
		id: replyId,
		role: 'assistant',
		content: '',
		ts: Date.now(),
		model,
		thinking: settings.thinking,
		status: 'ok',
		usage: null
	};
	sessions = sessions.map((s) => (s.id === sId ? { ...s, messages: [...s.messages, reply] } : s));

	const patchReply = (patch: Partial<ChatMessage>) => {
		sessions = sessions.map((s) =>
			s.id === sId
				? {
						...s,
						messages: s.messages.map((m) => (m.id === replyId ? { ...m, ...patch } : m))
					}
				: s
		);
	};

	// История диалога — предыдущие сообщения сессии (ошибочные не resend-им).
	const history = (sessions.find((s) => s.id === sId)?.messages ?? [])
		.filter((m) => m.id !== replyId && m.status !== 'error' && m.content)
		.map((m) => ({ role: m.role, content: m.content }));
	// Контекст журнала подмешивается в последнее сообщение запроса (в UI остаётся чистый промпт).
	const contextBlock = contextText.trim()
		? `Контекст журнала сделок:\n\n${contextText.trim()}\n\n---\n\n`
		: '';
	const prior = history.map((m, i) =>
		i === history.length - 1 && m.role === 'user' ? { ...m, content: contextBlock + m.content } : m
	);

	// Системный файл: CLAUDE.md — моделям Anthropic, иначе AGENT.md.
	const anthropic = isAnthropicModel(model);
	const sysFile = anthropic ? settings.files.claude : settings.files.agent;
	const system =
		sysFile.enabled && sysFile.text.trim()
			? `# ${anthropic ? 'CLAUDE.md' : 'AGENT.md'}\n${sysFile.text.trim()}`
			: null;

	const pricing = models.find((m) => m.id === model)?.pricing ?? null;

	generating = true;
	abortCtl = new AbortController();

	const append = (piece: string) => {
		const cur = sessions
			.find((s) => s.id === sId)
			?.messages.find((m) => m.id === replyId);
		patchReply({ content: (cur?.content ?? '') + piece });
	};

	try {
		const args = {
			baseUrl: effectiveBaseUrl(),
			apiKey: getKey(),
			model,
			system,
			messages: prior,
			images,
			thinking: settings.thinking,
			signal: abortCtl.signal
		};
		let result: ChatResult;
		try {
			result = await chatStream(args, append);
		} catch (e) {
			// Фолбэк на обычный запрос — только если стрим отклонён до первого токена.
			const aborted = e instanceof Error && e.name === 'AbortError';
			const apiErr = e instanceof ApiError ? e : null;
			if (!aborted && apiErr && apiErr.status >= 400) {
				result = await chatOnce(args);
				streamFallback = true;
			} else {
				throw e;
			}
		}
		const u = result.usage;
		const usage: MsgUsage | null = u
			? {
					prompt: u.prompt_tokens ?? 0,
					completion: u.completion_tokens ?? 0,
					total: u.total_tokens ?? (u.prompt_tokens ?? 0) + (u.completion_tokens ?? 0),
					cost: computeCost(u, pricing)
				}
			: null;
		patchReply({ content: result.content, usage, status: abortCtl.signal.aborted ? 'stopped' : 'ok' });
	} catch (e) {
		if (e instanceof Error && e.name === 'AbortError') {
			patchReply({ status: 'stopped' });
		} else {
			const apiErr = e instanceof ApiError ? e : new ApiError(String(e), 0, '');
			lastError = apiErr;
			patchReply({ status: 'error', errorNote: apiErr.message || 'Не удалось получить ответ' });
		}
	} finally {
		generating = false;
		abortCtl = null;
		scheduleHistorySave();
	}
}

/** Сбросить живую сноску ошибки/фолбэка (тело ошибки не хранится). */
export function clearLastError(): void {
	lastError = null;
	streamFallback = false;
}
