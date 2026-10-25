/**
 * Уровни «мышления» модели.
 *
 * Модель thinking-уровней:
 *  - 6 усилий: minimal | low | medium | high | xhigh | max
 *  - 'off' — пользовательский выбор «выключить», не уровень усилия
 *  - у модели флаг reasoning и карта ThinkingLevelMap: уровень → значение провайдера
 *    (string) или null = уровень не поддерживается; отсутствующий ключ = дефолт провайдера
 *  - 'xhigh' и 'max' без явного маппинга считаются неподдерживаемыми (см. getSupportedThinkingLevels)
 */

export const THINKING_LEVELS = ['minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const;
export const MODEL_THINKING_LEVELS = ['off', ...THINKING_LEVELS] as const;

export type ThinkingLevel = (typeof THINKING_LEVELS)[number];
export type ModelThinkingLevel = (typeof MODEL_THINKING_LEVELS)[number];

/** Уровень → значение провайдера; null = уровень не поддерживается моделью. */
export type ThinkingLevelMap = Partial<Record<ModelThinkingLevel, string | null>>;

/** Все уровни по порядку — для clamp-поиска соседей. */
const ORDER: readonly ModelThinkingLevel[] = MODEL_THINKING_LEVELS;

export function isThinkingLevel(v: unknown): v is ThinkingLevel {
	return typeof v === 'string' && (THINKING_LEVELS as readonly string[]).includes(v);
}

export function isModelThinkingLevel(v: unknown): v is ModelThinkingLevel {
	return typeof v === 'string' && (MODEL_THINKING_LEVELS as readonly string[]).includes(v);
}

/**
 * Какие уровни модель поддерживает.
 * off разрешён, если карта не помечает его null (иначе модель не умеет выключать мышление).
 */
export function getSupportedThinkingLevels(model: {
	reasoning: boolean;
	thinkingLevelMap?: ThinkingLevelMap;
}): ModelThinkingLevel[] {
	if (!model.reasoning) return ['off'];
	return ORDER.filter((level) => {
		const mapped = model.thinkingLevelMap?.[level];
		if (mapped === null) return false;
		if (level === 'xhigh' || level === 'max') return mapped !== undefined;
		return true;
	});
}

/**
 * Приблизить запрошенный уровень к ближайшему поддерживаемому
 * (порт clampThinkingLevel: сначала вверх, потом вниз, иначе первый доступный).
 */
export function clampThinkingLevel(
	model: { reasoning: boolean; thinkingLevelMap?: ThinkingLevelMap },
	level: ModelThinkingLevel,
): ModelThinkingLevel {
	const available = getSupportedThinkingLevels(model);
	if (available.includes(level)) return level;

	const idx = ORDER.indexOf(level);
	if (idx === -1) return available[0] ?? 'off';
	for (let i = idx; i < ORDER.length; i++) if (available.includes(ORDER[i])) return ORDER[i];
	for (let i = idx - 1; i >= 0; i--) if (available.includes(ORDER[i])) return ORDER[i];
	return available[0] ?? 'off';
}

/** Уровень → значение провайдера (строка) либо null/undefined — как его резолвят API-адаптеры. */
export function resolveProviderValue(
	model: { thinkingLevelMap?: ThinkingLevelMap },
	level: ModelThinkingLevel,
): string | null | undefined {
	return model.thinkingLevelMap?.[level];
}

/**
 * Превратить список effort-значений провайдера (из /models metadata)
 * в карту уровней. 'default' и null в списке игнорируются; 'none' маппится в off.
 */
export type ProviderReasoningOption =
	| { type: 'toggle' }
	| { type: 'effort'; values: Array<'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max' | 'default' | null> }
	| { type: 'budget_tokens'; min?: number; max?: number };

export function effortThinkingLevelMap(options: readonly ProviderReasoningOption[]): ThinkingLevelMap | undefined {
	const effortValues = options.flatMap((o) => (o.type === 'effort' ? o.values : []));
	if (effortValues.length === 0) return undefined;
	const supported = new Set(effortValues);
	if (!THINKING_LEVELS.some((l) => supported.has(l)) && !supported.has('none')) return undefined;
	const map: ThinkingLevelMap = { off: supported.has('none') ? 'none' : null };
	for (const level of THINKING_LEVELS) map[level] = supported.has(level) ? level : null;
	return map;
}
