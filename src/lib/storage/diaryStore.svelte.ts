/**
 * Дневник как реактивное состояние (Svelte 5 runes).
 * Отдельный store от journalStore: своя загрузка, своё сохранение.
 */
import { loadDiary, saveDiary } from './diary.ts';
import {
	createEntry,
	normalizeEntry,
	syncTagVocabulary,
	upsertDayEntry,
	type DiaryEntry
} from '../domain/diary.ts';

let entries = $state<DiaryEntry[]>([]);
let tags = $state<string[]>([]);
let loading = $state(true);
let ready = $state(false);
let error = $state<string | null>(null);

let saveTimer: ReturnType<typeof setTimeout> | null = null;
// Чтение не удалось: писать поверх битого/недоступного файла нельзя — иначе потеря данных
let readFailed = false;

export function getEntries(): DiaryEntry[] {
	return entries;
}

/** Пользовательский словарь тегов дневника. */
export function getTagVocabulary(): string[] {
	return tags;
}

export const diaryState = {
	get loading() {
		return loading;
	},
	get ready() {
		return ready;
	},
	get error() {
		return error;
	},
	get count() {
		return entries.length;
	}
};

/** Отложенное сохранение (склеивает серию правок). */
function scheduleSave() {
	if (readFailed) return;
	if (saveTimer) clearTimeout(saveTimer);
	saveTimer = setTimeout(async () => {
		saveTimer = null;
		try {
			await saveDiary($state.snapshot(entries) as DiaryEntry[], $state.snapshot(tags) as string[]);
		} catch (e) {
			error = 'Не удалось сохранить запись дневника';
			console.error('diary save failed', e);
		}
	}, 120);
}

/** Первичная загрузка. */
export async function initDiary(): Promise<void> {
	if (ready || loading === false) return;
	loading = true;
	try {
		const loaded = await loadDiary();
		entries = loaded.entries;
		tags = loaded.tags;
		readFailed = loaded.failed;
		error = loaded.failed ? 'Не удалось прочитать дневник — новые записи не сохраняются' : null;
	} catch {
		readFailed = true;
		error = 'Не удалось прочитать дневник — новые записи не сохраняются';
		entries = [];
		tags = [];
	} finally {
		loading = false;
		ready = true;
	}
}

/** Добавить запись. */
export function addEntry(patch: Partial<DiaryEntry> = {}): DiaryEntry {
	const entry = createEntry(patch);
	entries = [entry, ...entries];
	tags = syncTagVocabulary(entries, $state.snapshot(tags) as string[]);
	scheduleSave();
	return entry;
}

/**
 * Сохранить «Разбор дня». Одна запись на день: если запись дня уже есть —
 * обновляем её, иначе создаём новую.
 */
export function saveDayEntry(patch: Partial<DiaryEntry>): DiaryEntry {
	const merged = upsertDayEntry($state.snapshot(entries) as DiaryEntry[], patch);
	if (merged.id) {
		updateEntry(merged.id, merged);
		return entries.find((e) => e.id === merged.id)!;
	}
	return addEntry(merged);
}

/** Обновить запись по id. */
export function updateEntry(id: string, patch: Partial<DiaryEntry>): void {
	entries = entries.map((e) => (e.id === id ? normalizeEntry({ ...e, ...patch, id }) : e));
	tags = syncTagVocabulary(entries, $state.snapshot(tags) as string[]);
	scheduleSave();
}

/** Удалить запись. */
export function deleteEntry(id: string): void {
	entries = entries.filter((e) => e.id !== id);
	tags = syncTagVocabulary(entries, $state.snapshot(tags) as string[]);
	scheduleSave();
}
