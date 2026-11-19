import { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Download,
  Eye,
  FileSpreadsheet,
  Loader2,
  Sliders,
  Sparkles,
  UploadCloud,
  X,
} from 'lucide-react';
import { SAMPLE_KHR_PAYLOAD } from '../data/defaultStdDb';
import {
  extractAutoCutCandidateTerminals,
  parseWireSize,
} from '../engine/umhCalculator';
import {
  AllowanceMode,
  AssemblyComponents,
  AssemblyCotItem,
  AssyInputPayload,
  AssyParams,
  AutoCutItem,
  FeederItem,
  PartListItem,
  PpcsWireItem,
  TerminalRatios,
} from '../types/umh';
import {
  DetectedTemplateFormat,
  downloadUmhTemplateCsv,
  downloadUmhTemplateXlsx,
  parseDrawingFromGrid,
  parseMasterWorkbook,
  parsePartListFromGrid,
  parsePartMasterFromGrid,
  parsePpcsFromGrid,
  parseSingleSheetGrid,
} from '../utils/excelParser';

interface TemplateImportReport {
  fileName: string;
  detectedFormat: DetectedTemplateFormat;
  plSheetName?: string;
  ppcsSheetName?: string;
  extractedAssyNo: string;
  extractedCustomer: string;
  extractedCct: number;
  plCount: number;
  housingConnTypes: number;
  housingConnQty: number;
  acTermCount: number;
  afSealCount: number;
  jointQty: number;
  asmDetected: string[];
}

interface InputWizardModalProps {
  initialPayload?: AssyInputPayload | null;
  autoCutList: AutoCutItem[];
  feederList: FeederItem[];
  onClose: () => void;
  onSaveAndCalculate: (payload: AssyInputPayload) => void;
}

