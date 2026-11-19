import XLSX from 'xlsx-js-style';
import { getVariantResult } from '../engine/umhCalculator';
import { AllowanceMode, AssyRecord, CalculationVariant, UiLang } from '../types/umh';
import {
  translateBasis,
  translateProcessName,
  translateStage,
  translateSubStepName,
  translateSummaryNote,
} from './umhTranslator';

const BORDER_THIN = {
  top: { style: 'thin', color: { rgb: 'CBD5E1' } },
  bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
  left: { style: 'thin', color: { rgb: 'CBD5E1' } },
  right: { style: 'thin', color: { rgb: 'CBD5E1' } },
};

const sBanner = {
  font: { name: 'Inter', sz: 14, bold: true, color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: '0F172A' } },
  alignment: { vertical: 'center', horizontal: 'left' },
};

const sSubBanner = {
  font: { name: 'Inter', sz: 10, color: { rgb: 'E2E8F0' } },
  fill: { fgColor: { rgb: '1E3A8A' } },
  alignment: { vertical: 'center', horizontal: 'left' },
};

const sSectionReg = {
  font: { name: 'Inter', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: '1E3A8A' } },
  alignment: { vertical: 'center', horizontal: 'left' },
};

const sSectionSmv = {
  font: { name: 'Inter', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: '047857' } },
  alignment: { vertical: 'center', horizontal: 'left' },
};

const sMetaLbl = {
  font: { name: 'Inter', sz: 9, bold: true, color: { rgb: '475569' } },
  fill: { fgColor: { rgb: 'F1F5F9' } },
  border: BORDER_THIN,
  alignment: { vertical: 'center', horizontal: 'left' },
};

