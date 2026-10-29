<script lang="ts">
	/**
	 * Настройки AI: подключение, разрешения данных, системные файлы контекста,
	 * история чата. Все значения — локальные.
	 */
	import { onMount } from 'svelte';
	import Modal from '#lib/components/Modal.svelte';
	import ConnectCard from '#lib/components/ai/ConnectCard.svelte';
	import ContextFileModal from '#lib/components/ai/ContextFileModal.svelte';
	import ModelPicker from '#lib/components/ai/ModelPicker.svelte';
	import {
		aiState,
		applyPreset,
		deleteAllHistory,
		initAi,
		resetContextFiles,
		setContextFileEnabled,
		toggleSection
	} from '#lib/ai/store.svelte.ts';
	import { PRESETS, SECTION_LABELS, type DataPreset, type SectionKey } from '#lib/ai/types.ts';
	import { formatBytes, historyStats } from '#lib/ai/sessions.ts';

	onMount(() => void initAi());

	let editing = $state<'agent' | 'claude' | null>(null);
	let editorOpen = $state(false);
	let confirmResetOpen = $state(false);
	let confirmHistoryOpen = $state(false);

	const stats = $derived(historyStats(aiState.sessions));
	const settings = $derived(aiState.settings);
	const sections = $derived(settings.sections as SectionKey[]);

	const FILE_ROWS = [
		{
			which: 'agent' as const,
			name: 'AGENT.md',
			note: 'Системный контекст для всех поставщиков, кроме Anthropic'
		},
		{
			which: 'claude' as const,
			name: 'CLAUDE.md',
			note: 'Системный контекст для моделей Anthropic (Opus, Sonnet, Haiku)'
		}
	];

	function setPreset(p: DataPreset) {
		applyPreset(p);
	}

	function openEditor(which: 'agent' | 'claude') {
		editing = which;
		editorOpen = true;
	}

	function doResetFiles() {
		resetContextFiles();
		confirmResetOpen = false;
	}

	async function doClearHistory() {
		await deleteAllHistory();
		confirmHistoryOpen = false;
	}
</script>

