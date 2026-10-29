<script lang="ts">
	/**
	 * Форма записи дневника: создание и редактирование.
	 * Ошибки пользователю — без внутренних деталей.
	 */
	import { untrack } from 'svelte';
	import Modal from './Modal.svelte';
	import { DIARY_KINDS, type DiaryEntry, type DiaryKind } from '#lib/domain/diary.ts';
	import { formatDate, tradeProfit } from '#lib/domain/trades.ts';

	interface Props {
		open?: boolean;
		/** Редактируемая запись; null — новая. */
		entry?: DiaryEntry | null;
		/** День, на который создаётся запись ('YYYY-MM-DD'), если он выбран в ленте. */
		defaultDay?: string | null;
		/** Словарь тегов дневника — подсказки при вводе. */
		tags?: string[];
		/** Сделки для опциональной привязки. */
		trades?: { id: string; label: string }[];
		onSave?: (patch: Partial<DiaryEntry>) => void;
		onClose?: () => void;
	}

	let {
		open = $bindable(false),
		entry = null,
		defaultDay = null,
		tags = [],
		trades = [],
		onSave = () => {},
		onClose = () => {}
	}: Props = $props();

	interface Form {
		id: string;
		kind: DiaryKind;
		/** datetime-local: 'YYYY-MM-DDTHH:mm' */
		at: string;
		text: string;
		mistakeWhat: string;
		mistakeWhy: string;
		mistakeFix: string;
		tagsText: string;
		discipline: number;
		calm: number;
		followedPlan: 'yes' | 'no' | 'unset';
		tradeIds: string[];
	}

	let form = $state<Form | null>(null);
	let errorMsg = $state('');
	let tradePick = $state('');
	// Тип держим отдельным состоянием: от него зависит набор полей формы,
	// и выведенное значение из вложенного объекта обновлялось не всегда.
	let kind = $state<DiaryKind>('note');

	const toLocalInput = (stamp: string) => (stamp ? String(stamp).replace(' ', 'T').slice(0, 16) : '');
	const fromLocalInput = (v: string) => (v ? `${String(v).replace('T', ' ')}:00` : '');

	function blank(): Form {
		const day = defaultDay || new Date().toISOString().slice(0, 10);
		return {
			id: '',
			kind: 'note',
			at: `${day}T${new Date().toTimeString().slice(0, 5)}`,
			text: '',
			mistakeWhat: '',
			mistakeWhy: '',
			mistakeFix: '',
			tagsText: '',
			discipline: 3,
			calm: 3,
			followedPlan: 'unset',
			tradeIds: []
		};
	}

	$effect(() => {
		if (!open) return;
		form = entry
			? {
					id: entry.id,
					kind: entry.kind,
					at: toLocalInput(entry.at),
					text: entry.text,
					mistakeWhat: entry.mistakeWhat,
					mistakeWhy: entry.mistakeWhy,
					mistakeFix: entry.mistakeFix,
					tagsText: entry.tags.join(', '),
					discipline: entry.discipline ?? 3,
					calm: entry.calm ?? 3,
					followedPlan: entry.followedPlan === true ? 'yes' : entry.followedPlan === false ? 'no' : 'unset',
					tradeIds: [...entry.tradeIds]
				}
			: blank();
		kind = untrack(() => form!.kind);
		tradePick = '';
		errorMsg = '';
	});

	const isNew = $derived(!form?.id);
	const isMistake = $derived(kind === 'mistake');

	// Смена типа с селекта: пишем в оба места — состояние и форму
	function setKind(next: DiaryKind) {
		kind = next;
		if (form) form = { ...form, kind: next };
	}

	function parseTags(raw: string): string[] {
		return [...new Set(raw.split(',').map((t) => t.trim()).filter(Boolean))].slice(0, 20);
	}

	function addTrade(id: string) {
		if (!form || !id || form.tradeIds.includes(id)) return;
		form = { ...form, tradeIds: [...form.tradeIds, id] };
		tradePick = '';
	}

	function removeTrade(id: string) {
		if (!form) return;
		form = { ...form, tradeIds: form.tradeIds.filter((t) => t !== id) };
	}

	function submit() {
		if (!form) return;
		const at = fromLocalInput(form.at);
		if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(at)) {
			errorMsg = 'Дата и время: формат ГГГГ-ММ-ДД ЧЧ:ММ';
			return;
		}
		const hasBody = [form.text, form.mistakeWhat, form.mistakeWhy, form.mistakeFix].some(
			(v) => v.trim() !== ''
		);
		if (!hasBody) {
			errorMsg = 'Запись пустая — нужен хотя бы текст';
			return;
		}
		errorMsg = '';
		onSave({
			...(form.id ? { id: form.id } : {}),
			kind: kind,
			at,
			text: form.text.trim(),
			mistakeWhat: form.kind === 'mistake' ? form.mistakeWhat.trim() : '',
			mistakeWhy: form.kind === 'mistake' ? form.mistakeWhy.trim() : '',
			mistakeFix: form.kind === 'mistake' ? form.mistakeFix.trim() : '',
			tags: parseTags(form.tagsText),
			discipline: form.discipline,
			calm: form.calm,
			followedPlan: form.followedPlan === 'unset' ? null : form.followedPlan === 'yes',
			tradeIds: form.tradeIds
		});
		open = false;
	}

	function close() {
		open = false;
		onClose();
	}

	const tradeLabel = (id: string) => trades.find((t) => t.id === id)?.label ?? id;
