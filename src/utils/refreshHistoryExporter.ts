import XLSX from 'xlsx-js-style';
import { RefreshHistoryEntry } from '../types/umh';

const BORDER_THIN = {
  top: { style: 'thin', color: { rgb: 'CBD5E1' } },
  bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
  left: { style: 'thin', color: { rgb: 'CBD5E1' } },
  right: { style: 'thin', color: { rgb: 'CBD5E1' } },
};

const sBanner = {
  font: { name: 'Inter', sz: 13, bold: true, color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: '0F172A' } },
  alignment: { vertical: 'center', horizontal: 'left' },
};

const sSubBanner = {
  font: { name: 'Inter', sz: 10, color: { rgb: 'E2E8F0' } },
  fill: { fgColor: { rgb: '1E3A8A' } },
  alignment: { vertical: 'center', horizontal: 'left' },
};

const sMetaLbl = {
  font: { name: 'Inter', sz: 9, bold: true, color: { rgb: '475569' } },
  fill: { fgColor: { rgb: 'F1F5F9' } },
  border: BORDER_THIN,
  alignment: { vertical: 'center', horizontal: 'left' },
};

const sMetaVal = {
  font: { name: 'Inter', sz: 10, bold: true, color: { rgb: '0F172A' } },
  fill: { fgColor: { rgb: 'F8FAFC' } },
  border: BORDER_THIN,
  alignment: { vertical: 'center', horizontal: 'left' },
};

const sTh = {
  font: { name: 'Inter', sz: 10, bold: true, color: { rgb: '1E293B' } },
  fill: { fgColor: { rgb: 'E2E8F0' } },
  border: { ...BORDER_THIN, bottom: { style: 'medium', color: { rgb: '94A3B8' } } },
  alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
};

const sCellText = (zebra = false, bold = false) => ({
  font: { name: 'Inter', sz: 10, bold, color: { rgb: '0F172A' } },
  fill: { fgColor: { rgb: zebra ? 'F8FAFC' : 'FFFFFF' } },
  border: BORDER_THIN,
  alignment: { vertical: 'center', horizontal: 'left', wrapText: true },
});

const sCellCenter = (zebra = false, bold = false, colorRgb = '475569') => ({
  font: { name: 'Inter', sz: 10, bold, color: { rgb: colorRgb } },
  fill: { fgColor: { rgb: zebra ? 'F8FAFC' : 'FFFFFF' } },
  border: BORDER_THIN,
  alignment: { vertical: 'center', horizontal: 'center' },
});

const sCellNum = (fmt = '0.000', zebra = false, bold = false, colorRgb = '0F172A', bgRgb?: string) => ({
  font: { name: 'Inter', sz: 10, bold, color: { rgb: colorRgb } },
  fill: { fgColor: { rgb: bgRgb ?? (zebra ? 'F8FAFC' : 'FFFFFF') } },
  border: BORDER_THIN,
  alignment: { vertical: 'center', horizontal: 'right' },
  numFmt: fmt,
});

const sProcRowText = (bold = true) => ({
  font: { name: 'Inter', sz: 10, bold, color: { rgb: '1E3A8A' } },
  fill: { fgColor: { rgb: 'EFF6FF' } },
  border: BORDER_THIN,
  alignment: { vertical: 'center', horizontal: 'left', wrapText: true },
});

const sProcRowNum = (fmt = '0.000', colorRgb = '1E3A8A') => ({
  font: { name: 'Inter', sz: 10, bold: true, color: { rgb: colorRgb } },
  fill: { fgColor: { rgb: 'EFF6FF' } },
  border: BORDER_THIN,
  alignment: { vertical: 'center', horizontal: 'right' },
  numFmt: fmt,
});

function applyRowStyle(ws: any, rowIdx: number, stylesArr: any[]) {
  stylesArr.forEach((st, colIdx) => {
    const ref = XLSX.utils.encode_cell({ r: rowIdx, c: colIdx });
    if (!ws[ref]) ws[ref] = { t: 's', v: '' };
    ws[ref].s = st;
  });
}

