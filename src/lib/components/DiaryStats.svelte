<script lang="ts">
	/**
	 * Блоки дневника в сводке: шкалы дисциплины/спокойствия рядом с P/L дня,
	 * топ ошибок за период и средние шкалы по дням недели.
	 * Данные — из diaryStore и journalStore, всё считается на месте.
	 */
	import {
		dayScores,
		topMistakes,
		weekdayScores,
		type DayScore,
		type MistakeStat,
		type WeekdayScore
	} from '#lib/domain/diary.ts';
	import { formatMoney } from '#lib/domain/trades.ts';
	import type { DiaryEntry } from '#lib/domain/diary.ts';
	import type { Trade } from '#lib/domain/trades.ts';

	interface Props {
		entries: DiaryEntry[];
		trades: Trade[];
		/** Начало периода (мс) или undefined — вся история. */
		since?: number;
		loading?: boolean;
	}

	let { entries, trades, since, loading = false }: Props = $props();

	const rows: DayScore[] = $derived(dayScores(entries, trades, since).slice(0, 12));
	const mistakes: MistakeStat[] = $derived(topMistakes(entries, trades, since));
	const week: WeekdayScore[] = $derived(weekdayScores(entries, since));
	const hasScores = $derived(rows.some((r) => r.discipline != null || r.calm != null));
	const weekMax = 5;

	const dayLabel = (day: string) => day.slice(8, 10) + '.' + day.slice(5, 7);
	const sourceLabel = (s: MistakeStat['source']) =>
		s === 'mistake' ? 'ошибка' : s === 'day' ? 'день' : 'тег';
</script>

