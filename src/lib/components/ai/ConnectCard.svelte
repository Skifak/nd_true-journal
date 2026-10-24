<script lang="ts">
	/**
	 * Подключение к OpenAI-compatible endpoint: Base URL + ключ + проверка
	 * GET /models, затем ЯВНЫЙ выбор места хранения ключа (в памяти / на устройстве).
	 * Используется во вкладке AI (во весь блок при отсутствии ключа) и в настройках.
	 */
	import { aiState, probe, persistKey, forgetKey, effectiveBaseUrl } from '#lib/ai/store.svelte.ts';
	import { isTauri } from '#lib/platform/index.ts';

	let baseUrl = $state(aiState.settings.baseUrl);
	let apiKey = $state('');
	let place = $state<'memory' | 'device'>('memory');
	let checking = $state(false);
	let successCount = $state<number | null>(null);
	let savedTo = $state<'memory' | 'device' | null>(null);
	let fail = $state<{ message: string; body: string } | null>(null);

	// Заявка на сохранение/смена места уже подключённого ключа
	let changingPlace = $state(false);
	const showPlaceChoice = $derived(successCount != null || changingPlace);
	const connected = $derived(aiState.keyReady);

	async function check() {
		checking = true;
		fail = null;
		successCount = null;
		savedTo = null;
		try {
			successCount = await probe(baseUrl, apiKey);
			apiKey = '';
			place = 'memory';
		} catch (e) {
			fail = {
				message: e instanceof Error ? e.message : String(e),
				body: (e as { body?: string }).body ?? ''
			};
		} finally {
			checking = false;
		}
	}

	async function savePlace() {
		await persistKey(place);
		savedTo = place;
		changingPlace = false;
	}

	async function removeKey() {
		await forgetKey();
		successCount = null;
		savedTo = null;
		changingPlace = false;
	}
</script>

<div class="connect">
	<p class="eyebrow">Подключение к AI-провайдеру (OpenAI-compatible API)</p>

	{#if !connected}
		<div class="fields">
			<label>
				<span class="lbl">Base URL</span>
				<input
					type="url"
					placeholder="https://api.openai.com/v1"
					bind:value={baseUrl}
					disabled={checking}
				/>
			</label>
			<label>
				<span class="lbl">API-ключ</span>
				<input
					type="password"
					placeholder="sk-…"
					autocomplete="off"
					bind:value={apiKey}
					disabled={checking}
				/>
			</label>
			<button type="button" class="primary" disabled={checking || !apiKey.trim()} onclick={check}>
				{checking ? 'Проверка…' : 'Проверить подключение'}
			</button>
		</div>
	{:else}
		<p class="ok-line">
			Подключено: {effectiveBaseUrl()} · хранится
			{aiState.keyPlace === 'device' ? 'на устройстве' : 'только в памяти'}
		</p>
		<div class="row-btns">
			<button type="button" class="link-btn" onclick={() => (changingPlace = !changingPlace)}>
				Изменить место хранения
			</button>
			<button type="button" class="danger-link" onclick={removeKey}>
				Удалить ключ и отключить AI
			</button>
		</div>
	{/if}

	{#if successCount != null}
		<p class="footnote ok">Успешное подключение! Доступно моделей: {successCount}.</p>
	{/if}

	{#if showPlaceChoice}
		<div class="store">
			<p class="lbl">Где хранить ключ?</p>
			<label class="radio">
				<input type="radio" bind:group={place} value="memory" />
				<span>Только в памяти — до закрытия приложения</span>
			</label>
			<label class="radio">
				<input type="radio" bind:group={place} value="device" />
				<span
					>Сохранить на устройстве
					{isTauri() ? '(файл AppData, открытый текст, без шифрования)' : '(localStorage браузера)'}</span
				>
			</label>
			{#if place === 'device'}
				<p class="hint warn-hint">
					Ключ на устройстве хранится открытым текстом и может быть прочитан при
					доступе к профилю ОС.
				</p>
			{/if}
			<div class="row-btns">
				<button type="button" class="primary small" onclick={savePlace}>Применить</button>
				{#if changingPlace}
					<button type="button" class="link-btn" onclick={() => (changingPlace = false)}>
						Отмена
					</button>
				{/if}
			</div>
			{#if savedTo}
				<p class="footnote ok">
					Ключ сохранён: {savedTo === 'device' ? 'на устройстве' : 'только в памяти'}.
				</p>
			{/if}
		</div>
	{/if}

	{#if fail}
		<p class="footnote err">{fail.message}</p>
		{#if fail.body}
			<details class="body-note">
				<summary>Ответ провайдера</summary>
				<pre>{fail.body}</pre>
			</details>
		{/if}
	{/if}

	<p class="hint">
		Запросы идут напрямую на Base URL, без прокси TradeJournal. Ключ не отправляется
		никому, кроме указанного адреса.
	</p>
</div>

<style>
	.connect {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.fields {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.lbl {
		font-family: var(--font-mono);
		font-size: 0.64rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--ink-muted);
	}
	input[type='url'],
	input[type='password'] {
		background: transparent;
		border: 1px solid var(--line);
		border-radius: 2px;
		color: var(--ink);
		font: inherit;
		font-size: 0.86rem;
		padding: 8px 10px;
	}
	input:focus {
		outline: none;
		border-color: var(--line-strong);
	}
	.primary {
		align-self: flex-start;
		padding: 8px 16px;
		font-size: 0.78rem;
		letter-spacing: 0.04em;
		color: var(--bg);
		background: var(--sage);
		border: none;
		border-radius: 2px;
		cursor: pointer;
	}
	.primary.small {
		padding: 6px 14px;
		font-size: 0.74rem;
	}
	.primary:disabled {
		opacity: 0.45;
		cursor: default;
	}
	.footnote {
		margin: 0;
		font-size: 0.78rem;
	}
	.footnote.ok {
		color: var(--status-green);
	}
	.footnote.err {
		color: var(--danger);
	}
	.body-note {
		font-size: 0.72rem;
		color: var(--ink-muted);
	}
	.body-note summary {
		cursor: pointer;
		color: var(--ink-muted);
	}
	.body-note pre {
		max-height: 180px;
		overflow: auto;
		margin: 6px 0 0;
		padding: 8px;
		background: var(--panel);
		border: 1px solid var(--line);
		border-radius: 2px;
		font-size: 0.68rem;
		white-space: pre-wrap;
		word-break: break-word;
	}
	.store {
		border-top: 1px solid var(--line);
		padding-top: 10px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.radio {
		flex-direction: row;
		align-items: center;
		gap: 8px;
		font-size: 0.8rem;
	}
	.hint {
		margin: 0;
		font-size: 0.7rem;
		color: var(--ink-muted);
	}
	.warn-hint {
		color: var(--status-amber);
	}
	.ok-line {
		margin: 0;
		font-size: 0.8rem;
		color: var(--status-green);
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
	.row-btns {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
	}
	.link-btn {
		background: none;
		border: none;
		padding: 0;
		font-size: 0.74rem;
		color: var(--ink-muted);
		cursor: pointer;
		text-decoration: underline;
	}
	.link-btn:hover {
		color: var(--ink);
	}
</style>