export function InputWizardModal({
  initialPayload,
  autoCutList,
  feederList,
  onClose,
  onSaveAndCalculate,
}: InputWizardModalProps) {
  const [params, setParams] = useState<AssyParams>(
    initialPayload?.params ?? {
      assyNo: '',
      customer: '',
      masterCct: 313,
      pfdAllowancePct: 15,
      allowanceMode: 'by_process',
    }
  );

  const [assemblyComponents, setAssemblyComponents] = useState<AssemblyComponents>(
    initialPayload?.assemblyComponents ?? {
      markerQty: 0,
      spotTapeQty: 0,
      namePlateQty: 0,
      clipQty: 0,
      clampQty: 0,
    }
  );

  const [partList, setPartList] = useState<PartListItem[]>(initialPayload?.partList ?? []);
  const [ppcsList, setPpcsList] = useState<PpcsWireItem[]>(initialPayload?.ppcsList ?? []);
  const [assemblyCotList, setAssemblyCotList] = useState<AssemblyCotItem[]>(
    initialPayload?.assemblyCotList ?? []
  );
  const [terminalRatios, setTerminalRatios] = useState<TerminalRatios>(
    initialPayload?.terminalRatios ?? {}
  );

  const [applyAllRatio, setApplyAllRatio] = useState<number>(100);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [templateImportReport, setTemplateImportReport] = useState<TemplateImportReport | null>(
    null
  );
  const [isParsingTemplate, setIsParsingTemplate] = useState(false);
  const [previewTarget, setPreviewTarget] = useState<'partlist' | 'ppcs' | 'assembly' | null>(null);

  const masterInputRef = useRef<HTMLInputElement>(null);
  const partListInputRef = useRef<HTMLInputElement>(null);
  const ppcsInputRef = useRef<HTMLInputElement>(null);
  const cotInputRef = useRef<HTMLInputElement>(null);

  const candidateTerminals = useMemo(
    () => extractAutoCutCandidateTerminals(ppcsList),
    [ppcsList]
  );

  const plSummary = useMemo(() => {
    const uniqAc = new Set(
      partList
        .filter((r) => r.desc === 'auto cut' || r.desc.includes('auto cut'))
        .map((r) => r.partNumber.toUpperCase())
    ).size;
    const uniqAf = new Set(
      partList.filter((r) => r.desc === 'auto feeder').map((r) => r.partNumber.toUpperCase())
    ).size;
    const jointCodes = new Set([
      '553800', '565200', 'B-1.25', 'B-2', 'B-5.5', 'B-8', 'B-14', 'B-22', 'B-38', 'B-60',
      'P-1.25', 'P-2', 'P-5.5', 'P-8', 'P-14', 'P-22', 'P-38', 'P-60',
    ]);
    const jSum = partList
      .filter((r) => jointCodes.has(r.partNumber.toUpperCase()))
      .reduce((a, b) => a + b.qty, 0);
    const housingConns = partList.filter(
      (r) => r.routingId === 20 && r.partName.toLowerCase() === 'connector'
    );
    const housingConnTypes = housingConns.length;
    const housingConnQty = housingConns.reduce((a, b) => a + b.qty, 0);
    return { rows: partList.length, uniqAc, uniqAf, jSum, housingConnTypes, housingConnQty };
  }, [partList]);

  const ppcsSummary = useMemo(() => {
    const ac = ppcsList.filter(
      (r) => (r.rAc || r.fAc) && parseWireSize(r.sizeRaw) < 3
    ).length;
    const tw = ppcsList.filter((r) => r.twist !== '').length;
    const sh = ppcsList.filter(
      (r) => r.colour.length >= 2 && r.colour[1].toUpperCase() === 'C'
    ).length;
    return { total: ppcsList.length, ac, tw, sh };
  }, [ppcsList]);

  const cotSummary = useMemo(() => {
    const totalTl = assemblyCotList.reduce((a, b) => a + b.tl, 0);
    const bareTl = assemblyCotList
      .filter((r) => r.type === 'B')
      .reduce((a, b) => a + b.tl, 0);
    const cCount = assemblyCotList.filter((r) => r.type === 'C').length;
    return { count: assemblyCotList.length, cCount, tapingTl: totalTl - bareTl };
  }, [assemblyCotList]);

  const deriveAsmComponentsFromPl = (
    parsedPl: PartListItem[],
    baseAsm: AssemblyComponents
  ): AssemblyComponents => {
    if (parsedPl.length === 0) return baseAsm;
    return {
      ...baseAsm,
      markerQty: parsedPl
        .filter((r) => r.partName.toLowerCase().includes('marker'))
        .reduce((a, b) => a + b.qty, 0),
      namePlateQty: parsedPl
        .filter(
          (r) =>
            r.partName.toLowerCase().includes('name plate') ||
            r.partName.toLowerCase().includes('nameplate')
        )
        .reduce((a, b) => a + b.qty, 0),
      clipQty: parsedPl
        .filter((r) => r.partName.toLowerCase().includes('clip'))
        .reduce((a, b) => a + b.qty, 0),
      clampQty: parsedPl
        .filter((r) => r.partName.toLowerCase().includes('clamp'))
        .reduce((a, b) => a + b.qty, 0),
    };
  };

  const applyPartListSideEffects = (
    parsedPl: PartListItem[],
    autoPopulateAsm: boolean
  ) => {
    if (parsedPl.length > 0) {
      setParams((prev) => ({
        ...prev,
        assyNo: prev.assyNo || parsedPl[0].assyNo,
        customer: prev.customer || parsedPl[0].customer,
      }));
    }
    if (autoPopulateAsm && parsedPl.length > 0) {
      setAssemblyComponents((prev) => deriveAsmComponentsFromPl(parsedPl, prev));
    }
  };

  const handleTemplateUpload = async (file: File) => {
    setIsParsingTemplate(true);
    setTemplateImportReport(null);
    setStatusMessage(`Memproses template "${file.name}"...`);
    try {
      const parsed = await parseMasterWorkbook(file, autoCutList, feederList);

      const nextPl = parsed.partList ?? partList;
      const nextPpcs = parsed.ppcsList ?? ppcsList;
      const nextCot = parsed.assemblyCotList ?? assemblyCotList;

      const nextParams: AssyParams = {
        ...params,
        ...(parsed.params ?? {}),
        assyNo:
          parsed.params?.assyNo ||
          params.assyNo ||
          nextPl[0]?.assyNo ||
          nextPpcs[0]?.assyNo ||
          '',
        customer:
          parsed.params?.customer || params.customer || nextPl[0]?.customer || '',
      };

      let nextAsm: AssemblyComponents = {
        ...assemblyComponents,
        ...(parsed.assemblyComponents ?? {}),
      };
      if (parsed.partList && parsed.partList.length > 0) {
        nextAsm = deriveAsmComponentsFromPl(parsed.partList, nextAsm);
      }

      const nextRatios: TerminalRatios = {
        ...terminalRatios,
        ...(parsed.terminalRatios ?? {}),
      };
      const parsedCandidates = extractAutoCutCandidateTerminals(nextPpcs);
      for (const item of parsedCandidates) {
        if (nextRatios[item.partNo] === undefined) nextRatios[item.partNo] = 100;
      }

      setParams(nextParams);
      if (parsed.partList) setPartList(parsed.partList);
      if (parsed.ppcsList) setPpcsList(parsed.ppcsList);
      if (parsed.assemblyCotList) setAssemblyCotList(parsed.assemblyCotList);
      setAssemblyComponents(nextAsm);
      setTerminalRatios(nextRatios);

      // Auto-calculate immediately ONLY when a complete multi-sheet template or pure Part Master CSV is uploaded
      const isCompleteTemplate =
        parsed.detectedFormat === 'full_template' ||
        (nextPl.length > 0 && nextPpcs.length > 0 && nextCot.length > 0);
      const isFilledPartMasterOnly =
        parsed.detectedFormat === 'part_master_only' &&
        Boolean(nextParams.assyNo) &&
        nextParams.masterCct > 0;

      if (isCompleteTemplate || isFilledPartMasterOnly) {
        const cleanAssy = nextParams.assyNo.trim() || `ASSY-${Date.now()}`;
        const now = new Date().toISOString();
        onSaveAndCalculate({
          id: initialPayload?.id ?? `assy_${Date.now()}`,
          createdAt: initialPayload?.createdAt ?? now,
          updatedAt: now,
          params: {
            ...nextParams,
            assyNo: cleanAssy,
            customer: nextParams.customer.trim() || (nextPl[0]?.customer ?? '-'),
          },
          assemblyComponents: nextAsm,
          partList: nextPl,
          ppcsList: nextPpcs,
          assemblyCotList: nextCot,
          terminalRatios: nextRatios,
        });
        return;
      }

      // Engineering PL_REV or partial workbook: populate extracted data & guide user to upload remaining files (PPCS / Assembly COT / manual input)
      const jointCodes = new Set([
        '553800', '565200', 'B-1.25', 'B-2', 'B-5.5', 'B-8', 'B-14', 'B-22', 'B-38', 'B-60',
        'P-1.25', 'P-2', 'P-5.5', 'P-8', 'P-14', 'P-22', 'P-38', 'P-60',
      ]);
      const housingConns = nextPl.filter(
        (r) => r.routingId === 20 && r.partName.toLowerCase() === 'connector'
      );
      const acTermCount = new Set(
        nextPl
          .filter((r) => r.desc === 'auto cut' || r.desc.includes('auto cut'))
          .map((r) => r.partNumber.toUpperCase())
      ).size;
      const afSealCount = new Set(
        nextPl.filter((r) => r.desc === 'auto feeder').map((r) => r.partNumber.toUpperCase())
      ).size;
      const jointQty = nextPl
        .filter((r) => jointCodes.has(r.partNumber.toUpperCase()))
        .reduce((a, b) => a + b.qty, 0);

      const asmDetected: string[] = [];
      if (nextAsm.namePlateQty > 0) asmDetected.push(`Name Plate: ${nextAsm.namePlateQty}`);
      if (nextAsm.clipQty > 0) asmDetected.push(`Clip: ${nextAsm.clipQty}`);
      if (nextAsm.markerQty > 0) asmDetected.push(`Marker: ${nextAsm.markerQty}`);
      if (nextAsm.clampQty > 0) asmDetected.push(`Clamp: ${nextAsm.clampQty}`);

      setTemplateImportReport({
        fileName: file.name,
        detectedFormat: parsed.detectedFormat,
        plSheetName: parsed.plSheetName,
        ppcsSheetName: parsed.ppcsSheetName,
        extractedAssyNo: nextParams.assyNo || '-',
        extractedCustomer: nextParams.customer || '-',
        extractedCct: nextParams.masterCct,
        plCount: nextPl.length,
        housingConnTypes: housingConns.length,
        housingConnQty: housingConns.reduce((a, b) => a + b.qty, 0),
        acTermCount,
        afSealCount,
        jointQty,
        asmDetected,
      });
      setStatusMessage(null);
    } catch {
      setStatusMessage(
        'Gagal membaca file template. Pastikan format .xlsx, .xls, atau .csv valid.'
      );
    } finally {
      setIsParsingTemplate(false);
    }
  };

  const handlePartListUpload = async (file: File) => {
    setIsParsingTemplate(true);
    try {
      const grid = await parseSingleSheetGrid(file, 'pl');
      const parsed = parsePartListFromGrid(grid, autoCutList, feederList);
      const masterMeta = parsePartMasterFromGrid(grid).params;
      setPartList(parsed);
      applyPartListSideEffects(parsed, true);

      if (masterMeta) {
        setParams((prev) => ({
          ...prev,
          assyNo: masterMeta.assyNo || prev.assyNo,
          customer: masterMeta.customer || prev.customer,
          masterCct: masterMeta.masterCct || prev.masterCct,
        }));
      }

      if (ppcsList.length > 0) {
        const slvSet = new Set(
          parsed
            .filter((x) => x.partName.toLowerCase() === 'sleeve')
            .map((x) => x.partNumber.toLowerCase())
        );
        setPpcsList((prev) =>
          prev.map((r) => ({
            ...r,
            af: slvSet.has(r.accR1.toLowerCase()) ? 'Sleeve' : '',
            ag: slvSet.has(r.accF1.toLowerCase()) ? 'Sleeve' : '',
          }))
        );
      }

      const metaNote =
        masterMeta?.assyNo || masterMeta?.masterCct
          ? ` (Assy: ${masterMeta.assyNo || '-'}, CCT: ${masterMeta.masterCct || '-'})`
          : '';
      setStatusMessage(`PART LIST "${file.name}" dimuat: ${parsed.length} baris${metaNote}.`);
    } catch {
      setStatusMessage('Gagal membaca file PART LIST.');
    } finally {
      setIsParsingTemplate(false);
    }
  };

  const handlePpcsUpload = async (file: File) => {
    setIsParsingTemplate(true);
    try {
      const grid = await parseSingleSheetGrid(file, 'ppcs');
      const fallbackAssy = params.assyNo || partList[0]?.assyNo || '';
      const parsed = parsePpcsFromGrid(grid, partList, autoCutList, feederList, fallbackAssy);
      setPpcsList(parsed);
      setStatusMessage(`PPCS "${file.name}" dimuat: ${parsed.length} sirkuit.`);
    } catch {
      setStatusMessage('Gagal membaca file PPCS.');
    } finally {
      setIsParsingTemplate(false);
    }
  };

  const handleCotUpload = async (file: File) => {
    setIsParsingTemplate(true);
    try {
      const grid = await parseSingleSheetGrid(file, 'dwg');
      const parsed = parseDrawingFromGrid(grid);
      setAssemblyCotList(parsed);
      setStatusMessage(`Assembly COT "${file.name}" dimuat: ${parsed.length} titik.`);
    } catch {
      setStatusMessage('Gagal membaca file Assembly COT.');
    } finally {
      setIsParsingTemplate(false);
    }
  };

  const handleLoadSampleKhr = () => {
    setParams({ ...SAMPLE_KHR_PAYLOAD.params });
    setAssemblyComponents({ ...SAMPLE_KHR_PAYLOAD.assemblyComponents });
    setPartList([...SAMPLE_KHR_PAYLOAD.partList]);
    setPpcsList([...SAMPLE_KHR_PAYLOAD.ppcsList]);
    setAssemblyCotList([...SAMPLE_KHR_PAYLOAD.assemblyCotList]);
    setTerminalRatios({ ...SAMPLE_KHR_PAYLOAD.terminalRatios });
    setStatusMessage('Parameter & Assembly COT KHR55431-00 dimuat.');
  };

  const handleApplyAllRatio = () => {
    const clamped = Math.max(0, Math.min(100, applyAllRatio));
    const next: TerminalRatios = { ...terminalRatios };
    for (const item of candidateTerminals) {
      next[item.partNo] = clamped;
    }
    setTerminalRatios(next);
  };

  const handleSubmit = () => {
    const cleanAssy = params.assyNo.trim() || `ASSY-${Date.now()}`;
    const now = new Date().toISOString();
    const finalRatios: TerminalRatios = { ...terminalRatios };
    for (const item of candidateTerminals) {
      if (finalRatios[item.partNo] === undefined) finalRatios[item.partNo] = 100;
    }

    onSaveAndCalculate({
      id: initialPayload?.id ?? `assy_${Date.now()}`,
      createdAt: initialPayload?.createdAt ?? now,
      updatedAt: now,
      params: {
        ...params,
        assyNo: cleanAssy,
        customer: params.customer.trim() || (partList[0]?.customer ?? '-'),
      },
      assemblyComponents,
      partList,
      ppcsList,
      assemblyCotList,
      terminalRatios: finalRatios,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-3 sm:p-4">
      <div className="glass-modal w-full max-w-[1360px] max-h-[92vh] rounded-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-4 bg-white">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900 truncate">
              {initialPayload
                ? `Edit Konfigurasi · ${initialPayload.params.assyNo}`
                : 'Input & Konfigurasi Data Assy'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              Isi parameter, upload Part List &amp; PPCS, serta Assembly COT sekaligus dalam satu tampilan lanskap.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleLoadSampleKhr}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-[#1E3A8A] border border-slate-200 text-xs font-semibold hover:bg-slate-200/70 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Sample KHR</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
              aria-label="Tutup Form Input"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Compact Template Upload Strip */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) void handleTemplateUpload(f);
          }}
          className="px-5 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-2.5"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#1E3A8A] text-white flex items-center justify-center shrink-0">
              {isParsingTemplate ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 truncate">
                Upload Template UMH / PL Engineering (.xlsx / .csv)
              </p>
              <p className="text-[11px] text-slate-500 truncate">
                Seret file ke sini atau klik Upload — otomatis membaca PL NEW ASSY, PPCS &amp; metadata.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={downloadUmhTemplateXlsx}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-100 cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 text-[#047857]" />
              <span>Template .xlsx</span>
            </button>
            <button
              type="button"
              onClick={downloadUmhTemplateCsv}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-100 cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 text-[#1E3A8A]" />
              <span>Template .csv</span>
            </button>
            <button
              type="button"
              disabled={isParsingTemplate}
              onClick={() => masterInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#1E3A8A] text-white text-xs font-semibold hover:bg-[#172E6E] disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>{isParsingTemplate ? 'Memproses...' : 'Upload Template'}</span>
            </button>
            <input
              ref={masterInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleTemplateUpload(f);
                e.target.value = '';
              }}
              className="hidden"
            />
          </div>
        </div>

        {/* Body Content: Compact Notices + Single 3-Section Landscape Form */}
        <div className="flex-1 overflow-y-auto bg-[#f8fafc]">
          {(statusMessage || templateImportReport) && (
            <div className="px-5 pt-4 space-y-2.5">
              {statusMessage && (
                <div className="px-3.5 py-2 rounded-lg bg-blue-50 border border-blue-200 text-xs font-medium text-[#1E3A8A] flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    {isParsingTemplate && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />}
                    <span>{statusMessage}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setStatusMessage(null)}
                    className="text-blue-700 hover:text-blue-900 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {templateImportReport && (
                <div className="rounded-xl border border-emerald-200 bg-white px-4 py-2.5 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 text-xs">
                  <div className="flex items-start gap-2 min-w-0">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                    <div className="min-w-0 space-y-0.5">
                      <p className="font-semibold text-emerald-950 truncate">
                        {templateImportReport.fileName} —{' '}
                        <span className="font-mono-num">
                          Assy {params.assyNo || templateImportReport.extractedAssyNo} ·{' '}
                          {params.customer || templateImportReport.extractedCustomer} · CCT {params.masterCct}
                        </span>
                      </p>
                      <p className="text-[11px] text-slate-600 font-mono-num flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
                        <span>
                          PL{templateImportReport.plSheetName ? ` (${templateImportReport.plSheetName})` : ''}:{' '}
                          <strong className="text-slate-900">{partList.length} item</strong>
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          PPCS{templateImportReport.ppcsSheetName ? ` (${templateImportReport.ppcsSheetName})` : ''}:{' '}
                          <strong className="text-slate-900">{ppcsList.length} sirkuit</strong>
                          {ppcsList.length > 0 && params.masterCct > 0 && ppcsList.length === params.masterCct && (
                            <span className="text-emerald-700 font-semibold"> ✓ Cocok CCT</span>
                          )}
                        </span>
                        {templateImportReport.asmDetected.length > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>Asm: {templateImportReport.asmDetected.join(', ')}</span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {ppcsList.length === 0 && (
                      <button
                        type="button"
                        onClick={() => ppcsInputRef.current?.click()}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-950 text-[11px] font-semibold hover:bg-amber-200 cursor-pointer whitespace-nowrap"
                      >
                        <AlertCircle className="w-3 h-3 text-amber-700" />
                        <span>Upload PPCS</span>
                      </button>
                    )}
                    {assemblyCotList.length === 0 && (
                      <button
                        type="button"
                        onClick={() => cotInputRef.current?.click()}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-950 text-[11px] font-semibold hover:bg-amber-200 cursor-pointer whitespace-nowrap"
                      >
                        <AlertCircle className="w-3 h-3 text-amber-700" />
                        <span>Upload Assembly COT</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setTemplateImportReport(null)}
                      className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                      aria-label="Tutup Ringkasan Impor"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3-Section Landscape Grid */}
          <div className="p-5 grid grid-cols-1 xl:grid-cols-12 gap-0 xl:gap-0">
            <div className="xl:col-span-12 rounded-xl border border-slate-200 bg-white grid grid-cols-1 xl:grid-cols-3 divide-y xl:divide-y-0 xl:divide-x divide-slate-200">
              {/* SEKAT 1: Parameter & Identitas Assy */}
              <section className="p-5 flex flex-col justify-between gap-4">
                <div className="space-y-4">
                  <div className="pb-3 border-b border-slate-100">
                    <h3 className="text-sm font-bold text-slate-900">
                      01. Parameter &amp; Identitas Assy
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Identitas Assy, jumlah CCT master, dan aturan allowance PFD.
                    </p>
                  </div>

                  <div className="space-y-3.5">
                    <label className="block space-y-1">
                      <span className="text-xs font-semibold text-slate-700">Assy Number</span>
                      <input
                        type="text"
                        value={params.assyNo}
                        onChange={(e) => setParams({ ...params, assyNo: e.target.value })}
                        placeholder="Contoh: KHR55471-00"
                        className="w-full px-3 py-2 text-sm font-mono-num bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20 focus:border-[#1E3A8A]"
                      />
                    </label>

                    <label className="block space-y-1">
                      <span className="text-xs font-semibold text-slate-700">
                        Customer (Otomatis dari PART LIST)
                      </span>
                      <input
                        type="text"
                        value={params.customer}
                        onChange={(e) => setParams({ ...params, customer: e.target.value })}
                        placeholder="Terdeteksi otomatis saat upload PART LIST"
                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20 focus:border-[#1E3A8A]"
                      />
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                      <label className="block space-y-1">
                        <span className="text-xs font-semibold text-slate-700">Jumlah CCT</span>
                        <input
                          type="number"
                          min="1"
                          value={params.masterCct}
                          onChange={(e) =>
                            setParams({ ...params, masterCct: Math.max(1, Number(e.target.value)) })
                          }
                          className="w-full px-3 py-2 text-sm font-mono-num bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20 focus:border-[#1E3A8A]"
                        />
                      </label>

                      <label className="block space-y-1">
                        <span className="text-xs font-semibold text-slate-700">Allowance PFD (%)</span>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="100"
                          value={params.pfdAllowancePct}
                          onChange={(e) =>
                            setParams({
                              ...params,
                              pfdAllowancePct: Math.max(0, Number(e.target.value)),
                            })
                          }
                          className="w-full px-3 py-2 text-sm font-mono-num bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20 focus:border-[#1E3A8A]"
                        />
                      </label>
                    </div>

                    <label className="block space-y-1">
                      <span className="text-xs font-semibold text-slate-700">
                        Metode Distribusi Allowance
                      </span>
                      <select
                        value={params.allowanceMode}
                        onChange={(e) =>
                          setParams({
                            ...params,
                            allowanceMode: e.target.value as AllowanceMode,
                          })
                        }
                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20 focus:border-[#1E3A8A]"
                      >
                        <option value="by_process">1. By Proses (+% Tiap Proses → Substep)</option>
                        <option value="by_final">2. By Hasil Akhir (Distribusi Kesulitan → Substep)</option>
                      </select>
                    </label>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 font-mono-num space-y-1">
                  <div className="flex items-center justify-between">
                    <span>PART LIST</span>
                    <strong className={partList.length > 0 ? 'text-emerald-700' : 'text-slate-400'}>
                      {partList.length} item
                    </strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>PPCS Wire List</span>
                    <strong className={ppcsList.length > 0 ? 'text-emerald-700' : 'text-slate-400'}>
                      {ppcsList.length} sirkuit
                    </strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Assembly COT</span>
                    <strong className={assemblyCotList.length > 0 ? 'text-emerald-700' : 'text-slate-400'}>
                      {assemblyCotList.length} titik
                    </strong>
                  </div>
                </div>
              </section>

              {/* SEKAT 2: Part List, PPCS & Rasio Auto-Cut */}
              <section className="p-5 flex flex-col gap-4">
                <div className="pb-3 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900">
                    02. Part List, PPCS &amp; Rasio Auto-Cut
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Upload manual terpisah jika belum lengkap dari template, lalu atur rasio terminal.
                  </p>
                </div>

                {/* PART LIST Compact Upload Row */}
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const f = e.dataTransfer.files?.[0];
                    if (f) void handlePartListUpload(f);
                  }}
                  className="pb-3.5 border-b border-slate-100 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-800">File PART LIST</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => partListInputRef.current?.click()}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#1E3A8A] text-white text-[11px] font-semibold hover:bg-[#172E6E] cursor-pointer whitespace-nowrap"
                      >
                        <UploadCloud className="w-3.5 h-3.5" />
                        <span>Upload</span>
                      </button>
                      <button
                        type="button"
                        disabled={partList.length === 0}
                        onClick={() => setPreviewTarget('partlist')}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer whitespace-nowrap"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Lihat</span>
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] font-mono-num text-slate-500">
                    {plSummary.rows} Baris · {plSummary.uniqAc} Auto-Cut · {plSummary.uniqAf} Feeder ·{' '}
                    {plSummary.housingConnQty} Conn H · {plSummary.jSum} Joint
                  </p>
                  <input
                    ref={partListInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handlePartListUpload(f);
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                </div>

                {/* PPCS Compact Upload Row */}
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const f = e.dataTransfer.files?.[0];
                    if (f) void handlePpcsUpload(f);
                  }}
                  className="pb-3.5 border-b border-slate-100 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-800">File PPCS (Wire List)</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => ppcsInputRef.current?.click()}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#1E3A8A] text-white text-[11px] font-semibold hover:bg-[#172E6E] cursor-pointer whitespace-nowrap"
                      >
                        <UploadCloud className="w-3.5 h-3.5" />
                        <span>Upload</span>
                      </button>
                      <button
                        type="button"
                        disabled={ppcsList.length === 0}
                        onClick={() => setPreviewTarget('ppcs')}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer whitespace-nowrap"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Lihat</span>
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] font-mono-num text-slate-500">
                    {ppcsSummary.total} Sirkuit · {ppcsSummary.ac} Auto-Cut · {ppcsSummary.tw} Twist ·{' '}
                    {ppcsSummary.sh} Shield
                  </p>
                  <input
                    ref={ppcsInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handlePpcsUpload(f);
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                </div>

                {/* Terminal Auto-Cut Ratio Allocator */}
                <div className="space-y-2.5 flex-1 flex flex-col min-h-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Sliders className="w-3.5 h-3.5 text-[#1E3A8A] shrink-0" />
                      <span className="text-xs font-bold text-slate-800 truncate">
                        Rasio Auto-Cut ({candidateTerminals.length})
                      </span>
                    </div>

                    {candidateTerminals.length > 0 && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={applyAllRatio}
                          onChange={(e) => setApplyAllRatio(Number(e.target.value))}
                          className="w-14 text-right font-mono-num text-xs px-2 py-1 bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:outline-none"
                        />
                        <span className="text-[11px] text-slate-500">%</span>
                        <button
                          type="button"
                          onClick={handleApplyAllRatio}
                          className="px-2 py-1 rounded-md bg-slate-900 text-white text-[11px] font-semibold hover:bg-slate-800 cursor-pointer whitespace-nowrap"
                        >
                          Semua
                        </button>
                      </div>
                    )}
                  </div>

                  {candidateTerminals.length === 0 ? (
                    <p className="text-[11px] text-slate-500 py-2">
                      Belum ada terminal kandidat Auto-Cut terdeteksi dari PPCS.
                    </p>
                  ) : (
                    <div className="max-h-[210px] overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg">
                      {candidateTerminals.map((item) => {
                        const val = terminalRatios[item.partNo] ?? 100;
                        return (
                          <div
                            key={item.partNo}
                            className="px-3 py-2 flex items-center justify-between gap-2 bg-slate-50/60"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-semibold font-mono-num text-slate-900 truncate">
                                {item.partNo}
                              </p>
                              <p className="text-[11px] text-slate-500 font-mono-num">
                                {item.count} ujung
                              </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="1"
                                value={val}
                                onChange={(e) =>
                                  setTerminalRatios({
                                    ...terminalRatios,
                                    [item.partNo]: Math.max(0, Math.min(100, Number(e.target.value))),
                                  })
                                }
                                className="w-16 text-right font-mono-num text-xs font-semibold px-2 py-1 bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
                              />
                              <span className="text-[11px] text-slate-500 font-semibold">%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>

              {/* SEKAT 3: Assembly COT & Komponen Manual */}
              <section className="p-5 flex flex-col gap-4">
                <div className="pb-3 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900">
                    03. Assembly COT &amp; Komponen Manual
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Upload file Assembly COT (Type C/T/B &amp; TL) dan sesuaikan jumlah komponen.
                  </p>
                </div>

                {/* Assembly COT Upload */}
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const f = e.dataTransfer.files?.[0];
                    if (f) void handleCotUpload(f);
                  }}
                  className="pb-3.5 border-b border-slate-100 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-800">File Assembly COT</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => cotInputRef.current?.click()}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#1E3A8A] text-white text-[11px] font-semibold hover:bg-[#172E6E] cursor-pointer whitespace-nowrap"
                      >
                        <UploadCloud className="w-3.5 h-3.5" />
                        <span>Upload</span>
                      </button>
                      <button
                        type="button"
                        disabled={assemblyCotList.length === 0}
                        onClick={() => setPreviewTarget('assembly')}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer whitespace-nowrap"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Lihat</span>
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] font-mono-num text-slate-500">
                    {cotSummary.count} Titik · COT (C): {cotSummary.cCount} · Taping TL:{' '}
                    {cotSummary.tapingTl.toLocaleString()} mm
                  </p>
                  <input
                    ref={cotInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleCotUpload(f);
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                </div>

                {/* Manual Assembly Components */}
                <div className="space-y-3">
                  <span className="text-xs font-bold text-slate-800 block">
                    Komponen Assembly (Input Manual)
                  </span>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="block space-y-1">
                      <span className="text-xs font-semibold text-slate-700">Marker (nm)</span>
                      <input
                        type="number"
                        min="0"
                        value={assemblyComponents.markerQty}
                        onChange={(e) =>
                          setAssemblyComponents({
                            ...assemblyComponents,
                            markerQty: Math.max(0, Number(e.target.value)),
                          })
                        }
                        className="w-full px-3 py-2 text-sm font-mono-num bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
                      />
                    </label>

                    <label className="block space-y-1">
                      <span className="text-xs font-semibold text-slate-700">Spot Tape (ns)</span>
                      <input
                        type="number"
                        min="0"
                        value={assemblyComponents.spotTapeQty}
                        onChange={(e) =>
                          setAssemblyComponents({
                            ...assemblyComponents,
                            spotTapeQty: Math.max(0, Number(e.target.value)),
                          })
                        }
                        className="w-full px-3 py-2 text-sm font-mono-num bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
                      />
                    </label>

                    <label className="block space-y-1">
                      <span className="text-xs font-semibold text-slate-700">Name Plate (nn)</span>
                      <input
                        type="number"
                        min="0"
                        value={assemblyComponents.namePlateQty}
                        onChange={(e) =>
                          setAssemblyComponents({
                            ...assemblyComponents,
                            namePlateQty: Math.max(0, Number(e.target.value)),
                          })
                        }
                        className="w-full px-3 py-2 text-sm font-mono-num bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
                      />
                    </label>

                    <label className="block space-y-1">
                      <span className="text-xs font-semibold text-slate-700">Clip (nx)</span>
                      <input
                        type="number"
                        min="0"
                        value={assemblyComponents.clipQty}
                        onChange={(e) =>
                          setAssemblyComponents({
                            ...assemblyComponents,
                            clipQty: Math.max(0, Number(e.target.value)),
                          })
                        }
                        className="w-full px-3 py-2 text-sm font-mono-num bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
                      />
                    </label>

                    <label className="block space-y-1 col-span-2">
                      <span className="text-xs font-semibold text-slate-700">Clamp (ny)</span>
                      <input
                        type="number"
                        min="0"
                        value={assemblyComponents.clampQty}
                        onChange={(e) =>
                          setAssemblyComponents({
                            ...assemblyComponents,
                            clampQty: Math.max(0, Number(e.target.value)),
                          })
                        }
                        className="w-full px-3 py-2 text-sm font-mono-num bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
                      />
                    </label>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500 font-mono-num">
            {params.assyNo || 'Assy belum diisi'} · CCT {params.masterCct} · PFD {params.pfdAllowancePct}%
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-[#047857] text-white text-xs font-semibold hover:bg-[#065F46] cursor-pointer whitespace-nowrap"
            >
              <Check className="w-4 h-4" />
              <span>Kalkulasi &amp; Simpan Hasil</span>
            </button>
          </div>
        </div>

        {/* Raw Data Preview Sub-Overlay */}
        {previewTarget && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-6">
            <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200">
              <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900">
                  {previewTarget === 'partlist'
                    ? `Preview PART LIST (${partList.length} baris)`
                    : previewTarget === 'ppcs'
                    ? `Preview PPCS Wire List (${ppcsList.length} sirkuit)`
                    : `Preview Assembly COT & Drawing (${assemblyCotList.length} titik)`}
                </h4>
                <button
                  type="button"
                  onClick={() => setPreviewTarget(null)}
                  className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-auto p-4">
                {previewTarget === 'partlist' && (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="py-2 px-2">No</th>
                        <th className="py-2 px-2">Customer</th>
                        <th className="py-2 px-2">Assy No</th>
                        <th className="py-2 px-2">Part Number</th>
                        <th className="py-2 px-2">Part Name</th>
                        <th className="py-2 px-2 text-right">Qty</th>
                        <th className="py-2 px-2 text-right">Routing ID</th>
                        <th className="py-2 px-2">Status Mesin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {partList.slice(0, 300).map((r, i) => (
                        <tr key={i}>
                          <td className="py-1.5 px-2 font-mono-num">{i + 1}</td>
                          <td className="py-1.5 px-2">{r.customer}</td>
                          <td className="py-1.5 px-2 font-mono-num">{r.assyNo}</td>
                          <td className="py-1.5 px-2 font-mono-num">{r.partNumber}</td>
                          <td className="py-1.5 px-2">{r.partName}</td>
                          <td className="py-1.5 px-2 text-right font-mono-num">{r.qty}</td>
                          <td className="py-1.5 px-2 text-right font-mono-num">{r.routingId}</td>
                          <td className="py-1.5 px-2 text-emerald-700 font-medium">{r.desc || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {previewTarget === 'ppcs' && (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="py-2 px-2">CCT</th>
                        <th className="py-2 px-2">Kind</th>
                        <th className="py-2 px-2">Size</th>
                        <th className="py-2 px-2">Col</th>
                        <th className="py-2 px-2 text-right">C/L</th>
                        <th className="py-2 px-2">Joint</th>
                        <th className="py-2 px-2">Twist</th>
                        <th className="py-2 px-2">Tube R/F</th>
                        <th className="py-2 px-2">Term R</th>
                        <th className="py-2 px-2">Acc R</th>
                        <th className="py-2 px-2">Term F</th>
                        <th className="py-2 px-2">Acc F</th>
                        <th className="py-2 px-2">Mark / D/C</th>
                        <th className="py-2 px-2">Auto-Cut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ppcsList.slice(0, 300).map((r, idx) => (
                        <tr key={idx}>
                          <td className="py-1.5 px-2 font-mono-num font-bold">{r.cctNo}</td>
                          <td className="py-1.5 px-2">{r.kind}</td>
                          <td className="py-1.5 px-2 font-mono-num">{r.sizeRaw}</td>
                          <td className="py-1.5 px-2">{r.colour}</td>
                          <td className="py-1.5 px-2 text-right font-mono-num">{r.cl}</td>
                          <td className="py-1.5 px-2 font-mono-num">{r.jointNo || '-'}</td>
                          <td className="py-1.5 px-2 font-mono-num">{r.twist || '-'}</td>
                          <td className="py-1.5 px-2 font-mono-num">
                            {[r.tubeR, r.tubeF].filter(Boolean).join(' / ') || '-'}
                          </td>
                          <td className="py-1.5 px-2 font-mono-num">{r.termR || '-'}</td>
                          <td className="py-1.5 px-2 font-mono-num">
                            {[r.accR1, r.accR2].filter(Boolean).join(', ') || '-'}
                          </td>
                          <td className="py-1.5 px-2 font-mono-num">{r.termF || '-'}</td>
                          <td className="py-1.5 px-2 font-mono-num">
                            {[r.accF1, r.accF2].filter(Boolean).join(', ') || '-'}
                          </td>
                          <td className="py-1.5 px-2 font-mono-num">
                            {[r.markerR, r.markerF, r.dcR, r.dcF].filter(Boolean).join(' · ') || '-'}
                          </td>
                          <td className="py-1.5 px-2 whitespace-nowrap">
                            {r.rAc ? 'R:Auto ' : ''}
                            {r.fAc ? 'F:Auto' : !r.rAc ? 'Manual' : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {previewTarget === 'assembly' && (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="py-2 px-2">No</th>
                        <th className="py-2 px-2">Type</th>
                        <th className="py-2 px-2">Keterangan</th>
                        <th className="py-2 px-2 text-right">Length TL (mm)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {assemblyCotList.map((r, i) => (
                        <tr key={i}>
                          <td className="py-1.5 px-2 font-mono-num">{i + 1}</td>
                          <td className="py-1.5 px-2 font-mono-num font-bold">{r.type}</td>
                          <td className="py-1.5 px-2">
                            {r.type === 'C'
                              ? 'Corrugated Tube (COT)'
                              : r.type === 'B'
                              ? 'Bare (Non-Taping)'
                              : 'Tape / Taping'}
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono-num">{r.tl}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
