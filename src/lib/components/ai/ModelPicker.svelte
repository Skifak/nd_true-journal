<script lang="ts">
	/**
	 * Селектор модели: плашка-триггер + popup с левым рельсом провайдеров
	 * (иконки), поиском по всем провайдерам, списком моделей и сегментным
	 * треком «Мышление». Порт React-компонента ModelPicker на Svelte 5.
	 */
	import { fade } from 'svelte/transition';
	import {
		aiState,
		effectiveBaseUrl,
		setModel,
		setThinking,
		refreshModels
	} from '#lib/ai/store.svelte.ts';
	import { modelFamily, providerTitle, supportsThinking, isAnthropicModel } from '#lib/ai/api.ts';
import { catalogForModel } from '#lib/ai/modelCatalog.ts';
import {
	getSupportedThinkingLevels,
	clampThinkingLevel,
	MODEL_THINKING_LEVELS,
	type ModelThinkingLevel
} from '#lib/ai/thinking.ts';
import type { ThinkingLevel } from '#lib/ai/types.ts';
	import { providerIcon } from '#lib/ai/providerIcons.ts';

	let open = $state(false);
	let query = $state('');
	let searchEl = $state<HTMLInputElement | null>(null);
	let popupEl = $state<HTMLDivElement | null>(null);

	const providerTitleText = $derived(providerTitle(effectiveBaseUrl()));
	const selected = $derived(aiState.settings.model);
	const thinking = $derived(aiState.settings.thinking);

	type Row = { id: string; fam: string };

	/** Все модели, сгруппированные по семействам (семейство = «провайдер» рельса). */
	const families = $derived.by(() => {
		const map = new Map<string, string[]>();
		for (const m of aiState.models) {
			const fam = modelFamily(m.id);
			if (!map.has(fam)) map.set(fam, []);
			map.get(fam)!.push(m.id);
		}
		return [...map.entries()];
	});

	/** Активная вкладка рельса; при открытии — семейство выбранной модели. */
	let activeFam = $state<string | null>(null);
	const active = $derived(
		families.find(([fam]) => fam === activeFam) ?? families.find(([fam]) => fam === famOf(selected)) ?? families[0]
	);

	function famOf(id: string | null): string {
		return id ? modelFamily(id) : '';
	}

	const search = $derived(query.trim().toLowerCase());
	const searching = $derived(search.length > 0);

	/** Поиск по всем провайдерам; без запроса — только активная вкладка. */
	const rows = $derived.by<Row[]>(() => {
		const all: Row[] = families.flatMap(([fam, ids]) => ids.map((id) => ({ id, fam })));
		if (!searching) return (active ? active[1] : []).map((id) => ({ id, fam: active![0] }));
		return all.filter((r) => r.id.toLowerCase().includes(search) || r.fam.toLowerCase().includes(search));
	});

	/** Полный трек уровней; xhigh/max включаются, если их поддерживает семейство модели. */
	const trackLevels = $derived.by<ModelThinkingLevel[]>(() => {
		if (!selected) return ['off', 'low', 'medium', 'high', 'max'];
		const cat = catalogForModel(selected);
		if (!cat?.reasoning) return ['off', 'low', 'medium', 'high', 'max'];
		const supported = getSupportedThinkingLevels({ reasoning: cat.reasoning, thinkingLevelMap: cat.thinkingLevelMap });
		return MODEL_THINKING_LEVELS.filter((l) => supported.includes(l));
	});
	const LEVEL_LABEL: Record<ModelThinkingLevel, string> = {
		off: 'Off',
		minimal: 'Min',
		low: 'Low',
		medium: 'Med',
		high: 'High',
		xhigh: 'XHigh',
		max: 'Max'
	};

	const thinkingSupport = $derived(selected ? supportsThinking(selected) : null);
	const activeSysFile = $derived.by(() => {
		if (!selected) return '—';
		const anth = isAnthropicModel(selected);
		const f = anth ? aiState.settings.files.claude : aiState.settings.files.agent;
		return f.enabled && f.text.trim() ? (anth ? 'CLAUDE.md' : 'AGENT.md') : '—';
	});

	/** Заполненные ступени индикатора усилия (off = 0, т.е. ни одной). */
	const filled = $derived.by(() => {
		if (!thinking || thinkingSupport !== true) return 0;
		const i = trackLevels.indexOf(thinking);
		return i < 0 ? 0 : i;
	});

	/** Смена уровня: off/повторный клик → null, иначе clamp к поддерживаемым семейством. */
	function onLevel(lvl: ModelThinkingLevel) {
		if (thinking === lvl || lvl === 'off') {
			setThinking(null);
			return;
		}
		const cat = selected ? catalogForModel(selected) : undefined;
		const clamped = cat?.reasoning
			? clampThinkingLevel({ reasoning: cat.reasoning, thinkingLevelMap: cat.thinkingLevelMap }, lvl)
			: lvl;
		setThinking(clamped as ThinkingLevel);
	}

	/** Семейство модели → ключ иконки. */
	function glyphFam(id: string): string {
		const fam = modelFamily(id).toLowerCase();
		if (/claude|opus|sonnet|haiku/i.test(id)) return 'anthropic';
		return providerIcon(fam) ? fam : '';
	}

	function toggle() {
		open = !open;
		if (open) {
			query = '';
			activeFam = famOf(selected) || families[0]?.[0] || null;
			setTimeout(() => searchEl?.focus(), 0);
		}
	}

	function onWindowClick(e: MouseEvent) {
		if (!open) return;
		if (popupEl && !popupEl.contains(e.target as Node)) open = false;
	}

	function pick(id: string) {
		setModel(id);
		open = false;
	}

	function onSearchKey(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			if (rows[0]) pick(rows[0].id);
		} else if (e.key === 'Escape' && query) {
			e.preventDefault();
			e.stopPropagation();
			query = '';
		}
	}
