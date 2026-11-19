import { useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { AutoCutItem, FeederItem } from '../types/umh';
import {
  exportAutoCutTemplateXlsx,
  exportFeederTemplateXlsx,
  parseAutoCutExcelFile,
  parseFeederExcelFile,
} from '../utils/excelParser';

interface AutoCutFeederViewProps {
  autoCutList: AutoCutItem[];
  feederList: FeederItem[];
  onUpdateAutoCut: (list: AutoCutItem[], immediate?: boolean) => void;
  onUpdateFeeder: (list: FeederItem[], immediate?: boolean) => void;
  onResetAutoCut: () => AutoCutItem[];
  onResetFeeder: () => FeederItem[];
}

interface PendingUpload<T> {
  fileName: string;
  sheetName: string;
  items: T[];
  skippedCount: number;
}

export function AutoCutFeederView({
  autoCutList,
  feederList,
  onUpdateAutoCut,
  onUpdateFeeder,
  onResetAutoCut,
  onResetFeeder,
}: AutoCutFeederViewProps) {
  // Auto Cutting List state
  const [acCust, setAcCust] = useState('All');
  const [acTerm, setAcTerm] = useState('');
  const [searchAc, setSearchAc] = useState('');
  const [confirmResetAc, setConfirmResetAc] = useState(false);
  const [acUploading, setAcUploading] = useState(false);
  const [acPending, setAcPending] = useState<PendingUpload<AutoCutItem> | null>(null);
  const [acNotice, setAcNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const acFileRef = useRef<HTMLInputElement>(null);

  // Feeder List state
  const [fdSeal, setFdSeal] = useState('');
  const [searchFd, setSearchFd] = useState('');
  const [confirmResetFd, setConfirmResetFd] = useState(false);
  const [fdUploading, setFdUploading] = useState(false);
  const [fdPending, setFdPending] = useState<PendingUpload<FeederItem> | null>(null);
  const [fdNotice, setFdNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const fdFileRef = useRef<HTMLInputElement>(null);

  const showAcNotice = (kind: 'ok' | 'err', text: string) => {
    setAcNotice({ kind, text });
    if (kind === 'ok') {
      setTimeout(() => {
        setAcNotice((prev) => (prev?.text === text ? null : prev));
      }, 4000);
    }
  };

  const showFdNotice = (kind: 'ok' | 'err', text: string) => {
    setFdNotice({ kind, text });
    if (kind === 'ok') {
      setTimeout(() => {
        setFdNotice((prev) => (prev?.text === text ? null : prev));
      }, 4000);
    }
  };

  const filteredAc = useMemo(() => {
    const q = searchAc.trim().toLowerCase();
    if (!q) return autoCutList;
    return autoCutList.filter(
      (x) =>
        x.terminal.toLowerCase().includes(q) || x.customer.toLowerCase().includes(q)
    );
  }, [autoCutList, searchAc]);

  const filteredFd = useMemo(() => {
    const q = searchFd.trim().toLowerCase();
    if (!q) return feederList;
    return feederList.filter((x) => x.seal.toLowerCase().includes(q));
  }, [feederList, searchFd]);

  const handleAddAc = (e: React.FormEvent) => {
    e.preventDefault();
    const term = acTerm.trim();
    if (!term) return;
    onUpdateAutoCut(
      [
        {
          id: `acl_${Date.now()}`,
          customer: acCust.trim() || 'All',
          terminal: term,
          process: 'auto cut',
        },
        ...autoCutList,
      ],
      true
    );
    setAcTerm('');
  };

  const handleAddFd = (e: React.FormEvent) => {
    e.preventDefault();
    const seal = fdSeal.trim();
    if (!seal) return;
    onUpdateFeeder(
      [
        {
          id: `fl_${Date.now()}`,
          seal,
          process: 'auto feeder',
        },
        ...feederList,
      ],
      true
    );
    setFdSeal('');
  };

  const handleConfirmResetAc = () => {
    const fresh = onResetAutoCut();
    setConfirmResetAc(false);
    setAcPending(null);
    setSearchAc('');
    showAcNotice('ok', `Database Auto Cutting List di-reset ke default (${fresh.length} item).`);
  };

  const handleConfirmResetFd = () => {
    const fresh = onResetFeeder();
    setConfirmResetFd(false);
    setFdPending(null);
    setSearchFd('');
    showFdNotice('ok', `Database Feeder List di-reset ke default (${fresh.length} item).`);
  };

  const handleAcFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setAcUploading(true);
    setAcNotice(null);
    setAcPending(null);
    try {
      const parsed = await parseAutoCutExcelFile(file);
      if (parsed.items.length === 0) {
        showAcNotice(
          'err',
          `Tidak ditemukan data terminal valid pada "${file.name}". Pastikan kolom "Item Terminal" (dan opsional "Customer") terisi.`
        );
        return;
      }
      setAcPending({
        fileName: file.name,
        sheetName: parsed.sheetName,
        items: parsed.items,
        skippedCount: parsed.skippedCount,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showAcNotice('err', `Gagal membaca file "${file.name}": ${msg}`);
    } finally {
      setAcUploading(false);
    }
  };

  const handleApplyAcUpload = (mode: 'replace' | 'merge') => {
    if (!acPending) return;
    if (mode === 'replace') {
      onUpdateAutoCut(acPending.items, true);
      showAcNotice(
        'ok',
        `Database Auto Cutting List diperbarui (${acPending.items.length} terminal dari "${acPending.fileName}").`
      );
    } else {
      const existingKeys = new Set(
        autoCutList.map(
          (x) => `${x.customer.trim().toLowerCase()}||${x.terminal.trim().toLowerCase()}`
        )
      );
      const additions = acPending.items.filter((x) => {
        const key = `${x.customer.trim().toLowerCase()}||${x.terminal.trim().toLowerCase()}`;
        return !existingKeys.has(key);
      });
      onUpdateAutoCut([...additions, ...autoCutList], true);
      showAcNotice(
        'ok',
        `Ditambahkan ${additions.length} terminal baru dari "${acPending.fileName}" (total ${autoCutList.length + additions.length} item).`
      );
    }
    setAcPending(null);
    setSearchAc('');
  };

  const handleFdFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setFdUploading(true);
    setFdNotice(null);
    setFdPending(null);
    try {
      const parsed = await parseFeederExcelFile(file);
      if (parsed.items.length === 0) {
        showFdNotice(
          'err',
          `Tidak ditemukan data seal valid pada "${file.name}". Pastikan kolom "Item Seal" terisi.`
        );
        return;
      }
      setFdPending({
        fileName: file.name,
        sheetName: parsed.sheetName,
        items: parsed.items,
        skippedCount: parsed.skippedCount,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showFdNotice('err', `Gagal membaca file "${file.name}": ${msg}`);
    } finally {
      setFdUploading(false);
    }
  };

  const handleApplyFdUpload = (mode: 'replace' | 'merge') => {
    if (!fdPending) return;
    if (mode === 'replace') {
      onUpdateFeeder(fdPending.items, true);
      showFdNotice(
        'ok',
        `Database Feeder List diperbarui (${fdPending.items.length} seal dari "${fdPending.fileName}").`
      );
    } else {
      const existingKeys = new Set(feederList.map((x) => x.seal.trim().toLowerCase()));
      const additions = fdPending.items.filter(
        (x) => !existingKeys.has(x.seal.trim().toLowerCase())
      );
      onUpdateFeeder([...additions, ...feederList], true);
      showFdNotice(
        'ok',
        `Ditambahkan ${additions.length} seal baru dari "${fdPending.fileName}" (total ${feederList.length + additions.length} item).`
      );
    }
    setFdPending(null);
    setSearchFd('');
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* Left: Database Auto Cutting List */}
      <section className="glass-surface rounded-2xl p-6 flex flex-col gap-4">
        <div className="flex flex-col gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-[#1E3A8A]">
                自動切断端子マスタ · Auto Cutting List
              </p>
              <h1 className="text-lg font-bold text-slate-900 mt-0.5">
                Database Auto Cutting List
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Validasi terminal mesin auto-cutting (
                <span className="font-mono-num font-semibold text-slate-700">
                  {autoCutList.length}
                </span>{' '}
                item).
              </p>
            </div>
          </div>

          {/* Compact Action Bar: Upload Excel, Template .xlsx, Reset Default */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={acFileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleAcFileSelect}
              className="hidden"
            />
            <button
              type="button"
              disabled={acUploading}
              onClick={() => acFileRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1E3A8A] text-white text-xs font-semibold hover:bg-[#172E6E] disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{acUploading ? 'Membaca...' : 'Upload Excel'}</span>
            </button>

            <button
              type="button"
              onClick={() => exportAutoCutTemplateXlsx(autoCutList)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 text-[#047857]" />
              <span>Template .xlsx</span>
            </button>

            <div className="ml-auto">
              {confirmResetAc ? (
                <div className="inline-flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleConfirmResetAc}
                    className="px-2.5 py-1.5 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 cursor-pointer whitespace-nowrap"
                  >
                    Ya, Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmResetAc(false)}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-300 cursor-pointer whitespace-nowrap"
                  >
                    Batal
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmResetAc(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Default</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Inline Notice */}
        {acNotice && (
          <div
            className={`px-3.5 py-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
              acNotice.kind === 'ok'
                ? 'bg-emerald-50 border-emerald-200 text-[#047857]'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}
          >
            <span className="inline-flex items-center gap-2 font-medium">
              {acNotice.kind === 'ok' && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
              <span>{acNotice.text}</span>
            </span>
            <button
              type="button"
              onClick={() => setAcNotice(null)}
              className="opacity-70 hover:opacity-100 cursor-pointer shrink-0"
              aria-label="Tutup pesan"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Inline Excel Upload Preview */}
        {acPending && (
          <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 space-y-2.5 text-xs">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 min-w-0">
                <FileSpreadsheet className="w-4 h-4 text-[#1E3A8A] shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 truncate">
                    {acPending.fileName}{' '}
                    {acPending.sheetName && acPending.sheetName !== acPending.fileName && (
                      <span className="font-normal text-slate-500">
                        (Sheet: {acPending.sheetName})
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Terdeteksi{' '}
                    <strong className="font-mono-num text-[#1E3A8A]">
                      {acPending.items.length}
                    </strong>{' '}
                    terminal valid
                    {acPending.skippedCount > 0 && (
                      <> · {acPending.skippedCount} baris kosong/duplikat dilewati</>
                    )}
                    . Contoh:{' '}
                    <span className="font-mono-num text-slate-700">
                      {acPending.items
                        .slice(0, 3)
                        .map((x) => `${x.customer}:${x.terminal}`)
                        .join(', ')}
                    </span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAcPending(null)}
                className="p-1 rounded-lg text-slate-500 hover:bg-blue-100 cursor-pointer"
                aria-label="Batal upload"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleApplyAcUpload('replace')}
                className="px-3 py-1.5 rounded-lg bg-[#1E3A8A] text-white text-xs font-semibold hover:bg-[#172E6E] cursor-pointer"
              >
                Ganti Database ({acPending.items.length})
              </button>
              <button
                type="button"
                onClick={() => handleApplyAcUpload('merge')}
                className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
              >
                Gabung Baru
              </button>
              <button
                type="button"
                onClick={() => setAcPending(null)}
                className="px-2.5 py-1.5 rounded-lg text-slate-600 text-xs font-medium hover:bg-blue-100 cursor-pointer"
              >
                Batal
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleAddAc} className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <input
            type="text"
            value={acCust}
            onChange={(e) => setAcCust(e.target.value)}
            placeholder="Customer"
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
          />
          <input
            type="text"
            value={acTerm}
            onChange={(e) => setAcTerm(e.target.value)}
            placeholder="Item Terminal (cth: 1062-16-0122)"
            required
            className="sm:col-span-2 px-3 py-2 text-xs font-mono-num bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-[#1E3A8A] text-white text-xs font-semibold hover:bg-[#172E6E] cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah</span>
          </button>
        </form>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchAc}
            onChange={(e) => setSearchAc(e.target.value)}
            placeholder="Cari nomor terminal atau customer..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
          />
        </div>

        <div className="overflow-auto max-h-[460px] rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
              <tr>
                <th className="py-2.5 px-3 w-28">Customer</th>
                <th className="py-2.5 px-3">Item Terminal</th>
                <th className="py-2.5 px-3 text-right w-16">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70">
              {filteredAc.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-slate-400 text-xs">
                    {autoCutList.length === 0
                      ? 'Database kosong. Upload Excel, tambah manual, atau klik Reset Default.'
                      : 'Tidak ada terminal yang cocok dengan pencarian.'}
                  </td>
                </tr>
              ) : (
                filteredAc.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70">
                    <td className="py-1.5 px-3">
                      <input
                        type="text"
                        value={item.customer}
                        onChange={(e) =>
                          onUpdateAutoCut(
                            autoCutList.map((a) =>
                              a.id === item.id ? { ...a, customer: e.target.value } : a
                            ),
                            false
                          )
                        }
                        className="w-24 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#1E3A8A]"
                      />
                    </td>
                    <td className="py-1.5 px-3">
                      <input
                        type="text"
                        value={item.terminal}
                        onChange={(e) =>
                          onUpdateAutoCut(
                            autoCutList.map((a) =>
                              a.id === item.id ? { ...a, terminal: e.target.value } : a
                            ),
                            false
                          )
                        }
                        className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono-num font-semibold focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#1E3A8A]"
                      />
                    </td>
                    <td className="py-1.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateAutoCut(
                            autoCutList.filter((a) => a.id !== item.id),
                            true
                          )
                        }
                        className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 cursor-pointer"
                        aria-label={`Hapus ${item.terminal}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Right: Database Feeder List */}
      <section className="glass-surface rounded-2xl p-6 flex flex-col gap-4">
        <div className="flex flex-col gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-[#1E3A8A]">
                ゴム栓フィーダーマスタ · Auto-Feeder Seal
              </p>
              <h1 className="text-lg font-bold text-slate-900 mt-0.5">
                Database Feeder List (Wire Seal)
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Validasi rubber seal mesin auto-feeder (
                <span className="font-mono-num font-semibold text-slate-700">
                  {feederList.length}
                </span>{' '}
                item).
              </p>
            </div>
          </div>

          {/* Compact Action Bar: Upload Excel, Template .xlsx, Reset Default */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fdFileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFdFileSelect}
              className="hidden"
            />
            <button
              type="button"
              disabled={fdUploading}
              onClick={() => fdFileRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1E3A8A] text-white text-xs font-semibold hover:bg-[#172E6E] disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{fdUploading ? 'Membaca...' : 'Upload Excel'}</span>
            </button>

            <button
              type="button"
              onClick={() => exportFeederTemplateXlsx(feederList)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 text-[#047857]" />
              <span>Template .xlsx</span>
            </button>

            <div className="ml-auto">
              {confirmResetFd ? (
                <div className="inline-flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleConfirmResetFd}
                    className="px-2.5 py-1.5 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 cursor-pointer whitespace-nowrap"
                  >
                    Ya, Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmResetFd(false)}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-300 cursor-pointer whitespace-nowrap"
                  >
                    Batal
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmResetFd(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Default</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Inline Notice */}
        {fdNotice && (
          <div
            className={`px-3.5 py-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
              fdNotice.kind === 'ok'
                ? 'bg-emerald-50 border-emerald-200 text-[#047857]'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}
          >
            <span className="inline-flex items-center gap-2 font-medium">
              {fdNotice.kind === 'ok' && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
              <span>{fdNotice.text}</span>
            </span>
            <button
              type="button"
              onClick={() => setFdNotice(null)}
              className="opacity-70 hover:opacity-100 cursor-pointer shrink-0"
              aria-label="Tutup pesan"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Inline Excel Upload Preview */}
        {fdPending && (
          <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 space-y-2.5 text-xs">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 min-w-0">
                <FileSpreadsheet className="w-4 h-4 text-[#1E3A8A] shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 truncate">
                    {fdPending.fileName}{' '}
                    {fdPending.sheetName && fdPending.sheetName !== fdPending.fileName && (
                      <span className="font-normal text-slate-500">
                        (Sheet: {fdPending.sheetName})
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Terdeteksi{' '}
                    <strong className="font-mono-num text-[#1E3A8A]">
                      {fdPending.items.length}
                    </strong>{' '}
                    seal valid
                    {fdPending.skippedCount > 0 && (
                      <> · {fdPending.skippedCount} baris kosong/duplikat dilewati</>
                    )}
                    . Contoh:{' '}
                    <span className="font-mono-num text-slate-700">
                      {fdPending.items
                        .slice(0, 3)
                        .map((x) => x.seal)
                        .join(', ')}
                    </span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFdPending(null)}
                className="p-1 rounded-lg text-slate-500 hover:bg-blue-100 cursor-pointer"
                aria-label="Batal upload"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleApplyFdUpload('replace')}
                className="px-3 py-1.5 rounded-lg bg-[#1E3A8A] text-white text-xs font-semibold hover:bg-[#172E6E] cursor-pointer"
              >
                Ganti Database ({fdPending.items.length})
              </button>
              <button
                type="button"
                onClick={() => handleApplyFdUpload('merge')}
                className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
              >
                Gabung Baru
              </button>
              <button
                type="button"
                onClick={() => setFdPending(null)}
                className="px-2.5 py-1.5 rounded-lg text-slate-600 text-xs font-medium hover:bg-blue-100 cursor-pointer"
              >
                Batal
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleAddFd} className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <input
            type="text"
            value={fdSeal}
            onChange={(e) => setFdSeal(e.target.value)}
            placeholder="Item Seal (cth: 1-900325-9)"
            required
            className="sm:col-span-3 px-3 py-2 text-xs font-mono-num bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-[#1E3A8A] text-white text-xs font-semibold hover:bg-[#172E6E] cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah</span>
          </button>
        </form>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchFd}
            onChange={(e) => setSearchFd(e.target.value)}
            placeholder="Cari nomor seal..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
          />
        </div>

        <div className="overflow-auto max-h-[460px] rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
              <tr>
                <th className="py-2.5 px-3">Item Seal</th>
                <th className="py-2.5 px-3 text-right w-16">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70">
              {filteredFd.length === 0 ? (
                <tr>
                  <td colSpan={2} className="py-8 text-center text-slate-400 text-xs">
                    {feederList.length === 0
                      ? 'Database kosong. Upload Excel, tambah manual, atau klik Reset Default.'
                      : 'Tidak ada seal yang cocok dengan pencarian.'}
                  </td>
                </tr>
              ) : (
                filteredFd.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70">
                    <td className="py-1.5 px-3">
                      <input
                        type="text"
                        value={item.seal}
                        onChange={(e) =>
                          onUpdateFeeder(
                            feederList.map((f) =>
                              f.id === item.id ? { ...f, seal: e.target.value } : f
                            ),
                            false
                          )
                        }
                        className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono-num font-semibold focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#1E3A8A]"
                      />
                    </td>
                    <td className="py-1.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateFeeder(
                            feederList.filter((f) => f.id !== item.id),
                            true
                          )
                        }
                        className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 cursor-pointer"
                        aria-label={`Hapus ${item.seal}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
