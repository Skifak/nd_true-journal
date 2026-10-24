<script lang="ts">
	/**
	 * Модальная форма сделки: создание и редактирование.
	 * Без зависимостей. Валидация — доменными функциями.
	 *
	 * Перенято из формы старого журнала (components/trade-form):
	 *  - «Текущее время» / ручной ввод даты (datetime-local)
	 *  - R:R-пресеты (1:1…1:5) — TP считается из входа и SL
	 *  - Расчёт риска (|entry − SL| × контракт × объём) и R:R live
	 *  - Подтверждение при закрытии формы с несохранёнными данными
	 */
	import Modal from './Modal.svelte';
	import {
		calculateProfit,
		formatPrice,
		getContractSize,
		nowStamp,
		PAIRS,
		tradeProfit,
		type Direction,
		type Trade,
		type TradeStatus
	} from '#lib/domain/trades.ts';

	/** Форма как строка: числовые поля вводятся текстом и парсятся при сохранении. */
	interface TradeForm {
		id: string;
		dateOpen: string;
		pair: string;
		direction: Direction;
		volume: number | string;
		priceOpen: number | string;
		sl: number | string;
		tp: number | string;
		status: TradeStatus;
		dateClose: string;
		priceClose: number | string;
		commission: number | string;
		swap: number | string;
		contractSize: number | string;
		comment: string;
	}

	interface Props {
		open?: boolean;
		trade?: Trade | null;
		currency?: string;
		onSave?: (patch: Partial<Trade>) => void;
		onDelete?: (id: string) => void;
		onClose?: () => void;
	}

	let {
		open = $bindable(false),
		trade = null,
		currency = 'USD',
		onSave = () => {},
		onDelete = () => {},
		onClose = () => {}
	}: Props = $props();

	let form = $state<TradeForm | null>(null);
	let errorMsg = $state('');

	// «Текущее время» из старого журнала: чекбокс вместо ручного ввода
	let useCurrentTime = $state(true);
	/** datetime-local работает с 'YYYY-MM-DDTHH:mm', журнал хранит ' ' — конвертация туда-обратно */
		const toLocalInput = (stamp: string) => (stamp ? String(stamp).replace(' ', 'T').slice(0, 16) : '');
		const fromLocalInput = (v: string) => (v ? String(v).replace('T', ' ') : '');

	// Пересоздаём форму при открытии/смене сделки
	$effect(() => {
		if (!open) return;
		form = trade
			? ({ ...trade, sl: trade.sl ?? '', tp: trade.tp ?? '', priceClose: trade.priceClose ?? '' } as unknown as TradeForm)
			: {
					id: '',
					dateOpen: nowStamp(),
					pair: 'EURUSD',
					direction: 'long',
					volume: 0.01,
					priceOpen: '',
					sl: '',
					tp: '',
					status: 'open',
					dateClose: '',
					priceClose: '',
					commission: 0,
					swap: 0,
					contractSize: '',
					comment: ''
				};
		useCurrentTime = !trade?.dateOpenManual;
		errorMsg = '';
	});

	const isNew = $derived(!form?.id);
	const preview = $derived.by(() => {
		const f = form;
		if (!f || !f.priceOpen || f.priceClose === '' || f.priceClose == null) return null;
		return calculateProfit({
			pair: f.pair,
			direction: f.direction,
			priceOpen: Number(f.priceOpen),
			priceClose: Number(f.priceClose),
			volume: Number(f.volume) || 0,
			contractSize: f.contractSize === '' ? null : Number(f.contractSize),
			commission: Number(f.commission) || 0,
			swap: Number(f.swap) || 0
		});
	});

	const contract = $derived(form ? getContractSize(form!.pair, form!.contractSize === '' ? null : form!.contractSize) : 0);

	// ── Риск и R:R (механика TradeFormRiskPanel старого журнала) ──
	const RR_PRESETS = [
		{ label: '1:1', ratio: 1 },
		{ label: '1:2', ratio: 2 },
		{ label: '1:3', ratio: 3 },
		{ label: '1:5', ratio: 5 }
	];

	const riskInfo = $derived.by(() => {
		if (!form) return { amount: null, rr: null };
		const entry = Number(form!.priceOpen);
		const sl = Number(form!.sl);
		const tp = Number(form!.tp);
		const units = getContractSize(form!.pair, form!.contractSize === '' ? null : form!.contractSize) * (Number(form!.volume) || 0);
		 const amount = sl > 0 && entry > 0 ? Math.abs(entry - sl) * units : null;
		 const reward = tp > 0 && entry > 0 ? Math.abs(tp - entry) * units : null;
		const rr = amount != null && reward != null && amount > 0 ? reward / amount : null;
		return { amount, rr };
	});
	const canApplyRr = $derived(Number(form?.priceOpen) > 0 && Number(form?.sl) > 0 && Number(form?.priceOpen) !== Number(form?.sl));

	function applyRr(ratio: number) {
		if (!form) return;
		const entry = Number(form.priceOpen);
		const sl = Number(form!.sl);
		if (!entry || !sl || entry === sl) return;
		const dist = Math.abs(entry - sl);
		const isLong = form!.direction === 'long';
		const tp = isLong ? entry + dist * ratio : entry - dist * ratio;
		const decimals = String(form!.priceOpen).split('.')[1]?.length || 5;
		form = { ...form, tp: Number(tp.toFixed(decimals)) };
	}

	/** Есть ли несохранённые изменения (для подтверждения закрытия) */
	const dirty = $derived.by(() => {
		if (!form) return false;
		if (errorMsg) return true;
		if (trade) {
			return ['pair', 'direction', 'volume', 'priceOpen', 'sl', 'tp', 'comment'].some(
				(k) => String((form as any)[k] ?? '') !== String((trade as any)[k] ?? '')
			);
		}
		// Новая сделка: осмысленно хоть что-то заполнено сверх дефолта
		return (
			String(form!.pair).toUpperCase() !== 'EURUSD' ||
			String(form!.priceOpen ?? '') !== '' ||
			String(form!.sl ?? '') !== '' ||
			String(form!.tp ?? '') !== '' ||
			String(form!.comment ?? '').trim() !== ''
		);
	});

	// Подтверждение перед потерей введённых данных
	let confirmDiscard = $state(false);
	function requestClose() {
		if (dirty) {
			confirmDiscard = true;
			return;
		}
		close();
	}
	function discardAndClose() {
		confirmDiscard = false;
		close();
	}

	function submit() {
		if (!form) return;
		if (!form.pair) {
			errorMsg = 'Укажите инструмент';
			return;
		}
		if (!(Number(form!.volume) > 0)) {
			errorMsg = 'Объём должен быть больше нуля';
			return;
		}
		if (!form.priceOpen) {
			errorMsg = 'Укажите цену открытия';
			return;
		}
		if (form!.status === 'closed' && (form!.priceClose === '' || form!.priceClose == null)) {
			errorMsg = 'Для закрытой сделки нужна цена закрытия';
			return;
		}
		// Валидация дат: журнал и сортировка ломаются от опечаток в формате
		const stampRe = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/;
		const dateOpenFinal = useCurrentTime && isNew ? nowStamp() : fromLocalInput(form!.dateOpen);
		if (dateOpenFinal && !stampRe.test(dateOpenFinal)) {
			errorMsg = 'Дата открытия: формат ГГГГ-ММ-ДД ЧЧ:ММ';
			return;
		}
		let dateCloseFinal = form!.status === 'closed' ? fromLocalInput(form!.dateClose) : null;
		if (dateCloseFinal && !stampRe.test(dateCloseFinal)) {
			errorMsg = 'Дата закрытия: формат ГГГГ-ММ-ДД ЧЧ:ММ';
			return;
		}
		errorMsg = '';
		const payload: Partial<Trade> = {
			...form,
			dateOpen: dateOpenFinal,
			dateOpenManual: !(useCurrentTime && isNew),
			pair: String(form!.pair).toUpperCase(),
			volume: Number(form!.volume),
			priceOpen: Number(form!.priceOpen),
			sl: form!.sl === '' ? null : Number(form!.sl),
			tp: form!.tp === '' ? null : Number(form!.tp),
			priceClose: form!.status === 'closed' ? Number(form!.priceClose) : null,
			dateClose: form!.status === 'closed' ? dateCloseFinal || nowStamp() : null,
			commission: Number(form!.commission) || 0,
			swap: Number(form!.swap) || 0,
			contractSize: form!.contractSize === '' ? null : Number(form!.contractSize)
		};
		onSave(payload);
		open = false;
	}

	function close() {
		open = false;
		onClose();
	}
