/**
 * Дневник трейдера: модель записи, типы, фильтрация и группировка по дням.
 * Чистые функции — без DOM и без хранилищ.
 *
 * Запись дневника — самостоятельная сущность (не комментарий к сделке).
 * Связь со сделками — только списком id (многие-ко-многим), опциональная.
 */
import { dayKey, nowStamp, parseStamp, tradeProfit, uuid, type Trade } from './trades.ts';

// ─────────────────────────────────────────────────────────────────────────────
// Типы записей
// ─────────────────────────────────────────────────────────────────────────────

export type DiaryKind = 'note' | 'mistake' | 'emotion' | 'day';

export interface DiaryKindInfo {
	id: DiaryKind;
	label: string;
	/** Короткая подпись для бейджа в ленте. */
	short: string;
	hint: string;
}

export const DIARY_KINDS: DiaryKindInfo[] = [
	{ id: 'note', label: 'Наблюдение', short: 'Набл', hint: 'Что заметил на рынке или в себе' },
	{ id: 'mistake', label: 'Разбор ошибки', short: 'Ошибка', hint: 'Что случилось, почему, что изменю' },
	{ id: 'emotion', label: 'Эмоция', short: 'Эмоция', hint: 'Что чувствовал и как это повлияло' },
	{ id: 'day', label: 'Разбор дня', short: 'День', hint: 'Итог дня: что сработало, что нет' }
];

const KIND_IDS = DIARY_KINDS.map((k) => k.id);

export function kindInfo(kind: DiaryKind): DiaryKindInfo {
	return DIARY_KINDS.find((k) => k.id === kind) ?? DIARY_KINDS[0];
}

export interface DiaryEntry {
	id: string;
	kind: DiaryKind;
	/** 'YYYY-MM-DD HH:mm:ss' — локальное время. */
	at: string;
	/** Основной текст записи. */
	text: string;
	/** «Разбор ошибки»: что случилось / почему / что изменю. Пусто у прочих типов. */
	mistakeWhat: string;
	mistakeWhy: string;
	mistakeFix: string;
	/** Теги из пользовательского словаря дневника. */
	tags: string[];
	/** Дисциплина 1–5, null — не оценено. */
	discipline: number | null;
	/** Спокойствие 1–5, null — не оценено. */
	calm: number | null;
	/** Следование плану: да / нет / не отмечено. */
	followedPlan: boolean | null;
	/** Связанные сделки (id из журнала), многие-ко-многим, опционально. */
	tradeIds: string[];
	/** «Разбор дня»: утренний план перед сессией. Пусто у прочих типов. */
	dayPlan: string;
	/** «Разбор дня»: вечерний итог. Пусто у прочих типов. */
	dayResult: string;
	/** «Разбор дня»: главная ошибка дня. */
	mainMistake: string;
	/** «Разбор дня»: соблюдал чек-лист входа. null — не отмечено. */
	checklist: ChecklistAnswer | null;
}

/** Соблюдение чек-листа входа в «Разборе дня». */
export type ChecklistAnswer = 'yes' | 'partial' | 'no';

export const CHECKLIST_OPTIONS: { id: ChecklistAnswer; label: string }[] = [
	{ id: 'yes', label: 'Да' },
	{ id: 'partial', label: 'Частично' },
	{ id: 'no', label: 'Нет' }
];

function clampScore(value: unknown): number | null {
	if (value == null || value === '') return null;
	const n = Math.round(Number(value));
	if (!Number.isFinite(n)) return null;
	return Math.min(5, Math.max(1, n));
}

/** Привести загруженную запись к полному виду (терпимо к мусору и старым полям). */
export function normalizeEntry(raw: unknown): DiaryEntry {
	const e = (raw && typeof raw === 'object' ? raw : {}) as Partial<DiaryEntry> & Record<string, unknown>;
	return {
		id: e.id ? String(e.id) : uuid(),
		kind: KIND_IDS.includes(e.kind as DiaryKind) ? (e.kind as DiaryKind) : 'note',
		at: typeof e.at === 'string' && e.at ? e.at : nowStamp(),
		text: String(e.text ?? ''),
		mistakeWhat: String(e.mistakeWhat ?? ''),
		mistakeWhy: String(e.mistakeWhy ?? ''),
		mistakeFix: String(e.mistakeFix ?? ''),
		tags: Array.isArray(e.tags) ? [...new Set(e.tags.map(String).filter(Boolean))] : [],
		discipline: clampScore(e.discipline),
		calm: clampScore(e.calm),
		followedPlan: typeof e.followedPlan === 'boolean' ? e.followedPlan : null,
		tradeIds: Array.isArray(e.tradeIds) ? [...new Set(e.tradeIds.map(String).filter(Boolean))] : [],
		dayPlan: String(e.dayPlan ?? ''),
		dayResult: String(e.dayResult ?? ''),
		mainMistake: String(e.mainMistake ?? ''),
		checklist: CHECKLIST_IDS.includes(e.checklist as ChecklistAnswer)
			? (e.checklist as ChecklistAnswer)
			: null
	};
}

