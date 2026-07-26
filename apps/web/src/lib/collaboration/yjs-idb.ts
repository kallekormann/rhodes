/** Drop y-indexeddb storage for a document so server state can load cleanly. */
export function clearYjsIndexedDbPersistence(docName: string): Promise<void> {
  if (typeof indexedDB === "undefined") return Promise.resolve();
  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(docName);
    request.onsuccess = () => resolve();
    request.onblocked = () => resolve();
    request.onerror = () => resolve();
  });
}
