/**
 * Клиент OpenAI-compatible API: GET /models и POST /chat/completions.
 * Только fetch, без SDK. Ошибки — ApiError с телом ответа для локальной сноски
 * (тело не логируется и не сохраняется в историю).
 */
import type { ModelInfo, ThinkingLevel, Usage } from './types.ts';
import { catalogForModel } from './modelCatalog.ts';

/** Дефолт endpoint'а — используется, когда Base URL пуст (плейсхолдер). */
export const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

export class ApiError extends Error {
	status: number;
	/** Тело ответа провайдера (показывается только в локальной сноске, ≤8 КБ). */
	body: string;

	constructor(message: string, status = 0, body = '') {
		super(message);
		this.name = 'ApiError';
		this.status = status;
		this.body = body;
	}
}

const MAX_ERR_BODY = 8 * 1024;

/** Обрезать пробелы и хвостовой слэш. */
export function normalizeBaseUrl(raw: string): string {
	return String(raw || '').trim().replace(/\/+$/, '');
}

/** Только http(s). */
export function isValidBaseUrl(raw: string): boolean {
	return /^https?:\/\/.+/i.test(normalizeBaseUrl(raw));
}

export function hostOf(url: string): string {
	try {
		return new URL(normalizeBaseUrl(url)).hostname.toLowerCase();
	} catch {
		return normalizeBaseUrl(url) || 'api.openai.com';
	}
}

/** Человекочитаемые имена известных поставщиков (по домену Base URL). */
const PROVIDER_NAMES: Record<string, string> = {
	'api.openai.com': 'OpenAI',
	'openrouter.ai': 'OpenRouter',
	'api.anthropic.com': 'Anthropic',
	'api.deepseek.com': 'DeepSeek',
	'api.mistral.ai': 'Mistral',
	'api.groq.com': 'Groq',
	'api.together.xyz': 'Together',
	'api.x.ai': 'xAI',
	'api-inference.huggingface.co': 'Hugging Face'
};

export function providerTitle(baseUrl: string): string {
	const host = hostOf(baseUrl);
	if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.localhost')) {
		return 'Локальный сервер';
	}
	return PROVIDER_NAMES[host] ?? host;
}

/** Семейство модели для группировки внутри поставщика. */
export function modelFamily(id: string): string {
	const s = id.toLowerCase();
	if (/^gpt/.test(s)) return 'GPT';
	if (/^o[134]/.test(s)) return 'OpenAI o-серия';
	if (/claude|opus|sonnet|haiku/.test(s)) return 'Claude';
	if (/^gemini/.test(s)) return 'Gemini';
	if (/^grok/.test(s)) return 'Grok';
	if (/^deepseek/.test(s)) return 'DeepSeek';
	if (/^llama|^meta-llama/.test(s)) return 'Llama';
	if (/^mistral|^mixtral|^pixtral/.test(s)) return 'Mistral';
	if (/^qwen/.test(s)) return 'Qwen';
	if (/^glm|^z-?ai/.test(s)) return 'GLM';
	if (/kimi|moonshot/.test(s)) return 'Kimi';
	if (/perplexity|^sonar/.test(s)) return 'Perplexity';
	if (/copilot/.test(s)) return 'Copilot';
	if (/manus/.test(s)) return 'Manus';
	if (/yandex|^yagpt/.test(s)) return 'Yandex';
	if (/antigravity/.test(s)) return 'Antigravity';
	return 'Другие';
}

/** Anthropic-модель (для выбора CLAUDE.md). */
export function isAnthropicModel(id: string): boolean {
	return /claude|opus|sonnet|haiku/i.test(id);
}

/**
 * Поддержка выбора уровня мышления: true/false — известно, null — неизвестно.
 * Сначала каталог семейств (reasoning + карта), затем эвристики по имени.
 * Имя модели не доказывает возможности endpoint'а, поэтому неизвестное — не угадываем.
 */
export function supportsThinking(id: string): boolean | null {
	const s = id.toLowerCase();
	// Явно не-мышлящие имена не перекрываются каталогом семейств (gpt-4o в семействе GPT).
	if (/^(gpt-4|chatgpt|deepseek-chat|llama|mistral|mixtral|qwen)/.test(s)) return false;
	const cat = catalogForModel(id);
	if (cat) return cat.reasoning;
	if (/^(o[134]|gpt-5)/.test(s)) return true;
	if (/^grok-[34]/.test(s)) return true;
	return null;
}

