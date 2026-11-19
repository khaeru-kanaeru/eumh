import { DEFAULT_PROCESS_DISCS } from '../data/defaultProcessDiscs';
import {
  DEFAULT_AUTO_CUT_LIST,
  DEFAULT_FEEDER_LIST,
  DEFAULT_STD_DATABASE,
  SAMPLE_KHR_PAYLOAD,
} from '../data/defaultStdDb';
import { calculateUmh } from '../engine/umhCalculator';
import {
  AssyInputPayload,
  AssyRecord,
  AutoCutItem,
  FeederItem,
  RefreshHistoryEntry,
  StdDatabase,
} from '../types/umh';

const KEY_RECORDS = 'wh_assy_db_bento_v2';
const KEY_STD_DB = 'wh_std_config_bento_v2';
const KEY_AUTOCUT = 'wh_acl_list_v2';
const KEY_FEEDER = 'wh_fl_list_v2';
const KEY_PENDING_SYNC = 'wh_pending_master_sync_v2';
const KEY_REFRESH_HISTORY = 'wh_umh_refresh_history_v2';
const KEY_LAST_PIC = 'wh_umh_last_pic_v2';

export function loadPendingMasterSync(): boolean {
  try {
    return localStorage.getItem(KEY_PENDING_SYNC) === '1';
  } catch {
    return false;
  }
}

export function savePendingMasterSync(pending: boolean): void {
  try {
    if (pending) {
      localStorage.setItem(KEY_PENDING_SYNC, '1');
    } else {
      localStorage.removeItem(KEY_PENDING_SYNC);
    }
  } catch {
    // ignore storage errors
  }
}

export function loadRefreshHistory(): RefreshHistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY_REFRESH_HISTORY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RefreshHistoryEntry[];
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // ignore parse failure
  }
  return [];
}

export function saveRefreshHistory(entries: RefreshHistoryEntry[]): void {
  try {
    localStorage.setItem(KEY_REFRESH_HISTORY, JSON.stringify(entries));
  } catch {
    // ignore storage errors
  }
}

export function loadLastPicName(): string {
  try {
    return localStorage.getItem(KEY_LAST_PIC) ?? '';
  } catch {
    return '';
  }
}

export function saveLastPicName(name: string): void {
  try {
    localStorage.setItem(KEY_LAST_PIC, name);
  } catch {
    // ignore storage errors
  }
}

export function loadStdDatabase(): StdDatabase {
  try {
    const raw = localStorage.getItem(KEY_STD_DB);
    if (!raw) {
      return {
        ...structuredClone(DEFAULT_STD_DATABASE),
        processDiscs: structuredClone(DEFAULT_PROCESS_DISCS),
      };
    }
    const saved = JSON.parse(raw) as StdDatabase;
    if (saved && Array.isArray(saved.params)) {
      if (!saved.acMatrix) saved.acMatrix = structuredClone(DEFAULT_STD_DATABASE.acMatrix);
      if (!saved.saMatrix) saved.saMatrix = structuredClone(DEFAULT_STD_DATABASE.saMatrix);
      if (!saved.mcMatrix) saved.mcMatrix = structuredClone(DEFAULT_STD_DATABASE.mcMatrix);
      DEFAULT_STD_DATABASE.params.forEach((dp) => {
        if (!saved.params.find((sp) => sp.id === dp.id)) {
          saved.params.push(structuredClone(dp));
        }
      });
      if (!Array.isArray(saved.processDiscs) || saved.processDiscs.length === 0) {
        saved.processDiscs = structuredClone(DEFAULT_PROCESS_DISCS);
      } else {
        DEFAULT_PROCESS_DISCS.forEach((dd) => {
          if (!saved.processDiscs!.find((sd) => sd.processId === dd.processId)) {
            saved.processDiscs!.push(structuredClone(dd));
          }
        });
        saved.processDiscs.sort((a, b) => a.processId - b.processId);
      }
      return saved;
    }
  } catch {
    // ignore parse failure and return default
  }
  return {
    ...structuredClone(DEFAULT_STD_DATABASE),
    processDiscs: structuredClone(DEFAULT_PROCESS_DISCS),
  };
}

export function saveStdDatabase(db: StdDatabase): void {
  localStorage.setItem(KEY_STD_DB, JSON.stringify(db));
}

export function resetStdDatabase(): StdDatabase {
  const fresh: StdDatabase = {
    ...structuredClone(DEFAULT_STD_DATABASE),
    processDiscs: structuredClone(DEFAULT_PROCESS_DISCS),
  };
  saveStdDatabase(fresh);
  return fresh;
}

export function loadAutoCutList(): AutoCutItem[] {
  try {
    const raw = localStorage.getItem(KEY_AUTOCUT);
    if (!raw) return structuredClone(DEFAULT_AUTO_CUT_LIST);
    const parsed = JSON.parse(raw) as AutoCutItem[];
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // fallback
  }
  return structuredClone(DEFAULT_AUTO_CUT_LIST);
}

export function saveAutoCutList(list: AutoCutItem[]): void {
  localStorage.setItem(KEY_AUTOCUT, JSON.stringify(list));
}

export function loadFeederList(): FeederItem[] {
  try {
    const raw = localStorage.getItem(KEY_FEEDER);
    if (!raw) return structuredClone(DEFAULT_FEEDER_LIST);
    const parsed = JSON.parse(raw) as FeederItem[];
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // fallback
  }
  return structuredClone(DEFAULT_FEEDER_LIST);
}

export function saveFeederList(list: FeederItem[]): void {
  localStorage.setItem(KEY_FEEDER, JSON.stringify(list));
}

export function loadAssyRecords(
  stdDb: StdDatabase,
  autoCutList: AutoCutItem[],
  feederList: FeederItem[]
): AssyRecord[] {
  try {
    const raw = localStorage.getItem(KEY_RECORDS);
    if (raw) {
      const parsed = JSON.parse(raw) as (AssyInputPayload & { calculation?: AssyRecord['calculation'] })[];
      if (Array.isArray(parsed)) {
        return parsed.map((p) => {
          if (p.calculation && Array.isArray(p.calculation.processes) && p.calculation.smv) {
            return p as AssyRecord;
          }
          return {
            ...p,
            calculation: calculateUmh(p, stdDb, autoCutList, feederList),
          };
        });
      }
    }
  } catch {
    // fallback to initial sample
  }

  const initialPayloads = [SAMPLE_KHR_PAYLOAD];
  const initialRecords: AssyRecord[] = initialPayloads.map((p) => ({
    ...p,
    calculation: calculateUmh(p, stdDb, autoCutList, feederList),
  }));
  saveAssyPayloads(initialRecords);
  return initialRecords;
}

export function saveAssyPayloads(
  payloads: (AssyInputPayload | AssyRecord)[]
): void {
  const clean = payloads.map((p) => ({
    id: p.id,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    params: p.params,
    assemblyComponents: p.assemblyComponents,
    partList: p.partList,
    ppcsList: p.ppcsList,
    assemblyCotList: p.assemblyCotList,
    terminalRatios: p.terminalRatios,
    ...('calculation' in p && p.calculation ? { calculation: p.calculation } : {}),
  }));
  localStorage.setItem(KEY_RECORDS, JSON.stringify(clean));
}
