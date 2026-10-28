// DOMParser нужен парсеру MT5; в Node его нет — подставляем из happy-dom,
// если пакет доступен (он есть в соседнем trader-journal).
try {
	if (typeof globalThis.DOMParser === 'undefined') {
		const { Window } = await import(
			'/home/an/Projects/TradeJornalApp/trader-journal/node_modules/happy-dom/lib/index.js'
		);
		(globalThis as { DOMParser?: unknown }).DOMParser = new (Window as any)().DOMParser;
	}
} catch {
	console.log('DOMParser недоступен — тесты разбора MT5 будут пропущены');
}

import { calculateProfit, tradeProfit, calculatePips, normalizeTrade, formatMoney, formatDuration, dayKey, type Trade } from './trades.ts';
import { filterTrades, sortTrades, computeTotals, groupByDay, equityCurve, emptyFilters } from './journal.ts';
import { primaryKillzone, byKillzone } from './killzones.ts';
import { parseMt5Report, parseNumber, parseMt5Date, decodeMt5Html } from './mt5.ts';

let pass = 0, fail = 0;
const eq = (name: string, a: unknown, b: unknown) => {
  const ok = JSON.stringify(a) === JSON.stringify(b);
  if (ok) pass++; else { fail++; console.log('FAIL', name, '→', a, '≠', b); }
};

// P/L: (close-open)*dir*contract*volume - comm - swap
eq('profit long', calculateProfit({pair:'EURUSD',direction:'long',volume:1,priceOpen:1.1000,priceClose:1.1050,commission:0,swap:0}), 500);
eq('profit short', calculateProfit({pair:'EURUSD',direction:'short',volume:1,priceOpen:1.1000,priceClose:1.1050}), -500);
eq('profit XAU', calculateProfit({pair:'XAUUSD',direction:'long',volume:0.1,priceOpen:2000,priceClose:2010}), 100);
eq('comm+swap', calculateProfit({pair:'EURUSD',direction:'long',volume:1,priceOpen:1.10,priceClose:1.11,commission:3,swap:-1}), 998);

// pips
eq('pips EURUSD', Math.round(calculatePips({pair:'EURUSD',direction:'long',priceOpen:1.1000,priceClose:1.1050} as Trade)!), 50);
eq('pips JPY', calculatePips({pair:'USDJPY',direction:'long',priceOpen:150,priceClose:150.5} as Trade), 50);
eq('pips XAU', calculatePips({pair:'XAUUSD',direction:'long',priceOpen:2000,priceClose:2005} as Trade), 50);

// форматирование
eq('money neg', formatMoney(-123.456,'USD'), '−123.46 $');
eq('money signed', formatMoney(50,'USD',true), '+50.00 $');
eq('duration', formatDuration('2026-01-05 10:00:00','2026-01-05 12:30:00'), '2ч 30м');
eq('dayKey', dayKey('2026-01-05 23:59:00'), '2026-01-05');

// MT5 разбор чисел
eq('num us', parseNumber('1,234.56'), 1234.56);
eq('num eu', parseNumber('1.234,56'), 1234.56);
eq('num paren', parseNumber('(123.45)'), -123.45);
eq('num currency', parseNumber('-1 234.50 USD'), -1234.5);

// MT5 даты
eq('date dots', parseMt5Date('2026.01.05 10:30:00'), '2026-01-05 10:30:00');
eq('date dash', parseMt5Date('2026.01.05 10:30'), '2026-01-05 10:30');