<div class="panel frame-hover">
	<span class="fh-c fh-tl" aria-hidden="true"></span>
	<span class="fh-c fh-tr" aria-hidden="true"></span>
	<span class="fh-c fh-bl" aria-hidden="true"></span>
	<span class="fh-c fh-br" aria-hidden="true"></span>
	<div class="panel-head">
		<h2 class="panel-title">Дисциплина и спокойствие</h2>
		<span class="eyebrow">по дням рядом с P/L</span>
	</div>

	{#if loading}
		<p class="panel-empty">Загрузка…</p>
	{:else if !rows.length}
		<p class="panel-empty">Нет дней за период — заведите записи в дневнике</p>
	{:else}
		<table class="days">
			<thead>
				<tr>
					<th scope="col">День</th>
					<th scope="col">Дисциплина</th>
					<th scope="col">Спокойствие</th>
					<th scope="col" class="num">P/L дня</th>
				</tr>
			</thead>
			<tbody>
				{#each rows as r (r.day)}
					<tr>
						<th scope="row">
							<span class="wd">{r.weekday}</span>
							<span class="d">{dayLabel(r.day)}</span>
						</th>
						<td>
							{#if r.discipline != null}
								<span class="bar" aria-hidden="true">
									<span class="fill" style:width={`${(r.discipline / weekMax) * 100}%`}></span>
								</span>
								<span class="val">{r.discipline}</span>
							{:else}
								<span class="val muted">—</span>
							{/if}
						</td>
						<td>
							{#if r.calm != null}
								<span class="bar" aria-hidden="true">
									<span class="fill calm" style:width={`${(r.calm / weekMax) * 100}%`}></span>
								</span>
								<span class="val">{r.calm}</span>
							{:else}
								<span class="val muted">—</span>
							{/if}
						</td>
						<td class="num" class:neg={r.profit < 0}>{r.count ? formatMoney(r.profit, 'USD', true) : '—'}</td>
					</tr>
				{/each}
			</tbody>
		</table>
		{#if !hasScores}
			<p class="note">Шкалы пока не ставили — они берутся из записей дневника</p>
		{/if}
	{/if}
</div>

<div class="panel frame-hover">
	<span class="fh-c fh-tl" aria-hidden="true"></span>
	<span class="fh-c fh-tr" aria-hidden="true"></span>
	<span class="fh-c fh-bl" aria-hidden="true"></span>
	<span class="fh-c fh-br" aria-hidden="true"></span>
	<div class="panel-head">
		<h2 class="panel-title">Топ ошибок</h2>
		<span class="eyebrow">за период</span>
	</div>
	{#if loading}
		<p class="panel-empty">Загрузка…</p>
	{:else if !mistakes.length}
		<p class="panel-empty">Ошибок за период нет — это хороший знак</p>
	{:else}
		<ul class="mistakes">
			{#each mistakes as m (m.source + m.label)}
				<li>
					<span class="m-src" data-src={m.source}>{sourceLabel(m.source)}</span>
					<span class="m-label">{m.label}</span>
					<span class="m-count">×{m.count}</span>
					<span class="m-pl" class:neg={m.profit < 0}>{formatMoney(m.profit, 'USD', true)}</span>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<div class="panel frame-hover">
	<span class="fh-c fh-tl" aria-hidden="true"></span>
	<span class="fh-c fh-tr" aria-hidden="true"></span>
	<span class="fh-c fh-bl" aria-hidden="true"></span>
	<span class="fh-c fh-br" aria-hidden="true"></span>
	<div class="panel-head">
		<h2 class="panel-title">Средние по дням недели</h2>
		<span class="eyebrow">дисциплина · спокойствие</span>
	</div>
	{#if loading}
		<p class="panel-empty">Загрузка…</p>
	{:else if !week.some((w) => w.discipline != null || w.calm != null)}
		<p class="panel-empty">Нет оценённых дней за период</p>
	{:else}
		<ul class="week">
			{#each week as w (w.weekday)}
				<li class:empty={w.days === 0}>
					<span class="w-name">{w.weekday}</span>
					<span class="w-bars">
						<span class="bar" aria-hidden="true">
							<span class="fill" style:width={`${((w.discipline ?? 0) / weekMax) * 100}%`}></span>
						</span>
						<span class="bar" aria-hidden="true">
							<span class="fill calm" style:width={`${((w.calm ?? 0) / weekMax) * 100}%`}></span>
						</span>
					</span>
					<span class="w-val">{w.discipline ?? '—'} · {w.calm ?? '—'}</span>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.panel {
		background: var(--panel);
		border: 1px solid var(--line);
		border-radius: var(--radius-card);
		padding: clamp(18px, 2.4vw, 26px);
		display: flex;
		flex-direction: column;
		margin-bottom: var(--sp-xl);
	}
	.panel-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		padding-bottom: var(--sp-sm);
		border-bottom: 1px solid var(--line);
		margin-bottom: var(--sp-md);
	}
	.panel-title {
		font-size: 1.35rem;
		letter-spacing: -0.02em;
	}
	.panel-empty {
		margin: 0;
		padding: 2rem 0;
		text-align: center;
		font-family: var(--font-mono);
		font-size: 0.7rem;
		letter-spacing: 0.06em;
		color: var(--ink-muted);
	}
	.note {
		margin: var(--sp-sm) 0 0;
		font-family: var(--font-mono);
		font-size: 0.66rem;
		color: var(--ink-muted);
	}

	.days {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.82rem;
	}
	.days th,
	.days td {
		font-weight: 400;
		text-align: left;
		padding: 0.32rem 0.4rem;
		border-bottom: 1px solid var(--line);
	}
	.days thead th {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--ink-muted);
	}
	.days tbody tr:last-child th,
	.days tbody tr:last-child td {
		border-bottom: none;
	}
	.days .num {
		text-align: right;
		font-family: var(--font-mono);
		font-size: 0.76rem;
	}
	.days .num.neg {
		color: var(--danger);
	}
	.wd {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		letter-spacing: 0.08em;
		color: var(--ink-muted);
		margin-right: 0.4rem;
	}
	.d {
		font-family: var(--font-mono);
		font-size: 0.76rem;
	}

	.bar {
		display: inline-block;
		width: 68px;
		height: 4px;
		background: var(--line);
		vertical-align: middle;
		margin-right: 0.4rem;
	}
	.fill {
		display: block;
		height: 100%;
		background: var(--sage);
	}
	.fill.calm {
		background: var(--status-blue);
	}
	.val {
		font-family: var(--font-mono);
		font-size: 0.72rem;
	}
	.val.muted {
		color: var(--ink-muted);
	}

	.mistakes {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.mistakes li {
		display: grid;
		grid-template-columns: max-content 1fr max-content max-content;
		align-items: center;
		gap: var(--sp-sm);
		padding: 0.4rem 0;
		border-bottom: 1px solid var(--line);
	}
	.mistakes li:last-child {
		border-bottom: none;
	}
	.m-src {
		font-family: var(--font-mono);
		font-size: 0.58rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		padding: 0.12rem 0.34rem;
		border: 1px solid var(--line-strong);
		border-radius: 2px;
		color: var(--ink-muted);
	}
	.m-src[data-src='mistake'] {
		color: var(--status-orange);
	}
	.m-src[data-src='day'] {
		color: var(--status-amber);
	}
	.m-label {
		font-size: 0.84rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.m-count,
	.m-pl {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		color: var(--ink-muted);
	}
	.m-pl.neg {
		color: var(--danger);
	}

	.week {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.week li {
		display: grid;
		grid-template-columns: 2rem 1fr max-content;
		align-items: center;
		gap: var(--sp-sm);
		padding: 0.28rem 0;
	}
	.week li.empty {
		opacity: 0.45;
	}
	.w-name {
		font-family: var(--font-mono);
		font-size: 0.66rem;
		letter-spacing: 0.08em;
		color: var(--ink-muted);
	}
	.w-bars {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	.w-bars .bar {
		width: 100%;
		margin-right: 0;
	}
	.w-val {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		color: var(--ink-muted);
	}
</style>
