import { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Check,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Printer,
  RefreshCw,
  Search,
  UserCheck,
  X,
} from 'lucide-react';
import { calculateUmh, getVariantResult } from '../engine/umhCalculator';
import {
  AssyRecord,
  AssyRefreshDiff,
  AutoCutItem,
  FeederItem,
  RefreshHistoryEntry,
  StdDatabase,
} from '../types/umh';
import { reEnrichPayloadWithLists } from '../utils/excelParser';
import {
  exportRefreshHistoryExcel,
  formatRefreshDateTime,
} from '../utils/refreshHistoryExporter';
import { loadLastPicName, saveLastPicName } from '../utils/storage';
import { computeAssyRefreshDiff } from '../utils/umhDiff';
import { RefreshDiffViewer } from './RefreshDiffViewer';

type RefreshStage = 'select' | 'confirm1' | 'confirm2' | 'progress' | 'preview';

interface RefreshUmhModalProps {
  records: AssyRecord[];
  stdDb: StdDatabase;
  autoCutList: AutoCutItem[];
  feederList: FeederItem[];
  onCompleteRefresh: (
    updatedMap: Map<string, AssyRecord>,
    historyEntry: RefreshHistoryEntry
  ) => void;
  onPrintPdf: (entry: RefreshHistoryEntry) => void;
  onCancelAll: () => void;
  onClose: () => void;
}

