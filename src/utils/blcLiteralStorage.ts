import { BlcLiteralPartSize, BlcLiteralReadingPart, ParsedPage } from '../types/blc';
import {
  auth,
  buildFirestoreErrorInfo,
  db,
  OperationType,
  sanitizeForFirestore,
} from '../lib/firebase';
import { isAuthorizedBlcEmail } from '../lib/authConfig';
import {
  collection,
  deleteDoc,
  doc,
  getDocFromServer,
  getDocs,
  query,
  setDoc,
  where,
} from 'firebase/firestore';

const LEGACY_IDB_NAME = 'wisdom_reader_blc_db';
const LEGACY_BLC_LOCAL_STORAGE_KEY = 'wisdom_reader_blc_plans';
const MAX_FIRESTORE_CHUNK_BYTES = 600_000;

let legacyCacheCleared = false;

/**
 * Purges any legacy localStorage / IndexedDB BLC caches so BLCs live strictly in Firestore.
 */
export function clearLegacyLocalBlcCache(): void {
  if (legacyCacheCleared || typeof window === 'undefined') return;
  legacyCacheCleared = true;

  try {
    window.localStorage?.removeItem(LEGACY_BLC_LOCAL_STORAGE_KEY);
  } catch {
    // ignore storage access issues
  }

  try {
    if (typeof window.indexedDB !== 'undefined') {
      window.indexedDB.deleteDatabase(LEGACY_IDB_NAME);
    }
  } catch {
    // ignore indexedDB deletion issues
  }
}

function assertAuthorizedDbAccess(): void {
  if (!auth.currentUser || !isAuthorizedBlcEmail(auth.currentUser.email)) {
    throw new Error('Sign in with an authorized Google account to access the BLC database.');
  }
}

