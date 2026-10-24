<script>
	/**
	 * Таблица сделок: фильтры, сортировка, пагинация, группировка по дням, итоги.
	 * Без зависимостей. Все данные приходят пропсами — компонент не знает о хранилище.
	 */
	import {
		formatDate,
		formatDuration,
		formatMoney,
		formatNumber,
		formatPrice,
		calculatePips,
		calculatePricePercent,
		tradeSource,
		tradeProfit
	} from '#lib/domain/trades.js';
	import {
		sortIndicator,
		toggleSort,
		computeTotals,
		groupByDay
	} from '#lib/domain/journal.js';

	/** @type {{
	 *   trades?: any[],
	 *   sort?: {key: string, dir: 'asc'|'desc'},
	 *   filters?: any,
	 *   symbols?: string[],
	 *   visibleCols?: Record<string, boolean>,
	 *   pageSize?: number,
	 *   currency?: string,
	 *   onEdit?: (t:any)=>void,
	 *   onDelete?: (t:any)=>void,
	 *   onDuplicate?: (t:any)=>void,
	 * }} */
	let {
		trades = [],
		sort = $bindable({ key: 'dateClose', dir: 'desc' }),
		filters = $bindable(),
		symbols = [],
		visibleCols = {},
		pageSize = 50,
		currency = 'USD',
		onEdit = () => {},
		onDelete = () => {},
		onDuplicate = () => {}
	} = $props();

	let page = $state(0);
	let rowMenu = $state(/** @type {{trade:any,x:number,y:number}|null} */ (null));

	const pages = $derived(Math.max(1, Math.ceil(trades.length / pageSize)));
	const pageTrades = $derived(trades.slice(page * pageSize, (page + 1) * pageSize));
	const groups = $derived(groupByDay(pageTrades));
	const totals = $derived(computeTotals(trades));
	const shownFrom = $derived(trades.length ? page * pageSize + 1 : 0);
	const shownTo = $derived(Math.min((page + 1) * pageSize, trades.length));

	// Сброс страницы при смене фильтров/сортировки
	$effect(() => {
		void filters?.search;
		void filters?.symbolFilter;
		void filters?.directionFilter;
		void filters?.sltpFilter;
		void filters?.sourceFilter;
		void filters?.onlyWins;
		void filters?.onlyLosses;
		void sort.key;
		void sort.dir;
		page = 0;
	});

	$effect(() => {
		if (page > 0 && page >= pages) page = pages - 1;
	});

	function openMenu(event, trade) {
		const r = event.currentTarget.getBoundingClientRect();
		rowMenu = { trade, x: Math.min(r.right, window.innerWidth - 210), y: r.bottom + 4 };
	}

	function runAction(fn, trade) {
		rowMenu = null;
		fn(trade);
	}

	const sourceLabel = { manual: 'вручную', 'mt5-history': 'MT5 history', 'mt5-trade': 'MT5 trade' };
</script>

