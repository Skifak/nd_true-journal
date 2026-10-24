<script lang="ts">
	/**
	 * Первое согласие: перекрывает чат до нажатия «Согласен».
	 * Прямая отправка поставщику без прокси + список разрешённых разделов.
	 */
	import { aiState, updateSettings } from '#lib/ai/store.svelte.ts';
	import { SECTION_LABELS, type SectionKey } from '#lib/ai/types.ts';

	const sections = $derived(aiState.settings.sections as SectionKey[]);
	const hasAttachments = $derived(sections.includes('attachments'));

	function agree() {
		updateSettings({ consent: true });
	}
</script>

<div class="gate">
	<div class="card">
		<h2>Данные пойдут поставщику AI</h2>
		<p class="big">
			Данные будут отправляться напрямую поставщику AI по указанному Base URL.
			TradeJournal не использует собственный прокси и не контролирует обработку
			данных поставщиком.
		</p>
		<p class="mid">В запросах будут участвовать разделы:</p>
		<ul>
			{#each sections as s (s)}
				<li>{SECTION_LABELS[s]}</li>
			{:else}
				<li class="none">ни один раздел не разрешён — измените выбор в настройках</li>
			{/each}
		</ul>
		{#if hasAttachments}
			<p class="warn">
				Вложения (скриншоты) могут содержать персональные данные и уходят провайдеру
				как изображения.
			</p>
		{/if}
		<p class="mid">
			Разрешения можно изменить позже в настройках. Уже отправленные данные из
			локальной истории не удаляются — история удаляется только вручную.
		</p>
		<button type="button" class="primary" onclick={agree}>Согласен</button>
	</div>
</div>

<style>
	.gate {
		position: absolute;
		inset: 0;
		z-index: 20;
		display: grid;
		place-items: center;
		padding: var(--sp-lg);
		background: var(--bg);
		overflow: auto;
	}
	.card {
		max-width: 560px;
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding: clamp(20px, 4vw, 36px);
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-card);
		background: var(--panel-solid);
	}
	h2 {
		margin: 0;
		font-family: var(--font-display);
		font-size: 1.7rem;
		font-weight: 400;
		letter-spacing: -0.02em;
	}
	.big {
		margin: 0;
		font-size: 0.94rem;
		line-height: 1.5;
	}
	.mid {
		margin: 0;
		font-size: 0.78rem;
		color: var(--ink-muted);
	}
	ul {
		margin: 0;
		padding: 0 0 0 18px;
		font-size: 0.86rem;
	}
	li.none {
		list-style: none;
		margin-left: -18px;
		color: var(--ink-muted);
		font-size: 0.78rem;
	}
	.warn {
		margin: 0;
		font-size: 0.8rem;
		color: var(--status-amber);
	}
	.primary {
		align-self: flex-start;
		margin-top: 6px;
		padding: 10px 26px;
		font-size: 0.82rem;
		letter-spacing: 0.04em;
		color: var(--bg);
		background: var(--sage);
		border: none;
		border-radius: 2px;
		cursor: pointer;
	}
</style>
