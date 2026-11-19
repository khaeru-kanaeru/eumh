import XLSX from 'xlsx-js-style';
import { CONDITIONAL_AC_TERMS } from '../data/defaultStdDb';
import {
  AllowanceMode,
  AssemblyComponents,
  AssemblyCotItem,
  AssyParams,
  AutoCutItem,
  FeederItem,
  PartListItem,
  PpcsWireItem,
  TerminalRatios,
} from '../types/umh';

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function buildAutoCutLookup(aclList: AutoCutItem[]) {
  const allMap = new Map<string, string>();
  const nonCatMap = new Map<string, string>();
  for (const item of aclList) {
    const key = item.terminal.trim().toLowerCase();
    if (!key) continue;
    if (!allMap.has(key)) allMap.set(key, 'auto cut');
    if (item.customer.trim().toUpperCase() !== 'CAT' && !nonCatMap.has(key)) {
      nonCatMap.set(key, 'auto cut');
    }
  }
  return { allMap, nonCatMap };
}

function buildFeederLookup(flList: FeederItem[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const item of flList) {
    const key = item.seal.trim().toLowerCase();
    if (key && !map.has(key)) map.set(key, 'auto feeder');
  }
  return map;
}

function buildSleeveSet(plRows: PartListItem[]): Set<string> {
  const set = new Set<string>();
  for (const r of plRows) {
    if (r.partName.trim().toLowerCase() === 'sleeve' && r.partNumber.trim()) {
      set.add(r.partNumber.trim().toLowerCase());
    }
  }
  return set;
}

function enrichPartListRowFast(
  customer: string,
  assyNo: string,
  partNumber: string,
  partName: string,
  qty: number,
  routingId: number,
  aclLookup: ReturnType<typeof buildAutoCutLookup>,
  flMap: Map<string, string>
): PartListItem {
  let desc = '';
  const pnLower = partName.toLowerCase();
  const partKey = partNumber.trim().toLowerCase();

  if (pnLower === 'terminal') {
    const pool = customer.toUpperCase().startsWith('C')
      ? aclLookup.allMap
      : aclLookup.nonCatMap;
    const proc = pool.get(partKey);
    if (proc) {
      desc = CONDITIONAL_AC_TERMS.has(partNumber.trim().toUpperCase())
        ? 'auto cut (wajib seal feeder)'
        : proc;
    }
  } else if (pnLower === 'seal') {
    const proc = flMap.get(partKey);
    if (proc) desc = proc;
  }

  return { customer, assyNo, partNumber, partName, qty, routingId, desc };
}

/**
 * Safely convert a SheetJS worksheet into a compact 2D array without allocating
 * up to 1,048,576 styled blank rows when a sheet has whole-column formatting.
 */
function sheetToSafeGrid(ws: Record<string, any> | undefined): string[][] {
  if (!ws) return [];
  const rowMap = new Map<number, Map<number, string>>();
  let maxR = -1;
  let maxC = -1;

  const keys = Object.keys(ws);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (key.startsWith('!')) continue;
    const cell = ws[key] as { t?: string; v?: unknown; w?: unknown } | undefined;
    if (!cell || (cell.v === undefined && cell.w === undefined)) continue;
    // Skip Excel formula error cells (#N/A, #REF!, #VALUE!, etc. where SheetJS stores numeric error code e.g. 42 in cell.v)
    if (cell.t === 'e' || cell.t === 'z') continue;

    let pos: { r: number; c: number };
    try {
      pos = XLSX.utils.decode_cell(key);
    } catch {
      continue;
    }
    if (pos.r < 0 || pos.c < 0 || pos.c > 200 || pos.r > 150000) continue;

    // Prefer formatted string if cell is percentage so "15.0%" stays "15.0%" instead of 0.15
    let textVal = '';
    if (typeof cell.w === 'string' && cell.w.includes('%')) {
      textVal = cell.w.trim();
    } else if (cell.v !== undefined && cell.v !== null) {
      textVal = String(cell.v).trim();
    } else if (typeof cell.w === 'string') {
      textVal = cell.w.trim();
    }

    if (textVal === '' || isInvalidCellValue(textVal)) continue;

    if (pos.r > maxR) maxR = pos.r;
    if (pos.c > maxC) maxC = pos.c;

    let colMap = rowMap.get(pos.r);
    if (!colMap) {
      colMap = new Map<number, string>();
      rowMap.set(pos.r, colMap);
    }
    colMap.set(pos.c, textVal);
  }

  if (maxR < 0 || maxC < 0) return [];

  const colsCount = maxC + 1;
  const grid: string[][] = [];
  for (let r = 0; r <= maxR; r++) {
    const colMap = rowMap.get(r);
    if (!colMap) {
      grid.push([]);
      continue;
    }
    const row = new Array<string>(colsCount).fill('');
    colMap.forEach((val, c) => {
      row[c] = val;
    });
    grid.push(row);
  }
  return grid;
}

/**
 * Fast RFC-4180 CSV parser supporting comma or semicolon delimiters, quoted values, and UTF-8 BOM.
 */
function parseCsvTextToGrid(rawText: string): string[][] {
  const cleaned = rawText.replace(/^\uFEFF/, '');
  const lines = cleaned.split(/\r\n|\n|\r/);

  // Detect delimiter from first non-empty line
  let delimiter = ',';
  for (const ln of lines) {
    const t = ln.trim();
    if (!t) continue;
    const commas = (t.match(/,/g) || []).length;
    const semis = (t.match(/;/g) || []).length;
    if (semis > commas) delimiter = ';';
    break;
  }

  const grid: string[][] = [];
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    if (line === '' && li === lines.length - 1) continue;

    const row: string[] = [];
    let cur = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === delimiter && !inQuotes) {
        row.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    row.push(cur.trim());
    grid.push(row);
  }

  // Trim trailing completely empty rows
  while (grid.length > 0 && grid[grid.length - 1].every((c) => c === '')) {
    grid.pop();
  }
  return grid;
}

function parseNumeric(val: unknown): number {
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  const s = String(val ?? '')
    .trim()
    .replace(/%/g, '')
    .replace(/\s+/g, '');
  if (!s) return 0;
  // Support comma decimals like "15,5" when no dot present, or thousand comma like "1,200"
  let normalized = s;
  if (s.includes(',') && !s.includes('.')) {
    const parts = s.split(',');
    normalized = parts.length === 2 && parts[1].length <= 2 ? `${parts[0]}.${parts[1]}` : s.replace(/,/g, '');
  } else {
    normalized = s.replace(/,/g, '');
  }
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
}

function parsePercentValue(val: unknown): number {
  const rawStr = String(val ?? '').trim();
  if (!rawStr) return 0;
  if (rawStr.includes('%')) {
    return Math.max(0, Math.min(100, parseNumeric(rawStr)));
  }
  const num = parseNumeric(rawStr);
  // If Excel saved unformatted percentage fraction (e.g. 0.15 for 15%), convert if > 0 && <= 1
  if (num > 0 && num <= 1) {
    return Math.round(num * 10000) / 100;
  }
  return Math.max(0, Math.min(100, num));
}