// филтры/сортировка/итоги
const trades = [
  normalizeTrade({id:'a',pair:'EURUSD',direction:'long',status:'closed',priceOpen:1.1,priceClose:1.11,volume:1,dateClose:'2026-01-05 10:00:00',dateOpen:'2026-01-05 09:00:00'}),
  normalizeTrade({id:'b',pair:'XAUUSD',direction:'short',status:'closed',priceOpen:2000,priceClose:2010,volume:0.1,dateClose:'2026-01-06 10:00:00',dateOpen:'2026-01-06 09:00:00'}),
  normalizeTrade({id:'c',pair:'EURUSD',direction:'long',status:'open',priceOpen:1.2,sl:1.19,tp:1.25,dateOpen:'2026-01-07 09:00:00'})
];
eq('filter pair', filterTrades(trades, {...emptyFilters(), symbolFilter:'EURUSD'}).length, 2);
eq('filter wins', filterTrades(trades, {...emptyFilters(), onlyWins:true}).map(t=>t.id), ['a']);
eq('filter losses', filterTrades(trades, {...emptyFilters(), onlyLosses:true}).map(t=>t.id), ['b']);
eq('filter sltp', filterTrades(trades, {...emptyFilters(), sltpFilter:'yes'}).map(t=>t.id), ['c']);
eq('filter search', filterTrades(trades, {...emptyFilters(), search:'xau'}).map(t=>t.id), ['b']);
eq('sort profit desc', sortTrades(trades,{key:'profit',dir:'desc'}).map(t=>t.id), ['a','c','b']);
const tot = computeTotals(trades);
eq('totals profit', Math.round(tot.profit), 900);
eq('totals wins', tot.wins, 1);
eq('groups', groupByDay(trades).length, 3);

const eqc = equityCurve(trades, 1000);
eq('equity len', eqc.values.length, 3);
eq('equity last', eqc.values[2], 1900);

// порядок по времени закрытия, а не по порядку массива
eq('equity sorts by time', equityCurve([...trades].reverse(), 0).values, [0, 1000, 900]);
// период: всё до границы отбрасывается, стартовая точка — на границе
const windowed = equityCurve(trades, 0, Date.parse('2026-01-06T00:00:00'));
eq('equity since values', windowed.values, [0, -100]);
eq('equity since dates', windowed.dates, ['', '2026-01-06']);

// MT5 HTML: реальная разметка терминала (секция = <tr><th><b>Имя</b></th></tr>,
// строки данных — <tr bgcolor=...>, подпись колонок «Прибыль» с colspan=2)
const html = `<html><head><title>Отчет торговой истории</title></head><body><table>
<tr align="center"><th colspan="14"><div><b>Позиции</b></div></th></tr>
<tr align="center" bgcolor="#E5F0FC"><td><b>Время</b></td><td><b>Позиция</b></td></tr>
<tr bgcolor="#FFFFFF" align="right"><td>2026.01.05 09:00:00</td><td>1</td><td>EURUSD</td><td>buy</td><td class="hidden" colspan="8"></td><td>0.10</td><td>1.10000</td><td>1.09500</td><td>1.11000</td><td>2026.01.05 11:00:00</td><td>1.10500</td><td>-0.70</td><td>0.00</td><td colspan="2">50.00</td></tr>
<tr bgcolor="#F7F7F7" align="right"><td>2026.01.06 09:00:00</td><td>2</td><td>XAUUSD</td><td>sell</td><td class="hidden" colspan="8"></td><td>0.02</td><td>2000.00</td><td></td><td></td><td>2026.01.06 10:30:00</td><td>1990.00</td><td>-0.50</td><td>0.00</td><td colspan="2">20.00</td></tr>
<tr align="center"><th colspan="14"><div><b>Сделки</b></div></th></tr>
<tr bgcolor="#FFFFFF" align="right"><td>2026.01.05 11:00:00</td><td>2119889</td><td>EURUSD</td><td>sell</td><td>out</td><td>0.10</td><td>1.10500</td><td>2364310</td><td class="hidden"></td><td>-0.70</td><td>0.00</td><td>0.00</td><td>50.00</td><td>1 012.30</td><td>FVG вход</td></tr>
</table></body></html>`;
const res = parseMt5Report(html);
eq('mt5 type', res.reportType, 'history');
eq('mt5 count', res.trades.length, 2);
eq('mt5 id', res.trades[0].id, 'mt5_pos_1');
eq('mt5 pair', res.trades[0].pair, 'EURUSD');
eq('mt5 volume', res.trades[0].volume, 0.1);
eq('mt5 profit', res.trades[0].profit, 50);
eq('mt5 commission', res.trades[0].commission, -0.7);
eq('mt5 comment', res.trades[0].comment, 'FVG вход');
eq('mt5 sl', res.trades[0].sl, 1.095);
eq('mt5 tags', res.trades[0].tags, ['mt5', 'mt5-history-report']);
eq('mt5 stable ids', parseMt5Report(html).trades.map((t) => t.id), res.trades.map((t) => t.id));

