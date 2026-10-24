<script>
	/**
	 * Переключатель из двух состояний для шапок панелей.
	 * Переиспользуемый: работает с любым блоком через bind:expanded.
	 *
	 *   <SizeToggle bind:expanded={chartExpanded} />
	 *
	 * Иконка: развёрнуто — «свернуть» (две стрелки внутрь),
	 * свёрнуто — «развернуть» (две стрелки наружу).
	 * @type {{
	 *   expanded?: boolean,
	 *   labelExpand?: string,
	 *   labelCollapse?: string,
	 *   title?: string
	 * }}
	 */
	let {
		expanded = $bindable(false),
		labelExpand = 'Развернуть',
		labelCollapse = 'Свернуть',
		title = ''
	} = $props();
</script>

<button
	type="button"
	class="toggle"
	class:is-open={expanded}
	aria-expanded={expanded}
	aria-label={expanded ? labelCollapse : labelExpand}
	title={title || (expanded ? labelCollapse : labelExpand)}
	onclick={() => (expanded = !expanded)}
>
	<svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">
		{#if expanded}
			<!-- свернуть: стрелки внутрь -->
			<path d="M4.5 1.5v3h-3M7.5 10.5v-3h3" />
			<path d="M1.5 1.5l3 3M10.5 10.5l-3-3" />
		{:else}
			<!-- развернуть: стрелки наружу -->
			<path d="M1.5 4.5v-3h3M10.5 7.5v3h-3" />
			<path d="M1.5 1.5l3 3M10.5 10.5l-3-3" />
		{/if}
	</svg>
</button>

<style>
	.toggle {
		width: 18px;
		height: 18px;
		display: grid;
		place-items: center;
		padding: 0;
		color: var(--ink-muted);
		background: transparent;
		border: 1px solid var(--line);
		border-radius: 2px;
		cursor: pointer;
		transition:
			color 0.2s,
			border-color 0.2s;
	}
	.toggle:hover {
		color: var(--ink);
		border-color: var(--line-strong);
	}
	.toggle:focus-visible {
		outline: 1px solid var(--accent);
		outline-offset: 2px;
	}
	svg {
		width: 10px;
		height: 10px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.3;
		stroke-linecap: square;
		transition: transform 0.25s var(--ease-out);
	}
	.toggle:hover svg {
		transform: scale(1.08);
	}
</style>
