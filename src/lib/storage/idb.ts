// Минимальная обёртка над IndexedDB (без внешних библиотек).
// blob-store: бинарные вложения (скриншоты, файлы). Ключ = uuid.
// Всё локально: в браузере — профиль браузера, в Tauri — AppData.

const DB_NAME = 'nd-tj';
const DB_VERSION = 1;
const STORE = 'blobs';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
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

async function store(mode: IDBTransactionMode): Promise<IDBObjectStore> {
	const db = await openDb();
	return db.transaction(STORE, mode).objectStore(STORE);
}

function promisify<T>(req: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
	});
}

export async function putBlob(blob: Blob, key: string): Promise<void> {
	const s = await store('readwrite');
	await promisify(s.put(blob, key) as IDBRequest<IDBValidKey>);
}

export async function getBlob(key: string): Promise<Blob | undefined> {
	const s = await store('readonly');
	return promisify(s.get(key) as IDBRequest<Blob | undefined>);
}

export async function deleteBlob(key: string): Promise<void> {
	const s = await store('readwrite');
	await promisify(s.delete(key));
}

export async function listBlobs(): Promise<string[]> {
	const s = await store('readonly');
	return promisify(s.getAllKeys() as IDBRequest<string[]>);
}

/** Создать безопасный URL для показа вложения (revocable blob URL). */
export async function blobUrl(key: string): Promise<string | null> {
	const blob = await getBlob(key);
	if (!blob) return null;
	return URL.createObjectURL(blob);
}