const CHECKLIST_IDS = CHECKLIST_OPTIONS.map((o) => o.id);

export function createEntry(patch: Partial<DiaryEntry> = {}): DiaryEntry {
	return normalizeEntry({ id: uuid(), kind: 'note', at: nowStamp(), text: '', ...patch });
}

// ─────────────────────────────────────────────────────────────────────────────
// Словарь тегов
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Обновить словарь тегов: добавить отсутствующие, убрать исчезнувшие из записей.
 * Порядок — по алфавиту, чтобы список не «прыгал» при сохранении.
 */
export function syncTagVocabulary(entries: DiaryEntry[], previous: string[] = []): string[] {
	const used = new Set<string>();
	for (const e of entries) for (const t of e.tags) used.add(t.trim());
	const kept = previous.map((t) => t.trim()).filter((t) => used.has(t));
	return [...new Set([...kept, ...used])].filter(Boolean).sort((a, b) => a.localeCompare(b, 'ru'));
}

// ─────────────────────────────────────────────────────────────────────────────
// Поиск, фильтры, группировка
// ─────────────────────────────────────────────────────────────────────────────

export interface DiaryFilters {
	/** Подстрока по тексту (включая поля разбора ошибки и теги). */
	search: string;
	/** Тип записи или null — все. */
	kind: DiaryKind | null;
	/** Тег или null — все. */
	tag: string | null;
	/** День 'YYYY-MM-DD' или null — все дни. */
	day: string | null;
}

export function emptyDiaryFilters(): DiaryFilters {
	return { search: '', kind: null, tag: null, day: null };
}

function haystack(e: DiaryEntry): string {
	return [e.text, e.mistakeWhat, e.mistakeWhy, e.mistakeFix, e.dayPlan, e.dayResult, e.mainMistake, ...e.tags]
		.join(' ')
		.toLowerCase();
}

export function filterEntries(entries: DiaryEntry[], f: DiaryFilters): DiaryEntry[] {
	const q = f.search.trim().toLowerCase();
	return entries.filter((e) => {
		if (f.kind && e.kind !== f.kind) return false;
		if (f.tag && !e.tags.includes(f.tag)) return false;
		if (f.day && dayKey(e.at) !== f.day) return false;
		if (q && !haystack(e).includes(q)) return false;
		return true;
	});
}

