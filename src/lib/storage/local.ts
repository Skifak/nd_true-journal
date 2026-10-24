// Типобезопасная обёртка над localStorage с поддержкой префиксов (мультиаккаунт).
// Работает одинаково в браузере и в Tauri (WebView хранит данные в профиле приложения).

export interface SafeStorage {
	get(key: string): string | null;
	set(key: string, value: string): void;
	remove(key: string): void;
	keys(prefix: string): string[];
}

let impl: SafeStorage | null = null;

function getImpl(): SafeStorage {
	if (impl) return impl;
	if (typeof localStorage === 'undefined') {
		// SSR-безопасная заглушка
		const mem = new Map<string, string>();
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
			const out: string[] = [];
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
 */
export function namespaced(prefix: string): SafeStorage {
	const b = getImpl();
	return {
		get: (k) => b.get(prefix + k),
		set: (k, v) => b.set(prefix + k, v),
		remove: (k) => b.remove(prefix + k),
		keys: (p = '') => b.keys(prefix + p)
	};
}

export const storage: SafeStorage = {
	get: (k) => getImpl().get(k),
	set: (k, v) => getImpl().set(k, v),
	remove: (k) => getImpl().remove(k),
	keys: (p = '') => getImpl().keys(p)
};
