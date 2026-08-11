/**
 * 秘書の画像置き場。V1の `lib/idb.ts` から移植。
 *
 * ■ なぜ localStorage ではなく IndexedDB か
 * localStorage は文字列しか置けず、容量も5MB前後しかない。
 * 画像をbase64にして入れると、それだけで枠を使い切って
 * 曲データの保存に失敗する。画像はBlobのまま IndexedDB に置く。
 *
 * ■ 失敗しても止めない
 * プライベートモードなどで IndexedDB が使えない環境がある。
 * その場合は既定のアイコンにフォールバックするだけで、画面は普通に動かす。
 */

const DB_NAME = 'studio-next'
const STORE_NAME = 'files'
const DB_VERSION = 1

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb()
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode)
    const request = fn(tx.objectStore(STORE_NAME))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    tx.oncomplete = () => db.close()
  })
}

export const idbFiles = {
  get: (key: string) => withStore<Blob | undefined>('readonly', (s) => s.get(key)),
  set: (key: string, value: Blob) => withStore('readwrite', (s) => s.put(value, key)),
  remove: (key: string) => withStore('readwrite', (s) => s.delete(key)),
}
