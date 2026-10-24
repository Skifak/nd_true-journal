<script>
	/**
	 * Страница «Все сделки»: фильтры + таблица + действия.
	 * Данные — из journalStore, состояние UI (фильтры/колонки/сортировка) — локально.
	 */
	import TradesToolbar from '#lib/components/TradesToolbar.svelte';
	import TradesTable from '#lib/components/TradesTable.svelte';
	import TradeDialog from '#lib/components/TradeDialog.svelte';
	import Mt5ImportDialog from '#lib/components/Mt5ImportDialog.svelte';
	import {
		emptyFilters,
		filterTrades,
		sortTrades,
		symbolsFromTrades,
		computeTotals
	} from '#lib/domain/journal.js';
	import { formatMoney } from '#lib/domain/trades.js';
	import {
		addTrade,
		deleteAllTrades,
		deleteTrade,
		duplicateTrade,
		getTrades,
		importTrades,
		initJournal,
		journalState,
		updateTrade
	} from '#lib/storage/journalStore.svelte.js';
	import { loadUiSetting, saveUiSetting } from '#lib/storage/journal.js';

	const COLUMNS = [
		{ id: 'duration', label: 'Длительность' },
		{ id: 'volume', label: 'Объём' },
		{ id: 'prices', label: 'Цены' },
		{ id: 'sltp', label: 'SL / TP' },
		{ id: 'pips', label: 'Pips' },
		{ id: 'pct', label: '% хода' },
		{ id: 'commission', label: 'Комиссия' },
		{ id: 'swap', label: 'Своп' }
	];
	const DEFAULT_COLS = Object.fromEntries(COLUMNS.map((c) => [c.id, true]));

	let filters = $state(loadUiSetting('filters', emptyFilters()));
	let sort = $state(loadUiSetting('sort', { key: 'dateClose', dir: 'desc' }));
	let visibleCols = $state(loadUiSetting('cols', DEFAULT_COLS));

	let dialogOpen = $state(false);
	let editing = $state(null);
	let importOpen = $state(false);
	let confirmWipe = $state(false);
	let toast = $state('');

	const all = $derived(getTrades());
	const filtered = $derived(filterTrades(all, filters));
	const sorted = $derived(sortTrades(filtered, sort));
	const symbols = $derived(symbolsFromTrades(all));
	const totals = $derived(computeTotals(sorted));

	$effect(() => {
		initJournal();
	});

	// Сохраняем настройки UI при изменении (склеено в микротаск)
	$effect(() => {
		saveUiSetting('filters', $state.snapshot(filters));
	});
	$effect(() => {
		saveUiSetting('sort', $state.snapshot(sort));
	});
	$effect(() => {
		saveUiSetting('cols', $state.snapshot(visibleCols));
	});

	function showToast(msg) {
		toast = msg;
		setTimeout(() => (toast = ''), 2600);
	}

	function openNew() {
		editing = null;
		dialogOpen = true;
	}

	function openEdit(trade) {
		editing = trade;
		dialogOpen = true;
	}

	function handleSave(payload) {
		if (payload.id) {
			updateTrade(payload.id, payload);
			showToast('Сделка обновлена');
		} else {
			addTrade(payload);
			showToast('Сделка добавлена');
		}
	}

	function handleDelete(trade) {
		deleteTrade(trade.id);
		dialogOpen = false;
		showToast('Сделка удалена');
	}

	function handleDuplicate(trade) {
		duplicateTrade(trade.id);
		showToast('Сделка дублирована');
	}

	function handleImport(trades) {
		const n = importTrades(trades);
		return n;
	}

	function onImportClose(added) {
		if (typeof added === 'number') {
			showToast(added ? `Импортировано: ${added}` : 'Новых сделок нет (дубликаты)');
		}
	}

	async function wipeAll() {
		await deleteAllTrades();
		confirmWipe = false;
		showToast('Все сделки удалены');
	}
</script>

