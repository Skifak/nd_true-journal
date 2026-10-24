/**
 * Хранение API-ключа. Три места:
 *  - память (по умолчанию; стирается при закрытии приложения);
 *  - устройство: Tauri → AppData-файл ai-key.json (открытый текст, без шифрования — решение пользователя),
 *    браузер → localStorage.
 * Ключ никогда не логируется и не попадает в историю/настройки.
 */
import { isTauri, invoke } from '../platform/index.ts';
import { namespaced } from '../storage/local.ts';

const ns = namespaced('ndtj:ai:');
const LS_KEY = 'key';
const FILE = 'ai-key.json';

export type KeyPlace = 'memory' | 'device' | null;

let memoryKey: string | null = null;

/** Ключ в памяти (то, чем реально подписываются запросы). */
export function memoryHasKey(): boolean {
	return memoryKey != null && memoryKey.length > 0;
}

/** Ключ для подписи запросов (используется только внутри AI-слоя, не логируется). */
export function getKey(): string {
	return memoryKey ?? '';
}

/** Прочитать ключ в память из хранилища устройства (вызывается на старте). */
export async function restoreKey(): Promise<boolean> {
	if (memoryHasKey()) return true;
	if (isTauri()) {
		try {
			const files = await invoke<string[]>('list_data_files', { relDir: '' });
			if (!Array.isArray(files) || !files.includes(FILE)) return false;
			const text = await invoke<string | null>('read_data_file', { relPath: FILE });
			if (!text) return false;
			const json = JSON.parse(String(text)) as { apiKey?: unknown };
			if (typeof json.apiKey === 'string' && json.apiKey) {
				memoryKey = json.apiKey;
				return true;
			}
			return false;
		} catch (e) {
			console.error('ai.key.restore (tauri) failed', e);
			return false;
		}
	}
	const raw = ns.get(LS_KEY);
	if (!raw) return false;
	try {
		const json = JSON.parse(raw) as { apiKey?: unknown };
		if (typeof json.apiKey === 'string' && json.apiKey) {
			memoryKey = json.apiKey;
			return true;
		}
	} catch {
		/* повреждённая запись — считаем ключа нет */
	}
	return false;
}

/** Сохранить ключ: всегда в память; при place='device' — ещё и на устройство. */
export async function saveKey(apiKey: string, place: 'memory' | 'device'): Promise<void> {
	memoryKey = apiKey;
	if (place !== 'device') return;
	if (isTauri()) {
		const res = await invoke<{ ok?: boolean; error?: string }>('write_data_file', {
			relPath: FILE,
			contents: JSON.stringify({ apiKey })
		});
		if (res && res.ok === false) throw new Error(res.error || 'ai-key write failed');
		return;
	}
	ns.set(LS_KEY, JSON.stringify({ apiKey }));
}

/** Удалить ключ из памяти и с устройства. Историю чата не трогает. */
export async function clearKey(): Promise<void> {
	memoryKey = null;
	if (isTauri()) {
		try {
			await invoke('delete_data_file', { relPath: FILE });
		} catch (e) {
			console.error('ai.key.clear (tauri) failed', e);
		}
		return;
	}
	ns.remove(LS_KEY);
}
