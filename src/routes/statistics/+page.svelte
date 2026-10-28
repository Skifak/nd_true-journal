<script lang="ts">
	/**
	 * Вкладка «Статистика сделок»: метрики по закрытым сделкам и разбивки.
	 * Данные — из journalStore; графики — свои CSS/SVG, без зависимостей.
	 * Референс состава метрик — вкладка статистики старого журнала.
	 */
	import { getTrades, initJournal, journalState } from '#lib/storage/journalStore.svelte.ts';
	import { computeStats, byWeekday, byPair, byDay, type Stats } from '#lib/domain/stats.ts';
	import { byKillzone } from '#lib/domain/killzones.ts';
	import { formatMoney, parseStamp, type Trade } from '#lib/domain/trades.ts';
	import EquityChart from '#lib/components/EquityChart.svelte';
	import PnlBars from '#lib/components/PnlBars.svelte';
	import { equityCurve } from '#lib/domain/journal.ts';

	// Периоды: окно в днях от текущего дня; null — вся история
	const RANGES = [
		{ id: 'week', label: 'Неделя', days: 7 },
		{ id: 'month', label: 'Месяц', days: 30 },
		{ id: 'quarter', label: 'Квартал', days: 90 },
		{ id: 'year', label: 'Год', days: 365 },
		{ id: 'all', label: 'Вся история', days: null }
	] as const;
	let rangeIdx = $state(RANGES.length - 1);

	const since = $derived.by(() => {
		const days = RANGES[rangeIdx].days;
		return days == null ? undefined : Date.now() - days * 86_400_000;
	});

	initJournal();
	const allTrades: Trade[] = $derived(getTrades());

	const periodTrades = $derived(
		since == null
			? allTrades
			: allTrades.filter((t) => (parseStamp(t.dateClose || t.dateOpen)?.getTime() ?? 0) >= since)
	);
	const closedTrades = $derived(periodTrades.filter((t) => t.status === 'closed'));

	const stats: Stats = $derived(computeStats(periodTrades));
	const curve = $derived(equityCurve(periodTrades, 0, since));

	const kzRows = $derived(byKillzone(periodTrades));
	const weekdayRows = $derived(byWeekday(periodTrades));
	const pairRows = $derived(byPair(periodTrades).slice(0, 8));
	const dayRows = $derived(byDay(periodTrades, 10));

	// Карточки метрик — верх страницы
	const cards = $derived.by(() => {
		const pf = stats.profitFactor;
		return [
			{ label: 'Net P/L', value: stats.count ? formatMoney(stats.netProfit, 'USD', true) : '—' },
			{ label: 'Сделок', value: String(stats.count) },
			{ label: 'Винрейт', value: stats.count ? `${stats.winRate.toFixed(1)}%` : '—' },
			{ label: 'Profit Factor', value: stats.count ? (pf === Infinity ? '∞' : pf.toFixed(2)) : '—' },
			{ label: 'Матожидание', value: stats.count ? formatMoney(stats.expectancy, 'USD', true) : '—' },
			{ label: 'Средний плюс', value: stats.wins ? formatMoney(stats.avgWin, 'USD', true) : '—' },
			{ label: 'Средний минус', value: stats.losses ? formatMoney(-stats.avgLoss, 'USD', true) : '—' },
			{ label: 'Макс. просадка', value: stats.count ? formatMoney(-stats.maxDrawdown, 'USD', true) : '—' }
		];
	});

	// Вторая строка карточек: серии и лонг/шорт
	const cards2 = $derived.by(() => [
		{ label: 'Серия плюс', value: String(stats.maxStreakWins) },
		{ label: 'Серия минус', value: String(stats.maxStreakLosses) },
		{ label: 'Лонг', value: stats.longCount ? `${stats.longCount} · ${stats.longWinRate.toFixed(0)}%` : '—' },
		{ label: 'Шорт', value: stats.shortCount ? `${stats.shortCount} · ${stats.shortWinRate.toFixed(0)}%` : '—' },
		{ label: 'Комиссии', value: stats.count ? formatMoney(-stats.sumCommission, 'USD', true) : '—' },
		{ label: 'Свопы', value: stats.count ? formatMoney(-stats.sumSwap, 'USD', true) : '—' }
	]);

	const fmtDay = (dk: string) => dk.slice(8) + '.' + dk.slice(5, 7);
</script>

