/**
 * Сборка контекста журнала для запроса: разделы (сделки, комментарии, заметки)
 * одним компактным текстом; вложения — отдельно, списком id (отправляются
 * картинками только vision-моделям).
 */
import type { SectionKey } from './types.ts';
import { tradeProfit, tradeSource, type Trade } from '../domain/trades.ts';
import { getBlob } from '../storage/idb.ts';

export interface ContextInput {
	sections: ReadonlySet<SectionKey>;
	trades: Trade[];
	/** Заметка дня (в приложении она одна). */
	note: string;
}

/** Собрать текстовый контекст журнала по разрешённым разделам. */
export function buildJournalContext(input: ContextInput): string {
	const parts: string[] = [];
	const { sections, trades, note } = input;

	if (sections.has('trades') && trades.length) {
		const lines = trades.map((t, i) => {
			const base = [
				`[${i + 1}] ${t.pair} ${t.direction === 'short' ? 'short' : 'long'} ${t.volume} лот`,
				`открыта ${t.dateOpen} @ ${t.priceOpen}`,
				t.status === 'closed' && t.dateClose
					? `закрыта ${t.dateClose} @ ${t.priceClose ?? '—'}`
					: 'СТАТУС: открыта',
				t.sl != null ? `SL ${t.sl}` : 'SL —',
				t.tp != null ? `TP ${t.tp}` : 'TP —',
				`P/L ${tradeProfit(t).toFixed(2)}`,
				`комиссия ${Number(t.commission) || 0}`,
				`своп ${Number(t.swap) || 0}`,
				`источник ${tradeSource(t)}`,
				t.tags.length ? `теги: ${t.tags.join(', ')}` : ''
			];
			return base.filter(Boolean).join(' | ');
		});
		parts.push(
			`# Сделки (${trades.length})\nФормат: [№] инструмент направление объём | даты и цены | SL/TP | P/L | комиссии | источник | теги\n` +
				lines.join('\n')
		);
	}

	if (sections.has('comments') && trades.length) {
		const withComments = trades.filter((t) => String(t.comment || '').trim());
		if (withComments.length) {
			const lines = withComments.map(
				(t) => `- ${t.pair} ${t.dateOpen}: ${String(t.comment).replace(/\s+/g, ' ').trim()}`
			);
			parts.push(`# Комментарии к сделкам\n${lines.join('\n')}`);
		}
	}

	if (sections.has('notes') && String(note || '').trim()) {
		parts.push(`# Заметки\n${note.trim()}`);
	}

	if (!parts.length) {
		return 'Журнал пуст или ни один раздел данных не разрешён к отправке.';
	}
	return parts.join('\n\n');
}

/** Уникальные id вложений по сделкам (для отправки картинками). */
export function collectAttachmentIds(trades: Trade[]): string[] {
	const out: string[] = [];
	for (const t of trades) {
		for (const a of Array.isArray(t.attachments) ? t.attachments : []) {
			if (a && !out.includes(a)) out.push(a);
		}
	}
	return out;
}

/** Вложения → data:URL (для content-частей image_url). Битые пропускаем. */
export async function attachmentsToDataUrls(ids: string[]): Promise<string[]> {
	const urls: string[] = [];
	for (const id of ids) {
		try {
			const blob = await getBlob(id);
			if (!blob) continue;
			urls.push(await blobToDataUrl(blob));
		} catch {
			/* недоступное вложение пропускаем */
		}
	}
	return urls;
}

function blobToDataUrl(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const r = new FileReader();
		r.onload = () => resolve(String(r.result));
		r.onerror = () => reject(r.error ?? new Error('blob read failed'));
		r.readAsDataURL(blob);
	});
}
