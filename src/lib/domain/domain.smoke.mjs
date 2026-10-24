import { calculateProfit, tradeProfit, calculatePips, normalizeTrade, formatMoney, formatDuration, dayKey } from '/home/an/Projects/TradeJornalApp/trader-journal/nd_true-journal/src/lib/domain/trades.js';
import { filterTrades, sortTrades, computeTotals, groupByDay, equityCurve, emptyFilters } from '/home/an/Projects/TradeJornalApp/trader-journal/nd_true-journal/src/lib/domain/journal.js';
import { parseMt5Report, parseNumber, parseMt5Date, demoMt5Report } from '/home/an/Projects/TradeJornalApp/trader-journal/nd_true-journal/src/lib/domain/mt5.js';

let pass = 0, fail = 0;
const eq = (name, a, b) => {
  const ok = JSON.stringify(a) === JSON.stringify(b);
  if (ok) pass++; else { fail++; console.log('FAIL', name, '→', a, '≠', b); }
};

// P/L: (close-open)*dir*contract*volume - comm - swap
eq('profit long', calculateProfit({pair:'EURUSD',direction:'long',volume:1,priceOpen:1.1000,priceClose:1.1050,commission:0,swap:0}), 500);
eq('profit short', calculateProfit({pair:'EURUSD',direction:'short',volume:1,priceOpen:1.1000,priceClose:1.1050}), -500);
eq('profit XAU', calculateProfit({pair:'XAUUSD',direction:'long',volume:0.1,priceOpen:2000,priceClose:2010}), 100);
eq('comm+swap', calculateProfit({pair:'EURUSD',direction:'long',volume:1,priceOpen:1.10,priceClose:1.11,commission:3,swap:-1}), 998);

// pips
eq('pips EURUSD', Math.round(calculatePips({pair:'EURUSD',direction:'long',priceOpen:1.1000,priceClose:1.1050})), 50);
eq('pips JPY', calculatePips({pair:'USDJPY',direction:'long',priceOpen:150,priceClose:150.5}), 50);
eq('pips XAU', calculatePips({pair:'XAUUSD',direction:'long',priceOpen:2000,priceClose:2005}), 50);

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
eq('date dash', parseMt5Date('2026-01-05 10:30'), '2026-01-05 10:30:00');

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

// MT5 HTML
const html = `<html><head><title>Отчет торговой истории</title></head><body>
<b>Позиции</b><table>
<tr><td>Время</td><td>Позиция</td><td>Символ</td><td>Тип</td><td>Объем</td><td>Цена</td><td>S/L</td><td>T/P</td><td>Время</td><td>Цена</td><td>Комиссия</td><td>Своп</td><td>Прибыль</td></tr>
<tr><td>2026.01.05 09:00:00</td><td>1</td><td>EURUSD</td><td>buy</td><td>0.10</td><td>1.10000</td><td>1.09500</td><td>1.11000</td><td>2026.01.05 11:00:00</td><td>1.10500</td><td>-0.70</td><td>0.00</td><td>50.00</td></tr>
</table><b>Сделки</b><table>
<tr><td>2026.01.05 11:00:00</td><td>1</td><td>EURUSD</td><td>sell</td><td>out</td><td>0.10</td><td>1.10500</td><td>0</td><td>0</td><td>0</td><td>-0.70</td><td>0</td><td>50.00</td><td>balance</td><td>FVG вход</td></tr>
</table></body></html>`;
const res = parseMt5Report(html);
eq('mt5 type', res.reportType, 'history');
eq('mt5 count', res.trades.length, 1);
eq('mt5 pair', res.trades[0].pair, 'EURUSD');
eq('mt5 profit', res.trades[0].profit, 50);
eq('mt5 comment', res.trades[0].comment, 'FVG вход');
eq('mt5 source', res.trades[0].tags, ['mt5-history-report']);
eq('demo gen', demoMt5Report(10).length, 10);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