<section class="panel">
	<div class="panel-head">
		<h2 class="panel-title">AI · подключение</h2>
		<span class="eyebrow">{aiState.keyReady ? 'ключ подключён' : 'ключ не подключён'}</span>
	</div>
	<ConnectCard />
	{#if aiState.keyReady && aiState.modelsState === 'ok'}
		<div class="row-inline">
			<ModelPicker />
			<span class="hint">Модель по умолчанию · моделей: {aiState.models.length}</span>
		</div>
	{/if}
</section>

<section class="panel">
	<div class="panel-head">
		<h2 class="panel-title">AI · данные для отправки</h2>
		<span class="eyebrow">что уходит провайдеру</span>
	</div>
	<div class="presets">
		{#each PRESETS as p (p.id)}
			<button
				type="button"
				class="chip"
				class:active={settings.preset === p.id}
				onclick={() => setPreset(p.id)}>{p.label}</button
			>
		{/each}
		{#if settings.preset === 'custom'}<span class="chip static">Своё</span>{/if}
	</div>
	<ul class="checks">
		{#each Object.entries(SECTION_LABELS) as [key, label] (key)}
			<li>
				<label class="check">
					<input
						type="checkbox"
						checked={sections.includes(key as SectionKey)}
						onchange={() => toggleSection(key as SectionKey)}
					/>
					<span>{label}</span>
				</label>
			</li>
		{/each}
	</ul>
	{#if sections.includes('attachments')}
		<p class="warn">
			Вложения (скриншоты) могут содержать персональные данные. Они уходят провайдеру
			только если модель поддерживает изображения.
		</p>
	{/if}
	<p class="hint">
		Дневник — личные записи: уходит провайдеру только по вашей галочке.
	</p>
	<p class="hint">
		Настройки приложения, API-ключ и служебные данные никогда не отправляются.
	</p>
</section>

<section class="panel">
	<div class="panel-head">
		<h2 class="panel-title">AI · файлы контекста</h2>
		<span class="eyebrow">системные инструкции</span>
	</div>
	<ul class="files">
		{#each FILE_ROWS as f (f.which)}
			<li>
				<div class="file-info">
					<label class="check">
						<input
							type="checkbox"
							disabled={!settings.files[f.which].text.trim()}
							checked={settings.files[f.which].enabled}
							onchange={(e) =>
								setContextFileEnabled(f.which, (e.target as HTMLInputElement).checked)}
						/>
						<span class="file-name">{f.name}</span>
					</label>
					<span class="file-note">{f.note}</span>
				</div>
				<span class="file-state">
					{settings.files[f.which].text.trim()
						? `${settings.files[f.which].text.length} симв.`
						: 'пусто'}
				</span>
				<button type="button" class="btn" onclick={() => openEditor(f.which)}>Редактировать</button>
			</li>
		{/each}
	</ul>
	<p class="hint">
		Файл отправляется как системный контекст ко всем запросам активной сессии.
		Отключение чекбокса сохраняет текст, но перестаёт его отправлять.
	</p>
	<button type="button" class="danger-link" onclick={() => (confirmResetOpen = true)}>
		Сбросить все файлы
	</button>
</section>

<section class="panel">
	<div class="panel-head">
		<h2 class="panel-title">AI · история чата</h2>
		<span class="eyebrow">локально</span>
	</div>
	<ul class="stats">
		<li><span class="stat-label">Размер</span><span class="stat-value">{formatBytes(stats.bytes)}</span></li>
		<li><span class="stat-label">Сессий</span><span class="stat-value">{stats.sessions}</span></li>
		<li><span class="stat-label">Сообщений</span><span class="stat-value">{stats.messages}</span></li>
	</ul>
	<button type="button" class="danger-link" onclick={() => (confirmHistoryOpen = true)}>
		Удалить всю историю AI
	</button>
	<p class="hint">Удаление истории не затрагивает API-ключ, настройки и торговый журнал.</p>
</section>

<ContextFileModal
	bind:open={editorOpen}
	which={editing ?? 'agent'}
	initial={editing ? settings.files[editing].text : ''}
	onClose={() => (editing = null)}
/>

<Modal bind:open={confirmResetOpen} title="Сбросить файлы контекста?" size="sm" onClose={() => (confirmResetOpen = false)}>
	<p class="dlg-text">Тексты AGENT.md и CLAUDE.md будут удалены из приложения.</p>
	{#snippet footer()}
		<button type="button" class="btn" onclick={() => (confirmResetOpen = false)}>Отмена</button>
		<button type="button" class="btn danger" onclick={doResetFiles}>Сбросить</button>
	{/snippet}
</Modal>

<Modal bind:open={confirmHistoryOpen} title="Удалить всю историю AI?" size="sm" onClose={() => (confirmHistoryOpen = false)}>
	<p class="dlg-text">
		Все сессии и сообщения AI-чата будут удалены безвозвратно. Ключ и настройки
		останутся.
	</p>
	{#snippet footer()}
		<button type="button" class="btn" onclick={() => (confirmHistoryOpen = false)}>Отмена</button>
		<button type="button" class="btn danger" onclick={doClearHistory}>Удалить</button>
	{/snippet}
</Modal>

<style>
	.panel {
		background: var(--panel);
		border: 1px solid var(--line);
		border-radius: var(--radius-card);
		padding: clamp(18px, 2.4vw, 26px);
		margin-bottom: var(--sp-xl);
		display: flex;
		flex-direction: column;
		gap: var(--sp-md);
	}
	.panel-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		padding-bottom: var(--sp-sm);
		border-bottom: 1px solid var(--line);
	}
	.panel-title {
		margin: 0;
		font-size: 1.35rem;
		font-weight: 400;
		letter-spacing: -0.02em;
	}
	.row-inline {
		display: flex;
		align-items: center;
		gap: var(--sp-sm);
		flex-wrap: wrap;
	}
	.presets {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.chip {
		padding: 5px 12px;
		font-size: 0.74rem;
		color: var(--ink-muted);
		background: transparent;
		border: 1px solid var(--line);
		border-radius: 9999px;
		cursor: pointer;
	}
	.chip.active {
		color: var(--bg);
		background: var(--sage);
		border-color: var(--sage);
	}
	.chip.static {
		cursor: default;
		color: var(--ink);
		border-color: var(--line-strong);
	}
	.checks {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 6px 16px;
	}
	.check {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.84rem;
	}
	.check input {
		accent-color: var(--sage);
	}
	.check input:disabled + span {
		color: var(--ink-muted);
	}
	.files {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.files li {
		display: flex;
		align-items: center;
		gap: var(--sp-md);
		padding: var(--sp-sm) 0;
		border-bottom: 1px solid var(--line);
	}
	.files li:last-child {
		border-bottom: none;
	}
	.file-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.file-name {
		font-family: var(--font-mono);
		font-size: 0.8rem;
	}
	.file-note {
		font-size: 0.7rem;
		color: var(--ink-muted);
	}
	.file-state {
		font-family: var(--font-mono);
		font-size: 0.66rem;
		color: var(--ink-muted);
		white-space: nowrap;
	}
	.stats {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: 1px;
		background: var(--line);
		border: 1px solid var(--line);
	}
	.stats li {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 10px 12px;
		background: var(--bg);
	}
	.stat-label {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--ink-muted);
	}
	.stat-value {
		font-size: 1.05rem;
	}
	.hint {
		margin: 0;
		font-size: 0.72rem;
		color: var(--ink-muted);
	}
	.warn {
		margin: 0;
		font-size: 0.76rem;
		color: var(--status-amber);
	}
	.btn {
		padding: 7px 14px;
		font-size: 0.76rem;
		background: transparent;
		color: var(--ink);
		border: 1px solid var(--line);
		border-radius: 2px;
		cursor: pointer;
	}
	.btn:hover {
		border-color: var(--line-strong);
	}
	.btn.danger {
		color: var(--danger);
		border-color: var(--danger);
	}
	.danger-link {
		align-self: flex-start;
		background: none;
		border: none;
		padding: 0;
		font-size: 0.74rem;
		color: var(--danger);
		cursor: pointer;
		text-decoration: underline;
	}
	.dlg-text {
		margin: 0;
		font-size: 0.86rem;
		line-height: 1.5;
	}
</style>
