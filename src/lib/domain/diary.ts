/**
 * Дневник трейдера: модель записи, типы, фильтрация и группировка по дням.
 * Чистые функции — без DOM и без хранилищ.
 *
 * Запись дневника — самостоятельная сущность (не комментарий к сделке).
 * Связь со сделками — только списком id (многие-ко-многим), опциональная.
 */
import { dayKey, nowStamp, uuid } from './trades.ts';

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
}

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
		tradeIds: Array.isArray(e.tradeIds) ? [...new Set(e.tradeIds.map(String).filter(Boolean))] : []
	};
}

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
	return [e.text, e.mistakeWhat, e.mistakeWhy, e.mistakeFix, ...e.tags].join(' ').toLowerCase();
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
