/**
 * Парсер HTML-отчётов MetaTrader 5 (Отчёт торговой истории / Торговый отчёт).
 * Без зависимостей и без DOMParser: разбирает таблицы регулярным способом,
 * что даёт одинаковый результат в WebView и в тестах Node.
 *
 * Поддерживает:
 *  - секции «Позиции» / «Positions» / «Открытые позиции»
 *  - секции «Сделки» / «Deals» / «Orders» (для комментариев)
 *  - локализованные числа: 1 234.56 / 1.234,56 / (1 234.56)
 */
import { normalizeSymbol, nowStamp, uuid } from './trades.js';

/** Очистить текст ячейки. */
function clean(value) {
	return String(value ?? '')
		.replace(/&nbsp;/gi, ' ')
		.replace(/&amp;/gi, '&')
		.replace(/&lt;/gi, '<')
		.replace(/&gt;/gi, '>')
		.replace(/&quot;/gi, '"')
		.replace(/<[^>]*>/g, '')
		.replace(/\u00a0/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

/** Разобрать локализованное число. */
export function parseNumber(value) {
	let s = clean(value);
	if (!s) return 0;

	let negative = false;
	const compact = s.replace(/\s/g, '');
	if (/^\(.*\)$/.test(compact)) {
		negative = true;
		s = s.replace(/^\s*\(\s*|\s*\)\s*$/g, '');
	}
	s = s.replace(/\u2212/g, '-').trim();
	if (s.startsWith('-')) {
		negative = true;
		s = s.slice(1);
	}
	// Убрать валютные символы и слова-валюты
	s = s
		.replace(/\s/g, '')
		.replace(/USD|EUR|GBP|JPY|CHF|CAD|AUD|NZD|USDT|BTC|\$|€|£|¥/gi, '')
		.replace(/[^\d.,]/g, '');
	if (!s) return 0;

	const lastComma = s.lastIndexOf(',');
	const lastDot = s.lastIndexOf('.');
	let normalized;
	if (lastComma === -1 && lastDot === -1) normalized = s;
	else if (lastComma > lastDot) normalized = s.replace(/\./g, '').replace(',', '.');
	else if (lastComma === -1 && /^\d{1,3}(\.\d{3})+$/.test(s)) normalized = s.replace(/\./g, '');
	else normalized = s.replace(/,/g, '');

	const n = Number(normalized);
	if (!Number.isFinite(n)) return 0;
	return negative ? -Math.abs(n) : n;
}

/** '2026.01.05 10:30:00' → '2026-01-05 10:30:00'. */
export function parseMt5Date(value) {
	const s = clean(value);
	if (!s) return null;
	const m = s.match(/^(\d{2,4})[.\-/](\d{1,2})[.\-/](\d{2,4})[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
	if (!m) return null;
	const [, a, b, c, hh, mm, ss] = m;
	const year = a.length === 4 ? a : c.length === 4 ? c : `20${a}`;
	const month = String(a.length === 4 ? b : a).padStart(2, '0');
	const day = String(a.length === 4 ? c : b).padStart(2, '0');
	return `${year}-${month}-${day} ${String(hh).padStart(2, '0')}:${mm}:${ss || '00'}`;
}

/** Направление: Buy → long, Sell → short. */
function parseDirection(value) {
	const s = clean(value).toLowerCase();
	if (s.includes('sell') || s.includes('прода')) return 'short';
	return 'long';
}

/**
 * Вытащить все строки <tr> из фрагмента HTML.
 * @returns {string[][]} массив массивов текстов ячеек
 */
function rowsFromHtml(html) {
	const rows = [];
	const trRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
	let m;
	while ((m = trRe.exec(html))) {
		const cells = [];
		const tdRe = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
		let c;
		while ((c = tdRe.exec(m[1]))) cells.push(clean(c[1]));
		if (cells.length) rows.push(cells);
	}
	return rows;
}

/** Найти фрагмент HTML между заголовком секции и следующим заголовком. */
function findSection(html, aliases) {
	const headerRe = /<(b|strong|h\d)\b[^>]*>([\s\S]*?)<\/\1>/gi;
	/** @type {{start: number, end: number, title: string}[]} */
	const headers = [];
	let m;
	while ((m = headerRe.exec(html))) {
		headers.push({
			start: m.index,
			end: m.index + m[0].length,
			title: clean(m[2]).toLowerCase().replace(/\u0451/g, 'е')
		});
	}
	for (let i = 0; i < headers.length; i++) {
		const title = headers[i].title;
		if (!aliases.some((a) => title.includes(a))) continue;
		const nextStart = headers[i + 1]?.start ?? html.length;
		return html.slice(headers[i].end, nextStart);
	}
	return '';
}

/**
 * @typedef {Object} Mt5ImportResult
 * @property {'history'|'trade'|null} reportType
 * @property {any[]} trades
 * @property {string|null} parseHint
 * @property {boolean} looksLikeMt5
 * @property {string|null} currency
 */

/**
 * Разобрать HTML отчёта MT5.
 * @param {string} html
 * @returns {Mt5ImportResult}
 */
export function parseMt5Report(html) {
	const raw = String(html || '');
	const titleMatch = raw.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
	const title = clean(titleMatch?.[1] || '')
		.toLowerCase()
		.replace(/\u0451/g, 'е');

	const looksLikeMt5 =
		/metaquotes|метаквот|метакот|metatrader|\bmt5\b/i.test(raw) || /торгов\w*\s+отч[её]т|trade (history|report)/i.test(title);

	const isHistory = /истори|history/i.test(title);
	const isTrade = !isHistory && /торгов\w*\s+отч[её]т|trade report|trading report/i.test(title);

	const currencyMatch = raw.match(/([A-Z]{3})\s*[,;]?\s*[Дд]епозит|Deposit\s*:?\s*([A-Z]{3})/);
	const currency = currencyMatch ? (currencyMatch[1] || currencyMatch[2]) : null;

	const positionAliases = ['позиции', 'positions', 'открытые позиции', 'open positions'];
	const dealAliases = ['сделки', 'deals', 'orders'];

	const positionHtml = findSection(raw, positionAliases);
	const dealHtml = findSection(raw, dealAliases);

	const positionRows = rowsFromHtml(positionHtml);
	const dealRows = rowsFromHtml(dealHtml);

	// Комментарии из сделок: ключ «дата закрытия | пара»
	/** @type {Map<string, string>} */
	const comments = new Map();
	for (const v of dealRows) {
		if (v.length < 14) continue;
		const dir = clean(v[4] ?? v[3]).toLowerCase();
		if (!dir.includes('out')) continue;
		const date = parseMt5Date(v[0]);
		const pair = normalizeSymbol(v[2]);
		const comment = v[v.length - 1];
		if (date && pair && comment) comments.set(`${date}|${pair}`, comment);
	}

	/** @type {any[]} */
	const trades = [];
	for (const v of positionRows) {
		// Ожидаемые колонки истории: Время, Позиция, Символ, Тип, Объём, Цена, S/L, T/P, Время, Цена, Комиссия, Своп, Прибыль
		if (v.length < 10) continue;
		const dateOpen = parseMt5Date(v[0]);
		const pair = normalizeSymbol(v[2]);
		if (!dateOpen || !pair) continue;

		const direction = parseDirection(v[3]);
		const volume = parseNumber(v[4]);
		const priceOpen = parseNumber(v[5]);
		const sl = parseNumber(v[6]);
		const tp = parseNumber(v[7]);
		const dateClose = parseMt5Date(v[8]);
		const priceClose = parseNumber(v[9]);
		const commission = v.length >= 11 ? parseNumber(v[10]) : 0;
		const swap = v.length >= 12 ? parseNumber(v[11]) : 0;
		const profit = v.length >= 13 ? parseNumber(v[12]) : 0;

		const isOpenTrade = !dateClose;
		const comment = comments.get(`${dateClose}|${pair}`) || '';

		trades.push({
			id: uuid(),
			dateOpen,
			dateOpenManual: true,
			pair,
			direction,
			volume: volume || 0.01,
			priceOpen,
			sl: sl || null,
			tp: tp || null,
			status: isOpenTrade ? 'open' : 'closed',
			dateClose: dateClose || null,
			priceClose: isOpenTrade ? null : priceClose,
			commission,
			swap,
			profit: isOpenTrade ? null : profit,
			contractSize: null,
			tags: [isOpenTrade ? 'mt5-trade-report' : 'mt5-history-report'],
			comment,
			attachments: []
		});
	}

	const reportType = trades.length
		? trades[0].tags.includes('mt5-history-report')
			? 'history'
			: 'trade'
		: isHistory
			? 'history'
			: isTrade
				? 'trade'
				: null;

	let parseHint = null;
	if (!trades.length) {
		parseHint = looksLikeMt5
			? 'Строки не извлечены. Нужен блок «Позиции» в отчёте торговой истории или «Позиции» в торговом отчёте.'
			: 'Не похоже на HTML-отчёт MT5. Сохраните отчёт из терминала (журнал → Отчёт).';
	}

	return { reportType, trades, parseHint, looksLikeMt5, currency };
}

/**
 * Сгенерировать демо-сделки для оценки интерфейса.
 * @param {number} count
 * @returns {any[]}
 */
export function demoMt5Report(count = 24) {
	const pairs = ['EURUSD', 'GBPUSD', 'XAUUSD', 'USDJPY', 'US100', 'GBPJPY'];
	const comments = [
		'FVG + OTE вход в лондонскую сессию',
		'Silver Bullet 10–11 NY',
		'Sweep PDH, разворот на MSS',
		'Продолжение тренда после ретеста',
		'Стоп по структуре, вышел в минус',
		'Частичный фикс на 2R'
	];
	const out = [];
	const now = new Date();
	for (let i = 0; i < count; i++) {
		const pair = pairs[i % pairs.length];
		const dir = i % 3 === 0 ? 'short' : 'long';
		const base =
			pair.startsWith('XAU') ? 2340 : pair.startsWith('US100') ? 18450 : pair === 'USDJPY' ? 157.2 : 1.0840;
		const pip = pair.startsWith('XAU') ? 0.1 : pair === 'USDJPY' ? 0.01 : 0.0001;
		const win = Math.random() > 0.38;
		const move = (win ? 1 : -1) * (20 + Math.floor(Math.random() * 60)) * pip;
		const openDate = new Date(now);
		openDate.setDate(openDate.getDate() - Math.floor(i / 3));
		openDate.setHours(9 + (i % 8), (i * 7) % 60, 0, 0);
		const closeDate = new Date(openDate.getTime() + (25 + (i % 90)) * 60000);
		const volume = [0.01, 0.02, 0.05, 0.1][i % 4];
		const priceOpen = Number((base + (Math.random() - 0.5) * base * 0.004).toFixed(5));
		const priceClose = Number(
			(priceOpen + (dir === 'long' ? move : -move)).toFixed(5)
		);
		out.push({
			id: uuid(),
			dateOpen: stampOf(openDate),
			dateOpenManual: true,
			pair,
			direction: dir,
			volume,
			priceOpen,
			sl: Number((priceOpen + (dir === 'long' ? -pip * 30 : pip * 30)).toFixed(5)),
			tp: Number((priceOpen + (dir === 'long' ? pip * 90 : -pip * 90)).toFixed(5)),
			status: 'closed',
			dateClose: stampOf(closeDate),
			priceClose,
			commission: Number((volume * 7).toFixed(2)) * -1,
			swap: 0,
			profit: null,
			contractSize: null,
			tags: ['mt5-history-report'],
			comment: comments[i % comments.length],
			attachments: []
		});
	}
	return out;
}

function stampOf(date) {
	return nowStamp(date);
}
