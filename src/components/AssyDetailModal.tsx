import { Fragment, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Edit3,
  FileSpreadsheet,
  Languages,
  Printer,
  X,
} from 'lucide-react';
import { getVariantResult } from '../engine/umhCalculator';
import { AllowanceMode, AssyRecord, ProcessId, ResultVariant, UiLang } from '../types/umh';
import { exportUmhExcel } from '../utils/excelExporter';
import {
  translateBasis,
  translateProcessName,
  translateStage,
  translateSubStepName,
  translateSummaryNote,
  UI_LANG_OPTIONS,
} from '../utils/umhTranslator';

interface AssyDetailModalProps {
  record: AssyRecord;
  onClose: () => void;
  onEdit: (record: AssyRecord) => void;
  onPrintPdf: (record: AssyRecord, mode: AllowanceMode, lang: UiLang) => void;
}

const MODAL_LABELS: Record<
  UiLang,
  {
    subtitle: string;
    tabReg: string;
    tabSmv: string;
    baseCycle: string;
    byProcess: string;
    byFinal: string;
    cctCardTitle: string;
    circuitsUnit: string;
    colNo: string;
    colProcess: string;
    colBaseSec: string;
    colAllowSec: string;
    colBaseMin: string;
    colAllowMin: string;
    colBaseHour: string;
    colAllowHour: string;
    colNotes: string;
    subStage: string;
    subName: string;
    subBasis: string;
    subQty: string;
    subRate: string;
    totalLabel: string;
    secUnit: string;
    minUnit: string;
    hrUnit: string;
  }
> = {
  id: {
    subtitle: 'Rincian Proses & Sub-Step UMH',
    tabReg: 'REG (Normal)',
    tabSmv: 'SMV (Tanpa Autocutting)',
    baseCycle: 'Base Cycle (0%)',
    byProcess: '1. Allowance By Proses',
    byFinal: '2. Allowance By Hasil',
    cctCardTitle: 'Master CCT & Sirkuit PPCS',
    circuitsUnit: 'sirkuit PPCS',
    colNo: 'No',
    colProcess: 'Item Proses (Klik untuk Sub-Step)',
    colBaseSec: 'Base/STD Sec',
    colAllowSec: 'Allow Sec',
    colBaseMin: 'Base/STD Min',
    colAllowMin: 'Allow Min',
    colBaseHour: 'Base/STD Hour',
    colAllowHour: 'Allow Hour',
    colNotes: 'Rincian',
    subStage: 'Tahapan',
    subName: 'Rincian Sub-Step',
    subBasis: 'Basis',
    subQty: 'Qty',
    subRate: 'Rate (s)',
    totalLabel: 'TOTAL KESELURUHAN',
    secUnit: 'dtk',
    minUnit: 'mnt',
    hrUnit: 'jam',
  },
  en: {
    subtitle: 'UMH Process & Sub-Step Breakdown',
    tabReg: 'REG (Standard)',
    tabSmv: 'SMV (No Autocutting)',
    baseCycle: 'Base Cycle (0%)',
    byProcess: '1. Allowance By Process',
    byFinal: '2. Allowance By Final Result',
    cctCardTitle: 'Master CCT & PPCS Circuits',
    circuitsUnit: 'PPCS circuits',
    colNo: 'No',
    colProcess: 'Process Item (Click for Sub-Steps)',
    colBaseSec: 'Base/STD Sec',
    colAllowSec: 'Allow Sec',
    colBaseMin: 'Base/STD Min',
    colAllowMin: 'Allow Min',
    colBaseHour: 'Base/STD Hour',
    colAllowHour: 'Allow Hour',
    colNotes: 'Details',
    subStage: 'Stage',
    subName: 'Sub-Step Detail',
    subBasis: 'Basis',
    subQty: 'Qty',
    subRate: 'Rate (s)',
    totalLabel: 'GRAND TOTAL',
    secUnit: 'sec',
    minUnit: 'min',
    hrUnit: 'hr',
  },
  jp: {
    subtitle: '工程別・細目標準時間詳細',
    tabReg: 'REG（通常計算）',
    tabSmv: 'SMV（自動切断なし）',
    baseCycle: '正味時間 Base (0%)',
    byProcess: '1. 工程別余裕配分',
    byFinal: '2. 最終成果別余裕配分',
    cctCardTitle: 'マスターCCT・回路数',
    circuitsUnit: '回路 PPCS',
    colNo: 'No',
    colProcess: '工程名（クリックで細目表示）',
    colBaseSec: 'Base秒',
    colAllowSec: 'Allow秒',
    colBaseMin: 'Base分',
    colAllowMin: 'Allow分',
    colBaseHour: 'Base時間',
    colAllowHour: 'Allow時間',
    colNotes: '備考',
    subStage: '工程区分',
    subName: '細目作業内容',
    subBasis: '換算基準',
    subQty: '数量',
    subRate: '単価(秒)',
    totalLabel: '総合計',
    secUnit: '秒',
    minUnit: '分',
    hrUnit: '時間',
  },
};

