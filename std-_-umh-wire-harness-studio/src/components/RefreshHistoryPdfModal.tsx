import { Printer, X } from 'lucide-react';
import { RefreshHistoryEntry } from '../types/umh';
import { formatRefreshDateTime } from '../utils/refreshHistoryExporter';
import { formatDeltaSec } from './RefreshDiffViewer';

interface RefreshHistoryPdfModalProps {
  entry: RefreshHistoryEntry;
  onClose: () => void;
}

export function RefreshHistoryPdfModal({ entry, onClose }: RefreshHistoryPdfModalProps) {
  const formattedDateTime = formatRefreshDateTime(entry.refreshedAt);

  return (
    <div className="fixed inset-0 z-[75] bg-slate-900/60 backdrop-blur-sm overflow-auto p-4 sm:p-6 print:static print:bg-white print:p-0 print:overflow-visible">
      {/* Screen-only toolbar */}
      <div className="max-w-[1120px] mx-auto mb-4 flex items-center justify-between bg-white rounded-2xl px-5 py-3 shadow-lg border border-slate-200 print:hidden">
        <div>
          <h3 className="text-sm font-bold text-slate-900">
            Pratinjau Cetak PDF Landscape — Laporan Perubahan Refresh UMH
          </h3>
          <p className="text-xs text-slate-500">
            Pilih destinasi &ldquo;Save as PDF&rdquo; dan orientasi Landscape pada dialog cetak browser.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1E3A8A] text-white text-xs font-semibold hover:bg-[#172E6E] cursor-pointer"
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

      {/* Landscape Printable Sheet */}
      <div className="max-w-[1120px] mx-auto bg-white rounded-2xl shadow-xl border border-slate-200 p-8 space-y-6 print:max-w-none print:shadow-none print:border-0 print:rounded-none print:p-0">
        {/* Report Banner */}
        <div className="bg-slate-900 text-white rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs text-slate-300">
              STD / UMH Wire Harness Studio · Audit Log Pembaruan Standar Waktu
            </p>
            <h1 className="text-xl font-bold mt-1">
              LAPORAN RIWAYAT PERUBAHAN REFRESH UMH
            </h1>
            <p className="text-xs text-slate-300 mt-1">
              Penanggung Jawab (PIC): <strong className="text-white">{entry.responsibleName}</strong>
            </p>
          </div>
          <div className="text-left sm:text-right text-xs text-slate-300 font-mono-num space-y-0.5">
            <div>Tanggal &amp; Waktu: {formattedDateTime}</div>
            <div>Log ID: {entry.id}</div>
            <div>
              Status: {entry.affectedAssyCount} Assy Terdampak / {entry.totalSelectedCount} Diproses
            </div>
          </div>
        </div>

        {/* 4 Summary KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="border border-slate-200 rounded-xl p-3.5">
            <p className="text-[11px] text-slate-500">Penanggung Jawab (PIC)</p>
            <p className="text-sm font-bold text-slate-900 mt-1 truncate">
              {entry.responsibleName}
            </p>
            <p className="text-[11px] font-mono-num text-slate-500 mt-0.5">{formattedDateTime}</p>
          </div>
          <div className="border border-slate-200 rounded-xl p-3.5">
            <p className="text-[11px] text-slate-500">Total Assy Diproses</p>
            <p className="text-lg font-bold font-mono-num text-slate-900 mt-1">
              {entry.totalSelectedCount} Assy
            </p>
          </div>
          <div className="border border-emerald-300 bg-emerald-50/50 rounded-xl p-3.5">
            <p className="text-[11px] text-emerald-800">Assy Terdampak Perubahan</p>
            <p className="text-lg font-bold font-mono-num text-emerald-900 mt-1">
              {entry.affectedAssyCount} Assy
            </p>
          </div>
          <div className="border border-slate-200 rounded-xl p-3.5">
            <p className="text-[11px] text-slate-500">Tidak Terdampak (Tetap)</p>
            <p className="text-lg font-bold font-mono-num text-slate-700 mt-1">
              {entry.unaffectedAssyCount} Assy
            </p>
          </div>
        </div>

        {/* Summary Table of Affected Assys */}
        <div>
          <h2 className="text-sm font-bold text-slate-900 mb-2">
            Ringkasan Assy Terdampak Perubahan ({entry.affectedAssyCount} Assy)
          </h2>
          {entry.affectedDiffs.length === 0 ? (
            <div className="border border-slate-200 rounded-xl p-6 text-center text-xs text-slate-500">
              Tidak ada Assy yang mengalami perubahan nilai pada eksekusi refresh ini.
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-[11px]">
              <thead>
                <tr className="bg-slate-100 border-y border-slate-300 text-slate-700">
                  <th className="py-2 px-2 w-8 text-center">No</th>
                  <th className="py-2 px-2">Assy Number</th>
                  <th className="py-2 px-2">Customer &amp; Metode</th>
                  <th className="py-2 px-2 text-center">Proses</th>
                  <th className="py-2 px-2 text-right">Base Before (s)</th>
                  <th className="py-2 px-2 text-right">Base After (s)</th>
                  <th className="py-2 px-2 text-right">Selisih Base (s)</th>
                  <th className="py-2 px-2 text-right">Allow Before (s)</th>
                  <th className="py-2 px-2 text-right">Allow After (s)</th>
                  <th className="py-2 px-2 text-right">Selisih Allow (s)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {entry.affectedDiffs.map((assy, idx) => (
                  <tr key={assy.assyId}>
                    <td className="py-1.5 px-2 text-center font-mono-num">{idx + 1}</td>
                    <td className="py-1.5 px-2 font-bold font-mono-num text-slate-900">
                      {assy.assyNo}
                    </td>
                    <td className="py-1.5 px-2 text-slate-700">
                      {assy.customer || '-'} ·{' '}
                      {assy.allowanceMode === 'by_process' ? 'By Proses' : 'By Hasil Akhir'}
                    </td>
                    <td className="py-1.5 px-2 text-center font-mono-num">
                      {assy.processDiffs.length}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono-num text-slate-600">
                      {assy.beforeBaseSec.toFixed(3)}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono-num font-semibold text-slate-900">
                      {assy.afterBaseSec.toFixed(3)}
                    </td>
                    <td
                      className={`py-1.5 px-2 text-right font-mono-num font-bold ${
                        assy.deltaBaseSec >= 0 ? 'text-emerald-700' : 'text-red-600'
                      }`}
                    >
                      {formatDeltaSec(assy.deltaBaseSec)}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono-num text-slate-600">
                      {assy.beforeAllowSec.toFixed(3)}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono-num font-semibold text-slate-900">
                      {assy.afterAllowSec.toFixed(3)}
                    </td>
                    <td
                      className={`py-1.5 px-2 text-right font-mono-num font-bold ${
                        assy.deltaAllowSec >= 0 ? 'text-emerald-700' : 'text-red-600'
                      }`}
                    >
                      {formatDeltaSec(assy.deltaAllowSec)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Detailed Processes & Sub-Steps per Affected Assy */}
        {entry.affectedDiffs.length > 0 && (
          <div className="pt-4 border-t border-slate-300 space-y-5">
            <h2 className="text-sm font-bold text-slate-900">
              Rincian Perubahan per Assy, Proses &amp; Sub-Step Terdampak
            </h2>

            <div className="space-y-4">
              {entry.affectedDiffs.map((assy) => (
                <div key={assy.assyId} className="border border-slate-300 rounded-xl p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
                    <div>
                      <span className="text-sm font-bold font-mono-num text-slate-900">
                        {assy.assyNo}
                      </span>
                      <span className="ml-2 text-xs text-slate-600">
                        {assy.customer || '-'} ·{' '}
                        {assy.allowanceMode === 'by_process' ? 'By Proses' : 'By Hasil Akhir'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono-num">
                      <span>
                        Base: {assy.beforeBaseSec.toFixed(3)}s →{' '}
                        <strong>{assy.afterBaseSec.toFixed(3)}s</strong> (
                        {formatDeltaSec(assy.deltaBaseSec)})
                      </span>
                      <span>
                        Allow: {assy.beforeAllowSec.toFixed(3)}s →{' '}
                        <strong>{assy.afterAllowSec.toFixed(3)}s</strong> (
                        {formatDeltaSec(assy.deltaAllowSec)})
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {assy.processDiffs.map((proc) => (
                      <div
                        key={proc.processId}
                        className="border border-slate-200 rounded-lg p-3 break-inside-avoid"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                          <h3 className="text-xs font-bold text-[#1E3A8A]">
                            {proc.processId}. {proc.processName}
                            {proc.jpName && (
                              <span className="ml-1.5 font-normal text-slate-500">
                                ({proc.jpName})
                              </span>
                            )}
                          </h3>
                          <div className="flex items-center gap-3 text-[10px] font-mono-num text-slate-700">
                            <span>
                              Base: {proc.beforeBaseSec.toFixed(3)}s →{' '}
                              <strong>{proc.afterBaseSec.toFixed(3)}s</strong> (
                              {formatDeltaSec(proc.deltaBaseSec)})
                            </span>
                            <span>
                              Allow: {proc.beforeAllowSec.toFixed(3)}s →{' '}
                              <strong>{proc.afterAllowSec.toFixed(3)}s</strong> (
                              {formatDeltaSec(proc.deltaAllowSec)})
                            </span>
                          </div>
                        </div>

                        {proc.subStepDiffs.length > 0 && (
                          <table className="w-full text-left border-collapse text-[10px]">
                            <thead>
                              <tr className="bg-slate-50 border-y border-slate-200 text-slate-600">
                                <th className="py-1 px-2">Tahapan</th>
                                <th className="py-1 px-2">Sub-Step Terdampak</th>
                                <th className="py-1 px-2 text-right">Base Before</th>
                                <th className="py-1 px-2 text-right">Base After</th>
                                <th className="py-1 px-2 text-right">Selisih Base</th>
                                <th className="py-1 px-2 text-right">Allow Before</th>
                                <th className="py-1 px-2 text-right">Allow After</th>
                                <th className="py-1 px-2 text-right">Selisih Allow</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {proc.subStepDiffs.map((sub) => (
                                <tr key={sub.key}>
                                  <td className="py-1 px-2 font-semibold text-slate-700 whitespace-nowrap">
                                    {sub.stage}
                                  </td>
                                  <td className="py-1 px-2 text-slate-900">{sub.name}</td>
                                  <td className="py-1 px-2 text-right font-mono-num text-slate-500">
                                    {sub.beforeBaseSec.toFixed(3)}s
                                  </td>
                                  <td className="py-1 px-2 text-right font-mono-num font-semibold text-slate-900">
                                    {sub.afterBaseSec.toFixed(3)}s
                                  </td>
                                  <td
                                    className={`py-1 px-2 text-right font-mono-num font-bold ${
                                      sub.deltaBaseSec >= 0 ? 'text-emerald-700' : 'text-red-600'
                                    }`}
                                  >
                                    {formatDeltaSec(sub.deltaBaseSec)}
                                  </td>
                                  <td className="py-1 px-2 text-right font-mono-num text-slate-500">
                                    {sub.beforeAllowSec.toFixed(3)}s
                                  </td>
                                  <td className="py-1 px-2 text-right font-mono-num font-semibold text-slate-900">
                                    {sub.afterAllowSec.toFixed(3)}s
                                  </td>
                                  <td
                                    className={`py-1 px-2 text-right font-mono-num font-bold ${
                                      sub.deltaAllowSec >= 0 ? 'text-emerald-700' : 'text-red-600'
                                    }`}
                                  >
                                    {formatDeltaSec(sub.deltaAllowSec)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
