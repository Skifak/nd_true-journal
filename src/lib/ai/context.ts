/**
 * Сборка контекста журнала для запроса: разделы (сделки, комментарии, заметки,
 * дневник) одним компактным текстом; вложения — отдельно, списком id (отправляются
 * картинками только vision-моделям).
 */
import type { SectionKey } from './types.ts';
import { tradeProfit, tradeSource, parseStamp, type Trade } from '../domain/trades.ts';
import { kindInfo, type DiaryEntry } from '../domain/diary.ts';
import { getBlob } from '../storage/idb.ts';

export interface ContextInput {
	sections: ReadonlySet<SectionKey>;
	trades: Trade[];
	/** Заметка дня (в приложении она одна). */
	note: string;
	/** Записи дневника — читаются только при включённой галочке. */
	diary?: DiaryEntry[];
}

/** Собрать текстовый контекст журнала по разрешённым разделам. */
export function buildJournalContext(input: ContextInput): string {
	const parts: string[] = [];
	const { sections, note } = input;
	// Хронологический порядок (старые → новые): нумерация [№] в контексте совпадает со временем.
	const trades = [...input.trades].sort(
		(a, b) => (parseStamp(a.dateOpen)?.getTime() ?? 0) - (parseStamp(b.dateOpen)?.getTime() ?? 0)
	);

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

	if (sections.has('diary')) {
		const diary = diaryLines(input.diary ?? []);
		if (diary) parts.push(`# Дневник\n${diary}`);
	}

	if (!parts.length) {
		return 'Журнал пуст или ни один раздел данных не разрешён к отправке.';
	}
	return parts.join('\n\n');
}

/**
 * Записи дневника одной строкой каждая: тип, время, текст, поля разборов,
 * шкалы, теги, связи со сделками. Пустой дневник → пустая строка.
 */
function diaryLines(entries: DiaryEntry[]): string {
	const sorted = [...entries].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
	const lines = sorted.map((e) => {
		const fields = [
			`[${kindInfo(e.kind).label}] ${e.at}`,
			flat(e.text),
			e.kind === 'mistake' ? labeled('что', e.mistakeWhat) : '',
			e.kind === 'mistake' ? labeled('почему', e.mistakeWhy) : '',
			e.kind === 'mistake' ? labeled('что изменю', e.mistakeFix) : '',
			e.kind === 'day' ? labeled('план', e.dayPlan) : '',
			e.kind === 'day' ? labeled('итог', e.dayResult) : '',
			e.kind === 'day' ? labeled('главная ошибка', e.mainMistake) : '',
			e.kind === 'day' && e.checklist ? `чек-лист: ${CHECKLIST_SHORT[e.checklist]}` : '',
			e.discipline != null ? `дисциплина ${e.discipline}/5` : '',
			e.calm != null ? `спокойствие ${e.calm}/5` : '',
			e.followedPlan == null ? '' : `план: ${e.followedPlan ? 'да' : 'нет'}`,
			e.tags.length ? `теги: ${e.tags.join(', ')}` : '',
			e.tradeIds.length ? `сделки: ${e.tradeIds.join(', ')}` : ''
		];
		return fields.filter(Boolean).join(' | ');
	});
	return lines.join('\n');
}

const CHECKLIST_SHORT = { yes: 'да', partial: 'частично', no: 'нет' } as const;

function flat(text: string): string {
	return String(text || '').replace(/\s+/g, ' ').trim();
}

function labeled(name: string, value: string): string {
	const text = flat(value);
	return text ? `${name}: ${text}` : '';
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