<div class="table-wrap">
	{#if trades.length === 0}
		<div class="empty">
			<p class="empty-title">Сделок нет</p>
			<p class="empty-desc">Добавьте первую сделку или импортируйте отчёт MT5.</p>
		</div>
	{:else}
		<table class="trades">
			<thead>
				<tr>
					<th class="sortable" onclick={() => (sort = toggleSort(sort, 'dateOpen'))}
						>Открыта{sortIndicator(sort, 'dateOpen')}</th
					>
					<th class="sortable" onclick={() => (sort = toggleSort(sort, 'dateClose'))}
						>Закрыта{sortIndicator(sort, 'dateClose')}</th
					>
					{#if visibleCols.duration}
						<th class="sortable" onclick={() => (sort = toggleSort(sort, 'duration'))}
							>Длит.{sortIndicator(sort, 'duration')}</th
						>
					{/if}
					<th class="sortable" onclick={() => (sort = toggleSort(sort, 'pair'))}
						>Пара{sortIndicator(sort, 'pair')}</th
					>
					<th>Напр.</th>
					{#if visibleCols.volume}
						<th class="num sortable" onclick={() => (sort = toggleSort(sort, 'volume'))}
							>Объём{sortIndicator(sort, 'volume')}</th
						>
					{/if}
					{#if visibleCols.prices}<th class="num">Откр. / Закр.</th>{/if}
					{#if visibleCols.sltp}<th class="num">SL / TP</th>{/if}
					{#if visibleCols.pips}
						<th class="num">Pips</th>
					{/if}
					{#if visibleCols.pct}
						<th class="num">%</th>
					{/if}
					{#if visibleCols.commission}
						<th class="num sortable" onclick={() => (sort = toggleSort(sort, 'commission'))}
							>Комис.{sortIndicator(sort, 'commission')}</th
						>
					{/if}
					{#if visibleCols.swap}
						<th class="num sortable" onclick={() => (sort = toggleSort(sort, 'swap'))}
							>Своп{sortIndicator(sort, 'swap')}</th
						>
					{/if}
					<th class="num sortable" onclick={() => (sort = toggleSort(sort, 'profit'))}
						>P/L{sortIndicator(sort, 'profit')}</th
					>
					<th class="actions-col"></th>
				</tr>
			</thead>
			<tbody>
				{#each groups as group (group.dayKey)}
					<tr class="day-row">
						<td colspan="20">
							<span class="day-key">{group.dayKey ?? '—'}</span>
							<span class="day-sep">·</span>
							<span class="day-stat">{group.trades.length} сдел.</span>
							<span class="day-stat win">{group.wins}↑</span>
							<span class="day-stat loss">{group.losses}↓</span>
							<span class="day-pnl" class:profit={group.profit >= 0} class:loss={group.profit < 0}
								>{formatMoney(group.profit, currency, true)}</span
							>
						</td>
					</tr>
					{#each group.trades as trade (trade.id)}
						{@const pips = calculatePips(trade)}
						{@const pct = calculatePricePercent(trade)}
						{@const pl = tradeProfit(trade)}
						<tr class="trade-row" onclick={() => onEdit(trade)}>
							<td class="mono">{formatDate(trade.dateOpen)}</td>
							<td class="mono">{trade.dateClose ? formatDate(trade.dateClose) : '—'}</td>
							{#if visibleCols.duration}
								<td class="mono muted">{formatDuration(trade.dateOpen, trade.dateClose)}</td>
							{/if}
							<td>
								<strong>{trade.pair}</strong>
								<span class="src" title={sourceLabel[tradeSource(trade)]}>{tradeSource(trade) === 'manual' ? '' : '⤓'}</span>
							</td>
							<td>
								<span class="dir" class:long={trade.direction === 'long'} class:short={trade.direction === 'short'}>
									{trade.direction === 'long' ? 'LONG' : 'SHORT'}
								</span>
							</td>
							{#if visibleCols.volume}<td class="num">{trade.volume}</td>{/if}
							{#if visibleCols.prices}
								<td class="num mono">{formatPrice(trade.priceOpen)} / {trade.priceClose != null ? formatPrice(trade.priceClose) : '—'}</td>
							{/if}
							{#if visibleCols.sltp}
								<td class="num mono">{trade.sl ? formatPrice(trade.sl) : '—'} / {trade.tp ? formatPrice(trade.tp) : '—'}</td>
							{/if}
							{#if visibleCols.pips}
								<td class="num mono" class:profit={pips != null && pips >= 0} class:loss={pips != null && pips < 0}
									>{pips != null ? formatNumber(pips, 1) : '—'}</td
								>
							{/if}
							{#if visibleCols.pct}
								<td class="num mono" class:profit={pct != null && pct >= 0} class:loss={pct != null && pct < 0}
									>{pct != null ? formatNumber(pct, 2) + '%' : '—'}</td
								>
							{/if}
							{#if visibleCols.commission}
								<td class="num mono muted">{formatNumber(trade.commission, 2)}</td>
							{/if}
							{#if visibleCols.swap}
								<td class="num mono muted">{formatNumber(trade.swap, 2)}</td>
							{/if}
							<td class="num">
								<span class="pnl" class:profit={pl >= 0} class:loss={pl < 0}>{formatMoney(pl, currency, true)}</span>
							</td>
							<td class="actions-col">
								<button
									class="row-menu-btn"
									title="Действия"
									aria-label="Действия"
									onclick={(e) => {
										e.stopPropagation();
										openMenu(e, trade);
									}}>⋯</button
								>
							</td>
						</tr>
					{/each}
				{/each}
			</tbody>
			<tfoot>
				<tr>
					<td colspan="20">
						<div class="totals">
							<span class="totals-label">Итого по {totals.count}:</span>
							<span class="totals-item">Побед <b class="profit">{totals.wins}</b></span>
							<span class="totals-item">Убытков <b class="loss">{totals.losses}</b></span>
							<span class="totals-item">Win rate <b>{formatNumber(totals.winRate, 1)}%</b></span>
							{#if visibleCols.commission}
								<span class="totals-item">Комис. <b class="muted">{formatNumber(totals.commission, 2)}</b></span>
							{/if}
							{#if visibleCols.swap}
								<span class="totals-item">Своп <b class="muted">{formatNumber(totals.swap, 2)}</b></span>
							{/if}
							<span class="totals-item">P/L <b class:profit={totals.profit >= 0} class:loss={totals.profit < 0}
									>{formatMoney(totals.profit, currency, true)}</b
								></span
							>
						</div>
					</td>
				</tr>
			</tfoot>
		</table>

		{#if trades.length > pageSize}
			<div class="pager">
				<button class="pager-btn" disabled={page === 0} onclick={() => page--}>← Назад</button>
				<span class="pager-info">{shownFrom}–{shownTo} из {trades.length}</span>
				<button class="pager-btn" disabled={page >= pages - 1} onclick={() => page++}>Далее →</button>
			</div>
		{/if}
	{/if}
</div>

{#if rowMenu}
	<button class="menu-backdrop" aria-label="Закрыть" onclick={() => (rowMenu = null)}></button>
	<div class="row-menu" style:left="{rowMenu.x}px" style:top="{rowMenu.y}px">
		<button onclick={() => runAction(onEdit, rowMenu.trade)}>
			<span class="mi">✎</span> Изменить
		</button>
		<button onclick={() => runAction(onDuplicate, rowMenu.trade)}>
			<span class="mi">⧉</span> Дублировать
		</button>
		<div class="menu-sep"></div>
		<button class="danger" onclick={() => runAction(onDelete, rowMenu.trade)}>
			<span class="mi">✕</span> Удалить
		</button>
	</div>
{/if}

<style>
	.table-wrap {
		width: 100%;
	}
	table.trades {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.78rem;
	}
	thead th {
		position: sticky;
		top: 0;
		z-index: 2;
		text-align: left;
		font-family: var(--font-mono);
		font-size: 0.6rem;
		font-weight: 400;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--ink-muted);
		padding: 0.5rem 0.6rem;
		border-bottom: 1px solid var(--line-strong);
		background: var(--bg);
		white-space: nowrap;
	}
	thead th.num,
	td.num {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	thead th.sortable {
		cursor: pointer;
		user-select: none;
		transition: color 0.2s;
	}
	thead th.sortable:hover {
		color: var(--ink);
	}
	tbody td {
		padding: 0.42rem 0.6rem;
		border-bottom: 1px solid var(--line);
		vertical-align: middle;
		white-space: nowrap;
	}
	.trade-row {
		cursor: pointer;
		transition: background 0.15s;
	}
	.trade-row:hover td {
		background: color-mix(in srgb, var(--ink) 4%, transparent);
	}
	.mono {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		font-variant-numeric: tabular-nums;
	}
	.muted {
		color: var(--ink-muted);
	}
	.profit {
		color: var(--sage);
	}
	.loss {
		color: var(--danger, #c98a8a);
	}
	.dir {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		letter-spacing: 0.08em;
		padding: 0.12rem 0.32rem;
		border: 1px solid var(--line);
		border-radius: 2px;
		color: var(--ink-muted);
	}
	.dir.long {
		color: var(--sage);
		border-color: color-mix(in srgb, var(--sage) 45%, transparent);
	}
	.dir.short {
		color: var(--danger, #c98a8a);
		border-color: color-mix(in srgb, var(--danger, #c98a8a) 45%, transparent);
	}
	.src {
		color: var(--ink-muted);
		font-size: 0.7rem;
		margin-left: 0.25rem;
	}
	.pnl {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		font-variant-numeric: tabular-nums;
	}
	.day-row td {
		padding: 0.55rem 0.6rem 0.3rem;
		border-bottom: 1px solid var(--line);
		background: color-mix(in srgb, var(--ink) 3%, transparent);
	}
	.day-key {
		font-family: var(--font-mono);
		font-size: 0.66rem;
		letter-spacing: 0.06em;
		color: var(--ink);
	}
	.day-sep {
		color: var(--line-strong);
		margin: 0 0.4rem;
	}
	.day-stat {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--ink-muted);
		margin-right: 0.45rem;
	}
	.day-stat.win {
		color: var(--sage);
	}
	.day-stat.loss {
		color: var(--danger, #c98a8a);
	}
	.day-pnl {
		float: right;
		font-family: var(--font-mono);
		font-size: 0.66rem;
	}
	.actions-col {
		width: 34px;
		text-align: right;
	}
	.row-menu-btn {
		background: transparent;
		border: 1px solid transparent;
		border-radius: 2px;
		color: var(--ink-muted);
		width: 22px;
		height: 22px;
		line-height: 1;
		cursor: pointer;
		transition:
			color 0.2s,
			border-color 0.2s;
	}
	.row-menu-btn:hover {
		color: var(--ink);
		border-color: var(--line-strong);
	}
	tfoot td {
		padding: 0.7rem 0.6rem;
		border-top: 1px solid var(--line-strong);
	}
	.totals {
		display: flex;
		flex-wrap: wrap;
		gap: 0.9rem;
		font-family: var(--font-mono);
		font-size: 0.66rem;
		color: var(--ink-muted);
	}
	.totals-label {
		color: var(--ink);
	}
	.totals-item b {
		font-weight: 400;
		color: var(--ink);
	}
	.pager {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.8rem 0.2rem 0.2rem;
	}
	.pager-btn {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		padding: 0.35rem 0.7rem;
		color: var(--ink-muted);
		background: transparent;
		border: 1px solid var(--line);
		border-radius: 2px;
		cursor: pointer;
		transition:
			color 0.2s,
			border-color 0.2s;
	}
	.pager-btn:hover:not(:disabled) {
		color: var(--ink);
		border-color: var(--line-strong);
	}
	.pager-btn:disabled {
		opacity: 0.35;
		cursor: default;
	}
	.pager-info {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--ink-muted);
	}
	.empty {
		padding: 3rem 1rem;
		text-align: center;
	}
	.empty-title {
		font-size: 1.2rem;
		margin-bottom: 0.4rem;
	}
	.empty-desc {
		font-family: var(--font-mono);
		font-size: 0.68rem;
		color: var(--ink-muted);
	}
	.menu-backdrop {
		position: fixed;
		inset: 0;
		z-index: 40;
		background: transparent;
		border: none;
	}
	.row-menu {
		position: fixed;
		z-index: 41;
		min-width: 190px;
		padding: 0.3rem;
		background: var(--panel);
		border: 1px solid var(--line-strong);
		border-radius: 3px;
		display: flex;
		flex-direction: column;
		gap: 1px;
	}
	.row-menu button {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.4rem 0.55rem;
		font-family: var(--font-body);
		font-size: 0.76rem;
		text-align: left;
		color: var(--ink);
		background: transparent;
		border: none;
		border-radius: 2px;
		cursor: pointer;
		transition: background 0.15s;
	}
	.row-menu button:hover {
		background: color-mix(in srgb, var(--ink) 7%, transparent);
	}
	.row-menu button.danger {
		color: var(--danger, #c98a8a);
	}
	.mi {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		opacity: 0.7;
	}
	.menu-sep {
		height: 1px;
		background: var(--line);
		margin: 0.2rem 0;
	}
	@media (max-width: 1100px) {
		.table-wrap {
			overflow-x: auto;
		}
	}
</style>