const sMetaVal = {
  font: { name: 'Inter', sz: 10, bold: true, color: { rgb: '007AFF' } },
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

const sCellText = (zebra = false, muted = false) => ({
  font: { name: 'Inter', sz: 10, color: { rgb: muted ? '94A3B8' : '0F172A' } },
  fill: { fgColor: { rgb: zebra ? 'F8FAFC' : 'FFFFFF' } },
  border: BORDER_THIN,
  alignment: { vertical: 'center', horizontal: 'left', wrapText: true },
});

const sCellCenter = (zebra = false, muted = false) => ({
  font: { name: 'Inter', sz: 10, color: { rgb: muted ? '94A3B8' : '475569' } },
  fill: { fgColor: { rgb: zebra ? 'F8FAFC' : 'FFFFFF' } },
  border: BORDER_THIN,
  alignment: { vertical: 'center', horizontal: 'center' },
});

const sCellNum = (fmt = '0.00', zebra = false, isAllow = false, muted = false) => ({
  font: {
    name: 'Inter',
    sz: 10,
    bold: isAllow && !muted,
    color: { rgb: muted ? '94A3B8' : isAllow ? '059669' : '0F172A' },
  },
  fill: {
    fgColor: { rgb: isAllow && !muted ? 'F0FDF4' : zebra ? 'F8FAFC' : 'FFFFFF' },
  },
  border: BORDER_THIN,
  alignment: { vertical: 'center', horizontal: 'right' },
  numFmt: fmt,
});

const sTotalCell = (fmt: string | null = null, isAllow = false) => ({
  font: {
    name: 'Inter',
    sz: 10,
    bold: true,
    color: { rgb: isAllow ? '047857' : '1D4ED8' },
  },
  fill: { fgColor: { rgb: isAllow ? 'DCFCE7' : 'DBEAFE' } },
  border: {
    top: { style: 'medium', color: { rgb: '3B82F6' } },
    bottom: { style: 'double', color: { rgb: '1D4ED8' } },
    left: BORDER_THIN.left,
    right: BORDER_THIN.right,
  },
  alignment: { vertical: 'center', horizontal: fmt ? 'right' : 'left' },
  ...(fmt ? { numFmt: fmt } : {}),
});

function applyRowStyle(ws: any, rowIdx: number, stylesArr: any[]) {
  stylesArr.forEach((st, colIdx) => {
    const ref = XLSX.utils.encode_cell({ r: rowIdx, c: colIdx });
    if (!ws[ref]) ws[ref] = { t: 's', v: '' };
    ws[ref].s = st;
  });
}

export function exportUmhExcel(
  record: AssyRecord,
  activeMode: AllowanceMode,
  lang: UiLang = 'id'
): void {
  const wb = XLSX.utils.book_new();
  const { params } = record;
  const regCalc = getVariantResult(record, 'reg');
  const smvCalc = getVariantResult(record, 'smv');

  const modeLabel =
    activeMode === 'by_final'
      ? `Allowance By Hasil Akhir (+${params.pfdAllowancePct || 0}% Justified)`
      : `Allowance By Proses (+${params.pfdAllowancePct || 0}% Tiap Proses)`;

  const sumHeaders = [
    'No',
    lang === 'jp' ? '工程名' : lang === 'en' ? 'Process Item' : 'Item Proses',
    'Base/STD Sec',
    'Allow Sec (Total)',
    '+Add Sec',
    'Eff. Allow (%)',
    'Base/STD Min',
    'Allow Min (Total)',
    'Base/STD Hour',
    'Allow Hour (Total)',
  ];

  // SHEET 1: SUMMARY UMH (REG ON TOP, SMV DIRECTLY BELOW ON SAME SHEET)
  const sumAoa: any[][] = [
    [
      'STD / UMH WIRE HARNESS REPORT — SUMMARY PER PROSES (REG & SMV)',
      '', '', '', '', '', '', '', '', '',
    ],
    [
      `Assy No: ${params.assyNo}  |  Customer: ${params.customer || '-'}  |  Metode: ${modeLabel}`,
      '', '', '', '', '', '', '', '', '',
    ],
    [],
    [
      'Assy No',
      params.assyNo,
      'Customer',
      params.customer || '-',
      'Master CCT',
      params.masterCct,
      'Allowance (%)',
      `${params.pfdAllowancePct || 0}%`,
      'Sirkuit PPCS',
      record.ppcsList.length,
    ],
    [],
  ];

  const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } },
  ];
  const rowStylesToApply: { rowIdx: number; styles: any[] }[] = [
    { rowIdx: 0, styles: Array(10).fill(sBanner) },
    { rowIdx: 1, styles: Array(10).fill(sSubBanner) },
    {
      rowIdx: 3,
      styles: [
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
      ],
    },
  ];
  const rowHeights: Record<number, number> = {
    0: 28,
    1: 20,
    2: 8,
    3: 22,
    4: 10,
  };

  const appendSummaryBlock = (
    variantTitle: string,
    totalLabel: string,
    bannerStyle: any,
    calc: CalculationVariant
  ) => {
    const totalStdSec =
      activeMode === 'by_final' ? calc.totalAllowByFinalSec : calc.totalAllowByProcessSec;
    const totAllow = totalStdSec - calc.totalBaseSec;

    const sectionRowIdx = sumAoa.length;
    sumAoa.push([variantTitle, '', '', '', '', '', '', '', '', '']);
    merges.push({ s: { r: sectionRowIdx, c: 0 }, e: { r: sectionRowIdx, c: 9 } });
    rowStylesToApply.push({ rowIdx: sectionRowIdx, styles: Array(10).fill(bannerStyle) });
    rowHeights[sectionRowIdx] = 24;

    const headerRowIdx = sumAoa.length;
    sumAoa.push([...sumHeaders]);
    rowStylesToApply.push({ rowIdx: headerRowIdx, styles: Array(10).fill(sTh) });
    rowHeights[headerRowIdx] = 26;

    calc.processes.forEach((it, idx) => {
      const stdVal = activeMode === 'by_final' ? it.allowByFinalSec : it.allowByProcessSec;
      const allowSec = stdVal - it.baseSec;
      const effAllowPct = it.baseSec > 0 ? (allowSec / it.baseSec) * 100 : 0;
      const pName = translateProcessName(it.processId, it.processName, it.jpName, lang);

      const rIdx = sumAoa.length;
      sumAoa.push([
        idx + 1,
        pName,
        Number(it.baseSec.toFixed(2)),
        Number(stdVal.toFixed(2)),
        Number(allowSec.toFixed(2)),
        Number(effAllowPct.toFixed(1)),
        Number((it.baseSec / 60).toFixed(2)),
        Number((stdVal / 60).toFixed(2)),
        Number((it.baseSec / 3600).toFixed(4)),
        Number((stdVal / 3600).toFixed(4)),
      ]);

      const z = idx % 2 === 1;
      const m = it.baseSec === 0;
      rowStylesToApply.push({
        rowIdx: rIdx,
        styles: [
          sCellCenter(z, m),
          {
            ...sCellText(z, m),
            font: { name: 'Inter', sz: 10, bold: !m, color: { rgb: m ? '94A3B8' : '0F172A' } },
          },
          sCellNum('0.00', z, false, m),
          sCellNum('0.00', z, true, m),
          sCellNum('+0.00;-0.00;0.00', z, true, m),
          sCellNum('0.0"%"', z, false, m),
          sCellNum('0.00', z, false, m),
          sCellNum('0.00', z, true, m),
          sCellNum('0.0000', z, false, m),
          sCellNum('0.0000', z, true, m),
        ],
      });
    });

    const totRowIdx = sumAoa.length;
    sumAoa.push([
      '',
      totalLabel,
      Number(calc.totalBaseSec.toFixed(2)),
      Number(totalStdSec.toFixed(2)),
      Number(totAllow.toFixed(2)),
      Number((params.pfdAllowancePct || 0).toFixed(1)),
      Number((calc.totalBaseSec / 60).toFixed(2)),
      Number((totalStdSec / 60).toFixed(2)),
      Number((calc.totalBaseSec / 3600).toFixed(4)),
      Number((totalStdSec / 3600).toFixed(4)),
    ]);
    rowStylesToApply.push({
      rowIdx: totRowIdx,
      styles: [
        sTotalCell(),
        sTotalCell(),
        sTotalCell('0.00', false),
        sTotalCell('0.00', true),
        sTotalCell('+0.00;-0.00;0.00', true),
        sTotalCell('0.0"%"', true),
        sTotalCell('0.00', false),
        sTotalCell('0.00', true),
        sTotalCell('0.0000', false),
        sTotalCell('0.0000', true),
      ],
    });
    rowHeights[totRowIdx] = 24;
  };

  // 1. REG ABOVE
  appendSummaryBlock(
    'BAGIAN 1 — HASIL PERHITUNGAN REG (NORMAL · AUTOCUTTING AKTIF)',
    'TOTAL KESELURUHAN (REG)',
    sSectionReg,
    regCalc
  );

  // Spacer rows between REG and SMV on the same sheet
  const spacer1 = sumAoa.length;
  sumAoa.push([]);
  sumAoa.push([]);
  rowHeights[spacer1] = 14;
  rowHeights[spacer1 + 1] = 14;

  // 2. SMV BELOW
  appendSummaryBlock(
    'BAGIAN 2 — HASIL PERHITUNGAN SMV (TANPA AUTOCUTTING · PROSES LAINNYA TETAP ADA)',
    'TOTAL KESELURUHAN (SMV)',
    sSectionSmv,
    smvCalc
  );

  const wsSummary = XLSX.utils.aoa_to_sheet(sumAoa);
  wsSummary['!merges'] = merges;
  wsSummary['!rows'] = sumAoa.map((_, rIdx) => (rowHeights[rIdx] ? { hpt: rowHeights[rIdx] } : {}));
  wsSummary['!cols'] = [
    { wch: 6 },
    { wch: 42 },
    { wch: 15 },
    { wch: 17 },
    { wch: 13 },
    { wch: 14 },
    { wch: 15 },
    { wch: 17 },
    { wch: 16 },
    { wch: 18 },
  ];

  rowStylesToApply.forEach(({ rowIdx, styles }) => {
    applyRowStyle(wsSummary, rowIdx, styles);
  });

  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary UMH');

  // DETAIL SUB-STEP SHEETS (REG & SMV)
  const usedSheetNames = new Set(['Summary UMH']);
  const appendDetailSheets = (variantTag: 'REG' | 'SMV', calc: CalculationVariant) => {
    calc.processes.forEach((it, procIdx) => {
      if (!it.subSteps || it.subSteps.length === 0) return;

      const stdVal = activeMode === 'by_final' ? it.allowByFinalSec : it.allowByProcessSec;
      const procAllowSec = stdVal - it.baseSec;
      const effPct = it.baseSec > 0 ? (procAllowSec / it.baseSec) * 100 : 0;
      const procLabel = translateProcessName(it.processId, it.processName, it.jpName, lang);

      const prefix = variantTag === 'REG' ? `R${procIdx + 1}` : `S${procIdx + 1}`;
      const rawTab = `${prefix}.${procLabel
        .replace(/[\\/?*[\]:]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()}`;
      let tabName = rawTab.slice(0, 31);
      let suffix = 2;
      while (usedSheetNames.has(tabName)) {
        const sfx = `_${suffix++}`;
        tabName = rawTab.slice(0, 31 - sfx.length) + sfx;
      }
      usedSheetNames.add(tabName);

      const subAoa: any[][] = [
        [
          `[${variantTag}] DETAIL SUB-STEP PROSES: ${procLabel.toUpperCase()}`,
          '', '', '', '', '', '', '', '', '', '', '', '',
        ],
        [
          `Assy: ${params.assyNo}  |  Master CCT: ${params.masterCct}  |  Base: ${it.baseSec.toFixed(2)}s  |  Allow Total: ${stdVal.toFixed(2)}s (+${procAllowSec.toFixed(2)}s / ${effPct.toFixed(1)}%)`,
          '', '', '', '', '', '', '', '', '', '', '', '',
        ],
        [],
        [
          'No',
          'Tahapan',
          'Rincian Sub-Step',
          'Basis Konversi',
          'Qty',
          'Rate (s)',
          'Base/STD Sec',
          'Allow Sec (Total)',
          '+Add Sec',
          'Base/STD Min',
          'Allow Min (Total)',
          'Base/STD Hour',
          'Allow Hour (Total)',
        ],
      ];

      it.subSteps.forEach((st, sIdx) => {
        const subStd = activeMode === 'by_final' ? st.allowByFinalSec : st.allowByProcessSec;
        const subAllow = subStd - st.baseSec;

        subAoa.push([
          sIdx + 1,
          translateStage(st.stage, lang),
          translateSubStepName(st.name, lang),
          translateBasis(st.basis, lang),
          Number(Number(st.qty).toFixed(2)),
          Number(Number(st.rate).toFixed(4)),
          Number(st.baseSec.toFixed(3)),
          Number(subStd.toFixed(3)),
          Number(subAllow.toFixed(3)),
          Number((st.baseSec / 60).toFixed(4)),
          Number((subStd / 60).toFixed(4)),
          Number((st.baseSec / 3600).toFixed(6)),
          Number((subStd / 3600).toFixed(6)),
        ]);
      });

      subAoa.push([
        '',
        'SUBTOTAL PROSES',
        translateSummaryNote(it.summaryNote, lang),
        '',
        '',
        '',
        Number(it.baseSec.toFixed(3)),
        Number(stdVal.toFixed(3)),
        Number(procAllowSec.toFixed(3)),
        Number((it.baseSec / 60).toFixed(4)),
        Number((stdVal / 60).toFixed(4)),
        Number((it.baseSec / 3600).toFixed(6)),
        Number((stdVal / 3600).toFixed(6)),
      ]);

      const wsSub = XLSX.utils.aoa_to_sheet(subAoa);
      wsSub['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 12 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 12 } },
      ];
      wsSub['!rows'] = [{ hpt: 26 }, { hpt: 20 }, { hpt: 8 }, { hpt: 25 }];
      wsSub['!cols'] = [
        { wch: 5 },
        { wch: 20 },
        { wch: 44 },
        { wch: 22 },
        { wch: 10 },
        { wch: 11 },
        { wch: 14 },
        { wch: 17 },
        { wch: 12 },
        { wch: 14 },
        { wch: 17 },
        { wch: 15 },
        { wch: 18 },
      ];

      applyRowStyle(wsSub, 0, Array(13).fill(sBanner));
      applyRowStyle(
        wsSub,
        1,
        Array(13).fill(variantTag === 'REG' ? sSectionReg : sSectionSmv)
      );
      applyRowStyle(wsSub, 3, Array(13).fill(sTh));

      it.subSteps.forEach((_, sIdx) => {
        const rIdx = 4 + sIdx;
        const z = sIdx % 2 === 1;
        applyRowStyle(wsSub, rIdx, [
          sCellCenter(z),
          {
            ...sCellCenter(z),
            font: { name: 'Inter', sz: 9, bold: true, color: { rgb: '0062CC' } },
          },
          sCellText(z),
          sCellText(z, true),
          sCellNum('0.00', z),
          sCellNum('0.0000', z),
          sCellNum('0.000', z),
          sCellNum('0.000', z, true),
          sCellNum('+0.000;-0.000;0.000', z, true),
          sCellNum('0.0000', z),
          sCellNum('0.0000', z, true),
          sCellNum('0.000000', z),
          sCellNum('0.000000', z, true),
        ]);
      });

      const subTotIdx = 4 + it.subSteps.length;
      applyRowStyle(wsSub, subTotIdx, [
        sTotalCell(),
        sTotalCell(),
        sTotalCell(),
        sTotalCell(),
        sTotalCell(),
        sTotalCell(),
        sTotalCell('0.000', false),
        sTotalCell('0.000', true),
        sTotalCell('+0.000;-0.000;0.000', true),
        sTotalCell('0.0000', false),
        sTotalCell('0.0000', true),
        sTotalCell('0.000000', false),
        sTotalCell('0.000000', true),
      ]);

      XLSX.utils.book_append_sheet(wb, wsSub, tabName);
    });
  };

  appendDetailSheets('REG', regCalc);
  appendDetailSheets('SMV', smvCalc);

  const safeAssy = (params.assyNo || 'Assy').replace(/[^a-zA-Z0-9_-]/g, '_');
  XLSX.writeFile(wb, `STD_UMH_${safeAssy}.xlsx`);
}