/** Свежие сверху. */
export function sortEntries(entries: DiaryEntry[]): DiaryEntry[] {
	return [...entries].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

export interface DiaryDay {
	/** 'YYYY-MM-DD' */
	key: string;
	entries: DiaryEntry[];
}

/** Сгруппировать по дню: дни по убыванию, внутри дня — свежие сверху. */
export function groupByDiaryDay(entries: DiaryEntry[]): DiaryDay[] {
	const map = new Map<string, DiaryEntry[]>();
	for (const e of sortEntries(entries)) {
		const key = dayKey(e.at);
		if (!key) continue;
		const list = map.get(key);
		if (list) list.push(e);
		else map.set(key, [e]);
	}
	return [...map.entries()]
		.sort((a, b) => (a[0] < b[0] ? 1 : -1))
		.map(([key, list]) => ({ key, entries: list }));
}

/** Все дни, в которых есть записи (по убыванию) — для выбора дня. */
export function entryDays(entries: DiaryEntry[]): string[] {
	return [...new Set(entries.map((e) => dayKey(e.at)).filter((k): k is string => !!k))].sort((a, b) =>
		a < b ? 1 : -1
	);
}

/** Теги, реально встречающиеся в переданных записях (для фильтра). */
export function tagsInUse(entries: DiaryEntry[]): string[] {
	const used = new Set<string>();
	for (const e of entries) for (const t of e.tags) used.add(t);
	return [...used].sort((a, b) => a.localeCompare(b, 'ru'));
}

// ─────────────────────────────────────────────────────────────────────────────
// «Разбор дня»: одна запись на день + авто-итоги из сделок
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Разбор дня для конкретного дня: существующий или новая пустая запись.
 * Одна на день — утренний план и вечерний итог живут в ней же.
 */
export function dayEntry(entries: DiaryEntry[], day: string): DiaryEntry | null {
	const list = entries.filter((e) => e.kind === 'day' && dayKey(e.at) === day);
	return list.length ? sortEntries(list)[0] : null;
}

/** Сохранить разбор дня: обновляет запись дня или создаёт её (одна на день). */
export function upsertDayEntry(entries: DiaryEntry[], patch: Partial<DiaryEntry>): Partial<DiaryEntry> {
	const day = dayKey(patch.at) ?? dayKey(nowStamp()) ?? '';
	const existing = dayEntry(entries, day);
	return { ...patch, kind: 'day', at: `${day} 00:00:00`, ...(existing ? { id: existing.id } : {}) };
}

/** Сделки одного дня: по закрытию, иначе по открытию. */
export function tradesOfDay(trades: Trade[], day: string): Trade[] {
	return trades.filter((t) => dayKey(t.dateClose || t.dateOpen) === day);
}

/** Killzone по часу входа сделки (UTC). Границы условные: у разных брокеров свои сессии. */
export const KILLZONES: { id: string; label: string; from: number; to: number }[] = [
	{ id: 'asia', label: 'Азия', from: 0, to: 8 },
	{ id: 'london', label: 'Лондон', from: 8, to: 12 },
	{ id: 'overlap', label: 'Лондон × Нью-Йорк', from: 12, to: 13 },
	{ id: 'newyork', label: 'Нью-Йорк', from: 13, to: 17 },
	{ id: 'late', label: 'Поздняя сессия', from: 17, to: 24 }
];

export function killzoneOf(at: string): string | null {
	const d = parseStamp(at);
	if (!d) return null;
	const h = d.getUTCHours();
	return (KILLZONES.find((k) => h >= k.from && h < k.to) ?? KILLZONES[KILLZONES.length - 1]).label;
}

export interface DayTotals {
	/** Итоговый P/L дня по закрытым сделкам. */
	profit: number;
	/** Всего сделок за день (открытые тоже). */
	count: number;
	closed: number;
	wins: number;
	losses: number;
	/** Killzone, в которых были входы, по убыванию числа сделок. */
	killzones: string[];
	/** Сделки, привязанные вручную (для подписи в разборе). */
	linkedCount: number;
}

/** Авто-итоги дня из журнала сделок — не вводятся руками. */
export function dayTotals(trades: Trade[], day: string, linkedIds: string[] = []): DayTotals {
	const list = tradesOfDay(trades, day);
	const acc: DayTotals = {
		profit: 0,
		count: list.length,
		closed: 0,
		wins: 0,
		losses: 0,
		killzones: [],
		linkedCount: 0
	};
	const zones = new Map<string, number>();
	const linked = new Set(linkedIds);
	for (const t of list) {
		if (linked.has(t.id)) acc.linkedCount++;
		const zone = killzoneOf(t.dateOpen);
		if (zone) zones.set(zone, (zones.get(zone) ?? 0) + 1);
		if (t.status !== 'closed') continue;
		const p = tradeProfit(t);
		acc.closed++;
		acc.profit += p;
		if (p > 0) acc.wins++;
		else if (p < 0) acc.losses++;
	}
	acc.profit = Number(acc.profit.toFixed(2));
	acc.killzones = [...zones.entries()].sort((a, b) => b[1] - a[1]).map(([z]) => z);
	return acc;
}

// ─────────────────────────────────────────────────────────────────────────────
// Статистика дневника: шкалы по дням, топ ошибок, средние по дням недели
// ─────────────────────────────────────────────────────────────────────────────

/** Метка дня недели Пн..Вс и её номер для сортировки. */
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export interface DayScore {
	day: string;
	/** 'Пн'..'Вс' */
	weekday: string;
	/** Среднее по записям дня; null — шкалу в этот день не ставили. */
	discipline: number | null;
	calm: number | null;
	/** P/L дня по закрытым сделкам. */
	profit: number;
	/** Сделок за день. */
	count: number;
}

function avg(values: number[]): number | null {
	if (!values.length) return null;
	return Number((values.reduce((s, v) => s + v, 0) / values.length).toFixed(2));
}

/**
 * Шкалы дневника по дням рядом с P/L дня.
 * Дни — те, где есть записи дневника или сделки в пределах периода.
 */
export function dayScores(entries: DiaryEntry[], trades: Trade[], since?: number): DayScore[] {
	const byDay = new Map<string, { discipline: number[]; calm: number[] }>();
	for (const e of entries) {
		const key = dayKey(e.at);
		if (!key) continue;
		const bucket = byDay.get(key) ?? { discipline: [], calm: [] };
		if (e.discipline != null) bucket.discipline.push(e.discipline);
		if (e.calm != null) bucket.calm.push(e.calm);
		byDay.set(key, bucket);
	}
	const profits = new Map<string, { profit: number; count: number }>();
	for (const t of trades) {
		const key = dayKey(t.dateClose || t.dateOpen);
		if (!key) continue;
		const bucket = profits.get(key) ?? { profit: 0, count: 0 };
		bucket.count++;
		// P/L дня — как в KPI дашборда: сумма по всем сделкам дня
		bucket.profit += tradeProfit(t);
		profits.set(key, bucket);
	}
	const keys = new Set([...byDay.keys(), ...profits.keys()]);
	const rows: DayScore[] = [];
	for (const day of keys) {
		const at = parseStamp(day);
		if (since != null && at && at.getTime() < since) continue;
		const s = byDay.get(day);
		const p = profits.get(day);
		rows.push({
			day,
			weekday: WEEKDAYS[((at?.getDay() ?? 1) + 6) % 7],
			discipline: avg(s?.discipline ?? []),
			calm: avg(s?.calm ?? []),
			profit: Number((p?.profit ?? 0).toFixed(2)),
			count: p?.count ?? 0
		});
	}
	return rows.sort((a, b) => (a.day < b.day ? 1 : -1));
}

export interface MistakeStat {
	/** Тип записи: «Разбор ошибки», «Разбор дня» (главная ошибка) или тег. */
	source: 'mistake' | 'day' | 'tag';
	label: string;
	count: number;
	/** P/L дней, в которые это встречалось. */
	profit: number;
}

/**
 * Топ ошибок за период: записи «Разбор ошибки», главные ошибки «Разбора дня»
 * и теги, которыми помечены ошибки. Порядок — по частоте, затем по алфавиту.
 */
export function topMistakes(entries: DiaryEntry[], trades: Trade[], since?: number, limit = 8): MistakeStat[] {
	const acc = new Map<string, MistakeStat>();
	const bump = (source: MistakeStat['source'], label: string, day: string) => {
		const key = `${source}:${label.toLowerCase()}`;
		const stat = acc.get(key) ?? { source, label, count: 0, profit: 0 };
		stat.count++;
		stat.profit += dayTotals(trades, day).profit;
		acc.set(key, stat);
	};
	for (const e of entries) {
		if (since != null) {
			const t = parseStamp(e.at)?.getTime();
			if (t == null || t < since) continue;
		}
		const day = dayKey(e.at) ?? '';
		if (e.kind === 'mistake') {
			bump('mistake', e.mistakeWhat.trim().split('\n')[0].slice(0, 80) || 'ошибка без описания', day);
			for (const tag of e.tags) bump('tag', tag, day);
		}
		if (e.kind === 'day' && e.mainMistake.trim()) bump('day', e.mainMistake.trim().slice(0, 80), day);
	}
	return [...acc.values()]
		.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'ru'))
		.slice(0, limit);
}

export interface WeekdayScore {
	weekday: string;
	discipline: number | null;
	calm: number | null;
	days: number;
}

/** Средние шкалы по дням недели (Пн..Вс) за период. */
export function weekdayScores(entries: DiaryEntry[], since?: number): WeekdayScore[] {
	const buckets = new Map<string, { discipline: number[]; calm: number[]; days: Set<string> }>();
	for (const e of entries) {
		const at = parseStamp(e.at);
		if (!at) continue;
		if (since != null && at.getTime() < since) continue;
		if (e.discipline == null && e.calm == null) continue;
		const weekday = WEEKDAYS[(at.getDay() + 6) % 7];
		const bucket = buckets.get(weekday) ?? { discipline: [], calm: [], days: new Set<string>() };
		if (e.discipline != null) bucket.discipline.push(e.discipline);
		if (e.calm != null) bucket.calm.push(e.calm);
		bucket.days.add(dayKey(e.at) ?? '');
		buckets.set(weekday, bucket);
	}
	return WEEKDAYS.map((weekday) => {
		const b = buckets.get(weekday);
		return {
			weekday,
			discipline: avg(b?.discipline ?? []),
			calm: avg(b?.calm ?? []),
			days: b?.days.size ?? 0
		};
	});
}
