/**
 * Кэш списка моделей поставщика и их метаданных.
 * Браузер → localStorage (ndtj:ai:models), Tauri → AppData-файл ai-models.json.
 * Кэш привязан к Base URL: после смены endpoint'а он не используется.
 */
import { isTauri, invoke } from '../platform/index.ts';
import { namespaced } from '../storage/local.ts';
import type { ModelInfo } from './types.ts';

const ns = namespaced('ndtj:ai:');
const LS_KEY = 'models';
const FILE = 'ai-models.json';

export interface ModelsCache {
	/** Endpoint, у которого получен список (без хвостового слэша). */
	baseUrl: string;
	fetchedTs: number;
	models: ModelInfo[];
}

export async function loadModelsCache(): Promise<ModelsCache | null> {
	if (isTauri()) {
		try {
			const text = await invoke<string | null>('read_data_file', { relPath: FILE });
			if (!text) return null;
			return normalize(JSON.parse(String(text)));
		} catch (e) {
			console.error('ai.models.load (tauri) failed', e);
			return null;
		}
	}
	const raw = ns.get(LS_KEY);
	if (!raw) return null;
	try {
		return normalize(JSON.parse(raw));
	} catch (e) {
		console.error('ai.models.load (local) failed', e);
		return null;
	}
}

export async function saveModelsCache(cache: ModelsCache): Promise<void> {
	if (isTauri()) {
		try {
			await invoke('write_data_file', { relPath: FILE, contents: JSON.stringify(cache) });
		} catch (e) {
			console.error('ai.models.save (tauri) failed', e);
		}
		return;
	}
	ns.set(LS_KEY, JSON.stringify(cache));
}

export async function clearModelsCache(): Promise<void> {
	if (isTauri()) {
		try {
			await invoke('delete_data_file', { relPath: FILE });
		} catch (e) {
			console.error('ai.models.clear (tauri) failed', e);
		}
		return;
	}
	ns.remove(LS_KEY);
}

function normalize(data: unknown): ModelsCache | null {
	const c = data as ModelsCache | null;
	if (!c || !Array.isArray(c.models)) return null;
	const models = c.models
		.filter((m) => m && typeof m.id === 'string' && m.id)
		.map((m) => ({ id: m.id, pricing: m.pricing ?? null }));
	if (!models.length) return null;
	return {
		baseUrl: String(c.baseUrl ?? ''),
		fetchedTs: Number(c.fetchedTs) || 0,
		models
	};
}
