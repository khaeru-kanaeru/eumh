import { ChevronDown, ChevronRight } from 'lucide-react';
import { AssyRefreshDiff } from '../types/umh';

interface RefreshDiffViewerProps {
  diffs: AssyRefreshDiff[];
  processedCount: number;
  expandedAssyIds: Set<string>;
  onToggleAssy: (assyId: string) => void;
}

export function formatDeltaSec(val: number, digits = 3): string {
  const sign = val > 0 ? '+' : '';
  return `${sign}${val.toFixed(digits)} s`;
}

export function RefreshDiffViewer({
  diffs,
  processedCount,
  expandedAssyIds,
  onToggleAssy,
}: RefreshDiffViewerProps) {
  if (diffs.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center space-y-2">
        <p className="text-sm font-bold text-slate-900">
          Tidak Ada Assy yang Terdampak Perubahan
        </p>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Seluruh {processedCount} Assy yang dipilih menghasilkan nilai Base Cycle dan Standard UMH
          yang identik dengan data sebelumnya. Database Assy tidak mengalami perubahan.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {diffs.map((assy) => {
        const isOpen = expandedAssyIds.has(assy.assyId);
        return (
          <div
            key={assy.assyId}
            className="rounded-2xl border border-slate-200 bg-white overflow-hidden"
          >
            {/* Affected Assy Header */}
            <button
              type="button"
              onClick={() => onToggleAssy(assy.assyId)}
              className="w-full px-5 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-left hover:bg-slate-50/80 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                {isOpen ? (
                  <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold font-mono-num text-slate-900">
                    {assy.assyNo}
                  </span>
                  <span className="text-xs text-slate-500">
                    · {assy.customer || '-'} ·{' '}
                    {assy.allowanceMode === 'by_process' ? 'By Proses' : 'By Hasil Akhir'} ·{' '}
                    <span className="font-mono-num">{assy.processDiffs.length}</span> proses
                    terdampak
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-5 text-xs font-mono-num shrink-0">
                <div>
                  <span className="text-slate-400 mr-1.5">Base:</span>
                  <span className="text-slate-500">{assy.beforeBaseSec.toFixed(3)}s</span>
                  <span className="mx-1 text-slate-400">→</span>
                  <span className="font-semibold text-slate-900">
                    {assy.afterBaseSec.toFixed(3)}s
                  </span>
                  <span
                    className={`ml-1.5 font-bold ${
                      assy.deltaBaseSec >= 0 ? 'text-[#047857]' : 'text-red-600'
                    }`}
                  >
                    ({formatDeltaSec(assy.deltaBaseSec)})
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 mr-1.5">Allow UMH:</span>
                  <span className="text-slate-500">{assy.beforeAllowSec.toFixed(3)}s</span>
                  <span className="mx-1 text-slate-400">→</span>
                  <span className="font-bold text-slate-900">
                    {assy.afterAllowSec.toFixed(3)}s
                  </span>
                  <span
                    className={`ml-1.5 font-bold ${
                      assy.deltaAllowSec >= 0 ? 'text-[#047857]' : 'text-red-600'
                    }`}
                  >
                    ({formatDeltaSec(assy.deltaAllowSec)})
                  </span>
                </div>
              </div>
            </button>

            {/* Affected Processes & Sub-Steps */}
            {isOpen && (
              <div className="border-t border-slate-200 divide-y divide-slate-200 bg-slate-50/40">
                {assy.processDiffs.map((proc) => (
                  <div key={proc.processId} className="p-4 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-bold text-slate-900">
                        <span className="font-mono-num text-[#1E3A8A] mr-1.5">
                          {proc.processId}.
                        </span>
                        {proc.processName}
                        {proc.jpName && (
                          <span className="ml-1.5 font-normal text-slate-500">
                            ({proc.jpName})
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono-num">
                        <span>
                          <span className="text-slate-500">Base: </span>
                          {proc.beforeBaseSec.toFixed(3)}s →{' '}
                          <strong>{proc.afterBaseSec.toFixed(3)}s</strong>{' '}
                          <span
                            className={`font-bold ${
                              proc.deltaBaseSec >= 0 ? 'text-[#047857]' : 'text-red-600'
                            }`}
                          >
                            ({formatDeltaSec(proc.deltaBaseSec)})
                          </span>
                        </span>
                        <span>
                          <span className="text-slate-500">Allow: </span>
                          {proc.beforeAllowSec.toFixed(3)}s →{' '}
                          <strong>{proc.afterAllowSec.toFixed(3)}s</strong>{' '}
                          <span
                            className={`font-bold ${
                              proc.deltaAllowSec >= 0 ? 'text-[#047857]' : 'text-red-600'
                            }`}
                          >
                            ({formatDeltaSec(proc.deltaAllowSec)})
                          </span>
                        </span>
                      </div>
                    </div>

                    {proc.subStepDiffs.length > 0 && (
                      <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
                        <table className="w-full text-left border-collapse text-[11px]">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                              <th className="py-2 px-3">Tahapan</th>
                              <th className="py-2 px-3">Sub-Step Terdampak</th>
                              <th className="py-2 px-3 text-right">Base Before</th>
                              <th className="py-2 px-3 text-right">Base After</th>
                              <th className="py-2 px-3 text-right">Selisih Base</th>
                              <th className="py-2 px-3 text-right">Allow Before</th>
                              <th className="py-2 px-3 text-right">Allow After</th>
                              <th className="py-2 px-3 text-right">Selisih Allow</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {proc.subStepDiffs.map((sub) => (
                              <tr key={sub.key} className="hover:bg-slate-50/70">
                                <td className="py-2 px-3 font-semibold text-[#1E3A8A] whitespace-nowrap">
                                  {sub.stage}
                                </td>
                                <td className="py-2 px-3 text-slate-800">{sub.name}</td>
                                <td className="py-2 px-3 text-right font-mono-num text-slate-500">
                                  {sub.beforeBaseSec.toFixed(3)}s
                                </td>
                                <td className="py-2 px-3 text-right font-mono-num font-semibold text-slate-900">
                                  {sub.afterBaseSec.toFixed(3)}s
                                </td>
                                <td
                                  className={`py-2 px-3 text-right font-mono-num font-bold ${
                                    sub.deltaBaseSec >= 0 ? 'text-[#047857]' : 'text-red-600'
                                  }`}
                                >
                                  {formatDeltaSec(sub.deltaBaseSec)}
                                </td>
                                <td className="py-2 px-3 text-right font-mono-num text-slate-500">
                                  {sub.beforeAllowSec.toFixed(3)}s
                                </td>
                                <td className="py-2 px-3 text-right font-mono-num font-semibold text-slate-900">
                                  {sub.afterAllowSec.toFixed(3)}s
                                </td>
                                <td
                                  className={`py-2 px-3 text-right font-mono-num font-bold ${
                                    sub.deltaAllowSec >= 0 ? 'text-[#047857]' : 'text-red-600'
                                  }`}
                                >
                                  {formatDeltaSec(sub.deltaAllowSec)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
