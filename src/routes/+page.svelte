<script lang="ts">
	import { detectPlatform, isTauri } from '#lib/platform/index.ts';
	import { aiState } from '#lib/ai/store.svelte.ts';
	import { namespaced } from '#lib/storage/local.ts';
	import { getTrades, initJournal, journalState } from '#lib/storage/journalStore.svelte.ts';
	import { equityCurve } from '#lib/domain/journal.ts';
	import { formatMoney, parseStamp, tradeProfit } from '#lib/domain/trades.ts';
	import EquityChart from '#lib/components/EquityChart.svelte';
	import PanelToggle from '#lib/components/PanelToggle.svelte';

	const app = namespaced('ndtj:app:');

	// График: 2 состояния — компактный / развёрнутый (кнопка в шапке панели)
	const RATIO_COMPACT = 0.14;
	const RATIO_EXPANDED = 0.26;
	let chartExpanded = $state(app.get('chartExpanded') === '1');
	$effect(() => app.set('chartExpanded', chartExpanded ? '1' : '0'));

	// Периоды: окно в днях от текущего дня; null — вся история
	const RANGES = [
		{ id: 'week', label: 'Неделя', days: 7 },
		{ id: 'month', label: 'Месяц', days: 30 },
		{ id: 'quarter', label: 'Квартал', days: 90 },
		{ id: 'year', label: 'Год', days: 365 },
		{ id: 'all', label: 'Вся история', days: null }
	] as const;
	// Сохранённый период; неизвестный id или первый запуск → вся история
	const DEFAULT_RANGE = RANGES.length - 1;
	const savedRangeIdx = RANGES.findIndex((r) => r.id === app.get('range'));
	let rangeIdx = $state(savedRangeIdx < 0 ? DEFAULT_RANGE : savedRangeIdx);
	$effect(() => app.set('range', RANGES[rangeIdx].id));

	let allTrades = $derived(getTrades());

	// Граница выбранного периода — одна для графика и KPI
	const since = $derived.by(() => {
		const days = RANGES[rangeIdx].days;
		return days == null ? undefined : Date.now() - days * 86_400_000;
	});

	const periodTrades = $derived(
		since == null
			? allTrades
			: allTrades.filter(
					(t) => (parseStamp(t.dateClose || t.dateOpen)?.getTime() ?? 0) >= since
				)
	);

	let curve = $derived(equityCurve(allTrades, 0, since));
	const rangeEmpty = $derived(curve.values.length < 2);

	initJournal();

	let platform = $state(detectPlatform());
	let note = $state(app.get('note') ?? '');
	let saved = $state('');

	function save() {
		app.set('note', note);
		saved = 'сохранено';
		setTimeout(() => (saved = ''), 2500);
	}

	// KPI-метрики — по сделкам выбранного периода
	const kpis = $derived.by(() => {
		const trades = periodTrades;
		const balance = trades.reduce((sum, t) => sum + tradeProfit(t), 0);
		const decided = trades.filter((t) => t.status === 'closed' && tradeProfit(t) !== 0);
		const wins = decided.filter((t) => tradeProfit(t) > 0).length;

		return [
			{ label: 'Баланс', value: trades.length ? formatMoney(balance, 'USD', true) : '—' },
			{ label: 'Сделок', value: String(trades.length) },
			{
				label: 'Winrate',
				value: decided.length ? Math.round((wins / decided.length) * 100) + '%' : '—'
			},
			{ label: 'Сделок всего', value: String(allTrades.length) }
		];
	});

	// Лента активности — реальный журнал: последние сделки
	const activity = $derived.by(() =>
		[...allTrades]
			.sort(
				(a, b) =>
					(parseStamp(b.dateClose || b.dateOpen)?.getTime() ?? 0) -
					(parseStamp(a.dateClose || a.dateOpen)?.getTime() ?? 0)
			)
			.slice(0, 5)
			.map((t) => ({
				icon: t.direction === 'short' ? '↓' : '↑',
				title: `${t.pair} · ${t.volume} лот · ${tradeProfit(t) >= 0 ? '+' : '−'}${formatMoney(Math.abs(tradeProfit(t)))}`,
				time: parseStamp(t.dateClose || t.dateOpen)?.toISOString().slice(0, 10) ?? ''
			}))
	);