export function RefreshUmhModal({
  records,
  stdDb,
  autoCutList,
  feederList,
  onCompleteRefresh,
  onPrintPdf,
  onCancelAll,
  onClose,
}: RefreshUmhModalProps) {
  const [stage, setStage] = useState<RefreshStage>('select');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [responsibleName, setResponsibleName] = useState<string>(() => loadLastPicName());
  const [picError, setPicError] = useState(false);

  // Progress state
  const [progressCurrent, setProgressCurrent] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [currentAssyNo, setCurrentAssyNo] = useState('');
  const cancelRef = useRef(false);

  // Preview state
  const [completedEntry, setCompletedEntry] = useState<RefreshHistoryEntry | null>(null);
  const [expandedAssyIds, setExpandedAssyIds] = useState<Set<string>>(new Set());

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return records;
    return records.filter(
      (r) =>
        r.params.assyNo.toLowerCase().includes(q) ||
        r.params.customer.toLowerCase().includes(q)
    );
  }, [records, searchQuery]);

  const selectedRecords = useMemo(
    () => records.filter((r) => selectedIds.has(r.id)),
    [records, selectedIds]
  );

  const allSelected = records.length > 0 && selectedIds.size === records.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(records.map((r) => r.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAssyExpand = (assyId: string) => {
    setExpandedAssyIds((prev) => {
      const next = new Set(prev);
      if (next.has(assyId)) next.delete(assyId);
      else next.add(assyId);
      return next;
    });
  };

  const handleStartRefresh = async () => {
    const trimmedPic = responsibleName.trim();
    if (!trimmedPic) {
      setPicError(true);
      return;
    }
    setPicError(false);
    saveLastPicName(trimmedPic);

    const targets = selectedRecords;
    if (targets.length === 0) return;

    cancelRef.current = false;
    setProgressCurrent(0);
    setProgressTotal(targets.length);
    setCurrentAssyNo(targets[0].params.assyNo);
    setStage('progress');

    const updatedMap = new Map<string, AssyRecord>();
    const diffs: AssyRefreshDiff[] = [];

    for (let i = 0; i < targets.length; i++) {
      if (cancelRef.current) return;

      const beforeRec = targets[i];
      setProgressCurrent(i + 1);
      setCurrentAssyNo(beforeRec.params.assyNo);

      // Yield to browser paint so actual progress 1..X renders and Cancel button remains responsive
      await new Promise((resolve) => setTimeout(resolve, 160));
      if (cancelRef.current) return;

      const enriched = reEnrichPayloadWithLists(beforeRec, autoCutList, feederList);
      const afterCalc = calculateUmh(enriched, stdDb, autoCutList, feederList);
      const afterRec: AssyRecord = {
        ...enriched,
        updatedAt: new Date().toISOString(),
        calculation: afterCalc,
      };

      const diff = computeAssyRefreshDiff(beforeRec, afterRec);
      if (diff) {
        updatedMap.set(beforeRec.id, afterRec);
        diffs.push(diff);
      }
    }

    if (cancelRef.current) return;

    const historyEntry: RefreshHistoryEntry = {
      id: `RF-${Date.now().toString(36).toUpperCase()}-${Math.random()
        .toString(36)
        .slice(2, 6)
        .toUpperCase()}`,
      refreshedAt: new Date().toISOString(),
      responsibleName: trimmedPic,
      totalSelectedCount: targets.length,
      affectedAssyCount: diffs.length,
      unaffectedAssyCount: targets.length - diffs.length,
      affectedDiffs: diffs,
    };

    onCompleteRefresh(updatedMap, historyEntry);

    setCompletedEntry(historyEntry);
    setExpandedAssyIds(new Set(diffs.map((d) => d.assyId)));
    setStage('preview');
  };

  const handleCancelAllProgress = () => {
    cancelRef.current = true;
    onCancelAll();
  };

  // Floating Card Loading Progress View
  if (stage === 'progress') {
    const pct = progressTotal > 0 ? Math.round((progressCurrent / progressTotal) * 100) : 0;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 backdrop-blur-xs p-4 print:hidden">
        <div className="glass-modal w-full max-w-md rounded-2xl p-6 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#1E3A8A]/10 text-[#1E3A8A] flex items-center justify-center shrink-0">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[#1E3A8A]">
                  工程再計算中 · Refresh UMH
                </p>
                <h2 className="text-base font-bold text-slate-900">
                  Menghitung Ulang Database Assy
                </h2>
              </div>
            </div>
            <span className="font-mono-num text-sm font-bold text-slate-900">
              {progressCurrent} / {progressTotal}
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>
                Memproses:{' '}
                <strong className="font-mono-num text-slate-900">{currentAssyNo}</strong>
              </span>
              <span className="font-mono-num font-semibold text-[#1E3A8A]">{pct}%</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
              <div
                className="h-full bg-[#1E3A8A] rounded-full transition-all duration-150"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600">
            Jika dibatalkan, seluruh proses refresh akan dihentikan dan tidak ada perubahan yang
            disimpan ke database maupun riwayat.
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleCancelAllProgress}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Cancel All Progress</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-3 sm:p-5 print:hidden">
      <div
        className={`glass-modal w-full ${
          stage === 'preview'
            ? 'max-w-6xl max-h-[90vh]'
            : stage === 'select'
            ? 'max-w-4xl max-h-[88vh]'
            : 'max-w-xl'
        } rounded-2xl flex flex-col overflow-hidden`}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold text-[#1E3A8A]">
              一括再計算 · Refresh UMH on Database Assy
            </p>
            <h2 className="text-lg font-bold text-slate-900 mt-0.5">
              {stage === 'select' && 'Pilih Assy untuk Refresh UMH'}
              {stage === 'confirm1' && 'Konfirmasi Refresh UMH (Langkah 1 / 2)'}
              {stage === 'confirm2' && 'Konfirmasi Akhir & Penanggung Jawab (Langkah 2 / 2)'}
              {stage === 'preview' && 'Preview Perubahan UMH Terdampak'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
            aria-label="Tutup Modal Refresh UMH"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* STAGE 1: SELECT ASSY WITH CHECKBOXES */}
        {stage === 'select' && (
          <>
            <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Check className="w-3.5 h-3.5 text-[#1E3A8A]" />
                  <span>{allSelected ? 'Batal Pilih Semua' : 'Pilih Semua'}</span>
                </button>
                <span className="text-xs font-mono-num text-slate-600">
                  <strong className="text-slate-900">{selectedIds.size}</strong> dari{' '}
                  {records.length} Assy dipilih
                </span>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari Assy No / Customer..."
                  className="pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20 w-full sm:w-60"
                />
              </div>
            </div>

            <div className="flex-1 overflow-auto p-6 bg-[#f8fafc]">
              <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                      <th className="py-3 px-4 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={toggleSelectAll}
                          aria-label="Pilih Semua Assy"
                          className="w-4 h-4 rounded border-slate-300 text-[#1E3A8A] focus:ring-[#1E3A8A] cursor-pointer"
                        />
                      </th>
                      <th className="py-3 px-3">Assy Number</th>
                      <th className="py-3 px-3">Customer &amp; Metode</th>
                      <th className="py-3 px-3 text-right">CCT</th>
                      <th className="py-3 px-3 text-right">Base REG (s)</th>
                      <th className="py-3 px-3 text-right">Allow REG (s)</th>
                      <th className="py-3 px-4 text-right">Allow SMV (s)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/80 text-xs">
                    {filteredRecords.map((rec) => {
                      const isChecked = selectedIds.has(rec.id);
                      const smvCalc = getVariantResult(rec, 'smv');
                      const allowSec =
                        rec.params.allowanceMode === 'by_process'
                          ? rec.calculation.totalAllowByProcessSec
                          : rec.calculation.totalAllowByFinalSec;
                      const smvAllowSec =
                        rec.params.allowanceMode === 'by_process'
                          ? smvCalc.totalAllowByProcessSec
                          : smvCalc.totalAllowByFinalSec;

                      return (
                        <tr
                          key={rec.id}
                          onClick={() => toggleSelectOne(rec.id)}
                          className={`cursor-pointer transition-colors ${
                            isChecked ? 'bg-blue-50/50 hover:bg-blue-50/80' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td
                            className="py-3 px-4 text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleSelectOne(rec.id)}
                              aria-label={`Pilih ${rec.params.assyNo}`}
                              className="w-4 h-4 rounded border-slate-300 text-[#1E3A8A] focus:ring-[#1E3A8A] cursor-pointer"
                            />
                          </td>
                          <td className="py-3 px-3 font-bold font-mono-num text-slate-900">
                            {rec.params.assyNo}
                          </td>
                          <td className="py-3 px-3 text-slate-700">
                            <span className="font-medium text-slate-900">
                              {rec.params.customer || '-'}
                            </span>
                            <span className="text-slate-400 mx-1.5">·</span>
                            <span className="text-slate-500">
                              {rec.params.allowanceMode === 'by_process'
                                ? 'By Proses'
                                : 'By Hasil Akhir'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono-num text-slate-700">
                            {rec.params.masterCct}
                          </td>
                          <td className="py-3 px-3 text-right font-mono-num text-slate-800">
                            {rec.calculation.totalBaseSec.toFixed(2)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono-num font-bold text-[#047857]">
                            {allowSec.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono-num font-bold text-[#1E3A8A]">
                            {smvAllowSec.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-white flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={selectedIds.size === 0}
                onClick={() => setStage('confirm1')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1E3A8A] text-white text-xs font-semibold hover:bg-[#172E6E] disabled:opacity-40 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh UMH ({selectedIds.size} Assy)</span>
              </button>
            </div>
          </>
        )}

        {/* STAGE 2: 2-STEP CONFIRMATION (STEP 1) */}
        {stage === 'confirm1' && (
          <>
            <div className="p-6 space-y-4 bg-[#f8fafc]">
              <div className="rounded-xl bg-white border border-slate-200 p-4 flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-sm font-bold text-slate-900">
                    Konfirmasi Kalkulasi Ulang Parameter Terbaru
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Anda memilih{' '}
                    <strong className="font-mono-num text-slate-900">
                      {selectedRecords.length} Assy
                    </strong>{' '}
                    untuk diperiksa dan dihitung ulang terhadap <strong>Parameter STD</strong>,{' '}
                    <strong>Auto-Cut List</strong>, dan <strong>Feeder List</strong> saat ini.
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Assy yang tidak mengalami perubahan nilai UMH tidak akan dimunculkan pada
                    preview dan tidak akan diubah di database.
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-white flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setStage('select')}
                className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Kembali ke Pilihan
              </button>
              <button
                type="button"
                onClick={() => {
                  setPicError(false);
                  setStage('confirm2');
                }}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#1E3A8A] text-white text-xs font-semibold hover:bg-[#172E6E] cursor-pointer"
              >
                <span>Lanjut ke Konfirmasi Akhir</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </>
        )}

        {/* STAGE 3: 2-STEP CONFIRMATION (STEP 2) + PIC INPUT */}
        {stage === 'confirm2' && (
          <>
            <div className="p-6 space-y-4 bg-[#f8fafc]">
              <div className="rounded-xl bg-white border border-slate-200 p-4 space-y-3">
                <h3 className="text-sm font-bold text-slate-900">
                  Konfirmasi Akhir &amp; Penanggung Jawab Perubahan
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Proses ini akan memperbarui nilai STD &amp; UMH pada Database Assy hanya untuk
                  Assy yang terdampak dari{' '}
                  <strong className="font-mono-num text-slate-900">
                    {selectedRecords.length} Assy
                  </strong>{' '}
                  berikut serta mencatat log riwayat perubahan:
                </p>
                <div className="max-h-32 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-mono-num text-slate-800 space-y-1">
                  {selectedRecords.map((r, idx) => (
                    <div key={r.id} className="flex items-center justify-between">
                      <span>
                        {idx + 1}. {r.params.assyNo}
                      </span>
                      <span className="text-slate-500">{r.params.customer || '-'}</span>
                    </div>
                  ))}
                </div>

                {/* Required PIC Name Input */}
                <div className="pt-2 space-y-1.5">
                  <label
                    htmlFor="refresh-pic-name"
                    className="block text-xs font-semibold text-slate-800"
                  >
                    Nama Penanggung Jawab (PIC) Perubahan <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="refresh-pic-name"
                    type="text"
                    value={responsibleName}
                    onChange={(e) => {
                      setResponsibleName(e.target.value);
                      if (e.target.value.trim()) setPicError(false);
                    }}
                    placeholder="Masukkan nama lengkap / inisial PIC (cth: Ahmad - IE)"
                    className={`w-full px-3.5 py-2.5 text-xs bg-white border rounded-xl focus:outline-none focus:ring-2 ${
                      picError
                        ? 'border-red-500 focus:ring-red-500/20'
                        : 'border-slate-300 focus:border-[#1E3A8A] focus:ring-[#1E3A8A]/20'
                    }`}
                    autoFocus
                  />
                  {picError && (
                    <p className="text-[11px] font-medium text-red-600">
                      Nama penanggung jawab perubahan wajib diisi sebelum menjalankan refresh.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-white flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setStage('confirm1')}
                className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Kembali
              </button>
              <button
                type="button"
                onClick={handleStartRefresh}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#047857] text-white text-xs font-semibold hover:bg-[#065F46] cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Ya, Mulai Refresh UMH Sekarang</span>
              </button>
            </div>
          </>
        )}

        {/* STAGE 5: AFFECTED-ONLY CHANGE PREVIEW + EXPORT */}
        {stage === 'preview' && completedEntry && (
          <>
            <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-600">
                <span className="inline-flex items-center gap-1.5 font-semibold text-[#047857]">
                  <CheckCircle2 className="w-4 h-4" />
                  Refresh Selesai &amp; Tercatat di Riwayat
                </span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 font-mono-num text-slate-700">
                  <CalendarClock className="w-3.5 h-3.5 text-slate-400" />
                  {formatRefreshDateTime(completedEntry.refreshedAt)}
                </span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 text-slate-700">
                  <UserCheck className="w-3.5 h-3.5 text-[#1E3A8A]" />
                  PIC: <strong className="text-slate-900">{completedEntry.responsibleName}</strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Terdampak:{' '}
                  <strong className="font-mono-num text-[#1E3A8A]">
                    {completedEntry.affectedAssyCount} / {completedEntry.totalSelectedCount} Assy
                  </strong>
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => exportRefreshHistoryExcel(completedEntry)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#047857] text-white text-xs font-semibold hover:bg-[#065F46] transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Export Excel</span>
                </button>
                <button
                  type="button"
                  onClick={() => onPrintPdf(completedEntry)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#1E3A8A] text-white text-xs font-semibold hover:bg-[#172E6E] transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Export PDF</span>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-6 bg-[#f8fafc]">
              <RefreshDiffViewer
                diffs={completedEntry.affectedDiffs}
                processedCount={completedEntry.totalSelectedCount}
                expandedAssyIds={expandedAssyIds}
                onToggleAssy={toggleAssyExpand}
              />
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-white flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Selesai &amp; Tutup</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
