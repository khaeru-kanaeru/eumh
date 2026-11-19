import { useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  FileSpreadsheet,
  History,
  Printer,
  Search,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import { RefreshHistoryEntry } from '../types/umh';
import {
  exportRefreshHistoryExcel,
  formatRefreshDateTime,
} from '../utils/refreshHistoryExporter';
import { RefreshDiffViewer } from './RefreshDiffViewer';

interface RefreshHistoryModalProps {
  history: RefreshHistoryEntry[];
  onDeleteEntry: (id: string) => void;
  onClearAll: () => void;
  onPrintPdf: (entry: RefreshHistoryEntry) => void;
  onClose: () => void;
}

export function RefreshHistoryModal({
  history,
  onDeleteEntry,
  onClearAll,
  onPrintPdf,
  onClose,
}: RefreshHistoryModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(() => history[0]?.id ?? null);
  const [expandedAssyIds, setExpandedAssyIds] = useState<Set<string>>(() =>
    new Set(history[0]?.affectedDiffs.map((d) => d.assyId) ?? [])
  );
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const filteredHistory = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return history;
    return history.filter((entry) => {
      const timeStr = formatRefreshDateTime(entry.refreshedAt).toLowerCase();
      const picMatch = entry.responsibleName.toLowerCase().includes(q);
      const timeMatch = timeStr.includes(q);
      const assyMatch = entry.affectedDiffs.some(
        (d) =>
          d.assyNo.toLowerCase().includes(q) || d.customer.toLowerCase().includes(q)
      );
      return picMatch || timeMatch || assyMatch;
    });
  }, [history, searchQuery]);

  const selectedEntry = useMemo(() => {
    if (filteredHistory.length === 0) return null;
    return filteredHistory.find((e) => e.id === selectedId) ?? filteredHistory[0];
  }, [filteredHistory, selectedId]);

  useEffect(() => {
    if (selectedEntry) {
      setExpandedAssyIds(new Set(selectedEntry.affectedDiffs.map((d) => d.assyId)));
    } else {
      setExpandedAssyIds(new Set());
    }
  }, [selectedEntry?.id]);

  const toggleAssyExpand = (assyId: string) => {
    setExpandedAssyIds((prev) => {
      const next = new Set(prev);
      if (next.has(assyId)) next.delete(assyId);
      else next.add(assyId);
      return next;
    });
  };

  const allExpanded =
    Boolean(selectedEntry) &&
    selectedEntry!.affectedDiffs.length > 0 &&
    expandedAssyIds.size === selectedEntry!.affectedDiffs.length;

  const toggleExpandAll = () => {
    if (!selectedEntry) return;
    if (allExpanded) {
      setExpandedAssyIds(new Set());
    } else {
      setExpandedAssyIds(new Set(selectedEntry.affectedDiffs.map((d) => d.assyId)));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-2 sm:p-4 print:hidden">
      <div className="glass-modal w-[96vw] max-w-7xl h-[90vh] rounded-2xl flex flex-col overflow-hidden">
        {/* Top Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#1E3A8A]/10 text-[#1E3A8A] flex items-center justify-center shrink-0">
              <History className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-[#1E3A8A]">
                変更履歴ログ · Riwayat Perubahan Update Refresh UMH
              </p>
              <h2 className="text-lg font-bold text-slate-900">
                Riwayat &amp; Audit Perubahan UMH
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {history.length > 0 && (
              confirmClearAll ? (
                <div className="inline-flex items-center gap-1.5 bg-red-50 border border-red-200 px-2.5 py-1.5 rounded-xl">
                  <span className="text-xs font-medium text-red-700">Hapus semua log?</span>
                  <button
                    type="button"
                    onClick={() => {
                      onClearAll();
                      setConfirmClearAll(false);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 cursor-pointer"
                  >
                    Ya
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClearAll(false)}
                    className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-50 cursor-pointer"
                  >
                    Batal
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmClearAll(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Bersihkan Riwayat</span>
                </button>
              )
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
              aria-label="Tutup Riwayat Refresh UMH"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body: Master-Detail Split */}
        {history.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-8 bg-[#f8fafc]">
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 max-w-md text-center space-y-2.5">
              <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
                <History className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                Belum Ada Riwayat Refresh UMH
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Setiap kali Anda menjalankan <strong>Refresh UMH on Database Assy</strong>, tanggal,
                waktu, nama penanggung jawab, serta detail perubahan per Assy, proses, dan sub-step
                akan tercatat otomatis di sini dan siap diekspor ke Excel maupun PDF.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col lg:flex-row bg-[#f8fafc]">
            {/* Left Sidebar: History List */}
            <aside className="w-full lg:w-84 shrink-0 border-b lg:border-b-0 lg:border-r border-slate-200 bg-white flex flex-col max-h-64 lg:max-h-none">
              <div className="p-3.5 border-b border-slate-200">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari PIC, Assy No, tanggal..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                {filteredHistory.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    Tidak ada riwayat yang cocok dengan pencarian.
                  </div>
                ) : (
                  filteredHistory.map((entry) => {
                    const isSelected = selectedEntry?.id === entry.id;
                    const isConfirming = confirmDeleteId === entry.id;

                    return (
                      <div
                        key={entry.id}
                        onClick={() => {
                          setSelectedId(entry.id);
                          setConfirmDeleteId(null);
                        }}
                        className={`p-3.5 cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-blue-50/70 border-l-3 border-l-[#1E3A8A]'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-1.5 text-[11px] font-mono-num font-semibold text-slate-900">
                              <CalendarClock className="w-3.5 h-3.5 text-[#1E3A8A] shrink-0" />
                              <span className="truncate">
                                {formatRefreshDateTime(entry.refreshedAt)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                              <UserCheck className="w-3.5 h-3.5 text-[#047857] shrink-0" />
                              <span className="truncate">{entry.responsibleName}</span>
                            </div>
                          </div>

                          <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                            {isConfirming ? (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    onDeleteEntry(entry.id);
                                    setConfirmDeleteId(null);
                                  }}
                                  className="px-2 py-0.5 rounded-lg bg-red-600 text-white text-[10px] font-semibold hover:bg-red-700 cursor-pointer"
                                >
                                  Hapus
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="px-1.5 py-0.5 rounded-lg bg-slate-200 text-slate-700 text-[10px] cursor-pointer"
                                >
                                  Batal
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(entry.id)}
                                className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                aria-label="Hapus entri riwayat"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="mt-2 flex items-center justify-between text-[11px] font-mono-num text-slate-500">
                          <span>
                            Terdampak:{' '}
                            <strong
                              className={
                                entry.affectedAssyCount > 0 ? 'text-[#047857]' : 'text-slate-700'
                              }
                            >
                              {entry.affectedAssyCount}
                            </strong>{' '}
                            / {entry.totalSelectedCount} Assy
                          </span>
                          {entry.affectedAssyCount > 0 && (
                            <span className="text-[#1E3A8A] font-medium truncate max-w-[130px]">
                              {entry.affectedDiffs.map((d) => d.assyNo).join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </aside>

            {/* Right Detail Panel */}
            <section className="flex-1 min-w-0 overflow-y-auto p-5 sm:p-6 space-y-5">
              {selectedEntry && (
                <>
                  {/* Metadata & Export Bar */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
                    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1 font-semibold text-[#047857]">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Log Tersimpan
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-num">ID: {selectedEntry.id}</span>
                        </div>
                        <h3 className="text-base font-bold text-slate-900">
                          Detail Pembaruan Refresh UMH
                        </h3>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {selectedEntry.affectedDiffs.length > 0 && (
                          <button
                            type="button"
                            onClick={toggleExpandAll}
                            className="px-3 py-2 rounded-xl bg-slate-100 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                          >
                            {allExpanded ? 'Tutup Semua Assy' : 'Buka Semua Assy'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => exportRefreshHistoryExcel(selectedEntry)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#047857] text-white text-xs font-semibold hover:bg-[#065F46] transition-colors cursor-pointer"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5" />
                          <span>Export Excel</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onPrintPdf(selectedEntry)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1E3A8A] text-white text-xs font-semibold hover:bg-[#172E6E] transition-colors cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Export PDF</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
                      <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3">
                        <p className="text-[11px] text-slate-500">Tanggal &amp; Waktu</p>
                        <p className="text-xs font-bold font-mono-num text-slate-900 mt-1">
                          {formatRefreshDateTime(selectedEntry.refreshedAt)}
                        </p>
                      </div>
                      <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3">
                        <p className="text-[11px] text-slate-500">Penanggung Jawab (PIC)</p>
                        <p className="text-xs font-bold text-slate-900 mt-1 truncate">
                          {selectedEntry.responsibleName}
                        </p>
                      </div>
                      <div className="rounded-xl bg-emerald-50/70 border border-emerald-200 p-3">
                        <p className="text-[11px] text-emerald-800">Assy Terdampak</p>
                        <p className="text-sm font-bold font-mono-num text-[#047857] mt-0.5">
                          {selectedEntry.affectedAssyCount} / {selectedEntry.totalSelectedCount}{' '}
                          Assy
                        </p>
                      </div>
                      <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3">
                        <p className="text-[11px] text-slate-500">Tidak Terdampak (Tetap)</p>
                        <p className="text-sm font-bold font-mono-num text-slate-700 mt-0.5">
                          {selectedEntry.unaffectedAssyCount} Assy
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Detailed Diff Preview */}
                  <RefreshDiffViewer
                    diffs={selectedEntry.affectedDiffs}
                    processedCount={selectedEntry.totalSelectedCount}
                    expandedAssyIds={expandedAssyIds}
                    onToggleAssy={toggleAssyExpand}
                  />
                </>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
