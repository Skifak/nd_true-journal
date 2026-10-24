// Типобезопасная обёртка над localStorage с поддержкой префиксов (мультиаккаунт).
// Работает одинаково в браузере и в Tauri (WebView хранит данные в профиле приложения).

/**
 * @typedef {Object} SafeStorage
 * @property {(key: string) => string | null} get
 * @property {(key: string, value: string) => void} set
 * @property {(key: string) => void} remove
 * @property {(prefix: string) => string[]} keys
 */

/** @type {SafeStorage} */
let impl;

function getImpl() {
	if (impl) return impl;
	if (typeof localStorage === 'undefined') {
		// SSR-безопасная заглушка
		/** @type {Map<string, string>} */
		const mem = new Map();
		impl = {
			get: (k) => mem.get(k) ?? null,
			set: (k, v) => void mem.set(k, v),
			remove: (k) => void mem.delete(k),
			keys: (prefix) => [...mem.keys()].filter((k) => k.startsWith(prefix))
		};
		return impl;
	}
	impl = {
		get(key) {
			try {
				return localStorage.getItem(key);
			} catch (e) {
				console.error('storage.get failed', e);
				return null;
			}
		},
		set(key, value) {
			try {
				localStorage.setItem(key, value);
			} catch (e) {
				console.error('storage.set failed (quota?)', e);
			}
		},
		remove(key) {
			try {
				localStorage.removeItem(key);
			} catch (e) {
				console.error('storage.remove failed', e);
			}
		},
		keys(prefix) {
			/** @type {string[]} */
			const out = [];
			for (let i = 0; i < localStorage.length; i++) {
				const k = localStorage.key(i);
				if (k && k.startsWith(prefix)) out.push(k);
			}
			return out;
		}
	};
	return impl;
}

/**
 * Пространство имён: возвращает объект с методами get/set/remove,
 * где каждый ключ автоматически дополняется префиксом.
 * @param {string} prefix
 * @returns {SafeStorage}
 */
export function namespaced(prefix) {
	const b = getImpl();
	return {
		get: (k) => b.get(prefix + k),
		set: (k, v) => b.set(prefix + k, v),
		remove: (k) => b.remove(prefix + k),
		keys: (p = '') => b.keys(prefix + p)
	};
}

export const storage = {
	get: (k) => getImpl().get(k),
	set: (k, v) => getImpl().set(k, v),
	remove: (k) => getImpl().remove(k),
	keys: (p = '') => getImpl().keys(p)
};
