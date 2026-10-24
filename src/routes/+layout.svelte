<script>
	import '../app.css';
	import favicon from '#lib/assets/favicon.svg';
	import { page } from '$app/state';

	let { children } = $props();

	const nav = [
		{ idx: '01', label: 'Дашборд', path: '/' },
		{ idx: '02', label: 'Все сделки', path: '/trades' }
	];

	const current = $derived(nav.find((n) => n.path === page.url.pathname) ?? nav[0]);

	// Живая дата в топбаре (обновляется раз в минуту)
	let now = $state(new Date());
	$effect(() => {
		const t = setInterval(() => (now = new Date()), 60_000);
		return () => clearInterval(t);
	});
	const dateLabel = $derived(
		now.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'long' })
	);
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
			<span class="topbar-right eyebrow">{dateLabel}</span>
		</header>
		<main>
			{@render children()}
		</main>
	</div>
</div>

<!-- Мобильная навигация: SVG-иконки в стиле сайта (line-иконки, hairline) -->
<nav class="tabbar" aria-label="Разделы">
	{#each nav as item (item.path)}
		<a
			class="tab"
			class:active={item.path === current.path}
			href={item.path}
			aria-current={item.path === current.path ? 'page' : undefined}
		>
			{#if item.path === '/'}
				<svg viewBox="0 0 20 20" aria-hidden="true">
					<path d="M2.5 10.5 8 5l3.5 3.5L17 3M17 3v5M17 3h-5" />
					<path d="M2.5 17h15" />
				</svg>
			{:else}
				<svg viewBox="0 0 20 20" aria-hidden="true">
					<rect x="2.5" y="3.5" width="15" height="13" />
					<path d="M2.5 7.5h15M7.5 7.5v9" />
				</svg>
			{/if}
			<span>{item.label}</span>
		</a>
	{/each}
</nav>

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
		height: var(--topbar-h);
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

	/* --- Мобильный таб-бар --- */
	.tabbar {
		display: none;
	}

	@media (max-width: 760px) {
		.sidebar {
			display: none;
		}
		main {
			padding: var(--sp-md) var(--sp-sm) calc(var(--tabbar-h) + var(--sp-md));
		}
		.tabbar {
			position: fixed;
			left: 0;
			right: 0;
			bottom: 0;
			z-index: 20;
			display: flex;
			height: var(--tabbar-h);
			background: var(--panel-solid);
			border-top: 1px solid var(--line);
			padding-bottom: env(safe-area-inset-bottom);
		}
		.tab {
			flex: 1;
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			gap: 3px;
			font-family: var(--font-mono);
			font-size: 0.56rem;
			letter-spacing: 0.12em;
			text-transform: uppercase;
			color: var(--ink-muted);
		}
		.tab svg {
			width: 20px;
			height: 20px;
			fill: none;
			stroke: currentColor;
			stroke-width: 1.2;
			stroke-linecap: square;
		}
		.tab.active {
			color: var(--sage);
		}
	}
</style>
