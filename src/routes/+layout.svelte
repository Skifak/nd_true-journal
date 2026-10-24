<script lang="ts">
	import '../app.css';
	import favicon from '#lib/assets/favicon.svg';
	import { page } from '$app/state';

	let { children } = $props();

	const nav = [
		{ idx: '01', label: 'Дашборд', path: '/' },
		{ idx: '02', label: 'Все сделки', path: '/trades' },
		{ idx: '03', label: 'AI', path: '/ai' },
		{ idx: '04', label: 'Настройки', path: '/settings' }
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
	<!-- Рейка: свёрнута по умолчанию, раскрывается по наведению/фокусу, скрывается при уходе курсора -->
	<aside class="sidebar" aria-label="Разделы">
		<a class="brand" href="/" title="true journal">
			<img class="logo" src={favicon} alt="" width="26" height="26" />
			<span class="brand-text">
				<span class="wordmark">TRUE JOURNAL</span>
				<span class="brand-sub">nd · офлайн</span>
			</span>
		</a>
		<nav>
			{#each nav as item (item.path)}
				<a class="nav-item" class:active={item.path === current.path} href={item.path} title={item.label}>
					{@render ico(item.path, 'nav-ico')}
					<span class="nav-label">{item.label}</span>
					<span class="nav-idx">{item.idx}</span>
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
			{@render ico(item.path)}
			<span>{item.label}</span>
		</a>
	{/each}
</nav>

<!-- Иконки разделов: line-иконки в стиле сайта (hairline, stroke 1.2) -->
{#snippet ico(path: string, cls: string = '')}
	<svg class={cls} viewBox="0 0 20 20" aria-hidden="true">
		{#if path === '/'}
			<path d="M2.5 10.5 8 5l3.5 3.5L17 3M17 3v5M17 3h-5" />
			<path d="M2.5 17h15" />
		{:else if path === '/trades'}
			<rect x="2.5" y="3.5" width="15" height="13" />
			<path d="M2.5 7.5h15M7.5 7.5v9" />
		{:else if path === '/ai'}
			<path d="M10 2.5v3M10 14.5v3M2.5 10h3M14.5 10h3M4.7 4.7l2.1 2.1M13.2 13.2l2.1 2.1M15.3 4.7l-2.1 2.1M6.8 13.2l-2.1 2.1" />
			<circle cx="10" cy="10" r="2.6" />
		{:else}
			<circle cx="10" cy="10" r="2.6" />
			<path d="M10 2.5v1.8M10 15.7v1.8M2.5 10h1.8M15.7 10h1.8M4.7 4.7l1.3 1.3M14 14l1.3 1.3M15.3 4.7 14 6M6 14l-1.3 1.3" />
		{/if}
	</svg>
{/snippet}

<style>
	.shell {
		min-height: 100dvh;
	}

	/* --- Сайдбар-рейка: 56px свёрнута, 240px по наведению (поверх контента) --- */
	.sidebar {
		--rail-w: 56px;
		--rail-w-open: 240px;
		position: fixed;
		top: 0;
		bottom: 0;
		left: 0;
		z-index: 30;
		width: var(--rail-w);
		background: var(--panel-solid);
		border-right: 1px solid var(--line);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		transition: width 180ms var(--ease-out);
	}
	.sidebar:hover,
	.sidebar:focus-within {
		width: var(--rail-w-open);
	}

	/* Шапка рейки — ровно в высоту топбара: одна линия с панелью */
	.brand {
		flex: none;
		height: var(--topbar-h);
		display: flex;
		align-items: center;
		gap: var(--sp-sm);
		padding: 0 15px;
		border-bottom: 1px solid var(--line);
		white-space: nowrap;
	}
	.logo {
		flex: none;
		width: 26px;
		height: 26px;
	}
	.brand-text {
		display: flex;
		flex-direction: column;
		min-width: 0;
		opacity: 0;
		transition: opacity 140ms var(--ease-out) 40ms;
	}
	.wordmark {
		font-family: var(--font-wordmark);
		font-size: 0.82rem;
		font-weight: 400;
		letter-spacing: 0.015em;
		opacity: 0.75;
	}
	.brand-sub {
		margin-top: 4px;
		font-family: var(--font-mono);
		font-size: 0.6rem;
		color: var(--ink-muted);
	}

	nav {
		padding: var(--sp-sm) 0;
		display: flex;
		flex-direction: column;
	}
	.nav-item {
		display: flex;
		align-items: center;
		gap: var(--sp-sm);
		padding: 9px 15px;
		font-size: 0.72rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--ink-muted);
		border-left: 2px solid transparent;
		white-space: nowrap;
		transition: color 200ms var(--ease-out), border-color 200ms var(--ease-out);
	}
	.nav-item:hover {
		color: var(--ink);
	}
	.nav-item.active {
		color: var(--ink);
		border-left-color: var(--accent);
	}
	.nav-ico {
		flex: none;
		width: 20px;
		height: 20px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.2;
		stroke-linecap: square;
	}
	.nav-label {
		opacity: 0;
		transition: opacity 140ms var(--ease-out) 40ms;
	}
	.nav-idx {
		margin-left: auto;
		font-size: 0.6rem;
		color: var(--accent);
		letter-spacing: 0.1em;
		opacity: 0;
		transition: opacity 140ms var(--ease-out) 40ms;
	}
	.sidebar:hover .brand-text,
	.sidebar:focus-within .brand-text,
	.sidebar:hover .nav-label,
	.sidebar:focus-within .nav-label,
	.sidebar:hover .nav-idx,
	.sidebar:focus-within .nav-idx {
		opacity: 1;
	}

	.sidebar-foot {
		margin-top: auto;
		padding: var(--sp-md) 15px;
		border-top: 1px solid var(--line);
		white-space: nowrap;
		opacity: 0;
		transition: opacity 140ms var(--ease-out) 40ms;
	}
	.sidebar:hover .sidebar-foot,
	.sidebar:focus-within .sidebar-foot {
		opacity: 1;
	}

	/* --- Контент: постоянный отступ под рейку, панель поверх при раскрытии --- */
	.content {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		padding-left: 56px;
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
		background: var(--panel-solid);
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
		.content {
			padding-left: 0;
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
