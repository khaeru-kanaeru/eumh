import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Code2,
  Disc,
  Download,
  FileCode2,
  Grid3X3,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  Trash2,
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
  serializeAllDiscsBundle,
  serializeDiscToJsFile,
  serializeDiscToJsonFile,
  validateProcessDisc,
} from '../utils/discEngine';
import { LogicDiscModal } from './LogicDiscModal';

interface StdParamsViewProps {
  stdDb: StdDatabase;
  autoCutList: AutoCutItem[];
  feederList: FeederItem[];
  onSaveStdDb: (db: StdDatabase) => void;
  onResetDefault: () => StdDatabase;
}

const COL_LABELS_7 = ['0~1000', '1001~2000', '2001~3000', '3001~4000', '4001~5000', '5001~6000', '6001~'];
const COL_LABELS_4 = ['0~1000', '1001~2000', '2001~5000', '5001~'];

const AC_ROW_LABELS = ['LOT 1~10', 'LOT 11~20', 'LOT 21~30', 'LOT 31~40', 'LOT 41~50', 'LOT 51~'];
const SA_ROW_LABELS = ['LOT 1~5', 'LOT 6~10', 'LOT 11~20', 'LOT 21~30', 'LOT 31~40', 'LOT 41~50', 'LOT 51~'];
const MC_ROW_LABELS = ['LOT 1~3', 'LOT 4~5', 'LOT 6~10', 'LOT 11~20', 'LOT 21~30', 'LOT 31~40', 'LOT 41~50', 'LOT 51~'];

