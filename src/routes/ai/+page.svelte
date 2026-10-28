<script lang="ts">
	/**
	 * Вкладка AI: чат с журналом.
	 * Пустое состояние — центрированное поле ввода и быстрые кнопки.
	 * Без ключа — блок подключения; без согласия — блок согласия поверх чата.
	 */
	import { onMount } from 'svelte';
	import { namespaced } from '#lib/storage/local.ts';
	import { getTrades, initJournal, journalState } from '#lib/storage/journalStore.svelte.ts';
	import { formatMoney, tradeProfit } from '#lib/domain/trades.ts';
	import { supportsVision } from '#lib/ai/api.ts';
	import {
		aiState,
		clearLastError,
		initAi,
		selectSession,
		send,
		stopGenerating,
		type SendPayload
	} from '#lib/ai/store.svelte.ts';
	import ModelPicker from '#lib/components/ai/ModelPicker.svelte';
	import ConnectCard from '#lib/components/ai/ConnectCard.svelte';
	import ConsentGate from '#lib/components/ai/ConsentGate.svelte';
	import SessionList from '#lib/components/ai/SessionList.svelte';
	import QuickActions from '#lib/components/ai/QuickActions.svelte';
	import Modal from '#lib/components/Modal.svelte';

	const app = namespaced('ndtj:app:');

	initJournal();
	onMount(() => void initAi());

	let input = $state('');
	let notice = $state('');
	let composerEl = $state<HTMLTextAreaElement | null>(null);

	// Ожидание при параллельном запросе и несовместимой модели
	let pending = $state<{ payload: SendPayload; text: string } | null>(null);
	let busyOpen = $state(false);
	let visionOpen = $state(false);
	let session = $derived(aiState.activeSession);
	let messages = $derived(session?.messages ?? []);
	let openTrades = $derived(getTrades().filter((t) => t.status === 'open'));

	function dayNote(): string {
		return app.get('note') ?? '';
	}

	function hasAttachments(): boolean {
		return getTrades().some((t) => Array.isArray(t.attachments) && t.attachments.length > 0);
	}

	/** Запрос с проверками: генерация, доступность модели, вложения/vision. */
	function request(payload: SendPayload, text = '') {
		notice = '';
		if (aiState.generating) {
			pending = { payload, text };
			busyOpen = true;
			return;
		}
		if (!aiState.settings.model) {
			notice = 'Сначала выберите модель.';
			return;
		}
		if (!aiState.modelAvailable) {
			notice = 'Выбранная модель недоступна у поставщика — выберите другую.';
			return;
		}
		if (
			aiState.settings.sections.includes('attachments') &&
			supportsVision(aiState.settings.model) !== 'yes' &&
			hasAttachments()
		) {
			pending = { payload, text };
			visionOpen = true;
			return;
		}
		void run(payload, text);
	}

	async function run(payload: SendPayload, text = '') {
		const prev = input;
		if (payload.kind === 'free') input = ''; // поле чистим сразу — не ждём конца генерации
		try {
			await send(getTrades(), dayNote(), payload, text);
		} catch (e) {
			if (payload.kind === 'free') input = prev; // предусловия не прошли — возвращаем текст
			notice = e instanceof Error ? e.message : String(e);
		}
	}

	function onComposerKey(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			submit();
		}
	}

	function submit() {
		const text = input.trim();
		if (!text) return;
		request({ kind: 'free' }, text);
	}

	function focusInput() {
		composerEl?.focus();
	}

	function stopAndStart() {
		busyOpen = false;
		const p = pending;
		pending = null;
		stopGenerating();
		if (p) setTimeout(() => void run(p.payload, p.text), 60);
	}

	function sendWithoutImages() {
		visionOpen = false;
		// Вложения не отправляются: модель без vision — контекст уходит текстом.
		const p = pending;
		pending = null;
		if (p) void run(p.payload, p.text);
	}

	function pickVisionModel() {
		visionOpen = false;
		notice = 'Выберите модель с поддержкой изображений в селекторе модели.';
	}

	function modelCaption(m: { model?: string | null; thinking?: string | null }): string {
		return [m.model, m.thinking].filter(Boolean).join(' · ');
	}

	function usageLine(u: { prompt: number; completion: number; total: number; cost: number | null }): string {
		const tokens = `токены: ${u.prompt} → ${u.completion} (всего ${u.total})`;
		const cost = u.cost != null ? ` · стоимость: $${u.cost.toFixed(4)}` : ' · стоимость неизвестна';
		return tokens + cost;
	}
</script>

