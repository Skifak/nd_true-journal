<script>
	/**
	 * Модальная форма сделки: создание и редактирование.
	 * Без зависимостей. Валидация — доменными функциями.
	 */
	import {
		calculateProfit,
		formatPrice,
		getContractSize,
		nowStamp,
		PAIRS,
		tradeProfit
	} from '#lib/domain/trades.js';

	/** @type {{
	 *   open?: boolean,
	 *   trade?: any,
	 *   currency?: string,
	 *   onSave?: (trade:any)=>void,
	 *   onDelete?: (trade:any)=>void,
	 *   onClose?: ()=>void
	 * }} */
	let {
		open = $bindable(false),
		trade = null,
		currency = 'USD',
		onSave = () => {},
		onDelete = () => {},
		onClose = () => {}
	} = $props();

	let form = $state(null);
	let errorMsg = $state('');

	// Пересоздаём форму при открытии/смене сделки
	$effect(() => {
		if (!open) return;
		form = trade
			? { ...trade, sl: trade.sl ?? '', tp: trade.tp ?? '', priceClose: trade.priceClose ?? '' }
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
		errorMsg = '';
	});

	const isNew = $derived(!form?.id);
	const preview = $derived.by(() => {
		if (!form || !form.priceOpen || form.priceClose === '' || form.priceClose == null) return null;
		return calculateProfit({
			...form,
			priceOpen: Number(form.priceOpen),
			priceClose: Number(form.priceClose),
			volume: Number(form.volume) || 0,
			contractSize: form.contractSize === '' ? null : Number(form.contractSize)
		});
	});

	const contract = $derived(form ? getContractSize(form.pair, form.contractSize === '' ? null : form.contractSize) : 0);

	function submit(e) {
		e.preventDefault();
		if (!form.pair) {
			errorMsg = 'Укажите инструмент';
			return;
		}
		if (!(Number(form.volume) > 0)) {
			errorMsg = 'Объём должен быть больше нуля';
			return;
		}
		if (!form.priceOpen) {
			errorMsg = 'Укажите цену открытия';
			return;
		}
		if (form.status === 'closed' && (form.priceClose === '' || form.priceClose == null)) {
			errorMsg = 'Для закрытой сделки нужна цена закрытия';
			return;
		}
		errorMsg = '';
		const payload = {
			...form,
			pair: String(form.pair).toUpperCase(),
			volume: Number(form.volume),
			priceOpen: Number(form.priceOpen),
			sl: form.sl === '' ? null : Number(form.sl),
			tp: form.tp === '' ? null : Number(form.tp),
			priceClose: form.status === 'closed' ? Number(form.priceClose) : null,
			dateClose: form.status === 'closed' ? form.dateClose || nowStamp() : null,
			commission: Number(form.commission) || 0,
			swap: Number(form.swap) || 0,
			contractSize: form.contractSize === '' ? null : Number(form.contractSize)
		};
		onSave(payload);
		open = false;
	}

	function close() {
		open = false;
		onClose();
	}
</script>

