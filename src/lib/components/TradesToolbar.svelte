<script>
	/**
	 * Панель фильтров журнала: поиск, символ, направление, SL/TP, источник, победы/убытки.
	 * Переключатель видимости колонок — здесь же.
	 */
	import { emptyFilters } from '#lib/domain/journal.js';

	/** @type {{
	 *   filters?: any,
	 *   symbols?: string[],
	 *   visibleCols?: Record<string, boolean>,
	 *   columns?: {id:string,label:string}[],
	 *   total?: number,
	 *   shown?: number,
	 *   onImport?: ()=>void,
	 *   onAdd?: ()=>void,
	 *   onDeleteAll?: ()=>void
	 * }} */
	let {
		filters = $bindable(emptyFilters()),
		symbols = [],
		visibleCols = $bindable({}),
		columns = [],
		total = 0,
		shown = 0,
		onImport = () => {},
		onAdd = () => {},
		onDeleteAll = () => {}
	} = $props();

	let colsOpen = $state(false);

	function reset() {
		filters = emptyFilters();
	}
</script>

<div class="bar">
	<label class="search">
		<svg viewBox="0 0 16 16" aria-hidden="true"
			><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L14 14" /></svg
		>
		<input type="search" placeholder="Пара, комментарий, тег…" bind:value={filters.search} />
	</label>

	<label class="sel">
		<span>Пара</span>
		<select bind:value={filters.symbolFilter}>
			<option value="">все</option>
			{#each symbols as s (s)}<option value={s}>{s}</option>{/each}
		</select>
	</label>

	<label class="sel">
		<span>Напр.</span>
		<select bind:value={filters.directionFilter}>
			<option value="">все</option>
			<option value="long">LONG</option>
			<option value="short">SHORT</option>
		</select>
	</label>

	<label class="sel">
		<span>SL/TP</span>
		<select bind:value={filters.sltpFilter}>
			<option value="">все</option>
			<option value="yes">заполнены</option>
			<option value="no">не заполнены</option>
		</select>
	</label>

	<label class="sel">
		<span>Источник</span>
		<select bind:value={filters.sourceFilter}>
			<option value="">все</option>
			<option value="manual">вручную</option>
			<option value="mt5-history">MT5 history</option>
			<option value="mt5-trade">MT5 trade</option>
		</select>
	</label>

	<div class="chips">
		<button
			type="button"
			class="chip"
			class:on={filters.onlyWins}
			onclick={() => {
				filters.onlyWins = !filters.onlyWins;
				if (filters.onlyWins) filters.onlyLosses = false;
			}}>победы</button
		>
		<button
			type="button"
			class="chip"
			class:on={filters.onlyLosses}
			onclick={() => {
				filters.onlyLosses = !filters.onlyLosses;
				if (filters.onlyLosses) filters.onlyWins = false;
			}}>убытки</button
		>
	</div>

	<div class="spacer"></div>

	<span class="counter">{shown} / {total}</span>

	<div class="cols-wrap">
		<button type="button" class="icon-btn" class:on={colsOpen} onclick={() => (colsOpen = !colsOpen)} title="Колонки">
			<svg viewBox="0 0 16 16" aria-hidden="true"
				><path d="M2 4h12M2 8h12M2 12h12" /><circle cx="5" cy="4" r="1.4" fill="currentColor" /><circle
					cx="11"
					cy="8"
					r="1.4"
					fill="currentColor"
				/><circle cx="7" cy="12" r="1.4" fill="currentColor" /></svg
			>
		</button>
		{#if colsOpen}
			<div class="cols-pop">
				<div class="cols-title">Колонки</div>
				{#each columns as c (c.id)}
					<label class="cols-item">
						<input
							type="checkbox"
							checked={visibleCols[c.id] !== false}
							onchange={() => (visibleCols = { ...visibleCols, [c.id]: visibleCols[c.id] === false })}
						/>
						<span>{c.label}</span>
					</label>
				{/each}
			</div>
			<button class="cols-backdrop" aria-label="Закрыть" onclick={() => (colsOpen = false)}></button>
		{/if}
	</div>

	<button type="button" class="icon-btn" onclick={reset} title="Сбросить фильтры">
		<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8a5 5 0 1 0 1.6-3.7M3 2v3h3" /></svg>
	</button>

	<button type="button" class="act" onclick={onImport}>Импорт MT5</button>
	<button type="button" class="act primary" onclick={onAdd}>+ Сделка</button>
	<button type="button" class="act danger" onclick={onDeleteAll} title="Удалить все сделки">✕</button>
</div>

<style>
	.bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		padding-bottom: 0.8rem;
		margin-bottom: 0.2rem;
		border-bottom: 1px solid var(--line);
	}
	.search {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		border: 1px solid var(--line);
		border-radius: 2px;
		padding: 0.28rem 0.5rem;
		transition: border-color 0.2s;
	}
	.search:focus-within {
		border-color: var(--line-strong);
	}
	.search svg {
		width: 13px;
		height: 13px;
		fill: none;
		stroke: var(--ink-muted);
		stroke-width: 1.3;
		flex-shrink: 0;
	}
	.search input {
		background: transparent;
		border: none;
		outline: none;
		color: var(--ink);
		font-family: var(--font-mono);
		font-size: 0.72rem;
		width: 190px;
	}
	.search input::placeholder {
		color: var(--ink-muted);
	}
	.sel {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-family: var(--font-mono);
		font-size: 0.58rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-muted);
	}
	.sel select {
		font-family: var(--font-mono);
		font-size: 0.68rem;
		color: var(--ink);
		background: transparent;
		border: 1px solid var(--line);
		border-radius: 2px;
		padding: 0.26rem 0.3rem;
	}
	.sel select:focus {
		outline: none;
		border-color: var(--line-strong);
	}
	.chips {
		display: flex;
		gap: 0.3rem;
	}
	.chip {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		letter-spacing: 0.06em;
		padding: 0.26rem 0.55rem;
		color: var(--ink-muted);
		background: transparent;
		border: 1px solid var(--line);
		border-radius: 2px;
		cursor: pointer;
		transition:
			color 0.2s,
			border-color 0.2s,
			background 0.2s;
	}
	.chip:hover {
		color: var(--ink);
		border-color: var(--line-strong);
	}
	.chip.on {
		background: var(--sage);
		border-color: var(--sage);
		color: var(--bg);
	}
	.spacer {
		flex: 1;
	}
	.counter {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--ink-muted);
	}
	.cols-wrap {
		position: relative;
	}
	.icon-btn {
		display: grid;
		place-items: center;
		width: 26px;
		height: 26px;
		color: var(--ink-muted);
		background: transparent;
		border: 1px solid var(--line);
		border-radius: 2px;
		cursor: pointer;
		transition:
			color 0.2s,
			border-color 0.2s;
	}
	.icon-btn svg {
		width: 14px;
		height: 14px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.3;
		stroke-linecap: round;
	}
	.icon-btn:hover,
	.icon-btn.on {
		color: var(--ink);
		border-color: var(--line-strong);
	}
	.cols-pop {
		position: absolute;
		top: calc(100% + 6px);
		right: 0;
		z-index: 30;
		min-width: 180px;
		padding: 0.5rem;
		background: var(--panel-solid-raised);
		border: 1px solid var(--line-strong);
		border-radius: 2px;
		box-shadow: 0 12px 30px -18px #000;
	}
	.cols-title {
		font-family: var(--font-mono);
		font-size: 0.58rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--ink-muted);
		padding: 0 0 0.35rem 0.2rem;
	}
	.cols-item {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.25rem 0.2rem;
		font-size: 0.74rem;
		cursor: pointer;
	}
	.cols-item input {
		accent-color: var(--sage);
	}
	.cols-backdrop {
		position: fixed;
		inset: 0;
		z-index: 29;
		border: none;
		background: transparent;
	}
	.act {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		letter-spacing: 0.07em;
		text-transform: uppercase;
		padding: 0.36rem 0.7rem;
		color: var(--ink);
		background: transparent;
		border: 1px solid var(--line);
		border-radius: 2px;
		cursor: pointer;
		transition:
			border-color 0.2s,
			background 0.2s;
	}
	.act:hover {
		border-color: var(--line-strong);
	}
	.act.primary {
		background: var(--sage);
		color: var(--bg);
		border-color: var(--sage);
	}
	.act.danger {
		color: var(--danger, #c98a8a);
		border-color: color-mix(in srgb, var(--danger, #c98a8a) 35%, transparent);
		padding: 0.36rem 0.55rem;
	}
</style>
