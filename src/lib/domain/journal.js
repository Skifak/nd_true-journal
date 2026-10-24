/**
 * Фильтрация, сортировка и агрегаты для списка сделок.
 * Чистые функции: зависят только от переданных аргументов.
 */
import { dayKey, tradeProfit, tradeSource } from './trades.js';

/**
 * @typedef {Object} Filters
 * @property {string} symbolFilter
 * @property {string} directionFilter
 * @property {string} sltpFilter    '' | 'yes' | 'no'
 * @property {string} sourceFilter  '' | 'manual' | 'mt5-history' | 'mt5-trade'
 * @property {boolean} onlyWins
 * @property {boolean} onlyLosses
 * @property {string} search
 */

/** @returns {Filters} */
export function emptyFilters() {
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
function matchesSearch(trade, q) {
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

/**
 * Отфильтровать сделки.
 * @param {any[]} trades
 * @param {Filters} filters
 */
export function filterTrades(trades, filters) {
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
export function sortValue(trade, key) {
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
			return String(trade[key] ?? '');
	}
}

/**
 * Отсортировать копию массива.
 * @param {any[]} trades
 * @param {{key: string, dir: 'asc'|'desc'}} sort
 */
export function sortTrades(trades, sort) {
	const { key, dir } = sort || { key: 'dateClose', dir: 'desc' };
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

/**
 * Переключить направление сортировки по клику на колонку.
 * @param {{key: string, dir: 'asc'|'desc'}} sort
 * @param {string} key
 * @returns {{key: string, dir: 'asc'|'desc'}}
 */
export function toggleSort(sort, key) {
	if (sort.key !== key) return { key, dir: 'desc' };
	return { key, dir: sort.dir === 'desc' ? 'asc' : 'desc' };
}

/** Индикатор сортировки для заголовка колонки. */
export function sortIndicator(sort, key) {
	if (sort.key !== key) return '';
	return sort.dir === 'desc' ? ' ↓' : ' ↑';
}

/**
 * Итоги по списку.
 * @param {any[]} trades
 */
/**
 * Итоги по списку сделок.
 * @param {any[]} trades
 * @returns {{profit: number, commission: number, swap: number, wins: number, losses: number, breakeven: number, winRate: number, count: number}}
 */
export function computeTotals(trades) {
	const acc = { profit: 0, commission: 0, swap: 0, wins: 0, losses: 0, breakeven: 0 };
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

/**
 * Сгруппировать по дням (порядок сохраняется).
 * @param {any[]} trades
 */
export function groupByDay(trades) {
	/** @type {{dayKey: string, trades: any[], profit: number, wins: number, losses: number}[]} */
	const groups = [];
	let current = null;
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
export function symbolsFromTrades(trades) {
	return [...new Set(trades.map((t) => t.pair).filter(Boolean))].sort((a, b) =>
		a.localeCompare(b, 'ru')
	);
}

/**
 * Кривая капитала: накопительный P/L по закрытым сделкам.
 * @param {any[]} trades закрытые сделки в нужном порядке
 * @param {number} startBalance
 * @returns {{values: number[], dates: string[], labels: string[]}}
 */
export function equityCurve(trades, startBalance = 0) {
	const closed = trades.filter((t) => t.status === 'closed');
	let balance = Number(startBalance) || 0;
	const values = [balance];
	const dates = [];
	const labels = [];
	for (const t of closed) {
		balance += tradeProfit(t);
		values.push(Number(balance.toFixed(2)));
		const dk = dayKey(t.dateClose || t.dateOpen) || '';
		dates.push(dk);
		labels.push(dk.slice(5).split('-').reverse().join('.'));
	}
	return { values, dates, labels };
}