export function StdParamsView({
  stdDb,
  autoCutList,
  feederList,
  onSaveStdDb,
  onResetDefault,
}: StdParamsViewProps) {
  const [draft, setDraft] = useState<StdDatabase>(() => ({
    ...structuredClone(stdDb),
    processDiscs: structuredClone(stdDb.processDiscs ?? DEFAULT_PROCESS_DISCS),
  }));
  const [viewMode, setViewMode] = useState<'substeps' | 'matrices' | 'discs'>('substeps');
  const [selectedSheet, setSelectedSheet] = useState<string>('ALL');
  const [selectedMatrix, setSelectedMatrix] = useState<'acMatrix' | 'saMatrix' | 'mcMatrix'>('acMatrix');
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmResetDiscs, setConfirmResetDiscs] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [discError, setDiscError] = useState<string | null>(null);
  const [showFormatGuide, setShowFormatGuide] = useState(false);

  // Logic Disc Inspector / Validator Modal state
  const [editingDiscModal, setEditingDiscModal] = useState<{
    initialDisc: Partial<ProcessLogicDisc>;
    expectedProcessId?: number;
    allowEditProcessId: boolean;
    sourceLabel?: string;
  } | null>(null);

  // Bundle Validation Modal state
  const [bundleValidation, setBundleValidation] = useState<{
    fileName: string;
    results: { raw: Partial<ProcessLogicDisc>; validation: DiscValidationResult }[];
  } | null>(null);

  const globalDiscImportRef = useRef<HTMLInputElement>(null);
  const rowDiscImportRef = useRef<HTMLInputElement>(null);
  const [rowImportTargetId, setRowImportTargetId] = useState<number | null>(null);

  useEffect(() => {
    setDraft({
      ...structuredClone(stdDb),
      processDiscs: structuredClone(stdDb.processDiscs ?? DEFAULT_PROCESS_DISCS),
    });
  }, [stdDb]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const sheets = useMemo(
    () => Array.from(new Set(draft.params.map((p) => p.sheet))),
    [draft.params]
  );

  const filteredParams = useMemo(() => {
    if (selectedSheet === 'ALL') return draft.params;
    return draft.params.filter((p) => p.sheet === selectedSheet);
  }, [draft.params, selectedSheet]);

  const sortedDiscs = useMemo(
    () =>
      [...(draft.processDiscs ?? DEFAULT_PROCESS_DISCS)].sort(
        (a, b) => a.processId - b.processId
      ),
    [draft.processDiscs]
  );

  const handleParamChange = (id: string, val: string) => {
    const num = parseFloat(val);
    setDraft((prev) => ({
      ...prev,
      params: prev.params.map((p) =>
        p.id === id ? { ...p, val: Number.isFinite(num) ? num : 0 } : p
      ),
    }));
  };

  const handleMatrixCellChange = (
    matrixKey: 'acMatrix' | 'saMatrix' | 'mcMatrix',
    rIdx: number,
    cIdx: number,
    val: string
  ) => {
    const num = parseFloat(val);
    setDraft((prev) => ({
      ...prev,
      [matrixKey]: prev[matrixKey].map((row, ri) =>
        ri === rIdx
          ? row.map((cell, ci) => (ci === cIdx ? (Number.isFinite(num) ? num : 0) : cell))
          : row
      ),
    }));
  };

  const handleSave = () => {
    onSaveStdDb(draft);
    showToast('Seluruh Database STD, Matriks 2D & Logic Disc tersimpan!');
  };

  const handleConfirmReset = () => {
    const fresh = onResetDefault();
    setDraft({
      ...structuredClone(fresh),
      processDiscs: structuredClone(fresh.processDiscs ?? DEFAULT_PROCESS_DISCS),
    });
    setConfirmReset(false);
    showToast('STD, Matriks 2D & Logic Disc di-reset ke default tervalidasi.');
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

  const handleApplyValidatedDisc = (validated: ProcessLogicDisc) => {
    const currentList = [...(draft.processDiscs ?? DEFAULT_PROCESS_DISCS)];
    const existsIdx = currentList.findIndex((d) => d.processId === validated.processId);
    const nextDiscs =
      existsIdx >= 0
        ? currentList.map((d, idx) => (idx === existsIdx ? validated : d))
        : [...currentList, validated].sort((a, b) => a.processId - b.processId);

    const nextDb: StdDatabase = {
      ...draft,
      processDiscs: nextDiscs,
    };
    setDraft(nextDb);
    onSaveStdDb(nextDb);
    setEditingDiscModal(null);
    setDiscError(null);
    showToast(
      `Logic Disc #${validated.processId} (${validated.processName}) lulus validasi & aktif diterapkan!`
    );
  };

  const handleResetSingleDisc = (pid: number) => {
    const def = DEFAULT_PROCESS_DISCS.find((d) => d.processId === pid);
    if (!def) return;
    const nextDiscs = (draft.processDiscs ?? DEFAULT_PROCESS_DISCS).map((d) =>
      d.processId === pid ? structuredClone(def) : d
    );
    const nextDb: StdDatabase = { ...draft, processDiscs: nextDiscs };
    setDraft(nextDb);
    onSaveStdDb(nextDb);
    showToast(`Logic Disc #${pid} (${def.processName}) dikembalikan ke default.`);
  };

  const handleDeleteCustomDisc = (pid: number) => {
    const nextDiscs = (draft.processDiscs ?? DEFAULT_PROCESS_DISCS).filter(
      (d) => d.processId !== pid
    );
    const nextDb: StdDatabase = { ...draft, processDiscs: nextDiscs };
    setDraft(nextDb);
    onSaveStdDb(nextDb);
    showToast(`Sub-Proses kustom #${pid} dihapus.`);
  };

  const handleResetAllDiscs = () => {
    const nextDb: StdDatabase = {
      ...draft,
      processDiscs: structuredClone(DEFAULT_PROCESS_DISCS),
    };
    setDraft(nextDb);
    onSaveStdDb(nextDb);
    setConfirmResetDiscs(false);
    showToast('Seluruh Logic Disc dikembalikan ke default tervalidasi.');
  };

  const handleGlobalImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setDiscError(null);
    const text = await file.text();
    const parsed = parseUploadedDiscText(text, file.name);

    if (parsed.kind === 'error') {
      setDiscError(`Gagal membaca "${file.name}": ${parsed.error}`);
      return;
    }

    if (parsed.kind === 'single') {
      setEditingDiscModal({
        initialDisc: parsed.disc,
        allowEditProcessId: true,
        sourceLabel: `Import: ${file.name}`,
      });
      return;
    }

    // Bundle validation
    const results = parsed.discs.map((raw) => ({
      raw,
      validation: validateProcessDisc(raw, draft, autoCutList, feederList),
    }));
    setBundleValidation({
      fileName: file.name,
      results,
    });
  };

  const handleRowImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || rowImportTargetId === null) return;

    setDiscError(null);
    const text = await file.text();
    const parsed = parseUploadedDiscText(text, file.name);

    if (parsed.kind === 'error') {
      setDiscError(`Gagal membaca "${file.name}": ${parsed.error}`);
      return;
    }

    if (parsed.kind === 'bundle') {
      setDiscError(
        `File "${file.name}" adalah bundle multi-disc. Gunakan tombol "Import Disc / Bundle" di toolbar atas.`
      );
      return;
    }

    const targetDisc = sortedDiscs.find((d) => d.processId === rowImportTargetId);
    setEditingDiscModal({
      initialDisc: {
        ...parsed.disc,
        processId: parsed.disc.processId || rowImportTargetId,
        processName: parsed.disc.processName || targetDisc?.processName || '',
      },
      expectedProcessId: rowImportTargetId,
      allowEditProcessId: false,
      sourceLabel: `Import ke Slot #${rowImportTargetId}: ${file.name}`,
    });
  };

  const handleApplyValidatedBundle = () => {
    if (!bundleValidation) return;
    if (!bundleValidation.results.every((r) => r.validation.valid && r.validation.normalizedDisc)) {
      return;
    }

    const nextMap = new Map<number, ProcessLogicDisc>();
    sortedDiscs.forEach((d) => nextMap.set(d.processId, d));
    bundleValidation.results.forEach(({ validation }) => {
      if (validation.normalizedDisc) {
        nextMap.set(validation.normalizedDisc.processId, validation.normalizedDisc);
      }
    });

    const nextDiscs = Array.from(nextMap.values()).sort((a, b) => a.processId - b.processId);
    const nextDb: StdDatabase = { ...draft, processDiscs: nextDiscs };
    setDraft(nextDb);
    onSaveStdDb(nextDb);
    setBundleValidation(null);
    showToast(
      `${bundleValidation.results.length} Logic Disc dari bundle "${bundleValidation.fileName}" lulus validasi & aktif diterapkan!`
    );
  };

  const handleCreateNewDiscSlot = () => {
    const maxId = sortedDiscs.reduce((m, d) => Math.max(m, d.processId), 21);
    const nextId = maxId + 1;
    setEditingDiscModal({
      initialDisc: {
        format: DISC_FORMAT_VERSION,
        processId: nextId,
        processName: `Custom Process ${nextId}`,
        jpName: 'カスタム工程',
        weight: 1.0,
        version: '1.0.0',
        description: 'Sub-proses baru berbasis Logic Disc.',
        isEmptyTemplate: true,
        isCustomProcess: true,
        code: createEmptyDiscTemplateCode(nextId, `Custom Process ${nextId}`),
      },
      allowEditProcessId: true,
      sourceLabel: 'Sub-Proses Baru',
    });
  };

  const matrixMeta =
    selectedMatrix === 'acMatrix'
      ? {
          title: 'Matriks 2D Autocutting (Detik/CCT: LOT × Panjang Kabel)',
          rowLabels: AC_ROW_LABELS,
          colLabels: COL_LABELS_7,
          data: draft.acMatrix,
        }
      : selectedMatrix === 'saMatrix'
      ? {
          title: 'Matriks 2D Semi-autocutting (Detik/CCT: LOT × Panjang Kabel)',
          rowLabels: SA_ROW_LABELS,
          colLabels: COL_LABELS_7,
          data: draft.saMatrix,
        }
      : {
          title: 'Matriks 2D Manual-（Air）cutting (Detik/CCT: LOT × Panjang Kabel)',
          rowLabels: MC_ROW_LABELS,
          colLabels: COL_LABELS_4,
          data: draft.mcMatrix,
        };

  return (
    <div className="space-y-5">
      <div className="glass-surface rounded-2xl p-6">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-5 border-b border-slate-200">
          <div>
            <p className="text-[11px] font-semibold text-[#1E3A8A]">
              標準時間マスタ · Konstanta, Matriks 2D &amp; Logic Disc
            </p>
            <h1 className="text-xl font-bold text-slate-900 mt-0.5">
              Database Parameter STD (Time by Second)
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Kelola konstanta detik sub-step, matriks 2D, serta modul Logic Disc per sub-proses
              secara bongkar-pasang.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex flex-wrap items-center p-1 rounded-xl bg-slate-100 border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('substeps')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  viewMode === 'substeps'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Parameter Sub-Step ({draft.params.length})
              </button>
              <button
                type="button"
                onClick={() => setViewMode('matrices')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  viewMode === 'matrices'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Grid3X3 className="w-3.5 h-3.5" />
                <span>Matriks 2D (3)</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('discs')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  viewMode === 'discs'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Disc className="w-3.5 h-3.5 text-[#1E3A8A]" />
                <span>Logic Disc Sub-Proses ({sortedDiscs.length})</span>
              </button>
            </div>

            {confirmReset ? (
              <div className="inline-flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleConfirmReset}
                  className="px-3 py-2 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 cursor-pointer"
                >
                  Konfirmasi Reset
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="px-3 py-2 rounded-xl bg-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-300 cursor-pointer"
                >
                  Batal
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Default</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1E3A8A] text-white text-xs font-semibold hover:bg-[#172E6E] transition-colors cursor-pointer whitespace-nowrap"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Simpan STD</span>
            </button>
          </div>
        </div>

        {toast && (
          <div className="mt-4 px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-medium text-[#047857]">
            {toast}
          </div>
        )}

        {discError && (
          <div className="mt-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-red-800 flex items-center justify-between gap-3">
            <span>{discError}</span>
            <button
              type="button"
              onClick={() => setDiscError(null)}
              className="text-red-600 hover:text-red-900 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* TAB 1: PARAMETER SUB-STEP */}
        {viewMode === 'substeps' && (
          <div className="mt-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <label className="text-xs font-semibold text-slate-600 flex items-center gap-2">
                <span>Filter Sheet Proses:</span>
                <select
                  value={selectedSheet}
                  onChange={(e) => setSelectedSheet(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
                >
                  <option value="ALL">Semua Sheet Proses</option>
                  {sheets.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <span className="text-xs text-slate-500 font-mono-num">
                Menampilkan {filteredParams.length} parameter
              </span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                    <th className="py-2.5 px-4">Sheet Proses</th>
                    <th className="py-2.5 px-4">Tahapan</th>
                    <th className="py-2.5 px-4">Sub-Step / Keterangan</th>
                    <th className="py-2.5 px-4">Basis Pembagi</th>
                    <th className="py-2.5 px-4 text-right w-36">Time / Coeff</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 text-xs">
                  {filteredParams.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-4 font-semibold text-slate-800">{p.sheet}</td>
                      <td className="py-2.5 px-4 text-slate-600">{p.stage}</td>
                      <td className="py-2.5 px-4 text-slate-900 font-medium">{p.name}</td>
                      <td className="py-2.5 px-4 font-mono-num text-slate-500">{p.basis}</td>
                      <td className="py-2.5 px-4 text-right">
                        <input
                          type="number"
                          step="any"
                          value={p.val}
                          onChange={(e) => handleParamChange(p.id, e.target.value)}
                          className="w-28 text-right font-mono-num font-semibold px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20 focus:border-[#1E3A8A]"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: MATRIKS 2D */}
        {viewMode === 'matrices' && (
          <div className="mt-5 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  { key: 'acMatrix', label: 'Matriks 2D Autocutting' },
                  { key: 'saMatrix', label: 'Matriks 2D Semi-autocutting' },
                  { key: 'mcMatrix', label: 'Matriks 2D Manual-(Air)cutting' },
                ] as const
              ).map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setSelectedMatrix(m.key)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                    selectedMatrix === m.key
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto p-5">
              <h2 className="text-sm font-bold text-slate-900 mb-3">{matrixMeta.title}</h2>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold text-slate-700 bg-slate-50">
                    <th className="py-2.5 px-3 border border-slate-200">Rentang LOT</th>
                    {matrixMeta.colLabels.map((col, ci) => (
                      <th key={ci} className="py-2.5 px-3 border border-slate-200 text-center font-mono-num">
                        {col} mm
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrixMeta.rowLabels.map((rowLbl, ri) => (
                    <tr key={ri} className="hover:bg-slate-50/70">
                      <td className="py-2 px-3 border border-slate-200 text-xs font-semibold text-slate-800 bg-slate-50/80 whitespace-nowrap font-mono-num">
                        {rowLbl}
                      </td>
                      {matrixMeta.colLabels.map((_, ci) => (
                        <td key={ci} className="py-2 px-2 border border-slate-200 text-center">
                          <input
                            type="number"
                            step="any"
                            value={matrixMeta.data[ri]?.[ci] ?? 0}
                            onChange={(e) =>
                              handleMatrixCellChange(selectedMatrix, ri, ci, e.target.value)
                            }
                            className="w-20 text-center font-mono-num text-xs font-semibold px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20 focus:border-[#1E3A8A]"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: LOGIC DISC SUB-PROSES (MODULAR PLUG-AND-PLAY) */}
        {viewMode === 'discs' && (
          <div className="mt-5 space-y-4">
            {/* Toolbar */}
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <h2 className="text-sm font-bold text-slate-900">
                  Arsitektur Logic Disc Bongkar-Pasang (`{DISC_FORMAT_VERSION}`)
                </h2>
                <p className="text-xs text-slate-600">
                  Setiap sub-proses memiliki disc kode perhitungan (<code>.disc.js</code> /{' '}
                  <code>.json</code>) terpisah. Edit, export, atau import dengan validasi wajib 5
                  tahap sebelum diterapkan.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowFormatGuide((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5 text-[#1E3A8A]" />
                  <span>Panduan Format Disc</span>
                  {showFormatGuide ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => globalDiscImportRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1E3A8A] text-white text-xs font-semibold hover:bg-[#172E6E] cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Import Disc / Bundle (.js / .json)</span>
                </button>
                <input
                  ref={globalDiscImportRef}
                  type="file"
                  accept=".js,.disc.js,.json,.disc.json,.discs.json"
                  onChange={handleGlobalImportFile}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() =>
                    downloadFile(
                      serializeAllDiscsBundle(sortedDiscs),
                      `UMH_All_Logic_Discs_${new Date().toISOString().slice(0, 10)}.discs.json`,
                      'application/json;charset=utf-8'
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-[#047857]" />
                  <span>Export Semua Disc (.json)</span>
                </button>

                <button
                  type="button"
                  onClick={handleCreateNewDiscSlot}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#047857] text-white text-xs font-semibold hover:bg-[#065F46] cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Sub-Proses Baru</span>
                </button>

                {confirmResetDiscs ? (
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handleResetAllDiscs}
                      className="px-2.5 py-2 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 cursor-pointer"
                    >
                      Ya, Reset Disc
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmResetDiscs(false)}
                      className="px-2.5 py-2 rounded-xl bg-slate-200 text-slate-700 text-xs font-medium cursor-pointer"
                    >
                      Batal
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmResetDiscs(true)}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Disc</span>
                  </button>
                )}
              </div>
            </div>

            {/* Collapsible Format Specification Card */}
            {showFormatGuide && (
              <div className="rounded-xl bg-slate-900 text-slate-100 p-5 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-white">
                    Spesifikasi Standar File Logic Disc (`.disc.js` &amp; `.json`)
                  </h3>
                  <span className="font-mono text-[11px] text-blue-300">{DISC_FORMAT_VERSION}</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Anda dapat mengekspor salah satu file <code>.disc.js</code> lalu mengedit atau
                  menulis ulang memakai tools apa pun (VS Code, Notepad, atau generator kode) selama
                  mempertahankan struktur di bawah. Setiap file yang diimpor wajib lolos{' '}
                  <strong>5-Point Validation Gate</strong> sebelum diterapkan.
                </p>
                <pre className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 overflow-x-auto font-mono text-[11px] leading-relaxed text-emerald-300">
{`module.exports = {
  format: "UMH_PROCESS_DISC_V1",
  processId: 1,                  // ID slot proses (1..21 atau >=22 untuk proses baru)
  processName: "Wire printing",  // Nama proses
  jpName: "電線印字",             // Nama Jepang (opsional)
  weight: 1.0,                   // Bobot allowance "By Hasil Akhir"
  version: "1.0.0",
  description: "Deskripsi rumus proses...",
  calculate(ctx) {
    // Tersedia di ctx:
    // ctx.lot, ctx.lotMetrics, ctx.cctMaster, ctx.ppcsCount,
    // ctx.params, ctx.assemblyComponents, ctx.partList, ctx.ppcsList,
    // ctx.assemblyCotList, ctx.terminalRatios, ctx.stdDb, ctx.feederList,
    // ctx.helpers: { getP, mkSub, parseWireSize, buildCircuitAllocs, isNonCrimpTerm, JOINT_CODES, groupTwistBundles }
    const rate = ctx.helpers.getP("parameter_id");
    const qty = ctx.ppcsCount;
    const subSteps = [
      ctx.helpers.mkSub("Main", "Nama sub-step", "sec/unit(pcs)", qty, rate, qty * rate)
    ];
    return { active: subSteps.some((s) => s.baseSec > 0), summaryNote: "Qty: " + qty, subSteps };
  }
};`}
                </pre>
              </div>
            )}

            {/* Hidden row importer */}
            <input
              ref={rowDiscImportRef}
              type="file"
              accept=".js,.disc.js,.json,.disc.json"
              onChange={handleRowImportFile}
              className="hidden"
            />

            {/* Disc Table */}
            <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                    <th className="py-3 px-4 w-14 text-center">ID</th>
                    <th className="py-3 px-4">Sub-Proses Manufaktur</th>
                    <th className="py-3 px-4">Status Logic Disc</th>
                    <th className="py-3 px-4 text-right">Bobot</th>
                    <th className="py-3 px-4 text-center">Versi</th>
                    <th className="py-3 px-4 text-right">Aksi Bongkar-Pasang</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 text-xs">
                  {sortedDiscs.map((disc) => {
                    const def = DEFAULT_PROCESS_DISCS.find((d) => d.processId === disc.processId);
                    const isModified = def
                      ? disc.code.trim() !== def.code.trim() ||
                        disc.weight !== def.weight ||
                        disc.processName !== def.processName
                      : true;
                    const isEmptySlot =
                      disc.isEmptyTemplate &&
                      (!isModified || def?.isEmptyTemplate);

                    return (
                      <tr key={disc.processId} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 text-center font-mono-num font-bold text-[#1E3A8A]">
                          {String(disc.processId).padStart(2, '0')}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">
                            {disc.processName}
                            {disc.jpName && (
                              <span className="ml-1.5 font-normal text-slate-500">
                                ({disc.jpName})
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                            {disc.description || '-'}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {disc.isEmptyTemplate ? (
                            <span className="text-[11px] font-semibold text-amber-700">
                              Kosong (Template Siap Diisi)
                            </span>
                          ) : isModified ? (
                            <span className="text-[11px] font-semibold text-[#1E3A8A]">
                              Custom / Dimodifikasi
                            </span>
                          ) : (
                            <span className="text-[11px] font-semibold text-[#047857]">
                              Aktif (Standar Tervalidasi)
                            </span>
                          )}
                          {isEmptySlot && (
                            <div className="text-[10px] text-slate-400">
                              Mengembalikan 0s hingga disc diisi
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono-num font-semibold text-slate-800">
                          {disc.weight.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-center font-mono-num text-slate-600">
                          v{disc.version}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                setEditingDiscModal({
                                  initialDisc: disc,
                                  expectedProcessId: disc.processId,
                                  allowEditProcessId: false,
                                })
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#1E3A8A] text-white text-[11px] font-semibold hover:bg-[#172E6E] cursor-pointer"
                            >
                              <Code2 className="w-3 h-3" />
                              <span>Edit / Validasi</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setRowImportTargetId(disc.processId);
                                rowDiscImportRef.current?.click();
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                            >
                              <Upload className="w-3 h-3 text-[#1E3A8A]" />
                              <span>Import</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                const slug = disc.processName.replace(/[^a-zA-Z0-9_-]/g, '_');
                                const pad = String(disc.processId).padStart(2, '0');
                                downloadFile(
                                  serializeDiscToJsFile(disc),
                                  `Disc_${pad}_${slug}.disc.js`,
                                  'text/javascript;charset=utf-8'
                                );
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                            >
                              <FileCode2 className="w-3 h-3 text-[#047857]" />
                              <span>.JS</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                const slug = disc.processName.replace(/[^a-zA-Z0-9_-]/g, '_');
                                const pad = String(disc.processId).padStart(2, '0');
                                downloadFile(
                                  serializeDiscToJsonFile(disc),
                                  `Disc_${pad}_${slug}.disc.json`,
                                  'application/json;charset=utf-8'
                                );
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                            >
                              <Download className="w-3 h-3 text-slate-600" />
                              <span>.JSON</span>
                            </button>

                            {def && isModified && (
                              <button
                                type="button"
                                onClick={() => handleResetSingleDisc(disc.processId)}
                                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 cursor-pointer"
                                title="Kembalikan disc ini ke default"
                              >
                                <RotateCcw className="w-3 h-3" />
                              </button>
                            )}

                            {!def && (
                              <button
                                type="button"
                                onClick={() => handleDeleteCustomDisc(disc.processId)}
                                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-red-50 border border-red-200 text-[11px] font-semibold text-red-700 hover:bg-red-100 cursor-pointer"
                                title="Hapus sub-proses kustom"
                              >
                                <Trash2 className="w-3 h-3" />
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
          </div>
        )}
      </div>

      {/* Single Disc Inspector, Editor & Pre-Apply Validator Modal */}
      {editingDiscModal && (
        <LogicDiscModal
          initialDisc={editingDiscModal.initialDisc}
          expectedProcessId={editingDiscModal.expectedProcessId}
          allowEditProcessId={editingDiscModal.allowEditProcessId}
          importSourceLabel={editingDiscModal.sourceLabel}
          stdDb={draft}
          autoCutList={autoCutList}
          feederList={feederList}
          onApplyDisc={handleApplyValidatedDisc}
          onClose={() => setEditingDiscModal(null)}
        />
      )}

      {/* Multi-Disc Bundle Validation Gate Modal */}
      {bundleValidation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 backdrop-blur-xs p-3 sm:p-5">
          <div className="glass-modal w-full max-w-4xl max-h-[88vh] rounded-2xl flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold text-[#1E3A8A]">
                  一括検証 · Validasi Bundle Logic Disc
                </p>
                <h2 className="text-base font-bold text-slate-900 mt-0.5">
                  Pemeriksaan Bundle: {bundleValidation.fileName}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setBundleValidation(null)}
                className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 text-xs flex items-center justify-between">
              <span>
                Total Disc dalam Bundle:{' '}
                <strong className="font-mono-num">{bundleValidation.results.length}</strong>
              </span>
              {bundleValidation.results.every((r) => r.validation.valid) ? (
                <span className="inline-flex items-center gap-1.5 font-semibold text-[#047857]">
                  <ShieldCheck className="w-4 h-4" />
                  Semua Disc Valid &amp; Siap Diterapkan
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 font-semibold text-red-700">
                  <AlertTriangle className="w-4 h-4" />
                  Ada Disc yang Gagal Validasi — Perbaiki Sebelum Apply
                </span>
              )}
            </div>

            <div className="flex-1 overflow-auto p-6 space-y-2.5 bg-[#f8fafc]">
              {bundleValidation.results.map(({ raw, validation }, idx) => (
                <div
                  key={idx}
                  className={`rounded-xl border p-3.5 bg-white flex items-start justify-between gap-4 ${
                    validation.valid ? 'border-slate-200' : 'border-red-300 bg-red-50/40'
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    {validation.valid ? (
                      <CheckCircle2 className="w-4 h-4 text-[#047857] shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900">
                        #{raw.processId ?? '?'} — {raw.processName || '(Tanpa Nama)'}
                      </p>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        {validation.valid
                          ? `5/5 Cek OK · Base Simulasi: ${validation.dryRunSample?.baseSec.toFixed(
                              3
                            )}s`
                          : validation.checks
                              .filter((c) => !c.passed)
                              .map((c) => `${c.label}: ${c.detail}`)
                              .join(' | ')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-white flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setBundleValidation(null)}
                className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={!bundleValidation.results.every((r) => r.validation.valid)}
                onClick={handleApplyValidatedBundle}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#047857] text-white text-xs font-semibold hover:bg-[#065F46] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Apply Semua Disc Tervalidasi</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