/** Поддержка изображений: 'yes' | 'no' | 'unknown'. */
export function supportsVision(id: string): 'yes' | 'no' | 'unknown' {
	const s = id.toLowerCase();
	if (/^(gpt-4o|gpt-4\.1|gpt-4-turbo|gpt-5|chatgpt-4o|o3|o4)/.test(s)) return 'yes';
	if (/claude|opus|sonnet|haiku/.test(s)) return 'yes';
	if (/^gemini/.test(s)) return 'yes';
	if (/^grok-(vision|[2-9])/.test(s)) return 'yes';
	if (/^(gpt-3|text-|deepseek-chat|llama-3\.[01]|mistral|mixtral)/.test(s)) return 'no';
	return 'unknown';
}

/** Цены из metadata модели (известный формат — объект pricing за 1 токен). */
function parsePricing(meta: Record<string, unknown> | null | undefined) {
	if (!meta || typeof meta !== 'object') return null;
	const p = meta.pricing as Record<string, unknown> | undefined;
	if (!p) return null;
	const prompt = Number(p.prompt);
	const completion = Number(p.completion);
	if (!Number.isFinite(prompt) || !Number.isFinite(completion)) return null;
	return { prompt, completion };
}

/**
 * GET {base}/models. Бросает ApiError (причина + тело ≤8 КБ).
 */
export async function fetchModels(baseUrl: string, apiKey: string): Promise<ModelInfo[]> {
	const base = normalizeBaseUrl(baseUrl) || DEFAULT_BASE_URL;
	let res: Response;
	try {
		res = await fetch(`${base}/models`, {
			headers: { Authorization: `Bearer ${apiKey}` }
		});
	} catch (e) {
		throw new ApiError('Не удалось связаться с endpoint (сеть, URL или CORS)', 0, '');
	}
	const text = await res.text().catch(() => '');
	if (!res.ok) {
		throw new ApiError(
			res.status === 401
				? 'Ключ отклонён (401). Проверьте API-ключ.'
				: `Провайдер ответил ошибкой (HTTP ${res.status})`,
			res.status,
			text.slice(0, MAX_ERR_BODY)
		);
	}
	let json: { data?: unknown };
	try {
		json = JSON.parse(text);
	} catch {
		throw new ApiError('Провайдер вернул не JSON', res.status, text.slice(0, MAX_ERR_BODY));
	}
	const list = Array.isArray(json.data) ? json.data : [];
	return list
		.map((m) => {
			const id = typeof m === 'object' && m ? String((m as Record<string, unknown>).id ?? '') : String(m ?? '');
			const pricing = parsePricing(m as Record<string, unknown>);
			return { id, pricing };
		})
		.filter((m) => m.id)
		.sort((a, b) => a.id.localeCompare(b.id));
}

export interface ChatArgs {
	baseUrl: string;
	apiKey: string;
	model: string;
	/** Системное сообщение (AGENT.md / CLAUDE.md) либо null. */
	system: string | null;
	/** История: [role, text]. */
	messages: { role: 'user' | 'assistant'; content: string }[];
	/** Изображения последнего запроса (data:URL), только для vision-моделей. */
	images?: string[];
	thinking?: ThinkingLevel | null;
	signal?: AbortSignal;
}

export interface ChatResult {
	content: string;
	usage: Usage | null;
}

function buildBody(args: ChatArgs, stream: boolean): string {
	const msgs: Record<string, unknown>[] = [];
	if (args.system) msgs.push({ role: 'system', content: args.system });
	for (let i = 0; i < args.messages.length; i++) {
		const m = args.messages[i];
		// Картинки прикрепляются только к последнему (текущему) сообщению пользователя.
		const isLast = i === args.messages.length - 1;
		if (isLast && m.role === 'user' && args.images?.length) {
			msgs.push({
				role: 'user',
				content: [
					{ type: 'text', text: m.content },
					...args.images.map((url) => ({ type: 'image_url', image_url: { url } }))
				]
			});
		} else {
			msgs.push({ role: m.role, content: m.content });
		}
	}
	const host = hostOf(args.baseUrl);
	const body: Record<string, unknown> = {
		model: args.model,
		messages: msgs,
		stream
	};
	if (args.thinking) {
		// Уровень → провайдерское значение: у семейства из каталога своя карта и формат.
		const cat = catalogForModel(args.model);
		if (cat?.reasoning) {
			const lvl = args.thinking;
			const mapped = cat.thinkingLevelMap?.[lvl];
			if (cat.wire.kind === 'reasoning_effort') {
				if (typeof mapped === 'string') body.reasoning_effort = mapped;
				// max в OpenAI нет — ближайший 'high' (остальные семейства пропускают null как есть).
				else if (lvl === 'max' && host === 'api.openai.com') body.reasoning_effort = 'high';
				else if (typeof mapped === 'undefined') body.reasoning_effort = lvl;
			}
			// google_level / toggle / anthropic_budget — для OpenAI-compatible endpoint не отправляем:
			// эти форматы у чат-completions не применяются, чей переход в api.ts при появлении
			// нативных адаптеров Anthropic/Google.
		}
	}
	return JSON.stringify(body);
}

