<script lang="ts">
	/**
	 * Горизонтальные бары P/L по категориям — чистый CSS, без зависимостей.
	 * Положительные бары — в плюс (sage), отрицательные — в минус (red).
	 */
	interface Props {
		rows: { label: string; pnl: number; count: number; wins: number }[];
	}

	let { rows }: Props = $props();

	// Максимальное |P/L| — для масштабирования ширины баров
	const maxAbs = $derived(Math.max(1, ...rows.map((r) => Math.abs(r.pnl))));

	const fmt = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2)} $`;

	function winRate(wins: number, count: number): string {
		return count ? `${Math.round((wins / count) * 100)}%` : '—';
	}
</script>

{#if rows.length === 0}
	<p class="panel-empty">Нет закрытых сделок за период</p>
{:else}
	<ul class="bars">
		{#each rows as r (r.label)}
			{@const w = (Math.abs(r.pnl) / maxAbs) * 100}
			<li>
				<span class="bar-label">{r.label}</span>
				<span class="bar-track">
					<span class="bar-fill" class:neg={r.pnl < 0} style:width="{w}%"></span>
				</span>
				<span class="bar-pnl" class:neg={r.pnl < 0}>{fmt(r.pnl)}</span>
				<span class="bar-meta">{r.count} · {winRate(r.wins, r.count)}</span>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.bars {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--sp-sm);
	}
	li {
		display: grid;
		grid-template-columns: 9.5em 1fr 6.5em 4.5em;
		align-items: center;
		gap: var(--sp-sm);
		font-size: 0.8rem;
	}
	.bar-label {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--ink-soft);
	}
	.bar-track {
		position: relative;
		height: 14px;
		background: var(--bg-soft, var(--bg));
		border: 1px solid var(--line);
	}
	.bar-fill {
		position: absolute;
		inset: 0 auto 0 0;
		background: var(--sage);
		opacity: 0.75;
	}
	.bar-fill.neg {
		background: var(--red, #b4544f);
	}
	.bar-pnl {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	.bar-meta {
		color: var(--ink-soft);
		font-size: 0.72rem;
		text-align: right;
	}
	.neg {
		color: var(--red, #b4544f);
	}
</style>