</script>

{#if form}
	<Modal
		bind:open
		title={isNew ? 'Новая запись' : 'Запись дневника'}
		subtitle={isNew ? 'Дневник · локально' : formatDate(form.at.replace('T', ' '))}
		size="md"
		onClose={close}
	>
		<div class="grid">
			<label class="f wide">
				<span>Тип</span>
				<select value={kind} onchange={(e) => setKind(e.currentTarget.value as DiaryKind)}>
					{#each DIARY_KINDS as k (k.id)}
						<option value={k.id}>{k.label} — {k.hint}</option>
					{/each}
				</select>
			</label>

			<label class="f">
				<span>Дата и время</span>
				<input type="datetime-local" bind:value={form.at} required />
			</label>

			<label class="f">
				<span>Следование плану</span>
				<select bind:value={form.followedPlan}>
					<option value="unset">Не отмечено</option>
					<option value="yes">Да</option>
					<option value="no">Нет</option>
				</select>
			</label>

			{#if isMistake}
				<label class="f wide">
					<span>Что случилось</span>
					<textarea rows="2" bind:value={form.mistakeWhat}></textarea>
				</label>
				<label class="f wide">
					<span>Почему</span>
					<textarea rows="2" bind:value={form.mistakeWhy}></textarea>
				</label>
				<label class="f wide">
					<span>Что изменю</span>
					<textarea rows="2" bind:value={form.mistakeFix}></textarea>
				</label>
			{/if}

			<label class="f wide">
				<span>{isMistake ? 'Заметка' : 'Текст'}</span>
				<textarea rows="4" bind:value={form.text} placeholder="Своими словами, без цензуры…"></textarea>
			</label>

			<label class="f wide">
				<span>Теги (через запятую)</span>
				<input list="diary-tags" bind:value={form.tagsText} placeholder="психология, риск" />
				<datalist id="diary-tags">
					{#each tags as t (t)}<option value={t}></option>{/each}
				</datalist>
			</label>

			<div class="f">
				<span>Дисциплина</span>
				<div class="scale" role="group" aria-label="Дисциплина 1–5">
					{#each [1, 2, 3, 4, 5] as v (v)}
						<button
							type="button"
							class="scale-btn"
							class:on={form.discipline === v}
							aria-pressed={form.discipline === v}
							onclick={() => (form = { ...form!, discipline: v })}>{v}</button
						>
					{/each}
				</div>
			</div>

			<div class="f">
				<span>Спокойствие</span>
				<div class="scale" role="group" aria-label="Спокойствие 1–5">
					{#each [1, 2, 3, 4, 5] as v (v)}
						<button
							type="button"
							class="scale-btn"
							class:on={form.calm === v}
							aria-pressed={form.calm === v}
							onclick={() => (form = { ...form!, calm: v })}>{v}</button
						>
					{/each}
				</div>
			</div>

			<div class="f wide">
				<span>Связанные сделки</span>
				{#if trades.length}
					<div class="trade-row">
						<select bind:value={tradePick} onchange={(e) => addTrade(e.currentTarget.value)}>
							<option value="">— добавить сделку —</option>
							{#each trades as t (t.id)}
								<option value={t.id}>{t.label}</option>
							{/each}
						</select>
					</div>
				{:else}
					<p class="note">В журнале пока нет сделок</p>
				{/if}
				{#if form.tradeIds.length}
					<ul class="chips">
						{#each form.tradeIds as id (id)}
							<li>
								<span>{tradeLabel(id)}</span>
								<button type="button" class="x" onclick={() => removeTrade(id)} aria-label="Отвязать сделку"
									>✕</button
								>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</div>

		{#if errorMsg}
			<p class="err" role="alert">{errorMsg}</p>
		{/if}

		{#snippet footer()}
			<div class="spacer"></div>
			<button type="button" class="btn" onclick={close}>Отмена</button>
			<button type="button" class="btn primary" onclick={submit}>{isNew ? 'Создать' : 'Сохранить'}</button>
		{/snippet}
	</Modal>
{/if}

<style>
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
		gap: 0.7rem;
	}
	.f {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}
	.f.wide {
		grid-column: 1 / -1;
	}
	.f > span {
		font-family: var(--font-mono);
		font-size: 0.66rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--ink-muted);
	}
	input,
	select,
	textarea {
		font-family: var(--font-mono);
		font-size: 0.78rem;
		color: var(--ink);
		background: transparent;
		border: 1px solid var(--line);
		border-radius: 2px;
		padding: 0.35rem 0.45rem;
		width: 100%;
	}
	input:focus,
	select:focus,
	textarea:focus {
		outline: none;
		border-color: var(--line-strong);
	}
	textarea {
		resize: vertical;
	}
	.scale {
		display: flex;
		gap: 0.3rem;
	}
	.scale-btn {
		flex: 1;
		padding: 0.3rem 0;
		font-family: var(--font-mono);
		font-size: 0.7rem;
		color: var(--ink-muted);
		background: transparent;
		border: 1px solid var(--line);
		border-radius: 2px;
		cursor: pointer;
		transition: color 0.2s, border-color 0.2s, background 0.2s;
	}
	.scale-btn:hover {
		color: var(--ink);
		border-color: var(--line-strong);
	}
	.scale-btn.on {
		background: var(--sage);
		border-color: var(--sage);
		color: var(--bg);
	}
	.trade-row {
		display: flex;
		gap: 0.4rem;
	}
	.chips {
		list-style: none;
		margin: 0.45rem 0 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}
	.chips li {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-family: var(--font-mono);
		font-size: 0.66rem;
		padding: 0.22rem 0.4rem;
		border: 1px solid var(--line);
		border-radius: 2px;
		color: var(--ink-muted);
	}
	.chips .x {
		width: auto;
		padding: 0;
		border: none;
		background: transparent;
		color: inherit;
		font-size: 0.6rem;
		line-height: 1;
	}
	.note {
		margin: 0;
		font-family: var(--font-mono);
		font-size: 0.7rem;
		color: var(--ink-muted);
	}
	.err {
		margin-top: 0.7rem;
		font-family: var(--font-mono);
		font-size: 0.7rem;
		color: var(--danger);
	}
	.spacer {
		flex: 1;
	}
</style>
