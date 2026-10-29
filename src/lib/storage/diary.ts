/**
 * Хранилище дневника: отдельный namespace от журнала сделок.
 *
 * Браузер  → localStorage (ключ nsdtj:, файл в Tauri — diary.json)
 * Tauri    → файл в AppData через sandboxed IPC-команды
 *
 * Формат: `{ version, entries: DiaryEntry[], tags: string[] }`.
 * Теги хранятся отдельно как пользовательский словарь.
 */
import { isTauri, invoke } from '../platform/index.ts';
import { normalizeEntry, syncTagVocabulary, type DiaryEntry } from '../domain/diary.ts';
import { namespaced } from './local.ts';

const KEY = 'diaryData_v1';
const FILE = 'diary.json';
const SCHEMA_VERSION = 1;

const ns = namespaced('ndtj:');

interface DiaryPayload {
	version?: number;
	entries: DiaryEntry[];
	tags: string[];
}

export interface DiaryData {
	entries: DiaryEntry[];
	tags: string[];
	/** true — чтение не удалось; сохранять поверх нельзя. */
	failed: boolean;
}

/**
 * Чтение с флагом сбоя — как в journal.ts: ошибку хранилища нельзя выдавать
 * за пустой дневник, иначе следующее сохранение затрёт файл пустотой.
 */
async function readRaw(): Promise<{ data: DiaryPayload | null; failed: boolean }> {
	if (isTauri()) {
		try {
			const files = await invoke<string[]>('list_data_files', { relDir: '' });
			if (!Array.isArray(files) || !files.includes(FILE)) return { data: null, failed: false };
			const text = await invoke<string | null>('read_data_file', { relPath: FILE });
			if (text == null) return { data: null, failed: false };
			return { data: JSON.parse(String(text)) as DiaryPayload, failed: false };
		} catch (e) {
			console.error('diary.read (tauri) failed', e);
			return { data: null, failed: true };
		}
	}
	const raw = ns.get(KEY);
	if (!raw) return { data: null, failed: false };
	try {
		return { data: JSON.parse(raw) as DiaryPayload, failed: false };
	} catch (e) {
		console.error('diary.read (local) failed', e);
		return { data: null, failed: true };
	}
}

async function writeRaw(entries: DiaryEntry[], tags: string[]): Promise<void> {
	const payload = JSON.stringify({ version: SCHEMA_VERSION, entries, tags } satisfies DiaryPayload);
	if (isTauri()) {
		const res = await invoke<{ ok?: boolean; error?: string }>('write_data_file', {
			relPath: FILE,
			contents: payload
		});
		if (res && res.ok === false) throw new Error(res.error || 'write failed');
		return;
	}
	ns.set(KEY, payload);
}

/**
 * Загрузить дневник. Отсутствующий файл — честно пустой дневник.
 * `failed` — хранилище не прочиталось (файл битый/нет доступа): записи писать нельзя.
 */
export async function loadDiary(): Promise<DiaryData> {
	const { data, failed } = await readRaw();
	const entries = Array.isArray(data?.entries) ? data!.entries.map(normalizeEntry) : [];
	const savedTags = Array.isArray(data?.tags) ? data!.tags.map(String) : [];
	// Словарь может отставать от записей (правка без сохранения словаря) — чиним при чтении
	return { entries, tags: syncTagVocabulary(entries, savedTags), failed };
}

/** Сохранить дневник; словарь тегов пересобирается из записей. */
export async function saveDiary(entries: DiaryEntry[], tags: string[] = []): Promise<void> {
	await writeRaw(entries, syncTagVocabulary(entries, tags));
}

/** Удалить все записи дневника. */
export async function clearDiary(): Promise<void> {
	if (isTauri()) {
		try {
			await invoke('delete_data_file', { relPath: FILE });
		} catch (e) {
			console.error('diary.clear (tauri) failed', e);
		}
		return;
	}
	ns.remove(KEY);
}