<div class="sets" role="group" aria-label="Период статистики">
	{#each RANGES as r, i}
		<button
			type="button"
			class="set-btn"
			class:active={i === rangeIdx}
			aria-pressed={i === rangeIdx}
			onclick={() => (rangeIdx = i)}>{r.label}</button
		>
	{/each}
</div>

<section class="kpi-grid" aria-label="Метрики">
	{#each [...cards, ...cards2] as c}
		<div class="kpi">
			<p class="kpi-label">{c.label}</p>
			<p class="kpi-value">{c.value}</p>
		</div>
	{/each}
</section>

<div class="panel">
	<div class="panel-head">
		<h2 class="panel-title">Кривая капитала</h2>
		<span class="eyebrow">закрытые сделки периода</span>
	</div>
	{#if curve.values.length < 2}
		<p class="panel-empty">{journalState.loading ? 'Загрузка…' : 'Нет закрытых сделок за период'}</p>
	{:else}
		<EquityChart {curve} heightRatio={0.22} />
	{/if}
</div>

<section class="grid-2">
	<div class="panel">
		<div class="panel-head">
			<h2 class="panel-title">По killzone</h2>
			<span class="eyebrow">окно входа</span>
		</div>
		<PnlBars rows={kzRows} />
	</div>

	<div class="panel">
		<div class="panel-head">
			<h2 class="panel-title">По дням недели</h2>
			<span class="eyebrow">закрытие сделки</span>
		</div>
		<PnlBars rows={weekdayRows} />
	</div>

	<div class="panel">
		<div class="panel-head">
			<h2 class="panel-title">По инструментам</h2>
			<span class="eyebrow">топ-8</span>
		</div>
		<PnlBars rows={pairRows} />
	</div>

	<div class="panel">
		<div class="panel-head">
			<h2 class="panel-title">Последние дни</h2>
			<span class="eyebrow">P/L по дням</span>
		</div>
		{#if dayRows.length === 0}
			<p class="panel-empty">Нет закрытых сделок за период</p>
		{:else}
			<ul class="days">
				{#each dayRows as d (d.day)}
					<li>
						<span class="day-date">{fmtDay(d.day)}</span>
						<span class="day-count">{d.count} сделок</span>
						<span class="day-pnl" class:neg={d.pnl < 0}
							>{d.pnl >= 0 ? '+' : '−'}{Math.abs(d.pnl).toFixed(2)} $</span
						>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</section>

<style>
	/* Переключатель периода — как на дашборде */
	.sets {
		display: flex;
		gap: var(--sp-xs);
		margin-bottom: var(--sp-lg);
	}
	.set-btn {
		padding: 0.35rem 0.9rem;
		font-family: var(--font-mono);
		font-size: 0.62rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
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
	.set-btn:hover {
		color: var(--ink);
		border-color: var(--line-strong);
	}
	.set-btn.active {
		color: var(--bg);
		background: var(--sage);
		border-color: var(--sage);
	}

	/* Карточки метрик — как KPI-сетка дашборда */
	.kpi-grid {
		position: relative;
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1px;
		background: var(--line);
		border: 1px solid var(--line);
		margin-bottom: var(--sp-xl);
	}
	.kpi {
		background: var(--bg);
		padding: var(--sp-md) var(--sp-lg);
	}
	.kpi-label {
		margin: 0;
		font-size: 0.66rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--ink-muted);
	}
	.kpi-value {
		margin: var(--sp-xs) 0 0;
		font-family: var(--font-display);
		font-size: 1.5rem;
		line-height: 1;
		letter-spacing: -0.02em;
	}

	.panel {
		background: var(--panel);
		border: 1px solid var(--line);
		border-radius: var(--radius-card);
		padding: clamp(18px, 2.4vw, 26px);
		display: flex;
		flex-direction: column;
		margin-bottom: var(--sp-xl);
	}
	.panel-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		padding-bottom: var(--sp-sm);
		border-bottom: 1px solid var(--line);
		margin-bottom: var(--sp-md);
	}
	.panel-title {
		margin: 0;
		font-family: var(--font-display);
		font-size: 1.05rem;
		font-weight: 400;
	}
	.eyebrow {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--ink-muted);
	}
	.panel-empty {
		margin: var(--sp-sm) 0;
		color: var(--ink-muted);
		font-size: 0.85rem;
	}

	.grid-2 {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--sp-lg);
	}

	/* Последние дни — компактные строки */
	.days {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.days li {
		display: flex;
		align-items: baseline;
		gap: var(--sp-md);
		padding: var(--sp-xs) 0;
		border-bottom: 1px solid var(--line);
		font-size: 0.8rem;
	}
	.days li:last-child {
		border-bottom: none;
	}
	.day-date {
		font-variant-numeric: tabular-nums;
	}
	.day-count {
		color: var(--ink-muted);
		font-size: 0.72rem;
	}
	.day-pnl {
		margin-left: auto;
		font-variant-numeric: tabular-nums;
	}
	.neg {
		color: #b4544f;
	}

	@media (max-width: 900px) {
		.kpi-grid {
			grid-template-columns: repeat(2, 1fr);
		}
		.grid-2 {
			grid-template-columns: 1fr;
		}
	}
</style>
