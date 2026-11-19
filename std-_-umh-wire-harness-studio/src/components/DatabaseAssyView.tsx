import { useMemo, useRef, useState } from 'react';
import {
  Download,
  ExternalLink,
  History,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { getVariantResult } from '../engine/umhCalculator';
import { AssyInputPayload, AssyRecord } from '../types/umh';

interface DatabaseAssyViewProps {
  records: AssyRecord[];
  hasPendingMasterChanges: boolean;
  refreshHistoryCount: number;
  externalNotice?: string | null;
  onDismissExternalNotice?: () => void;
  onOpenRefreshModal: () => void;
  onOpenHistoryModal: () => void;
  onOpenDetail: (record: AssyRecord) => void;
  onDeleteRecord: (id: string) => void;
  onImportJson: (payloads: AssyInputPayload[]) => void;
  onStartWizard: () => void;
}

export function DatabaseAssyView({
  records,
  hasPendingMasterChanges,
  refreshHistoryCount,
  externalNotice,
  onDismissExternalNotice,
  onOpenRefreshModal,
  onOpenHistoryModal,
  onOpenDetail,
  onDeleteRecord,
  onImportJson,
  onStartWizard,
}: DatabaseAssyViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return records;
    return records.filter(
      (r) =>
        r.params.assyNo.toLowerCase().includes(q) ||
        r.params.customer.toLowerCase().includes(q)
    );
  }, [records, searchQuery]);

  const handleBackupJson = () => {
    const cleanPayloads = records.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      params: r.params,
      assemblyComponents: r.assemblyComponents,
      partList: r.partList,
      ppcsList: r.ppcsList,
      assemblyCotList: r.assemblyCotList,
      terminalRatios: r.terminalRatios,
    }));
    const blob = new Blob([JSON.stringify(cleanPayloads, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `UMH_Database_Assy_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setFeedback('Backup JSON berhasil diunduh.');
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleRestoreJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        onImportJson(parsed);
        setFeedback(`Berhasil memulihkan ${parsed.length} data Assy dari JSON.`);
      } else {
        setFeedback('Format JSON tidak valid (harus berupa array data Assy).');
      }
    } catch {
      setFeedback('Gagal membaca file JSON.');
    }
    e.target.value = '';
    setTimeout(() => setFeedback(null), 3500);
  };

  return (
    <div className="space-y-5">
      <div className="glass-surface rounded-2xl p-6">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-5 border-b border-slate-200">
          <div>
            <p className="text-[11px] font-semibold text-[#1E3A8A]">
              品番データベース · Riwayat Kalkulasi
            </p>
            <h1 className="text-xl font-bold text-slate-900 mt-0.5">Database Assy</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Riwayat kalkulasi STD &amp; UMH tersimpan otomatis di penyimpanan lokal browser Anda.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari Assy No / Customer..."
                className="pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20 focus:border-[#1E3A8A] w-56 transition-colors"
              />
            </div>

            {records.length > 0 && (
              <button
                type="button"
                onClick={onOpenRefreshModal}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  hasPendingMasterChanges
                    ? 'bg-[#047857] text-white hover:bg-[#065F46] shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-800 hover:bg-slate-50'
                }`}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh UMH on Database Assy</span>
              </button>
            )}

            <button
              type="button"
              onClick={onOpenHistoryModal}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <History className="w-3.5 h-3.5 text-[#1E3A8A]" />
              <span>
                Riwayat Refresh{refreshHistoryCount > 0 ? ` (${refreshHistoryCount})` : ''}
              </span>
            </button>

            <button
              type="button"
              onClick={handleBackupJson}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Backup JSON</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Restore JSON</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleRestoreJson}
              className="hidden"
            />

            <button
              type="button"
              onClick={onStartWizard}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1E3A8A] text-white text-xs font-semibold hover:bg-[#172E6E] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Assy Baru</span>
            </button>
          </div>
        </div>

        {hasPendingMasterChanges && records.length > 0 && (
          <div className="mt-4 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-amber-900">
              <strong className="font-semibold">Perubahan Parameter STD / Auto-Cut List terdeteksi.</strong>{' '}
              Klik <strong>Refresh UMH on Database Assy</strong> untuk memilih Assy yang ingin
              dihitung ulang dan melihat pratinjau perubahannya.
            </div>
            <button
              type="button"
              onClick={onOpenRefreshModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-900 text-white text-xs font-semibold hover:bg-amber-950 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Pilih &amp; Refresh</span>
            </button>
          </div>
        )}

        {externalNotice && (
          <div className="mt-4 px-4 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-medium text-slate-800 flex items-center justify-between gap-2">
            <span>{externalNotice}</span>
            {onDismissExternalNotice && (
              <button
                type="button"
                onClick={onDismissExternalNotice}
                className="text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {feedback && (
          <div className="mt-4 px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-medium text-[#047857]">
            {feedback}
          </div>
        )}

        <div className="mt-5">
          {filteredRecords.length === 0 ? (
            <div className="py-14 text-center border border-dashed border-slate-300 rounded-2xl bg-slate-50/70">
              <p className="text-sm font-semibold text-slate-800">
                {records.length === 0
                  ? 'Belum ada data Assy tersimpan'
                  : 'Tidak ada Assy yang sesuai dengan pencarian'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Gunakan wizard Input / Konfigurasi Assy untuk menghitung Assy baru.
              </p>
              <button
                type="button"
                onClick={onStartWizard}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1E3A8A] text-white text-xs font-semibold hover:bg-[#172E6E] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Input Assy Pertama</span>
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 overflow-x-auto bg-white">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                    <th className="py-3 px-4">Assy Number</th>
                    <th className="py-3 px-4">Customer &amp; Metode</th>
                    <th className="py-3 px-4 text-right">CCT</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Std Sec (s)</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Allow Sec (s)</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Std Hour (hr)</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Allow Hour (hr)</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/80 text-sm">
                  {filteredRecords.map((rec) => {
                    const regCalc = getVariantResult(rec, 'reg');
                    const smvCalc = getVariantResult(rec, 'smv');
                    const regStdSec = regCalc.totalBaseSec;
                    const regAllowSec =
                      rec.params.allowanceMode === 'by_process'
                        ? regCalc.totalAllowByProcessSec
                        : regCalc.totalAllowByFinalSec;
                    const smvStdSec = smvCalc.totalBaseSec;
                    const smvAllowSec =
                      rec.params.allowanceMode === 'by_process'
                        ? smvCalc.totalAllowByProcessSec
                        : smvCalc.totalAllowByFinalSec;
                    const isConfirming = confirmDeleteId === rec.id;

                    return (
                      <tr
                        key={rec.id}
                        className="hover:bg-slate-50/90 transition-colors"
                      >
                        <td className="py-3 px-4 font-bold text-slate-900 font-mono-num whitespace-nowrap">
                          {rec.params.assyNo}
                        </td>
                        <td className="py-3 px-4 text-slate-700">
                          <div className="font-medium text-slate-900">{rec.params.customer || '-'}</div>
                          <div className="text-xs text-slate-500">
                            {rec.params.allowanceMode === 'by_process' ? 'By Proses' : 'By Hasil Akhir'} · PFD{' '}
                            <span className="font-mono-num">{rec.params.pfdAllowancePct}%</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono-num text-slate-700">
                          {rec.params.masterCct}
                        </td>
                        <td className="py-3 px-4 text-right font-mono-num">
                          <div className="font-semibold text-slate-800">{regStdSec.toFixed(2)}</div>
                          <div className="text-[11px] text-slate-500">SMV {smvStdSec.toFixed(2)}</div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono-num">
                          <div className="font-bold text-[#047857]">{regAllowSec.toFixed(2)}</div>
                          <div className="text-[11px] text-slate-500">SMV {smvAllowSec.toFixed(2)}</div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono-num">
                          <div className="font-semibold text-slate-800">
                            {(regStdSec / 3600).toFixed(4)}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            SMV {(smvStdSec / 3600).toFixed(4)}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono-num">
                          <div className="font-bold text-[#1E3A8A]">
                            {(regAllowSec / 3600).toFixed(4)}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            SMV {(smvAllowSec / 3600).toFixed(4)}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => onOpenDetail(rec)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition-colors whitespace-nowrap cursor-pointer"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Buka</span>
                            </button>

                            {isConfirming ? (
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    onDeleteRecord(rec.id);
                                    setConfirmDeleteId(null);
                                  }}
                                  className="px-2.5 py-1.5 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 cursor-pointer"
                                >
                                  Ya, Hapus
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="px-2 py-1.5 rounded-xl bg-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-300 cursor-pointer"
                                >
                                  Batal
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(rec.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                aria-label={`Hapus ${rec.params.assyNo}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Hapus</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