{#if open && form}
	<div
		class="overlay"
		role="presentation"
		onclick={(e) => {
			if (e.target === e.currentTarget) close();
		}}
	>
		<form class="dialog" onsubmit={submit}>
			<header class="dialog-head">
				<h2>{isNew ? 'Новая сделка' : 'Сделка'}</h2>
				<button type="button" class="x" onclick={close} aria-label="Закрыть">✕</button>
			</header>

			<div class="grid">
				<label class="f">
					<span>Инструмент</span>
					<input list="pairs" bind:value={form.pair} placeholder="EURUSD" required />
					<datalist id="pairs">
						{#each PAIRS as p (p)}<option value={p}></option>{/each}
					</datalist>
				</label>

				<label class="f">
					<span>Направление</span>
					<select bind:value={form.direction}>
						<option value="long">LONG</option>
						<option value="short">SHORT</option>
					</select>
				</label>

				<label class="f">
					<span>Объём (лот)</span>
					<input type="number" step="0.01" min="0.01" bind:value={form.volume} required />
				</label>

				<label class="f">
					<span>Цена открытия</span>
					<input type="number" step="any" bind:value={form.priceOpen} required />
				</label>

				<label class="f">
					<span>Время открытия</span>
					<input type="text" bind:value={form.dateOpen} placeholder="YYYY-MM-DD HH:mm:ss" />
				</label>

				<label class="f">
					<span>Статус</span>
					<select bind:value={form.status}>
						<option value="open">Открыта</option>
						<option value="closed">Закрыта</option>
					</select>
				</label>

				<label class="f">
					<span>SL</span>
					<input type="number" step="any" bind:value={form.sl} placeholder="—" />
				</label>

				<label class="f">
					<span>TP</span>
					<input type="number" step="any" bind:value={form.tp} placeholder="—" />
				</label>

				{#if form.status === 'closed'}
					<label class="f">
						<span>Цена закрытия</span>
						<input type="number" step="any" bind:value={form.priceClose} required />
					</label>
					<label class="f">
						<span>Время закрытия</span>
						<input type="text" bind:value={form.dateClose} placeholder="YYYY-MM-DD HH:mm:ss" />
					</label>
				{/if}

				<label class="f">
					<span>Комиссия</span>
					<input type="number" step="any" bind:value={form.commission} />
				</label>

				<label class="f">
					<span>Своп</span>
					<input type="number" step="any" bind:value={form.swap} />
				</label>

				<label class="f">
					<span>Контракт-сайз</span>
					<input type="number" step="any" bind:value={form.contractSize} placeholder={`${contract}`} />
				</label>

				<label class="f wide">
					<span>Комментарий</span>
					<textarea rows="2" bind:value={form.comment} placeholder="Сетап, контекст, ошибки…"></textarea>
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
				<p class="err">{errorMsg}</p>
			{/if}

			<footer class="dialog-foot">
				{#if !isNew}
					<button
						type="button"
						class="btn danger"
						onclick={() => {
							onDelete(form);
							open = false;
						}}>Удалить</button
					>
				{/if}
				<div class="spacer"></div>
				<button type="button" class="btn" onclick={close}>Отмена</button>
				<button type="submit" class="btn primary">{isNew ? 'Создать' : 'Сохранить'}</button>
			</footer>
		</form>
	</div>
{/if}

<style>
	/* Плоский документ: непрозрачная подложка, без blur и стекла */
	.overlay {
		position: fixed;
		inset: 0;
		z-index: 60;
		background: var(--scrim);
		display: grid;
		place-items: center;
		padding: 1.5rem;
		animation: fade-in 0.16s ease-out;
	}
	@keyframes fade-in {
		from {
			opacity: 0;
		}
	}
	.dialog {
		position: relative;
		width: min(720px, 100%);
		max-height: 88dvh;
		overflow: auto;
		background: var(--panel-solid);
		border: 1px solid var(--line-strong);
		border-radius: 2px;
		padding: 1.1rem 1.2rem 1rem;
		box-shadow: 0 0 0 1px var(--bg), 0 18px 48px -24px #000;
	}
	/* Угловые марки — тот же язык, что frame-hover на панелях */
	.dialog::before,
	.dialog::after {
		content: '';
		position: absolute;
		width: 12px;
		height: 12px;
		border: 0 solid var(--line-strong);
		pointer-events: none;
	}
	.dialog::before {
		top: -1px;
		left: -1px;
		border-top-width: 1.5px;
		border-left-width: 1.5px;
	}
	.dialog::after {
		bottom: -1px;
		right: -1px;
		border-bottom-width: 1.5px;
		border-right-width: 1.5px;
	}
	.dialog-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 0.9rem;
	}
	.dialog-head h2 {
		font-size: 1.4rem;
		letter-spacing: -0.02em;
	}
	.x {
		background: transparent;
		border: none;
		color: var(--ink-muted);
		cursor: pointer;
		font-size: 0.9rem;
	}
	.x:hover {
		color: var(--ink);
	}
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
		font-size: 0.58rem;
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
	.preview {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		margin-top: 0.9rem;
		padding-top: 0.7rem;
		border-top: 1px solid var(--line);
		font-family: var(--font-mono);
		font-size: 0.68rem;
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
		color: var(--danger, #c98a8a);
	}
	.err {
		margin-top: 0.6rem;
		font-family: var(--font-mono);
		font-size: 0.68rem;
		color: var(--danger, #c98a8a);
	}
	.dialog-foot {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		margin-top: 1rem;
		padding-top: 0.8rem;
		border-top: 1px solid var(--line);
	}
	.spacer {
		flex: 1;
	}
	.btn {
		font-family: var(--font-mono);
		font-size: 0.64rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		padding: 0.42rem 0.9rem;
		color: var(--ink);
		background: transparent;
		border: 1px solid var(--line);
		border-radius: 2px;
		cursor: pointer;
		transition:
			border-color 0.2s,
			background 0.2s;
	}
	.btn:hover {
		border-color: var(--line-strong);
	}
	.btn.primary {
		background: var(--sage);
		color: var(--bg);
		border-color: var(--sage);
	}
	.btn.danger {
		color: var(--danger, #c98a8a);
		border-color: color-mix(in srgb, var(--danger, #c98a8a) 40%, transparent);
	}
</style>
