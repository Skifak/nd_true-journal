<script>
	import { detectPlatform, isTauri } from '#lib/platform/index.js';
	import { namespaced } from '#lib/storage/local.js';

	const app = namespaced('ndtj:app:');

	let platform = $state(detectPlatform());
	let note = $state(app.get('note') ?? '');
	let saved = $state('');

	function save() {
		app.set('note', note);
		saved = 'сохранено локально';
	}
</script>

<main>
	<h1>nd true journal</h1>
	<p class="badge">платформа: {platform}{isTauri() ? ' (нативная оболочка)' : ' (браузер)'}</p>

	<section>
		<h2>Локальное хранилище</h2>
		<textarea bind:value={note} rows="4" placeholder="Заметка хранится только локально"></textarea>
		<div class="row">
			<button onclick={save}>Сохранить</button>
			{#if saved}<span class="hint">{saved}</span>{/if}
		</div>
	</section>

	<section>
		<h2>Принципы</h2>
		<ul>
			<li>ноль рантайм-зависимостей в npm (только dev-инструменты)</li>
			<li>строгая CSP, connect-src 'none' — сетевых запросов из UI нет</li>
			<li>файловый доступ только через песочницу AppData (валидация путей в Rust)</li>
			<li>данные не покидают устройство</li>
		</ul>
	</section>
</main>

<style>
	main {
		max-width: 640px;
		margin: 3rem auto;
		padding: 0 1rem;
		font-family: system-ui, sans-serif;
	}
	h1 {
		font-size: 1.6rem;
	}
	.badge {
		color: #555;
		font-size: 0.85rem;
	}
	section {
		margin-top: 2rem;
	}
	textarea {
		width: 100%;
		box-sizing: border-box;
		font: inherit;
	}
	.row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-top: 0.5rem;
	}
	.hint {
		color: #2a7;
		font-size: 0.85rem;
	}
</style>
