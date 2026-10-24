<script>
	import { detectPlatform, isTauri } from '#lib/platform/index.js';
	import { namespaced } from '#lib/storage/local.js';

	const app = namespaced('ndtj:app:');

	let platform = $state(detectPlatform());
	let note = $state(app.get('note') ?? '');
	let saved = $state('');

	function save() {
		app.set('note', note);
		saved = 'сохранено';
		setTimeout(() => (saved = ''), 2500);
	}

	// KPI-метрики (пока демо-значения, дальше — из реальных сделок)
	const kpis = [
		{ label: 'Баланс', value: '0,00 $', delta: null },
		{ label: 'Сделок за месяц', value: '0', delta: null },
		{ label: 'Winrate', value: '—', delta: null },
		{ label: 'Дисциплина', value: '—', delta: null }
	];

	const activity = [
		{ icon: '＋', title: 'Журнал создан', time: 'только что' },
		{ icon: '◈', title: 'Платформа: ' + detectPlatform(), time: 'при запуске' },
		{ icon: '◇', title: 'Данные хранятся локально', time: 'постоянно' }
	];
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
	<!-- График-заглушка: кривая equity на SVG -->
	<div class="panel">
		<div class="panel-head">
			<h2 class="panel-title">Кривая капитала</h2>
			<span class="eyebrow">все сделки</span>
		</div>
		<div class="empty">
			<svg viewBox="0 0 200 60" class="spark" aria-hidden="true">
				<line x1="0" y1="30" x2="200" y2="30" stroke="var(--line)" stroke-dasharray="2 4" />
				<path d="M0 30 C 30 26, 50 34, 80 30 S 140 24, 200 30" fill="none" stroke="var(--sage)" stroke-width="1" opacity="0.6" />
			</svg>
			<p class="empty-title">Пока пусто</p>
			<p class="empty-desc">Добавьте первую сделку — кривая начнёт рисоваться.</p>
		</div>
	</div>

	<!-- Заметка дня -->
	<div class="panel">
		<div class="panel-head">
			<h2 class="panel-title">Заметка дня</h2>
			<span class="eyebrow">локально</span>
		</div>
		<textarea bind:value={note} rows="4" placeholder="Что важно запомнить с сегодняшней сессии…"></textarea>
		<div class="row">
			<button class="btn" onclick={save}>Сохранить</button>
			{#if saved}<span class="hint">↳ {saved}</span>{/if}
		</div>
	</div>
</section>

<section class="grid-2">
	<!-- Активность -->
	<div class="panel">
		<div class="panel-head">
			<h2 class="panel-title">Активность</h2>
			<span class="eyebrow">последние события</span>
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
	<div class="panel">
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
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1px;
		background: var(--line);
		border: 1px solid var(--line);
		margin-bottom: var(--sp-lg);
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

	.empty {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		padding: var(--sp-xl) 0;
	}
	.spark {
		width: 200px;
		height: 60px;
		margin-bottom: var(--sp-md);
	}
	.empty-title {
		font-family: var(--font-display);
		font-size: 1.35rem;
		margin: 0;
	}
	.empty-desc {
		margin: var(--sp-xs) 0 0;
		font-size: 0.8rem;
		color: var(--ink-muted);
		max-width: 34ch;
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
	.btn {
		background: transparent;
		border: none;
		border-bottom: 1px solid var(--accent);
		border-radius: 0;
		color: var(--ink);
		font-size: 0.72rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		padding: 10px 0;
		transition: color 250ms var(--ease-out);
	}
	.btn:hover {
		color: #fff;
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
</style>
