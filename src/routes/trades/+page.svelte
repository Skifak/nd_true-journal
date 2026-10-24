<script lang="ts">
	/**
	 * Страница «Все сделки»: фильтры + таблица + действия.
	 * Данные — из journalStore, состояние UI (фильтры/колонки/сортировка) — локально.
	 */
	import TradesToolbar from '#lib/components/TradesToolbar.svelte';
	import TradesTable from '#lib/components/TradesTable.svelte';
	import TradeDialog from '#lib/components/TradeDialog.svelte';
	import Mt5ImportDialog from '#lib/components/Mt5ImportDialog.svelte';
	import Modal from '#lib/components/Modal.svelte';
	import {
		emptyFilters,
		filterTrades,
		sortTrades,
		symbolsFromTrades,
		computeTotals,
		type Filters,
		type SortState
	} from '#lib/domain/journal.ts';
	import { formatMoney, type Trade } from '#lib/domain/trades.ts';
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
	} from '#lib/storage/journalStore.svelte.ts';
	import { loadUiSetting, saveUiSetting } from '#lib/storage/journal.ts';

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

	let filters = $state<Filters>(loadUiSetting('filters', emptyFilters()));
	let sort = $state<SortState>(loadUiSetting<SortState>('sort', { key: 'dateClose', dir: 'desc' }));
	let visibleCols = $state<Record<string, boolean>>(loadUiSetting('cols', DEFAULT_COLS));

	let dialogOpen = $state(false);
	let editing = $state<Trade | null>(null);
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

	function showToast(msg: string) {
		toast = msg;
		setTimeout(() => (toast = ''), 2600);
	}

	function openNew() {
		editing = null;
		dialogOpen = true;
	}

	function openEdit(trade: Trade) {
		editing = trade;
		dialogOpen = true;
	}

	function handleSave(payload: Partial<Trade>) {
		if (payload.id) {
			updateTrade(payload.id, payload);
			showToast('Сделка обновлена');
		} else {
			addTrade(payload);
			showToast('Сделка добавлена');
		}
	}

	function handleDelete(trade: Trade) {
		deleteTrade(trade.id);
		dialogOpen = false;
		showToast('Сделка удалена');
	}

	function handleDuplicate(trade: Trade) {
		duplicateTrade(trade.id);
		showToast('Сделка дублирована');
	}

	function handleImport(trades: Trade[]) {
		return importTrades(trades);
	}

	function onImportClose(added?: number) {
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
		<div class="toast" role="status">{toast}</div>
	{/if}
</section>

<TradeDialog
	bind:open={dialogOpen}
	trade={editing}
	onSave={handleSave}
	onDelete={(id) => {
		const t = all.find((x) => x.id === id);
		if (t) handleDelete(t);
	}}
	onClose={() => (editing = null)}
/>

<Mt5ImportDialog bind:open={importOpen} onImport={handleImport} onClose={onImportClose} />

<Modal bind:open={confirmWipe} title="Удалить все сделки?" size="sm">
	<p class="confirm-text">
		Будет удалено {all.length} записей. Действие нельзя отменить — данные хранятся локально, копии нет.
	</p>
	{#snippet footer()}
		<div class="spacer"></div>
		<button class="btn" onclick={() => (confirmWipe = false)}>Отмена</button>
		<button class="btn danger-solid" onclick={wipeAll}>Удалить</button>
	{/snippet}
</Modal>

<style>
	.page {
		padding: var(--sp-lg) var(--sp-md) 3rem;
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
		background: var(--panel-solid-raised);
		border: 1px solid var(--line-strong);
		border-radius: 2px;
		box-shadow: 0 10px 28px -16px #000;
		font-family: var(--font-mono);
		font-size: 0.68rem;
		color: var(--ink);
	}
	.confirm-text {
		font-size: 0.86rem;
		line-height: 1.5;
		color: var(--ink-muted);
	}
	.spacer {
		flex: 1;
	}
	@media (max-width: 760px) {
		.toast {
			bottom: calc(var(--tabbar-h, 56px) + 0.8rem);
		}
	}
</style>
