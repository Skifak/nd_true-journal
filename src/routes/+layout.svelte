<script>
	import '../app.css';
	import favicon from '#lib/assets/favicon.svg';
	import { page } from '$app/state';

	let { children } = $props();

	const nav = [
		{ idx: '01', label: 'Дашборд', path: '/' },
		{ idx: '02', label: 'Все сделки', path: '/trades' },
		{ idx: '03', label: 'Заметки', path: '/notes' }
	];

	const current = $derived(nav.find((n) => n.path === page.url.pathname) ?? nav[0]);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="shell">
	<aside class="sidebar">
		<div class="brand">
			<span class="wordmark">TRUE JOURNAL</span>
			<span class="brand-sub">nd · офлайн</span>
		</div>
		<nav>
			{#each nav as item (item.path)}
				<a class="nav-item" class:active={item.path === current.path} href={item.path}>
					<span class="nav-idx">{item.idx}</span>
					<span class="nav-label">{item.label}</span>
				</a>
			{/each}
		</nav>
		<div class="sidebar-foot">
			<span class="eyebrow">v0.1</span>
		</div>
	</aside>

	<div class="content">
		<header class="topbar">
			<span class="breadcrumb">
				<span class="nav-idx">{current.idx} ／</span>
				{current.label}
			</span>
			<span class="topbar-right eyebrow">{new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'long' })}</span>
		</header>
		<main>
			{@render children()}
		</main>
	</div>
</div>

<style>
	.shell {
		display: flex;
		min-height: 100dvh;
	}

	/* --- Сайдбар --- */
	.sidebar {
		width: 224px;
		flex-shrink: 0;
		border-right: 1px solid var(--line);
		display: flex;
		flex-direction: column;
		position: sticky;
		top: 0;
		height: 100dvh;
	}
	.brand {
		padding: var(--sp-lg) var(--sp-md);
		border-bottom: 1px solid var(--line);
	}
	.wordmark {
		font-family: var(--font-wordmark);
		font-size: 0.82rem;
		font-weight: 400;
		letter-spacing: 0.015em;
		opacity: 0.75;
		display: block;
	}
	.brand-sub {
		display: block;
		margin-top: 4px;
	}
	nav {
		padding: var(--sp-sm) var(--sp-xs);
		display: flex;
		flex-direction: column;
	}
	.nav-item {
		display: flex;
		align-items: baseline;
		gap: var(--sp-sm);
		padding: 9px 12px;
		font-size: 0.72rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--ink-muted);
		border-left: 2px solid transparent;
		transition: color 200ms var(--ease-out), border-color 200ms var(--ease-out), padding-left 200ms var(--ease-out);
	}
	.nav-item:hover {
		color: var(--ink);
		padding-left: 14px;
	}
	.nav-item.active {
		color: var(--ink);
		border-left-color: var(--accent);
	}
	.nav-idx {
		font-size: 0.6rem;
		color: var(--accent);
		letter-spacing: 0.1em;
	}
	.sidebar-foot {
		margin-top: auto;
		padding: var(--sp-md);
		border-top: 1px solid var(--line);
	}

	/* --- Контент --- */
	.content {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.topbar {
		position: sticky;
		top: 0;
		z-index: 10;
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 52px;
		padding: 0 var(--sp-lg);
		border-bottom: 1px solid var(--line);
		background: rgba(22, 24, 25, 0.92);
	}
	.breadcrumb {
		font-size: 0.72rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		display: flex;
		align-items: baseline;
		gap: var(--sp-sm);
	}
	main {
		flex: 1;
		padding: var(--sp-lg);
	}

	@media (max-width: 760px) {
		.sidebar {
			display: none;
		}
	}
</style>
