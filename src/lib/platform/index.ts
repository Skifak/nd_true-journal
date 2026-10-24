// Единая точка доступа к платформе.
// Все запросы к возможностям среды (хранилище, файлы, сеть) идут через этот модуль.
// В браузере это безопасные эмуляции поверх localStorage/IndexedDB,
// в Tauri — вызовы нативных команд с валидацией путей на стороне Rust.

export type PlatformKind = 'browser' | 'tauri';

/** Минимальная форма Tauri API, которую использует приложение. */
export interface TauriGlobal {
	core: {
		invoke<T = unknown>(cmd: string, args?: Record<string, unknown>): Promise<T>;
	};
}

const platforms: { browser: null; tauri: TauriGlobal | null } = {
	browser: null,
	tauri: null
};

export function detectPlatform(): PlatformKind {
	// Tauri 2 injects __TAURI_INTERNALS__ до загрузки бандла
	if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) return 'tauri';
	return 'browser';
}

export function isTauri(): boolean {
	return detectPlatform() === 'tauri';
}

/** Строгий доступ к глобальному Tauri API (withGlobalTauri: true). */
export function tauri(): TauriGlobal {
	if (platforms.tauri) return platforms.tauri;
	const t = (globalThis as { __TAURI__?: TauriGlobal }).__TAURI__;
	if (!t) throw new Error('Tauri API недоступен (приложение запущено вне Tauri?)');
	platforms.tauri = t;
	return t;
}

/**
 * Безопасный вызов нативной команды: существует только в Tauri,
 * в браузере выбрасывает понятную ошибку (не молча эмулирует).
 */
export async function invoke<T = unknown>(
	cmd: string,
	args: Record<string, unknown> = {}
): Promise<T> {
	return tauri().core.invoke<T>(cmd, args);
}