export function AssyDetailModal({
  record,
  onClose,
  onEdit,
  onPrintPdf,
}: AssyDetailModalProps) {
  const [activeVariant, setActiveVariant] = useState<ResultVariant>('reg');
  const [activeMode, setActiveMode] = useState<AllowanceMode>(record.params.allowanceMode);
  const [uiLang, setUiLang] = useState<UiLang>('id');
  const [expandedIds, setExpandedIds] = useState<Set<ProcessId>>(new Set([2, 3, 17]));

  const { params } = record;
  const variantCalc = getVariantResult(record, activeVariant);
  const { totalBaseSec, totalAllowByProcessSec, totalAllowByFinalSec, processes } = variantCalc;

  const regCalc = getVariantResult(record, 'reg');
  const smvCalc = getVariantResult(record, 'smv');

  const currentTotalAllowSec =
    activeMode === 'by_process' ? totalAllowByProcessSec : totalAllowByFinalSec;

  const L = MODAL_LABELS[uiLang];

  const toggleProcessDrawer = (pid: ProcessId, hasSubSteps: boolean) => {
    if (!hasSubSteps) return;
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });
  };

  const renderAllowCell = (
    baseSec: number,
    allowSec: number,
    divisor: number,
    digits: number,
    diffDigits: number,
    unitLabel: string,
    showPct = false
  ) => {
    const allowVal = allowSec / divisor;
    const diffSec = allowSec - baseSec;
    const effPct = baseSec > 0 ? (diffSec / baseSec) * 100 : 0;

    return (
      <div className="flex flex-col items-end">
        <span className="font-mono-num font-bold text-emerald-700">
          {allowVal.toFixed(digits)}
        </span>
        <span className="font-mono-num text-[10px] text-slate-500 whitespace-nowrap leading-tight">
          (+{(diffSec / divisor).toFixed(diffDigits)} {unitLabel})
          {showPct ? ` ${effPct.toFixed(1)}%` : ''}
        </span>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-2 sm:p-4 print:hidden">
      <div className="glass-modal w-[96vw] h-[92vh] rounded-2xl flex flex-col overflow-hidden">
        {/* Top Toolbar */}
        <div className="px-6 py-4 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-[#1E3A8A]">{L.subtitle}</span>
              <span aria-hidden="true">·</span>
              <span>{params.customer || '-'}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-num">PFD {params.pfdAllowancePct}%</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 font-mono-num mt-0.5">
              {params.assyNo}{' '}
              <span className="font-normal text-slate-500 text-base">
                ({params.customer || '-'})
              </span>
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Result Variant Tabs: REG vs SMV */}
            <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200">
              <button
                type="button"
                onClick={() => setActiveVariant('reg')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  activeVariant === 'reg'
                    ? 'bg-[#1E3A8A] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {L.tabReg}
              </button>
              <button
                type="button"
                onClick={() => setActiveVariant('smv')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  activeVariant === 'smv'
                    ? 'bg-[#047857] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {L.tabSmv}
              </button>
            </div>

            {/* Translate Toggle: ID | EN | JP */}
            <div
              className="inline-flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200"
              title="Terjemahkan Nama Subproses & Sub-Step"
            >
              <Languages className="w-3.5 h-3.5 text-slate-500 ml-1.5 mr-1 shrink-0" />
              {UI_LANG_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setUiLang(opt.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    uiLang === opt.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.short}
                </button>
              ))}
            </div>

            {/* Interactive Switch Allowance Mode */}
            <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200">
              <button
                type="button"
                onClick={() => setActiveMode('by_process')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  activeMode === 'by_process'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                1. By Proses (+{params.pfdAllowancePct}%)
              </button>
              <button
                type="button"
                onClick={() => setActiveMode('by_final')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  activeMode === 'by_final'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                2. By Hasil Akhir (Justified)
              </button>
            </div>

            <button
              type="button"
              onClick={() => onEdit(record)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Parameter</span>
            </button>

            <button
              type="button"
              onClick={() => exportUmhExcel(record, activeMode, uiLang)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#047857] text-white text-xs font-semibold hover:bg-[#065F46] transition-colors cursor-pointer whitespace-nowrap"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export Excel</span>
            </button>

            <button
              type="button"
              onClick={() => onPrintPdf(record, activeMode, uiLang)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1E3A8A] text-white text-xs font-semibold hover:bg-[#172E6E] transition-colors cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Export PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
              aria-label="Tutup Detail"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Header Card Container Strip (1 Horizontal Row) */}
        <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200 grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl bg-white border border-slate-200 px-4 py-2.5">
            <p className="text-[11px] font-medium text-slate-500">
              {L.baseCycle} · {activeVariant.toUpperCase()}
            </p>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-lg font-bold font-mono-num text-slate-900">
                {totalBaseSec.toFixed(2)}s
              </span>
              <span className="text-xs font-mono-num text-slate-500">
                {(totalBaseSec / 3600).toFixed(4)} UMH
              </span>
            </div>
          </div>

          <div
            className={`rounded-xl border px-4 py-2.5 transition-colors ${
              activeMode === 'by_process'
                ? 'bg-emerald-50/70 border-emerald-300'
                : 'bg-white border-slate-200'
            }`}
          >
            <p className="text-[11px] font-medium text-slate-600">
              {L.byProcess} (+{params.pfdAllowancePct}%)
            </p>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-lg font-bold font-mono-num text-[#047857]">
                {totalAllowByProcessSec.toFixed(2)}s
              </span>
              <span className="text-xs font-mono-num text-[#047857]">
                {(totalAllowByProcessSec / 3600).toFixed(4)} UMH
              </span>
            </div>
          </div>

          <div
            className={`rounded-xl border px-4 py-2.5 transition-colors ${
              activeMode === 'by_final'
                ? 'bg-emerald-50/70 border-emerald-300'
                : 'bg-white border-slate-200'
            }`}
          >
            <p className="text-[11px] font-medium text-slate-600">
              {L.byFinal} (+{params.pfdAllowancePct}%)
            </p>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-lg font-bold font-mono-num text-[#047857]">
                {totalAllowByFinalSec.toFixed(2)}s
              </span>
              <span className="text-xs font-mono-num text-[#047857]">
                {(totalAllowByFinalSec / 3600).toFixed(4)} UMH
              </span>
            </div>
          </div>

          <div className="rounded-xl bg-white border border-slate-200 px-4 py-2.5">
            <p className="text-[11px] font-medium text-slate-500">{L.cctCardTitle}</p>
            <div className="flex items-baseline justify-between mt-1 gap-2">
              <span className="text-base font-bold font-mono-num text-slate-900">
                {params.masterCct} CCT · {record.ppcsList.length} {L.circuitsUnit}
              </span>
              <span className="text-[11px] font-mono-num font-semibold text-slate-600 whitespace-nowrap">
                {activeVariant === 'reg'
                  ? `SMV ${(smvCalc.totalBaseSec / 3600).toFixed(4)}h`
                  : `REG ${(regCalc.totalBaseSec / 3600).toFixed(4)}h`}
              </span>
            </div>
          </div>
        </div>

        {/* Main 1-Language Table */}
        <div className="flex-1 overflow-auto p-6 bg-[#f8fafc]">
          <div className="rounded-2xl border border-slate-200 bg-white overflow-x-auto shadow-xs">
            <table className="w-full text-left border-collapse min-w-[980px]">
              <thead>
                <tr className="bg-slate-900 text-white text-[11px] font-semibold">
                  <th className="py-3 px-3 w-10 text-center">{L.colNo}</th>
                  <th className="py-3 px-3">{L.colProcess}</th>
                  <th className="py-3 px-3 text-right">{L.colBaseSec}</th>
                  <th className="py-3 px-3 text-right bg-[#064E3B]">{L.colAllowSec}</th>
                  <th className="py-3 px-3 text-right">{L.colBaseMin}</th>
                  <th className="py-3 px-3 text-right bg-[#064E3B]">{L.colAllowMin}</th>
                  <th className="py-3 px-3 text-right">{L.colBaseHour}</th>
                  <th className="py-3 px-3 text-right bg-[#064E3B]">{L.colAllowHour}</th>
                  <th className="py-3 px-3">{L.colNotes}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {processes.map((proc) => {
                  const allowSec =
                    activeMode === 'by_process'
                      ? proc.allowByProcessSec
                      : proc.allowByFinalSec;
                  const hasSubs = proc.subSteps.length > 0;
                  const isExpanded = expandedIds.has(proc.processId);
                  const displayName = translateProcessName(
                    proc.processId,
                    proc.processName,
                    proc.jpName,
                    uiLang
                  );
                  const displayNote = translateSummaryNote(proc.summaryNote, uiLang);

                  return (
                    <Fragment key={proc.processId}>
                      <tr
                        onClick={() => toggleProcessDrawer(proc.processId, hasSubs)}
                        className={`transition-colors ${
                          hasSubs
                            ? 'cursor-pointer hover:bg-slate-50'
                            : 'text-slate-400 bg-slate-50/50'
                        }`}
                      >
                        <td className="py-3 px-3 text-center font-mono-num font-semibold text-slate-500">
                          {proc.processId}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            {hasSubs ? (
                              isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                              )
                            ) : (
                              <span className="w-4 h-4 shrink-0" />
                            )}
                            <span
                              className={`text-[13px] ${
                                proc.baseSec > 0
                                  ? 'font-semibold text-slate-900'
                                  : 'font-medium text-slate-500'
                              }`}
                            >
                              {displayName}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-mono-num font-bold text-slate-800">
                          {proc.baseSec.toFixed(2)}
                        </td>
                        <td className="py-3 px-3 text-right bg-emerald-50/50">
                          {renderAllowCell(proc.baseSec, allowSec, 1, 2, 2, L.secUnit, true)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono-num font-bold text-slate-800">
                          {(proc.baseSec / 60).toFixed(2)}
                        </td>
                        <td className="py-3 px-3 text-right bg-emerald-50/50">
                          {renderAllowCell(proc.baseSec, allowSec, 60, 2, 4, L.minUnit)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono-num font-bold text-slate-800">
                          {(proc.baseSec / 3600).toFixed(4)}
                        </td>
                        <td className="py-3 px-3 text-right bg-emerald-50/50">
                          {renderAllowCell(proc.baseSec, allowSec, 3600, 4, 6, L.hrUnit)}
                        </td>
                        <td className="py-3 px-3 text-[11px] text-slate-600 max-w-[260px]">
                          {displayNote}
                        </td>
                      </tr>

                      {/* Sub-Step Drawer */}
                      {isExpanded && hasSubs && (
                        <tr className="bg-slate-50/90">
                          <td colSpan={9} className="p-0">
                            <div className="px-8 py-3 border-y border-slate-200/80">
                              <table className="w-full text-left border-collapse">
                                <thead>
                                  <tr className="text-[11px] font-semibold text-slate-500 border-b border-slate-200/80">
                                    <th className="py-1.5 px-2">{L.subStage}</th>
                                    <th className="py-1.5 px-2">{L.subName}</th>
                                    <th className="py-1.5 px-2">{L.subBasis}</th>
                                    <th className="py-1.5 px-2 text-right">{L.subQty}</th>
                                    <th className="py-1.5 px-2 text-right">{L.subRate}</th>
                                    <th className="py-1.5 px-2 text-right">{L.colBaseSec}</th>
                                    <th className="py-1.5 px-2 text-right text-emerald-800">
                                      {L.colAllowSec}
                                    </th>
                                    <th className="py-1.5 px-2 text-right">{L.colBaseMin}</th>
                                    <th className="py-1.5 px-2 text-right text-emerald-800">
                                      {L.colAllowMin}
                                    </th>
                                    <th className="py-1.5 px-2 text-right">{L.colBaseHour}</th>
                                    <th className="py-1.5 px-2 text-right text-emerald-800">
                                      {L.colAllowHour}
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200/50 text-[11px]">
                                  {proc.subSteps.map((sub) => {
                                    const subAllowSec =
                                      activeMode === 'by_process'
                                        ? sub.allowByProcessSec
                                        : sub.allowByFinalSec;
                                    const subDiff = subAllowSec - sub.baseSec;

                                    return (
                                      <tr key={sub.id} className="hover:bg-white/70">
                                        <td className="py-2 px-2 font-semibold text-blue-700">
                                          {translateStage(sub.stage, uiLang)}
                                        </td>
                                        <td className="py-2 px-2 text-slate-800">
                                          {translateSubStepName(sub.name, uiLang)}
                                        </td>
                                        <td className="py-2 px-2 text-slate-500">
                                          {translateBasis(sub.basis, uiLang)}
                                        </td>
                                        <td className="py-2 px-2 text-right font-mono-num text-slate-600">
                                          {sub.qty.toFixed(2)}
                                        </td>
                                        <td className="py-2 px-2 text-right font-mono-num text-slate-600">
                                          {sub.rate.toFixed(2)}
                                        </td>
                                        <td className="py-2 px-2 text-right font-mono-num text-slate-700">
                                          {sub.baseSec.toFixed(3)}
                                        </td>
                                        <td className="py-2 px-2 text-right font-mono-num font-bold text-emerald-700">
                                          <div>{subAllowSec.toFixed(3)}</div>
                                          <div className="text-[10px] font-normal text-slate-500">
                                            (+{subDiff.toFixed(3)}s)
                                          </div>
                                        </td>
                                        <td className="py-2 px-2 text-right font-mono-num text-slate-700">
                                          {(sub.baseSec / 60).toFixed(4)}
                                        </td>
                                        <td className="py-2 px-2 text-right font-mono-num font-bold text-emerald-700">
                                          <div>{(subAllowSec / 60).toFixed(4)}</div>
                                          <div className="text-[10px] font-normal text-slate-500">
                                            (+{(subDiff / 60).toFixed(5)}m)
                                          </div>
                                        </td>
                                        <td className="py-2 px-2 text-right font-mono-num text-slate-700">
                                          {(sub.baseSec / 3600).toFixed(6)}
                                        </td>
                                        <td className="py-2 px-2 text-right font-mono-num font-bold text-emerald-700">
                                          <div>{(subAllowSec / 3600).toFixed(6)}</div>
                                          <div className="text-[10px] font-normal text-slate-500">
                                            (+{(subDiff / 3600).toFixed(6)}h)
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold text-xs">
                  <td colSpan={2} className="py-3.5 px-4 text-slate-900">
                    {L.totalLabel} ({activeVariant.toUpperCase()} ·{' '}
                    {activeMode === 'by_final'
                      ? 'ALLOWANCE BY HASIL AKHIR'
                      : 'ALLOWANCE BY PROSES'}
                    )
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono-num text-slate-900">
                    {totalBaseSec.toFixed(2)}
                  </td>
                  <td className="py-3.5 px-3 text-right bg-emerald-100/80">
                    {renderAllowCell(totalBaseSec, currentTotalAllowSec, 1, 2, 2, L.secUnit, true)}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono-num text-slate-900">
                    {(totalBaseSec / 60).toFixed(2)}
                  </td>
                  <td className="py-3.5 px-3 text-right bg-emerald-100/80">
                    {renderAllowCell(totalBaseSec, currentTotalAllowSec, 60, 2, 4, L.minUnit)}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono-num text-slate-900">
                    {(totalBaseSec / 3600).toFixed(4)}
                  </td>
                  <td className="py-3.5 px-3 text-right bg-emerald-100/80">
                    {renderAllowCell(totalBaseSec, currentTotalAllowSec, 3600, 4, 6, L.hrUnit)}
                  </td>
                  <td className="py-3.5 px-3 font-mono-num text-slate-700">
                    {params.masterCct} CCT
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
