import { User } from 'firebase/auth';
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { OperationType, db, handleFirestoreError } from '../firebase';
import {
  AssyRecord,
  AutoCutItem,
  FeederItem,
  RefreshHistoryEntry,
  StdDatabase,
} from '../types/umh';

export interface CloudUserProfile {
  uid: string;
  displayName?: string;
  email: string;
  photoURL?: string;
  lastPicName?: string;
  pendingMasterSync: boolean;
}

export interface CloudMasterConfig {
  stdDb: StdDatabase;
  autoCutList: AutoCutItem[];
  feederList: FeederItem[];
}

const MAX_DOC_BYTES = 860_000; // Safe ceiling below Firestore's 1 MiB document limit

function sanitizeIdPart(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_');
  return cleaned || `item_${Date.now()}`;
}

export function toScopedDocId(uid: string, localId: string): string {
  const prefix = `${sanitizeIdPart(uid).slice(0, 12)}_`;
  const cleanLocal = sanitizeIdPart(localId);
  const combined = cleanLocal.startsWith(prefix) ? cleanLocal : `${prefix}${cleanLocal}`;
  return combined.slice(0, 128);
}

function matrixToMap(matrix: number[][]): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  matrix.forEach((row, idx) => {
    out[String(idx)] = row.map((v) => (Number.isFinite(v) ? v : 0));
  });
  return out;
}

function mapToMatrix(
  mapVal: Record<string, number[]> | undefined,
  fallback: number[][]
): number[][] {
  if (!mapVal || typeof mapVal !== 'object') return structuredClone(fallback);
  const keys = Object.keys(mapVal)
    .filter((k) => /^\d+$/.test(k))
    .sort((a, b) => Number(a) - Number(b));
  if (keys.length === 0) return structuredClone(fallback);
  return keys.map((k) =>
    Array.isArray(mapVal[k]) ? mapVal[k].map((n) => Number(n) || 0) : []
  );
}

function cleanForFirestore<T>(val: T): T {
  if (val === null || typeof val === 'string' || typeof val === 'boolean') {
    return val;
  }
  if (typeof val === 'number') {
    return (Number.isFinite(val) ? val : 0) as unknown as T;
  }
  if (Array.isArray(val)) {
    return val
      .filter((item) => item !== undefined)
      .map((item) => cleanForFirestore(item)) as unknown as T;
  }
  if (typeof val === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (v !== undefined) {
        out[k] = cleanForFirestore(v);
      }
    }
    return out as T;
  }
  return val;
}

function estimateUtf8Bytes(obj: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(obj)).length;
  } catch {
    return 0;
  }
}

function tsToIso(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string' && val) {
    return val;
  }
  return new Date().toISOString();
}

function buildAssyPayloadFields(uid: string, record: AssyRecord, scopedId: string) {
  const assyNo = (record.params.assyNo || '').trim().slice(0, 120) || 'ASSY';
  const customer = (record.params.customer || '').trim().slice(0, 120);

  let calculationPayload: Record<string, unknown> = cleanForFirestore(
    record.calculation
  ) as unknown as Record<string, unknown>;

  const payload = {
    id: scopedId,
    ownerId: uid,
    assyNo,
    customer,
    params: cleanForFirestore({
      ...record.params,
      assyNo,
      customer,
    }),
    assemblyComponents: cleanForFirestore(record.assemblyComponents),
    partList: cleanForFirestore(record.partList.slice(0, 2000)),
    ppcsList: cleanForFirestore(record.ppcsList.slice(0, 5000)),
    assemblyCotList: cleanForFirestore(record.assemblyCotList.slice(0, 1500)),
    terminalRatios: cleanForFirestore(record.terminalRatios),
    calculation: calculationPayload,
  };

  // Guard against Firestore's 1 MiB document size limit on very large Wire Harnesses.
  // Stripped calculation details are automatically recomputed on load by App.tsx.
  if (estimateUtf8Bytes(payload) > MAX_DOC_BYTES) {
    const { smv: _omitSmv, ...regOnly } = calculationPayload;
    payload.calculation = regOnly;
  }
  if (estimateUtf8Bytes(payload) > MAX_DOC_BYTES) {
    payload.calculation = {
      lotMetrics: record.calculation.lotMetrics,
      totalBaseSec: record.calculation.totalBaseSec,
      totalAllowByProcessSec: record.calculation.totalAllowByProcessSec,
      totalAllowByFinalSec: record.calculation.totalAllowByFinalSec,
      twistBundlesCount: record.calculation.twistBundlesCount,
      autoCutCandidateTerminals: record.calculation.autoCutCandidateTerminals,
      processes: [],
      _compact: true,
    };
  }

  return payload;
}

