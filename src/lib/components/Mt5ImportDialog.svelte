<script>
	/**
	 * Импорт отчёта MetaTrader 5: выбор файла → разбор → предпросмотр → добавление.
	 * Разбор полностью локальный, файл никуда не отправляется.
	 */
	import { parseMt5Report } from '#lib/domain/mt5.js';
	import { formatDate, formatMoney, tradeProfit } from '#lib/domain/trades.js';

	/** @type {{open?: boolean, currency?: string, onImport?: (trades:any[])=>number, onClose?: ()=>void}} */
	let {
		open = $bindable(false),
		currency = 'USD',
		onImport = () => 0,
		onClose = () => {}
	} = $props();

	let result = $state(null);
	let fileName = $state('');
	let busy = $state(false);
	let errMsg = $state('');
	let dragOver = $state(false);

	async function handleFile(file) {
		if (!file) return;
		busy = true;
		errMsg = '';
		fileName = file.name;
		try {
			const text = await file.text();
			result = parseMt5Report(text);
			if (!result.trades.length) errMsg = result.parseHint || 'Не удалось извлечь сделки';
		} catch (e) {
			errMsg = e instanceof Error ? e.message : String(e);
			result = null;
		} finally {
			busy = false;
		}
	}

	function onDrop(e) {
		e.preventDefault();
		dragOver = false;
		const f = e.dataTransfer?.files?.[0];
		if (f) handleFile(f);
	}

	function onPick(e) {
		const f = e.currentTarget.files?.[0];
		if (f) handleFile(f);
	}

	function confirmImport() {
		if (!result?.trades?.length) return;
		const added = onImport(result.trades);
		open = false;
		result = null;
		errMsg = '';
		fileName = '';
		onClose(added);
	}

	function close() {
		open = false;
		result = null;
		errMsg = '';
		fileName = '';
		onClose();
	}

	const closedStats = $derived.by(() => {
		if (!result?.trades?.length) return null;
		const closed = result.trades.filter((t) => t.status === 'closed');
		const profit = closed.reduce((s, t) => s + tradeProfit(t), 0);
		const wins = closed.filter((t) => tradeProfit(t) > 0).length;
		return { count: result.trades.length, closed: closed.length, profit, wins };
	});
</script>

