/**
 * Статистика сделок: агрегаты закрытых сделок и разрезы.
 * Чистые функции — без зависимостей, без обращения к DOM и хранилищам.
 * Референс — вкладка статистики старого журнала (calculateStats из trader-journal).
 */
import { dayKey, parseStamp, tradeProfit, type Trade } from './trades.ts';

export interface Stats {
	count: number;
	netProfit: number;
	grossProfit: number;
	grossLoss: number;
	winRate: number;
	wins: number;
	losses: number;
	profitFactor: number;
	expectancy: number;
	avgWin: number;
	avgLoss: number;
	maxWin: number;
	maxLoss: number;
	sumCommission: number;
	sumSwap: number;
	longCount: number;
	longWinRate: number;
	shortCount: number;
	shortWinRate: number;
	maxStreakWins: number;
	maxStreakLosses: number;
	maxDrawdown: number;
	maxDrawdownPercent: number;
	recoveryFactor: number;
	sharpe: number;
}

export const emptyStats = (): Stats => ({
	count: 0, netProfit: 0, grossProfit: 0, grossLoss: 0, winRate: 0, wins: 0, losses: 0,
	profitFactor: 0, expectancy: 0, avgWin: 0, avgLoss: 0, maxWin: 0, maxLoss: 0,
	sumCommission: 0, sumSwap: 0, longCount: 0, longWinRate: 0, shortCount: 0, shortWinRate: 0,
	maxStreakWins: 0, maxStreakLosses: 0, maxDrawdown: 0, maxDrawdownPercent: 0,
	recoveryFactor: 0, sharpe: 0
});

const round2 = (v: number) => Number.isFinite(v) ? Number(v.toFixed(2)) : 0;

/** Полная сводка по закрытым сделкам (в хронологическом порядке по закрытию). */
export function computeStats(trades: Trade[]): Stats {
	const closed = trades
		.filter((t) => t.status === 'closed')
		.map((t) => ({ t, at: parseStamp(t.dateClose || t.dateOpen)?.getTime() ?? 0, pnl: tradeProfit(t) }))
		.sort((a, b) => a.at - b.at);
	if (!closed.length) return emptyStats();

	const profits = closed.map((c) => c.pnl);
	const winsArr = profits.filter((p) => p > 0);
	const lossesArr = profits.filter((p) => p < 0);
	const grossProfit = winsArr.reduce((s, p) => s + p, 0);
	const grossLoss = Math.abs(lossesArr.reduce((s, p) => s + p, 0));
	const net = profits.reduce((s, p) => s + p, 0);

	const longs = closed.filter((c) => c.t.direction === 'long');
	const shorts = closed.filter((c) => c.t.direction === 'short');

	// Серии подряд по знаку P/L (0 — нейтральные, серию не рвут и не наращивают)
	let curW = 0, curL = 0, maxW = 0, maxL = 0;
	for (const p of profits) {
		if (p > 0) { curW++; curL = 0; maxW = Math.max(maxW, curW); }
		else if (p < 0) { curL++; curW = 0; maxL = Math.max(maxL, curL); }
	}

	// Просадка по эквити с нулевого старта
	let equity = 0, peak = 0, maxDd = 0, maxDdPct = 0;
	for (const p of profits) {
		equity += p;
		if (equity > peak) peak = equity;
		const dd = peak - equity;
		if (dd > maxDd) {
			maxDd = dd;
			maxDdPct = peak > 0 ? (dd / peak) * 100 : 0;
		}
	}

	// Упрощённый Шарп: средний P/L / СКО P/L
	const mean = net / profits.length;
	const variance = profits.reduce((s, p) => s + (p - mean) ** 2, 0) / profits.length;
	const std = Math.sqrt(variance);

	return {
		count: closed.length,
		netProfit: round2(net),
		grossProfit: round2(grossProfit),
		grossLoss: round2(grossLoss),
		winRate: winsArr.length / closed.length * 100,
		wins: winsArr.length,
		losses: lossesArr.length,
		profitFactor: grossLoss ? grossProfit / grossLoss : grossProfit ? Infinity : 0,
		expectancy: round2(net / closed.length),
		avgWin: winsArr.length ? round2(grossProfit / winsArr.length) : 0,
		avgLoss: lossesArr.length ? round2(grossLoss / lossesArr.length) : 0,
		maxWin: round2(Math.max(...profits, 0)),
		maxLoss: round2(Math.min(...profits, 0)),
		sumCommission: round2(closed.reduce((s, c) => s + (Number(c.t.commission) || 0), 0)),
		sumSwap: round2(closed.reduce((s, c) => s + (Number(c.t.swap) || 0), 0)),
		longCount: longs.length,
		longWinRate: longs.length ? longs.filter((c) => c.pnl > 0).length / longs.length * 100 : 0,
		shortCount: shorts.length,
		shortWinRate: shorts.length ? shorts.filter((c) => c.pnl > 0).length / shorts.length * 100 : 0,
		maxStreakWins: maxW,
		maxStreakLosses: maxL,
		maxDrawdown: round2(maxDd),
		maxDrawdownPercent: round2(maxDdPct),
		recoveryFactor: maxDd > 0 ? round2(net / maxDd) : 0,
		sharpe: std > 0 ? round2(mean / std) : 0
	};
}