async function readError(res: Response): Promise<ApiError> {
	const text = await res.text().catch(() => '');
	return new ApiError(
		res.status === 401
			? 'Ключ отклонён (401).'
			: res.status === 429
				? 'Лимит или квота провайдера (429).'
				: `Провайдер ответил ошибкой (HTTP ${res.status})`,
		res.status,
		text.slice(0, MAX_ERR_BODY)
	);
}

function parseUsage(json: Record<string, unknown>): Usage | null {
	const u = json.usage as Usage | undefined;
	if (!u || typeof u !== 'object') return null;
	return u;
}

/** Обычный (не потоковый) запрос. */
export async function chatOnce(args: ChatArgs): Promise<ChatResult> {
	const base = normalizeBaseUrl(args.baseUrl) || DEFAULT_BASE_URL;
	let res: Response;
	try {
		res = await fetch(`${base}/chat/completions`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${args.apiKey}` },
			body: buildBody(args, false),
			signal: args.signal
		});
	} catch (e) {
		if (e instanceof Error && e.name === 'AbortError') throw e;
		throw new ApiError('Не удалось связаться с endpoint (сеть, URL или CORS)', 0, '');
	}
	if (!res.ok) throw await readError(res);
	const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
	if (!json) throw new ApiError('Провайдер вернул не JSON', res.status, '');
	const choices = Array.isArray(json.choices) ? json.choices : [];
	const first = choices[0] as Record<string, unknown> | undefined;
	const msg = first?.message as Record<string, unknown> | undefined;
	const content =
		typeof msg?.content === 'string'
			? msg.content
			: Array.isArray(msg?.content)
				? (msg!.content as { type: string; text?: string }[])
						.filter((p) => p.type === 'text')
						.map((p) => p.text ?? '')
						.join('\n')
				: '';
	return { content, usage: parseUsage(json) };
}

/**
 * Потоковый запрос. onDelta вызывается по мере генерации.
 * Бросает ApiError, если провайдер отклонил запрос (до первого токена).
 */
export async function chatStream(
	args: ChatArgs,
	onDelta: (chunk: string) => void
): Promise<ChatResult> {
	const base = normalizeBaseUrl(args.baseUrl) || DEFAULT_BASE_URL;
	let res: Response;
	try {
		res = await fetch(`${base}/chat/completions`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${args.apiKey}` },
			body: buildBody(args, true),
			signal: args.signal
		});
	} catch (e) {
		if (e instanceof Error && e.name === 'AbortError') throw e;
		throw new ApiError('Не удалось связаться с endpoint (сеть, URL или CORS)', 0, '');
	}
	if (!res.ok) throw await readError(res);
	if (!res.body) return chatOnce(args);

	const reader = res.body.getReader();
	const decoder = new TextDecoder();
	let buffer = '';
	let content = '';
	let usage: Usage | null = null;
	let done = false;

	while (!done) {
		const { value, done: rdDone } = await reader.read();
		if (rdDone) break;
		buffer += decoder.decode(value, { stream: true });
		let nl: number;
		while ((nl = buffer.indexOf('\n')) >= 0) {
			const line = buffer.slice(0, nl).trim();
			buffer = buffer.slice(nl + 1);
			if (!line.startsWith('data:')) continue;
			const payload = line.slice(5).trim();
			if (payload === '[DONE]') {
				done = true;
				break;
			}
			let chunk: Record<string, unknown>;
			try {
				chunk = JSON.parse(payload);
			} catch {
				continue;
			}
			if (chunk.usage) usage = parseUsage(chunk);
			const choices = Array.isArray(chunk.choices) ? chunk.choices : [];
			const delta = (choices[0] as Record<string, unknown> | undefined)?.delta as
				| Record<string, unknown>
				| undefined;
			const piece = typeof delta?.content === 'string' ? delta.content : '';
			if (piece) {
				content += piece;
				onDelta(piece);
			}
		}
	}
	return { content, usage };
}

/** Стоимость по ценам из metadata (известного формата), иначе null. */
export function computeCost(
	usage: Usage | null,
	pricing: { prompt: number; completion: number } | null | undefined
): number | null {
	if (!usage || !pricing) return null;
	const p = Number(usage.prompt_tokens);
	const c = Number(usage.completion_tokens);
	if (!Number.isFinite(p) || !Number.isFinite(c)) return null;
	return Number((p * pricing.prompt + c * pricing.completion).toFixed(6));
}