export function formatRefreshDateTime(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  return dt.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function exportRefreshHistoryExcel(entry: RefreshHistoryEntry): void {
  const wb = XLSX.utils.book_new();
  const formattedTime = formatRefreshDateTime(entry.refreshedAt);

  // SHEET 1: RINGKASAN PERUBAHAN ASSY
  const sumAoa: any[][] = [
    ['LAPORAN RIWAYAT PERUBAHAN REFRESH UMH — STD / UMH WIRE HARNESS STUDIO', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    [
      `Waktu Refresh: ${formattedTime}  |  Penanggung Jawab (PIC): ${entry.responsibleName}  |  Log ID: ${entry.id}`,
      '', '', '', '', '', '', '', '', '', '', '', '', '',
    ],
    [],
    [
      'Tanggal & Waktu',
      formattedTime,
      'Penanggung Jawab',
      entry.responsibleName,
      'Assy Diproses',
      entry.totalSelectedCount,
      'Assy Terdampak',
      entry.affectedAssyCount,
      'Tidak Terdampak',
      entry.unaffectedAssyCount,
      '', '', '', '',
    ],
    [],
    [
      'No',
      'Assy Number',
      'Customer',
      'Metode Allowance',
      'Proses Terdampak',
      'Base Before (s)',
      'Base After (s)',
      'Selisih Base (s)',
      'Allow Before (s)',
      'Allow After (s)',
      'Selisih Allow (s)',
      'UMH Before (hr)',
      'UMH After (hr)',
      'Selisih UMH (hr)',
    ],
  ];

  if (entry.affectedDiffs.length === 0) {
    sumAoa.push([
      '-',
      'Tidak ada Assy terdampak perubahan pada eksekusi refresh ini.',
      '', '', '', 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ]);
  } else {
    entry.affectedDiffs.forEach((assy, idx) => {
      const deltaHr = assy.deltaAllowSec / 3600;
      sumAoa.push([
        idx + 1,
        assy.assyNo,
        assy.customer || '-',
        assy.allowanceMode === 'by_process' ? 'By Proses' : 'By Hasil Akhir',
        assy.processDiffs.length,
        Number(assy.beforeBaseSec.toFixed(3)),
        Number(assy.afterBaseSec.toFixed(3)),
        Number(assy.deltaBaseSec.toFixed(3)),
        Number(assy.beforeAllowSec.toFixed(3)),
        Number(assy.afterAllowSec.toFixed(3)),
        Number(assy.deltaAllowSec.toFixed(3)),
        Number((assy.beforeAllowSec / 3600).toFixed(5)),
        Number((assy.afterAllowSec / 3600).toFixed(5)),
        Number(deltaHr.toFixed(5)),
      ]);
    });
  }

  const wsSummary = XLSX.utils.aoa_to_sheet(sumAoa);
  wsSummary['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 13 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 13 } },
  ];
  wsSummary['!rows'] = [{ hpt: 28 }, { hpt: 20 }, { hpt: 8 }, { hpt: 22 }, { hpt: 8 }, { hpt: 28 }];
  wsSummary['!cols'] = [
    { wch: 6 },
    { wch: 22 },
    { wch: 16 },
    { wch: 17 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
  ];

  applyRowStyle(wsSummary, 0, Array(14).fill(sBanner));
  applyRowStyle(wsSummary, 1, Array(14).fill(sSubBanner));
  applyRowStyle(wsSummary, 3, [
    sMetaLbl,
    sMetaVal,
    sMetaLbl,
    sMetaVal,
    sMetaLbl,
    sMetaVal,
    sMetaLbl,
    sMetaVal,
    sMetaLbl,
    sMetaVal,
    sMetaLbl,
    sMetaLbl,
    sMetaLbl,
    sMetaLbl,
  ]);
  applyRowStyle(wsSummary, 5, Array(14).fill(sTh));

  entry.affectedDiffs.forEach((assy, idx) => {
    const rIdx = 6 + idx;
    const z = idx % 2 === 1;
    const baseColor = assy.deltaBaseSec >= 0 ? '047857' : 'DC2626';
    const allowColor = assy.deltaAllowSec >= 0 ? '047857' : 'DC2626';
    const baseBg = assy.deltaBaseSec >= 0 ? 'ECFDF5' : 'FEF2F2';
    const allowBg = assy.deltaAllowSec >= 0 ? 'ECFDF5' : 'FEF2F2';

    applyRowStyle(wsSummary, rIdx, [
      sCellCenter(z),
      sCellText(z, true),
      sCellText(z),
      sCellCenter(z),
      sCellNum('0', z),
      sCellNum('0.000', z),
      sCellNum('0.000', z, true),
      sCellNum('+0.000;-0.000;0.000', z, true, baseColor, baseBg),
      sCellNum('0.000', z),
      sCellNum('0.000', z, true),
      sCellNum('+0.000;-0.000;0.000', z, true, allowColor, allowBg),
      sCellNum('0.00000', z),
      sCellNum('0.00000', z, true),
      sCellNum('+0.00000;-0.00000;0.00000', z, true, allowColor, allowBg),
    ]);
  });

  XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan Perubahan');

  // SHEET 2: DETAIL PROSES & SUB-STEP TERDAMPAK
  const detAoa: any[][] = [
    ['DETAIL PERUBAHAN PROSES & SUB-STEP TERDAMPAK (BEFORE vs AFTER)', '', '', '', '', '', '', '', '', '', '', '', ''],
    [
      `Waktu Refresh: ${formattedTime}  |  Penanggung Jawab (PIC): ${entry.responsibleName}  |  Terdampak: ${entry.affectedAssyCount} Assy`,
      '', '', '', '', '', '', '', '', '', '', '', '',
    ],
    [],
    [
      'Assy Number',
      'Customer',
      'No Proses',
      'Nama Proses',
      'Tahapan',
      'Sub-Step Terdampak',
      'Basis',
      'Base Before (s)',
      'Base After (s)',
      'Selisih Base (s)',
      'Allow Before (s)',
      'Allow After (s)',
      'Selisih Allow (s)',
    ],
  ];

  const rowTypes: { type: 'proc' | 'sub'; deltaBase: number; deltaAllow: number }[] = [];

  entry.affectedDiffs.forEach((assy) => {
    assy.processDiffs.forEach((proc) => {
      detAoa.push([
        assy.assyNo,
        assy.customer || '-',
        proc.processId,
        `${proc.processName}${proc.jpName ? ` (${proc.jpName})` : ''}`,
        'TOTAL PROSES',
        `Ringkasan Proses #${proc.processId}`,
        '-',
        Number(proc.beforeBaseSec.toFixed(3)),
        Number(proc.afterBaseSec.toFixed(3)),
        Number(proc.deltaBaseSec.toFixed(3)),
        Number(proc.beforeAllowSec.toFixed(3)),
        Number(proc.afterAllowSec.toFixed(3)),
        Number(proc.deltaAllowSec.toFixed(3)),
      ]);
      rowTypes.push({
        type: 'proc',
        deltaBase: proc.deltaBaseSec,
        deltaAllow: proc.deltaAllowSec,
      });

      proc.subStepDiffs.forEach((sub) => {
        detAoa.push([
          assy.assyNo,
          assy.customer || '-',
          proc.processId,
          proc.processName,
          sub.stage,
          sub.name,
          sub.basis,
          Number(sub.beforeBaseSec.toFixed(3)),
          Number(sub.afterBaseSec.toFixed(3)),
          Number(sub.deltaBaseSec.toFixed(3)),
          Number(sub.beforeAllowSec.toFixed(3)),
          Number(sub.afterAllowSec.toFixed(3)),
          Number(sub.deltaAllowSec.toFixed(3)),
        ]);
        rowTypes.push({
          type: 'sub',
          deltaBase: sub.deltaBaseSec,
          deltaAllow: sub.deltaAllowSec,
        });
      });
    });
  });

  if (rowTypes.length === 0) {
    detAoa.push([
      '-',
      '-',
      '-',
      'Tidak ada proses atau sub-step terdampak.',
      '-',
      '-',
      '-',
      0, 0, 0, 0, 0, 0,
    ]);
  }

  const wsDetail = XLSX.utils.aoa_to_sheet(detAoa);
  wsDetail['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 12 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 12 } },
  ];
  wsDetail['!rows'] = [{ hpt: 26 }, { hpt: 20 }, { hpt: 8 }, { hpt: 26 }];
  wsDetail['!cols'] = [
    { wch: 20 },
    { wch: 15 },
    { wch: 10 },
    { wch: 30 },
    { wch: 15 },
    { wch: 38 },
    { wch: 20 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
  ];

  applyRowStyle(wsDetail, 0, Array(13).fill(sBanner));
  applyRowStyle(wsDetail, 1, Array(13).fill(sSubBanner));
  applyRowStyle(wsDetail, 3, Array(13).fill(sTh));

  rowTypes.forEach((meta, idx) => {
    const rIdx = 4 + idx;
    const baseColor = meta.deltaBase >= 0 ? '047857' : 'DC2626';
    const allowColor = meta.deltaAllow >= 0 ? '047857' : 'DC2626';

    if (meta.type === 'proc') {
      applyRowStyle(wsDetail, rIdx, [
        sProcRowText(true),
        sProcRowText(false),
        { ...sProcRowText(true), alignment: { vertical: 'center', horizontal: 'center' } },
        sProcRowText(true),
        { ...sProcRowText(true), alignment: { vertical: 'center', horizontal: 'center' } },
        sProcRowText(true),
        sProcRowText(false),
        sProcRowNum('0.000', '1E3A8A'),
        sProcRowNum('0.000', '1E3A8A'),
        sProcRowNum('+0.000;-0.000;0.000', baseColor),
        sProcRowNum('0.000', '1E3A8A'),
        sProcRowNum('0.000', '1E3A8A'),
        sProcRowNum('+0.000;-0.000;0.000', allowColor),
      ]);
    } else {
      const z = idx % 2 === 1;
      const baseBg = meta.deltaBase >= 0 ? 'ECFDF5' : 'FEF2F2';
      const allowBg = meta.deltaAllow >= 0 ? 'ECFDF5' : 'FEF2F2';

      applyRowStyle(wsDetail, rIdx, [
        sCellText(z),
        sCellText(z),
        sCellCenter(z),
        sCellText(z),
        sCellCenter(z, true, '1E3A8A'),
        sCellText(z),
        sCellText(z),
        sCellNum('0.000', z),
        sCellNum('0.000', z, true),
        sCellNum('+0.000;-0.000;0.000', z, true, baseColor, baseBg),
        sCellNum('0.000', z),
        sCellNum('0.000', z, true),
        sCellNum('+0.000;-0.000;0.000', z, true, allowColor, allowBg),
      ]);
    }
  });

  XLSX.utils.book_append_sheet(wb, wsDetail, 'Detail Proses & Sub-Step');

  const dateSlug = entry.refreshedAt.slice(0, 16).replace(/[:T]/g, '-');
  const picSlug = (entry.responsibleName || 'PIC').replace(/[^a-zA-Z0-9_-]/g, '_');
  XLSX.writeFile(wb, `Refresh_UMH_History_${dateSlug}_${picSlug}.xlsx`);
}