export interface Bucket { label: string; pnl: number; count: number; wins: number }

const bucketList = (map: Map<string, { pnl: number; count: number; wins: number }>): Bucket[] =>
	[...map.entries()]
		.map(([label, v]) => ({ label, ...v, pnl: round2(v.pnl) }))
		.sort((a, b) => b.pnl - a.pnl);

const DAY_NAMES = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

/** P/L по дням недели открытия сделки (Пн..Вс). */
export function byWeekday(trades: Trade[]): Bucket[] {
	const map = new Map<string, { pnl: number; count: number; wins: number }>();
	for (const t of trades) {
		if (t.status !== 'closed') continue;
		const d = parseStamp(t.dateClose || t.dateOpen);
		if (!d) continue;
		const label = DAY_NAMES[d.getDay()];
		const b = map.get(label) ?? { pnl: 0, count: 0, wins: 0 };
		const pnl = tradeProfit(t);
		b.pnl += pnl; b.count++; if (pnl > 0) b.wins++;
		map.set(label, b);
	}
	// Порядок Пн..Вс, а не по P/L
	const ordered: Bucket[] = [];
	for (let i = 1; i <= 7; i++) {
		const b = map.get(DAY_NAMES[i % 7]);
		if (b) ordered.push({ label: DAY_NAMES[i % 7], ...b, pnl: round2(b.pnl) });
	}
	return ordered;
}

/** P/L по часам открытия сделки (00..23). */
export function byHour(trades: Trade[]): Bucket[] {
	const map = new Map<string, { pnl: number; count: number; wins: number }>();
	for (const t of trades) {
		if (t.status !== 'closed') continue;
		const d = parseStamp(t.dateClose || t.dateOpen);
		if (!d) continue;
		const label = String(d.getHours()).padStart(2, '0');
		const b = map.get(label) ?? { pnl: 0, count: 0, wins: 0 };
		const pnl = tradeProfit(t);
		b.pnl += pnl; b.count++; if (pnl > 0) b.wins++;
		map.set(label, b);
	}
	return bucketList(map);
}

/** P/L по инструментам. */
export function byPair(trades: Trade[]): Bucket[] {
	const map = new Map<string, { pnl: number; count: number; wins: number }>();
	for (const t of trades) {
		if (t.status !== 'closed') continue;
		const b = map.get(t.pair) ?? { pnl: 0, count: 0, wins: 0 };
		const pnl = tradeProfit(t);
		b.pnl += pnl; b.count++; if (pnl > 0) b.wins++;
		map.set(t.pair, b);
	}
	return bucketList(map);
}

export interface DayRow { day: string; pnl: number; count: number }

/** Дневная разбивка P/L: отсортированные дни по дате закрытия. */
export function byDay(trades: Trade[], limit = 14): DayRow[] {
	const map = new Map<string, { pnl: number; count: number }>();
	for (const t of trades) {
		if (t.status !== 'closed') continue;
		const dk = dayKey(t.dateClose || t.dateOpen);
		if (!dk) continue;
		const b = map.get(dk) ?? { pnl: 0, count: 0 };
		b.pnl += tradeProfit(t); b.count++;
		map.set(dk, b);
	}
	return [...map.entries()]
		.map(([day, v]) => ({ day, ...v, pnl: Number(v.pnl.toFixed(2)) }))
		.sort((a, b) => (a.day < b.day ? 1 : -1))
		.slice(0, limit);
}
