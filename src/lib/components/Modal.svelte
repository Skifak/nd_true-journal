<script lang="ts">
	import { fade } from 'svelte/transition';
	import type { Snippet } from 'svelte';

	interface Props {
		open?: boolean;
		title?: string;
		subtitle?: string;
		size?: 'sm' | 'md' | 'lg' | 'xl';
		closable?: boolean;
		closeOnBackdrop?: boolean;
		closeOnEscape?: boolean;
		onClose?: () => void;
		header?: Snippet;
		children?: Snippet;
		footer?: Snippet;
	}

	let {
		open = $bindable(false),
		title = '',
		subtitle = '',
		size = 'md',
		closable = true,
		closeOnBackdrop = true,
		closeOnEscape = true,
		onClose = () => {},
		header,
		children,
		footer
	}: Props = $props();

	const WIDTHS: Record<string, string> = { sm: '400px', md: '680px', lg: '860px', xl: '1040px' };

	let dialogEl = $state<HTMLDivElement | null>(null);
	let backdropEl = $state<HTMLDivElement | null>(null);
	let opener: HTMLElement | null = null;

	const titleId = $props.id();

	function close() {
		open = false;
		onClose();
	}

	// Escape + ловушка фокуса + блокировка прокрутки
	$effect(() => {
		if (!open) return;

		opener = document.activeElement as HTMLElement | null;

		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape' && closeOnEscape) {
				e.preventDefault();
				close();
				return;
			}
			if (e.key !== 'Tab' || !dialogEl) return;
			const focusables = dialogEl.querySelectorAll(
				'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
			);
			if (!focusables.length) return;
			const first = focusables[0] as HTMLElement;
			const last = focusables[focusables.length - 1] as HTMLElement;
			if (e.shiftKey && document.activeElement === first) {
				e.preventDefault();
				last.focus();
			} else if (!e.shiftKey && document.activeElement === last) {
				e.preventDefault();
				first.focus();
			}
		};

		const prevOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		window.addEventListener('keydown', onKey);

		// Фокус на первый интерактивный элемент (или на диалог)
		queueMicrotask(() => {
			const target = dialogEl?.querySelector(
				'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])'
			);
			(target as HTMLElement | null)?.focus?.();
		});

		return () => {
			window.removeEventListener('keydown', onKey);
			document.body.style.overflow = prevOverflow;
			opener?.focus?.();
		};
	});

	function onBackdropClick(e: MouseEvent) {
		if (!closeOnBackdrop) return;
		if (e.target === backdropEl) close();
	}
</script>

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
	<div
		class="scrim"
		bind:this={backdropEl}
		role="presentation"
		onclick={onBackdropClick}
		transition:fade={{ duration: 140 }}
	>
		<div
			class="dialog"
			bind:this={dialogEl}
			role="dialog"
			aria-modal="true"
			aria-labelledby={title ? titleId : undefined}
			tabindex="-1"
			style:max-width={WIDTHS[size] ?? WIDTHS.md}
		>
			<header class="head">
				{#if header}
					{@render header()}
				{:else}
					<div class="titles">
						<h2 id={titleId}>{title}</h2>
						{#if subtitle}<p class="sub">{subtitle}</p>{/if}
					</div>
				{/if}
				{#if closable}
					<button type="button" class="x" onclick={close} aria-label="Закрыть">✕</button>
				{/if}
			</header>

			<div class="body">
				{@render children?.()}
			</div>

			{#if footer}
				<footer class="foot">
					{@render footer()}
				</footer>
			{/if}
		</div>
	</div>
{/if}

<style>
	/* Плоский документ: непрозрачная подложка, без стекла и blur */
	.scrim {
		position: fixed;
		inset: 0;
		z-index: 60;
		/* точечный паттерн вместо сплошного фона (4px сетка) + мягкое осветление/блюр страницы под ним */
		background-color: color-mix(in srgb, var(--scrim) 30%, transparent);
		background-image: radial-gradient(transparent 1.5px, var(--scrim) 1.5px);
		background-size: 10px 10px;
		backdrop-filter: brightness(1.15) blur(8px) saturate(1.1);
		display: grid;
		place-items: center;
		padding: 1.5rem;
		overflow: auto;
	}
	.dialog {
		position: relative;
		width: 100%;
		max-height: 88dvh;
		display: flex;
		flex-direction: column;
		background: var(--panel-solid);
		border: 1px solid var(--line-strong);
		border-radius: 2px;
		box-shadow:
			0 0 0 1px var(--bg),
			0 18px 48px -24px #000;
		outline: none;
	}
	/* Угловые марки — язык frame-hover */
	.dialog::before,
	.dialog::after {
		content: '';
		position: absolute;
		width: 12px;
		height: 12px;
		border: 0 solid var(--line-strong);
		pointer-events: none;
	}
	.dialog::before {
		top: -1px;
		left: -1px;
		border-top-width: 1.5px;
		border-left-width: 1.5px;
	}
	.dialog::after {
		bottom: -1px;
		right: -1px;
		border-bottom-width: 1.5px;
		border-right-width: 1.5px;
	}

	.head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.8rem;
		padding: 1.05rem 1.2rem 0.9rem;
		border-bottom: 1px solid var(--line);
		flex-shrink: 0;
	}
	.titles h2 {
		font-family: var(--font-display);
		font-size: 1.45rem;
		font-weight: 400;
		letter-spacing: -0.02em;
		line-height: 1.1;
	}
	.sub {
		margin-top: 0.3rem;
		font-family: var(--font-mono);
		font-size: 0.66rem;
		letter-spacing: 0.06em;
		color: var(--ink-muted);
	}
	.x {
		flex-shrink: 0;
		width: 22px;
		height: 22px;
		display: grid;
		place-items: center;
		font-size: 0.72rem;
		color: var(--ink-muted);
		background: transparent;
		border: 1px solid transparent;
		border-radius: 2px;
		cursor: pointer;
		transition:
			color 0.2s,
			border-color 0.2s;
	}
	.x:hover {
		color: var(--ink);
		border-color: var(--line-strong);
	}
	.x:focus-visible {
		outline: 1px solid var(--accent);
		outline-offset: 1px;
	}

	.body {
		padding: 1rem 1.2rem;
		overflow: auto;
		flex: 1;
		min-height: 0;
	}

	.foot {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.8rem 1.2rem 1rem;
		border-top: 1px solid var(--line);
		flex-shrink: 0;
	}
</style>
