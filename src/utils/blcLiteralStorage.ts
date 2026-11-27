import { BlcLiteralPartSize, BlcLiteralReadingPart, ParsedPage } from '../types/blc';
import {
  auth,
  buildFirestoreErrorInfo,
  db,
  OperationType,
  sanitizeForFirestore,
} from '../lib/firebase';
import { isAuthorizedBlcEmail } from '../lib/authConfig';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';

const DB_NAME = 'wisdom_reader_blc_db';
const DB_VERSION = 2;
const PAGES_STORE = 'book_pages';
const FORMATTED_STORE = 'formatted_sessions';

interface StoredBookPagesRecord {
  planId: string;
  pages: ParsedPage[];
  savedAt: number;
}

interface StoredFormattedSessionRecord {
  key: string;
  planId: string;
  sessionNumber: number;
  partSize: BlcLiteralPartSize;
  parts: BlcLiteralReadingPart[];
  savedAt: number;
}

function openBlcDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this browser.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PAGES_STORE)) {
        db.createObjectStore(PAGES_STORE, { keyPath: 'planId' });
      }
      if (!db.objectStoreNames.contains(FORMATTED_STORE)) {
        const store = db.createObjectStore(FORMATTED_STORE, { keyPath: 'key' });
        store.createIndex('by_plan', 'planId', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open BLC storage database.'));
  });
}

export async function saveBlcBookPages(planId: string, pages: ParsedPage[]): Promise<void> {
  try {
    const dbInstance = await openBlcDb();
    await new Promise<void>((resolve, reject) => {
      const tx = dbInstance.transaction(PAGES_STORE, 'readwrite');
      const store = tx.objectStore(PAGES_STORE);
      const record: StoredBookPagesRecord = {
        planId,
        pages,
        savedAt: Date.now(),
      };
      store.put(record);
      tx.oncomplete = () => {
        dbInstance.close();
        resolve();
      };
      tx.onerror = () => {
        dbInstance.close();
        reject(tx.error || new Error('Failed to save literal book pages.'));
      };
    });
  } catch (err) {
    console.warn('Could not persist BLC literal book pages to IDB:', err);
  }

  // Sync to Firestore only when authenticated (rules require request.auth != null)
  if (auth.currentUser && isAuthorizedBlcEmail(auth.currentUser.email)) {
    try {
      const cacheRef = doc(db, 'blcCachedPages', planId);
      await setDoc(cacheRef, sanitizeForFirestore({
        id: planId,
        planId,
        pages,
        updatedAt: Date.now(),
      }), { merge: true });
    } catch (err) {
      console.warn(
        'Could not sync pages to Firestore:',
        JSON.stringify(buildFirestoreErrorInfo(err, OperationType.WRITE, `blcCachedPages/${planId}`))
      );
    }
  }
}

export async function loadBlcBookPages(planId: string): Promise<ParsedPage[] | null> {
  // Try Firestore first when authenticated
  if (auth.currentUser && isAuthorizedBlcEmail(auth.currentUser.email)) {
    try {
      const cacheRef = doc(db, 'blcCachedPages', planId);
      const snap = await getDoc(cacheRef);
      if (snap.exists() && snap.data()?.pages) {
        const pages = snap.data().pages as ParsedPage[];
        if (Array.isArray(pages) && pages.length > 0) {
          return pages;
        }
      }
    } catch (err) {
      console.warn(
        'Could not load pages from Firestore, trying IDB:',
        JSON.stringify(buildFirestoreErrorInfo(err, OperationType.GET, `blcCachedPages/${planId}`))
      );
    }
  }

  // Fallback to IndexedDB
  try {
    const dbInstance = await openBlcDb();
    return await new Promise<ParsedPage[] | null>((resolve, reject) => {
      const tx = dbInstance.transaction(PAGES_STORE, 'readonly');
      const store = tx.objectStore(PAGES_STORE);
      const req = store.get(planId);
      req.onsuccess = () => {
        dbInstance.close();
        const result = req.result as StoredBookPagesRecord | undefined;
        resolve(result?.pages && Array.isArray(result.pages) ? result.pages : null);
      };
      req.onerror = () => {
        dbInstance.close();
        reject(req.error);
      };
    });
  } catch (err) {
    console.warn('Could not load BLC literal book pages:', err);
    return null;
  }
}

function makeFormattedKey(planId: string, sessionNumber: number): string {
  return `${planId}__session_${sessionNumber}`;
}

