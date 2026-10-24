// Единая точка доступа к платформе.
// Все запросы к возможностям среды (хранилище, файлы, сеть) идут через этот модуль.
// В браузере это безопасные эмуляции поверх localStorage/IndexedDB,
// в Tauri — вызовы нативных команд с валидацией путей на стороне Rust.

/**
 * @typedef {'browser' | 'tauri'} PlatformKind
 */

const platforms = {
	browser: null,
	tauri: null
};

/** @returns {PlatformKind} */
export function detectPlatform() {
	// Tauri 2 injects __TAURI_INTERNALS__ до загрузки бандла
	if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) return 'tauri';
	return 'browser';
}

/** @returns {boolean} */
export function isTauri() {
	return detectPlatform() === 'tauri';
}

/**
 * Строгий доступ к глобальному Tauri API (withGlobalTauri: true).
 * @returns {Record<string, any>}
 */
export function tauri() {
	if (platforms.tauri) return platforms.tauri;
	// @ts-ignore
	const t = globalThis.__TAURI__;
	if (!t) throw new Error('Tauri API недоступен (приложение запущено вне Tauri?)');
	platforms.tauri = t;
	return t;
}

/**
 * Безопасный вызов нативной команды: существует только в Tauri,
 * в браузере выбрасывает понятную ошибку (не молча эмулирует).
 * @template T
 * @param {string} cmd
 * @param {Record<string, unknown>=} args
 * @returns {Promise<T>}
 */
export async function invoke(cmd, args = {}) {
	return /** @type {Promise<T>} */ (tauri().core.invoke(cmd, args));
}
