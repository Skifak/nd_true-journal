/**
 * Фильтрация, сортировка и агрегаты для списка сделок.
 * Чистые функции: зависят только от переданных аргументов.
 */
import { dayKey, tradeProfit, tradeSource, type Trade } from './trades.ts';

export interface Filters {
	symbolFilter: string;
	directionFilter: string;
	/** '' | 'yes' | 'no' */
	sltpFilter: string;
	/** '' | 'manual' | 'mt5-history' | 'mt5-trade' */
	sourceFilter: string;
	onlyWins: boolean;
	onlyLosses: boolean;
	search: string;
}

export type SortDir = 'asc' | 'desc';

export interface SortState {
	key: string;
	dir: SortDir;
}

export interface Totals {
	profit: number;
	commission: number;
	swap: number;
	wins: number;
	losses: number;
	breakeven: number;
	winRate: number;
	count: number;
}

export interface DayGroup {
	dayKey: string | null;
	trades: Trade[];
	profit: number;
	wins: number;
	losses: number;
}

export function emptyFilters(): Filters {
	return {
		symbolFilter: '',
		directionFilter: '',
		sltpFilter: '',
		sourceFilter: '',
		onlyWins: false,
		onlyLosses: false,
		search: ''
	};
}

/** Текстовая проверка: пара, комментарий, направление, теги. */
function matchesSearch(trade: Trade, q: string): boolean {
	if (!q) return true;
	const blob = [
		trade.pair,
		trade.comment,
		trade.direction,
		trade.status,
		Array.isArray(trade.tags) ? trade.tags.join(' ') : ''
	]
		.map((x) => String(x || '').toLowerCase())
		.join('\n');
	return blob.includes(q);
}

export function filterTrades(trades: Trade[], filters: Filters): Trade[] {
	const q = String(filters.search || '')
		.trim()
		.toLowerCase();
	return trades.filter((t) => {
		if (filters.symbolFilter && t.pair !== filters.symbolFilter) return false;
		if (filters.directionFilter && t.direction !== filters.directionFilter) return false;
		if (filters.sltpFilter === 'yes' && (!t.sl || !t.tp)) return false;
		if (filters.sltpFilter === 'no' && t.sl && t.tp) return false;
		if (filters.sourceFilter && tradeSource(t) !== filters.sourceFilter) return false;
		if (filters.onlyWins || filters.onlyLosses) {
			const p = tradeProfit(t);
			if (filters.onlyWins && !(p > 0)) return false;
			if (filters.onlyLosses && !(p < 0)) return false;
		}
		return matchesSearch(t, q);
	});
}

/** Значение для сортировки по ключу. */
export function sortValue(trade: Trade, key: string): string | number {
	switch (key) {
		case 'dateOpen':
			return new Date(String(trade.dateOpen).replace(' ', 'T')).getTime() || 0;
		case 'dateClose':
			return trade.dateClose ? new Date(String(trade.dateClose).replace(' ', 'T')).getTime() : 0;
		case 'pair':
			return String(trade.pair || '');
		case 'volume':
			return Number(trade.volume) || 0;
		case 'profit':
			return tradeProfit(trade);
		case 'commission':
			return Number(trade.commission) || 0;
		case 'swap':
			return Number(trade.swap) || 0;
		case 'duration': {
			const s = new Date(String(trade.dateOpen).replace(' ', 'T')).getTime();
			const e = trade.dateClose
				? new Date(String(trade.dateClose).replace(' ', 'T')).getTime()
				: 0;
			return Number.isFinite(s) && Number.isFinite(e) ? e - s : 0;
		}
		default:
			return String((trade as unknown as Record<string, unknown>)[key] ?? '');
	}
}

export function sortTrades(trades: Trade[], sort: SortState): Trade[] {
	const { key, dir } = sort || { key: 'dateClose', dir: 'desc' as SortDir };
	const mult = dir === 'asc' ? 1 : -1;
	return [...trades].sort((a, b) => {
		const va = sortValue(a, key);
		const vb = sortValue(b, key);
		if (typeof va === 'string' || typeof vb === 'string') {
			return String(va).localeCompare(String(vb), 'ru') * mult;
		}
		if (va === vb) return 0;
		return (va < vb ? -1 : 1) * mult;
	});
}

export function toggleSort(sort: SortState, key: string): SortState {
	if (sort.key !== key) return { key, dir: 'desc' };
	return { key, dir: sort.dir === 'desc' ? 'asc' : 'desc' };
}

/** Индикатор сортировки для заголовка колонки. */
export function sortIndicator(sort: SortState, key: string): string {
	if (sort.key !== key) return '';
	return sort.dir === 'desc' ? ' ↓' : ' ↑';
}

export function computeTotals(trades: Trade[]): Totals {
	const acc: Totals = {
		profit: 0,
		commission: 0,
		swap: 0,
		wins: 0,
		losses: 0,
		breakeven: 0,
		winRate: 0,
		count: 0
	};
	for (const t of trades) {
		const p = tradeProfit(t);
		acc.profit += p;
		if (p > 0) acc.wins++;
		else if (p < 0) acc.losses++;
		else acc.breakeven++;
		acc.commission += Number(t.commission) || 0;
		acc.swap += Number(t.swap) || 0;
	}
	const decided = acc.wins + acc.losses;
	acc.winRate = decided > 0 ? (acc.wins / decided) * 100 : 0;
	acc.count = trades.length;
	return acc;
}

export function groupByDay(trades: Trade[]): DayGroup[] {
	const groups: DayGroup[] = [];
	let current: DayGroup | null = null;
	for (const t of trades) {
		const dk = dayKey(t.dateClose || t.dateOpen);
		if (!current || current.dayKey !== dk) {
			current = { dayKey: dk, trades: [], profit: 0, wins: 0, losses: 0 };
			groups.push(current);
		}
		current.trades.push(t);
		const p = tradeProfit(t);
		current.profit += p;
		if (p > 0) current.wins++;
		else if (p < 0) current.losses++;
	}
	return groups;
}

/** Уникальные символы из списка (для пикера). */
export function symbolsFromTrades(trades: Trade[]): string[] {
	return [...new Set(trades.map((t) => t.pair).filter(Boolean))].sort((a, b) =>
		a.localeCompare(b, 'ru')
	);
}

export interface EquityCurve {
	values: number[];
	dates: string[];
	labels: string[];
}

/** Кривая капитала: накопительный P/L по закрытым сделкам. */
export function equityCurve(trades: Trade[], startBalance = 0): EquityCurve {
	const closed = trades.filter((t) => t.status === 'closed');
	let balance = Number(startBalance) || 0;
	const values: number[] = [balance];
	const dates: string[] = [];
	const labels: string[] = [];
	for (const t of closed) {
		balance += tradeProfit(t);
		values.push(Number(balance.toFixed(2)));
		const dk = dayKey(t.dateClose || t.dateOpen) || '';
		dates.push(dk);
		labels.push(dk.slice(5).split('-').reverse().join('.'));
	}
	return { values, dates, labels };
}
