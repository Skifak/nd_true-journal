<script lang="ts">
	import { detectPlatform, isTauri } from '#lib/platform/index.ts';
	import { namespaced } from '#lib/storage/local.ts';
	import EquityChart from '#lib/components/EquityChart.svelte';
	import PanelToggle from '#lib/components/PanelToggle.svelte';

	// График: 2 состояния — компактный / развёрнутый (кнопка в шапке панели)
	const RATIO_COMPACT = 0.14;
	const RATIO_EXPANDED = 0.26;
	let chartExpanded = $state(false);

	// Демо-наборы данных для оценки графика (значения — % от старта, шкала 0..100)
	const CHART_DATASETS = [
		{
			id: 'smooth',
			label: 'ровный',
			values: [0, 8, 14, 21, 27, 34, 40, 47, 53, 61, 68, 74]
		},
		{
			id: 'volatile',
			label: 'волатильный',
			values: [12, 5, 28, 19, 44, 31, 58, 42, 71, 55, 88, 79]
		},
		{
			id: 'drawdown',
			label: 'просадка',
			values: [18, 34, 52, 66, 81, 74, 58, 41, 26, 33, 45, 62]
		}
	];
	let chartDataset = $state(0);

	const app = namespaced('ndtj:app:');

	let platform = $state(detectPlatform());
	let note = $state(app.get('note') ?? '');
	let saved = $state('');

	function save() {
		app.set('note', note);
		saved = 'сохранено';
		setTimeout(() => (saved = ''), 2500);
	}

	// KPI-метрики — демо-данные до подключения реального источника
	const kpis = [
		{ label: 'Баланс', value: '0,00 $', delta: null },
		{ label: 'Сделок за месяц', value: '0', delta: null },
		{ label: 'Winrate', value: '—', delta: null },
		{ label: 'Дисциплина', value: '—', delta: null }
	];

	// Демо-события до подключения реального журнала активности
	const activity = [
		{ icon: '＋', title: 'Журнал создан', time: 'только что' },
		{ icon: '◈', title: 'Платформа: ' + detectPlatform(), time: 'при запуске' },
		{ icon: '◇', title: 'Данные хранятся локально', time: 'постоянно' }
	];
</script>

<!-- KPI-сетка: плотная, с волосяными gap-px разделителями -->
<section class="kpi-grid" aria-label="Ключевые показатели (демо-данные)">
	<div class="demo-flag"><span class="eyebrow">демо-данные</span></div>
	{#each kpis as kpi}
		<div class="kpi">
			<p class="kpi-label">{kpi.label}</p>
			<p class="kpi-value">{kpi.value}</p>
		</div>
	{/each}
</section>

<section class="grid-2">
	<!-- График-заглушка: кривая equity на SVG -->
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
				<span class="eyebrow">демо · все сделки</span>
			</div>
		</div>
		<div class="chart-slot">
			<EquityChart
				values={CHART_DATASETS[chartDataset].values}
				yMin={0}
				yMax={100}
				forecast={null}
				heightRatio={chartExpanded ? RATIO_EXPANDED : RATIO_COMPACT}
			/>
		</div>
		<div class="chart-sets" role="group" aria-label="Наборы данных графика">
			{#each CHART_DATASETS as ds, i}
				<button
					type="button"
					class="set-btn"
					class:active={i === chartDataset}
					aria-pressed={i === chartDataset}
					onclick={() => (chartDataset = i)}>{ds.label}</button
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
			<span class="eyebrow">демо</span>
		</div>
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
			<li><span class="dot ok"></span>Сетевых вызовов нет</li>
			<li><span class="dot ok"></span>Данные не покидают устройство</li>
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
		margin-bottom: var(--sp-lg);
	}
	.demo-flag {
		position: absolute;
		top: 6px;
		right: 10px;
		opacity: 0.6;
		z-index: 1;
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
		gap: var(--sp-md);
		margin-bottom: var(--sp-lg);
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
