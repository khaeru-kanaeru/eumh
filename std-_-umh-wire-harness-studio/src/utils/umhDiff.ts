import {
  AssyRecord,
  AssyRefreshDiff,
  ProcessDiff,
  ProcessResult,
  SubStepDiff,
  SubStepResult,
} from '../types/umh';

const DIFF_EPSILON = 1e-6;

function getSubAllow(sub: SubStepResult, mode: AssyRecord['params']['allowanceMode']): number {
  return mode === 'by_process' ? sub.allowByProcessSec : sub.allowByFinalSec;
}

function getProcAllow(proc: ProcessResult, mode: AssyRecord['params']['allowanceMode']): number {
  return mode === 'by_process' ? proc.allowByProcessSec : proc.allowByFinalSec;
}

function keySubSteps(subSteps: SubStepResult[]): Map<string, SubStepResult> {
  const counts = new Map<string, number>();
  const map = new Map<string, SubStepResult>();
  for (const sub of subSteps) {
    const baseKey = `${sub.stage}::${sub.name}`;
    const idx = counts.get(baseKey) ?? 0;
    counts.set(baseKey, idx + 1);
    map.set(`${baseKey}::${idx}`, sub);
  }
  return map;
}

export function computeAssyRefreshDiff(
  beforeRecord: AssyRecord,
  afterRecord: AssyRecord
): AssyRefreshDiff | null {
  const mode = afterRecord.params.allowanceMode;
  const processDiffs: ProcessDiff[] = [];

  for (const afterProc of afterRecord.calculation.processes) {
    const beforeProc = beforeRecord.calculation.processes.find(
      (p) => p.processId === afterProc.processId
    );

    const beforeSubMap = keySubSteps(beforeProc?.subSteps ?? []);
    const afterSubMap = keySubSteps(afterProc.subSteps);
    const allKeys: string[] = [];

    for (const k of beforeSubMap.keys()) {
      allKeys.push(k);
    }
    for (const k of afterSubMap.keys()) {
      if (!beforeSubMap.has(k)) {
        allKeys.push(k);
      }
    }

    const subStepDiffs: SubStepDiff[] = [];
    for (const key of allKeys) {
      const bSub = beforeSubMap.get(key);
      const aSub = afterSubMap.get(key);

      const beforeBaseSec = bSub?.baseSec ?? 0;
      const afterBaseSec = aSub?.baseSec ?? 0;
      const deltaBaseSec = afterBaseSec - beforeBaseSec;

      const beforeAllowSec = bSub ? getSubAllow(bSub, mode) : 0;
      const afterAllowSec = aSub ? getSubAllow(aSub, mode) : 0;
      const deltaAllowSec = afterAllowSec - beforeAllowSec;

      if (
        Math.abs(deltaBaseSec) > DIFF_EPSILON ||
        Math.abs(deltaAllowSec) > DIFF_EPSILON
      ) {
        subStepDiffs.push({
          key,
          stage: aSub?.stage ?? bSub?.stage ?? '-',
          name: aSub?.name ?? bSub?.name ?? '-',
          basis: aSub?.basis ?? bSub?.basis ?? '-',
          beforeBaseSec,
          afterBaseSec,
          deltaBaseSec,
          beforeAllowSec,
          afterAllowSec,
          deltaAllowSec,
        });
      }
    }

    const beforeProcBase = beforeProc?.baseSec ?? 0;
    const afterProcBase = afterProc.baseSec;
    const deltaProcBase = afterProcBase - beforeProcBase;

    const beforeProcAllow = beforeProc ? getProcAllow(beforeProc, mode) : 0;
    const afterProcAllow = getProcAllow(afterProc, mode);
    const deltaProcAllow = afterProcAllow - beforeProcAllow;

    if (
      subStepDiffs.length > 0 ||
      Math.abs(deltaProcBase) > DIFF_EPSILON ||
      Math.abs(deltaProcAllow) > DIFF_EPSILON
    ) {
      processDiffs.push({
        processId: afterProc.processId,
        processName: afterProc.processName,
        jpName: afterProc.jpName,
        beforeBaseSec: beforeProcBase,
        afterBaseSec: afterProcBase,
        deltaBaseSec: deltaProcBase,
        beforeAllowSec: beforeProcAllow,
        afterAllowSec: afterProcAllow,
        deltaAllowSec: deltaProcAllow,
        subStepDiffs,
      });
    }
  }

  const beforeBaseSec = beforeRecord.calculation.totalBaseSec;
  const afterBaseSec = afterRecord.calculation.totalBaseSec;
  const deltaBaseSec = afterBaseSec - beforeBaseSec;

  const beforeAllowSec =
    mode === 'by_process'
      ? beforeRecord.calculation.totalAllowByProcessSec
      : beforeRecord.calculation.totalAllowByFinalSec;
  const afterAllowSec =
    mode === 'by_process'
      ? afterRecord.calculation.totalAllowByProcessSec
      : afterRecord.calculation.totalAllowByFinalSec;
  const deltaAllowSec = afterAllowSec - beforeAllowSec;

  if (
    processDiffs.length === 0 &&
    Math.abs(deltaBaseSec) <= DIFF_EPSILON &&
    Math.abs(deltaAllowSec) <= DIFF_EPSILON
  ) {
    return null;
  }

  return {
    assyId: afterRecord.id,
    assyNo: afterRecord.params.assyNo,
    customer: afterRecord.params.customer,
    allowanceMode: mode,
    beforeBaseSec,
    afterBaseSec,
    deltaBaseSec,
    beforeAllowSec,
    afterAllowSec,
    deltaAllowSec,
    processDiffs,
  };
}