</script>

<svelte:window onclick={onWindowClick} />

<div class="picker" bind:this={popupEl}>
	<button type="button" class="pill" class:stale={!aiState.modelAvailable} onclick={toggle}>
		<span class="glyph" aria-hidden="true">
			{#if selected}
				{@render Glyph(glyphFam(selected), '')}
			{:else}
				<span class="dot"></span>
			{/if}
		</span>
		<span class="name">{selected ?? 'Выбрать модель'}</span>
		{#if thinking && thinkingSupport === true}
			<span class="effort" aria-hidden="true">
				{#each trackLevels as lvl, i (lvl)}
					<span class="bar" class:fill={i < filled} style:height="{5 + i * 2.5}px"></span>
				{/each}
			</span>
		{/if}
		<span class="chev" class:flip={open}>▾</span>
	</button>

	{#if open}
		<div class="popup" transition:fade={{ duration: 120 }}>
			<div class="body">
				<!-- Рельс провайдеров -->
				<div class="rail" role="tablist" aria-label="Провайдеры" aria-orientation="vertical">
					{#each families as [fam], i (fam)}
						{@const kind = glyphFam(fam) || fam.slice(0, 1).toUpperCase()}
						<button
							type="button"
							role="tab"
							class="rail-btn"
							class:sel={!searching && active && fam === active[0]}
							aria-selected={!searching && active && fam === active[0]}
							title={fam}
							onclick={() => {
								query = '';
								activeFam = fam;
							}}
							onkeydown={(e) => {
								if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
									e.preventDefault();
									const next = (i + (e.key === 'ArrowDown' ? 1 : families.length - 1)) % families.length;
									(document.querySelector(`[data-rail="${families[next][0]}"]`) as HTMLElement)?.focus();
								}
							}}
							data-rail={fam}
						>
							{@render Glyph(glyphFam(fam), fam.slice(0, 1))}
						</button>
					{/each}
				</div>

				<!-- Правая часть: поиск, список, трек мышления -->
				<div class="col">
					<div class="search-row">
						<span class="search-ic" aria-hidden="true">⌕</span>
						<input
							bind:this={searchEl}
							bind:value={query}
							onkeydown={onSearchKey}
							type="search"
							placeholder="Поиск моделей…"
							aria-label="Поиск моделей"
						/>
						{#if query}
							<button
								type="button"
								class="clear"
								aria-label="Очистить поиск"
								onclick={() => {
									query = '';
									searchEl?.focus();
								}}>×</button
							>
						{/if}
						<button
							type="button"
							class="refresh"
							disabled={aiState.modelsState === 'loading'}
							onclick={() => refreshModels(true)}
							title="Обновить список моделей"
						>
							{aiState.modelsState === 'loading' ? '…' : '↻'}
						</button>
					</div>

					{#if aiState.modelsState === 'error' && !aiState.models.length}
						<p class="empty">Не удалось получить модели. Проверьте подключение.</p>
					{:else if !rows.length}
						<p class="empty">{searching ? `Нет совпадений «${query.trim()}»` : 'Список моделей пуст'}</p>
					{:else}
						<p class="eyebrow">
							{searching ? `Найдено: ${rows.length}` : `${providerTitleText}${active ? ` · ${active[0]}` : ''} · моделей: ${aiState.models.length}`}
						</p>
						<div class="list" role="listbox" aria-label="Модели">
							{#each rows as r (r.id)}
								{@const sel = r.id === selected}
								<button
									type="button"
									role="option"
									aria-selected={sel}
									class="model"
									class:sel
									onclick={() => pick(r.id)}
								>
									{#if searching}
										<span class="m-glyph" aria-hidden="true">
											{@render Glyph(glyphFam(r.fam), r.fam.slice(0, 1))}
										</span>
									{/if}
									<span class="m-name" translate="no">{r.id}</span>
									{#if sel}<span class="check" aria-hidden="true">✓</span>{/if}
								</button>
							{/each}
						</div>
					{/if}

					<div class="foot">
						{#if !selected}
							<p class="note">Модель не выбрана</p>
						{:else if !aiState.modelAvailable}
							<p class="note warn">Модель недоступна у поставщика — выберите другую</p>
						{:else if thinkingSupport === true}
							<span class="effort-label" aria-hidden="true">
								<span class="effort">
									{#each trackLevels as lvl, i (lvl)}
										<span class="bar" class:fill={i < filled} style:height="{5 + i * 2.5}px"></span>
									{/each}
								</span>
								<span class="mono">Мышление</span>
							</span>
							<div class="levels" role="radiogroup" aria-label="Уровень мышления">
								<span class="indicator" style:width={`calc((100% - 0.5rem) / ${trackLevels.length})`} style:transform={`translateX(${Math.max(0, trackLevels.indexOf(thinking ?? 'low')) * 100}%)`}></span>
								{#each trackLevels as lvl (lvl)}
									<button
										type="button"
										role="radio"
										class="lvl"
										class:active={thinking === lvl}
										aria-checked={thinking === lvl}
										onclick={() => onLevel(lvl)}
									>
										{LEVEL_LABEL[lvl]}
									</button>
								{/each}
							</div>
						{:else if thinkingSupport === false}
							<p class="note">Модель не поддерживает выбор уровня мышления</p>
						{:else}
							<p class="note">Возможности мышления неизвестны — параметр не отправляется</p>
						{/if}
						<p class="note sys">Системный контекст: {activeSysFile}</p>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>

<!-- Иконка по семейству: провайдер или первая буква -->
{#snippet Glyph(kind: string, fallback: string)}
	{#if kind === 'anthropic'}
		{@render ClaudeIcon()}
	{:else if providerIcon(kind)}
		{@const icon = providerIcon(kind)!}
		{#if icon.mono}
			<span class="mono-icon" style:mask-image="url({icon.src})" style:-webkit-mask-image="url({icon.src})"></span>
		{:else}
			<img src={icon.src} alt="" draggable="false" />
		{/if}
	{:else if fallback}
		<span class="letter">{fallback}</span>
	{:else}
		<span class="dot"></span>
	{/if}
{/snippet}
{#snippet ClaudeIcon()}
	<svg viewBox="0 0 24 24" aria-hidden="true">
		<path d="M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-2.266-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.449.255h.389l.055-.157-.134-.098-.103-.097-2.358-1.596-2.552-1.688-1.336-.972-.724-.491-.364-.462-.158-1.008.656-.722.881.06.225.061.893.686 1.908 1.476 2.491 1.833.365.304.145-.103.019-.073-.164-.274-1.355-2.446-1.446-2.49-.644-1.032-.17-.619a2.97 2.97 0 01-.104-.729L6.283.134 6.696 0l.996.134.42.364.62 1.414 1.002 2.229 1.555 3.03.456.898.243.832.091.255h.158V9.01l.128-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.584.28.48.685-.067.444-.286 1.851-.559 2.903-.364 1.942h.212l.243-.242.985-1.306 1.652-2.064.73-.82.85-.904.547-.431h1.033l.76 1.129-.34 1.166-1.064 1.347-.881 1.142-1.264 1.7-.79 1.36.073.11.188-.02 2.856-.606 1.543-.28 1.841-.315.833.388.091.395-.328.807-1.969.486-2.309.462-3.439.813-.042.03.049.061 1.549.146.662.036h1.622l3.02.225.79.522.474.638-.079.485-1.215.62-1.64-.389-3.829-.91-1.312-.329h-.182v.11l1.093 1.068 2.006 1.81 2.509 2.33.127.578-.322.455-.34-.049-2.205-1.657-.851-.747-1.926-1.62h-.128v.17l.444.649 2.345 3.521.122 1.08-.17.353-.608.213-.668-.122-1.374-1.925-1.415-2.167-1.143-1.943-.14.08-.674 7.254-.316.37-.729.28-.607-.461-.322-.747.322-1.476.389-1.924.315-1.53.286-1.9.17-.632-.012-.042-.14.018-1.434 1.967-2.18 2.945-1.726 1.845-.414.164-.717-.37.067-.662.401-.589 2.388-3.036 1.44-1.882.93-1.086-.006-.158h-.055L4.132 18.56l-1.13.146-.487-.456.061-.746.231-.243 1.908-1.312-.006.006z" fill="#D97757" fill-rule="nonzero" />
	</svg>
{/snippet}


<style>
	.picker {
		position: relative;
		display: inline-block;
	}
	.pill {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		max-width: 320px;
		padding: 6px 12px;
		font-size: 0.78rem;
		font-weight: 500;
		color: var(--ink);
		background: var(--panel);
		border: 1px solid var(--line);
		border-radius: 9999px;
		cursor: pointer;
		transition: border-color 0.2s, background-color 0.2s;
	}
	.pill:hover {
		border-color: var(--line-strong);
		background: var(--panel-hover);
	}
	.pill:active {
		transform: scale(0.98);
	}
	.pill.stale {
		border-color: var(--status-amber);
	}
	.glyph {
		display: inline-flex;
		width: 16px;
		height: 16px;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.glyph :global(svg),
	.glyph :global(img) {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}
	.dot {
		width: 6px;
		height: 6px;
		border-radius: 9999px;
		background: var(--sage);
	}
	.name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.chev {
		color: var(--ink-muted);
		font-size: 0.6rem;
		transition: transform 0.2s;
	}
	.chev.flip {
		transform: rotate(180deg);
	}
	.popup {
		position: absolute;
		top: calc(100% + 10px);
		left: 0;
		z-index: 41;
		width: min(416px, calc(100vw - 32px));
		max-height: min(520px, calc(100dvh - 2rem));
		background: var(--panel-solid);
		border: 1px solid var(--line-strong);
		border-radius: 12px;
		box-shadow: 0 18px 48px -24px #000;
		overflow: hidden;
	}
	.body {
		display: flex;
		min-height: 208px;
	}
	/* Рельс провайдеров */
	.rail {
		display: flex;
		flex-direction: column;
		gap: 6px;
		width: 48px;
		flex-shrink: 0;
		padding: 6px;
		background: var(--panel);
		border-right: 1px solid var(--line);
		overflow-y: auto;
		scrollbar-width: none;
	}
	.rail::-webkit-scrollbar {
		display: none;
	}
	.rail-btn {
		display: inline-flex;
		width: 36px;
		height: 36px;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
		border-radius: 12px;
		color: var(--ink-muted);
		background: transparent;
		border: none;
		cursor: pointer;
		transition: background-color 0.2s, color 0.2s;
	}
	.rail-btn:hover {
		background: var(--panel-solid);
		color: var(--ink);
	}
	.rail-btn.sel {
		background: var(--panel-solid);
		color: var(--ink);
		border: 1px solid var(--line);
	}
	.rail-btn :global(svg),
	.rail-btn :global(img) {
		width: 16px;
		height: 16px;
		object-fit: contain;
	}
	.letter {
		font-size: 0.72rem;
		font-weight: 600;
	}
	/* Монохромная иконка красится цветом текста через маску */
	.mono-icon {
		display: block;
		width: 100%;
		height: 100%;
		background-color: currentColor;
		-webkit-mask-repeat: no-repeat;
		mask-repeat: no-repeat;
		-webkit-mask-position: center;
		mask-position: center;
		-webkit-mask-size: contain;
		mask-size: contain;
	}
	/* Правая колонка */
	.col {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-width: 0;
	}
	.search-row {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
		padding: 8px 12px;
		background: var(--panel);
	}
	.search-ic {
		color: var(--ink-muted);
		font-size: 0.85rem;
	}
	.search-row input {
		flex: 1;
		min-width: 0;
		background: transparent;
		border: none;
		color: var(--ink);
		font: inherit;
		font-size: 0.82rem;
		padding: 2px 0;
	}
	.search-row input:focus {
		outline: none;
	}
	.clear,
	.refresh {
		display: inline-flex;
		width: 22px;
		height: 22px;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		background: transparent;
		border: none;
		color: var(--ink-muted);
		border-radius: 9999px;
		cursor: pointer;
		font-size: 0.8rem;
	}
	.clear:hover,
	.refresh:hover:not(:disabled) {
		background: var(--panel-solid);
		color: var(--ink);
	}
	.eyebrow {
		margin: 8px 10px 4px;
		font-family: var(--font-mono);
		font-size: 0.66rem;
		color: var(--ink-muted);
	}
	.list {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 2px;
		max-height: min(256px, 42dvh);
		overflow-y: auto;
		padding: 0 8px 8px;
		overscroll-behavior: contain;
		scrollbar-width: thin;
	}
	.model {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		width: 100%;
		min-height: 36px;
		padding: 6px 10px;
		text-align: left;
		font-size: 0.8rem;
		color: var(--ink);
		background: transparent;
		border: none;
		border-radius: 10px;
		cursor: pointer;
		transition: background-color 0.2s;
	}
	.model:hover {
		background: var(--panel);
	}
	.model.sel {
		background: var(--panel);
	}
	.m-glyph {
		display: inline-flex;
		width: 22px;
		height: 22px;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--line);
		border-radius: 9999px;
	}
	.m-glyph :global(svg),
	.m-glyph :global(img) {
		width: 12px;
		height: 12px;
		object-fit: contain;
	}
	.m-name {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.check {
		color: var(--sage);
	}
	.empty {
		margin: 0;
		padding: 20px 14px;
		font-size: 0.76rem;
		color: var(--ink-muted);
		text-align: center;
	}
	/* Низ: трек мышления */
	.foot {
		display: flex;
		flex-direction: column;
		gap: 8px;
		border-top: 1px solid var(--line);
		padding: 8px 12px;
		background: var(--panel);
	}
	.effort-label {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.effort {
		display: flex;
		align-items: flex-end;
		gap: 2px;
	}
	.bar {
		width: 3px;
		border-radius: 9999px;
		background: var(--line-strong);
		transition: background-color 0.3s;
	}
	.bar.fill {
		background: var(--ink);
	}
	.mono {
		font-family: var(--font-mono);
		font-size: 0.66rem;
		color: var(--ink-muted);
	}
	.levels {
		position: relative;
		display: flex;
		flex: 1;
		background: var(--panel-solid);
		border: 1px solid var(--line);
		border-radius: 9999px;
		padding: 4px;
	}
	.indicator {
		position: absolute;
		top: 4px;
		bottom: 4px;
		left: 4px;
		border-radius: 9999px;
		background: var(--panel-hover);
		border: 1px solid var(--line);
		transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
	}
	.lvl {
		position: relative;
		z-index: 1;
		flex: 1;
		padding: 4px 6px;
		font-size: 0.68rem;
		font-weight: 500;
		color: var(--ink-muted);
		background: transparent;
		border: none;
		border-radius: 9999px;
		cursor: pointer;
		transition: color 0.3s;
	}
	.lvl:hover {
		color: var(--ink);
	}
	.lvl.active {
		color: var(--ink);
	}
	.note {
		margin: 0;
		font-size: 0.72rem;
		color: var(--ink-muted);
	}
	.note.warn {
		color: var(--status-amber);
	}
</style>