function normalizeHeaderLabel(val: unknown): string {
  return String(val ?? '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
    .toUpperCase()
    .replace(/['’`]/g, '')
    .replace(/[._]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isInvalidCellValue(val: string): boolean {
  const s = val.trim();
  if (!s) return true;
  return /^(#N\/A|#REF!|#VALUE!|#NAME\?|#DIV\/0!|#NUM!|N\/A)$/i.test(s);
}

export function normalizePartNumber(raw: unknown): string {
  const s = String(raw ?? '').trim();
  if (isInvalidCellValue(s)) return '';
  return s.replace(/^\++/, '').trim();
}

export function mapSupplyToRoutingId(rawSupply: unknown): number {
  const s = String(rawSupply ?? '').trim().toUpperCase();
  if (!s || isInvalidCellValue(s)) return 0;
  if (s === 'H' || s === 'HOUSING' || s.startsWith('HOUS')) return 20;
  if (s === 'PP' || s === 'PRE-PROCESS' || s === 'PREPROCESS') return 10;
  if (s === 'A' || s === 'ASSY' || s === 'ASSEMBLY') return 30;
  if (
    s === 'ACC V' ||
    s === 'ACCV' ||
    s === 'V' ||
    s.startsWith('ACC') ||
    s.includes('VIS') ||
    s.includes('FIN')
  ) {
    return 40;
  }
  const n = parseFloat(s.replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

interface DetectedPartListHeader {
  startRow: number;
  isPlRevFormat: boolean;
  colMap: {
    cust: number;
    assy: number;
    pn: number;
    pname: number;
    qty: number;
    rid: number;
    supply: number;
  };
  colEnds: {
    pn: number;
    pname: number;
    qty: number;
    rid: number;
    supply: number;
  };
}

function isPartNoHeader(h: string): boolean {
  return (
    h === 'PART NUMBER' ||
    h === 'PART NO' ||
    h === 'PARTNO' ||
    h === 'NO PART' ||
    h === 'PART CODE' ||
    h === 'MATERIAL NO' ||
    h === 'MATERIAL NUMBER'
  );
}

function isPartNameHeader(h: string): boolean {
  return (
    h === 'PART NAME' ||
    h === 'PARTNAME' ||
    h === 'ITEM NAME' ||
    h === 'DESCRIPTION' ||
    h === 'DESC' ||
    h === 'NAMA PART' ||
    h === 'MATERIAL NAME'
  );
}

function isQtyHeader(h: string): boolean {
  return (
    h === 'QTY' ||
    h === 'QUANTITY' ||
    h === 'Q TY' ||
    h === 'JUMLAH' ||
    h === 'JML' ||
    h === 'USAGE' ||
    h === 'REQ QTY'
  );
}

function detectPartListHeader(grid: unknown[][]): DetectedPartListHeader | null {
  for (let r = 0; r < Math.min(grid.length, 100); r++) {
    const row = grid[r];
    if (!row || row.length < 3) continue;
    const norm = row.map((c) => normalizeHeaderLabel(c));

    const pnCandidates: number[] = [];
    for (let c = 0; c < norm.length; c++) {
      if (isPartNoHeader(norm[c])) {
        pnCandidates.push(c);
      }
    }
    if (pnCandidates.length === 0) continue;

    // Evaluate each PART NO table block independently (supports both single wide-merged tables
    // like PL NEW ASSY and side-by-side OLD + NEW tables like PL_REV)
    interface BlockCandidate {
      score: number;
      result: DetectedPartListHeader;
    }
    const candidates: BlockCandidate[] = [];

    for (let idx = 0; idx < pnCandidates.length; idx++) {
      const pnIdx = pnCandidates[idx];
      const blockEnd = idx + 1 < pnCandidates.length ? pnCandidates[idx + 1] : norm.length;

      let nameIdx = -1;
      for (let c = pnIdx + 1; c < blockEnd; c++) {
        if (isPartNameHeader(norm[c])) {
          nameIdx = c;
          break;
        }
      }
      if (nameIdx < 0) continue;

      let qtyIdx = -1;
      for (let c = nameIdx + 1; c < blockEnd; c++) {
        if (isQtyHeader(norm[c])) {
          qtyIdx = c;
          break;
        }
      }
      // Fallback: check between pnIdx and nameIdx in case Qty precedes Part Name
      if (qtyIdx < 0) {
        for (let c = pnIdx + 1; c < nameIdx; c++) {
          if (isQtyHeader(norm[c])) {
            qtyIdx = c;
            break;
          }
        }
      }

      let supplyIdx = -1;
      let unitIdx = -1;
      let makerIdx = -1;
      let ridIdx = -1;
      let hasRevisi = false;

      for (let c = pnIdx + 1; c < blockEnd; c++) {
        const h = norm[c];
        if (!h) continue;
        if (supplyIdx < 0 && (h === 'SUPPLY' || h.startsWith('SUPPLY '))) supplyIdx = c;
        if (unitIdx < 0 && (h === 'UNIT' || h === 'UOM')) unitIdx = c;
        if (makerIdx < 0 && (h === 'MAKER' || h === 'SUPPLIER' || h === 'VENDOR')) makerIdx = c;
        if (ridIdx < 0 && (h === 'ROUTING ID' || h === 'ROUTING')) ridIdx = c;
        if (h === 'REVISI' || h === 'MODIF / REVISI' || h === 'REVISION' || h === 'REV') {
          hasRevisi = true;
        }
      }

      const prevBlockEnd = idx > 0 ? pnCandidates[idx - 1] : 0;
      let custIdx = -1;
      let assyIdx = -1;
      for (let c = prevBlockEnd; c < blockEnd; c++) {
        const h = norm[c];
        if (custIdx < 0 && h === 'CUSTOMER') custIdx = c;
        if (
          assyIdx < 0 &&
          (h === 'ASSY NUMBER' || h === 'ASSY NO' || h.startsWith('ASSY NO'))
        ) {
          assyIdx = c;
        }
      }

      const findNextHeaderCol = (col: number): number => {
        if (col < 0) return -1;
        for (let c = col + 1; c < blockEnd; c++) {
          if (norm[c]) return c;
        }
        return blockEnd;
      };

      const resolvedQtyIdx = qtyIdx >= 0 ? qtyIdx : nameIdx + 1;
      const isPlRevFormat =
        supplyIdx >= 0 || (unitIdx >= 0 && makerIdx >= 0) || hasRevisi;

      // Score prefers the richer/active engineering table (e.g. right-side NEW table with SUPPLY/UNIT/MAKER)
      let score = 10;
      if (qtyIdx >= 0) score += 5;
      if (supplyIdx >= 0) score += 20;
      if (unitIdx >= 0) score += 8;
      if (makerIdx >= 0) score += 8;
      if (ridIdx >= 0) score += 15;
      if (hasRevisi) score += 6;
      if (custIdx >= 0) score += 3;
      if (assyIdx >= 0) score += 3;

      candidates.push({
        score,
        result: {
          startRow: r + 1,
          isPlRevFormat,
          colMap: {
            cust: custIdx,
            assy: assyIdx,
            pn: pnIdx,
            pname: nameIdx,
            qty: resolvedQtyIdx,
            rid: ridIdx,
            supply: supplyIdx,
          },
          colEnds: {
            pn: findNextHeaderCol(pnIdx),
            pname: findNextHeaderCol(nameIdx),
            qty: findNextHeaderCol(resolvedQtyIdx),
            rid: findNextHeaderCol(ridIdx),
            supply: findNextHeaderCol(supplyIdx),
          },
        },
      });
    }

    if (candidates.length > 0) {
      candidates.sort((a, b) => b.score - a.score);
      return candidates[0].result;
    }
  }
  return null;
}

function pickCellInSpan(cols: unknown[], startCol: number, endCol: number): string {
  if (startCol < 0) return '';
  const direct = String(cols[startCol] ?? '').trim();
  if (direct && !isInvalidCellValue(direct)) return direct;
  const limit = endCol > startCol ? Math.min(endCol, cols.length) : startCol + 1;
  for (let c = startCol + 1; c < limit; c++) {
    const val = String(cols[c] ?? '').trim();
    if (val && !isInvalidCellValue(val)) return val;
  }
  return direct;
}

export function parsePartListFromGrid(
  grid: unknown[][],
  aclList: AutoCutItem[],
  flList: FeederItem[]
): PartListItem[] {
  const aclLookup = buildAutoCutLookup(aclList);
  const flMap = buildFeederLookup(flList);
  const rows: PartListItem[] = [];

  const headerMeta = parsePartMasterFromGrid(grid).params;
  const fallbackCustomer = headerMeta?.customer || '';
  const fallbackAssyNo = headerMeta?.assyNo || '';

  const detected = detectPartListHeader(grid);
  const colMap = detected
    ? detected.colMap
    : { cust: 1, assy: 2, pn: 3, pname: 4, qty: 5, rid: 6, supply: -1 };
  const colEnds = detected
    ? detected.colEnds
    : { pn: 4, pname: 5, qty: 6, rid: 7, supply: -1 };
  const startRow = detected ? detected.startRow : 0;

  for (let r = startRow; r < grid.length; r++) {
    const cols = grid[r];
    if (!cols || cols.length < 3) continue;
    const rowUpper = cols.map((c) => normalizeHeaderLabel(c));
    // Stop if another stacked section starts
    if (
      r > startRow &&
      (rowUpper.includes('CCT NO') ||
        rowUpper.includes('TERMINAL R') ||
        (rowUpper.includes('TYPE') && rowUpper.includes('TL')))
    ) {
      break;
    }
    const col0 = rowUpper[0] || '';
    if (col0 === 'NO' || col0 === 'MASTER PART LIST') continue;

    const rawCustomer = colMap.cust >= 0 ? String(cols[colMap.cust] || '').trim() : '';
    const rawAssyNo = colMap.assy >= 0 ? String(cols[colMap.assy] || '').trim() : '';
    const customer = !isInvalidCellValue(rawCustomer) ? rawCustomer : fallbackCustomer;
    const assyNo = !isInvalidCellValue(rawAssyNo) ? rawAssyNo : fallbackAssyNo;

    const rawPn = pickCellInSpan(cols, colMap.pn, colEnds.pn);
    const rawPname = pickCellInSpan(cols, colMap.pname, colEnds.pname);

    if (isInvalidCellValue(rawPn) && isInvalidCellValue(rawPname)) continue;
    const normPn = normalizeHeaderLabel(rawPn);
    if (normPn === 'TOTAL' || normPn === 'GRAND TOTAL' || normPn === 'SUBTOTAL' || isPartNoHeader(normPn)) {
      continue;
    }
    if (detected?.isPlRevFormat) {
      // Skip blank/placeholder template rows (e.g. #N/A or empty PART NO / PART NAME)
      if (isInvalidCellValue(rawPn) || isInvalidCellValue(rawPname)) continue;
      if (rawPn === '0' && isInvalidCellValue(rawPname)) continue;
    }

    const partNumber = normalizePartNumber(rawPn);
    const partName = isInvalidCellValue(rawPname) ? '' : rawPname;
    if (!partNumber && !partName) continue;

    const rawQty = pickCellInSpan(cols, colMap.qty, colEnds.qty);
    const qty = parseNumeric(rawQty);
    let routingId = 0;
    const rawRid = colMap.rid >= 0 ? pickCellInSpan(cols, colMap.rid, colEnds.rid) : '';
    if (rawRid !== '') {
      routingId = parseNumeric(rawRid);
    } else if (colMap.supply >= 0) {
      const rawSupply = pickCellInSpan(cols, colMap.supply, colEnds.supply);
      routingId = mapSupplyToRoutingId(rawSupply);
    }

    rows.push(
      enrichPartListRowFast(customer, assyNo, partNumber, partName, qty, routingId, aclLookup, flMap)
    );
  }
  return rows;
}

interface PpcsColMap {
  assyNo: number;
  cctNo: number;
  kind: number;
  sizeRaw: number;
  colour: number;
  cl: number;
  from: number;
  to: number;
  jointNo: number;
  twist: number;
  tubeR: number;
  tubeF: number;
  hd: number;
  sd: number;
  termR: number;
  markerR: number;
  dcR: number;
  accR1: number;
  accR2: number;
  termF: number;
  markerF: number;
  dcF: number;
  accF1: number;
  accF2: number;
}

interface DetectedPpcsHeader {
  headerStartRow: number;
  dataStartRow: number;
  colMap: PpcsColMap;
}

function normalizePpcsToken(val: unknown): string {
  return String(val ?? '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .toUpperCase()
    .replace(/['’`]/g, '')
    .replace(/[-/_()[\].:&,]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isPpcsGroupHeader(raw: string): boolean {
  const t = normalizePpcsToken(raw);
  if (!t) return false;
  if (
    /^(WIRE|WIRE SPEC|SPEC|KABEL|WIRING|CIRCUIT|R|F|A|B|SIDE R|SIDE F|R SIDE|F SIDE|SIDE A|SIDE B|A SIDE|B SIDE|SIDE 1|SIDE 2|END R|END F|R END|F END|END A|END B|END 1|END 2|REAR|FRONT|REAR SIDE|FRONT SIDE|LEFT|RIGHT|LEFT SIDE|RIGHT SIDE|UJUNG R|UJUNG F|SISI R|SISI F|CONN R|CONN F|PROCESS R|PROCESS F|CRIMPING R|CRIMPING F|CRIMP R|CRIMP F|TERMINAL|TERM|TRM|TERMINAL R|TERMINAL F|TERM R|TERM F|ACC|ACCS|ACCESSORY|ACCESSORIES|ACC R|ACC F|ACCESSORIES R|ACCESSORIES F|SEAL|SEAL R|SEAL F|TUBE|TUB|MARKER|MARK|MRK|DC|D C|DOUBLE CRIMP|JOINT|SPLICE|STRIP|TWIST)$/.test(
      t
    )
  ) {
    return true;
  }
  // Composite group headers like "TERMINAL ACC R", "R SIDE PROCESS", "SIDE F TERMINAL ACC"
  const tokens = t.split(' ');
  const hasGroupWord = tokens.some((w) =>
    ['SIDE', 'END', 'SISI', 'UJUNG', 'REAR', 'FRONT', 'WIRE', 'TERMINAL', 'TERM', 'ACC', 'ACCESSORY', 'ACCESSORIES', 'SEAL', 'TUBE', 'MARKER', 'MARK', 'CRIMP', 'CRIMPING', 'PROCESS'].includes(
      w
    )
  );
  return hasGroupWord && tokens.length <= 5;
}

const KNOWN_WIRE_KIND_RE =
  /^(AV|AVS|AVSS|AVSSH|CAVS|CIVUS|AESSX|AEX|TXL|GXL|SXL|FLRY|FLR|UL|KIV|TV|MVVS|SHIELD|COAX|TWIST)/i;

function isCctColLabel(h: string): boolean {
  const t = normalizePpcsToken(h);
  return (
    t === 'CCT NO' ||
    t === 'CCT' ||
    t === 'NO CCT' ||
    t === 'CIRCUIT NO' ||
    t === 'CIRCUIT' ||
    t === 'WIRE NO' ||
    t === 'NO WIRE' ||
    t === 'CCT NUMBER' ||
    t === 'CIRCUIT NUMBER' ||
    t === 'CCT #' ||
    t === 'CIRCUIT #'
  );
}

function isKindColLabel(h: string): boolean {
  const t = normalizePpcsToken(h);
  return (
    t === 'KIND' ||
    t === 'WIRE KIND' ||
    t === 'W KIND' ||
    t === 'WIRE TYPE' ||
    t === 'TYPE WIRE' ||
    t === 'WIRE SPEC' ||
    t === 'SPEC' ||
    t === 'SPEC KIND' ||
    t === 'JENIS' ||
    t === 'JENIS KABEL'
  );
}

function isSizeColLabel(h: string): boolean {
  const t = normalizePpcsToken(h);
  return (
    t === 'SIZE' ||
    t === 'WIRE SIZE' ||
    t === 'W SIZE' ||
    t === 'SQ' ||
    t === 'WIRE SQ' ||
    t === 'SIZE SQ' ||
    t === 'DIAMETER' ||
    t === 'UKURAN'
  );
}

function isColourColLabel(h: string): boolean {
  const t = normalizePpcsToken(h);
  return (
    t === 'COLOUR' ||
    t === 'COLOR' ||
    t === 'COL' ||
    t === 'CLR' ||
    t === 'WARNA' ||
    t === 'WIRE COLOUR' ||
    t === 'WIRE COLOR' ||
    t === 'WIRE COL' ||
    t === 'W COL' ||
    t === 'W COLOUR' ||
    t === 'W COLOR'
  );
}

function isClColLabel(h: string): boolean {
  const t = normalizePpcsToken(h);
  return (
    t === 'C L' ||
    t === 'CL' ||
    t === 'CUT LENGTH' ||
    t === 'CUTTING LENGTH' ||
    t === 'WIRE LENGTH' ||
    t === 'LENGTH' ||
    t === 'PANJANG' ||
    t === 'L' ||
    t === 'C L MM' ||
    t === 'CL MM' ||
    t === 'LENGTH MM' ||
    t === 'CUT LENGTH MM' ||
    t === 'CUT L' ||
    t === 'CUTLEN' ||
    t === 'WIRE L'
  );
}

type PpcsFieldKind =
  | 'assyNo'
  | 'cctNo'
  | 'kind'
  | 'sizeRaw'
  | 'colour'
  | 'cl'
  | 'from'
  | 'to'
  | 'jointNo'
  | 'twist'
  | 'hd'
  | 'sd'
  | 'tube'
  | 'term'
  | 'marker'
  | 'dc'
  | 'acc';

interface ClassifiedPpcsCol {
  field: PpcsFieldKind;
  side: 'R' | 'F' | null;
  slot: 1 | 2 | null;
}

const CONCAT_FIELD_SIDE_RE =
  /^(TERMINAL|TERM|TRM|TM|MARKER|MARK|MRK|MKR|DC|TUBE|TUB|ACC|ACCS|SEAL|SLEEVE|SLV)([RFAB])([12])?$/;
const PREFIX_SIDE_FIELD_RE =
  /^([RF])(TERMINAL|TERM|TRM|MARKER|MARK|MRK|MKR|DC|TUBE|TUB|ACC|ACCS|SEAL|SLEEVE|SLV)([12])?$/;

function detectSideFromTokens(tokens: string[]): 'R' | 'F' | null {
  let hasR = false;
  let hasF = false;

  for (let i = 0; i < tokens.length; i++) {
    const w = tokens[i];
    if (
      w === 'R' ||
      w === 'R1' ||
      w === 'R2' ||
      w === 'REAR' ||
      w === 'LEFT' ||
      w === 'A' ||
      w === 'A1' ||
      w === 'A2'
    ) {
      hasR = true;
      continue;
    }
    if (
      w === 'F' ||
      w === 'F1' ||
      w === 'F2' ||
      w === 'FRONT' ||
      w === 'RIGHT' ||
      w === 'B' ||
      w === 'B1' ||
      w === 'B2'
    ) {
      hasF = true;
      continue;
    }
    if ((w === '1' || w === 'I') && i > 0 && (tokens[i - 1] === 'SIDE' || tokens[i - 1] === 'END')) {
      hasR = true;
      continue;
    }
    if ((w === '2' || w === 'II') && i > 0 && (tokens[i - 1] === 'SIDE' || tokens[i - 1] === 'END')) {
      hasF = true;
      continue;
    }
    const mSuffix = CONCAT_FIELD_SIDE_RE.exec(w);
    if (mSuffix) {
      if (mSuffix[2] === 'R' || mSuffix[2] === 'A') hasR = true;
      if (mSuffix[2] === 'F' || mSuffix[2] === 'B') hasF = true;
      continue;
    }
    const mPrefix = PREFIX_SIDE_FIELD_RE.exec(w);
    if (mPrefix) {
      if (mPrefix[1] === 'R') hasR = true;
      if (mPrefix[1] === 'F') hasF = true;
    }
  }

  if (hasR && !hasF) return 'R';
  if (hasF && !hasR) return 'F';
  return null;
}

function detectSlotFromTokens(tokens: string[]): 1 | 2 | null {
  let has1 = false;
  let has2 = false;

  for (let i = 0; i < tokens.length; i++) {
    const w = tokens[i];
    if (
      w === '1' ||
      w === 'R1' ||
      w === 'F1' ||
      w === 'A1' ||
      w === 'B1' ||
      w === 'ACC1' ||
      w === 'ACCR1' ||
      w === 'ACCF1' ||
      w === 'SEAL1' ||
      w === 'SEALR1' ||
      w === 'SEALF1' ||
      w === 'SLV1'
    ) {
      // Ignore "SIDE 1" / "END 1" as slot
      if (w === '1' && i > 0 && (tokens[i - 1] === 'SIDE' || tokens[i - 1] === 'END')) continue;
      has1 = true;
    } else if (
      w === '2' ||
      w === 'R2' ||
      w === 'F2' ||
      w === 'A2' ||
      w === 'B2' ||
      w === 'ACC2' ||
      w === 'ACCR2' ||
      w === 'ACCF2' ||
      w === 'SEAL2' ||
      w === 'SEALR2' ||
      w === 'SEALF2' ||
      w === 'SLV2'
    ) {
      if (w === '2' && i > 0 && (tokens[i - 1] === 'SIDE' || tokens[i - 1] === 'END')) continue;
      has2 = true;
    } else {
      const m = CONCAT_FIELD_SIDE_RE.exec(w) || PREFIX_SIDE_FIELD_RE.exec(w);
      if (m && m[3] === '1') has1 = true;
      if (m && m[3] === '2') has2 = true;
    }
  }

  if (has1 && !has2) return 1;
  if (has2 && !has1) return 2;
  return null;
}

function classifyPpcsColumn(leafRaw: string, topRaw: string, fullRaw: string): ClassifiedPpcsCol | null {
  const leafTok = normalizePpcsToken(leafRaw);
  const topTok = normalizePpcsToken(topRaw);
  const fullTok = normalizePpcsToken(fullRaw);
  if (!leafTok && !fullTok) return null;

  const leafWords = leafTok ? leafTok.split(' ') : [];
  const topWords = topTok ? topTok.split(' ') : [];
  const fullWords = fullTok ? fullTok.split(' ') : [];

  // 1. Exact/core non-sided wire columns first
  if (
    fullTok === 'ASSY NO' ||
    fullTok === 'ASSY NUMBER' ||
    fullTok === 'NO ASSY' ||
    leafTok === 'ASSY NO' ||
    leafTok === 'ASSY NUMBER'
  ) {
    return { field: 'assyNo', side: null, slot: null };
  }
  if (isCctColLabel(leafTok) || isCctColLabel(fullTok)) {
    return { field: 'cctNo', side: null, slot: null };
  }
  if (
    isKindColLabel(leafTok) ||
    isKindColLabel(fullTok) ||
    (leafTok === 'TYPE' && (topTok.includes('WIRE') || topTok === 'SPEC' || topTok === 'KABEL'))
  ) {
    return { field: 'kind', side: null, slot: null };
  }
  if (isSizeColLabel(leafTok) || isSizeColLabel(fullTok)) {
    return { field: 'sizeRaw', side: null, slot: null };
  }
  if (isColourColLabel(leafTok) || isColourColLabel(fullTok)) {
    return { field: 'colour', side: null, slot: null };
  }
  if (isClColLabel(leafTok) || isClColLabel(fullTok)) {
    return { field: 'cl', side: null, slot: null };
  }
  if (
    leafTok === 'FROM' ||
    fullTok === 'FROM' ||
    fullTok === 'FROM CONN' ||
    fullTok === 'CONN FROM' ||
    fullTok === 'LOCATION R' ||
    fullTok === 'LOC R' ||
    leafTok === 'DARI'
  ) {
    return { field: 'from', side: null, slot: null };
  }
  if (
    leafTok === 'TO' ||
    fullTok === 'TO' ||
    fullTok === 'TO CONN' ||
    fullTok === 'CONN TO' ||
    fullTok === 'LOCATION F' ||
    fullTok === 'LOC F' ||
    leafTok === 'KE'
  ) {
    return { field: 'to', side: null, slot: null };
  }
  if (
    leafTok === 'JOINT NO' ||
    leafTok === 'JOINT' ||
    leafTok === 'J N' ||
    leafTok === 'JN' ||
    leafTok === 'JNT' ||
    leafTok === 'SPLICE' ||
    leafTok === 'SPLICE NO' ||
    fullTok === 'JOINT NO' ||
    fullTok === 'NO JOINT' ||
    fullTok === 'JOINT CODE'
  ) {
    return { field: 'jointNo', side: null, slot: null };
  }
  if (
    leafTok === 'TWIST' ||
    leafTok === 'TWIST NO' ||
    leafTok === 'TW' ||
    leafTok === 'TW NO' ||
    leafTok === 'TWISTED' ||
    fullTok === 'TWIST' ||
    fullTok === 'TWIST NO'
  ) {
    return { field: 'twist', side: null, slot: null };
  }
  if (
    leafTok === 'HD' ||
    leafTok === 'H D' ||
    fullTok === 'HD' ||
    fullTok === 'H D' ||
    fullTok === 'HALF STRIP'
  ) {
    return { field: 'hd', side: null, slot: null };
  }
  if (
    leafTok === 'SD' ||
    leafTok === 'S D' ||
    fullTok === 'SD' ||
    fullTok === 'S D' ||
    fullTok === 'SEMI STRIP'
  ) {
    return { field: 'sd', side: null, slot: null };
  }

  // Side priority: leaf first (explicit e.g. TERM-F), then top group header (e.g. F-SIDE), then combined
  const side =
    detectSideFromTokens(leafWords) ??
    detectSideFromTokens(topWords) ??
    detectSideFromTokens(fullWords);

  const hasTokenMatching = (words: string[], re: RegExp) => words.some((w) => re.test(w));

  // Helper to detect "D C" consecutive tokens (normalized from "D/C" or "D-C")
  const hasDoubleCrimp = (words: string[]) => {
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (/^(DC|DCR|DCF|DCA|DCB|RDC|FDC)$/.test(w)) return true;
      if (w === 'D' && words[i + 1] === 'C') return true;
      if (w === 'DOUBLE' && (words[i + 1] === 'CRIMP' || words[i + 1] === 'CRIMPING')) return true;
    }
    return false;
  };

  // Check leaf first so explicit leaf labels win over generic group titles (e.g. group "TERMINAL & ACC", leaf "ACC-F1")
  const checkField = (words: string[]): PpcsFieldKind | null => {
    if (words.length === 0) return null;
    // Skip REMARK / NOTES so they never confuse MARKER
    if (words.some((w) => w === 'REMARK' || w === 'REMARKS' || w === 'NOTE' || w === 'NOTES')) {
      return null;
    }
    if (
      hasTokenMatching(
        words,
        /^(ACC|ACCS|ACCESSORY|ACCESSORIES|SEAL|RUBBER|PLUG|SLEEVE|SLV|BOOT|WP)([RFAB])?([12])?$/
      ) ||
      hasTokenMatching(words, /^[RF](ACC|ACCS|SEAL|SLEEVE|SLV)([12])?$/)
    ) {
      return 'acc';
    }
    if (hasDoubleCrimp(words)) {
      return 'dc';
    }
    if (
      hasTokenMatching(words, /^(MARKER|MARK|MRK|MKR)([RFAB])?$/) ||
      hasTokenMatching(words, /^[RF](MARKER|MARK|MRK|MKR)$/) ||
      (words.length === 2 && words[0] === 'M' && (words[1] === 'R' || words[1] === 'F'))
    ) {
      return 'marker';
    }
    if (
      hasTokenMatching(words, /^(TERMINAL|TERM|TRM|TM)([RFAB])?$/) ||
      hasTokenMatching(words, /^[RF](TERMINAL|TERM|TRM)$/)
    ) {
      return 'term';
    }
    if (
      hasTokenMatching(words, /^(TUBE|TUB)([RFAB])?([12])?$/) ||
      hasTokenMatching(words, /^[RF](TUBE|TUB)$/) ||
      (words.includes('VO') && words.includes('TUBE')) ||
      (words.includes('PVC') && words.includes('TUBE'))
    ) {
      return 'tube';
    }
    return null;
  };

  const field = checkField(leafWords) ?? checkField(fullWords);
  if (!field) return null;

  const slot =
    field === 'acc'
      ? detectSlotFromTokens(leafWords) ?? detectSlotFromTokens(fullWords)
      : null;

  return { field, side, slot };
}

const PPCS_EXTRA_SUBHEADER_TOKENS = new Set([
  'NO',
  'R',
  'F',
  'A',
  'B',
  'R1',
  'R2',
  'F1',
  'F2',
  'A1',
  'A2',
  'B1',
  'B2',
  '1',
  '2',
  'TYPE',
  'PART NO',
  'CODE',
  'QTY',
  'MM',
  'REMARK',
  'REMARKS',
  'NOTE',
  'NOTES',
  'CAV',
  'CAVITY',
  'CONN',
  'CONNECTOR',
  'STRIP',
  'SHIELD',
]);

function isPpcsSubHeaderRow(row: unknown[], clColHint: number, kindColHint: number): boolean {
  if (!row || row.length === 0) return false;
  const nonEmpty: string[] = [];
  for (let c = 0; c < row.length; c++) {
    const lbl = normalizePpcsToken(row[c]);
    if (lbl) nonEmpty.push(lbl);
  }
  if (nonEmpty.length === 0) return false;

  // If the C/L column already holds a real cutting length (> 15mm), this is a data row, not a sub-header
  if (clColHint >= 0) {
    const clRaw = String(row[clColHint] ?? '').trim();
    if (clRaw && /^\d+(\.\d+)?$/.test(clRaw.replace(/,/g, '')) && parseNumeric(clRaw) > 15) {
      return false;
    }
  }
  // If the KIND column holds a real wire spec (AVSS, AVS, AV, etc.), this is a data row
  if (kindColHint >= 0) {
    const kindRaw = String(row[kindColHint] ?? '').trim();
    if (kindRaw && KNOWN_WIRE_KIND_RE.test(kindRaw)) {
      return false;
    }
  }

  let tokenHits = 0;
  for (const lbl of nonEmpty) {
    if (
      PPCS_EXTRA_SUBHEADER_TOKENS.has(lbl) ||
      classifyPpcsColumn(lbl, '', lbl) !== null ||
      isPpcsGroupHeader(lbl)
    ) {
      tokenHits++;
    }
  }
  return tokenHits >= 2 && tokenHits / nonEmpty.length >= 0.45;
}

function detectPpcsHeader(grid: unknown[][]): DetectedPpcsHeader | null {
  const maxScan = Math.min(grid.length, 60);

  for (let r = 0; r < maxScan; r++) {
    const row0 = (grid[r] || []).map((c) => normalizePpcsToken(c));
    const row1 = (grid[r + 1] || []).map((c) => normalizePpcsToken(c));
    const maxCols = Math.max(row0.length, row1.length);
    if (maxCols < 5) continue;

    // Score row0 alone and (row0 + row1) combined using smart PPCS column classification
    const scoreRowSet = (labels: string[]) => {
      let hasCct = false;
      let hasTerm = false;
      let signals = 0;
      for (const h of labels) {
        if (!h) continue;
        const cls = classifyPpcsColumn(h, '', h);
        if (!cls) continue;
        if (cls.field === 'cctNo') hasCct = true;
        if (cls.field === 'term') hasTerm = true;
        if (cls.field !== 'assyNo') signals++;
      }
      return { hasCct, hasTerm, signals };
    };

    const s0 = scoreRowSet(row0);
    const combinedProbe = [...row0, ...row1];
    const s01 = scoreRowSet(combinedProbe);

    // Must have either a CCT / Terminal anchor AND at least 2 wire-table columns (prevents matching top metadata row with "JML CCT")
    const matchedSingle = (s0.hasCct || s0.hasTerm) && s0.signals >= 3;
    const matchedTwoRow =
      !matchedSingle &&
      (s0.hasCct ||
        s0.hasTerm ||
        row0.some((h) => h === 'WIRE' || h === 'NO' || h === 'C L' || isPpcsGroupHeader(h))) &&
      (s01.hasCct || s01.hasTerm) &&
      s01.signals >= 3 &&
      isPpcsSubHeaderRow(grid[r + 1] || [], -1, -1);

    if (!matchedSingle && !matchedTwoRow) continue;

    // Determine exact headerEndRow (handle 1-row, 2-row, or 3-row merged headers)
    let headerEndRow = r;
    const preliminaryClCol = row0.findIndex((h) => isClColLabel(h));
    const preliminaryKindCol = row0.findIndex((h) => isKindColLabel(h));

    if (
      r + 1 < grid.length &&
      (matchedTwoRow || isPpcsSubHeaderRow(grid[r + 1] || [], preliminaryClCol, preliminaryKindCol))
    ) {
      headerEndRow = r + 1;
      if (
        r + 2 < grid.length &&
        isPpcsSubHeaderRow(grid[r + 2] || [], preliminaryClCol, preliminaryKindCol)
      ) {
        headerEndRow = r + 2;
      }
    }

    // Build per-column normalized labels with forward-filled merged group headers
    const headerRows: string[][] = [];
    let width = 0;
    for (let hr = r; hr <= headerEndRow; hr++) {
      const normRow = (grid[hr] || []).map((c) => normalizePpcsToken(c));
      headerRows.push(normRow);
      if (normRow.length > width) width = normRow.length;
    }

    const colTop: string[] = new Array(width).fill('');
    const colLeaf: string[] = new Array(width).fill('');
    const colFull: string[] = new Array(width).fill('');

    if (headerRows.length === 1) {
      for (let c = 0; c < width; c++) {
        colTop[c] = headerRows[0][c] || '';
        colLeaf[c] = headerRows[0][c] || '';
        colFull[c] = headerRows[0][c] || '';
      }
    } else {
      // Forward-fill group headers on the top row across empty slots (including merged sub-header interiors)
      let activeGroup = '';
      let emptyStreak = 0;
      for (let c = 0; c < width; c++) {
        const topVal = headerRows[0][c] || '';
        const lowerParts: string[] = [];
        for (let k = 1; k < headerRows.length; k++) {
          if (headerRows[k][c]) lowerParts.push(headerRows[k][c]);
        }
        const subVal = lowerParts.join(' ');

        if (topVal) {
          activeGroup = isPpcsGroupHeader(topVal) ? topVal : '';
          emptyStreak = 0;
          colTop[c] = topVal;
        } else if (activeGroup && subVal) {
          emptyStreak = 0;
          colTop[c] = activeGroup;
        } else if (activeGroup && emptyStreak < 3) {
          emptyStreak++;
          colTop[c] = activeGroup;
        } else {
          activeGroup = '';
          emptyStreak = 0;
          colTop[c] = '';
        }

        colLeaf[c] = subVal || topVal;
        colFull[c] =
          colTop[c] && subVal && colTop[c] !== subVal
            ? `${colTop[c]} ${subVal}`
            : subVal || colTop[c];
      }
    }

    const colMap: PpcsColMap = {
      assyNo: -1,
      cctNo: -1,
      kind: -1,
      sizeRaw: -1,
      colour: -1,
      cl: -1,
      from: -1,
      to: -1,
      jointNo: -1,
      twist: -1,
      tubeR: -1,
      tubeF: -1,
      hd: -1,
      sd: -1,
      termR: -1,
      markerR: -1,
      dcR: -1,
      accR1: -1,
      accR2: -1,
      termF: -1,
      markerF: -1,
      dcF: -1,
      accF1: -1,
      accF2: -1,
    };

    const genericTerms: number[] = [];
    const genericMarkers: number[] = [];
    const genericDcs: number[] = [];
    const genericTubes: number[] = [];
    const genericAccs: number[] = [];

    for (let c = 0; c < width; c++) {
      const leaf = colLeaf[c];
      const full = colFull[c];
      const top = colTop[c];
      if (!leaf && !full) continue;

      const cls = classifyPpcsColumn(leaf, top, full);
      if (!cls) continue;

      switch (cls.field) {
        case 'assyNo':
          if (colMap.assyNo < 0) colMap.assyNo = c;
          break;
        case 'cctNo':
          if (colMap.cctNo < 0) colMap.cctNo = c;
          break;
        case 'kind':
          if (colMap.kind < 0) colMap.kind = c;
          break;
        case 'sizeRaw':
          if (colMap.sizeRaw < 0) colMap.sizeRaw = c;
          break;
        case 'colour':
          if (colMap.colour < 0) colMap.colour = c;
          break;
        case 'cl':
          if (colMap.cl < 0) colMap.cl = c;
          break;
        case 'from':
          if (colMap.from < 0) colMap.from = c;
          break;
        case 'to':
          if (colMap.to < 0) colMap.to = c;
          break;
        case 'jointNo':
          if (colMap.jointNo < 0) colMap.jointNo = c;
          break;
        case 'twist':
          if (colMap.twist < 0) colMap.twist = c;
          break;
        case 'hd':
          if (colMap.hd < 0) colMap.hd = c;
          break;
        case 'sd':
          if (colMap.sd < 0) colMap.sd = c;
          break;
        case 'tube': {
          const nextIsEmpty = c + 1 < width && !colLeaf[c + 1] && !colFull[c + 1];
          const fTokens = full.split(' ');
          if (
            cls.side === null &&
            nextIsEmpty &&
            colMap.tubeR < 0 &&
            colMap.tubeF < 0 &&
            fTokens.includes('R') &&
            fTokens.includes('F')
          ) {
            colMap.tubeR = c;
            colMap.tubeF = c + 1;
          } else if (cls.side === 'R') {
            if (colMap.tubeR < 0) colMap.tubeR = c;
          } else if (cls.side === 'F') {
            if (colMap.tubeF < 0) colMap.tubeF = c;
          } else {
            genericTubes.push(c);
          }
          break;
        }
        case 'term':
          if (cls.side === 'R') {
            if (colMap.termR < 0) colMap.termR = c;
          } else if (cls.side === 'F') {
            if (colMap.termF < 0) colMap.termF = c;
          } else {
            genericTerms.push(c);
          }
          break;
        case 'marker':
          if (cls.side === 'R') {
            if (colMap.markerR < 0) colMap.markerR = c;
          } else if (cls.side === 'F') {
            if (colMap.markerF < 0) colMap.markerF = c;
          } else {
            genericMarkers.push(c);
          }
          break;
        case 'dc':
          if (cls.side === 'R') {
            if (colMap.dcR < 0) colMap.dcR = c;
          } else if (cls.side === 'F') {
            if (colMap.dcF < 0) colMap.dcF = c;
          } else {
            genericDcs.push(c);
          }
          break;
        case 'acc': {
          const nextIsEmpty = c + 1 < width && !colLeaf[c + 1] && !colFull[c + 1];
          const mentionsBothSlots = /1/.test(full) && /2/.test(full);
          if (cls.side === 'R') {
            if (cls.slot === null && mentionsBothSlots && nextIsEmpty && colMap.accR1 < 0 && colMap.accR2 < 0) {
              colMap.accR1 = c;
              colMap.accR2 = c + 1;
            } else if (cls.slot === 1) {
              if (colMap.accR1 < 0) colMap.accR1 = c;
              else if (colMap.accR2 < 0) colMap.accR2 = c;
            } else if (cls.slot === 2) {
              if (colMap.accR2 < 0) colMap.accR2 = c;
              else if (colMap.accR1 < 0) colMap.accR1 = c;
            } else {
              if (colMap.accR1 < 0) colMap.accR1 = c;
              else if (colMap.accR2 < 0) colMap.accR2 = c;
            }
          } else if (cls.side === 'F') {
            if (cls.slot === null && mentionsBothSlots && nextIsEmpty && colMap.accF1 < 0 && colMap.accF2 < 0) {
              colMap.accF1 = c;
              colMap.accF2 = c + 1;
            } else if (cls.slot === 1) {
              if (colMap.accF1 < 0) colMap.accF1 = c;
              else if (colMap.accF2 < 0) colMap.accF2 = c;
            } else if (cls.slot === 2) {
              if (colMap.accF2 < 0) colMap.accF2 = c;
              else if (colMap.accF1 < 0) colMap.accF1 = c;
            } else {
              if (colMap.accF1 < 0) colMap.accF1 = c;
              else if (colMap.accF2 < 0) colMap.accF2 = c;
            }
          } else {
            genericAccs.push(c);
          }
          break;
        }
      }
    }

    // Assign paired generic columns left-to-right (R first, F second)
    if (colMap.tubeR < 0 && genericTubes.length > 0) colMap.tubeR = genericTubes.shift()!;
    if (colMap.tubeF < 0 && genericTubes.length > 0) colMap.tubeF = genericTubes.shift()!;
    if (colMap.termR < 0 && genericTerms.length > 0) colMap.termR = genericTerms.shift()!;
    if (colMap.termF < 0 && genericTerms.length > 0) colMap.termF = genericTerms.shift()!;
    if (colMap.markerR < 0 && genericMarkers.length > 0) colMap.markerR = genericMarkers.shift()!;
    if (colMap.markerF < 0 && genericMarkers.length > 0) colMap.markerF = genericMarkers.shift()!;
    if (colMap.dcR < 0 && genericDcs.length > 0) colMap.dcR = genericDcs.shift()!;
    if (colMap.dcF < 0 && genericDcs.length > 0) colMap.dcF = genericDcs.shift()!;

    for (const acCol of genericAccs) {
      let goesToF = false;
      if (colMap.termR >= 0 && colMap.termF >= 0) {
        goesToF = Math.abs(acCol - colMap.termF) < Math.abs(acCol - colMap.termR);
      } else if (colMap.termF >= 0 && acCol > colMap.termF) {
        goesToF = true;
      }

      if (goesToF) {
        if (colMap.accF1 < 0) colMap.accF1 = acCol;
        else if (colMap.accF2 < 0) colMap.accF2 = acCol;
        else if (colMap.accR1 < 0) colMap.accR1 = acCol;
        else if (colMap.accR2 < 0) colMap.accR2 = acCol;
      } else {
        if (colMap.accR1 < 0) colMap.accR1 = acCol;
        else if (colMap.accR2 < 0) colMap.accR2 = acCol;
        else if (colMap.accF1 < 0) colMap.accF1 = acCol;
        else if (colMap.accF2 < 0) colMap.accF2 = acCol;
      }
    }

    return {
      headerStartRow: r,
      dataStartRow: headerEndRow + 1,
      colMap,
    };
  }

  return null;
}

const PPCS_FOOTER_RE =
  /^(TOTAL|SUBTOTAL|SUB TOTAL|GRAND TOTAL|JUMLAH|JML|SUM|COUNT|NOTE|NOTES|CATATAN|KETERANGAN|WRITTEN|CHECKED|APPROVED|REVISI|REVISION)$/;

function cleanPpcsCell(val: unknown): string {
  const s = String(val ?? '').trim();
  if (!s || isInvalidCellValue(s)) return '';
  return s;
}

function splitCombinedAccPair(rawPrimary: string, rawSecondary: string, hasSecondaryCol: boolean): [string, string] {
  const a1 = normalizePartNumber(rawPrimary);
  const a2 = normalizePartNumber(rawSecondary);
  if (hasSecondaryCol || a2 || !a1) return [a1, a2];
  // Support combined single column like "ACC-F1/F2" containing "7158-3030 / 7158-3031" or newline/comma pair
  if (/[/,\n;]/.test(a1)) {
    const parts = a1
      .split(/[/,\n;]+/)
      .map((p) => normalizePartNumber(p))
      .filter(Boolean);
    if (parts.length >= 2) {
      return [parts[0], parts[1]];
    }
  }
  return [a1, a2];
}

function enrichPpcsRowByMap(
  cols: unknown[],
  colMap: PpcsColMap,
  fallbackAssyNo: string,
  slvSet: Set<string>,
  aclAllMap: Map<string, string>,
  flMap: Map<string, string>
): PpcsWireItem | null {
  const get = (idx: number) => (idx >= 0 ? cleanPpcsCell(cols[idx]) : '');

  const rawAssyNo = get(colMap.assyNo);
  const cctNo = get(colMap.cctNo);
  const kind = get(colMap.kind);
  const sizeRaw = get(colMap.sizeRaw);
  const colour = get(colMap.colour);
  const clRaw = get(colMap.cl);
  const cl = clRaw ? parseNumeric(clRaw) : 0;
  const from = get(colMap.from);
  const to = get(colMap.to);
  const jointNo = get(colMap.jointNo);
  const twist = get(colMap.twist);
  const tubeR = get(colMap.tubeR);
  const tubeF = get(colMap.tubeF);
  const hd = get(colMap.hd);
  const sd = get(colMap.sd);
  const termR = normalizePartNumber(get(colMap.termR));
  const markerR = get(colMap.markerR);
  const dcR = get(colMap.dcR);
  const [accR1, accR2] = splitCombinedAccPair(get(colMap.accR1), get(colMap.accR2), colMap.accR2 >= 0);
  const termF = normalizePartNumber(get(colMap.termF));
  const markerF = get(colMap.markerF);
  const [accF1, accF2] = splitCombinedAccPair(get(colMap.accF1), get(colMap.accF2), colMap.accF2 >= 0);
  const dcF = get(colMap.dcF);

  // Skip repeated headers or summary/footer rows
  const normCol0 = normalizeHeaderLabel(cols[0]);
  const normCct = normalizeHeaderLabel(cctNo);
  const normKind = normalizeHeaderLabel(kind);
  const normSize = normalizeHeaderLabel(sizeRaw);
  const normAssy = normalizeHeaderLabel(rawAssyNo);

  const hasFooterKeyword = cols
    .slice(0, 8)
    .some((cell) => PPCS_FOOTER_RE.test(normalizeHeaderLabel(cell)));

  if (
    isCctColLabel(normCct) ||
    isKindColLabel(normKind) ||
    isSizeColLabel(normSize) ||
    normCol0 === 'NO' ||
    hasFooterKeyword ||
    PPCS_FOOTER_RE.test(normCct) ||
    PPCS_FOOTER_RE.test(normKind) ||
    PPCS_FOOTER_RE.test(normAssy)
  ) {
    return null;
  }

  // Strict valid-circuit check: ignore pre-numbered or formula-filled empty template rows
  const hasValidKind = kind !== '' && kind !== '0';
  const hasValidSize = sizeRaw !== '' && sizeRaw !== '0';
  const hasValidCl = cl > 0;
  const hasValidCct = cctNo !== '' && cctNo !== '0';
  const hasValidEndpoints = from !== '' || to !== '' || termR !== '' || termF !== '';

  const isRealCircuit =
    (hasValidKind && (hasValidCl || hasValidSize || hasValidCct || hasValidEndpoints)) ||
    (hasValidCct && (hasValidCl || hasValidSize || hasValidEndpoints));

  if (!isRealCircuit) return null;

  // Ensure assyNo is populated so discEngine's ppcsCount (= ppcs.filter(r => r.assyNo !== '').length) matches exact circuit count
  const assyNo = rawAssyNo || fallbackAssyNo || 'ASSY';

  const isShield =
    colour === '' || (colour.length >= 2 && colour[1].toUpperCase() === 'C');

  const lookupAcl = (t: string) => {
    if (!t || isShield) return '';
    return aclAllMap.get(t.toLowerCase()) || '';
  };
  const lookupFl = (a: string) => {
    if (!a || isShield) return '';
    return flMap.get(a.toLowerCase()) || '';
  };
  const lookupSlv = (a: string) => {
    if (!a) return '';
    return slvSet.has(a.toLowerCase()) ? 'Sleeve' : '';
  };

  const rAf = lookupFl(accR1) === 'auto feeder' || lookupFl(accR2) === 'auto feeder';
  const fAf = lookupFl(accF1) === 'auto feeder' || lookupFl(accF2) === 'auto feeder';

  const trUp = termR.toUpperCase();
  const tfUp = termF.toUpperCase();
  const rawAclR = lookupAcl(termR) === 'auto cut';
  const rawAclF = lookupAcl(termF) === 'auto cut';

  const validAclR = CONDITIONAL_AC_TERMS.has(trUp) ? rawAclR && rAf : rawAclR;
  const validAclF = CONDITIONAL_AC_TERMS.has(tfUp) ? rawAclF && fAf : rawAclF;

  const rAc = !isShield && (validAclR || rAf);
  const fAc = !isShield && (validAclF || fAf);

  return {
    assyNo,
    cctNo,
    kind,
    sizeRaw,
    colour,
    isShield,
    cl,
    from,
    to,
    jointNo,
    twist,
    tubeR,
    tubeF,
    hd,
    sd,
    termR,
    markerR,
    dcR,
    accR1,
    accR2,
    termF,
    markerF,
    accF1,
    accF2,
    dcF,
    rAf,
    fAf,
    rAc,
    fAc,
    af: lookupSlv(accR1),
    ag: lookupSlv(accF1),
  };
}

export function parsePpcsFromGrid(
  grid: unknown[][],
  plRows: PartListItem[],
  aclList: AutoCutItem[],
  flList: FeederItem[],
  fallbackAssyNoHint = ''
): PpcsWireItem[] {
  const { allMap: aclAllMap } = buildAutoCutLookup(aclList);
  const flMap = buildFeederLookup(flList);
  const slvSet = buildSleeveSet(plRows);
  const rows: PpcsWireItem[] = [];

  const headerMeta = parsePartMasterFromGrid(grid).params;
  const fallbackAssyNo =
    fallbackAssyNoHint || headerMeta?.assyNo || plRows[0]?.assyNo || '';

  const detected = detectPpcsHeader(grid);
  const colMap: PpcsColMap = detected
    ? detected.colMap
    : {
        assyNo: 1,
        cctNo: 2,
        kind: 3,
        sizeRaw: 4,
        colour: 5,
        cl: 6,
        from: 7,
        to: 8,
        jointNo: 9,
        twist: 10,
        tubeR: 11,
        tubeF: 12,
        hd: 13,
        sd: 14,
        termR: 15,
        markerR: 16,
        dcR: 17,
        accR1: 18,
        accR2: 19,
        termF: 20,
        markerF: 21,
        accF1: 22,
        accF2: 23,
        dcF: 24,
      };
  const startRow = detected ? detected.dataStartRow : 0;

  for (let r = startRow; r < grid.length; r++) {
    const cols = grid[r];
    if (!cols || cols.length < 4) continue;
    const rowUpper = cols.map((c) => normalizeHeaderLabel(c));
    if (r > startRow && rowUpper.includes('TYPE') && rowUpper.includes('TL')) {
      break;
    }
    const item = enrichPpcsRowByMap(cols, colMap, fallbackAssyNo, slvSet, aclAllMap, flMap);
    if (item) rows.push(item);
  }
  return rows;
}

export function parseDrawingFromGrid(grid: unknown[][]): AssemblyCotItem[] {
  const rows: AssemblyCotItem[] = [];
  let typeCol = 0;
  let tlCol = 1;
  let startRow = 0;

  for (let r = 0; r < Math.min(grid.length, 40); r++) {
    const row = grid[r];
    if (!row) continue;
    if (normalizeHeaderLabel(row[15]) === 'TYPE') {
      typeCol = 15;
      tlCol = 16;
      startRow = r + 1;
      break;
    }
    for (let c = 0; c < Math.min(row.length - 1, 20); c++) {
      if (normalizeHeaderLabel(row[c]) === 'TYPE') {
        typeCol = c;
        tlCol = c + 1;
        startRow = r + 1;
        break;
      }
    }
    if (startRow > 0) break;
  }

  if (
    startRow === 0 &&
    grid.length > 4 &&
    grid[4] &&
    ['C', 'T', 'B'].includes(String(grid[4][15] || '').trim().toUpperCase())
  ) {
    typeCol = 15;
    tlCol = 16;
    startRow = 4;
  }

  for (let r = startRow; r < grid.length; r++) {
    const row = grid[r];
    if (!row) continue;
    const t = String(row[typeCol] || '').trim().toUpperCase();
    const lVal = parseFloat(String(row[tlCol] || '').trim().replace(/,/g, ''));
    if ((t === 'C' || t === 'T' || t === 'B') && !Number.isNaN(lVal)) {
      rows.push({ type: t, tl: lVal });
    }
  }
  return rows;
}

export function parsePartMasterFromGrid(grid: unknown[][]): {
  params?: Partial<AssyParams>;
  terminalRatios?: TerminalRatios;
} {
  let params: Partial<AssyParams> | undefined;
  const terminalRatios: TerminalRatios = {};

  const isMetaKeyAssy = (h: string) =>
    h === 'ASSY NO' || h === 'ASSY NUMBER' || h === 'NO ASSY' || h.startsWith('ASSY NO ');
  const isMetaKeyCct = (h: string) =>
    h.includes('JML CCT') ||
    h.includes('JUMLAH CCT') ||
    h.includes('QTY CCT') ||
    h.includes('CCT QTY') ||
    h.includes('TOTAL CCT') ||
    h.includes('MASTER CCT') ||
    h === 'CCT';
  const isMetaKeyPfd = (h: string) => h.includes('ALLOWANCE') || h.includes('PFD');
  const isMetaKeyCust = (h: string) => h === 'CUSTOMER' || h.includes('CUSTOMER');
  const isMetaKeyMode = (h: string) => h.includes('METODE');

  const isAnyMetaLabel = (h: string) =>
    !h ||
    h === ':' ||
    h === '=' ||
    isMetaKeyAssy(h) ||
    isMetaKeyCct(h) ||
    isMetaKeyPfd(h) ||
    isMetaKeyCust(h) ||
    isMetaKeyMode(h) ||
    h === 'ASSY NAME' ||
    h === 'PART NAME' ||
    h === 'MODEL' ||
    h === 'DATE' ||
    h === 'TANGGAL' ||
    h === 'REV' ||
    h === 'REVISI' ||
    h === 'NO' ||
    h === 'PART NO' ||
    h === 'PART NUMBER';

  const pickValFromCols = (valRow: unknown[], cols: number[]): string => {
    for (const c of cols) {
      if (c >= 0 && valRow[c] !== undefined) {
        const s = String(valRow[c]).trim();
        if (!isInvalidCellValue(s) && !isAnyMetaLabel(normalizeHeaderLabel(s))) return s;
      }
    }
    return '';
  };

  const applyMode = (target: Partial<AssyParams>, modeStr: string) => {
    const m = modeStr.toLowerCase();
    if (m.includes('hasil') || m.includes('final') || m.startsWith('2')) {
      target.allowanceMode = 'by_final' as AllowanceMode;
    } else if (m.includes('proses') || m.includes('process') || m.startsWith('1')) {
      target.allowanceMode = 'by_process' as AllowanceMode;
    }
  };

  const verticalExtracted: Partial<AssyParams> = {};
  const scanLimit = Math.min(grid.length, 40);

  // 1A. Vertical key-value metadata scan (e.g. PL NEW ASSY: "ASSY NO | : | KHR55471-00", "CUSTOMER | : | SUMITOMO", "QTY CCT | : | 304")
  for (let r = 0; r < scanLimit; r++) {
    const row = grid[r] || [];
    const norm = row.map((c) => normalizeHeaderLabel(c));
    // Stop once we reach the BOM / Part List table header
    if (norm.some((h) => isPartNoHeader(h)) && norm.some((h) => isPartNameHeader(h))) {
      break;
    }

    for (let c = 0; c < row.length; c++) {
      const rawCell = String(row[c] ?? '').trim();
      if (!rawCell) continue;

      // Support inline "ASSY NO : KHR55471-00" or separated "ASSY NO | : | KHR55471-00"
      let keyNorm = norm[c];
      let inlineVal = '';
      const colonPos = rawCell.indexOf(':');
      if (colonPos > 0) {
        keyNorm = normalizeHeaderLabel(rawCell.slice(0, colonPos));
        inlineVal = rawCell.slice(colonPos + 1).trim();
      }

      const isAssy = isMetaKeyAssy(keyNorm);
      const isCust = isMetaKeyCust(keyNorm);
      const isCct = isMetaKeyCct(keyNorm);
      const isPfd = isMetaKeyPfd(keyNorm);
      const isMode = isMetaKeyMode(keyNorm);
      if (!isAssy && !isCust && !isCct && !isPfd && !isMode) continue;

      // Check if row r is horizontal table header (2+ distinct metadata keys on same row with no ":" separator)
      let otherHeaderKeysOnRow = 0;
      let hasColonToRight = colonPos > 0;
      for (let k = c + 1; k < Math.min(row.length, c + 8); k++) {
        const rk = String(row[k] ?? '').trim();
        if (rk === ':' || rk === '=') {
          hasColonToRight = true;
          break;
        }
        const nk = norm[k];
        if (nk && (isMetaKeyAssy(nk) || isMetaKeyCust(nk) || isMetaKeyCct(nk) || isMetaKeyPfd(nk) || isMetaKeyMode(nk))) {
          otherHeaderKeysOnRow++;
        }
      }

      // Check if cell directly below is another vertical label (strong signal for vertical layout even without ":")
      const belowNorm = normalizeHeaderLabel(grid[r + 1]?.[c]);
      const belowIsLabel = Boolean(belowNorm) && isAnyMetaLabel(belowNorm);

      if (!hasColonToRight && otherHeaderKeysOnRow > 0 && !belowIsLabel) continue;

      let foundVal = inlineVal;
      if (!foundVal) {
        for (let k = c + 1; k < Math.min(row.length, c + 12); k++) {
          const cand = String(row[k] ?? '').trim();
          if (!cand || cand === ':' || cand === '=') continue;
          const candNorm = normalizeHeaderLabel(cand);
          if (isAnyMetaLabel(candNorm)) break;
          if (!isInvalidCellValue(cand)) {
            foundVal = cand;
            break;
          }
        }
      }

      if (!foundVal) continue;

      if (isAssy && !verticalExtracted.assyNo) {
        verticalExtracted.assyNo = foundVal;
      } else if (isCust && !verticalExtracted.customer) {
        verticalExtracted.customer = foundVal;
      } else if (isCct && !verticalExtracted.masterCct) {
        const cNum = parseNumeric(foundVal);
        if (cNum > 0) verticalExtracted.masterCct = Math.round(cNum);
      } else if (isPfd && verticalExtracted.pfdAllowancePct === undefined) {
        verticalExtracted.pfdAllowancePct = parsePercentValue(foundVal);
      } else if (isMode && !verticalExtracted.allowanceMode) {
        applyMode(verticalExtracted, foundVal);
      }
    }
  }

  // 1B. Horizontal table header detection matching both template_umh ("Assy No.", "Jml CCT", "Allowance PFD Tolerance (%)")
  // and Engineering PL_REV ("CUSTOMER", "ASS'Y NO", "JML CCT")
  const horizontalExtracted: Partial<AssyParams> = {};
  for (let r = 0; r < Math.min(grid.length, 30); r++) {
    const row = grid[r] || [];
    const norm = row.map((c) => normalizeHeaderLabel(c));
    if (norm.some((h) => isPartNoHeader(h)) && norm.some((h) => isPartNameHeader(h))) {
      break;
    }

    const assyCols: number[] = [];
    const cctCols: number[] = [];
    const pfdCols: number[] = [];
    const custCols: number[] = [];
    const modeCols: number[] = [];

    for (let c = 0; c < norm.length; c++) {
      const h = norm[c];
      if (!h) continue;
      if (isMetaKeyAssy(h)) assyCols.push(c);
      if (isMetaKeyCct(h)) cctCols.push(c);
      if (isMetaKeyPfd(h)) pfdCols.push(c);
      if (isMetaKeyCust(h)) custCols.push(c);
      if (isMetaKeyMode(h)) modeCols.push(c);
    }

    if (assyCols.length > 0 || cctCols.length > 0 || pfdCols.length > 0) {
      const valRow = grid[r + 1] || [];
      const extracted: Partial<AssyParams> = {};

      const a = pickValFromCols(valRow, assyCols);
      if (a) extracted.assyNo = a;

      const cStr = pickValFromCols(valRow, cctCols);
      if (cStr) {
        const cNum = parseNumeric(cStr);
        if (cNum > 0) extracted.masterCct = Math.round(cNum);
      }

      const pfdStr = pickValFromCols(valRow, pfdCols);
      if (pfdStr) {
        extracted.pfdAllowancePct = parsePercentValue(pfdStr);
      }

      const cu = pickValFromCols(valRow, custCols);
      if (cu) extracted.customer = cu;

      const modeStr = pickValFromCols(valRow, modeCols);
      if (modeStr) {
        applyMode(extracted, modeStr);
      }

      if (Object.keys(extracted).length > 0) {
        Object.assign(horizontalExtracted, extracted);
        break;
      }
    }
  }

  const merged: Partial<AssyParams> = {
    ...horizontalExtracted,
    ...verticalExtracted,
  };
  if (Object.keys(merged).length > 0) {
    params = merged;
  }

  // Fallback for legacy multi-sheet Part Master format (row index 5: col 1 = assyNo, col 6 = masterCct)
  if (!params && grid[5]) {
    const legacyAssy = String(grid[5][1] || '').trim();
    const legacyCct = parseNumeric(grid[5][6]);
    const validLegacyAssy =
      !isInvalidCellValue(legacyAssy) && !isAnyMetaLabel(normalizeHeaderLabel(legacyAssy));
    if (validLegacyAssy || legacyCct > 0) {
      params = {
        ...(validLegacyAssy ? { assyNo: legacyAssy } : {}),
        ...(legacyCct > 0 ? { masterCct: Math.round(legacyCct) } : {}),
      };
    }
  }

  // 2. Scan for Auto-Cut Terminal Ratio configuration table if present
  for (let r = 0; r < Math.min(grid.length, 60); r++) {
    const norm = (grid[r] || []).map((c) => normalizeHeaderLabel(c));
    const termCol = norm.findIndex(
      (h) => h === 'TERMINAL' || h === 'PART NO TERMINAL' || h === 'NO PART TERMINAL'
    );
    const ratioCol = norm.findIndex((h) => h.includes('RASIO') || h.includes('RATIO'));
    if (termCol >= 0 && ratioCol >= 0) {
      for (let rr = r + 1; rr < grid.length; rr++) {
        const row = grid[rr] || [];
        const term = normalizePartNumber(row[termCol]).toUpperCase();
        if (!term) break;
        const pct = parsePercentValue(row[ratioCol]);
        terminalRatios[term] = pct;
      }
      break;
    }
  }

  return {
    params,
    terminalRatios: Object.keys(terminalRatios).length > 0 ? terminalRatios : undefined,
  };
}

export type DetectedTemplateFormat = 'full_template' | 'pl_rev' | 'part_master_only' | 'partial';

export interface MasterWorkbookParseResult {
  params?: Partial<AssyParams>;
  assemblyComponents?: Partial<AssemblyComponents>;
  partList?: PartListItem[];
  ppcsList?: PpcsWireItem[];
  assemblyCotList?: AssemblyCotItem[];
  terminalRatios?: TerminalRatios;
  detectedSheets: string[];
  plSheetName?: string;
  ppcsSheetName?: string;
  detectedFormat: DetectedTemplateFormat;
  missingSections: ('partList' | 'ppcs' | 'assemblyCot')[];
}

function isOldSheetName(name: string): boolean {
  const n = name.trim().toLowerCase();
  return /\bold\b|pl[\s_-]*old|old[\s_-]*assy|old[\s_-]*pl|lama|before/i.test(n);
}

function isPlNewAssySheetName(name: string): boolean {
  const n = name.trim().toLowerCase();
  if (isOldSheetName(n)) return false;
  if (/pl[\s_-]*new[\s_-]*assy/i.test(n) || /^pl[\s_-]*new\b/i.test(n)) return true;
  if (n.includes('new') && (n.includes('pl') || n.includes('part list') || n.includes('partlist'))) {
    return true;
  }
  return false;
}

function isPartListSheetName(name: string): boolean {
  const n = name.trim().toLowerCase();
  if (isOldSheetName(n)) return false;
  if (n.includes('ppcs') || n.includes('assembly')) return false;
  if (isPlNewAssySheetName(n)) return true;
  const compact = n.replace(/[\s_-]+/g, '');
  if (compact === 'partlist' || compact === 'pl' || compact === 'bom') return true;
  if (/^pl[\s_-]*rev/i.test(n) || /[\s_-]pl[\s_-]*rev/i.test(n) || n.includes('part list')) {
    return true;
  }
  return false;
}

function findBestPartListSheet(
  sheetNames: string[],
  getGrid: (name: string) => unknown[][]
): string | undefined {
  const activeSheets = sheetNames.filter((s) => !isOldSheetName(s));

  // Priority 1: Explicit "PL NEW ASSY" / "PL NEW"
  const plNew = activeSheets.find((s) => isPlNewAssySheetName(s));
  if (plNew) return plNew;

  // Priority 2: Standard PART LIST / PL / BOM sheet name (excluding PL OLD ASSY)
  const byName = activeSheets.find((s) => isPartListSheetName(s));
  if (byName) return byName;

  // Priority 3: Content scan across non-old, non-ppcs, non-assembly sheets
  for (const name of activeSheets) {
    const low = name.toLowerCase();
    if (low.includes('ppcs') || low.includes('assembly')) continue;
    if (detectPartListHeader(getGrid(name))) return name;
  }
  return undefined;
}

function findBestPpcsSheet(
  sheetNames: string[],
  getGrid: (name: string) => unknown[][]
): string | undefined {
  const activeSheets = sheetNames.filter((s) => !isOldSheetName(s));
  const pool = activeSheets.length > 0 ? activeSheets : sheetNames;

  // Priority 1: PPCS NEW
  const ppcsNew = pool.find(
    (s) => s.toLowerCase().includes('ppcs') && s.toLowerCase().includes('new')
  );
  if (ppcsNew) return ppcsNew;

  // Priority 2: Any sheet containing "ppcs" (ignoring old sheets)
  const ppcsByName = pool.find((s) => s.toLowerCase().includes('ppcs'));
  if (ppcsByName) return ppcsByName;

  // Priority 3: Wire list / Circuit list sheet name
  const wireByName = pool.find((s) => {
    const low = s.toLowerCase();
    return low.includes('wire list') || low.includes('wirelist') || low.includes('circuit');
  });
  if (wireByName) return wireByName;

  // Priority 4: Content scan across non-old, non-assembly sheets
  for (const name of pool) {
    const low = name.toLowerCase();
    if (low.includes('assembly')) continue;
    if (detectPpcsHeader(getGrid(name))) return name;
  }
  return undefined;
}

export async function parseMasterWorkbook(
  file: File,
  aclList: AutoCutItem[],
  flList: FeederItem[]
): Promise<MasterWorkbookParseResult> {
  const isCsv = file.name.toLowerCase().endsWith('.csv');
  const sheetsMap = new Map<string, string[][]>();
  let sheetNames: string[] = [];

  if (isCsv) {
    const text = await file.text();
    await yieldToMain();
    const grid = parseCsvTextToGrid(text);
    sheetNames = ['CSV'];
    sheetsMap.set('CSV', grid);
  } else {
    const buf = await file.arrayBuffer();
    await yieldToMain();
    const wb = XLSX.read(new Uint8Array(buf), {
      type: 'array',
      cellStyles: false,
      cellHTML: false,
      cellNF: false,
    });
    sheetNames = wb.SheetNames;
    for (const name of sheetNames) {
      // Skip loading PL OLD ASSY completely to save memory and prevent wrong data extraction
      if (isOldSheetName(name) && sheetNames.length > 1) continue;
      sheetsMap.set(name, sheetToSafeGrid(wb.Sheets[name]));
      await yieldToMain();
    }
  }

  const getGrid = (name: string) => sheetsMap.get(name) || [];

  const result: MasterWorkbookParseResult = {
    detectedSheets: sheetNames,
    detectedFormat: 'partial',
    missingSections: [],
  };

  // 1. Part Master (dedicated non-old sheet OR single-sheet CSV/XLSX template)
  const pmdSheetName =
    sheetNames.find((s) => !isOldSheetName(s) && s.toLowerCase().includes('part master')) ||
    (sheetNames.length === 1 ? sheetNames[0] : undefined);
  if (pmdSheetName) {
    const pmdGrid = getGrid(pmdSheetName);
    const { params, terminalRatios } = parsePartMasterFromGrid(pmdGrid);
    if (params) result.params = params;
    if (terminalRatios) result.terminalRatios = terminalRatios;
  }

  // 2. PART LIST (strictly prioritizes PL NEW ASSY and ignores PL OLD ASSY)
  let parsedPl: PartListItem[] = [];
  let isPlRevDetected = false;
  const plSheetName = findBestPartListSheet(sheetNames, getGrid);

  if (plSheetName) {
    result.plSheetName = plSheetName;
    const plGrid = getGrid(plSheetName);
    const headerInfo = detectPartListHeader(plGrid);
    if (headerInfo?.isPlRevFormat || isPlNewAssySheetName(plSheetName)) {
      isPlRevDetected = true;
    }

    // Harvest Part Master metadata (CUSTOMER, ASS'Y NO, JML CCT) from PL NEW ASSY if missing
    const plMeta = parsePartMasterFromGrid(plGrid);
    if (plMeta.params) {
      result.params = {
        ...plMeta.params,
        ...(result.params ?? {}),
      };
    }

    parsedPl = parsePartListFromGrid(plGrid, aclList, flList);
    if (parsedPl.length > 0) result.partList = parsedPl;
  }

  await yieldToMain();

  // 3. PPCS (dynamic multi-row header & strict circuit count matching JML CCT)
  const ppcsSheetName = findBestPpcsSheet(sheetNames, getGrid);
  if (ppcsSheetName) {
    result.ppcsSheetName = ppcsSheetName;
    const ppcsGrid = getGrid(ppcsSheetName);
    const ppcsMeta = parsePartMasterFromGrid(ppcsGrid);
    if (ppcsMeta.params) {
      result.params = {
        ...ppcsMeta.params,
        ...(result.params ?? {}),
      };
    }
    const fallbackAssy = result.params?.assyNo || parsedPl[0]?.assyNo || '';
    const parsedPpcs = parsePpcsFromGrid(ppcsGrid, parsedPl, aclList, flList, fallbackAssy);
    if (parsedPpcs.length > 0) {
      result.ppcsList = parsedPpcs;
      if (!result.params?.masterCct) {
        result.params = {
          ...(result.params ?? {}),
          masterCct: parsedPpcs.length,
        };
      }
    }
  }

  await yieldToMain();

  // 4. Assembly COT
  const asmSheetName = sheetNames.find(
    (s) => !isOldSheetName(s) && s.toLowerCase().includes('assembly')
  );
  if (asmSheetName) {
    const asmGrid = getGrid(asmSheetName);
    const parsedCot = parseDrawingFromGrid(asmGrid);
    if (parsedCot.length > 0) result.assemblyCotList = parsedCot;
    const nsVal =
      (asmGrid[17] && parseFloat(String(asmGrid[17][7] || ''))) ||
      (asmGrid[16] && parseFloat(String(asmGrid[16][7] || ''))) ||
      0;
    if (nsVal > 0) {
      result.assemblyComponents = { spotTapeQty: nsVal };
    }
  } else if (sheetNames.length === 1 && !isPlRevDetected) {
    const singleGrid = getGrid(sheetNames[0]);
    const hasTypeHeader = singleGrid.slice(0, 60).some((row) => {
      const u = row.map((c) => normalizeHeaderLabel(c));
      return u.includes('TYPE') && (u.includes('TL') || u.length <= 4);
    });
    if (hasTypeHeader) {
      const parsedCot = parseDrawingFromGrid(singleGrid);
      if (parsedCot.length > 0) result.assemblyCotList = parsedCot;
    }
  }

  const hasPl = (result.partList?.length ?? 0) > 0;
  const hasPpcs = (result.ppcsList?.length ?? 0) > 0;
  const hasCot = (result.assemblyCotList?.length ?? 0) > 0;

  if (!hasPl) result.missingSections.push('partList');
  if (!hasPpcs) result.missingSections.push('ppcs');
  if (!hasCot) result.missingSections.push('assemblyCot');

  if (hasPl && hasPpcs && hasCot) {
    result.detectedFormat = 'full_template';
  } else if (isPlRevDetected) {
    result.detectedFormat = 'pl_rev';
  } else if (!hasPl && !hasPpcs && !hasCot && (result.params?.assyNo || result.params?.masterCct)) {
    result.detectedFormat = 'part_master_only';
  } else {
    result.detectedFormat = 'partial';
  }

  return result;
}

export async function parseSingleSheetGrid(
  file: File,
  targetType: 'pl' | 'ppcs' | 'dwg'
): Promise<unknown[][]> {
  if (file.name.toLowerCase().endsWith('.csv')) {
    const text = await file.text();
    await yieldToMain();
    return parseCsvTextToGrid(text);
  }

  const buf = await file.arrayBuffer();
  await yieldToMain();
  const wb = XLSX.read(new Uint8Array(buf), {
    type: 'array',
    cellStyles: false,
    cellHTML: false,
    cellNF: false,
  });
  const sheetNames: string[] = wb.SheetNames;
  const gridCache = new Map<string, string[][]>();
  const getGrid = (name: string) => {
    let g = gridCache.get(name);
    if (!g) {
      g = sheetToSafeGrid(wb.Sheets[name]);
      gridCache.set(name, g);
    }
    return g;
  };

  let targetSheet = sheetNames.find((s) => !isOldSheetName(s)) || sheetNames[0];
  if (targetType === 'pl') {
    targetSheet = findBestPartListSheet(sheetNames, getGrid) || targetSheet;
  } else if (targetType === 'ppcs') {
    targetSheet = findBestPpcsSheet(sheetNames, getGrid) || targetSheet;
  } else if (targetType === 'dwg') {
    targetSheet =
      sheetNames.find((s) => !isOldSheetName(s) && s.toLowerCase().includes('assembly')) ||
      targetSheet;
  }
  return getGrid(targetSheet);
}

export function reEnrichPayloadWithLists<
  T extends {
    partList: PartListItem[];
    ppcsList: PpcsWireItem[];
  }
>(payload: T, aclList: AutoCutItem[], flList: FeederItem[]): T {
  const aclLookup = buildAutoCutLookup(aclList);
  const flMap = buildFeederLookup(flList);

  const nextPartList = payload.partList.map((row) =>
    enrichPartListRowFast(
      row.customer,
      row.assyNo,
      row.partNumber,
      row.partName,
      row.qty,
      row.routingId,
      aclLookup,
      flMap
    )
  );

  const slvSet = buildSleeveSet(nextPartList);

  const nextPpcsList = payload.ppcsList.map((row) => {
    const isShield =
      row.colour === '' || (row.colour.length >= 2 && row.colour[1].toUpperCase() === 'C');

    const lookupAcl = (t: string) => {
      if (!t || isShield) return '';
      return aclLookup.allMap.get(t.trim().toLowerCase()) || '';
    };
    const lookupFl = (a: string) => {
      if (!a || isShield) return '';
      return flMap.get(a.trim().toLowerCase()) || '';
    };
    const lookupSlv = (a: string) => {
      if (!a) return '';
      return slvSet.has(a.trim().toLowerCase()) ? 'Sleeve' : '';
    };

    const rAf = lookupFl(row.accR1) === 'auto feeder' || lookupFl(row.accR2) === 'auto feeder';
    const fAf = lookupFl(row.accF1) === 'auto feeder' || lookupFl(row.accF2) === 'auto feeder';

    const trUp = row.termR.toUpperCase();
    const tfUp = row.termF.toUpperCase();
    const rawAclR = lookupAcl(row.termR) === 'auto cut';
    const rawAclF = lookupAcl(row.termF) === 'auto cut';

    const validAclR = CONDITIONAL_AC_TERMS.has(trUp) ? rawAclR && rAf : rawAclR;
    const validAclF = CONDITIONAL_AC_TERMS.has(tfUp) ? rawAclF && fAf : rawAclF;

    const rAc = !isShield && (validAclR || rAf);
    const fAc = !isShield && (validAclF || fAf);

    return {
      ...row,
      isShield,
      rAf,
      fAf,
      rAc,
      fAc,
      af: lookupSlv(row.accR1),
      ag: lookupSlv(row.accF1),
    };
  });

  return {
    ...payload,
    partList: nextPartList,
    ppcsList: nextPpcsList,
  };
}

/**
 * Download blank CSV template matching /public/assets/aistudio/template_umh_f54bc004.csv
 */
export function downloadUmhTemplateCsv(): void {
  const csvContent = [
    'PART MASTER DATA & KONFIGURASI RASIO AUTO-CUT TERMINAL,,,,,,,,',
    ',,,,,,,,',
    ',,,,,,,,',
    'Assy No.,Jml CCT,Allowance PFD Tolerance (%),Customer,Metode Allowance,,,,',
    ',,15.0%,,by_process,,,,',
  ].join('\r\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Template_UMH_Wire_Harness.csv';
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Download styled XLSX template with Part Master (matching template_umh CSV),
 * PART LIST, PPCS, and Assembly COT sheets.
 */
export function downloadUmhTemplateXlsx(): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Part Master
  const wsMaster = XLSX.utils.aoa_to_sheet([
    ['PART MASTER DATA & KONFIGURASI RASIO AUTO-CUT TERMINAL'],
    [],
    [],
    ['Assy No.', 'Jml CCT', 'Allowance PFD Tolerance (%)', 'Customer', 'Metode Allowance'],
    ['', '', '15.0%', '', 'by_process'],
    [],
    ['KONFIGURASI RASIO AUTO-CUT TERMINAL (OPSIONAL)'],
    ['Terminal', 'Rasio (%)'],
    ['', '100%'],
  ]);
  wsMaster['!cols'] = [
    { wch: 24 },
    { wch: 14 },
    { wch: 28 },
    { wch: 18 },
    { wch: 18 },
  ];
  XLSX.utils.book_append_sheet(wb, wsMaster, 'Part Master');

  // Sheet 2: PART LIST
  const wsPartList = XLSX.utils.aoa_to_sheet([
    ['No', 'Customer', 'Assy Number', 'Part Number', 'Part Name', 'Qty', 'Routing ID'],
  ]);
  wsPartList['!cols'] = [
    { wch: 6 },
    { wch: 16 },
    { wch: 18 },
    { wch: 20 },
    { wch: 18 },
    { wch: 10 },
    { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, wsPartList, 'PART LIST');

  // Sheet 3: PPCS
  const wsPpcs = XLSX.utils.aoa_to_sheet([
    [
      'No',
      'Assy No',
      'CCT No',
      'Kind',
      'Size',
      'Colour',
      'C/L',
      'From',
      'To',
      'Joint No',
      'Twist',
      'Tube R',
      'Tube F',
      'HD',
      'SD',
      'Terminal R',
      'Marker R',
      'DC R',
      'Acc R1',
      'Acc R2',
      'Terminal F',
      'Marker F',
      'Acc F1',
      'Acc F2',
      'DC F',
    ],
  ]);
  wsPpcs['!cols'] = Array(25).fill({ wch: 13 });
  XLSX.utils.book_append_sheet(wb, wsPpcs, 'PPCS');

  // Sheet 4: Assembly
  const wsAssembly = XLSX.utils.aoa_to_sheet([
    ['Type', 'TL', 'Keterangan (C = COT, T = Taping, B = Bare)'],
  ]);
  wsAssembly['!cols'] = [{ wch: 10 }, { wch: 14 }, { wch: 36 }];
  XLSX.utils.book_append_sheet(wb, wsAssembly, 'Assembly');

  XLSX.writeFile(wb, 'Template_UMH_Wire_Harness.xlsx');
}

export interface ParsedMasterListResult<T> {
  items: T[];
  sheetName: string;
  skippedCount: number;
}

async function readFileToCandidateGrids(
  file: File,
  preferredSheetRegex: RegExp
): Promise<{ sheetName: string; grid: string[][] }> {
  const ext = file.name.toLowerCase();
  if (ext.endsWith('.csv') || ext.endsWith('.txt')) {
    const text = await file.text();
    return { sheetName: file.name, grid: parseCsvTextToGrid(text) };
  }

  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheetNames: string[] = wb.SheetNames || [];
  if (sheetNames.length === 0) {
    return { sheetName: '', grid: [] };
  }

  const preferred =
    sheetNames.find((name) => !isOldSheetName(name) && preferredSheetRegex.test(name)) ||
    sheetNames.find((name) => !isOldSheetName(name)) ||
    sheetNames[0];

  const primaryGrid = sheetToSafeGrid(wb.Sheets[preferred]);
  if (primaryGrid.length > 0) {
    return { sheetName: preferred, grid: primaryGrid };
  }

  for (const name of sheetNames) {
    const g = sheetToSafeGrid(wb.Sheets[name]);
    if (g.length > 0) {
      return { sheetName: name, grid: g };
    }
  }
  return { sheetName: preferred, grid: [] };
}

function normalizeHeaderCell(val: string): string {
  return val
    .trim()
    .toLowerCase()
    .replace(/[\r\n]+/g, ' ')
    .replace(/[._\-/()]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isMasterHeaderOrNoiseValue(val: string): boolean {
  const norm = normalizeHeaderCell(val);
  if (!norm || norm === '-' || norm === '--' || norm === 'n a' || norm === 'na' || norm === 'none') {
    return true;
  }
  return (
    norm === 'no' ||
    norm === 'total' ||
    norm === 'jumlah' ||
    norm === 'subtotal' ||
    norm === 'terminal' ||
    norm === 'item terminal' ||
    norm === 'seal' ||
    norm === 'item seal' ||
    norm === 'wire seal' ||
    norm === 'rubber seal' ||
    norm === 'part no' ||
    norm === 'part number' ||
    norm === 'customer' ||
    norm === 'proses' ||
    norm === 'process'
  );
}

function isPureSequenceColumn(rows: string[][], colIdx: number): boolean {
  const samples: string[] = [];
  for (let r = 0; r < rows.length && samples.length < 10; r++) {
    const v = (rows[r]?.[colIdx] || '').trim();
    if (v) samples.push(v);
  }
  if (samples.length < 2) return false;
  return samples.every((v, idx) => {
    if (!/^\d+$/.test(v)) return false;
    const n = Number(v);
    return n === idx + 1 || n <= rows.length + 5;
  });
}

function looksLikeCustomerCell(val: string): boolean {
  const trimmed = val.trim();
  if (!trimmed || trimmed.length > 32) return false;
  if (/^(all|cat|caterpillar|sumitomo|yazaki|honda|toyota|suzuki|daihatsu|mitsubishi|isuzu|hino|nissan|komatsu|kubota|kobelco|hitachi|yanmar)$/i.test(trimmed)) {
    return true;
  }
  // Customer names are typically alphabetic words without part-number digits/dashes
  return /^[a-zA-Z][a-zA-Z\s.&-]{1,24}$/.test(trimmed) && !/\d/.test(trimmed);
}

/**
 * Parse an uploaded Excel (.xlsx / .xls) or CSV file into AutoCutItem rows.
 * Supports headers (Customer, Item Terminal / Part No) as well as headerless 1-col or 2-col lists.
 */
export async function parseAutoCutExcelFile(
  file: File
): Promise<ParsedMasterListResult<AutoCutItem>> {
  const { sheetName, grid } = await readFileToCandidateGrids(
    file,
    /auto\s*[-_ ]?\s*cut|autocut|acl|terminal/i
  );

  if (grid.length === 0) {
    return { items: [], sheetName, skippedCount: 0 };
  }

  let headerRowIdx = -1;
  let termCol = -1;
  let custCol = -1;
  let procCol = -1;
  let noCol = -1;

  const scanLimit = Math.min(grid.length, 25);
  for (let r = 0; r < scanLimit; r++) {
    const row = grid[r] || [];
    let foundTerm = -1;
    let foundCust = -1;
    let foundProc = -1;
    let foundNo = -1;

    for (let c = 0; c < row.length; c++) {
      const h = normalizeHeaderCell(row[c] || '');
      if (!h) continue;
      if (
        foundTerm < 0 &&
        (h === 'item terminal' ||
          h === 'terminal' ||
          h === 'terminal no' ||
          h === 'terminal number' ||
          h === 'kode terminal' ||
          h === 'part no' ||
          h === 'part number' ||
          h === 'partno' ||
          h === 'item' ||
          h === 'item no' ||
          h === 'term' ||
          h.includes('terminal'))
      ) {
        foundTerm = c;
      } else if (
        foundCust < 0 &&
        (h === 'customer' ||
          h === 'cust' ||
          h === 'pelanggan' ||
          h === 'oem' ||
          h === 'client' ||
          h.includes('customer'))
      ) {
        foundCust = c;
      } else if (foundProc < 0 && (h === 'proses' || h === 'process')) {
        foundProc = c;
      } else if (foundNo < 0 && (h === 'no' || h === 'num' || h === 'nomor' || h === '#')) {
        foundNo = c;
      }
    }

    if (foundTerm >= 0) {
      headerRowIdx = r;
      termCol = foundTerm;
      custCol = foundCust;
      procCol = foundProc;
      noCol = foundNo;
      break;
    }
  }

  const startRow = headerRowIdx >= 0 ? headerRowIdx + 1 : 0;
  const dataRows = grid.slice(startRow);

  // Headerless fallback: infer active columns
  if (termCol < 0) {
    const colCounts = new Map<number, number>();
    for (const row of dataRows) {
      for (let c = 0; c < row.length; c++) {
        if ((row[c] || '').trim()) {
          colCounts.set(c, (colCounts.get(c) || 0) + 1);
        }
      }
    }
    const populatedCols = Array.from(colCounts.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([c]) => c)
      .filter((c) => !isPureSequenceColumn(dataRows, c));

    if (populatedCols.length === 1) {
      termCol = populatedCols[0];
    } else if (populatedCols.length >= 2) {
      const c0 = populatedCols[0];
      const c1 = populatedCols[1];
      let c0CustScore = 0;
      let sampleCount = 0;
      for (const row of dataRows.slice(0, 15)) {
        const v0 = (row[c0] || '').trim();
        const v1 = (row[c1] || '').trim();
        if (!v0 || !v1) continue;
        sampleCount++;
        if (looksLikeCustomerCell(v0)) c0CustScore++;
      }
      if (sampleCount > 0 && c0CustScore / sampleCount >= 0.5) {
        custCol = c0;
        termCol = c1;
      } else {
        termCol = c0;
      }
    }
  }

  if (termCol < 0) {
    return { items: [], sheetName, skippedCount: dataRows.length };
  }

  const seen = new Set<string>();
  const items: AutoCutItem[] = [];
  let skippedCount = 0;
  const stamp = Date.now();

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i] || [];
    const rawTerm = (row[termCol] || '').trim();
    if (!rawTerm || isMasterHeaderOrNoiseValue(rawTerm)) {
      if (row.some((cell) => (cell || '').trim() !== '')) skippedCount++;
      continue;
    }

    // Avoid accidentally importing a pure process label if columns shifted
    if (procCol >= 0 && termCol === procCol) {
      skippedCount++;
      continue;
    }
    if (noCol >= 0 && termCol === noCol) {
      skippedCount++;
      continue;
    }

    const rawCust = custCol >= 0 ? (row[custCol] || '').trim() : '';
    const customer =
      rawCust && !isMasterHeaderOrNoiseValue(rawCust) ? rawCust.slice(0, 48) : 'All';
    const terminal = rawTerm.slice(0, 80);
    const dedupeKey = `${customer.toLowerCase()}||${terminal.toLowerCase()}`;
    if (seen.has(dedupeKey)) {
      skippedCount++;
      continue;
    }
    seen.add(dedupeKey);

    items.push({
      id: `acl_${stamp}_${items.length + 1}`,
      customer,
      terminal,
      process: 'auto cut',
    });
  }

  return { items, sheetName, skippedCount };
}

/**
 * Parse an uploaded Excel (.xlsx / .xls) or CSV file into FeederItem rows.
 * Supports headers (Item Seal / Wire Seal / Part No) as well as headerless 1-col or No+Seal lists.
 */
export async function parseFeederExcelFile(
  file: File
): Promise<ParsedMasterListResult<FeederItem>> {
  const { sheetName, grid } = await readFileToCandidateGrids(
    file,
    /feeder|wire\s*seal|rubber\s*seal|seal|\bfl\b/i
  );

  if (grid.length === 0) {
    return { items: [], sheetName, skippedCount: 0 };
  }

  let headerRowIdx = -1;
  let sealCol = -1;

  const scanLimit = Math.min(grid.length, 25);
  for (let r = 0; r < scanLimit; r++) {
    const row = grid[r] || [];
    for (let c = 0; c < row.length; c++) {
      const h = normalizeHeaderCell(row[c] || '');
      if (!h) continue;
      if (
        h === 'item seal' ||
        h === 'wire seal' ||
        h === 'rubber seal' ||
        h === 'seal' ||
        h === 'seal no' ||
        h === 'seal number' ||
        h === 'kode seal' ||
        h === 'part no' ||
        h === 'part number' ||
        h === 'partno' ||
        h === 'item' ||
        h === 'item no' ||
        h.includes('seal')
      ) {
        headerRowIdx = r;
        sealCol = c;
        break;
      }
    }
    if (sealCol >= 0) break;
  }

  const startRow = headerRowIdx >= 0 ? headerRowIdx + 1 : 0;
  const dataRows = grid.slice(startRow);

  if (sealCol < 0) {
    const colCounts = new Map<number, number>();
    for (const row of dataRows) {
      for (let c = 0; c < row.length; c++) {
        if ((row[c] || '').trim()) {
          colCounts.set(c, (colCounts.get(c) || 0) + 1);
        }
      }
    }
    const populatedCols = Array.from(colCounts.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([c]) => c)
      .filter((c) => !isPureSequenceColumn(dataRows, c));

    if (populatedCols.length > 0) {
      sealCol = populatedCols[0];
    }
  }

  if (sealCol < 0) {
    return { items: [], sheetName, skippedCount: dataRows.length };
  }

  const seen = new Set<string>();
  const items: FeederItem[] = [];
  let skippedCount = 0;
  const stamp = Date.now();

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i] || [];
    const rawSeal = (row[sealCol] || '').trim();
    if (!rawSeal || isMasterHeaderOrNoiseValue(rawSeal)) {
      if (row.some((cell) => (cell || '').trim() !== '')) skippedCount++;
      continue;
    }

    const seal = rawSeal.slice(0, 80);
    const dedupeKey = seal.toLowerCase();
    if (seen.has(dedupeKey)) {
      skippedCount++;
      continue;
    }
    seen.add(dedupeKey);

    items.push({
      id: `fl_${stamp}_${items.length + 1}`,
      seal,
      process: 'auto feeder',
    });
  }

  return { items, sheetName, skippedCount };
}

/**
 * Download Auto Cutting List as an editable XLSX template (without Process column).
 */
export function exportAutoCutTemplateXlsx(currentList: AutoCutItem[] = []): void {
  const wb = XLSX.utils.book_new();
  const rows: (string | number)[][] = [['Customer', 'Item Terminal']];
  if (currentList.length > 0) {
    currentList.forEach((item) => {
      rows.push([item.customer || 'All', item.terminal]);
    });
  } else {
    rows.push(['CAT', '1062-16-0122'], ['All', '8240-4242'], ['All', '7116-1301']);
  }
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 16 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Auto Cutting List');
  XLSX.writeFile(wb, 'Database_Auto_Cutting_List.xlsx');
}

/**
 * Download Feeder List (Wire Seal) as an editable XLSX template (without Process column).
 */
export function exportFeederTemplateXlsx(currentList: FeederItem[] = []): void {
  const wb = XLSX.utils.book_new();
  const rows: (string | number)[][] = [['Item Seal']];
  if (currentList.length > 0) {
    currentList.forEach((item) => {
      rows.push([item.seal]);
    });
  } else {
    rows.push(['1-900325-9'], ['2822352-1'], ['7157-3790-90']);
  }
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 28 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Feeder List');
  XLSX.writeFile(wb, 'Database_Feeder_List.xlsx');
}

