/**
 * Конфигурация креденшлов:
 *  - типы Credential (api_key | oauth), один типизированный креденшл на провайдера;
 *  - env-таблица известных переменных API-ключа;
 *  - семантика хранилища: read → undefined при отсутствии, reject только при сбое;
 *    modify — единственный путь записи (сериализованный read-modify-write).
 * Сеть не используется. Секреты не логируются и не возвращаются в UI.
 */

export interface ApiKeyCredential {
	type: 'api_key';
	key?: string;
	/** Провайдерский конфиг, не секрет (account/gateway id и т.п.). */
	env?: Record<string, string>;
}

export interface OAuthCredential {
	type: 'oauth';
	refresh: string;
	access: string;
	/** ms epoch. */
	expires: number;
	[key: string]: unknown;
}

export type Credential = ApiKeyCredential | OAuthCredential;

export interface CredentialInfo {
	providerId: string;
	type: Credential['type'];
}

/**
 * Интерфейс хранилища. В приложении реализуется
 * keyStorage.ts (память/устройство); интерфейс оставлен для тестов и подмены.
 */
export interface CredentialStore {
	read(providerId: string): Promise<Credential | undefined>;
	list(): Promise<readonly CredentialInfo[]>;
	/** Единственный путь записи: fn получает текущее значение и возвращает следующее. */
	modify(
		providerId: string,
		fn: (current: Credential | undefined) => Promise<Credential | undefined>,
	): Promise<Credential | undefined>;
	delete(providerId: string): Promise<void>;
}

/** In-memory реализация (сериализация записи на цепочке промисов). */
export class MemoryCredentialStore implements CredentialStore {
	private map = new Map<string, Credential>();
	private chains = new Map<string, Promise<unknown>>();

	private enqueue<T>(providerId: string, task: () => Promise<T>): Promise<T> {
		const prev = this.chains.get(providerId) ?? Promise.resolve();
		const queued = (async () => {
			await prev.catch(() => {});
			return task();
		})();
		const tail = queued.catch(() => {});
		this.chains.set(providerId, tail);
		return queued;
	}

	read(providerId: string): Promise<Credential | undefined> {
		return Promise.resolve(this.map.get(providerId));
	}

	list(): Promise<readonly CredentialInfo[]> {
		return Promise.resolve([...this.map].map(([providerId, c]) => ({ providerId, type: c.type })));
	}

	modify(
		providerId: string,
		fn: (current: Credential | undefined) => Promise<Credential | undefined>,
	): Promise<Credential | undefined> {
		return this.enqueue(providerId, async () => {
			const next = await fn(this.map.get(providerId));
			if (next !== undefined) this.map.set(providerId, next);
			return next;
		});
	}

	delete(providerId: string): Promise<void> {
		return this.enqueue(providerId, async () => {
			this.map.delete(providerId);
		});
	}
}

/**
 * Известные env-переменные API-ключей.
 * Ключ для домена Base URL: иначе провайдер неизвестен и env не подсказываем.
 */
export const PROVIDER_ENV_KEYS: Record<string, readonly string[]> = {
	openai: ['OPENAI_API_KEY'],
	anthropic: ['ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_OAUTH_TOKEN', 'ANTHROPIC_API_KEY'],
	azure: ['AZURE_OPENAI_API_KEY'],
	deepseek: ['DEEPSEEK_API_KEY'],
	google: ['GEMINI_API_KEY'],
	'google-vertex': ['GOOGLE_CLOUD_API_KEY'],
	groq: ['GROQ_API_KEY'],
	cerebras: ['CEREBRAS_API_KEY'],
	xai: ['XAI_API_KEY'],
	openrouter: ['OPENROUTER_API_KEY'],
	'openai-codex': ['OPENCODE_API_KEY'],
	opencode: ['OPENCODE_API_KEY'],
	mistral: ['MISTRAL_API_KEY'],
	minimax: ['MINIMAX_API_KEY'],
	moonshotai: ['MOONSHOT_API_KEY'],
	huggingface: ['HF_TOKEN'],
	fireworks: ['FIREWORKS_API_KEY'],
	together: ['TOGETHER_API_KEY'],
	baseten: ['BASETEN_API_KEY'],
	zai: ['ZAI_API_KEY'],
	'zai-coding-cn': ['ZAI_CODING_CN_API_KEY'],
	nvidia: ['NVIDIA_API_KEY'],
	'github-copilot': ['COPILOT_GITHUB_TOKEN'],
	'cloudflare-workers-ai': ['CLOUDFLARE_API_KEY'],
	'cloudflare-ai-gateway': ['CLOUDFLARE_API_KEY'],
	'kimi-coding': ['KIMI_API_KEY'],
	meta: ['META_API_KEY'],
	xiaomi: ['XIAOMI_API_KEY'],
	radius: ['RADIUS_API_KEY'],
	typesafe: ['TYPESAFE_API_KEY'],
	'ant-ling': ['ANT_LING_API_KEY']
};

/** Домен Base URL → id провайдера (обратная таблица для env-подсказки). */
export const HOST_TO_PROVIDER: Record<string, string> = {
	'api.openai.com': 'openai',
	'api.anthropic.com': 'anthropic',
	'api.deepseek.com': 'deepseek',
	'generativelanguage.googleapis.com': 'google',
	'api.groq.com': 'groq',
	'api.x.ai': 'xai',
	'openrouter.ai': 'openrouter',
	'api.mistral.ai': 'mistral',
	'api.minimax.chat': 'minimax',
	'api.moonshot.cn': 'moonshotai',
	'api-inference.huggingface.co': 'huggingface',
	'api.fireworks.ai': 'fireworks',
	'api.together.xyz': 'together',
	'api.cerebras.ai': 'cerebras',
	'api.z.ai': 'zai',
	'integrate.api.nvidia.com': 'nvidia',
	'cognitive.openai.azure.com': 'azure'
};

/** Найденные в окружении env-переменные ключа для провайдера (без значений). */
export function findEnvKeys(providerId: string, env: Record<string, string | undefined>): string[] | undefined {
	const vars = PROVIDER_ENV_KEYS[providerId];
	if (!vars) return undefined;
	const found = vars.filter((v) => !!env[v]);
	return found.length ? found : undefined;
}

export function providerIdForHost(host: string): string | undefined {
	return HOST_TO_PROVIDER[host.toLowerCase()];
}