{#if open}
	<div
		class="overlay"
		role="presentation"
		onclick={(e) => {
			if (e.target === e.currentTarget) close();
		}}
	>
		<div class="dialog">
			<header class="dialog-head">
				<h2>Импорт MT5</h2>
				<button type="button" class="x" onclick={close} aria-label="Закрыть">✕</button>
			</header>

			{#if !result}
				<label
					class="dropzone"
					class:over={dragOver}
					ondragover={(e) => {
						e.preventDefault();
						dragOver = true;
					}}
					ondragleave={() => (dragOver = false)}
					ondrop={onDrop}
				>
					<input type="file" accept=".html,.htm,text/html" onchange={onPick} hidden />
					<span class="dz-icon">⤓</span>
					<span class="dz-title">{busy ? 'Разбираю…' : 'Перетащите HTML-отчёт MT5'}</span>
					<span class="dz-hint">или нажмите, чтобы выбрать файл · данные не покидают устройство</span>
				</label>
			{:else}
				<div class="file-line">
					<span class="file-name">{fileName}</span>
					<span class="tag">{result.reportType === 'history' ? 'история' : result.reportType === 'trade' ? 'торговый отчёт' : 'неизвестно'}</span>
				</div>

				{#if closedStats}
					<div class="stats">
						<span>Извлечено <b>{closedStats.count}</b></span>
						<span>закрытых <b>{closedStats.closed}</b></span>
						<span>побед <b class="profit">{closedStats.wins}</b></span>
						<span>P/L <b class:profit={closedStats.profit >= 0} class:loss={closedStats.profit < 0}
								>{formatMoney(closedStats.profit, currency, true)}</b
							></span>
					</div>
				{/if}

				<div class="preview-wrap">
					<table class="preview">
						<thead>
							<tr>
								<th>Открыта</th>
								<th>Пара</th>
								<th>Напр.</th>
								<th class="num">Объём</th>
								<th class="num">P/L</th>
							</tr>
						</thead>
						<tbody>
							{#each result.trades.slice(0, 12) as t (t.id)}
								{@const pl = tradeProfit(t)}
								<tr>
									<td class="mono">{formatDate(t.dateOpen)}</td>
									<td>{t.pair}</td>
									<td class="mono">{t.direction === 'long' ? 'L' : 'S'}</td>
									<td class="num mono">{t.volume}</td>
									<td class="num mono" class:profit={pl >= 0} class:loss={pl < 0}
										>{formatMoney(pl, currency, true)}</td
									>
								</tr>
							{/each}
						</tbody>
					</table>
					{#if result.trades.length > 12}
						<p class="more">…и ещё {result.trades.length - 12}</p>
					{/if}
				</div>
			{/if}

			{#if errMsg}
				<p class="err">{errMsg}</p>
			{/if}

			<footer class="dialog-foot">
				{#if result}
					<button type="button" class="btn" onclick={() => (result = null)}>Другой файл</button>
				{/if}
				<div class="spacer"></div>
				<button type="button" class="btn" onclick={close}>Отмена</button>
				<button
					type="button"
					class="btn primary"
					disabled={!result?.trades?.length}
					onclick={confirmImport}>Импортировать</button
				>
			</footer>
		</div>
	</div>
{/if}

<style>
	.overlay {
		position: fixed;
		inset: 0;
		z-index: 60;
		background: rgba(10, 11, 12, 0.72);
		display: grid;
		place-items: center;
		padding: 1.5rem;
	}
	.dialog {
		width: min(680px, 100%);
		max-height: 88dvh;
		overflow: auto;
		background: var(--panel);
		border: 1px solid var(--line-strong);
		border-radius: 3px;
		padding: 1.1rem 1.2rem 1rem;
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
	}
	.x:hover {
		color: var(--ink);
	}
	.dropzone {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		padding: 2.6rem 1rem;
		border: 1px dashed var(--line-strong);
		border-radius: 3px;
		cursor: pointer;
		transition:
			border-color 0.2s,
			background 0.2s;
	}
	.dropzone.over,
	.dropzone:hover {
		border-color: var(--sage);
		background: color-mix(in srgb, var(--sage) 5%, transparent);
	}
	.dz-icon {
		font-size: 1.6rem;
		color: var(--ink-muted);
	}
	.dz-title {
		font-size: 1rem;
	}
	.dz-hint {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--ink-muted);
		text-align: center;
	}
	.file-line {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		font-family: var(--font-mono);
		font-size: 0.7rem;
		margin-bottom: 0.7rem;
	}
	.file-name {
		color: var(--ink);
	}
	.tag {
		font-size: 0.58rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		padding: 0.1rem 0.35rem;
		border: 1px solid var(--line);
		border-radius: 2px;
		color: var(--ink-muted);
	}
	.stats {
		display: flex;
		flex-wrap: wrap;
		gap: 0.9rem;
		font-family: var(--font-mono);
		font-size: 0.66rem;
		color: var(--ink-muted);
		padding: 0.5rem 0;
		border-top: 1px solid var(--line);
		border-bottom: 1px solid var(--line);
		margin-bottom: 0.7rem;
	}
	.stats b {
		font-weight: 400;
		color: var(--ink);
	}
	.preview-wrap {
		max-height: 320px;
		overflow: auto;
	}
	table.preview {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.72rem;
	}
	table.preview th {
		text-align: left;
		font-family: var(--font-mono);
		font-size: 0.58rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-muted);
		padding: 0.35rem 0.4rem;
		border-bottom: 1px solid var(--line);
		position: sticky;
		top: 0;
		background: var(--panel);
	}
	table.preview td {
		padding: 0.32rem 0.4rem;
		border-bottom: 1px solid var(--line);
		white-space: nowrap;
	}
	.num {
		text-align: right;
	}
	.mono {
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}
	.profit {
		color: var(--sage);
	}
	.loss {
		color: var(--danger, #c98a8a);
	}
	.more {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--ink-muted);
		padding: 0.5rem 0.4rem;
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
	}
	.btn:hover {
		border-color: var(--line-strong);
	}
	.btn.primary {
		background: var(--sage);
		color: var(--bg);
		border-color: var(--sage);
	}
	.btn:disabled {
		opacity: 0.4;
		cursor: default;
	}
</style>