<div class="ai-page">
	{#if !aiState.keyReady}
		<!-- Нет ключа: поле ввода ключа во весь блок вкладки -->
		<div class="full-block">
			<ConnectCard />
		</div>
	{:else if !aiState.settings.consent}
		<!-- Первое согласие: перекрывает чат до «Согласен» -->
		<ConsentGate />
	{:else}
		<div class="shell">
			<aside class="side">
				<button type="button" class="new" onclick={() => selectSession(null)}>+ Новая сессия</button>
				<SessionList />
			</aside>

			<section class="chat">
				<header class="chat-head">
					<ModelPicker session />
					{#if session}
						<span class="title">{session.title}</span>
					{/if}
				</header>

				{#if !session}
					<!-- Пустое состояние -->
					<div class="empty-state">
						<p class="hero">Журнал готов к разбору</p>
						<p class="sub">
							Спросите что угодно о сделках — или начните с быстрого действия.
							{journalState.count} сделок в журнале.
						</p>
						<div class="composer big">
							<textarea
								bind:this={composerEl}
								bind:value={input}
								rows="3"
								placeholder="Спросить о журнале…"
								onkeydown={onComposerKey}></textarea>
							<button type="button" class="send" onclick={submit}>Отправить</button>
						</div>
						<p class="quick-hint">Или быстрые действия:</p>
						<QuickActions
							{openTrades}
							send={(p) => request(p)}
							focusInput={focusInput}
						/>
					</div>
				{:else}
					<div class="messages">
						{#each messages as m (m.id)}
							{#if m.role === 'user'}
								<div class="msg user">
									<p class="body">{m.content}</p>
									<p class="meta">
										{m.contextChars
											? `отправлено с контекстом журнала: ${m.contextChars} симв.`
											: 'без контекста журнала'}
									</p>
								</div>
							{:else}
								<div class="msg assistant" class:error={m.status === 'error'}>
									<p class="body">
										{m.content || (m.status === 'error' ? '' : aiState.generating ? '…' : '')}
									</p>
									{#if m.status === 'stopped'}<p class="badge">Ответ остановлен</p>{/if}
									{#if m.status === 'error'}
										<p class="badge err">{m.errorNote || 'Ошибка запроса'}</p>
										{#if aiState.lastError?.body}
											<details class="body-note">
												<summary>Ответ провайдера</summary>
												<pre>{aiState.lastError.body}</pre>
											</details>
										{/if}
									{/if}
									<p class="meta">
										{modelCaption(m)}
										{#if m.usage}<span> · {usageLine(m.usage)}</span>{/if}
									</p>
								</div>
							{/if}
						{/each}
					</div>

					{#if aiState.streamFallback}
						<p class="notice">Провайдер не поддержал потоковую передачу — ответ получен целиком.</p>
					{/if}
					{#if notice}<p class="notice err">{notice}</p>{/if}

					<div class="composer">
						<textarea
							bind:this={composerEl}
							bind:value={input}
							rows="3"
							placeholder="Спросить о журнале…"
							onkeydown={onComposerKey}></textarea>
						{#if aiState.generating}
							<button type="button" class="stop" onclick={stopGenerating}>Остановить</button>
						{:else}
							<button type="button" class="send" onclick={submit}>Отправить</button>
						{/if}
					</div>
					<div class="quick-row">
						<QuickActions {openTrades} send={(p) => request(p)} focusInput={focusInput} />
					</div>
				{/if}
			</section>
		</div>

		<!-- Параллельный запрос: остановить текущий или дождаться -->
		<Modal bind:open={busyOpen} title="Идёт генерация" size="sm" onClose={() => (busyOpen = false)}>
			<p class="dlg-text">
				Сейчас выполняется запрос. Остановить его и отправить новый — или дождаться
				завершения?
			</p>
			{#snippet footer()}
				<button type="button" class="btn" onclick={() => { busyOpen = false; pending = null; }}>
					Дождаться
				</button>
				<button type="button" class="btn primary" onclick={stopAndStart}>
					Остановить и отправить
				</button>
			{/snippet}
		</Modal>

		<!-- Модель без поддержки изображений -->
		<Modal
			bind:open={visionOpen}
			title="Вложения и модель"
			size="sm"
			onClose={() => { visionOpen = false; pending = null; }}
		>
			<p class="dlg-text">
				В разрешённых данных есть вложения, но выбранная модель не поддерживает
				изображения (или это неизвестно). Убрать вложения из запроса или выбрать
				vision-модель?
			</p>
			{#snippet footer()}
				<button type="button" class="btn" onclick={pickVisionModel}>Выбрать другую модель</button>
				<button type="button" class="btn primary" onclick={sendWithoutImages}>
					Убрать вложения
				</button>
			{/snippet}
		</Modal>
	{/if}
</div>

<style>
	.ai-page {
		position: relative;
		min-height: calc(100dvh - var(--topbar-h) - 44px);
	}
	.full-block {
		display: flex;
		justify-content: center;
		padding: clamp(20px, 6vh, 60px) var(--sp-md);
	}
	.full-block :global(.connect) {
		width: 100%;
		max-width: 560px;
		padding: clamp(18px, 3vw, 28px);
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-card);
		background: var(--panel-solid);
	}

	.shell {
		display: grid;
		grid-template-columns: 220px 1fr;
		gap: var(--sp-lg);
		align-items: start;
	}
	.side {
		position: sticky;
		top: calc(var(--topbar-h) + var(--sp-sm));
		display: flex;
		flex-direction: column;
		gap: var(--sp-sm);
		max-height: calc(100dvh - var(--topbar-h) - 40px);
		min-height: 0;
	}
	.new {
		padding: 7px 10px;
		font-size: 0.74rem;
		text-align: left;
		color: var(--ink);
		background: var(--panel);
		border: 1px solid var(--line);
		border-radius: 2px;
		cursor: pointer;
	}
	.new:hover {
		border-color: var(--line-strong);
	}

	.chat {
		display: flex;
		flex-direction: column;
		min-width: 0;
		min-height: calc(100dvh - var(--topbar-h) - 48px);
	}
	.chat-head {
		display: flex;
		align-items: center;
		gap: var(--sp-sm);
		padding-bottom: var(--sp-sm);
		border-bottom: 1px solid var(--line);
		margin-bottom: var(--sp-md);
	}
	.title {
		font-size: 0.78rem;
		color: var(--ink-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.empty-state {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 12px;
		padding: 6vh 0;
		text-align: center;
	}
	.hero {
		margin: 0;
		font-family: var(--font-display);
		font-size: clamp(1.6rem, 3vw, 2.2rem);
		letter-spacing: -0.02em;
	}
	.sub {
		margin: 0;
		max-width: 460px;
		font-size: 0.8rem;
		color: var(--ink-muted);
	}
	.quick-hint {
		margin: 8px 0 0;
		font-family: var(--font-mono);
		font-size: 0.62rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--ink-muted);
	}

	.messages {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: var(--sp-md);
		padding-bottom: var(--sp-md);
	}
	.msg {
		border-left: 2px solid var(--line);
		padding: 2px 0 2px 12px;
	}
	.msg.user {
		border-left-color: var(--accent);
	}
	.msg.assistant {
		border-left-color: var(--sage);
	}
	.msg.error {
		border-left-color: var(--danger);
	}
	.body {
		margin: 0;
		font-size: 0.9rem;
		line-height: 1.6;
		white-space: pre-wrap;
		word-break: break-word;
	}
	.meta {
		margin: 6px 0 0;
		font-family: var(--font-mono);
		font-size: 0.64rem;
		letter-spacing: 0.04em;
		color: var(--ink-muted);
	}
	.badge {
		margin: 6px 0 0;
		font-size: 0.72rem;
		color: var(--status-amber);
	}
	.badge.err {
		color: var(--danger);
	}
	.body-note {
		margin-top: 6px;
		font-size: 0.7rem;
		color: var(--ink-muted);
	}
	.body-note summary {
		cursor: pointer;
	}
	.body-note pre {
		max-height: 180px;
		overflow: auto;
		margin: 6px 0 0;
		padding: 8px;
		background: var(--panel);
		border: 1px solid var(--line);
		border-radius: 2px;
		font-size: 0.66rem;
		white-space: pre-wrap;
		word-break: break-word;
	}
	.notice {
		margin: 0 0 var(--sp-sm);
		font-size: 0.74rem;
		color: var(--status-amber);
	}
	.notice.err {
		color: var(--danger);
	}

	.composer {
		display: flex;
		align-items: flex-end;
		gap: var(--sp-sm);
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-card);
		background: var(--panel-solid);
		padding: 10px;
	}
	.composer.big {
		width: min(640px, 100%);
		margin-top: 8px;
	}
	.composer textarea {
		flex: 1;
		width: auto;
		background: transparent;
		border: none;
		color: var(--ink);
		font: inherit;
		font-size: 0.88rem;
		line-height: 1.5;
		resize: none;
		padding: 4px 2px;
	}
	.composer textarea:focus {
		outline: none;
	}
	.send,
	.stop {
		flex-shrink: 0;
		padding: 8px 16px;
		font-size: 0.76rem;
		border: none;
		border-radius: 2px;
		cursor: pointer;
	}
	.send {
		color: var(--bg);
		background: var(--sage);
	}
	.stop {
		color: var(--ink);
		background: transparent;
		border: 1px solid var(--danger);
	}
	.quick-row {
		margin-top: var(--sp-sm);
	}
	.dlg-text {
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
	.btn.primary {
		color: var(--bg);
		background: var(--sage);
		border-color: var(--sage);
	}

	@media (max-width: 900px) {
		.shell {
			grid-template-columns: 1fr;
		}
		.side {
			position: static;
			max-height: none;
		}
	}
</style>