<section class="page">
	<header class="page-head">
		<div>
			<h1>Все сделки</h1>
			<p class="sub">
				{all.length} записей · итог
				<span class="pnl" class:profit={totals.profit >= 0} class:loss={totals.profit < 0}
					>{formatMoney(totals.profit, 'USD', true)}</span
				>
			</p>
		</div>
	</header>

	<TradesToolbar
		bind:filters
		bind:visibleCols
		{symbols}
		columns={COLUMNS}
		total={all.length}
		shown={filtered.length}
		onImport={() => (importOpen = true)}
		onAdd={openNew}
		onDeleteAll={() => (confirmWipe = true)}
	/>

	{#if journalState.loading}
		<p class="loading">Загрузка журнала…</p>
	{:else}
		<TradesTable
			trades={sorted}
			bind:sort
			{filters}
			{symbols}
			{visibleCols}
			onEdit={openEdit}
			onDelete={handleDelete}
			onDuplicate={handleDuplicate}
		/>
	{/if}

	{#if toast}
		<div class="toast">{toast}</div>
	{/if}
</section>

<TradeDialog
	bind:open={dialogOpen}
	trade={editing}
	onSave={handleSave}
	onDelete={handleDelete}
	onClose={() => (editing = null)}
/>

<Mt5ImportDialog bind:open={importOpen} onImport={handleImport} onClose={onImportClose} />

{#if confirmWipe}
	<div
		class="overlay"
		role="presentation"
		onclick={(e) => {
			if (e.target === e.currentTarget) confirmWipe = false;
		}}
	>
		<div class="confirm">
			<h3>Удалить все сделки?</h3>
			<p>Будет удалено {all.length} записей. Действие нельзя отменить.</p>
			<div class="confirm-foot">
				<button class="btn" onclick={() => (confirmWipe = false)}>Отмена</button>
				<button class="btn danger" onclick={wipeAll}>Удалить</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.page {
		padding: var(--sp-lg, 2rem) var(--sp-md, 1.5rem) 3rem;
		max-width: 1600px;
	}
	.page-head {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		margin-bottom: 1.2rem;
	}
	h1 {
		font-family: var(--font-display, var(--font-body));
		font-size: clamp(2rem, 3.4vw, 3rem);
		font-weight: 400;
		letter-spacing: -0.03em;
		line-height: 1;
	}
	.sub {
		margin-top: 0.5rem;
		font-family: var(--font-mono);
		font-size: 0.68rem;
		letter-spacing: 0.06em;
		color: var(--ink-muted);
	}
	.pnl {
		font-variant-numeric: tabular-nums;
	}
	.profit {
		color: var(--sage);
	}
	.loss {
		color: var(--danger, #c98a8a);
	}
	.loading {
		padding: 3rem 0;
		font-family: var(--font-mono);
		font-size: 0.72rem;
		color: var(--ink-muted);
	}
	.toast {
		position: fixed;
		bottom: 1.6rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 70;
		padding: 0.5rem 1rem;
		background: var(--panel);
		border: 1px solid var(--line-strong);
		border-radius: 2px;
		font-family: var(--font-mono);
		font-size: 0.68rem;
		color: var(--ink);
	}
	.overlay {
		position: fixed;
		inset: 0;
		z-index: 65;
		background: rgba(10, 11, 12, 0.72);
		display: grid;
		place-items: center;
	}
	.confirm {
		width: min(400px, 92vw);
		padding: 1.2rem;
		background: var(--panel);
		border: 1px solid var(--line-strong);
		border-radius: 3px;
	}
	.confirm h3 {
		font-size: 1.2rem;
		margin-bottom: 0.5rem;
	}
	.confirm p {
		font-size: 0.82rem;
		color: var(--ink-muted);
		margin-bottom: 1rem;
	}
	.confirm-foot {
		display: flex;
		gap: 0.5rem;
		justify-content: flex-end;
	}
	.btn {
		font-family: var(--font-mono);
		font-size: 0.64rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		padding: 0.42rem 0.9rem;
		color: var(--ink);
		background: transparent;
		border: 1px solid var(--line);
		border-radius: 2px;
		cursor: pointer;
	}
	.btn:hover {
		border-color: var(--line-strong);
	}
	.btn.danger {
		background: var(--danger, #c98a8a);
		border-color: var(--danger, #c98a8a);
		color: var(--bg);
	}
</style>
