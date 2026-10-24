<script lang="ts">
	/**
	 * Список сессий: выбор, переименование (название → поле ввода), удаление
	 * с подтверждением. Кнопки — рядом с каждой сессией.
	 */
	import Modal from '#lib/components/Modal.svelte';
	import { aiState, selectSession, renameSession, deleteSession } from '#lib/ai/store.svelte.ts';

	let editingId = $state<string | null>(null);
	let editTitle = $state('');
	let removingId = $state<string | null>(null);
	let removeOpen = $state(false);

	const sessions = $derived(aiState.sessions);

	function startRename(id: string, current: string) {
		editingId = id;
		editTitle = current;
	}

	function commitRename() {
		if (editingId) renameSession(editingId, editTitle);
		editingId = null;
	}

	async function confirmRemove() {
		if (removingId) await deleteSession(removingId);
		removingId = null;
		removeOpen = false;
	}
</script>

<div class="sessions">
	<div class="head">
		<span class="eyebrow">Сессии</span>
		<span class="count mono">{sessions.length}</span>
	</div>
	{#if !sessions.length}
		<p class="empty">Сессий пока нет</p>
	{:else}
		<ul>
			{#each sessions as s (s.id)}
				<li class:active={s.id === aiState.activeId}>
					{#if editingId === s.id}
						<!-- Переименование: поле с текущим названием -->
						<input
							class="rename"
							bind:value={editTitle}
							onkeydown={(e) => {
								if (e.key === 'Enter') commitRename();
								if (e.key === 'Escape') editingId = null;
							}}
							onblur={commitRename}
						/>
					{:else}
						<button type="button" class="title" onclick={() => selectSession(s.id)}>
							{s.title}
						</button>
						<span class="tools">
							<button
								type="button"
								class="tool"
								title="Переименовать"
								onclick={() => startRename(s.id, s.title)}>✎</button
							>
							<button
								type="button"
								class="tool danger"
								title="Удалить сессию"
								onclick={() => {
									removingId = s.id;
									removeOpen = true;
								}}>✕</button
							>
						</span>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}

	<Modal
		bind:open={removeOpen}
		title="Удалить сессию?"
		size="sm"
		onClose={() => (removingId = null)}
	>
		<p class="confirm-text">
			Сессия «{sessions.find((s) => s.id === removingId)?.title ?? ''}» и все её сообщения
			будут удалены. Действие необратимо.
		</p>
		{#snippet footer()}
			<button type="button" class="btn" onclick={() => (removeOpen = false)}>Отмена</button>
			<button type="button" class="btn danger" onclick={confirmRemove}>Удалить</button>
		{/snippet}
	</Modal>
</div>

<style>
	.sessions {
		display: flex;
		flex-direction: column;
		min-height: 0;
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 2px 4px 8px;
		border-bottom: 1px solid var(--line);
	}
	.count {
		font-size: 0.62rem;
		color: var(--ink-muted);
	}
	.empty {
		margin: 0;
		padding: 12px 4px;
		font-size: 0.72rem;
		color: var(--ink-muted);
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		overflow: auto;
	}
	li {
		display: flex;
		align-items: center;
		gap: 4px;
		border-bottom: 1px solid var(--line);
	}
	li.active .title {
		color: var(--ink);
		border-left-color: var(--accent);
	}
	.title {
		flex: 1;
		min-width: 0;
		text-align: left;
		padding: 8px 6px;
		font-size: 0.78rem;
		color: var(--ink-muted);
		background: none;
		border: none;
		border-left: 2px solid transparent;
		cursor: pointer;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.title:hover {
		color: var(--ink);
	}
	.tools {
		display: none;
		gap: 2px;
		padding-right: 4px;
		flex-shrink: 0;
	}
	li:hover .tools,
	li.active .tools {
		display: inline-flex;
	}
	.tool {
		width: 20px;
		height: 20px;
		display: grid;
		place-items: center;
		font-size: 0.62rem;
		color: var(--ink-muted);
		background: transparent;
		border: 1px solid transparent;
		border-radius: 2px;
		cursor: pointer;
	}
	.tool:hover {
		color: var(--ink);
		border-color: var(--line-strong);
	}
	.tool.danger:hover {
		color: var(--danger);
	}
	.rename {
		flex: 1;
		min-width: 0;
		margin: 6px;
		background: transparent;
		border: 1px solid var(--line-strong);
		border-radius: 2px;
		color: var(--ink);
		font: inherit;
		font-size: 0.78rem;
		padding: 5px 6px;
	}
	.rename:focus {
		outline: none;
	}
	.confirm-text {
		margin: 0;
		font-size: 0.86rem;
		line-height: 1.5;
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
	.btn.danger {
		color: var(--danger);
		border-color: var(--danger);
	}
</style>
