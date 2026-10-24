/**
 * Хранилище журнала: единая точка загрузки/сохранения сделок и настроек.
 *
 * Браузер  → localStorage (namespaced ключи)
 * Tauri    → файлы в AppData через sandboxed IPC-команды (read/write/delete)
 *
 * Формат: `{ version, trades: Trade[] }`. Сделки — сырые объекты,
 * нормализация выполняется при чтении (normalizeTrade).
 */
import { isTauri, invoke } from '../platform/index.js';
import { namespaced } from './local.js';
import { normalizeTrade } from '../domain/trades.js';
import { demoMt5Report } from '../domain/mt5.js';

const KEY = 'journalData_v1';
const FILE = 'journal.json';
const SCHEMA_VERSION = 1;

const ns = namespaced('ndtj:');

/** @returns {Promise<{trades: any[]}|null>} */
async function readRaw() {
	if (isTauri()) {
		try {
			const files = await invoke('list_data_files', { relDir: '' });
			if (Array.isArray(files) && files.includes(FILE)) {
				const text = await invoke('read_data_file', { relPath: FILE });
				if (text == null) return null;
				return JSON.parse(String(text));
			}
		} catch (e) {
			console.error('journal.read (tauri) failed', e);
		}
		return null;
	}
	const raw = ns.get(KEY);
	if (!raw) return null;
	try {
		return JSON.parse(raw);
	} catch (e) {
		console.error('journal.read (local) failed', e);
		return null;
	}
}

/** @param {{version?: number, trades: any[]}} data */
async function writeRaw(data) {
	const payload = JSON.stringify({ version: SCHEMA_VERSION, ...data });
	if (isTauri()) {
		const res = await invoke('write_data_file', { relPath: FILE, contents: payload });
		if (res && res.ok === false) throw new Error(res.error || 'write failed');
		return;
	}
	ns.set(KEY, payload);
}

/**
 * Загрузить журнал. При первом запуске — демо-набор, чтобы интерфейс был живым.
 * @param {{seedDemo?: boolean}} opts
 * @returns {Promise<any[]>}
 */
export async function loadTrades({ seedDemo = true } = {}) {
	const data = await readRaw();
	if (data && Array.isArray(data.trades)) {
		return data.trades.map(normalizeTrade);
	}
	if (!seedDemo) return [];
	const seed = demoMt5Report(28);
	await writeRaw({ version: SCHEMA_VERSION, trades: seed });
	return seed.map(normalizeTrade);
}

/** Сохранить список сделок. */
export async function saveTrades(trades) {
	await writeRaw({ version: SCHEMA_VERSION, trades });
	return true;
}

/** Удалить все данные журнала (сброс). */
export async function clearJournal() {
	if (isTauri()) {
		try {
			await invoke('delete_data_file', { relPath: FILE });
		} catch (e) {
			console.error('journal.clear (tauri) failed', e);
		}
		return;
	}
	ns.remove(KEY);
}

/** Настройки интерфейса (колонки, фильтры) — всегда локально, они не критичны. */
const UI_KEY = 'ui:';

export function loadUiSetting(key, fallback) {
	const raw = ns.get(UI_KEY + key);
	if (raw == null) return fallback;
	try {
		return JSON.parse(raw);
	} catch {
		return fallback;
	}
}

export function saveUiSetting(key, value) {
	try {
		ns.set(UI_KEY + key, JSON.stringify(value));
	} catch (e) {
		console.error('ui setting save failed', e);
	}
}
