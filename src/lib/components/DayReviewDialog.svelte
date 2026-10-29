<script lang="ts">
	/**
	 * «Разбор дня»: утренний план и вечерний итог в одной записи на день.
	 * Итоги дня (P/L, сделки, killzone) подтягиваются из журнала — не вводятся руками.
	 * Ошибки пользователю — без внутренних деталей.
	 */
	import Modal from './Modal.svelte';
	import {
		CHECKLIST_OPTIONS,
		type ChecklistAnswer,
		type DiaryEntry,
		type DayTotals
	} from '#lib/domain/diary.ts';
	import { formatMoney } from '#lib/domain/trades.ts';

	interface Props {
		open?: boolean;
		/** День 'YYYY-MM-DD'. */
		day?: string;
		/** Существующий разбор этого дня; null — новый. */
		entry?: DiaryEntry | null;
		/** Авто-итоги дня из сделок. */
		totals?: DayTotals;
		tags?: string[];
		onSave?: (patch: Partial<DiaryEntry>) => void;
		onClose?: () => void;
	}

	let {
		open = $bindable(false),
		day = '',
		entry = null,
		totals = { profit: 0, count: 0, closed: 0, wins: 0, losses: 0, killzones: [], linkedCount: 0 },
		tags = [],
		onSave = () => {},
		onClose = () => {}
	}: Props = $props();

	interface Form {
		dayPlan: string;
		dayResult: string;
		mainMistake: string;
		checklist: ChecklistAnswer | 'unset';
		tagsText: string;
		discipline: number;
		calm: number;
	}

	let form = $state<Form | null>(null);
	let errorMsg = $state('');

	$effect(() => {
		if (!open) return;
		form = entry
			? {
					dayPlan: entry.dayPlan,
					dayResult: entry.dayResult,
					mainMistake: entry.mainMistake,
					checklist: entry.checklist ?? 'unset',
					tagsText: entry.tags.join(', '),
					discipline: entry.discipline ?? 3,
					calm: entry.calm ?? 3
				}
			: { dayPlan: '', dayResult: '', mainMistake: '', checklist: 'unset', tagsText: '', discipline: 3, calm: 3 };
		errorMsg = '';
	});

	const dayLabel = $derived(
		day ? new Date(`${day}T00:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'long' }) : ''
	);

	function parseTags(raw: string): string[] {
		return [...new Set(raw.split(',').map((t) => t.trim()).filter(Boolean))].slice(0, 20);
	}

	function submit() {
		if (!form) return;
		const hasBody = [form.dayPlan, form.dayResult, form.mainMistake].some((v) => v.trim() !== '');
		if (!hasBody) {
			errorMsg = 'Разбор пустой — нужен план, итог или ошибка дня';
			return;
		}
		errorMsg = '';
		onSave({
			id: entry?.id,
			kind: 'day',
			at: `${day} 00:00:00`,
			dayPlan: form.dayPlan.trim(),
			dayResult: form.dayResult.trim(),
			mainMistake: form.mainMistake.trim(),
			checklist: form.checklist === 'unset' ? null : form.checklist,
			tags: parseTags(form.tagsText),
			discipline: form.discipline,
			calm: form.calm
		});
		open = false;
	}

	function close() {
		open = false;
		onClose();
	}

	const plLabel = $derived(formatMoney(totals.profit, 'USD', true));
</script>

{#if form}
	<Modal
		bind:open
		title="Разбор дня"
		subtitle={dayLabel}
		size="md"
		onClose={close}
	>
		<!-- Авто-итоги дня: из сделок, только чтение -->
		<div class="totals" aria-label="Итоги дня из журнала">
			<div class="total">
				<span class="t-label">P/L дня</span>
				<span class="t-value" class:neg={totals.profit < 0}>{totals.count ? plLabel : '—'}</span>
			</div>
			<div class="total">
				<span class="t-label">Сделок</span>
				<span class="t-value">{totals.count}</span>
			</div>
			<div class="total">
				<span class="t-label">W / L</span>
				<span class="t-value">{totals.wins} / {totals.losses}</span>
			</div>
			<div class="total wide">
				<span class="t-label">Killzone</span>
				<span class="t-value small">{totals.killzones.length ? totals.killzones.join(' · ') : 'входов не было'}</span>
			</div>
		</div>

		<div class="grid">
			<label class="f wide">
				<span>Утренний план</span>
				<textarea
					rows="2"
					bind:value={form.dayPlan}
					placeholder="Какие сетапы ищу, где вход, что не делаю…"
				></textarea>
			</label>

			<label class="f wide">
				<span>Вечерний итог</span>
				<textarea rows="2" bind:value={form.dayResult} placeholder="Что сработало, что нет…"></textarea>
			</label>

			<label class="f wide">
				<span>Главная ошибка дня</span>
				<input bind:value={form.mainMistake} placeholder="Одна, самая дорогая" />
			</label>

			<div class="f wide">
				<span>Соблюдал чек-лист входа</span>
				<div class="scale" role="group" aria-label="Соблюдал чек-лист входа">
					{#each CHECKLIST_OPTIONS as o (o.id)}
						<button
							type="button"
							class="scale-btn"
							class:on={form.checklist === o.id}
							aria-pressed={form.checklist === o.id}
							onclick={() => (form = { ...form!, checklist: form!.checklist === o.id ? 'unset' : o.id })}
							>{o.label}</button
						>
					{/each}
				</div>
			</div>

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

			<label class="f wide">
				<span>Теги (через запятую)</span>
				<input list="day-review-tags" bind:value={form.tagsText} placeholder="риск, лондон" />
				<datalist id="day-review-tags">
					{#each tags as t (t)}<option value={t}></option>{/each}
				</datalist>
			</label>
		</div>

		{#if errorMsg}
			<p class="err" role="alert">{errorMsg}</p>
		{/if}

		{#snippet footer()}
			<div class="spacer"></div>
			<button type="button" class="btn" onclick={close}>Отмена</button>
			<button type="button" class="btn primary" onclick={submit}>Сохранить разбор</button>
		{/snippet}
	</Modal>
{/if}

<style>
	.totals {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
		gap: 1px;
		background: var(--line);
		border: 1px solid var(--line);
		margin-bottom: 0.9rem;
	}
	.total {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		padding: 0.5rem 0.6rem;
		background: var(--bg);
	}
	.total.wide {
		grid-column: 1 / -1;
	}
	.t-label {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--ink-muted);
	}
	.t-value {
		font-family: var(--font-display);
		font-size: 1.15rem;
		line-height: 1.1;
	}
	.t-value.small {
		font-size: 0.9rem;
	}
	.t-value.neg {
		color: var(--danger);
	}

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
	.err {
		margin-top: 0.7rem;
		font-family: var(--font-mono);
		font-size: 0.7rem;
		color: var(--danger);
	}
</style>
