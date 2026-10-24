<script lang="ts">
	/**
	 * Быстрые кнопки: фиксированный набор действий.
	 * «Анализ открытых сделок» — селект «Все открытые»/конкретная сделка,
	 * «Итоги за период» — пресеты периода + свой диапазон.
	 */
	import { aiState } from '#lib/ai/store.svelte.ts';
	import type { SendPayload } from '#lib/ai/store.svelte.ts';
	import { formatMoney, tradeProfit, type Trade } from '#lib/domain/trades.ts';

	interface Props {
		openTrades: Trade[];
		send: (payload: SendPayload) => void;
		/** Запрос по свободному вводу — фокус в поле ввода. */
		focusInput: () => void;
	}

	let { openTrades, send, focusInput }: Props = $props();

	let panel = $state<'none' | 'open' | 'summary'>('none');
	let tradeChoice = $state<string>('all');
	let periodChoice = $state<string>('7');
	let fromDate = $state('');
	let toDate = $state('');

	const PERIODS = [
		{ id: '1', label: 'Сегодня', days: 1 },
		{ id: '7', label: '7 дней', days: 7 },
		{ id: '30', label: '30 дней', days: 30 },
		{ id: 'month', label: 'Месяц', days: 30 },
		{ id: 'quarter', label: 'Квартал', days: 90 },
		{ id: 'year', label: 'Год', days: 365 },
		{ id: 'all', label: 'Весь журнал', days: null },
		{ id: 'custom', label: 'Свой диапазон', days: null }
	] as const;

	const noModel = $derived(!aiState.settings.model);
	const noTrades = $derived(openTrades.length === 0);

	function blockReason(kind: 'open'): string | null {
		if (noModel) return 'Сначала выберите модель';
		if (kind === 'open' && noTrades) return 'Нет открытых сделок';
		return null;
	}

	function label(t: Trade): string {
		const p = tradeProfit(t);
		return `${t.pair} ${t.direction === 'short' ? 'short' : 'long'} ${t.volume} · ${p >= 0 ? '+' : '−'}${formatMoney(Math.abs(p))}`;
	}

	function submitOpen() {
		const ids = tradeChoice === 'all' ? [] : [tradeChoice];
		send({ kind: 'analyze-open', tradeIds: ids });
		panel = 'none';
	}

	function submitSummary() {
		const p = PERIODS.find((x) => x.id === periodChoice) ?? PERIODS[1];
		if (p.id === 'custom') {
			const days =
				fromDate && toDate
					? Math.max(
							1,
							Math.ceil(
								(new Date(toDate).getTime() - new Date(fromDate).getTime()) / 86_400_000
							) + 1
						)
					: null;
			send({
				kind: 'summary',
				periodDays: days,
				periodLabel: fromDate && toDate ? `${fromDate} — ${toDate}` : 'выбранный диапазон'
			});
		} else {
			send({ kind: 'summary', periodDays: p.days, periodLabel: p.label.toLowerCase() });
		}
		panel = 'none';
	}
</script>

<div class="quick">
	<button
		type="button"
		class="q"
		disabled={!!blockReason('open')}
		title={blockReason('open') ?? ''}
		onclick={() => (panel = panel === 'open' ? 'none' : 'open')}
	>
		Анализ открытых сделок
	</button>
	<button type="button" class="q" disabled={noModel} title={noModel ? 'Сначала выберите модель' : ''} onclick={() => send({ kind: 'mistakes' })}>
		Ошибки и паттерны
	</button>
	<button
		type="button"
		class="q"
		disabled={noModel}
		title={noModel ? 'Сначала выберите модель' : ''}
		onclick={() => (panel = panel === 'summary' ? 'none' : 'summary')}
	>
		Итоги за период
	</button>
	<button type="button" class="q" disabled={noModel} title={noModel ? 'Сначала выберите модель' : ''} onclick={() => send({ kind: 'advice' })}>
		Рекомендации
	</button>
	<button type="button" class="q" onclick={focusInput}>Вопрос по журналу</button>
</div>

{#if panel === 'open'}
	<div class="panel">
		<label>
			<span class="lbl">Сделка</span>
			<select bind:value={tradeChoice}>
				<option value="all">Все открытые ({openTrades.length})</option>
				{#each openTrades as t (t.id)}
					<option value={t.id}>{label(t)}</option>
				{/each}
			</select>
		</label>
		<button type="button" class="primary" onclick={submitOpen}>Отправить</button>
	</div>
{/if}

{#if panel === 'summary'}
	<div class="panel">
		<div class="chips">
			{#each PERIODS as p (p.id)}
				<button
					type="button"
					class="chip"
					class:active={periodChoice === p.id}
					onclick={() => (periodChoice = p.id)}>{p.label}</button
				>
			{/each}
		</div>
		{#if periodChoice === 'custom'}
			<div class="dates">
				<input type="date" bind:value={fromDate} aria-label="С даты" />
				<span class="dash">—</span>
				<input type="date" bind:value={toDate} aria-label="По дату" />
			</div>
		{/if}
		<button type="button" class="primary" onclick={submitSummary}>Отправить</button>
	</div>
{/if}

<style>
	.quick {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		justify-content: center;
	}
	.q {
		padding: 7px 13px;
		font-size: 0.74rem;
		color: var(--ink-muted);
		background: var(--panel);
		border: 1px solid var(--line);
		border-radius: 9999px;
		cursor: pointer;
		transition:
			color 0.2s,
			border-color 0.2s;
	}
	.q:hover:not(:disabled) {
		color: var(--ink);
		border-color: var(--line-strong);
	}
	.q:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.panel {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin-top: 10px;
		padding: 12px;
		border: 1px solid var(--line);
		border-radius: var(--radius-card);
		background: var(--panel-solid);
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.lbl {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--ink-muted);
	}
	select,
	input[type='date'] {
		background: transparent;
		border: 1px solid var(--line);
		border-radius: 2px;
		color: var(--ink);
		font: inherit;
		font-size: 0.8rem;
		padding: 6px 8px;
	}
	select:focus,
	input:focus {
		outline: none;
		border-color: var(--line-strong);
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}
	.chip {
		padding: 4px 10px;
		font-size: 0.7rem;
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
	.dates {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.dash {
		color: var(--ink-muted);
	}
	.primary {
		align-self: flex-start;
		padding: 7px 18px;
		font-size: 0.76rem;
		color: var(--bg);
		background: var(--sage);
		border: none;
		border-radius: 2px;
		cursor: pointer;
	}
</style>
