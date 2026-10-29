<script lang="ts">
	/**
	 * Страница «Дневник»: лента записей по дням, поиск, фильтры по типу и тегу.
	 * Данные — из diaryStore, связанные сделки — из journalStore (только для подписей).
	 */
	import DayReviewDialog from '#lib/components/DayReviewDialog.svelte';
	import DiaryDialog from '#lib/components/DiaryDialog.svelte';
	import Modal from '#lib/components/Modal.svelte';
	import {
		CHECKLIST_OPTIONS,
		DIARY_KINDS,
		dayEntry,
		dayTotals,
		emptyDiaryFilters,
		entryDays,
		filterEntries,
		groupByDiaryDay,
		kindInfo,
		tagsInUse,
		type DiaryEntry,
		type DiaryFilters
	} from '#lib/domain/diary.ts';
	import { formatDate, parseStamp, tradeProfit } from '#lib/domain/trades.ts';
	import { getTrades, initJournal } from '#lib/storage/journalStore.svelte.ts';
	import {
		addEntry,
		deleteEntry,
		diaryState,
		getEntries,
		getTagVocabulary,
		initDiary,
		saveDayEntry,
		updateEntry
	} from '#lib/storage/diaryStore.svelte.ts';
	import { loadUiSetting, saveUiSetting } from '#lib/storage/journal.ts';

	type Range = 'recent' | 'day' | 'all';
	const RANGES: { id: Range; label: string }[] = [
		{ id: 'recent', label: 'Свежие' },
		{ id: 'day', label: 'По дням' },
		{ id: 'all', label: 'Все' }
	];

	const savedFilters = loadUiSetting<DiaryFilters>('diary:filters', emptyDiaryFilters());
	let filters = $state<DiaryFilters>({
		...emptyDiaryFilters(),
		kind: savedFilters.kind ?? null,
		tag: savedFilters.tag ?? null
	});
	let range = $state<Range>(loadUiSetting<Range>('diary:range', 'recent'));

	let dialogOpen = $state(false);
	let editing = $state<DiaryEntry | null>(null);
	let createDay = $state<string | null>(null);
	let confirmId = $state<string | null>(null);
	let toast = $state('');

	// «Разбор дня» — отдельная форма: одна запись на день, итоги из сделок
	let dayOpen = $state(false);
	let dayKeySel = $state('');

	$effect(() => {
		initDiary();
		initJournal();
	});
	$effect(() => {
		saveUiSetting('diary:filters', $state.snapshot(filters));
	});
	$effect(() => {
		saveUiSetting('diary:range', range);
	});

	const all = $derived(getEntries());
	const vocabulary = $derived(getTagVocabulary());
	const tradeOptions = $derived(
		getTrades().map((t) => ({
			id: t.id,
			label: `${t.pair} · ${formatDate(t.dateClose || t.dateOpen)} · ${tradeProfit(t) >= 0 ? '+' : '−'}${Math.abs(tradeProfit(t)).toFixed(2)}`
		}))
	);
	const tradeLabel = (id: string) => tradeOptions.find((t) => t.id === id)?.label ?? 'сделка';

	const tagPool = $derived(tagsInUse(all));
	const days = $derived(entryDays(all));
	const matched = $derived(filterEntries(all, filters));
	const groups = $derived(groupByDiaryDay(matched));
	const dayEmpty = $derived(filters.day !== null && !filterEntries(all, { ...filters, day: filters.day }).length);
	let confirmOpen = $state(false);
	const confirmEntry = $derived(all.find((e) => e.id === confirmId) ?? null);

	// Лента: «Свежие» — просто сгруппированные дни, «По дням» — один выбранный день
	const shownGroups = $derived(
		range === 'day' && filters.day ? groups.filter((g) => g.key === filters.day) : groups
	);

	function showToast(msg: string) {
		toast = msg;
		setTimeout(() => (toast = ''), 2400);
	}

	function openNew(day: string | null = null) {
		editing = null;
		createDay = day ?? (range === 'day' ? filters.day : null);
		dialogOpen = true;
	}

	function openEdit(entry: DiaryEntry) {
		editing = entry;
		createDay = null;
		dialogOpen = true;
	}

	function handleSave(payload: Partial<DiaryEntry>) {
		if (payload.id) {
			updateEntry(payload.id, payload);
			showToast('Запись обновлена');
		} else {
			addEntry(payload);
			showToast('Запись добавлена');
		}
	}

	function confirmDelete() {
		if (!confirmId) return;
		deleteEntry(confirmId);
		confirmId = null;
		confirmOpen = false;
		showToast('Запись удалена');
	}

	function dayLabel(key: string): string {
		const d = parseStamp(key);
		if (!d) return key;
		const today = new Date();
		const isToday =
			d.getFullYear() === today.getFullYear() &&
			d.getMonth() === today.getMonth() &&
			d.getDate() === today.getDate();
		const text = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'short' });
		return isToday ? `Сегодня · ${text}` : text;
	}

	const planLabel = (v: boolean | null) => (v === true ? 'по плану' : v === false ? 'вне плана' : '—');

	const checklistLabel = (v: DiaryEntry['checklist']) =>
		CHECKLIST_OPTIONS.find((o) => o.id === v)?.label ?? '—';

	// Разбор дня текущего дня в ленте — для авто-итогов в форме
	const dayEntryShown = $derived(dayKeySel ? dayEntry(all, dayKeySel) : null);
	const dayTotalsShown = $derived(dayTotals(getTrades(), dayKeySel, dayEntryShown?.tradeIds ?? []));

	function openDay(day: string) {
		dayKeySel = day;
		dayOpen = true;
	}

	function handleDaySave(patch: Partial<DiaryEntry>) {
		saveDayEntry(patch);
		showToast('Разбор дня сохранён');
	}
