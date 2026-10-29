/**
 * Торговая сделка: модель, расчёт P/L, форматирование, справочники инструментов.
 * Чистые функции — без зависимостей, без обращения к DOM и хранилищам.
 *
 * Формула P/L: (close - open) × direction × contractSize × volume - commission - swap
 */

// ─────────────────────────────────────────────────────────────────────────────
// Инструменты и контракт-сайзы
// ─────────────────────────────────────────────────────────────────────────────

export const PAIR_CATEGORIES = {
	'FX Majors': ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD'],
	'FX Crosses': [
		'EURGBP', 'EURJPY', 'EURCHF', 'EURAUD', 'EURCAD', 'EURNZD',
		'GBPJPY', 'GBPCHF', 'GBPAUD', 'GBPCAD', 'GBPNZD',
		'AUDJPY', 'AUDNZD', 'AUDCAD', 'AUDCHF',
		'CADJPY', 'CADCHF', 'CHFJPY', 'NZDJPY', 'NZDCHF', 'NZDCAD'
	],
	'FX Exotics': [
		'USDTRY', 'USDZAR', 'USDMXN', 'USDSGD', 'USDHKD', 'USDCNH',
		'USDNOK', 'USDSEK', 'USDPLN', 'USDDKK',
		'EURTRY', 'EURPLN', 'EURSEK', 'EURNOK'
	],
	Металлы: ['XAUUSD', 'XAGUSD', 'XPTUSD', 'XPDUSD', 'XAUEUR', 'XAGEUR'],
	Сырьё: ['USOIL', 'UKOIL', 'BRENT', 'WTI', 'NATGAS', 'COPPER', 'COCOA', 'WHEAT', 'CORN'],
	Индексы: ['US500', 'US100', 'US30', 'US2000', 'GER40', 'UK100', 'JPN225', 'HK50', 'FRA40', 'EU50'],
	Crypto: ['BTCUSD', 'ETHUSD', 'SOLUSD', 'XRPUSD', 'BNBUSD', 'ADAUSD', 'DOGEUSD', 'LTCUSD', 'LINKUSD', 'AVAXUSD'],
	Акции: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'NFLX', 'AMD', 'INTC'],
	ETF: ['SPY', 'QQQ', 'DIA', 'IWM', 'GLD', 'SLV', 'TLT']
};

/** Плоский список символов. */
export const PAIRS = Object.values(PAIR_CATEGORIES).flat();

/** Контракт-сайз по умолчанию (единиц базового актива на 1.0 лот). */
export const DEFAULT_CONTRACT_SIZE: Record<string, number> = {
	// FX — стандартные 100k
	EURUSD: 100000, GBPUSD: 100000, USDJPY: 100000, USDCHF: 100000,
	AUDUSD: 100000, USDCAD: 100000, NZDUSD: 100000,
	EURGBP: 100000, EURJPY: 100000, EURCHF: 100000, EURAUD: 100000,
	EURCAD: 100000, EURNZD: 100000, GBPJPY: 100000, GBPCHF: 100000,
	GBPAUD: 100000, GBPCAD: 100000, GBPNZD: 100000, AUDJPY: 100000,
	AUDNZD: 100000, AUDCAD: 100000, AUDCHF: 100000, CADJPY: 100000,
	CADCHF: 100000, CHFJPY: 100000, NZDJPY: 100000, NZDCHF: 100000,
	NZDCAD: 100000,
	// Металлы
	XAUUSD: 100, XAGUSD: 5000, XPTUSD: 100, XPDUSD: 100, XAUEUR: 100, XAGEUR: 5000,
	// Сырьё
	USOIL: 1000, UKOIL: 1000, BRENT: 1000, WTI: 1000, NATGAS: 10000, COPPER: 25000,
	COCOA: 10, WHEAT: 5000, CORN: 5000,
	// Индексы
	US500: 10, US100: 10, US30: 10, US2000: 10, GER40: 10, UK100: 10,
	JPN225: 10, HK50: 10, FRA40: 10, EU50: 10,
	// Crypto (CFD)
	BTCUSD: 1, ETHUSD: 1, SOLUSD: 1, XRPUSD: 1, BNBUSD: 1, ADAUSD: 1,
	DOGEUSD: 1, LTCUSD: 1, LINKUSD: 1, AVAXUSD: 1,
	// Акции / ETF
	AAPL: 100, MSFT: 100, GOOGL: 100, AMZN: 100, NVDA: 100, META: 100,
	TSLA: 100, NFLX: 100, AMD: 100, INTC: 100,
	SPY: 100, QQQ: 100, DIA: 100, IWM: 100, GLD: 100, SLV: 1000, TLT: 100
};