export async function saveFormattedSessionParts(
  planId: string,
  sessionNumber: number,
  partSize: BlcLiteralPartSize,
  parts: BlcLiteralReadingPart[]
): Promise<void> {
  const key = makeFormattedKey(planId, sessionNumber);
  try {
    const dbInstance = await openBlcDb();
    await new Promise<void>((resolve, reject) => {
      const tx = dbInstance.transaction(FORMATTED_STORE, 'readwrite');
      const store = tx.objectStore(FORMATTED_STORE);
      const record: StoredFormattedSessionRecord = {
        key,
        planId,
        sessionNumber,
        partSize,
        parts,
        savedAt: Date.now(),
      };
      store.put(record);
      tx.oncomplete = () => {
        dbInstance.close();
        resolve();
      };
      tx.onerror = () => {
        dbInstance.close();
        reject(tx.error || new Error('Failed to save contextually formatted session parts.'));
      };
    });
  } catch (err) {
    console.warn('Could not save formatted session parts to IDB:', err);
  }

  // Sync to Firestore when authenticated
  if (auth.currentUser && isAuthorizedBlcEmail(auth.currentUser.email)) {
    try {
      const cacheRef = doc(db, 'blcCachedPages', key);
      await setDoc(cacheRef, sanitizeForFirestore({
        id: key,
        planId,
        sessionNumber,
        partSize,
        parts,
        updatedAt: Date.now(),
      }), { merge: true });
    } catch (err) {
      console.warn(
        'Could not sync formatted parts to Firestore:',
        JSON.stringify(buildFirestoreErrorInfo(err, OperationType.WRITE, `blcCachedPages/${key}`))
      );
    }
  }
}

export async function loadFormattedSessionParts(
  planId: string,
  sessionNumber: number
): Promise<{ partSize: BlcLiteralPartSize; parts: BlcLiteralReadingPart[] } | null> {
  const key = makeFormattedKey(planId, sessionNumber);
  // Try Firestore first when authenticated
  if (auth.currentUser && isAuthorizedBlcEmail(auth.currentUser.email)) {
    try {
      const cacheRef = doc(db, 'blcCachedPages', key);
      const snap = await getDoc(cacheRef);
      if (snap.exists() && snap.data()?.parts) {
        const data = snap.data();
        if (Array.isArray(data.parts) && data.parts.length > 0) {
          return { partSize: data.partSize || 'standard', parts: data.parts };
        }
      }
    } catch (err) {
      console.warn(
        'Could not load formatted parts from Firestore, trying IDB:',
        JSON.stringify(buildFirestoreErrorInfo(err, OperationType.GET, `blcCachedPages/${key}`))
      );
    }
  }

  // Fallback to IndexedDB
  try {
    const dbInstance = await openBlcDb();
    return await new Promise<{ partSize: BlcLiteralPartSize; parts: BlcLiteralReadingPart[] } | null>(
      (resolve, reject) => {
        const tx = dbInstance.transaction(FORMATTED_STORE, 'readonly');
        const store = tx.objectStore(FORMATTED_STORE);
        const req = store.get(key);
        req.onsuccess = () => {
          dbInstance.close();
          const result = req.result as StoredFormattedSessionRecord | undefined;
          if (result?.parts && Array.isArray(result.parts) && result.parts.length > 0) {
            resolve({ partSize: result.partSize, parts: result.parts });
          } else {
            resolve(null);
          }
        };
        req.onerror = () => {
          dbInstance.close();
          reject(req.error);
        };
      }
    );
  } catch (err) {
    console.warn('Could not load formatted session parts:', err);
    return null;
  }
}

export async function deleteBlcBookPages(planId: string): Promise<void> {
  try {
    const dbInstance = await openBlcDb();
    await new Promise<void>((resolve, reject) => {
      const tx = dbInstance.transaction([PAGES_STORE, FORMATTED_STORE], 'readwrite');
      tx.objectStore(PAGES_STORE).delete(planId);

      const formattedStore = tx.objectStore(FORMATTED_STORE);
      const index = formattedStore.index('by_plan');
      const cursorReq = index.openCursor(IDBKeyRange.only(planId));
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      tx.oncomplete = () => {
        dbInstance.close();
        resolve();
      };
      tx.onerror = () => {
        dbInstance.close();
        reject(tx.error);
      };
    });
  } catch (err) {
    console.warn('Could not delete BLC literal book pages:', err);
  }

  if (auth.currentUser && isAuthorizedBlcEmail(auth.currentUser.email)) {
    try {
      await deleteDoc(doc(db, 'blcCachedPages', planId));
    } catch (err) {
      console.warn(
        'Could not delete cached pages from Firestore:',
        JSON.stringify(buildFirestoreErrorInfo(err, OperationType.DELETE, `blcCachedPages/${planId}`))
      );
    }
  }
}
