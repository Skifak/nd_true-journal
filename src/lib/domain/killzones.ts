/**
 * Killzone: дефолтные сессии и разбивка P/L по ним.
 * Чистые функции — без зависимостей. Референс — killzones.js старого журнала.
 * Окна заданы в UTC (как в старом журнале по умолчанию).
 */
import { parseStamp, tradeProfit, type Trade } from './trades.ts';

export interface Killzone {
	id: string;
	label: string;
	/** 'ЧЧ:ММ' в UTC */
	from: string;
	to: string;
	/** Окно переходит через полночь (например 23:00→02:00) */
	wrap: boolean;
}

export const DEFAULT_KILLZONES: Killzone[] = [
	{ id: 'asian', label: 'Азиатская KZ', from: '23:00', to: '02:00', wrap: true },
	{ id: 'london', label: 'Лондонская KZ', from: '06:00', to: '09:00', wrap: false },
	{ id: 'ny', label: 'Нью-Йорк KZ', from: '11:00', to: '14:00', wrap: false },
	{ id: 'ldnclose', label: 'Лондон-клоуз KZ', from: '14:00', to: '16:00', wrap: false }
];

/** ЧЧ:ММ → минуты. */
const toMin = (hhmm: string): number => {
	const [h, m] = hhmm.split(':').map(Number);
	return (h || 0) * 60 + (m || 0);
};

/** Попадает ли время (в UTC) в окно killzone. */
function inWindow(date: Date, kz: Killzone): boolean {
	const minutes = date.getUTCHours() * 60 + date.getUTCMinutes();
	const from = toMin(kz.from);
	const to = toMin(kz.to);
	if (kz.wrap) return minutes >= from || minutes < to;
	return minutes >= from && minutes < to;
}

/** Первая killzone сделки по времени открытия (null — вне всех окон). */
export function primaryKillzone(date: string | null): Killzone | null {
	const d = parseStamp(date);
	if (!d) return null;
	for (const kz of DEFAULT_KILLZONES) if (inWindow(d, kz)) return kz;
	return null;
}

export interface KzRow { id: string; label: string; pnl: number; count: number; wins: number }

/** P/L закрытых сделок по killzone (окно открытия). 'out' — вне всех окон. */
export function byKillzone(trades: Trade[]): KzRow[] {
	const rows = new Map<string, KzRow>();
	for (const kz of DEFAULT_KILLZONES) rows.set(kz.id, { id: kz.id, label: kz.label, pnl: 0, count: 0, wins: 0 });
	rows.set('out', { id: 'out', label: 'Вне KZ', pnl: 0, count: 0, wins: 0 });
	for (const t of trades) {
		if (t.status !== 'closed') continue;
		const kz = primaryKillzone(t.dateOpen);
		const row = rows.get(kz ? kz.id : 'out');
		if (!row) continue;
		const pnl = tradeProfit(t);
		row.pnl += pnl;
		row.count++;
		if (pnl > 0) row.wins++;
	}
	return [...rows.values()]
		.filter((r) => r.count > 0)
		.map((r) => ({ ...r, pnl: Number(r.pnl.toFixed(2)) }));
}