export async function initializeCloudWorkspace(
  user: User,
  localState: {
    stdDb: StdDatabase;
    autoCutList: AutoCutItem[];
    feederList: FeederItem[];
    records: AssyRecord[];
    refreshHistory: RefreshHistoryEntry[];
    lastPicName: string;
    pendingMasterSync: boolean;
  }
): Promise<void> {
  const uid = user.uid;
  const userPath = `users/${uid}`;
  const masterPath = `masterConfigs/${uid}`;

  // 1. Ensure user profile exists (auto-creates 'users' collection)
  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    const displayName = (user.displayName || '').slice(0, 120);
    const email = (user.email || 'user@example.com').slice(0, 254);
    const photoURL = (user.photoURL || '').slice(0, 1000);
    const lastPicName = (localState.lastPicName || '').slice(0, 120);

    if (!userSnap.exists()) {
      await setDoc(userRef, {
        uid,
        email,
        ...(displayName ? { displayName } : {}),
        ...(photoURL ? { photoURL } : {}),
        ...(lastPicName ? { lastPicName } : {}),
        pendingMasterSync: localState.pendingMasterSync,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(userRef, {
        email,
        ...(displayName ? { displayName } : {}),
        ...(photoURL ? { photoURL } : {}),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }

  // 2. Ensure master config exists (auto-creates 'masterConfigs' collection)
  try {
    const masterRef = doc(db, 'masterConfigs', uid);
    const masterSnap = await getDoc(masterRef);

    if (!masterSnap.exists()) {
      await setDoc(masterRef, {
        ownerId: uid,
        params: cleanForFirestore(localState.stdDb.params.slice(0, 300)),
        acMatrixMap: matrixToMap(localState.stdDb.acMatrix),
        saMatrixMap: matrixToMap(localState.stdDb.saMatrix),
        mcMatrixMap: matrixToMap(localState.stdDb.mcMatrix),
        autoCutList: cleanForFirestore(localState.autoCutList.slice(0, 2000)),
        feederList: cleanForFirestore(localState.feederList.slice(0, 2000)),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, masterPath);
  }

  // 3. Sync any local Assy records not yet present in Firestore (auto-creates 'assyRecords' collection)
  if (localState.records.length > 0) {
    const existingAssyIds = new Set<string>();
    try {
      const existingSnap = await getDocs(
        query(collection(db, 'assyRecords'), where('ownerId', '==', uid))
      );
      existingSnap.forEach((d) => existingAssyIds.add(d.id));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'assyRecords');
    }

    for (const rec of localState.records) {
      const scopedId = toScopedDocId(uid, rec.id);
      if (existingAssyIds.has(scopedId)) continue;
      const recPath = `assyRecords/${scopedId}`;
      try {
        await setDoc(doc(db, 'assyRecords', scopedId), {
          ...buildAssyPayloadFields(uid, rec, scopedId),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, recPath);
      }
    }
  }

  // 4. Sync any local refresh history entries not yet present in Firestore (auto-creates 'refreshHistory')
  if (localState.refreshHistory.length > 0) {
    const existingHistIds = new Set<string>();
    try {
      const existingSnap = await getDocs(
        query(collection(db, 'refreshHistory'), where('ownerId', '==', uid))
      );
      existingSnap.forEach((d) => existingHistIds.add(d.id));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'refreshHistory');
    }

    for (const entry of localState.refreshHistory.slice(0, 50)) {
      const scopedId = toScopedDocId(uid, entry.id);
      if (existingHistIds.has(scopedId)) continue;
      const histPath = `refreshHistory/${scopedId}`;
      try {
        await setDoc(doc(db, 'refreshHistory', scopedId), {
          id: scopedId,
          ownerId: uid,
          refreshedAt: serverTimestamp(),
          responsibleName: (entry.responsibleName || 'PIC').slice(0, 120),
          totalSelectedCount: Math.max(0, Math.min(1000, entry.totalSelectedCount)),
          affectedAssyCount: Math.max(0, Math.min(1000, entry.affectedAssyCount)),
          unaffectedAssyCount: Math.max(0, Math.min(1000, entry.unaffectedAssyCount)),
          affectedDiffs: cleanForFirestore(entry.affectedDiffs.slice(0, 500)),
          createdAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, histPath);
      }
    }
  }
}

export function subscribeUserProfile(
  uid: string,
  onData: (profile: CloudUserProfile | null) => void,
  onError: (err: Error) => void
) {
  const path = `users/${uid}`;
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      const d = snap.data();
      onData({
        uid: String(d.uid || uid),
        displayName: typeof d.displayName === 'string' ? d.displayName : undefined,
        email: String(d.email || ''),
        photoURL: typeof d.photoURL === 'string' ? d.photoURL : undefined,
        lastPicName: typeof d.lastPicName === 'string' ? d.lastPicName : undefined,
        pendingMasterSync: Boolean(d.pendingMasterSync),
      });
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (e) {
        onError(e as Error);
      }
    }
  );
}

export async function updateUserPreferencesInCloud(
  uid: string,
  updates: { pendingMasterSync?: boolean; lastPicName?: string }
): Promise<void> {
  const path = `users/${uid}`;
  try {
    const payload: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    if (typeof updates.pendingMasterSync === 'boolean') {
      payload.pendingMasterSync = updates.pendingMasterSync;
    }
    if (typeof updates.lastPicName === 'string') {
      payload.lastPicName = updates.lastPicName.slice(0, 120);
    }
    await updateDoc(doc(db, 'users', uid), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function subscribeMasterConfig(
  uid: string,
  fallbackStd: StdDatabase,
  onData: (cfg: CloudMasterConfig | null) => void,
  onError: (err: Error) => void
) {
  const path = `masterConfigs/${uid}`;
  return onSnapshot(
    doc(db, 'masterConfigs', uid),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      const d = snap.data();
      onData({
        stdDb: {
          params: Array.isArray(d.params) ? d.params : structuredClone(fallbackStd.params),
          acMatrix: mapToMatrix(d.acMatrixMap, fallbackStd.acMatrix),
          saMatrix: mapToMatrix(d.saMatrixMap, fallbackStd.saMatrix),
          mcMatrix: mapToMatrix(d.mcMatrixMap, fallbackStd.mcMatrix),
          processDiscs: fallbackStd.processDiscs
            ? structuredClone(fallbackStd.processDiscs)
            : undefined,
        },
        autoCutList: Array.isArray(d.autoCutList) ? d.autoCutList : [],
        feederList: Array.isArray(d.feederList) ? d.feederList : [],
      });
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (e) {
        onError(e as Error);
      }
    }
  );
}

let masterConfigWriteQueue: Promise<void> = Promise.resolve();

export function saveMasterConfigToCloud(
  uid: string,
  stdDb: StdDatabase,
  autoCutList: AutoCutItem[],
  feederList: FeederItem[]
): Promise<void> {
  const path = `masterConfigs/${uid}`;
  const ref = doc(db, 'masterConfigs', uid);
  const body = {
    params: cleanForFirestore(stdDb.params.slice(0, 300)),
    acMatrixMap: matrixToMap(stdDb.acMatrix),
    saMatrixMap: matrixToMap(stdDb.saMatrix),
    mcMatrixMap: matrixToMap(stdDb.mcMatrix),
    autoCutList: cleanForFirestore(autoCutList.slice(0, 2000)),
    feederList: cleanForFirestore(feederList.slice(0, 2000)),
    updatedAt: serverTimestamp(),
  };

  const runWrite = async () => {
    try {
      const snap = await getDoc(ref);
      if (snap.exists()) {
        await updateDoc(ref, body);
      } else {
        await setDoc(ref, {
          ownerId: uid,
          ...body,
          createdAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  // Serialize writes so back-to-back updates/resets always commit in order.
  const nextOp = masterConfigWriteQueue.then(runWrite, runWrite);
  masterConfigWriteQueue = nextOp.catch(() => undefined);
  return nextOp;
}

export function subscribeAssyRecords(
  uid: string,
  onData: (records: AssyRecord[]) => void,
  onError: (err: Error) => void
) {
  const path = 'assyRecords';
  const q = query(collection(db, 'assyRecords'), where('ownerId', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const list: AssyRecord[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: String(d.id || docSnap.id),
          createdAt: tsToIso(d.createdAt),
          updatedAt: tsToIso(d.updatedAt),
          params: d.params,
          assemblyComponents: d.assemblyComponents,
          partList: Array.isArray(d.partList) ? d.partList : [],
          ppcsList: Array.isArray(d.ppcsList) ? d.ppcsList : [],
          assemblyCotList: Array.isArray(d.assemblyCotList) ? d.assemblyCotList : [],
          terminalRatios: d.terminalRatios || {},
          calculation: d.calculation,
        } as AssyRecord;
      });
      list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (e) {
        onError(e as Error);
      }
    }
  );
}

export async function upsertAssyRecordInCloud(
  uid: string,
  record: AssyRecord
): Promise<AssyRecord> {
  const scopedId = toScopedDocId(uid, record.id);
  const path = `assyRecords/${scopedId}`;
  const fields = buildAssyPayloadFields(uid, record, scopedId);

  let existsInCloud = false;
  try {
    // Use owner-scoped list query instead of getDoc(ref) so non-existent docs
    // never fail security rules that inspect resource.data.ownerId on get.
    const ownedSnap = await getDocs(
      query(collection(db, 'assyRecords'), where('ownerId', '==', uid))
    );
    existsInCloud = ownedSnap.docs.some((d) => d.id === scopedId);

    const ref = doc(db, 'assyRecords', scopedId);
    if (existsInCloud) {
      await updateDoc(ref, {
        assyNo: fields.assyNo,
        customer: fields.customer,
        params: fields.params,
        assemblyComponents: fields.assemblyComponents,
        partList: fields.partList,
        ppcsList: fields.ppcsList,
        assemblyCotList: fields.assemblyCotList,
        terminalRatios: fields.terminalRatios,
        calculation: fields.calculation,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        ...fields,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return { ...record, id: scopedId };
  } catch (error) {
    handleFirestoreError(
      error,
      existsInCloud ? OperationType.UPDATE : OperationType.CREATE,
      path
    );
  }
}

export async function batchUpdateAssyRecordsInCloud(
  uid: string,
  records: AssyRecord[]
): Promise<void> {
  if (records.length === 0) return;
  const path = 'assyRecords';
  try {
    const ownedSnap = await getDocs(
      query(collection(db, 'assyRecords'), where('ownerId', '==', uid))
    );
    const existingIds = new Set<string>();
    ownedSnap.forEach((d) => existingIds.add(d.id));

    const batch = writeBatch(db);
    records.forEach((rec) => {
      const scopedId = toScopedDocId(uid, rec.id);
      const ref = doc(db, 'assyRecords', scopedId);
      const fields = buildAssyPayloadFields(uid, rec, scopedId);
      if (existingIds.has(scopedId)) {
        batch.update(ref, {
          assyNo: fields.assyNo,
          customer: fields.customer,
          params: fields.params,
          assemblyComponents: fields.assemblyComponents,
          partList: fields.partList,
          ppcsList: fields.ppcsList,
          assemblyCotList: fields.assemblyCotList,
          terminalRatios: fields.terminalRatios,
          calculation: fields.calculation,
          updatedAt: serverTimestamp(),
        });
      } else {
        batch.set(ref, {
          ...fields,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteAssyRecordFromCloud(
  uid: string,
  recordId: string
): Promise<void> {
  const scopedId = toScopedDocId(uid, recordId);
  const path = `assyRecords/${scopedId}`;
  try {
    await deleteDoc(doc(db, 'assyRecords', scopedId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeRefreshHistory(
  uid: string,
  onData: (entries: RefreshHistoryEntry[]) => void,
  onError: (err: Error) => void
) {
  const path = 'refreshHistory';
  const q = query(collection(db, 'refreshHistory'), where('ownerId', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const entries: RefreshHistoryEntry[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: String(d.id || docSnap.id),
          refreshedAt: tsToIso(d.refreshedAt),
          responsibleName: String(d.responsibleName || ''),
          totalSelectedCount: Number(d.totalSelectedCount) || 0,
          affectedAssyCount: Number(d.affectedAssyCount) || 0,
          unaffectedAssyCount: Number(d.unaffectedAssyCount) || 0,
          affectedDiffs: Array.isArray(d.affectedDiffs) ? d.affectedDiffs : [],
        };
      });
      entries.sort((a, b) => b.refreshedAt.localeCompare(a.refreshedAt));
      onData(entries);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (e) {
        onError(e as Error);
      }
    }
  );
}

export async function createRefreshHistoryInCloud(
  uid: string,
  entry: RefreshHistoryEntry
): Promise<RefreshHistoryEntry> {
  const scopedId = toScopedDocId(uid, entry.id);
  const path = `refreshHistory/${scopedId}`;
  try {
    await setDoc(doc(db, 'refreshHistory', scopedId), {
      id: scopedId,
      ownerId: uid,
      refreshedAt: serverTimestamp(),
      responsibleName: (entry.responsibleName || 'PIC').slice(0, 120),
      totalSelectedCount: Math.max(0, Math.min(1000, entry.totalSelectedCount)),
      affectedAssyCount: Math.max(0, Math.min(1000, entry.affectedAssyCount)),
      unaffectedAssyCount: Math.max(0, Math.min(1000, entry.unaffectedAssyCount)),
      affectedDiffs: cleanForFirestore(entry.affectedDiffs.slice(0, 500)),
      createdAt: serverTimestamp(),
    });
    return { ...entry, id: scopedId };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteRefreshHistoryFromCloud(
  uid: string,
  historyId: string
): Promise<void> {
  const scopedId = toScopedDocId(uid, historyId);
  const path = `refreshHistory/${scopedId}`;
  try {
    await deleteDoc(doc(db, 'refreshHistory', scopedId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function clearRefreshHistoryInCloud(
  uid: string,
  historyIds: string[]
): Promise<void> {
  if (historyIds.length === 0) return;
  const path = 'refreshHistory';
  try {
    const batch = writeBatch(db);
    historyIds.forEach((id) => {
      const scopedId = toScopedDocId(uid, id);
      batch.delete(doc(db, 'refreshHistory', scopedId));
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function replaceAllAssyRecordsInCloud(
  uid: string,
  existingIds: string[],
  newRecords: AssyRecord[]
): Promise<AssyRecord[]> {
  const path = 'assyRecords';
  try {
    const existingSnap = await getDocs(
      query(collection(db, 'assyRecords'), where('ownerId', '==', uid))
    );
    const cloudExistingSet = new Set<string>();
    existingSnap.forEach((d) => cloudExistingSet.add(d.id));

    const batch = writeBatch(db);
    const newScopedIds = new Set<string>();
    const resultRecords: AssyRecord[] = [];

    newRecords.forEach((rec) => {
      const scopedId = toScopedDocId(uid, rec.id);
      newScopedIds.add(scopedId);
      const fields = buildAssyPayloadFields(uid, rec, scopedId);
      const ref = doc(db, 'assyRecords', scopedId);
      if (cloudExistingSet.has(scopedId)) {
        batch.update(ref, {
          assyNo: fields.assyNo,
          customer: fields.customer,
          params: fields.params,
          assemblyComponents: fields.assemblyComponents,
          partList: fields.partList,
          ppcsList: fields.ppcsList,
          assemblyCotList: fields.assemblyCotList,
          terminalRatios: fields.terminalRatios,
          calculation: fields.calculation,
          updatedAt: serverTimestamp(),
        });
      } else {
        batch.set(ref, {
          ...fields,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      resultRecords.push({ ...rec, id: scopedId });
    });

    const idsToCheckDelete = new Set<string>([
      ...existingIds.map((eid) => toScopedDocId(uid, eid)),
      ...Array.from(cloudExistingSet),
    ]);
    idsToCheckDelete.forEach((scopedId) => {
      if (!newScopedIds.has(scopedId) && cloudExistingSet.has(scopedId)) {
        batch.delete(doc(db, 'assyRecords', scopedId));
      }
    });

    await batch.commit();
    return resultRecords;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
