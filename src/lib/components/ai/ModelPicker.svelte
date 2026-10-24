<script lang="ts">
	/**
	 * Селектор модели: кнопка + popup с поиском, группами по семействам,
	 * уровнями мышления и активным системным файлом (референс: pi).
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
	import type { ThinkingLevel } from '#lib/ai/types.ts';

	let open = $state(false);
	let query = $state('');

	const provider = $derived(providerTitle(effectiveBaseUrl()));
	const selected = $derived(aiState.settings.model);
	const thinking = $derived(aiState.settings.thinking);

	const filtered = $derived.by(() => {
		const q = query.trim().toLowerCase();
		return aiState.models.filter((m) => !q || m.id.toLowerCase().includes(q));
	});

	const groups = $derived.by(() => {
		const map = new Map<string, string[]>();
		for (const m of filtered) {
			const fam = modelFamily(m.id);
			if (!map.has(fam)) map.set(fam, []);
			map.get(fam)!.push(m.id);
		}
		return [...map.entries()];
	});

	const thinkingSupport = $derived(selected ? supportsThinking(selected) : null);
	const activeSysFile = $derived.by(() => {
		if (!selected) return '—';
		const f = isAnthropicModel(selected) ? aiState.settings.files.claude : aiState.settings.files.agent;
		return f.enabled && f.text.trim() ? (isAnthropicModel(selected) ? 'CLAUDE.md' : 'AGENT.md') : '—';
	});

	const LEVELS: ThinkingLevel[] = ['low', 'medium', 'high', 'max'];

	function pick(id: string) {
		setModel(id);
		open = false;
	}
</script>

<div class="picker">
	<button type="button" class="pill" class:stale={!aiState.modelAvailable} onclick={() => (open = !open)}>
		<span class="dot"></span>
		<span class="name">{selected ?? 'Выбрать модель'}</span>
		{#if thinking}<span class="mini">· {thinking}</span>{/if}
		<span class="chev" class:flip={open}>▾</span>
	</button>

	{#if open}
		<button type="button" class="scrim" aria-label="Закрыть" onclick={() => (open = false)}
			></button>
		<div class="popup" transition:fade={{ duration: 120 }}>
			<div class="head">
				<input
					type="search"
					placeholder="Поиск моделей…"
					bind:value={query}
				/>
				<button
					type="button"
					class="refresh"
					disabled={aiState.modelsState === 'loading'}
					onclick={refreshModels}
					title="Обновить список моделей у поставщика"
				>
					{aiState.modelsState === 'loading' ? '…' : '↻'}
				</button>
			</div>

			{#if aiState.modelsState === 'error'}
				<p class="empty">Не удалось получить модели. Проверьте подключение в настройках.</p>
			{:else if !filtered.length}
				<p class="empty">{aiState.models.length ? 'Ничего не найдено' : 'Список моделей пуст'}</p>
			{:else}
				<p class="provider eyebrow">{provider} · моделей: {aiState.models.length}</p>
				{#each groups as [fam, ids] (fam)}
					<p class="fam">{fam}</p>
					{#each ids as id (id)}
						<button type="button" class="model" onclick={() => pick(id)}>
							<span class="m-name">{id}</span>
							{#if id === selected}<span class="check">✓</span>{/if}
						</button>
					{/each}
				{/each}
			{/if}

			<div class="foot">
				{#if !selected}
					<p class="note">Модель не выбрана</p>
				{:else if !aiState.modelAvailable}
					<p class="note warn">Модель недоступна у поставщика — выберите другую</p>
				{:else if thinkingSupport === true}
					<div class="think">
						<span class="think-label">Мышление</span>
						<div class="levels">
							{#each LEVELS as lvl (lvl)}
								<button
									type="button"
									class="lvl"
									class:active={thinking === lvl}
									onclick={() => setThinking(thinking === lvl ? null : lvl)}
								>
									{lvl === 'low' ? 'Low' : lvl === 'medium' ? 'Medium' : lvl === 'high' ? 'High' : 'Max'}
								</button>
							{/each}
						</div>
					</div>
				{:else if thinkingSupport === false}
					<p class="note">Модель не поддерживает выбор уровня мышления</p>
				{:else}
					<p class="note">Возможности мышления неизвестны — параметр не отправляется</p>
				{/if}
				<p class="note sys">Системный контекст: {activeSysFile}</p>
			</div>
		</div>
	{/if}
</div>

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
		color: var(--ink);
		background: var(--panel);
		border: 1px solid var(--line);
		border-radius: 9999px;
		cursor: pointer;
		transition: border-color 0.2s;
	}
	.pill:hover {
		border-color: var(--line-strong);
	}
	.pill.stale {
		border-color: var(--status-amber);
	}
	.dot {
		width: 6px;
		height: 6px;
		border-radius: 9999px;
		background: var(--sage);
		flex-shrink: 0;
	}
	.name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.mini {
		color: var(--ink-muted);
		font-size: 0.68rem;
	}
	.chev {
		color: var(--ink-muted);
		font-size: 0.6rem;
		transition: transform 0.15s;
	}
	.chev.flip {
		transform: rotate(180deg);
	}
	.scrim {
		position: fixed;
		inset: 0;
		z-index: 40;
		background: transparent;
		border: none;
		cursor: default;
	}
	.popup {
		position: absolute;
		top: calc(100% + 8px);
		left: 0;
		z-index: 41;
		width: min(420px, calc(100vw - 32px));
		max-height: min(520px, 70dvh);
		overflow: auto;
		background: var(--panel-solid);
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-card);
		box-shadow: 0 18px 48px -24px #000;
		padding: 10px;
	}
	.head {
		display: flex;
		gap: 6px;
		margin-bottom: 8px;
	}
	input {
		flex: 1;
		background: transparent;
		border: 1px solid var(--line);
		border-radius: 2px;
		color: var(--ink);
		font: inherit;
		font-size: 0.8rem;
		padding: 6px 8px;
	}
	input:focus {
		outline: none;
		border-color: var(--line-strong);
	}
	.refresh {
		width: 32px;
		border: 1px solid var(--line);
		background: transparent;
		color: var(--ink-muted);
		border-radius: 2px;
		cursor: pointer;
	}
	.refresh:hover:not(:disabled) {
		color: var(--ink);
		border-color: var(--line-strong);
	}
	.provider {
		margin: 4px 2px 6px;
		color: var(--ink-muted);
	}
	.fam {
		margin: 10px 2px 4px;
		font-family: var(--font-mono);
		font-size: 0.62rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--ink-muted);
	}
	.model {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		width: 100%;
		padding: 7px 8px;
		text-align: left;
		font-size: 0.8rem;
		color: var(--ink);
		background: transparent;
		border: 1px solid transparent;
		border-radius: 2px;
		cursor: pointer;
	}
	.model:hover {
		background: var(--panel-hover);
		border-color: var(--line);
	}
	.m-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.check {
		color: var(--sage);
	}
	.foot {
		border-top: 1px solid var(--line);
		margin-top: 10px;
		padding-top: 10px;
	}
	.note {
		margin: 2px 2px 6px;
		font-size: 0.72rem;
		color: var(--ink-muted);
	}
	.note.warn {
		color: var(--status-amber);
	}
	.empty {
		margin: 0;
		padding: 14px 4px;
		font-size: 0.75rem;
		color: var(--ink-muted);
	}
	.think {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 6px;
	}
	.think-label {
		font-size: 0.72rem;
		color: var(--ink-muted);
		white-space: nowrap;
	}
	.levels {
		display: flex;
		gap: 1px;
		background: var(--line);
		border-radius: 9999px;
		padding: 1px;
	}
	.lvl {
		padding: 4px 10px;
		font-size: 0.68rem;
		color: var(--ink-muted);
		background: var(--panel-solid);
		border: none;
		border-radius: 9999px;
		cursor: pointer;
	}
	.lvl.active {
		color: var(--bg);
		background: var(--sage);
	}
</style>
