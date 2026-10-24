/**
 * Хранение истории AI-чата.
 * Браузер → localStorage (ndtj:ai:chat), Tauri → AppData-файл ai-chat.json.
 * История отделена от торгового журнала и от ключа.
 */
import { isTauri, invoke } from '../platform/index.ts';
import { namespaced } from '../storage/local.ts';
import type { ChatSession } from './types.ts';

const ns = namespaced('ndtj:ai:');
const LS_KEY = 'chat';
const FILE = 'ai-chat.json';

interface HistoryPayload {
	version: number;
	sessions: ChatSession[];
}

export async function loadSessions(): Promise<ChatSession[]> {
	if (isTauri()) {
		try {
			const files = await invoke<string[]>('list_data_files', { relDir: '' });
			if (!Array.isArray(files) || !files.includes(FILE)) return [];
			const text = await invoke<string | null>('read_data_file', { relPath: FILE });
			if (!text) return [];
			return normalize(JSON.parse(String(text)));
		} catch (e) {
			console.error('ai.history.load (tauri) failed', e);
			return [];
		}
	}
	const raw = ns.get(LS_KEY);
	if (!raw) return [];
	try {
		return normalize(JSON.parse(raw));
	} catch (e) {
		console.error('ai.history.load (local) failed', e);
		return [];
	}
}

export async function saveSessions(sessions: ChatSession[]): Promise<void> {
	const payload: HistoryPayload = { version: 1, sessions };
	if (isTauri()) {
		const res = await invoke<{ ok?: boolean; error?: string }>('write_data_file', {
			relPath: FILE,
			contents: JSON.stringify(payload)
		});
		if (res && res.ok === false) throw new Error(res.error || 'ai-chat write failed');
		return;
	}
	ns.set(LS_KEY, JSON.stringify(payload));
}

export async function clearSessions(): Promise<void> {
	if (isTauri()) {
		try {
			await invoke('delete_data_file', { relPath: FILE });
		} catch (e) {
			console.error('ai.history.clear (tauri) failed', e);
		}
		return;
	}
	ns.remove(LS_KEY);
}

function normalize(data: unknown): ChatSession[] {
	const list = (data as HistoryPayload | null)?.sessions;
	if (!Array.isArray(list)) return [];
	return list
		.filter((s) => s && typeof s === 'object' && typeof s.id === 'string')
		.map((s) => ({
			id: String(s.id),
			title: String(s.title || 'Сессия'),
			createdTs: Number(s.createdTs) || Date.now(),
			messages: Array.isArray(s.messages)
				? s.messages.map((m) => ({
						id: String(m.id),
						role: m.role === 'assistant' ? 'assistant' : 'user',
						content: String(m.content ?? ''),
						ts: Number(m.ts) || Date.now(),
						model: m.model ?? null,
						thinking: m.thinking ?? null,
						status: m.status === 'stopped' || m.status === 'error' ? m.status : 'ok',
						usage: m.usage ?? null,
						contextChars: m.contextChars,
						errorNote: m.errorNote
					}))
				: []
		}));
}

/** Статистика истории: байт, бесед, сообщений (для настроек). */
export function historyStats(sessions: ChatSession[]): {
	bytes: number;
	sessions: number;
	messages: number;
} {
	let bytes = 0;
	let messages = 0;
	try {
		bytes = new Blob([JSON.stringify(sessions)]).size;
	} catch {
		bytes = JSON.stringify(sessions).length;
	}
	for (const s of sessions) messages += s.messages.length;
	return { bytes, sessions: sessions.length, messages };
}

/** 12.3 КБ / 1.8 МБ. */
export function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} Б`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}
