import {
  DEFAULT_PROCESS_DISCS,
  createEmptyDiscTemplateCode,
} from '../data/defaultProcessDiscs';
import { SAMPLE_KHR_PAYLOAD } from '../data/defaultStdDb';
import {
  AssyInputPayload,
  AutoCutItem,
  DiscSubStepOutput,
  DiscValidationCheck,
  DiscValidationResult,
  FeederItem,
  LotMetrics,
  PpcsWireItem,
  ProcessLogicDisc,
  StdDatabase,
  SubStepResult,
} from '../types/umh';

export const DISC_FORMAT_VERSION = 'UMH_PROCESS_DISC_V1' as const;
export const DISC_BUNDLE_FORMAT_VERSION = 'UMH_PROCESS_DISC_BUNDLE_V1' as const;

export const JOINT_CODES_LIST = [
  '553800', '565200', 'B-1.25', 'B-2', 'B-5.5', 'B-8', 'B-14', 'B-22', 'B-38', 'B-60',
  'P-1.25', 'P-2', 'P-5.5', 'P-8', 'P-14', 'P-22', 'P-38', 'P-60',
];

const FORBIDDEN_PATTERNS: { regex: RegExp; label: string }[] = [
  { regex: /\bwindow\b/, label: 'window' },
  { regex: /\bdocument\b/, label: 'document' },
  { regex: /\blocalStorage\b/, label: 'localStorage' },
  { regex: /\bsessionStorage\b/, label: 'sessionStorage' },
  { regex: /\bfetch\s*\(/, label: 'fetch()' },
  { regex: /\bXMLHttpRequest\b/, label: 'XMLHttpRequest' },
  { regex: /\beval\s*\(/, label: 'eval()' },
  { regex: /\bnew\s+Function\b/, label: 'new Function' },
  { regex: /\brequire\s*\(/, label: 'require()' },
];

export interface ProcessDiscContext {
  lot: number;
  lotMetrics: LotMetrics;
  cctMaster: number;
  ppcsCount: number;
  params: AssyInputPayload['params'];
  assemblyComponents: AssyInputPayload['assemblyComponents'];
  partList: AssyInputPayload['partList'];
  ppcsList: AssyInputPayload['ppcsList'];
  assemblyCotList: AssyInputPayload['assemblyCotList'];
  terminalRatios: AssyInputPayload['terminalRatios'];
  autoCutList: AutoCutItem[];
  feederList: FeederItem[];
  stdDb: {
    params: StdDatabase['params'];
    acMatrix: number[][];
    saMatrix: number[][];
    mcMatrix: number[][];
  };
  helpers: {
    getP: (id: string) => number;
    mkSub: (
      stage: string,
      name: string,
      basis: string,
      qty: number,
      rate: number,
      secPerUnit: number
    ) => DiscSubStepOutput;
    parseWireSize: (sz: string) => number;
    buildCircuitAllocs: () => {
      row: PpcsWireItem;
      sz: number;
      eligibleR: boolean;
      eligibleF: boolean;
      acShare: number;
      remShare: number;
    }[];
    isNonCrimpTerm: (t: string) => boolean;
    JOINT_CODES: string[];
    groupTwistBundles: () => { bundles: number; ccts: number; totalLenM: number };
  };
}

export function computeLotMetricsBasic(_yearQty?: number, excludeAutoCut = false): LotMetrics {
  return {
    monthlyQty: 0,
    dailyQty: 0,
    rawLot: 1,
    effectiveLot: 1,
    isAutoCutActive: !excludeAutoCut,
  };
}

export function parseWireSizeHelper(sz: string): number {
  if (!sz) return 0;
  const cleaned = String(sz).toLowerCase().replace(/f/g, '').trim();
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? 0 : n;
}

export function buildProcessDiscContext(
  payload: AssyInputPayload,
  stdDb: StdDatabase,
  autoCutList: AutoCutItem[],
  feederList: FeederItem[],
  options?: { excludeAutoCut?: boolean }
): ProcessDiscContext {
  const {
    params,
    assemblyComponents,
    partList: pl,
    ppcsList: ppcs,
    assemblyCotList: dwg,
    terminalRatios: ratios = {},
  } = payload;
  const excludeAutoCut = Boolean(options?.excludeAutoCut);
  const lotMetrics = computeLotMetricsBasic(params.yearQty, excludeAutoCut);
  const lot = lotMetrics.effectiveLot; // Uniform standard basis (= 1)
  const isAcLotActive = !excludeAutoCut;
  const cctMaster = params.masterCct || 0;
  const ppcsCount = ppcs.filter((r) => r.assyNo !== '').length;

  const paramMap = new Map<string, number>();
  stdDb.params.forEach((p) => paramMap.set(p.id, Number(p.val)));

  const getP = (id: string): number => paramMap.get(id) ?? 0;

  const mkSub = (
    stage: string,
    name: string,
    basis: string,
    qty: number,
    rate: number,
    secPerUnit: number
  ): DiscSubStepOutput => ({
    stage,
    name,
    basis,
    qty,
    rate,
    baseSec: secPerUnit,
  });

  const getTermRatio = (term: string): number => {
    const k = String(term || '').trim().toUpperCase();
    return k in ratios ? ratios[k] / 100 : 1.0;
  };

  let cachedAllocs:
    | {
        row: PpcsWireItem;
        sz: number;
        eligibleR: boolean;
        eligibleF: boolean;
        acShare: number;
        remShare: number;
      }[]
    | null = null;

  const buildCircuitAllocs = () => {
    if (cachedAllocs) return cachedAllocs;
    cachedAllocs = ppcs.map((r) => {
      const sz = parseWireSizeHelper(r.sizeRaw);
      const eligibleR = isAcLotActive && r.rAc && sz < 3;
      const eligibleF = isAcLotActive && r.fAc && sz < 3;
      let acShare = 0;
      if (eligibleR && eligibleF) {
        acShare = (getTermRatio(r.termR) + getTermRatio(r.termF)) / 2;
      } else if (eligibleR) {
        acShare = getTermRatio(r.termR);
      } else if (eligibleF) {
        acShare = getTermRatio(r.termF);
      }
      const remShare = 1 - acShare;
      return { row: r, sz, eligibleR, eligibleF, acShare, remShare };
    });
    return cachedAllocs;
  };

  const jointCodeSet = new Set(JOINT_CODES_LIST);
  const isNonCrimpTerm = (t: string): boolean => {
    const tu = String(t || '').trim().toUpperCase();
    if (!tu) return true;
    if (jointCodeSet.has(tu)) return true;
    if (tu.startsWith('B-') || tu.startsWith('P-')) return true;
    if (tu.includes('SOLDER')) return true;
    return false;
  };

  const groupTwistBundles = () => {
    const twRows = ppcs.filter((r) => r.twist !== '');
    const parent: Record<string, string> = {};
    const find = (x: string): string => {
      if (!(x in parent)) parent[x] = x;
      if (parent[x] !== x) parent[x] = find(parent[x]);
      return parent[x];
    };
    const union = (a: string, b: string) => {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent[rb] = ra;
    };
    twRows.forEach((r) => {
      find(r.cctNo);
      r.twist.split(',').forEach((p) => {
        const pt = p.trim();
        if (pt) union(r.cctNo, pt);
      });
    });
    const groups: Record<string, number[]> = {};
    twRows.forEach((r) => {
      const root = find(r.cctNo);
      if (!groups[root]) groups[root] = [];
      groups[root].push(r.cl);
    });
    const bundles = Object.keys(groups).length;
    const ccts = twRows.length;
    const totalLenM =
      Object.values(groups).reduce(
        (sum, arr) => sum + arr.reduce((a, b) => a + b, 0) / arr.length,
        0
      ) / 1000;
    return { bundles, ccts, totalLenM };
  };

  return {
    lot,
    lotMetrics,
    cctMaster,
    ppcsCount,
    params,
    assemblyComponents,
    partList: pl,
    ppcsList: ppcs,
    assemblyCotList: dwg,
    terminalRatios: ratios,
    autoCutList,
    feederList,
    stdDb: {
      params: stdDb.params,
      acMatrix: stdDb.acMatrix,
      saMatrix: stdDb.saMatrix,
      mcMatrix: stdDb.mcMatrix,
    },
    helpers: {
      getP,
      mkSub,
      parseWireSize: parseWireSizeHelper,
      buildCircuitAllocs,
      isNonCrimpTerm,
      JOINT_CODES: [...JOINT_CODES_LIST],
      groupTwistBundles,
    },
  };
}

type CompiledCalcFn = (ctx: ProcessDiscContext) => unknown;
const COMPILED_CACHE = new Map<string, CompiledCalcFn>();

export function normalizeCalculateCode(rawCode: string): string {
  const trimmed = rawCode.trim();
  if (!trimmed) {
    throw new Error('Kode fungsi calculate(ctx) kosong.');
  }
  // If shorthand method syntax from object literal: calculate(ctx) { ... }
  if (/^calculate\s*\([^)]*\)\s*\{/.test(trimmed)) {
    return `function ${trimmed}`;
  }
  // If anonymous function: function(ctx) { ... }
  if (/^function\s*\(/.test(trimmed)) {
    return trimmed.replace(/^function\s*\(/, 'function calculate(');
  }
  return trimmed;
}

export function compileDiscCode(rawCode: string): CompiledCalcFn {
  const normalized = normalizeCalculateCode(rawCode);
  const cached = COMPILED_CACHE.get(normalized);
  if (cached) return cached;

  // Support either `function calculate(ctx) { ... }`, arrow `(ctx) => { ... }`, or body statements
  let compiled: CompiledCalcFn;
  if (/^function\s+calculate\s*\(/.test(normalized)) {
    const factory = new Function(`"use strict";\n${normalized}\nreturn calculate;`);
    compiled = factory() as CompiledCalcFn;
  } else if (/^(\([^)]*\)|[a-zA-Z_$][\w$]*)\s*=>/.test(normalized)) {
    const factory = new Function(`"use strict";\nreturn (${normalized});`);
    compiled = factory() as CompiledCalcFn;
  } else {
    // Raw body statements expecting `ctx`
    compiled = new Function('ctx', `"use strict";\n${normalized}`) as CompiledCalcFn;
  }

  if (typeof compiled !== 'function') {
    throw new Error('Kode tidak menghasilkan fungsi calculate(ctx) yang valid.');
  }

  COMPILED_CACHE.set(normalized, compiled);
  return compiled;
}

export function executeProcessDisc(
  disc: ProcessLogicDisc,
  ctx: ProcessDiscContext,
  startSubIdx = 0
): {
  active: boolean;
  summaryNote: string;
  baseSec: number;
  subSteps: SubStepResult[];
  nextSubIdx: number;
  error?: string;
} {
  try {
    const fn = compileDiscCode(disc.code);
    const out = fn(ctx) as {
      active?: boolean;
      summaryNote?: string;
      subSteps?: DiscSubStepOutput[];
      baseSec?: number;
    } | null;

    if (!out || typeof out !== 'object' || !Array.isArray(out.subSteps)) {
      throw new Error('Output calculate(ctx) harus berupa object dengan properti array subSteps.');
    }

    let idx = startSubIdx;
    const subSteps: SubStepResult[] = out.subSteps.map((st) => {
      const base = Number(st.baseSec);
      const qty = Number(st.qty);
      const rate = Number(st.rate);
      const safeBase = Number.isFinite(base) ? base : 0;
      return {
        id: `sub_${++idx}`,
        stage: String(st.stage ?? ''),
        name: String(st.name ?? ''),
        basis: String(st.basis ?? ''),
        qty: Number.isFinite(qty) ? qty : 0,
        rate: Number.isFinite(rate) ? rate : 0,
        baseSec: safeBase,
        allowByProcessSec: safeBase,
        allowByFinalSec: safeBase,
      };
    });

    const computedSum = subSteps.reduce((s, x) => s + x.baseSec, 0);
    const baseSec =
      typeof out.baseSec === 'number' && Number.isFinite(out.baseSec)
        ? out.baseSec
        : computedSum;
    const active = typeof out.active === 'boolean' ? out.active : baseSec > 0;
    const summaryNote =
      typeof out.summaryNote === 'string' && out.summaryNote.trim() !== ''
        ? out.summaryNote
        : active
        ? `Base: ${baseSec.toFixed(2)}s`
        : 'Tidak digunakan (0)';

    return {
      active,
      summaryNote,
      baseSec,
      subSteps,
      nextSubIdx: idx,
    };
  } catch (err) {
    return {
      active: false,
      summaryNote: `Error Logic Disc: ${err instanceof Error ? err.message : String(err)}`,
      baseSec: 0,
      subSteps: [],
      nextSubIdx: startSubIdx,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function serializeDiscToJsFile(disc: ProcessLogicDisc): string {
  const safeCode = normalizeCalculateCode(disc.code);
  const indentedMethod = safeCode
    .replace(/^function\s+calculate\s*\(/, 'calculate(')
    .split('\n')
    .map((line, idx) => (idx === 0 ? `  ${line}` : `  ${line}`))
    .join('\n');

  return `/**
 * ============================================================================
 * STD / UMH Wire Harness Studio — Sub-Process Logic Disc
 * ============================================================================
 * Format       : ${DISC_FORMAT_VERSION}
 * Process ID   : ${disc.processId}
 * Process Name : ${disc.processName} (${disc.jpName})
 * Weight       : ${disc.weight}
 * Version      : ${disc.version}
 *
 * PANDUAN REPLIKA / EDIT MANUAL:
 * Anda dapat mengedit file .disc.js ini dengan editor atau tools apapun
 * selama mempertahankan struktur "module.exports = { ... }" dan fungsi
 * "calculate(ctx)" dengan kontrak input/output berikut:
 *
 * INPUT ctx:
 *   ctx.lot                -> number (Effective LOT)
 *   ctx.lotMetrics         -> { monthlyQty, dailyQty, rawLot, effectiveLot, isAutoCutActive }
 *   ctx.cctMaster          -> number (Master CCT)
 *   ctx.ppcsCount          -> number (Jumlah baris sirkuit PPCS valid)
 *   ctx.params             -> { assyNo, customer, yearQty, masterCct, pfdAllowancePct, allowanceMode }
 *   ctx.assemblyComponents -> { markerQty, spotTapeQty, namePlateQty, clipQty, clampQty }
 *   ctx.partList           -> Array<{ customer, assyNo, partNumber, partName, qty, routingId, desc }>
 *   ctx.ppcsList           -> Array<PpcsWireItem>
 *   ctx.assemblyCotList    -> Array<{ type: 'C'|'T'|'B', tl: number }>
 *   ctx.terminalRatios     -> Record<string, number>
 *   ctx.autoCutList        -> Array<AutoCutItem>
 *   ctx.feederList         -> Array<FeederItem>
 *   ctx.stdDb              -> { params, acMatrix, saMatrix, mcMatrix }
 *   ctx.helpers            -> {
 *     getP(paramId): number,
 *     mkSub(stage, name, basis, qty, rate, secPerUnit): SubStep,
 *     parseWireSize(sizeRaw): number,
 *     buildCircuitAllocs(): CircuitAlloc[],
 *     isNonCrimpTerm(term): boolean,
 *     JOINT_CODES: string[],
 *     groupTwistBundles(): { bundles, ccts, totalLenM }
 *   }
 *
 * OUTPUT calculate(ctx):
 *   {
 *     active: boolean,
 *     summaryNote: string,
 *     subSteps: Array<{ stage, name, basis, qty, rate, baseSec }>,
 *     baseSec?: number // opsional (default: total subSteps[].baseSec)
 *   }
 * ============================================================================
 */

module.exports = {
  format: ${JSON.stringify(DISC_FORMAT_VERSION)},
  processId: ${disc.processId},
  processName: ${JSON.stringify(disc.processName)},
  jpName: ${JSON.stringify(disc.jpName)},
  weight: ${disc.weight},
  version: ${JSON.stringify(disc.version)},
  description: ${JSON.stringify(disc.description)},
${indentedMethod}
};
`;
}

export function serializeDiscToJsonFile(disc: ProcessLogicDisc): string {
  return JSON.stringify(
    {
      ...disc,
      code: normalizeCalculateCode(disc.code),
    },
    null,
    2
  );
}

export function serializeAllDiscsBundle(discs: ProcessLogicDisc[]): string {
  return JSON.stringify(
    {
      format: DISC_BUNDLE_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      totalDiscs: discs.length,
      discs: discs.map((d) => ({
        ...d,
        code: normalizeCalculateCode(d.code),
      })),
    },
    null,
    2
  );
}

export function parseUploadedDiscText(
  rawText: string,
  fileName = ''
):
  | { kind: 'single'; disc: Partial<ProcessLogicDisc> }
  | { kind: 'bundle'; discs: Partial<ProcessLogicDisc>[] }
  | { kind: 'error'; error: string } {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return { kind: 'error', error: 'File kosong.' };
  }

  // Try JSON first
  if (trimmed.startsWith('{') || fileName.toLowerCase().endsWith('.json')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && parsed.format === DISC_BUNDLE_FORMAT_VERSION && Array.isArray(parsed.discs)) {
        return { kind: 'bundle', discs: parsed.discs };
      }
      if (parsed && typeof parsed === 'object') {
        return { kind: 'single', disc: parsed };
      }
    } catch {
      if (fileName.toLowerCase().endsWith('.json')) {
        return { kind: 'error', error: 'Format JSON tidak valid (gagal JSON.parse).' };
      }
    }
  }

  // Static safety check before executing module script
  for (const rule of FORBIDDEN_PATTERNS) {
    if (rule.regex.test(trimmed)) {
      return {
        kind: 'error',
        error: `Kode disc ditolak karena menggunakan API terlarang (${rule.label}). Logic disc harus murni perhitungan.`,
      };
    }
  }

  // Evaluate JS module format (`module.exports = { ... }`, `export default { ... }`, or object literal)
  try {
    let transformed = trimmed
      .replace(/^\s*export\s+default\s+/m, 'module.exports = ')
      .replace(/^\s*export\s+const\s+\w+\s*=\s*/m, 'module.exports = ');

    if (!/module\.exports\s*=/.test(transformed) && !/exports\./.test(transformed)) {
      if (transformed.startsWith('{')) {
        transformed = `module.exports = (${transformed});`;
      } else if (/^function\s+calculate\b/.test(transformed)) {
        return {
          kind: 'single',
          disc: {
            format: DISC_FORMAT_VERSION,
            code: transformed,
          },
        };
      }
    }

    const moduleObj: { exports: unknown } = { exports: {} };
    const runner = new Function('module', 'exports', `"use strict";\n${transformed}`);
    runner(moduleObj, moduleObj.exports);

    const exported = moduleObj.exports as Record<string, unknown> | null;
    if (!exported || typeof exported !== 'object') {
      return {
        kind: 'error',
        error: 'File JS tidak mengekspor object Logic Disc (module.exports = { ... }).',
      };
    }

    let codeStr = '';
    if (typeof exported.calculate === 'function') {
      codeStr = normalizeCalculateCode(exported.calculate.toString());
    } else if (typeof exported.code === 'string') {
      codeStr = normalizeCalculateCode(exported.code);
    } else {
      return {
        kind: 'error',
        error: 'Object Logic Disc wajib memiliki fungsi calculate(ctx) atau properti code.',
      };
    }

    return {
      kind: 'single',
      disc: {
        format: exported.format as ProcessLogicDisc['format'],
        processId: Number(exported.processId),
        processName: String(exported.processName ?? ''),
        jpName: String(exported.jpName ?? ''),
        weight: Number(exported.weight ?? 1.0),
        version: String(exported.version ?? '1.0.0'),
        description: String(exported.description ?? ''),
        isEmptyTemplate: Boolean(exported.isEmptyTemplate),
        isCustomProcess: Boolean(exported.isCustomProcess),
        code: codeStr,
      },
    };
  } catch (err) {
    return {
      kind: 'error',
      error: `Gagal mem-parsing file JS: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

function buildDryRunPayloads(): {
  samplePayload: AssyInputPayload;
  emptyPayload: AssyInputPayload;
} {
  const sampleWire: PpcsWireItem = {
    assyNo: SAMPLE_KHR_PAYLOAD.params.assyNo,
    cctNo: '1',
    kind: 'AVSS',
    sizeRaw: '0.5',
    colour: 'B',
    isShield: false,
    cl: 1200,
    from: 'C1',
    to: 'C2',
    jointNo: '',
    twist: '',
    tubeR: '',
    tubeF: '',
    hd: '',
    sd: '',
    termR: '7114-1301',
    markerR: '',
    dcR: '',
    accR1: '',
    accR2: '',
    termF: '7116-1301',
    markerF: '',
    accF1: '',
    accF2: '',
    dcF: '',
    rAf: false,
    fAf: false,
    rAc: true,
    fAc: true,
    af: '',
    ag: '',
  };

  const shieldWire: PpcsWireItem = {
    ...sampleWire,
    cctNo: '2',
    colour: '2C',
    isShield: true,
    cl: 2400,
    termR: 'R-101',
    termF: 'SOLDER',
    rAc: false,
    fAc: false,
  };

  const samplePayload: AssyInputPayload = {
    ...SAMPLE_KHR_PAYLOAD,
    partList: [
      {
        customer: 'SUMITOMO',
        assyNo: SAMPLE_KHR_PAYLOAD.params.assyNo,
        partNumber: '7114-1301',
        partName: 'Terminal',
        qty: 2,
        routingId: 20,
        desc: 'auto cut',
      },
      {
        customer: 'SUMITOMO',
        assyNo: SAMPLE_KHR_PAYLOAD.params.assyNo,
        partNumber: 'CONN-01',
        partName: 'Connector',
        qty: 2,
        routingId: 20,
        desc: '',
      },
    ],
    ppcsList: [sampleWire, shieldWire],
  };

  const emptyPayload: AssyInputPayload = {
    id: 'empty_test',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    params: {
      assyNo: 'TEST-EMPTY',
      customer: 'TEST',
      yearQty: 1000,
      masterCct: 0,
      pfdAllowancePct: 15,
      allowanceMode: 'by_process',
    },
    assemblyComponents: {
      markerQty: 0,
      spotTapeQty: 0,
      namePlateQty: 0,
      clipQty: 0,
      clampQty: 0,
    },
    partList: [],
    ppcsList: [],
    assemblyCotList: [],
    terminalRatios: {},
  };

  return { samplePayload, emptyPayload };
}

export function validateProcessDisc(
  candidate: Partial<ProcessLogicDisc>,
  stdDb: StdDatabase,
  autoCutList: AutoCutItem[],
  feederList: FeederItem[],
  expectedProcessId?: number
): DiscValidationResult {
  const checks: DiscValidationCheck[] = [];

  // 1. Format & Header Metadata
  const pid = Number(candidate.processId);
  const pName = String(candidate.processName ?? '').trim();
  const weight = Number(candidate.weight);
  const version = String(candidate.version ?? '').trim();

  let formatOk = true;
  let formatMsg = `Format ${DISC_FORMAT_VERSION}, Process #${pid} (${pName}), Bobot ${weight}`;

  if (candidate.format !== DISC_FORMAT_VERSION) {
    formatOk = false;
    formatMsg = `Format harus "${DISC_FORMAT_VERSION}" (ditemukan: "${String(
      candidate.format ?? 'kosong'
    )}").`;
  } else if (!Number.isInteger(pid) || pid < 1) {
    formatOk = false;
    formatMsg = 'processId harus berupa bilangan bulat positif (>= 1).';
  } else if (expectedProcessId !== undefined && pid !== expectedProcessId) {
    formatOk = false;
    formatMsg = `Process ID pada disc (#${pid}) tidak cocok dengan slot proses tujuan (#${expectedProcessId}).`;
  } else if (!pName) {
    formatOk = false;
    formatMsg = 'processName wajib diisi.';
  } else if (!Number.isFinite(weight) || weight <= 0) {
    formatOk = false;
    formatMsg = 'weight (bobot) harus berupa angka lebih dari 0.';
  } else if (!version) {
    formatOk = false;
    formatMsg = 'version wajib diisi (misal: 1.0.0).';
  }

  checks.push({
    id: 'format_meta',
    label: '1. Format & Metadata Disc',
    passed: formatOk,
    detail: formatMsg,
  });

  // 2. Syntax & Security
  const rawCode = String(candidate.code ?? '');
  let compiledFn: CompiledCalcFn | null = null;
  let syntaxOk = true;
  let syntaxMsg = 'Sintaks JS valid dan aman (pure calculation).';

  const forbiddenHit = FORBIDDEN_PATTERNS.find((r) => r.regex.test(rawCode));
  if (forbiddenHit) {
    syntaxOk = false;
    syntaxMsg = `Ditemukan API terlarang (${forbiddenHit.label}). Logic disc hanya boleh berisi kalkulasi.`;
  } else {
    try {
      compiledFn = compileDiscCode(rawCode);
    } catch (err) {
      syntaxOk = false;
      syntaxMsg = err instanceof Error ? err.message : String(err);
    }
  }

  checks.push({
    id: 'syntax_security',
    label: '2. Sintaks & Keamanan Kode',
    passed: syntaxOk,
    detail: syntaxMsg,
  });

  // 3 & 4 & 5. Dry-Run Tests + Output Contract
  const { samplePayload, emptyPayload } = buildDryRunPayloads();
  let sampleOk = false;
  let sampleDetail = 'Dilewati karena sintaks belum valid.';
  let emptyOk = false;
  let emptyDetail = 'Dilewati karena sintaks belum valid.';
  let contractOk = false;
  let contractDetail = 'Dilewati karena dry-run belum dijalankan.';

  let dryRunSample: DiscValidationResult['dryRunSample'] | undefined;

  if (compiledFn) {
    const sampleCtx = buildProcessDiscContext(samplePayload, stdDb, autoCutList, feederList);
    const emptyCtx = buildProcessDiscContext(emptyPayload, stdDb, autoCutList, feederList);

    let sampleOut: any = null;
    try {
      sampleOut = compiledFn(sampleCtx);
      sampleOk = true;
      sampleDetail = 'Eksekusi simulasi pada data sampel berhasil tanpa error.';
    } catch (err) {
      sampleOk = false;
      sampleDetail = `Runtime error pada data sampel: ${
        err instanceof Error ? err.message : String(err)
      }`;
    }

    let emptyOut: any = null;
    try {
      emptyOut = compiledFn(emptyCtx);
      emptyOk = true;
      emptyDetail = 'Eksekusi simulasi pada kondisi data kosong (0 wire) aman tanpa crash.';
    } catch (err) {
      emptyOk = false;
      emptyDetail = `Runtime error pada kondisi kosong: ${
        err instanceof Error ? err.message : String(err)
      }`;
    }

    if (sampleOk && emptyOk) {
      const checkOutputObj = (o: any, label: string): string | null => {
        if (!o || typeof o !== 'object') return `${label}: return harus berupa object.`;
        if (!Array.isArray(o.subSteps)) return `${label}: properti subSteps wajib berupa Array.`;
        for (let i = 0; i < o.subSteps.length; i++) {
          const st = o.subSteps[i];
          if (!st || typeof st !== 'object') {
            return `${label}: subSteps[${i}] bukan object.`;
          }
          if (typeof st.stage !== 'string' || typeof st.name !== 'string') {
            return `${label}: subSteps[${i}].stage dan name wajib string.`;
          }
          if (
            !Number.isFinite(Number(st.qty)) ||
            !Number.isFinite(Number(st.rate)) ||
            !Number.isFinite(Number(st.baseSec))
          ) {
            return `${label}: subSteps[${i}] mengandung nilai NaN / Infinity.`;
          }
          if (Number(st.baseSec) < 0) {
            return `${label}: subSteps[${i}].baseSec bernilai negatif (${st.baseSec}).`;
          }
        }
        if (
          o.baseSec !== undefined &&
          (!Number.isFinite(Number(o.baseSec)) || Number(o.baseSec) < 0)
        ) {
          return `${label}: baseSec tidak valid (${o.baseSec}).`;
        }
        return null;
      };

      const err1 = checkOutputObj(sampleOut, 'Sampel');
      const err2 = checkOutputObj(emptyOut, 'Kosong');
      if (err1 || err2) {
        contractOk = false;
        contractDetail = err1 || err2 || 'Kontrak output tidak sesuai.';
      } else {
        contractOk = true;
        const subSteps: DiscSubStepOutput[] = sampleOut.subSteps.map((st: any) => ({
          stage: String(st.stage),
          name: String(st.name),
          basis: String(st.basis ?? 'sec/unit(pcs)'),
          qty: Number(st.qty),
          rate: Number(st.rate),
          baseSec: Number(st.baseSec),
        }));
        const sumSec = subSteps.reduce((s, x) => s + x.baseSec, 0);
        const finalSec =
          typeof sampleOut.baseSec === 'number' ? Number(sampleOut.baseSec) : sumSec;

        // Compare vs currently installed disc
        const currentDisc = (stdDb.processDiscs ?? DEFAULT_PROCESS_DISCS).find(
          (d) => d.processId === pid
        );
        let deltaVsCurrentSec: number | null = null;
        if (currentDisc) {
          const curRes = executeProcessDisc(currentDisc, sampleCtx);
          if (!curRes.error) {
            deltaVsCurrentSec = finalSec - curRes.baseSec;
          }
        }

        contractDetail = `Valid: ${subSteps.length} sub-step terdeteksi, Base Cycle simulasi = ${finalSec.toFixed(
          3
        )}s.`;
        dryRunSample = {
          baseSec: finalSec,
          summaryNote: String(sampleOut.summaryNote ?? ''),
          subSteps,
          deltaVsCurrentSec,
        };
      }
    }
  }

  checks.push(
    {
      id: 'dryrun_sample',
      label: '3. Uji Simulasi Data Sampel',
      passed: sampleOk,
      detail: sampleDetail,
    },
    {
      id: 'dryrun_empty',
      label: '4. Uji Edge-Case Data Kosong (0 Wire)',
      passed: emptyOk,
      detail: emptyDetail,
    },
    {
      id: 'output_contract',
      label: '5. Kontrak Skema Output (subSteps & Angka)',
      passed: contractOk,
      detail: contractDetail,
    }
  );

  const allValid = checks.every((c) => c.passed);

  let normalizedDisc: ProcessLogicDisc | undefined;
  if (allValid && dryRunSample) {
    const isActuallyEmpty =
      dryRunSample.subSteps.length === 0 &&
      dryRunSample.baseSec === 0 &&
      !rawCode.includes('mkSub(');

    normalizedDisc = {
      format: DISC_FORMAT_VERSION,
      processId: pid,
      processName: pName,
      jpName: String(candidate.jpName ?? '').trim(),
      weight,
      version,
      description: String(candidate.description ?? '').trim(),
      isEmptyTemplate: candidate.isEmptyTemplate ?? isActuallyEmpty,
      isCustomProcess: candidate.isCustomProcess,
      code: normalizeCalculateCode(rawCode),
      updatedAt: new Date().toISOString(),
    };
  }

  return {
    valid: allValid,
    checks,
    normalizedDisc,
    dryRunSample,
  };
}

export function getDefaultTemplateForProcess(
  processId: number,
  processName: string
): string {
  return createEmptyDiscTemplateCode(processId, processName);
}
