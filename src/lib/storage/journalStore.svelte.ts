/**
 * Журнал как реактивное состояние (Svelte 5 runes, .svelte.js).
 * Единственный источник правды о сделках в приложении.
 */
import { loadTrades, saveTrades, clearJournal } from './journal.ts';
import { createTrade, normalizeTrade, uuid, type Trade } from '../domain/trades.ts';

let trades = $state<Trade[]>([]);
let loading = $state(true);
let ready = $state(false);
let error = $state<string | null>(null);

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function getTrades(): Trade[] {
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
			await saveTrades($state.snapshot(trades) as Trade[]);
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			console.error('journal save failed', e);
		}
	}, 120);
}

/** Первичная загрузка. */
export async function initJournal(): Promise<void> {
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

/** Добавить сделку. */
export function addTrade(patch: Partial<Trade> = {}): Trade {
	const trade = createTrade(patch);
	trades = [trade, ...trades];
	scheduleSave();
	return trade;
}

/** Обновить сделку по id. */
export function updateTrade(id: string, patch: Partial<Trade>): void {
	trades = trades.map((t) => (t.id === id ? normalizeTrade({ ...t, ...patch, id }) : t));
	scheduleSave();
}

/** Удалить сделку. */
export function deleteTrade(id: string): void {
	trades = trades.filter((t) => t.id !== id);
	scheduleSave();
}

/** Дублировать сделку как открытую. */
export function duplicateTrade(id: string): Trade | null {
	const src = trades.find((t) => t.id === id);
	if (!src) return null;
	const copy: Trade = {
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

export function importTrades(imported: Trade[]): number {
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
export async function deleteAllTrades(): Promise<void> {
	trades = [];
	await clearJournal();
}

/** Перезагрузить с нуля. */
export async function reloadJournal(): Promise<void> {
	ready = false;
	loading = true;
	await initJournal();
}
