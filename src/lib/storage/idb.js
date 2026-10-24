// Минимальная обёртка над IndexedDB (без внешних библиотек).
// blob-store: бинарные вложения (скриншоты, файлы). Ключ = uuid.
// Всё локально: в браузере — профиль браузера, в Tauri — AppData.

const DB_NAME = 'nd-tj';
const DB_VERSION = 1;
const STORE = 'blobs';

/** @type {Promise<IDBDatabase> | null} */
let dbPromise = null;

/** @returns {Promise<IDBDatabase>} */
function openDb() {
	if (dbPromise) return dbPromise;
	dbPromise = new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
	});
	return dbPromise;
}

/**
 * @param {'readonly'|'readwrite'} mode
 * @returns {Promise<IDBObjectStore>}
 */
async function store(mode) {
	const db = await openDb();
	return db.transaction(STORE, mode).objectStore(STORE);
}

/**
 * @template T
 * @param {IDBRequest<T>} req
 * @returns {Promise<T>}
 */
function promisify(req) {
	return new Promise((resolve, reject) => {
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
	});
}

/** @param {Blob} blob @param {string} key @returns {Promise<void>} */
export async function putBlob(blob, key) {
	const s = await store('readwrite');
	await promisify(/** @type {IDBRequest<IDBValidKey>} */ (s.put(blob, key)));
}

/** @param {string} key @returns {Promise<Blob | undefined>} */
export async function getBlob(key) {
	const s = await store('readonly');
	return promisify(/** @type {IDBRequest<Blob|undefined>} */ (s.get(key)));
}

/** @param {string} key @returns {Promise<void>} */
export async function deleteBlob(key) {
	const s = await store('readwrite');
	await promisify(s.delete(key));
}

/** @returns {Promise<string[]>} */
export async function listBlobs() {
	const s = await store('readonly');
	return promisify(/** @type {IDBRequest<string[]>} */ (s.getAllKeys()));
}

/**
 * Создать безопасный URL для показа вложения (revocable blob URL).
 * @param {string} key
 * @returns {Promise<string | null>}
 */
export async function blobUrl(key) {
	const blob = await getBlob(key);
	if (!blob) return null;
	return URL.createObjectURL(blob);
}
