<script lang="ts">
	/**
	 * Импорт отчёта MetaTrader 5: выбор файла → разбор → предпросмотр → добавление.
	 * Разбор полностью локальный, файл никуда не отправляется.
	 */
	import Modal from './Modal.svelte';
	import { decodeMt5Html, parseMt5Report, type Mt5ParseResult } from '#lib/domain/mt5.ts';
	import {
		formatDate,
		formatMoney,
		tradeProfit,
		type Trade
	} from '#lib/domain/trades.ts';

	interface Props {
		open?: boolean;
		currency?: string;
		onImport?: (trades: Trade[]) => number;
		onClose?: (added?: number) => void;
	}

	let {
		open = $bindable(false),
		currency = 'USD',
		onImport = () => 0,
		onClose = () => {}
	}: Props = $props();

	let result = $state<Mt5ParseResult | null>(null);
	let fileName = $state('');
	let busy = $state(false);
	let errMsg = $state('');
	let dragOver = $state(false);

	async function handleFile(file: File) {
		if (!file) return;
		if (file.size > 10 * 1024 * 1024) {
			errMsg = 'Файл больше 10 МБ — похоже, это не отчёт MT5';
			return;
		}
		busy = true;
		errMsg = '';
		fileName = file.name;
		try {
			// MT5 сохраняет отчёты в UTF-16 LE с BOM — file.text() декодирует как UTF-8
			// и получаются NUL-байты между символами, поэтому читаем ArrayBuffer сами
			const buf = await file.arrayBuffer();
			result = parseMt5Report(decodeMt5Html(buf));
			if (!result.trades.length) errMsg = result.parseHint || 'Не удалось извлечь сделки';
		} catch (e) {
			errMsg = e instanceof Error ? e.message : String(e);
			result = null;
		} finally {
			busy = false;
		}
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
		const f = e.dataTransfer?.files?.[0];
		if (f) handleFile(f);
	}

	function onPick(e: Event) {
		const f = (e.currentTarget as HTMLInputElement).files?.[0];
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

	const typeLabel = $derived(
		result?.reportType === 'history' ? 'история' : result?.reportType === 'trade' ? 'торговый отчёт' : 'неизвестно'
	);

	const closedStats = $derived.by(() => {
		if (!result?.trades?.length) return null;
		const closed = result.trades.filter((t) => t.status === 'closed');
		const profit = closed.reduce((s, t) => s + tradeProfit(t), 0);
		const wins = closed.filter((t) => tradeProfit(t) > 0).length;
		return {
			count: result.trades.length,
			closed: closed.length,
			profit,
			wins,
			winrate: closed.length ? Math.round((wins / closed.length) * 100) : 0
		};
	});
</script>

{#if open}
	<Modal bind:open title="Импорт MT5" subtitle="отчёт торговой истории MT5 · данные не покидают устройство" size="md" {onClose}>
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
				<span class="dz-hint">или нажмите, чтобы выбрать файл</span>
			</label>
		{:else}
			<div class="file-line">
				<span class="file-name" title={fileName}>{fileName}</span>
				<span class="tag">{typeLabel}</span>
				{#if result.statementCurrency}<span class="tag">{result.statementCurrency}</span>{/if}
			</div>

			<div class="meta">
				<div class="meta-row">
					{#if result.accountTitle}
						<div class="cell grow">
							<span class="label">Счёт</span>
							<span class="value" title={result.accountTitle}>{result.accountTitle}</span>
						</div>
					{/if}
					{#if result.balanceRaw}
						<div class="cell">
							<span class="label">Баланс</span>
							<span class="value mono">{result.balanceRaw} {result.statementCurrency}</span>
						</div>
					{/if}
				</div>
				{#if result.importAccountKind || result.importAccountServer || result.importAccountHedgeMode}
					<div class="meta-row sub">
						<div class="cell grow">
							<span class="value dim mono">
								{[result.importAccountKind, result.importAccountServer, result.importAccountHedgeMode]
									.filter(Boolean)
									.join(' · ')}
							</span>
						</div>
					</div>
				{/if}
				{#if closedStats}
					<div class="meta-row">
						<div class="cell">
							<span class="label">Извлечено</span>
							<span class="value mono">{closedStats.count}</span>
						</div>
						<div class="cell">
							<span class="label">Закрыто</span>
							<span class="value mono">{closedStats.closed}</span>
						</div>
						<div class="cell">
							<span class="label">Победы</span>
							<span class="value mono profit">{closedStats.wins} · {closedStats.winrate}%</span>
						</div>
						<div class="cell">
							<span class="label">P/L</span>
							<span
								class="value mono"
								class:profit={closedStats.profit >= 0}
								class:loss={closedStats.profit < 0}>{formatMoney(closedStats.profit, currency, true)}</span
							>
						</div>
					</div>
				{/if}
			</div>

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
						{#each  (result.trades).slice(0, 12) as t (t.id)}
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

		{#snippet footer()}
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
		{/snippet}
	</Modal>
{/if}

<style>
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
		min-width: 0;
	}
	.file-name {
		color: var(--ink);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.tag {
		flex: none;
		font-size: 0.66rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		padding: 0.1rem 0.35rem;
		border: 1px solid var(--line);
		border-radius: 2px;
		color: var(--ink-muted);
	}
	/* инфо-панель отчёта: ячейки с волосяными разделителями */
	.meta {
		border: 1px solid var(--line);
		margin-bottom: 0.7rem;
	}
	.meta-row {
		display: flex;
		align-items: stretch;
	}
	.meta-row + .meta-row {
		border-top: 1px solid var(--line);
	}
	.cell {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		padding: 0.45rem 0.6rem;
		min-width: 0;
	}
	.cell + .cell {
		border-left: 1px solid var(--line);
	}
	.cell.grow {
		flex: 1 1 auto;
	}
	.meta-row.sub .cell {
		padding-top: 0.3rem;
		padding-bottom: 0.3rem;
	}
	.label {
		font-family: var(--font-mono);
		font-size: 0.58rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-muted);
	}
	.value {
		font-size: 0.72rem;
		color: var(--ink);
		min-width: 0;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.value.dim {
		color: var(--ink-muted);
		font-size: 0.64rem;
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
		font-size: 0.66rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-muted);
		padding: 0.35rem 0.4rem;
		border-bottom: 1px solid var(--line-strong);
		position: sticky;
		top: 0;
		background: var(--panel-solid);
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
		font-size: 0.66rem;
		color: var(--ink-muted);
		padding: 0.5rem 0.4rem;
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
