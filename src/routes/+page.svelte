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
</script>

<div class="frame">
	<header>
		<span class="wordmark">TRUE JOURNAL</span>
		<span class="eyebrow">офлайн · без серверов</span>
	</header>

	<main>
		<section class="hero">
			<h1>Тихий журнал<br /><em>для громкой торговли</em></h1>
			<p class="lead">
				Ваши сделки не покидают устройство. Ни аккаунтов, ни облака, ни слежки —
				только ты и записи.
			</p>
			<div class="hero-meta">
				<span class="badge">v0.1</span>
				<span class="badge">{platform}{isTauri() ? ' · нативно' : ' · браузер'}</span>
			</div>
		</section>

		<section class="quick">
			<div class="card">
				<p class="card-label">01 ／ заметка дня</p>
				<textarea bind:value={note} rows="3" placeholder="Что важно запомнить с сегодняшней сессии…"></textarea>
				<div class="row">
					<button class="btn" onclick={save}>Сохранить</button>
					{#if saved}<span class="hint">{saved} локально</span>{/if}
				</div>
			</div>

			<div class="card">
				<p class="card-label">02 ／ принципы</p>
				<ul>
					<li>ноль рантайм-зависимостей</li>
					<li>данные не покидают устройство</li>
					<li>файлы — только в песочнице приложения</li>
					<li>строгая CSP, сетевых вызовов нет</li>
				</ul>
			</div>
		</section>
	</main>

	<footer>
		<span class="eyebrow">nd true journal ／ 01</span>
	</footer>
</div>

<style>
	.frame {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		max-width: 1120px;
		margin: 0 auto;
		padding: clamp(20px, 5vw, 48px);
	}

	header {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		padding-bottom: var(--sp-lg);
		border-bottom: 1px solid var(--line);
	}
	.wordmark {
		font-family: var(--font-wordmark);
		font-size: 0.95rem;
		font-weight: 400;
		letter-spacing: 0.015em;
		opacity: 0.7;
	}

	main {
		flex: 1;
	}

	.hero {
		padding-block: clamp(48px, 9vh, 104px);
		max-width: 16ch;
	}
	h1 {
		font-size: clamp(2.6rem, 6.5vw, 5.4rem);
		line-height: 0.95;
		letter-spacing: -0.045em;
	}
	h1 em {
		font-style: italic;
		color: var(--ink-muted);
	}
	.lead {
		max-width: 46ch;
		color: var(--ink-muted);
		margin: var(--sp-xl) 0 0;
		font-size: 0.95rem;
		line-height: 1.7;
	}
	.hero-meta {
		display: flex;
		gap: var(--sp-sm);
		margin-top: var(--sp-lg);
	}

	.quick {
		display: grid;
		grid-template-columns: 1.1fr 0.9fr;
		gap: var(--sp-md);
		padding-bottom: clamp(48px, 9vh, 104px);
		border-top: 1px solid var(--line);
		padding-top: var(--sp-lg);
	}
	.card-label {
		font-size: 0.64rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--ink-muted);
		margin: 0 0 var(--sp-md);
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
		letter-spacing: 0.08em;
	}
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		padding: var(--sp-xs) 0;
		border-bottom: 1px solid var(--line);
		color: var(--ink-muted);
		font-size: 0.88rem;
	}
	li::before {
		content: '·';
		color: var(--accent);
		margin-right: var(--sp-sm);
	}
	li:last-child {
		border-bottom: none;
	}

	footer {
		padding-top: var(--sp-lg);
		border-top: 1px solid var(--line);
	}

	@media (max-width: 640px) {
		.quick {
			grid-template-columns: 1fr;
		}
	}
</style>