// Торговый отчёт: открытые позиции, другая раскладка колонок
const htmlOpen = `<html><head><title>Trade Report</title></head><body><table>
<tr align="center"><th colspan="12"><div><b>Позиции</b></div></th></tr>
<tr bgcolor="#FFFFFF" align="right"><td>EURUSD</td><td>777</td><td>2026.01.07 10:00:00</td><td>buy</td><td>0.05</td><td>1.10000</td><td>1.09500</td><td>1.11000</td><td>1.10200</td><td>-0.20</td><td>12.00</td><td>по тренду</td></tr>
</table></body></html>`;
const resOpen = parseMt5Report(htmlOpen);
eq('mt5 open type', resOpen.reportType, 'trade');
eq('mt5 open id', resOpen.trades[0].id, 'mt5_open_777');
eq('mt5 open status', resOpen.trades[0].status, 'open');
eq('mt5 open comment', resOpen.trades[0].comment, 'по тренду');
eq('mt5 open marketPrice', resOpen.trades[0].marketPrice, 1.102);

// Метаданные: «Торговый счёт: N (USD, Server, real, Hedge)» + «Баланс:»
const htmlMeta = `<html><head><title>Trade Report</title></head><body><table>
<tr align="left"><th colspan="4">Торговый счет:</th><th colspan="10"><b>112079&nbsp;(USD,&nbsp;FundedTradingPlus-Live,&nbsp;real,&nbsp;Hedge)</b></th></tr>
<tr align="left"><th colspan="4">Баланс:</th><th colspan="10"><b>10 176.66</b></th></tr>
</table></body></html>`;
const resMeta = parseMt5Report(htmlMeta);
eq('mt5 currency', resMeta.statementCurrency, 'USD');
eq('mt5 balance', resMeta.balanceRaw, '10 176.66');
eq('mt5 accountKind', resMeta.importAccountKind, 'real');
eq('mt5 server', resMeta.importAccountServer, 'FundedTradingPlus-Live');
eq('mt5 hedge', resMeta.importAccountHedgeMode, 'hedge');

// Не-MT5 файл не парсится
const resBad = parseMt5Report('<html><body><p>просто страница</p></body></html>');
eq('mt5 bad type', resBad.reportType, null);
eq('mt5 bad trades', resBad.trades.length, 0);
eq('mt5 bad looksLike', resBad.looksLikeMt5, false);

// Декодирование отчёта MT5 (UTF-16 LE с BOM)
const enc = new TextEncoder();
const src = '<html>ok</html>';
const u16 = [0xff, 0xfe];
for (const ch of src) {
	const c = ch.charCodeAt(0);
	u16.push(c & 0xff, c >> 8);
}
eq('decode utf16 bom', decodeMt5Html(new Uint8Array(u16).buffer), src);
eq('decode utf8', decodeMt5Html(enc.encode('<html>ok</html>').buffer), '<html>ok</html>');

// Killzone: UTC-окна. Метки строим из UTC-инстанта, чтобы тест не зависел от таймзоны машины
const stampFromUtc = (h: number, mi: number) => {
	const d = new Date(Date.UTC(2026, 0, 5, h, mi));
	const p = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:00`;
};
eq('kz london', primaryKillzone(stampFromUtc(7, 30))?.id, 'london');
eq('kz asian (wrap)', primaryKillzone(stampFromUtc(1, 30))?.id, 'asian');
eq('kz out', primaryKillzone(stampFromUtc(17, 0)), null);
const kzTrades = [
	{ id: '1', dateOpen: stampFromUtc(7, 30), status: 'closed', profit: 100 },
	{ id: '2', dateOpen: stampFromUtc(17, 0), status: 'closed', profit: -30 }
] as never;
eq('kz rows', byKillzone(kzTrades), [
	{ id: 'london', label: 'Лондонская KZ', pnl: 100, count: 1, wins: 1 },
	{ id: 'out', label: 'Вне KZ', pnl: -30, count: 1, wins: 0 }
]);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