</script>

<section class="page">
	<header class="page-head">
		<div>
			<h1>Дневник</h1>
			<p class="sub">
				{all.length} записей · {days.length} дней · фильтр {matched.length}
			</p>
		</div>
		<div class="head-actions">
			<button class="btn" onclick={() => openDay(filters.day ?? new Date().toISOString().slice(0, 10))}>
				Разбор дня
			</button>
			<button class="btn primary" onclick={() => openNew()}>Создать запись</button>
		</div>
	</header>

	{#if diaryState.error}
		<p class="err" role="alert">{diaryState.error}</p>
	{/if}

	<!-- Панель фильтров -->
	<div class="panel tools">
		<div class="tool-row">
			<label class="search">
				<input type="search" placeholder="Поиск по тексту и тегам…" bind:value={filters.search} />
			</label>
			<div class="seg" role="group" aria-label="Режим ленты">
				{#each RANGES as r (r.id)}
					<button
						type="button"
						class="seg-btn"
						class:on={range === r.id}
						aria-pressed={range === r.id}
						onclick={() => (range = r.id)}>{r.label}</button
					>
				{/each}
			</div>
		</div>

		<div class="tool-row wrap">
			<div class="chips" role="group" aria-label="Тип записи">
				<button
					type="button"
					class="chip"
					class:on={filters.kind === null}
					onclick={() => (filters.kind = null)}>Все типы</button
				>
				{#each DIARY_KINDS as k (k.id)}
					<button
						type="button"
						class="chip"
						class:on={filters.kind === k.id}
						onclick={() => (filters.kind = filters.kind === k.id ? null : k.id)}>{k.label}</button
					>
				{/each}
			</div>

			{#if tagPool.length}
				<div class="chips" role="group" aria-label="Тег">
					{#each tagPool as t (t)}
						<button
							type="button"
							class="chip"
							class:on={filters.tag === t}
							onclick={() => (filters.tag = filters.tag === t ? null : t)}>#{t}</button
						>
					{/each}
				</div>
			{/if}

			{#if range === 'day'}
				<select class="day-select" bind:value={filters.day} aria-label="Выбрать день">
					<option value={null}>Все дни</option>
					{#each days as d (d)}<option value={d}>{dayLabel(d)}</option>{/each}
				</select>
			{/if}
		</div>
	</div>

	{#if diaryState.loading}
		<p class="loading">Загрузка дневника…</p>
	{:else if !all.length}
		<div class="empty">
			<p class="empty-title">Дневник пока пуст</p>
			<p class="empty-hint">
				Записывайте наблюдения, разбирайте ошибки и эмоции — это и есть дисциплина, которую видно.
			</p>
			<button class="btn primary" onclick={() => openNew()}>Создать запись</button>
		</div>
	{:else if !shownGroups.length}
		<div class="empty">
			<p class="empty-title">{dayEmpty ? 'В этот день записей нет' : 'Ничего не найдено'}</p>
			<p class="empty-hint">
				{dayEmpty
					? 'День выбран, но записей в нём нет. Начните с одной.'
					: 'Попробуйте изменить запрос или сбросить фильтры.'}
			</p>
			<div class="empty-actions">
				{#if dayEmpty}
					<button class="btn primary" onclick={() => openNew(filters.day)}>Создать запись</button>
				{:else}
					<button class="btn" onclick={() => (filters = emptyDiaryFilters())}>Сбросить фильтры</button>
				{/if}
			</div>
		</div>
	{:else}
		{#each shownGroups as group (group.key)}
			<section class="day-group">
				<div class="day-head">
					<h2 class="day-title">{dayLabel(group.key)}</h2>
					<span class="eyebrow">{group.entries.length} записей</span>
					<button class="text-link" onclick={() => openDay(group.key)}>разбор дня</button>
					<button class="text-link add" onclick={() => openNew(group.key)}>+ запись</button>
				</div>
				<ul class="feed">
					{#each group.entries as e (e.id)}
						<li class="entry">
							<div class="entry-head">
								<span class="kind" data-kind={e.kind}>{kindInfo(e.kind).short}</span>
								<time class="time" datetime={e.at}>{e.at.slice(11, 16)}</time>
								<span class="plan" class:warn={e.followedPlan === false}>{planLabel(e.followedPlan)}</span>
								<span class="scores">
									дисц. {e.discipline ?? '—'} · спок. {e.calm ?? '—'}
								</span>
								<div class="entry-actions">
									<button class="btn" onclick={() => openEdit(e)}>Изменить</button>
									<button class="btn danger" onclick={() => {
										confirmId = e.id;
										confirmOpen = true;
									}}>Удалить</button>
								</div>
							</div>

							{#if e.kind === 'day'}
								<dl class="mistake">
									{#if e.dayPlan}<dt>План</dt><dd>{e.dayPlan}</dd>{/if}
									{#if e.dayResult}<dt>Итог</dt><dd>{e.dayResult}</dd>{/if}
									{#if e.mainMistake}<dt>Главная ошибка</dt><dd>{e.mainMistake}</dd>{/if}
									<dt>Чек-лист входа</dt>
									<dd class:warn={e.checklist === 'no'} class:soft={e.checklist === 'partial'}>
										{checklistLabel(e.checklist)}
									</dd>
								</dl>
							{/if}

							{#if e.kind === 'mistake'}
								<dl class="mistake">
									{#if e.mistakeWhat}<dt>Что случилось</dt><dd>{e.mistakeWhat}</dd>{/if}
									{#if e.mistakeWhy}<dt>Почему</dt><dd>{e.mistakeWhy}</dd>{/if}
									{#if e.mistakeFix}<dt>Что изменю</dt><dd>{e.mistakeFix}</dd>{/if}
								</dl>
							{/if}

							{#if e.text}
								<p class="text">{e.text}</p>
							{/if}

							{#if e.tags.length || e.tradeIds.length}
								<div class="meta">
									{#each e.tags as t (t)}
										<button type="button" class="tag" onclick={() => (filters.tag = t)}>#{t}</button>
									{/each}
									{#each e.tradeIds as id (id)}
										<span class="trade-link" title="Связанная сделка">{tradeLabel(id)}</span>
									{/each}
								</div>
							{/if}
						</li>
					{/each}
				</ul>
			</section>
		{/each}
	{/if}

	{#if toast}
		<div class="toast" role="status">{toast}</div>
	{/if}
</section>

<DiaryDialog
	bind:open={dialogOpen}
	entry={editing}
	defaultDay={createDay}
	tags={vocabulary}
	trades={tradeOptions}
	onSave={handleSave}
	onClose={() => {
		editing = null;
		createDay = null;
	}}
/>

<DayReviewDialog
	bind:open={dayOpen}
	day={dayKeySel}
	entry={dayEntryShown}
	totals={dayTotalsShown}
	tags={vocabulary}
	onSave={handleDaySave}
/>

<Modal bind:open={confirmOpen} title="Удалить запись?" size="sm" onClose={() => (confirmId = null)}>
	<p class="confirm-text">
		{confirmEntry ? formatDate(confirmEntry.at) + ' · ' + kindInfo(confirmEntry.kind).label : ''}
		<br />
		Действие нельзя отменить — дневник хранится только локально, копии нет.
	</p>
	{#snippet footer()}
		<div class="spacer"></div>
		<button class="btn" onclick={() => (confirmOpen = false)}>Отмена</button>
		<button class="btn danger-solid" onclick={confirmDelete}>Удалить</button>
	{/snippet}
</Modal>

<style>
	.page {
		padding: var(--sp-lg) var(--sp-md) 3rem;
	}
	.page-head {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: var(--sp-md);
		margin-bottom: 1.2rem;
	}
	.head-actions {
		display: flex;
		gap: 0.5rem;
	}
	h1 {
		font-family: var(--font-display);
		font-size: clamp(2rem, 3.4vw, 3rem);
		font-weight: 400;
		letter-spacing: -0.03em;
		line-height: 1;
	}
	.sub {
		margin-top: 0.5rem;
		font-family: var(--font-mono);
		font-size: 0.68rem;
		letter-spacing: 0.06em;
		color: var(--ink-muted);
	}

	.tools {
		display: flex;
		flex-direction: column;
		gap: var(--sp-sm);
		padding: var(--sp-md);
		background: var(--panel);
		border: 1px solid var(--line);
		border-radius: var(--radius-card);
		margin-bottom: var(--sp-xl);
	}
	.tool-row {
		display: flex;
		align-items: center;
		gap: var(--sp-sm);
	}
	.tool-row.wrap {
		flex-wrap: wrap;
	}
	.search {
		flex: 1;
		min-width: 200px;
	}
	input[type='search'],
	select {
		width: 100%;
		font-family: var(--font-mono);
		font-size: 0.76rem;
		color: var(--ink);
		background: transparent;
		border: 1px solid var(--line);
		border-radius: 2px;
		padding: 0.4rem 0.5rem;
	}
	input[type='search']:focus,
	select:focus {
		outline: none;
		border-color: var(--line-strong);
	}
	.day-select {
		max-width: 260px;
	}
	.seg {
		display: flex;
		gap: 1px;
	}
	.seg-btn {
		padding: 0.35rem 0.6rem;
		font-family: var(--font-mono);
		font-size: 0.64rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-muted);
		background: transparent;
		border: 1px solid var(--line);
		border-radius: 2px;
		cursor: pointer;
		transition: color 0.2s, border-color 0.2s, background 0.2s;
	}
	.seg-btn:hover {
		color: var(--ink);
		border-color: var(--line-strong);
	}
	.seg-btn.on {
		background: var(--sage);
		border-color: var(--sage);
		color: var(--bg);
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.day-group {
		margin-bottom: var(--sp-xl);
	}
	.day-head {
		display: flex;
		align-items: baseline;
		gap: var(--sp-sm);
		padding-bottom: var(--sp-xs);
		border-bottom: 1px solid var(--line);
		margin-bottom: var(--sp-sm);
	}
	.day-title {
		font-family: var(--font-display);
		font-size: 1.5rem;
		letter-spacing: -0.02em;
	}
	.add {
		margin-left: auto;
		padding: 0;
		border: none;
	}

	.feed {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--sp-sm);
	}
	.entry {
		border: 1px solid var(--line);
		border-radius: var(--radius-card);
		background: var(--panel);
		padding: var(--sp-md);
		transition: border-color 200ms var(--ease-out);
	}
	.entry:hover {
		border-color: var(--line-strong);
	}
	.entry-head {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--sp-sm);
		margin-bottom: 0.6rem;
	}
	.kind {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		padding: 0.2rem 0.45rem;
		border: 1px solid var(--line-strong);
		border-radius: 2px;
	}
	.kind[data-kind='note'] {
		color: var(--status-blue);
	}
	.kind[data-kind='mistake'] {
		color: var(--status-orange);
	}
	.kind[data-kind='emotion'] {
		color: var(--status-violet);
	}
	.kind[data-kind='day'] {
		color: var(--status-amber);
	}
	.time,
	.plan,
	.scores {
		font-family: var(--font-mono);
		font-size: 0.66rem;
		letter-spacing: 0.06em;
		color: var(--ink-muted);
	}
	.plan.warn {
		color: var(--status-orange);
	}
	.mistake dd.warn {
		color: var(--status-orange);
	}
	.mistake dd.soft {
		color: var(--status-amber);
	}
	.entry-actions {
		margin-left: auto;
		display: flex;
		gap: 0.35rem;
	}
	.entry-actions .btn {
		padding: 0.28rem 0.6rem;
		font-size: 0.6rem;
	}
	.mistake {
		margin: 0 0 0.6rem;
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 0.25rem var(--sp-sm);
		font-size: 0.86rem;
	}
	.mistake dt {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-muted);
		padding-top: 0.15rem;
	}
	.mistake dd {
		margin: 0;
		white-space: pre-wrap;
	}
	.text {
		margin: 0;
		font-size: 0.9rem;
		line-height: 1.6;
		white-space: pre-wrap;
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.35rem;
		margin-top: 0.6rem;
	}
	.tag {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		padding: 0.18rem 0.4rem;
		color: var(--ink-muted);
		background: transparent;
		border: 1px solid var(--line);
		border-radius: 2px;
	}
	.tag:hover {
		color: var(--ink);
		border-color: var(--line-strong);
	}
	.trade-link {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--ink-muted);
		border-bottom: 1px dotted var(--line-strong);
	}

	.loading {
		padding: 3rem 0;
		font-family: var(--font-mono);
		font-size: 0.72rem;
		color: var(--ink-muted);
	}
	.empty {
		border: 1px dashed var(--line-strong);
		border-radius: var(--radius-card);
		padding: 3rem var(--sp-lg);
		text-align: center;
	}
	.empty-title {
		margin: 0;
		font-family: var(--font-display);
		font-size: 1.5rem;
	}
	.empty-hint {
		margin: 0.5rem auto 1.2rem;
		max-width: 46ch;
		font-size: 0.86rem;
		color: var(--ink-muted);
	}
	.empty-actions {
		display: flex;
		justify-content: center;
		gap: 0.5rem;
	}
	.err {
		margin-bottom: var(--sp-md);
		font-family: var(--font-mono);
		font-size: 0.72rem;
		color: var(--danger);
	}
	.toast {
		position: fixed;
		bottom: 1.6rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 70;
		padding: 0.5rem 1rem;
		background: var(--panel-solid-raised);
		border: 1px solid var(--line-strong);
		border-radius: 2px;
		box-shadow: 0 10px 28px -16px #000;
		font-family: var(--font-mono);
		font-size: 0.68rem;
	}
	.confirm-text {
		font-size: 0.86rem;
		line-height: 1.6;
		color: var(--ink-muted);
	}
	.spacer {
		flex: 1;
	}

	@media (max-width: 760px) {
		.page-head {
			flex-direction: column;
			align-items: flex-start;
		}
		.tool-row {
			flex-wrap: wrap;
		}
		.toast {
			bottom: calc(var(--tabbar-h) + 0.8rem);
		}
	}
</style>
