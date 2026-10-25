/**
 * Офлайн-каталог известных семейств моделей: reasoning + карта уровней + способ
 * отправки в провайдер. Офлайн-набор, сеть не трогается.
 * Unknown-модели остаются unknown: не угадываем (см. supportsThinking в api.ts).
 */
import type { ThinkingLevelMap } from './thinking.ts';
import { modelFamily } from './api.ts';

/** Как передать уровень провайдеру. */
export type Wire =
	/** OpenAI-совместимый reasoning_effort (openai, deepseek, xai, groq, together...). */
	| { kind: 'reasoning_effort' }
	/** Anthropic thinking budget_tokens (min/max). */
	| { kind: 'anthropic_budget'; budgets: Partial<Record<'low' | 'medium' | 'high' | 'xhigh' | 'max', number>> }
	/** Google gemini thinkingLevel (discrete) или thinkingBudget. */
	| { kind: 'google_level' }
	/** Toggle: вкл/выкл без уровней (qwen enable_thinking и т.п.). */
	| { kind: 'toggle' };

export interface FamilyCatalog {
	family: string;
	reasoning: boolean;
	/** Уровень → значение провайдера; null = не поддерживается. */
	thinkingLevelMap?: ThinkingLevelMap;
	wire: Wire;
}

/**
 * OpenAI: gpt-5+ и o-серия. reasoning_effort: minimal|low|medium|high (xhigh/max — только
 * у gpt-5.2 через спец. доступ; по умолчанию не поддерживаются).
 */
const OPENAI_EFFORT: ThinkingLevelMap = {
	off: null,
	minimal: 'minimal',
	low: 'low',
	medium: 'medium',
	high: 'high',
	xhigh: null,
	max: null
};

export const MODEL_CATALOG: FamilyCatalog[] = [
	{
		family: 'OpenAI o-серия',
		reasoning: true,
		thinkingLevelMap: { ...OPENAI_EFFORT, minimal: null },
		wire: { kind: 'reasoning_effort' }
	},
	{
		family: 'GPT',
		reasoning: true,
		thinkingLevelMap: OPENAI_EFFORT,
		wire: { kind: 'reasoning_effort' }
	},
	{
		family: 'Claude',
		reasoning: true,
		thinkingLevelMap: {
			off: null,
			low: 'low',
			medium: 'medium',
			high: 'high',
			xhigh: null,
			max: 'max'
		},
		wire: {
			kind: 'anthropic_budget',
			budgets: { low: 2048, medium: 8192, high: 16384, max: 32000 }
		}
	},
	{
		family: 'Gemini',
		reasoning: true,
		thinkingLevelMap: { off: null, low: 'low', medium: 'medium', high: 'high' },
		wire: { kind: 'google_level' }
	},
	{
		family: 'Grok',
		reasoning: true,
		thinkingLevelMap: { off: null, low: 'low', medium: 'medium', high: 'high' },
		wire: { kind: 'reasoning_effort' }
	},
	{
		family: 'DeepSeek',
		reasoning: true,
		thinkingLevelMap: { off: null, low: 'low', medium: 'medium', high: 'high' },
		wire: { kind: 'reasoning_effort' }
	},
	{
		family: 'Qwen',
		reasoning: true,
		thinkingLevelMap: { off: null, low: 'low', medium: 'medium', high: 'high' },
		wire: { kind: 'toggle' }
	},
	{
		family: 'GLM',
		reasoning: true,
		thinkingLevelMap: { off: null, low: 'low', medium: 'medium', high: 'high' },
		wire: { kind: 'reasoning_effort' }
	},
	{
		family: 'Kimi',
		reasoning: true,
		thinkingLevelMap: { off: null, low: 'low', medium: 'medium', high: 'high' },
		wire: { kind: 'toggle' }
	},
	{ family: 'Llama', reasoning: false, wire: { kind: 'toggle' } },
	{ family: 'Mistral', reasoning: false, wire: { kind: 'toggle' } }
];

export function catalogForFamily(family: string): FamilyCatalog | undefined {
	return MODEL_CATALOG.find((c) => c.family === family);
}

/**
 * По-модельные переопределения: семейный каталог не знает исключений внутри семейства
 * (flash-варианты и т.п.). Совпадение по id → готовый ответ вместо семейного каталога.
 * Уточняется по мере находок; модель не из списка — считаем по семейству.
 */
const MODEL_OVERRIDES: { pattern: RegExp; catalog: FamilyCatalog | null }[] = [
	// GLM flash-варианты без мышления
	{ pattern: /^glm.*flash/i, catalog: { family: 'GLM (flash)', reasoning: false, wire: { kind: 'toggle' } } }
];

/** Каталог для конкретной модели: переопределение по id → семейство → undefined. */
export function catalogForModel(id: string): FamilyCatalog | undefined {
	const hit = MODEL_OVERRIDES.find((o) => o.pattern.test(id));
	if (hit) return hit.catalog ?? undefined;
	return catalogForFamily(modelFamily(id));
}
