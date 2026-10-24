/**
 * Типы AI-подсистемы: подключение, настройки, сессии чата.
 */

/** Уровень «мышления» модели (референс: pi). */
export type ThinkingLevel = 'low' | 'medium' | 'high' | 'max';

/** Разделы журнала, разрешённые к отправке поставщику AI. */
export type SectionKey = 'trades' | 'comments' | 'notes' | 'attachments';

export const SECTION_LABELS: Record<SectionKey, string> = {
	trades: 'Сделки',
	comments: 'Комментарии',
	notes: 'Заметки',
	attachments: 'Вложения (изображения)'
};

/** Пресет разрешённых данных; 'custom' — ручной выбор. */
export type DataPreset = 'min' | 'work' | 'all' | 'custom';

export const PRESETS: { id: DataPreset; label: string; sections: SectionKey[] }[] = [
	{ id: 'min', label: 'Минимум', sections: ['trades'] },
	{ id: 'work', label: 'Рабочий контекст', sections: ['trades', 'comments', 'notes'] },
	{ id: 'all', label: 'Разрешить всё', sections: ['trades', 'comments', 'notes', 'attachments'] }
];

/** Системный файл контекста: текст + флаг включения в запросы. */
export interface ContextFile {
	text: string;
	enabled: boolean;
}

export interface AiSettings {
	/** '' → плейсхолдер https://api.openai.com/v1 */
	baseUrl: string;
	model: string | null;
	thinking: ThinkingLevel | null;
	/** Согласие на прямую отправку данных поставщику (перекрывает чат до подтверждения). */
	consent: boolean;
	preset: DataPreset;
	sections: SectionKey[];
	files: { agent: ContextFile; claude: ContextFile };
}

export function defaultSettings(): AiSettings {
	return {
		baseUrl: '',
		model: null,
		thinking: null,
		consent: false,
		preset: 'work',
		sections: ['trades', 'comments', 'notes'],
		files: {
			agent: { text: '', enabled: false },
			claude: { text: '', enabled: false }
		}
	};
}

export type MsgStatus = 'ok' | 'stopped' | 'error';

/** Фактическое использование токенов (из ответа провайдера). */
export interface MsgUsage {
	prompt: number;
	completion: number;
	total: number;
	/** Стоимость, только если цены пришли в metadata /models в известном формате. */
	cost: number | null;
}

export interface ChatMessage {
	id: string;
	role: 'user' | 'assistant';
	content: string;
	ts: number;
	/** Фактическая модель ответа (подпись у каждого ответа). */
	model?: string | null;
	thinking?: ThinkingLevel | null;
	status: MsgStatus;
	usage?: MsgUsage | null;
	/** Размер отправленного контекста журнала в символах (текст, без изображений). */
	contextChars?: number;
	/** Короткая причина ошибки (тело ответа провайдера не сохраняется). */
	errorNote?: string;
}

export interface ChatSession {
	id: string;
	title: string;
	createdTs: number;
	messages: ChatMessage[];
}

/** Модель из ответа /models (+ цены, если поставщик их отдаёт). */
export interface ModelInfo {
	id: string;
	/** Цена за 1 токен, известного формата; иначе null. */
	pricing?: { prompt: number; completion: number } | null;
}

export interface Usage {
	prompt_tokens?: number;
	completion_tokens?: number;
	total_tokens?: number;
}
