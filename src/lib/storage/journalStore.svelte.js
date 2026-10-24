/**
 * Журнал как реактивное состояние (Svelte 5 runes, .svelte.js).
 * Единственный источник правды о сделках в приложении.
 */
import { loadTrades, saveTrades, clearJournal } from './journal.js';
import { createTrade, normalizeTrade, uuid } from '../domain/trades.js';

let trades = $state(/** @type {any[]} */ ([]));
let loading = $state(true);
let ready = $state(false);
let error = $state(/** @type {string|null} */ (null));

let saveTimer = null;

/** @returns {any[]} */
export function getTrades() {
	return trades;
}

/** Состояние загрузки — для индикаторов в UI. */
export const journalState = {
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
		return trades.length;
	}
};

/** Отложенное сохранение (склеивает серию правок). */
function scheduleSave() {
	if (saveTimer) clearTimeout(saveTimer);
	saveTimer = setTimeout(async () => {
		saveTimer = null;
		try {
			await saveTrades($state.snapshot(trades));
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			console.error('journal save failed', e);
		}
	}, 120);
}

/** Первичная загрузка. */
export async function initJournal() {
	if (ready || loading === false) return;
	loading = true;
	try {
		const loaded = await loadTrades();
		trades = loaded;
		error = null;
	} catch (e) {
		error = e instanceof Error ? e.message : String(e);
		trades = [];
	} finally {
		loading = false;
		ready = true;
	}
}

/**
 * Добавить сделку.
 * @param {any} patch
 * @returns {any} созданная сделка
 */
export function addTrade(patch = {}) {
	const trade = createTrade(patch);
	trades = [trade, ...trades];
	scheduleSave();
	return trade;
}

/**
 * Обновить сделку по id.
 * @param {string} id
 * @param {any} patch
 */
export function updateTrade(id, patch) {
	trades = trades.map((t) => (t.id === id ? normalizeTrade({ ...t, ...patch, id }) : t));
	scheduleSave();
}

/**
 * Удалить сделку.
 * @param {string} id
 */
export function deleteTrade(id) {
	trades = trades.filter((t) => t.id !== id);
	scheduleSave();
}

/**
 * Дублировать сделку как открытую.
 * @param {string} id
 */
export function duplicateTrade(id) {
	const src = trades.find((t) => t.id === id);
	if (!src) return null;
	const copy = {
		...src,
		id: uuid(),
		status: 'open',
		dateClose: null,
		priceClose: null,
		profit: null,
		comment: src.comment ? `${src.comment} (копия)` : ''
	};
	trades = [normalizeTrade(copy), ...trades];
	scheduleSave();
	return copy;
}

/**
 * Добавить импортированные сделки (MT5).
 *
 * ЛОГИКА ПЕРЕНЕСЕНА БЕЗ ИЗМЕНЕНИЙ из старого журнала
 * (trader-journal/src/lib/journalImportApply.js + stores.js):
 *  1) merge по `id` — импортированная запись перезаписывает свои поля поверх
 *     существующей, id сохраняется (поэтому повторный импорт обновляет, а не дублирует);
 *  2) затем массив заменяется целиком, без дедупликации по «дата|пара|объём».
 *
 * @param {any[]} imported
 * @returns {number} сколько сделок было в импорте
 */
export function importTrades(imported) {
	if (!Array.isArray(imported) || !imported.length) return 0;
	// merge по id — как в старом журнале перед importTrades
	const existingById = new Map(trades.map((t) => [t.id, t]));
	for (const importedTrade of imported) {
		const prev = existingById.get(importedTrade.id);
		const merged = {
			...(prev && typeof prev === 'object' ? prev : {}),
			...importedTrade,
			id: importedTrade.id
		};
		existingById.set(importedTrade.id, merged);
	}
	trades = Array.from(existingById.values()).map((t) => normalizeTrade(t));
	scheduleSave();
	return imported.length;
}

/** Удалить все сделки. */
export async function deleteAllTrades() {
	trades = [];
	await clearJournal();
}

/** Перезагрузить с нуля. */
export async function reloadJournal() {
	ready = false;
	loading = true;
	await initJournal();
}