</script>

<!-- KPI-сетка: плотная, с волосяными gap-px разделителями -->
<section class="kpi-grid" aria-label="Ключевые показатели">
	{#each kpis as kpi}
		<div class="kpi">
			<p class="kpi-label">{kpi.label}</p>
			<p class="kpi-value">{kpi.value}</p>
		</div>
	{/each}
</section>

<section class="grid-2">
	<!-- График: кривая капитала -->
	<div class="panel frame-hover">
		<span class="fh-c fh-tl" aria-hidden="true"></span>
		<span class="fh-c fh-tr" aria-hidden="true"></span>
		<span class="fh-c fh-bl" aria-hidden="true"></span>
		<span class="fh-c fh-br" aria-hidden="true"></span>
		<div class="panel-head">
			<h2 class="panel-title">Кривая капитала</h2>
			<div class="head-tools">
				<PanelToggle
					bind:expanded={chartExpanded}
					labelExpand="Развернуть график"
					labelCollapse="Свернуть график"
				/>
				<span class="eyebrow">{journalState.count} сделок</span>
			</div>
		</div>
		<div class="chart-slot">
			{#if rangeEmpty}
				<p class="chart-empty">
					{journalState.loading ? 'Загрузка…' : 'Нет закрытых сделок за период'}
				</p>
			{:else}
				<EquityChart
					{curve}
					heightRatio={chartExpanded ? RATIO_EXPANDED : RATIO_COMPACT}
				/>
			{/if}
		</div>
		<div class="chart-sets" role="group" aria-label="Период графика">
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
	</div>

	<!-- Заметка дня -->
	<div class="panel frame-hover">
		<span class="fh-c fh-tl" aria-hidden="true"></span>
		<span class="fh-c fh-tr" aria-hidden="true"></span>
		<span class="fh-c fh-bl" aria-hidden="true"></span>
		<span class="fh-c fh-br" aria-hidden="true"></span>
		<div class="panel-head">
			<h2 class="panel-title">Заметка дня</h2>
			<span class="eyebrow">локально</span>
		</div>
		<textarea bind:value={note} rows="4" placeholder="Что важно запомнить с сегодняшней сессии…"></textarea>
		<div class="row">
			<button class="text-link" onclick={save}>Сохранить</button>
			{#if saved}<span class="hint">↳ {saved}</span>{/if}
		</div>
	</div>
</section>

<section class="grid-2">
	<!-- Активность -->
	<div class="panel frame-hover">
		<span class="fh-c fh-tl" aria-hidden="true"></span>
		<span class="fh-c fh-tr" aria-hidden="true"></span>
		<span class="fh-c fh-bl" aria-hidden="true"></span>
		<span class="fh-c fh-br" aria-hidden="true"></span>
		<div class="panel-head">
			<h2 class="panel-title">Активность</h2>
			<span class="eyebrow">последние сделки</span>
		</div>
		{#if activity.length}
			<ul class="feed">
				{#each activity as a}
					<li>
						<span class="feed-icon">{a.icon}</span>
						<span class="feed-body">
							<span class="feed-title">{a.title}</span>
							<span class="feed-time">{a.time}</span>
						</span>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="panel-empty">Сделок пока нет</p>
		{/if}
	</div>

	<!-- Состояние системы -->
	<div class="panel frame-hover">
		<span class="fh-c fh-tl" aria-hidden="true"></span>
		<span class="fh-c fh-tr" aria-hidden="true"></span>
		<span class="fh-c fh-bl" aria-hidden="true"></span>
		<span class="fh-c fh-br" aria-hidden="true"></span>
		<div class="panel-head">
			<h2 class="panel-title">Состояние</h2>
			<span class="eyebrow">безопасность</span>
		</div>
		<ul class="status-list">
			<li><span class="dot ok"></span>Журнал: сетевых вызовов нет</li>
			{#if aiState.keyReady}
				<li><span class="dot warn"></span>AI: прямые запросы к поставщику, без прокси</li>
			{:else}
				<li><span class="dot ok"></span>Данные не покидают устройство</li>
			{/if}
			<li><span class="dot ok"></span>Файлы — только в песочнице приложения</li>
			<li><span class="dot"></span>Платформа: {platform}{isTauri() ? ' (нативная оболочка)' : ''}</li>
		</ul>
	</div>
</section>

<style>
	/* KPI: сетка с 1px-зазорами, залитыми линией */
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
		font-size: 1.9rem;
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
	}
	.panel-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		padding-bottom: var(--sp-sm);
		border-bottom: 1px solid var(--line);
		margin-bottom: var(--sp-md);
	}
	.head-tools {
		display: flex;
		align-items: center;
		gap: var(--sp-sm);
	}
	.chart-slot {
		transition: opacity 0.3s var(--ease-out, ease);
	}
	.chart-empty {
		margin: 0;
		padding: 2.5rem 0;
		text-align: center;
		font-family: var(--font-mono);
		font-size: 0.7rem;
		letter-spacing: 0.06em;
		color: var(--ink-muted);
	}
	.chart-sets {
		display: flex;
		gap: 1px;
		margin-top: var(--sp-sm);
		border-top: 1px solid var(--line);
		padding-top: var(--sp-sm);
	}
	.set-btn {
		flex: 1;
		padding: 0.35rem 0.5rem;
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
	.set-btn:focus-visible {
		outline: 1px solid var(--accent);
		outline-offset: 2px;
	}
	.panel-title {
		font-size: 1.35rem;
		letter-spacing: -0.02em;
	}

	.grid-2 {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--sp-xl);
		margin-bottom: var(--sp-xl);
	}

	textarea {
		width: 100%;
		background: transparent;
		border: 1px solid var(--line);
		border-radius: var(--radius-hairline);
		color: var(--ink);
		font: inherit;
		resize: vertical;
		padding: var(--sp-sm);
	}
	textarea:focus {
		outline: none;
		border-color: var(--line-strong);
	}
	.row {
		display: flex;
		align-items: center;
		gap: var(--sp-md);
		margin-top: var(--sp-md);
	}
	.hint {
		font-size: 0.72rem;
		color: var(--status-green);
	}

	.panel-empty {
		margin: 0;
		padding: 2rem 0;
		font-family: var(--font-mono);
		font-size: 0.7rem;
		letter-spacing: 0.06em;
		color: var(--ink-muted);
	}

	.feed {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.feed li {
		display: flex;
		align-items: center;
		gap: var(--sp-md);
		padding: var(--sp-sm) 0;
		border-bottom: 1px solid var(--line);
	}
	.feed li:last-child {
		border-bottom: none;
	}
	.feed-icon {
		flex-shrink: 0;
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--line);
		border-radius: 9999px;
		color: var(--ink-muted);
		font-size: 0.9rem;
	}
	.feed-body {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.feed-title {
		font-size: 0.88rem;
	}
	.feed-time {
		font-size: 0.72rem;
		color: var(--ink-muted);
	}

	.status-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.status-list li {
		display: flex;
		align-items: center;
		gap: var(--sp-sm);
		padding: var(--sp-xs) 0;
		font-size: 0.86rem;
		color: var(--ink-muted);
	}
	.dot {
		width: 6px;
		height: 6px;
		border-radius: 9999px;
		background: var(--line-strong);
		flex-shrink: 0;
	}
	.dot.ok {
		background: var(--status-green);
	}
	.dot.warn {
		background: var(--status-amber);
	}

	@media (max-width: 900px) {
		.kpi-grid {
			grid-template-columns: repeat(2, 1fr);
		}
		.grid-2 {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 760px) {
		.chart-sets {
			flex-wrap: wrap;
		}
	}
</style>
