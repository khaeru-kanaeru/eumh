import { useState } from 'react';
import { Languages, Printer, X } from 'lucide-react';
import { getVariantResult } from '../engine/umhCalculator';
import { AllowanceMode, AssyRecord, CalculationVariant, UiLang } from '../types/umh';
import {
  translateBasis,
  translateProcessName,
  translateStage,
  translateSubStepName,
  UI_LANG_OPTIONS,
} from '../utils/umhTranslator';

interface PdfReportModalProps {
  record: AssyRecord;
  mode: AllowanceMode;
  lang?: UiLang;
  onClose: () => void;
}

export function PdfReportModal({
  record,
  mode,
  lang = 'id',
  onClose,
}: PdfReportModalProps) {
  const [uiLang, setUiLang] = useState<UiLang>(lang);
  const { params } = record;

  const regCalc = getVariantResult(record, 'reg');
  const smvCalc = getVariantResult(record, 'smv');

  const modeTitle =
    mode === 'by_process'
      ? '1. Allowance By Proses (Merata)'
      : '2. Allowance By Hasil Akhir (Justified Bobot)';

  const renderVariantSection = (
    variantKey: 'reg' | 'smv',
    calc: CalculationVariant,
    compareCalc: CalculationVariant,
    isSecondSection: boolean
  ) => {
    const totalAllowSec =
      mode === 'by_process' ? calc.totalAllowByProcessSec : calc.totalAllowByFinalSec;
    const compareAllowSec =
      mode === 'by_process'
        ? compareCalc.totalAllowByProcessSec
        : compareCalc.totalAllowByFinalSec;
    const activeProcesses = calc.processes.filter((p) => p.active);

    const badgeText =
      variantKey === 'reg'
        ? 'BAGIAN 1 — REG (PERHITUNGAN NORMAL · AUTOCUTTING AKTIF)'
        : 'BAGIAN 2 — SMV (TANPA AUTOCUTTING · PROSES LAINNYA TETAP ADA)';

    const headerBg = variantKey === 'reg' ? 'bg-slate-900' : 'bg-[#064E3B]';

    return (
      <div className={`space-y-6 ${isSecondSection ? 'pt-8 border-t-4 border-dashed border-slate-300 print:border-t-0 print:pt-0 print:break-before-page' : ''}`}>
        {/* Report Banner */}
        <div className={`${headerBg} text-white rounded-xl p-5 flex items-center justify-between`}>
          <div>
            <p className="text-[11px] font-semibold tracking-wide text-slate-200">
              {badgeText}
            </p>
            <h1 className="text-2xl font-bold font-mono-num mt-1">
              ASSY {params.assyNo}
            </h1>
            <p className="text-xs text-slate-200 mt-1">
              Customer: {params.customer || '-'} · Metode: {modeTitle} · PFD: {params.pfdAllowancePct}%
            </p>
          </div>
          <div className="text-right text-xs text-slate-200 font-mono-num space-y-0.5">
            <div>Tanggal: {new Date().toLocaleDateString('id-ID')}</div>
            <div>Master CCT: {params.masterCct} CCT</div>
            <div>Sirkuit PPCS: {record.ppcsList.length}</div>
          </div>
        </div>

        {/* 4 KPI Cards */}
        <div className="grid grid-cols-4 gap-3">
          <div className="border border-slate-200 rounded-xl p-3.5">
            <p className="text-[11px] text-slate-500">
              Base Cycle (0%) · {variantKey.toUpperCase()}
            </p>
            <p className="text-lg font-bold font-mono-num text-slate-900 mt-1">
              {calc.totalBaseSec.toFixed(2)} sec
            </p>
            <p className="text-[11px] font-mono-num text-slate-500">
              {(calc.totalBaseSec / 3600).toFixed(4)} hr
            </p>
          </div>
          <div className="border border-emerald-300 bg-emerald-50/50 rounded-xl p-3.5">
            <p className="text-[11px] text-emerald-800">
              Standard UMH {variantKey.toUpperCase()}
            </p>
            <p className="text-lg font-bold font-mono-num text-emerald-900 mt-1">
              {totalAllowSec.toFixed(2)} sec
            </p>
            <p className="text-[11px] font-mono-num text-emerald-700">
              {(totalAllowSec / 3600).toFixed(4)} hr
            </p>
          </div>
          <div className="border border-slate-200 rounded-xl p-3.5">
            <p className="text-[11px] text-slate-500">Master CCT &amp; Wire</p>
            <p className="text-lg font-bold font-mono-num text-slate-900 mt-1">
              {params.masterCct} CCT
            </p>
            <p className="text-[11px] font-mono-num text-slate-500">
              {record.ppcsList.length} sirkuit PPCS
            </p>
          </div>
          <div className="border border-slate-200 rounded-xl p-3.5">
            <p className="text-[11px] text-slate-500">
              {variantKey === 'reg' ? 'Pembanding SMV' : 'Selisih vs REG'}
            </p>
            <p className="text-lg font-bold font-mono-num text-slate-900 mt-1">
              {variantKey === 'reg'
                ? `${compareAllowSec.toFixed(2)} sec`
                : `${totalAllowSec - compareAllowSec >= 0 ? '+' : ''}${(totalAllowSec - compareAllowSec).toFixed(2)} sec`}
            </p>
            <p className="text-[11px] font-mono-num text-slate-500">
              {variantKey === 'reg'
                ? `${(compareAllowSec / 3600).toFixed(4)} hr`
                : `${((totalAllowSec - compareAllowSec) / 3600 >= 0 ? '+' : '')}${((totalAllowSec - compareAllowSec) / 3600).toFixed(4)} hr`}
            </p>
          </div>
        </div>

        {/* Summary Table (1 Language) */}
        <div>
          <h2 className="text-sm font-bold text-slate-900 mb-2">
            Ringkasan 21 Proses Manufaktur Wire Harness — {variantKey.toUpperCase()}
          </h2>
          <table className="w-full text-left border-collapse text-[11px]">
            <thead>
              <tr className="bg-slate-100 border-y border-slate-300 text-slate-700">
                <th className="py-2 px-2 w-8 text-center">No</th>
                <th className="py-2 px-2">Proses Manufaktur</th>
                <th className="py-2 px-2 text-right">Base Sec</th>
                <th className="py-2 px-2 text-right text-emerald-900">Allow Sec</th>
                <th className="py-2 px-2 text-right">Base Min</th>
                <th className="py-2 px-2 text-right text-emerald-900">Allow Min</th>
                <th className="py-2 px-2 text-right">Base Hour</th>
                <th className="py-2 px-2 text-right text-emerald-900">Allow Hour</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {calc.processes.map((proc) => {
                const allowSec =
                  mode === 'by_process'
                    ? proc.allowByProcessSec
                    : proc.allowByFinalSec;
                const procName = translateProcessName(
                  proc.processId,
                  proc.processName,
                  proc.jpName,
                  uiLang
                );
                return (
                  <tr key={proc.processId}>
                    <td className="py-1.5 px-2 text-center font-mono-num">{proc.processId}</td>
                    <td className="py-1.5 px-2 font-medium text-slate-900">{procName}</td>
                    <td className="py-1.5 px-2 text-right font-mono-num">{proc.baseSec.toFixed(3)}</td>
                    <td className="py-1.5 px-2 text-right font-mono-num font-bold text-emerald-800">
                      {allowSec.toFixed(3)}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono-num">{(proc.baseSec / 60).toFixed(4)}</td>
                    <td className="py-1.5 px-2 text-right font-mono-num font-bold text-emerald-800">
                      {(allowSec / 60).toFixed(4)}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono-num">{(proc.baseSec / 3600).toFixed(6)}</td>
                    <td className="py-1.5 px-2 text-right font-mono-num font-bold text-emerald-800">
                      {(allowSec / 3600).toFixed(6)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 border-t-2 border-slate-400 font-bold">
                <td className="py-2 px-2" />
                <td className="py-2 px-2">GRAND TOTAL UMH ({variantKey.toUpperCase()})</td>
                <td className="py-2 px-2 text-right font-mono-num">{calc.totalBaseSec.toFixed(3)}</td>
                <td className="py-2 px-2 text-right font-mono-num text-emerald-900">{totalAllowSec.toFixed(3)}</td>
                <td className="py-2 px-2 text-right font-mono-num">{(calc.totalBaseSec / 60).toFixed(4)}</td>
                <td className="py-2 px-2 text-right font-mono-num text-emerald-900">{(totalAllowSec / 60).toFixed(4)}</td>
                <td className="py-2 px-2 text-right font-mono-num">{(calc.totalBaseSec / 3600).toFixed(6)}</td>
                <td className="py-2 px-2 text-right font-mono-num text-emerald-900">{(totalAllowSec / 3600).toFixed(6)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Per-Process Sub-Step Pages */}
        <div className="pt-4 border-t border-slate-300 space-y-5 print:break-before-page">
          <h2 className="text-sm font-bold text-slate-900">
            [{variantKey.toUpperCase()}] Rincian Sub-Step per Proses Aktif ({activeProcesses.length} Proses)
          </h2>

          <div className="grid grid-cols-1 gap-4">
            {activeProcesses.map((proc) => {
              const procAllowSec =
                mode === 'by_process'
                  ? proc.allowByProcessSec
                  : proc.allowByFinalSec;
              const procName = translateProcessName(
                proc.processId,
                proc.processName,
                proc.jpName,
                uiLang
              );
              return (
                <div
                  key={proc.processId}
                  className="border border-slate-200 rounded-xl p-3.5 break-inside-avoid"
                >
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200">
                    <h3 className="text-xs font-bold text-slate-900">
                      {proc.processId}. {procName}
                    </h3>
                    <span className="text-[11px] font-mono-num text-slate-600">
                      Base: {proc.baseSec.toFixed(3)}s · Allow: {procAllowSec.toFixed(3)}s
                    </span>
                  </div>
                  <table className="w-full text-left text-[10px] border-collapse">
                    <thead>
                      <tr className="text-slate-500 border-b border-slate-200">
                        <th className="py-1 px-1.5 w-24">Tahap</th>
                        <th className="py-1 px-1.5">Sub-Step</th>
                        <th className="py-1 px-1.5">Basis</th>
                        <th className="py-1 px-1.5 text-right w-14">Qty</th>
                        <th className="py-1 px-1.5 text-right w-16">Rate (s)</th>
                        <th className="py-1 px-1.5 text-right">Base Sec</th>
                        <th className="py-1 px-1.5 text-right">Allow Sec</th>
                        <th className="py-1 px-1.5 text-right">Allow Min</th>
                        <th className="py-1 px-1.5 text-right">Allow Hour</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {proc.subSteps.map((sub) => {
                        const subAllow =
                          mode === 'by_process'
                            ? sub.allowByProcessSec
                            : sub.allowByFinalSec;
                        return (
                          <tr key={sub.id}>
                            <td className="py-1 px-1.5 font-medium text-slate-600">
                              {translateStage(sub.stage, uiLang)}
                            </td>
                            <td className="py-1 px-1.5 text-slate-800">
                              {translateSubStepName(sub.name, uiLang)}
                            </td>
                            <td className="py-1 px-1.5 text-slate-500">
                              {translateBasis(sub.basis, uiLang)}
                            </td>
                            <td className="py-1 px-1.5 text-right font-mono-num">
                              {Number.isInteger(sub.qty) ? sub.qty : sub.qty.toFixed(2)}
                            </td>
                            <td className="py-1 px-1.5 text-right font-mono-num">{sub.rate.toFixed(3)}</td>
                            <td className="py-1 px-1.5 text-right font-mono-num">{sub.baseSec.toFixed(3)}</td>
                            <td className="py-1 px-1.5 text-right font-mono-num font-bold text-emerald-800">
                              {subAllow.toFixed(3)}
                            </td>
                            <td className="py-1 px-1.5 text-right font-mono-num">
                              {(subAllow / 60).toFixed(4)}
                            </td>
                            <td className="py-1 px-1.5 text-right font-mono-num">
                              {(subAllow / 3600).toFixed(6)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-sm overflow-auto p-4 sm:p-6 print:static print:bg-white print:p-0 print:overflow-visible">
      {/* Screen-only toolbar */}
      <div className="max-w-[1120px] mx-auto mb-4 flex flex-wrap items-center justify-between gap-3 bg-white rounded-2xl px-5 py-3 shadow-lg border border-slate-200 print:hidden">
        <div>
          <h3 className="text-sm font-bold text-slate-900">
            Pratinjau Cetak PDF Landscape (REG + SMV) — Assy {params.assyNo}
          </h3>
          <p className="text-xs text-slate-500">
            Lembar SMV otomatis dicetak pada halaman baru setelah lembar rincian REG selesai.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200">
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

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Simpan PDF / Cetak</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 cursor-pointer"
            aria-label="Tutup Pratinjau PDF"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Landscape Printable Sheet: REG First, SMV on New Page Below */}
      <div className="max-w-[1120px] mx-auto bg-white rounded-2xl shadow-xl border border-slate-200 p-8 space-y-10 print:max-w-none print:shadow-none print:border-0 print:rounded-none print:p-0 print:space-y-0">
        {renderVariantSection('reg', regCalc, smvCalc, false)}
        {renderVariantSection('smv', smvCalc, regCalc, true)}
      </div>
    </div>
  );
}