function splitPagesIntoChunks(pages: ParsedPage[]): ParsedPage[][] {
  const chunks: ParsedPage[][] = [];
  let current: ParsedPage[] = [];
  let currentBytes = 0;

  for (const page of pages) {
    const pageBytes = JSON.stringify(page).length;
    if (current.length > 0 && currentBytes + pageBytes > MAX_FIRESTORE_CHUNK_BYTES) {
      chunks.push(current);
      current = [page];
      currentBytes = pageBytes;
    } else {
      current.push(page);
      currentBytes += pageBytes;
    }
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
}

export async function saveBlcBookPages(planId: string, pages: ParsedPage[]): Promise<void> {
  clearLegacyLocalBlcCache();
  assertAuthorizedDbAccess();

  const updatedAt = Date.now();
  const totalBytes = JSON.stringify(pages).length;

  try {
    const mainRef = doc(db, 'blcCachedPages', planId);

    if (totalBytes <= MAX_FIRESTORE_CHUNK_BYTES) {
      await setDoc(
        mainRef,
        sanitizeForFirestore({
          id: planId,
          planId,
          pages,
          chunkIds: [],
          updatedAt,
        }),
        { merge: true }
      );
      return;
    }

    // Large books exceed Firestore's 1 MB document limit: split cleanly across chunk docs
    const pageChunks = splitPagesIntoChunks(pages);
    const chunkIds: string[] = [];

    for (let i = 0; i < pageChunks.length; i++) {
      const chunkId = `${planId}__chunk_${i}`;
      chunkIds.push(chunkId);
      await setDoc(
        doc(db, 'blcCachedPages', chunkId),
        sanitizeForFirestore({
          id: chunkId,
          planId,
          chunkIndex: i,
          pages: pageChunks[i],
          updatedAt,
        })
      );
    }

    await setDoc(
      mainRef,
      sanitizeForFirestore({
        id: planId,
        planId,
        pages: [],
        chunkIds,
        updatedAt,
      })
    );
  } catch (err) {
    const info = buildFirestoreErrorInfo(err, OperationType.WRITE, `blcCachedPages/${planId}`);
    console.error('Firestore Error:', JSON.stringify(info));
    throw err;
  }
}

export async function loadBlcBookPages(planId: string): Promise<ParsedPage[] | null> {
  clearLegacyLocalBlcCache();

  if (!auth.currentUser || !isAuthorizedBlcEmail(auth.currentUser.email)) {
    return null;
  }

  try {
    const cacheRef = doc(db, 'blcCachedPages', planId);
    const snap = await getDocFromServer(cacheRef);
    if (!snap.exists()) {
      return null;
    }

    const data = snap.data();
    const chunkIds = Array.isArray(data?.chunkIds) ? (data.chunkIds as string[]) : [];

    if (chunkIds.length > 0) {
      const combinedPages: ParsedPage[] = [];
      for (const chunkId of chunkIds) {
        const chunkSnap = await getDocFromServer(doc(db, 'blcCachedPages', chunkId));
        if (chunkSnap.exists()) {
          const chunkPages = chunkSnap.data()?.pages;
          if (Array.isArray(chunkPages)) {
            combinedPages.push(...(chunkPages as ParsedPage[]));
          }
        }
      }
      return combinedPages.length > 0 ? combinedPages : null;
    }

    const pages = data?.pages as ParsedPage[] | undefined;
    return Array.isArray(pages) && pages.length > 0 ? pages : null;
  } catch (err) {
    const info = buildFirestoreErrorInfo(err, OperationType.GET, `blcCachedPages/${planId}`);
    console.error('Firestore Error:', JSON.stringify(info));
    throw err;
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
  clearLegacyLocalBlcCache();
  assertAuthorizedDbAccess();

  const key = makeFormattedKey(planId, sessionNumber);
  try {
    const cacheRef = doc(db, 'blcCachedPages', key);
    await setDoc(
      cacheRef,
      sanitizeForFirestore({
        id: key,
        planId,
        sessionNumber,
        partSize,
        parts,
        updatedAt: Date.now(),
      }),
      { merge: true }
    );
  } catch (err) {
    const info = buildFirestoreErrorInfo(err, OperationType.WRITE, `blcCachedPages/${key}`);
    console.error('Firestore Error:', JSON.stringify(info));
    throw err;
  }
}

export async function loadFormattedSessionParts(
  planId: string,
  sessionNumber: number
): Promise<{ partSize: BlcLiteralPartSize; parts: BlcLiteralReadingPart[] } | null> {
  clearLegacyLocalBlcCache();

  if (!auth.currentUser || !isAuthorizedBlcEmail(auth.currentUser.email)) {
    return null;
  }

  const key = makeFormattedKey(planId, sessionNumber);
  try {
    const cacheRef = doc(db, 'blcCachedPages', key);
    const snap = await getDocFromServer(cacheRef);
    if (snap.exists() && snap.data()?.parts) {
      const data = snap.data();
      if (Array.isArray(data.parts) && data.parts.length > 0) {
        return { partSize: data.partSize || 'standard', parts: data.parts };
      }
    }
    return null;
  } catch (err) {
    const info = buildFirestoreErrorInfo(err, OperationType.GET, `blcCachedPages/${key}`);
    console.error('Firestore Error:', JSON.stringify(info));
    return null;
  }
}

export async function deleteBlcBookPages(planId: string): Promise<void> {
  clearLegacyLocalBlcCache();

  if (!auth.currentUser || !isAuthorizedBlcEmail(auth.currentUser.email)) {
    return;
  }

  try {
    const relatedQuery = query(
      collection(db, 'blcCachedPages'),
      where('planId', '==', planId)
    );
    const relatedSnap = await getDocs(relatedQuery);
    const deletePromises = relatedSnap.docs.map(d => deleteDoc(d.ref));

    if (!relatedSnap.docs.some(d => d.id === planId)) {
      deletePromises.push(deleteDoc(doc(db, 'blcCachedPages', planId)));
    }

    await Promise.all(deletePromises);
  } catch (err) {
    const info = buildFirestoreErrorInfo(err, OperationType.DELETE, `blcCachedPages/${planId}`);
    console.error('Firestore Error:', JSON.stringify(info));
  }
}