</script>

{#if form}
	<Modal bind:open title={isNew ? 'Новая сделка' : 'Сделка'} size="md" closeOnBackdrop={!dirty} onClose={requestClose}>
		<div class="grid">
			<label class="f">
				<span>Инструмент</span>
				<input list="pairs" bind:value={form!.pair} placeholder="EURUSD" required />
				<datalist id="pairs">
					{#each PAIRS as p (p)}<option value={p}></option>{/each}
				</datalist>
			</label>

			<label class="f">
				<span>Направление</span>
				<select bind:value={form!.direction}>
					<option value="long">LONG</option>
					<option value="short">SHORT</option>
				</select>
			</label>

			<label class="f">
				<span>Объём (лот)</span>
				<input type="number" step="0.01" min="0.01" bind:value={form!.volume} required />
			</label>

			<label class="f">
				<span>Цена открытия</span>
				<input type="number" step="any" bind:value={form!.priceOpen} required />
			</label>

			<label class="f wide">
				<span>Дата и время</span>
				<div class="dt-row">
					<label class="check">
						<input type="checkbox" bind:checked={useCurrentTime} />
						Текущее время
					</label>
					{#if !useCurrentTime}
						<input
							type="datetime-local"
							value={toLocalInput(form!.dateOpen || '')}
							onchange={(e) => (form = { ...form, dateOpen: (e.currentTarget as HTMLInputElement).value } as TradeForm)}
						/>
					{/if}
				</div>
			</label>

			<label class="f">
				<span>Статус</span>
				<select bind:value={form!.status}>
					<option value="open">Открыта</option>
					<option value="closed">Закрыта</option>
				</select>
			</label>

			<label class="f">
				<span>SL</span>
				<input type="number" step="any" bind:value={form!.sl} placeholder="—" />
			</label>

			<label class="f">
				<span>TP</span>
				<input type="number" step="any" bind:value={form!.tp} placeholder="—" />
			</label>

			<div class="f wide">
				<span>R:R</span>
				<div class="rr-row">
					{#each RR_PRESETS as rr (rr.label)}
						<button
							type="button"
							class="rr-btn"
							class:active={riskInfo.rr != null && Math.abs(riskInfo.rr - rr.ratio) < 0.05}
							disabled={!canApplyRr}
							title="Заполни цену входа и SL, затем нажми — TP рассчитается автоматически"
							onclick={() => applyRr(rr.ratio)}>{rr.label}</button
						>
					{/each}
					<span class="risk-line">
						Риск: <b class:loss={riskInfo.amount != null}>{riskInfo.amount != null ? riskInfo.amount.toFixed(2) + ' ' + currency : 'SL не задан'}</b>
						{#if riskInfo.rr != null}
							· R:R <b>1:{riskInfo.rr.toFixed(2)}</b>
						{/if}
					</span>
				</div>
			</div>

			{#if form!.status === 'closed'}
				<label class="f">
					<span>Цена закрытия</span>
					<input type="number" step="any" bind:value={form!.priceClose} required />
				</label>
				<label class="f">
					<span>Время закрытия</span>
					<input
						type="datetime-local"
						value={toLocalInput(form!.dateClose || '')}
						onchange={(e) => (form = { ...form, dateClose: (e.currentTarget as HTMLInputElement).value } as TradeForm)}
					/>
				</label>
			{/if}

			<label class="f">
				<span>Комиссия</span>
				<input type="number" step="any" bind:value={form!.commission} />
			</label>

			<label class="f">
				<span>Своп</span>
				<input type="number" step="any" bind:value={form!.swap} />
			</label>

			<label class="f">
				<span>Контракт-сайз</span>
				<input type="number" step="any" bind:value={form!.contractSize} placeholder={`${contract}`} />
			</label>

			<label class="f wide">
				<span>Комментарий</span>
				<textarea rows="2" bind:value={form!.comment} placeholder="Сетап, контекст, ошибки…"></textarea>
			</label>
		</div>

		<div class="preview">
			{#if preview != null}
				<span class="pv-label">Расчётный P/L</span>
				<span class="pv-value" class:profit={preview >= 0} class:loss={preview < 0}>
					{preview.toFixed(2)} {currency}
				</span>
			{:else}
				<span class="pv-label">Контракт</span>
				<span class="pv-value muted">{contract.toLocaleString('ru-RU')} ед.</span>
			{/if}
		</div>

		{#if errorMsg}
			<p class="err" role="alert">{errorMsg}</p>
		{/if}

		{#snippet footer()}
			{#if !isNew}
				<button
					type="button"
					class="btn danger"
					onclick={() => {
						onDelete(form!.id);
						open = false;
					}}>Удалить</button
				>
			{/if}
			<div class="spacer"></div>
			<button type="button" class="btn" onclick={requestClose}>Отмена</button>
			<button type="button" class="btn primary" onclick={submit}>{isNew ? 'Создать' : 'Сохранить'}</button>
		{/snippet}
	</Modal>

	{#if confirmDiscard}
		<Modal bind:open={confirmDiscard} title="Закрыть без сохранения?" size="sm">
			<p class="discard-text">Внесённые изменения будут потеряны.</p>
			{#snippet footer()}
				<div class="spacer"></div>
				<button type="button" class="btn" onclick={() => (confirmDiscard = false)}>Продолжить редактирование</button>
				<button type="button" class="btn danger-solid" onclick={discardAndClose}>Закрыть</button>
			{/snippet}
		</Modal>
	{/if}
{/if}

<style>
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
		gap: 0.7rem;
	}
	.f {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.f.wide {
		grid-column: 1 / -1;
	}
	.f span {
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
	.dt-row {
		display: flex;
		align-items: center;
		gap: 0.8rem;
	}
	.dt-row input {
		flex: 1;
	}
	.check {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.8rem;
		white-space: nowrap;
		cursor: pointer;
	}
	.rr-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
	}
	.rr-btn {
		font-family: var(--font-mono);
		font-size: 0.66rem;
		letter-spacing: 0.06em;
		padding: 0.26rem 0.55rem;
		color: var(--ink-muted);
		background: transparent;
		border: 1px solid var(--line);
		border-radius: 2px;
		cursor: pointer;
		transition: color 0.2s, border-color 0.2s, background 0.2s;
	}
	.rr-btn:hover:not(:disabled) {
		color: var(--ink);
		border-color: var(--line-strong);
	}
	.rr-btn.active {
		background: var(--sage);
		border-color: var(--sage);
		color: var(--bg);
	}
	.rr-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.risk-line {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		color: var(--ink-muted);
		margin-left: auto;
	}
	.risk-line b {
		font-weight: 500;
		color: var(--ink);
	}
	.discard-text {
		font-size: 0.86rem;
		line-height: 1.5;
		color: var(--ink-muted);
	}
	.preview {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		margin-top: 0.9rem;
		padding-top: 0.7rem;
		border-top: 1px solid var(--line);
		font-family: var(--font-mono);
		font-size: 0.7rem;
	}
	.pv-label {
		color: var(--ink-muted);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.pv-value {
		font-size: 0.9rem;
	}
	.pv-value.muted {
		color: var(--ink-muted);
	}
	.profit {
		color: var(--sage);
	}
	.loss {
		color: var(--danger);
	}
	.err {
		margin-top: 0.6rem;
		font-family: var(--font-mono);
		font-size: 0.7rem;
		color: var(--danger);
	}
	.spacer {
		flex: 1;
	}
</style>
