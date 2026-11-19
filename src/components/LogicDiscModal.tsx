import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Code2,
  Disc,
  Download,
  FileCode2,
  Play,
  RotateCcw,
  ShieldCheck,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import { DEFAULT_PROCESS_DISCS, createEmptyDiscTemplateCode } from '../data/defaultProcessDiscs';
import {
  AutoCutItem,
  DiscValidationResult,
  FeederItem,
  ProcessLogicDisc,
  StdDatabase,
} from '../types/umh';
import {
  DISC_FORMAT_VERSION,
  parseUploadedDiscText,
  serializeDiscToJsFile,
  serializeDiscToJsonFile,
  validateProcessDisc,
} from '../utils/discEngine';

interface LogicDiscModalProps {
  initialDisc: Partial<ProcessLogicDisc>;
  expectedProcessId?: number;
  allowEditProcessId?: boolean;
  importSourceLabel?: string;
  stdDb: StdDatabase;
  autoCutList: AutoCutItem[];
  feederList: FeederItem[];
  onApplyDisc: (disc: ProcessLogicDisc) => void;
  onClose: () => void;
}

export function LogicDiscModal({
  initialDisc,
  expectedProcessId,
  allowEditProcessId = false,
  importSourceLabel,
  stdDb,
  autoCutList,
  feederList,
  onApplyDisc,
  onClose,
}: LogicDiscModalProps) {
  const [processId, setProcessId] = useState<number>(initialDisc.processId ?? 1);
  const [processName, setProcessName] = useState<string>(initialDisc.processName ?? '');
  const [jpName, setJpName] = useState<string>(initialDisc.jpName ?? '');
  const [weight, setWeight] = useState<string>(String(initialDisc.weight ?? 1.0));
  const [version, setVersion] = useState<string>(initialDisc.version ?? '1.0.0');
  const [description, setDescription] = useState<string>(initialDisc.description ?? '');
  const [code, setCode] = useState<string>(initialDisc.code ?? '');

  const [parseError, setParseError] = useState<string | null>(null);
  const [validation, setValidation] = useState<DiscValidationResult | null>(null);
  const [isDirtySinceCheck, setIsDirtySinceCheck] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const defaultCounterpart = DEFAULT_PROCESS_DISCS.find((d) => d.processId === processId);

  const runValidation = (override?: Partial<ProcessLogicDisc>) => {
    const candidate: Partial<ProcessLogicDisc> = {
      format: DISC_FORMAT_VERSION,
      processId: override?.processId ?? processId,
      processName: override?.processName ?? processName,
      jpName: override?.jpName ?? jpName,
      weight: override?.weight ?? parseFloat(weight),
      version: override?.version ?? version,
      description: override?.description ?? description,
      isCustomProcess: initialDisc.isCustomProcess ?? processId > 21,
      code: override?.code ?? code,
    };

    const res = validateProcessDisc(
      candidate,
      stdDb,
      autoCutList,
      feederList,
      expectedProcessId
    );
    setValidation(res);
    setIsDirtySinceCheck(false);
    return res;
  };

  useEffect(() => {
    runValidation();
  }, []);

  const markDirty = () => {
    setIsDirtySinceCheck(true);
    setParseError(null);
  };

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const text = await file.text();
    const parsed = parseUploadedDiscText(text, file.name);
    if (parsed.kind === 'error') {
      setParseError(parsed.error);
      setValidation(null);
      setIsDirtySinceCheck(true);
      return;
    }

    if (parsed.kind === 'bundle') {
      setParseError(
        'File ini merupakan Bundle Multi-Disc (.discs.json). Gunakan tombol "Import Disc / Bundle" di toolbar utama untuk mengimpor bundle.'
      );
      setValidation(null);
      setIsDirtySinceCheck(true);
      return;
    }

    const d = parsed.disc;
    const nextPid =
      expectedProcessId !== undefined && !d.processId
        ? expectedProcessId
        : Number(d.processId ?? processId);
    const nextName = d.processName || processName;
    const nextJp = d.jpName ?? jpName;
    const nextWeight = Number.isFinite(d.weight) ? Number(d.weight) : parseFloat(weight) || 1.0;
    const nextVer = d.version || version || '1.0.0';
    const nextDesc = d.description ?? description;
    const nextCode = d.code ?? '';

    if (allowEditProcessId && Number.isFinite(nextPid) && nextPid >= 1) {
      setProcessId(nextPid);
    }
    setProcessName(nextName);
    setJpName(nextJp);
    setWeight(String(nextWeight));
    setVersion(nextVer);
    setDescription(nextDesc);
    setCode(nextCode);
    setParseError(null);

    runValidation({
      processId: allowEditProcessId ? nextPid : processId,
      processName: nextName,
      jpName: nextJp,
      weight: nextWeight,
      version: nextVer,
      description: nextDesc,
      code: nextCode,
    });
  };

  const handleLoadEmptyTemplate = () => {
    const tpl = createEmptyDiscTemplateCode(processId, processName || `Proses #${processId}`);
    setCode(tpl);
    markDirty();
  };

  const handleLoadDefaultCode = () => {
    if (!defaultCounterpart) return;
    setProcessName(defaultCounterpart.processName);
    setJpName(defaultCounterpart.jpName);
    setWeight(String(defaultCounterpart.weight));
    setVersion(defaultCounterpart.version);
    setDescription(defaultCounterpart.description);
    setCode(defaultCounterpart.code);
    setParseError(null);
    runValidation({
      processId: defaultCounterpart.processId,
      processName: defaultCounterpart.processName,
      jpName: defaultCounterpart.jpName,
      weight: defaultCounterpart.weight,
      version: defaultCounterpart.version,
      description: defaultCounterpart.description,
      code: defaultCounterpart.code,
    });
  };

  const downloadFile = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportSingleJs = () => {
    const draftDisc: ProcessLogicDisc = {
      format: DISC_FORMAT_VERSION,
      processId,
      processName: processName || `Process_${processId}`,
      jpName,
      weight: parseFloat(weight) || 1.0,
      version: version || '1.0.0',
      description,
      code,
      updatedAt: new Date().toISOString(),
    };
    const safeSlug = draftDisc.processName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const pad = String(processId).padStart(2, '0');
    downloadFile(
      serializeDiscToJsFile(draftDisc),
      `Disc_${pad}_${safeSlug}.disc.js`,
      'text/javascript;charset=utf-8'
    );
  };

  const handleExportSingleJson = () => {
    const draftDisc: ProcessLogicDisc = {
      format: DISC_FORMAT_VERSION,
      processId,
      processName: processName || `Process_${processId}`,
      jpName,
      weight: parseFloat(weight) || 1.0,
      version: version || '1.0.0',
      description,
      code,
      updatedAt: new Date().toISOString(),
    };
    const safeSlug = draftDisc.processName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const pad = String(processId).padStart(2, '0');
    downloadFile(
      serializeDiscToJsonFile(draftDisc),
      `Disc_${pad}_${safeSlug}.disc.json`,
      'application/json;charset=utf-8'
    );
  };

  const canApply =
    Boolean(validation?.valid) &&
    Boolean(validation?.normalizedDisc) &&
    !isDirtySinceCheck &&
    !parseError;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 backdrop-blur-xs p-2 sm:p-4">
      <div className="glass-modal w-[96vw] max-w-6xl h-[92vh] rounded-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#1E3A8A]/10 text-[#1E3A8A] flex items-center justify-center shrink-0">
              <Disc className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-[#1E3A8A]">
                ロジックディスク検証 · Logic Disc Inspector &amp; Pre-Apply Validator
              </p>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Proses #{processId} — {processName || 'Sub-Proses Baru'}
                {importSourceLabel && (
                  <span className="ml-2 text-xs font-normal text-slate-500">
                    ({importSourceLabel})
                  </span>
                )}
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-[#1E3A8A]" />
              <span>Muat File .JS / .JSON</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".js,.disc.js,.json,.disc.json"
              onChange={handleUploadFile}
              className="hidden"
            />

            <button
              type="button"
              onClick={handleExportSingleJs}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <FileCode2 className="w-3.5 h-3.5 text-[#047857]" />
              <span>Export .disc.js</span>
            </button>

            <button
              type="button"
              onClick={handleExportSingleJson}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Export .JSON</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
              aria-label="Tutup Modal Logic Disc"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main Split Body */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row bg-[#f8fafc]">
          {/* Left: Metadata & JS Code Editor */}
          <div className="flex-1 min-w-0 flex flex-col p-5 gap-4 overflow-y-auto border-b lg:border-b-0 lg:border-r border-slate-200">
            {/* Metadata Grid */}
            <div className="rounded-xl bg-white border border-slate-200 p-4 grid grid-cols-2 sm:grid-cols-6 gap-3">
              <div className="col-span-1">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  ID Proses
                </label>
                <input
                  type="number"
                  min={1}
                  disabled={!allowEditProcessId}
                  value={processId}
                  onChange={(e) => {
                    setProcessId(parseInt(e.target.value, 10) || 1);
                    markDirty();
                  }}
                  className="w-full px-2.5 py-1.5 text-xs font-mono-num font-bold bg-slate-50 border border-slate-200 rounded-lg disabled:opacity-60"
                />
              </div>

              <div className="col-span-2 sm:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Nama Proses
                </label>
                <input
                  type="text"
                  value={processName}
                  onChange={(e) => {
                    setProcessName(e.target.value);
                    markDirty();
                  }}
                  className="w-full px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
                />
              </div>

              <div className="col-span-2 sm:col-span-1">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Nama Jepang
                </label>
                <input
                  type="text"
                  value={jpName}
                  onChange={(e) => {
                    setJpName(e.target.value);
                    markDirty();
                  }}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
                />
              </div>

              <div className="col-span-1">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Bobot
                </label>
                <input
                  type="number"
                  step="0.05"
                  value={weight}
                  onChange={(e) => {
                    setWeight(e.target.value);
                    markDirty();
                  }}
                  className="w-full px-2.5 py-1.5 text-xs font-mono-num font-semibold bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
                />
              </div>

              <div className="col-span-1">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Versi
                </label>
                <input
                  type="text"
                  value={version}
                  onChange={(e) => {
                    setVersion(e.target.value);
                    markDirty();
                  }}
                  className="w-full px-2.5 py-1.5 text-xs font-mono-num bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
                />
              </div>

              <div className="col-span-2 sm:col-span-6">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Deskripsi Metode Perhitungan
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    markDirty();
                  }}
                  placeholder="Jelaskan mekanisme atau perubahan rumus pada sub-proses ini..."
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
                />
              </div>
            </div>

            {/* Code Editor Box */}
            <div className="flex-1 min-h-[280px] flex flex-col rounded-xl bg-white border border-slate-200 overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <Code2 className="w-4 h-4 text-blue-300" />
                  <span>Kode Fungsi Perhitungan (`function calculate(ctx)`)</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleLoadEmptyTemplate}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-medium text-slate-200 cursor-pointer"
                  >
                    Template Kosong
                  </button>
                  {defaultCounterpart && (
                    <button
                      type="button"
                      onClick={handleLoadDefaultCode}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-medium text-blue-200 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Muat Default</span>
                    </button>
                  )}
                </div>
              </div>
              <textarea
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  markDirty();
                }}
                spellCheck={false}
                className="flex-1 w-full p-4 font-mono text-[12px] leading-relaxed text-slate-100 bg-[#0f172a] focus:outline-none resize-none"
                placeholder="function calculate(ctx) { ... }"
              />
            </div>
          </div>

          {/* Right: 5-Point Validation Gate & Dry-Run Preview */}
          <div className="w-full lg:w-[440px] shrink-0 flex flex-col p-5 gap-4 overflow-y-auto bg-white">
            {/* Status Header Card */}
            {parseError ? (
              <div className="rounded-xl bg-red-50 border border-red-200 p-4 flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-xs font-bold text-red-900">Gagal Membaca File Disc</h3>
                  <p className="text-xs text-red-700 mt-1 leading-relaxed">{parseError}</p>
                </div>
              </div>
            ) : isDirtySinceCheck ? (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-xs font-bold text-amber-900">
                    Perubahan Belum Divalidasi
                  </h3>
                  <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                    Klik <strong>Jalankan Validasi</strong> terlebih dahulu. Sistem hanya mengizinkan
                    Apply setelah semua 5 pemeriksaan dinyatakan OK.
                  </p>
                </div>
              </div>
            ) : validation?.valid ? (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-[#047857] shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-xs font-bold text-[#047857]">
                    Validasi OK — Format &amp; Logic Terbaca Sempurna
                  </h3>
                  <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                    Seluruh pemeriksaan sintaks, simulasi sampel, dan skema output lulus. Anda dapat
                    menekan <strong>Apply Logic Disc</strong> untuk mengaktifkan ke sistem.
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-xl bg-red-50 border border-red-200 p-4 flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-xs font-bold text-red-900">
                    Validasi Gagal — Sistem Berjalan dengan Logic Sebelumnya
                  </h3>
                  <p className="text-xs text-red-700 mt-1 leading-relaxed">
                    Perbaiki error di bawah ini dan validasi ulang sebelum dapat diterapkan.
                  </p>
                </div>
              </div>
            )}

            {/* 5 Checks List */}
            {validation && (
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-700">
                  Hasil Pemeriksaan Pra-Apply (5 Tahap)
                </div>
                <div className="divide-y divide-slate-100">
                  {validation.checks.map((chk) => (
                    <div key={chk.id} className="p-3 flex items-start gap-2.5 text-xs">
                      {chk.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-[#047857] shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0">
                        <p
                          className={`font-semibold ${
                            chk.passed ? 'text-slate-900' : 'text-red-800'
                          }`}
                        >
                          {chk.label}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5 break-words">
                          {chk.detail}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Dry-Run Simulation Output */}
            {validation?.dryRunSample && !isDirtySinceCheck && (
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-[11px] font-bold text-slate-700">
                  <span>Simulasi Output (Data Sampel)</span>
                  <span className="font-mono-num text-[#1E3A8A]">
                    Base: {validation.dryRunSample.baseSec.toFixed(3)} s
                    {validation.dryRunSample.deltaVsCurrentSec !== null && (
                      <span
                        className={`ml-1.5 ${
                          validation.dryRunSample.deltaVsCurrentSec >= 0
                            ? 'text-[#047857]'
                            : 'text-red-600'
                        }`}
                      >
                        ({validation.dryRunSample.deltaVsCurrentSec >= 0 ? '+' : ''}
                        {validation.dryRunSample.deltaVsCurrentSec.toFixed(3)}s)
                      </span>
                    )}
                  </span>
                </div>
                <div className="p-3 space-y-2">
                  <p className="text-[11px] text-slate-600">
                    Summary: <strong className="text-slate-900">{validation.dryRunSample.summaryNote || '-'}</strong>
                  </p>
                  {validation.dryRunSample.subSteps.length === 0 ? (
                    <p className="text-[11px] text-slate-500 italic">
                      0 sub-step dihasilkan (template kosong / proses tidak aktif pada sampel).
                    </p>
                  ) : (
                    <div className="max-h-48 overflow-auto rounded-lg border border-slate-200">
                      <table className="w-full text-left text-[10px] border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                            <th className="py-1.5 px-2">Tahap</th>
                            <th className="py-1.5 px-2">Sub-Step</th>
                            <th className="py-1.5 px-2 text-right">Base (s)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {validation.dryRunSample.subSteps.map((st, idx) => (
                            <tr key={idx}>
                              <td className="py-1 px-2 font-semibold text-[#1E3A8A] whitespace-nowrap">
                                {st.stage}
                              </td>
                              <td className="py-1 px-2 text-slate-800">{st.name}</td>
                              <td className="py-1 px-2 text-right font-mono-num font-semibold text-slate-900">
                                {st.baseSec.toFixed(3)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            Batal
          </button>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => runValidation()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1E3A8A] text-white text-xs font-semibold hover:bg-[#172E6E] cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Jalankan Validasi</span>
            </button>

            <button
              type="button"
              disabled={!canApply}
              onClick={() => {
                if (canApply && validation?.normalizedDisc) {
                  onApplyDisc(validation.normalizedDisc);
                }
              }}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#047857] text-white text-xs font-semibold hover:bg-[#065F46] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Apply Logic Disc ke Sistem</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