/** Нормализовать символ: верхний регистр, без суффиксов брокера (.a, _m, -cash). */
export function normalizeSymbol(symbol: unknown): string {
	return String(symbol || '')
		.trim()
		.toUpperCase()
		.replace(/[._-](?=[A-Z0-9]{1,3}$)/, '')
		.replace(/[^A-Z0-9]/g, '');
}

/** Контракт-сайз: переопределение сделки → справочник → 100000. */
export function getContractSize(symbol: unknown, override: number | string | null = null): number {
	const o = Number(override);
	if (Number.isFinite(o) && o > 0) return o;
	const key = normalizeSymbol(symbol);
	return DEFAULT_CONTRACT_SIZE[key] ?? 100000;
}

/** Размер пипса по символу. */
export function getPipSize(symbol: unknown): number {
	const key = normalizeSymbol(symbol);
	if (!key) return 1;
	if (key.startsWith('XAU')) return 0.1;
	if (key.startsWith('XAG')) return 0.01;
	if (/^(BTC|ETH|LTC|XRP|SOL|DOGE|ADA|DOT|LINK|AVAX|BNB)/.test(key)) return 1;
	if (/^[A-Z]{6}$/.test(key)) return key.slice(3, 6) === 'JPY' ? 0.01 : 0.0001;
	return 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// Модель сделки
// ─────────────────────────────────────────────────────────────────────────────

export type Direction = 'long' | 'short';
export type TradeStatus = 'open' | 'closed';

export interface Trade {
	/** UUID v4 либо стабильный id импорта MT5: mt5_pos_/mt5_open_. */
	id: string;
	/** 'YYYY-MM-DD HH:mm:ss' */
	dateOpen: string;
	dateOpenManual: boolean;
	pair: string;
	direction: Direction;
	volume: number;
	priceOpen: number;
	sl: number | null;
	tp: number | null;
	status: TradeStatus;
	dateClose: string | null;
	priceClose: number | null;
	commission: number;
	swap: number;
	profit: number | null;
	contractSize: number | null;
	tags: string[];
	comment: string;
	attachments: string[];
	/** Цена рынка у открытых позиций из «Торгового отчёта» MT5. */
	marketPrice?: number | null;
}

/** Локальная метка времени 'YYYY-MM-DD HH:mm:ss' (без UTC-сдвига). */
export function nowStamp(date: Date = new Date()): string {
	const p = (n: number) => String(n).padStart(2, '0');
	return (
		`${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())} ` +
		`${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`
	);
}

/** UUID v4 без внешних зависимостей (crypto.getRandomValues, фолбэк на Math.random). */
export function uuid(): string {
	const c = globalThis.crypto;
	if (c?.randomUUID) return c.randomUUID();
	const bytes = new Uint8Array(16);
	if (c?.getRandomValues) c.getRandomValues(bytes);
	else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
	bytes[6] = (bytes[6] & 0x0f) | 0x40;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;
	const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function createTrade(patch: Partial<Trade> = {}): Trade {
	return {
		id: uuid(),
		dateOpen: nowStamp(),
		dateOpenManual: false,
		pair: 'EURUSD',
		direction: 'long',
		volume: 0.01,
		priceOpen: 0,
		sl: null,
		tp: null,
		status: 'open',
		dateClose: null,
		priceClose: null,
		commission: 0,
		swap: 0,
		profit: null,
		contractSize: null,
		tags: [],
		comment: '',
		attachments: [],
		...patch
	};
}

/** Привести загруженную сделку к полному виду (терпимо к старым записям). */
export function normalizeTrade(raw: unknown): Trade {
	const t = (raw && typeof raw === 'object' ? raw : {}) as Partial<Trade> & Record<string, unknown>;
	const knownKeys = new Set([
		'id',
		'dateOpen',
		'dateOpenManual',
		'pair',
		'direction',
		'volume',
		'priceOpen',
		'sl',
		'tp',
		'status',
		'dateClose',
		'priceClose',
		'commission',
		'swap',
		'profit',
		'contractSize',
		'tags',
		'comment',
		'attachments'
	]);
	const extras: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(t)) {
		if (!knownKeys.has(key) && key !== '__proto__') extras[key] = value;
	}
	const resolvedId = t.id ?? uuid();
	return {
		...extras,
		id: String(resolvedId),
		dateOpen: t.dateOpen || nowStamp(),
		dateOpenManual: Boolean(t.dateOpenManual),
		pair: normalizeSymbol(t.pair || 'EURUSD') || 'EURUSD',
		direction: t.direction === 'short' ? 'short' : 'long',
		volume: Number(t.volume) || 0.01,
		priceOpen: Number(t.priceOpen) || 0,
		sl: t.sl == null || (t.sl as unknown) === '' ? null : Number(t.sl),
		tp: t.tp == null || (t.tp as unknown) === '' ? null : Number(t.tp),
		status: t.status === 'closed' ? 'closed' : 'open',
		dateClose: t.dateClose || null,
		priceClose: t.priceClose == null || (t.priceClose as unknown) === '' ? null : Number(t.priceClose),
		commission: Number(t.commission) || 0,
		swap: Number(t.swap) || 0,
		profit: t.profit == null || (t.profit as unknown) === '' ? null : Number(t.profit),
		contractSize: t.contractSize == null || (t.contractSize as unknown) === '' ? null : Number(t.contractSize),
		tags: Array.isArray(t.tags) ? t.tags.map(String) : [],
		comment: String(t.comment || ''),
		attachments: Array.isArray(t.attachments) ? t.attachments.map(String) : []
	};
}

// ─────────────────────────────────────────────────────────────────────────────
// Расчёты
// ─────────────────────────────────────────────────────────────────────────────

/** P/L сделки: (close-open) × dir × contract × volume − commission − swap. */
export function calculateProfit(trade: Partial<Trade> | null | undefined): number {
	const t = (trade || {}) as Partial<Trade>;
	const open = Number(t.priceOpen) || 0;
	const close = Number(t.priceClose) || 0;
	const volume = Number(t.volume) || 0;
	const dir = t.direction === 'short' ? -1 : 1;
	const contract = getContractSize(t.pair, t.contractSize);
	const gross = (close - open) * dir * contract * volume;
	const commission = Number(t.commission) || 0;
	const swap = Number(t.swap) || 0;
	const value = gross - commission - swap;
	return Number.isFinite(value) ? Number(value.toFixed(2)) : 0;
}

/** Итоговый P/L для отображения: сохранённый profit (MT5) или расчётный. */
export function tradeProfit(trade: Trade | null | undefined): number {
	if (isBrokerImported(trade) && Number.isFinite(Number(trade?.profit))) {
		return Number(trade!.profit);
	}
	if (trade?.profit != null && Number.isFinite(Number(trade.profit))) {
		return Number(trade.profit);
	}
	if (trade?.status === 'closed' && trade?.priceClose != null) return calculateProfit(trade);
	return 0;
}

/** Движение цены в пипсах (положительно = в плюс). */
export function calculatePips(trade: Trade | null | undefined): number | null {
	if (!trade || trade.priceClose == null) return null;
	const open = Number(trade.priceOpen) || 0;
	const close = Number(trade.priceClose) || 0;
	const dir = trade.direction === 'short' ? -1 : 1;
	const pip = getPipSize(trade.pair);
	if (!pip) return null;
	// Округление гасит плавающую погрешность (1.10500-1.10000 → 49.99999…)
	const value = Number((((close - open) * dir) / pip).toFixed(6));
	return Number.isFinite(value) ? value : null;
}

/** Движение цены в процентах. */
export function calculatePricePercent(trade: Trade | null | undefined): number | null {
	if (!trade || trade.priceClose == null) return null;
	const open = Number(trade.priceOpen) || 0;
	if (open === 0) return null;
	const close = Number(trade.priceClose) || 0;
	const dir = trade.direction === 'short' ? -1 : 1;
	const value = (((close - open) * dir) / open) * 100;
	return Number.isFinite(value) ? value : null;
}

/** Происхождение сделки: 'mt5-history' | 'mt5-trade' | 'manual'. */
export type TradeSource = 'mt5-history' | 'mt5-trade' | 'manual';

export function tradeSource(trade: Partial<Trade> | null | undefined): TradeSource {
	const tags = Array.isArray(trade?.tags) ? trade.tags : [];
	if (tags.includes('mt5-history-report')) return 'mt5-history';
	if (tags.includes('mt5-trade-report')) return 'mt5-trade';
	return 'manual';
}

export function isBrokerImported(trade: Partial<Trade> | null | undefined): boolean {
	return tradeSource(trade) !== 'manual';
}

// ─────────────────────────────────────────────────────────────────────────────
// Форматирование
// ─────────────────────────────────────────────────────────────────────────────

/** Число с фиксированными знаками. */
export function formatNumber(value: unknown, decimals = 2): string {
	if (value == null || !Number.isFinite(Number(value))) return '—';
	return Number(value).toFixed(decimals);
}

/** Адаптивная точность цены по величине актива. */
export function formatPrice(value: unknown): string {
	if (value == null || !Number.isFinite(Number(value))) return '—';
	const v = Math.abs(Number(value));
	const d = v >= 1000 ? 2 : v >= 100 ? 3 : v >= 10 ? 4 : v >= 1 ? 5 : v >= 0.01 ? 6 : 8;
	return Number(value).toFixed(d);
}

/** Деньги со знаком и валютой счёта. */
export function formatMoney(value: unknown, currency = 'USD', signed = false): string {
	if (value == null || !Number.isFinite(Number(value))) return '—';
	const v = Number(value);
	const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '';
	const body = Math.abs(v).toFixed(currency === 'JPY' ? 0 : 2);
	const sign = v < 0 ? '−' : signed && v > 0 ? '+' : '';
	return `${sign}${body} ${symbol || currency}`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Даты (без библиотек)
// ─────────────────────────────────────────────────────────────────────────────

/** Разобрать 'YYYY-MM-DD HH:mm:ss' как локальное время. */
export function parseStamp(value: unknown): Date | null {
	if (!value) return null;
	const s = String(value).trim().replace(' ', 'T');
	// Дата-только 'YYYY-MM-DD' JS парсит как UTC-полночь — приводим к локальной, чтобы день не уезжал на сутки назад в западных таймзонах.
	if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
		const [y, m, day] = s.split('-').map(Number);
		return new Date(y, m - 1, day);
	}
	const d = new Date(s);
	if (!Number.isFinite(d.getTime())) {
		// MT5: '2026.01.05 10:00:00'
		const alt = new Date(String(value).replace(/\./g, '-').replace(' ', 'T'));
		return Number.isFinite(alt.getTime()) ? alt : null;
	}
	return d;
}

/** Форматирование даты: 'DD.MM.YY HH:mm' по умолчанию. */
export type DateStyle = 'short' | 'date' | 'full';

export function formatDate(value: unknown, style: DateStyle = 'short'): string {
	const d = parseStamp(value);
	if (!d) return '—';
	const p = (n: number) => String(n).padStart(2, '0');
	const date = `${p(d.getDate())}.${p(d.getMonth() + 1)}.${String(d.getFullYear()).slice(2)}`;
	if (style === 'date') return date;
	if (style === 'full') return `${date} ${p(d.getHours())}:${p(d.getMinutes())}`;
	return `${date} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Ключ дня 'YYYY-MM-DD'. */
export function dayKey(value: unknown): string | null {
	const d = parseStamp(value);
	if (!d) return null;
	const p = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Длительность между двумя метками: '2ч 15м', '45м', '3д 4ч'. */
export function formatDuration(start: unknown, end?: unknown): string {
	const s = parseStamp(start);
	const e = end ? parseStamp(end) : new Date();
	if (!s || !e) return '—';
	const sec = Math.max(0, Math.floor((e.getTime() - s.getTime()) / 1000));
	if (sec < 60) return `${sec}с`;
	const min = Math.floor(sec / 60);
	if (min < 60) return `${min}м`;
	const hr = Math.floor(min / 60);
	if (hr < 24) {
		const rest = min - hr * 60;
		return rest ? `${hr}ч ${rest}м` : `${hr}ч`;
	}
	const days = Math.floor(hr / 24);
	const rest = hr - days * 24;
	return rest ? `${days}д ${rest}ч` : `${days}д`;
}
