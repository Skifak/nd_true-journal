<script lang="ts">
	/**
	 * Модалка редактирования системного файла контекста (AGENT.md / CLAUDE.md).
	 * Большое поле, «Сохранить» применяет изменения, «Очистить» — пустой текст.
	 * Содержимое вводится вручную и не ограничено по размеру.
	 */
	import Modal from '#lib/components/Modal.svelte';
	import { saveContextFile } from '#lib/ai/store.svelte.ts';

	interface Props {
		open: boolean;
		which: 'agent' | 'claude';
		initial: string;
		onClose: () => void;
	}

	let { open = $bindable(false), which, initial, onClose }: Props = $props();

	const name = $derived(which === 'claude' ? 'CLAUDE.md' : 'AGENT.md');
	let text = $state('');

	// При открытии модалки поле показывает актуальное содержимое
	$effect(() => {
		if (open) text = initial;
	});

	function save() {
		saveContextFile(which, text);
		open = false;
		onClose();
	}

	function clear() {
		text = '';
	}
</script>

<Modal
	bind:open
	title={name}
	subtitle={which === 'claude'
		? 'Системный контекст для моделей Anthropic (Opus, Sonnet, Haiku)'
		: 'Системный контекст для остальных моделей'}
	size="lg"
	onClose={() => onClose()}
>
	<p class="warn">
		Критический файл контекста: это системные инструкции проекта. Изменяйте только
		понимая последствия — его содержимое уходит выбранному AI-провайдеру.
	</p>
	<textarea rows="16" bind:value={text} placeholder={`Содержимое ${name}…`}></textarea>

	{#snippet footer()}
		<button type="button" class="btn" onclick={clear}>Очистить</button>
		<span class="grow"></span>
		<button type="button" class="btn" onclick={() => { open = false; onClose(); }}>Отмена</button>
		<button type="button" class="btn primary" onclick={save}>Сохранить</button>
	{/snippet}
</Modal>

<style>
	.warn {
		margin: 0 0 10px;
		font-size: 0.76rem;
		line-height: 1.45;
		color: var(--status-amber);
	}
	textarea {
		width: 100%;
		background: transparent;
		border: 1px solid var(--line);
		border-radius: 2px;
		color: var(--ink);
		font-family: var(--font-mono);
		font-size: 0.78rem;
		line-height: 1.5;
		resize: vertical;
		padding: 10px;
	}
	textarea:focus {
		outline: none;
		border-color: var(--line-strong);
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
	.btn.primary {
		color: var(--bg);
		background: var(--sage);
		border-color: var(--sage);
	}
	.grow {
		flex: 1;
	}
</style>
