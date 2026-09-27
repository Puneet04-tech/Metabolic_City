const DB_NAME = 'metabolic-city-field';
const STORE_NAME = 'field_outbox';

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: 'clientId' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function enqueueFieldUpdate(update) {
  const database = await openDatabase();
  await new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put({
      ...update,
      clientId: update.clientId || crypto.randomUUID(),
      queuedAt: new Date().toISOString(),
    });
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
  });
}

export async function flushFieldOutbox(apiRequest) {
  const database = await openDatabase();
  const updates = await new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  if (!updates.length) return 0;
  const response = await apiRequest('/v1/field/sync', { method: 'POST', body: { updates } });
  const accepted = new Set(response.results.filter((result) => result.accepted).map((result) => result.clientId));
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    accepted.forEach((clientId) => store.delete(clientId));
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
  return accepted.size;
}