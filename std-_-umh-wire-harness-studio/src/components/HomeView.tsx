import { ArrowRight, Database, FileSpreadsheet, Layers, Sliders } from 'lucide-react';
import { getVariantResult } from '../engine/umhCalculator';
import { AssyRecord, NavTab } from '../types/umh';

interface HomeViewProps {
  records: AssyRecord[];
  onStartWizard: () => void;
  onNavigate: (tab: NavTab) => void;
  onOpenDetail: (record: AssyRecord) => void;
}

export function HomeView({
  records,
  onStartWizard,
  onNavigate,
  onOpenDetail,
}: HomeViewProps) {
  const latestRecord = records[0];

  const capabilities = [
    {
      num: '01',
      jp: '工程別詳細',
      title: '21 Proses & Sub-Step',
      desc: 'Rincian Dandori, Before, Main, dan After terstruktur dari Wire Printing hingga Finishing.',
      icon: Layers,
    },
    {
      num: '02',
      jp: '二次元マトリクス',
      title: 'Matriks 2D & Union-Find',
      desc: 'Lookup LOT × Panjang kabel otomatis serta pengelompokan bundle Twist menggunakan Disjoint Set.',
      icon: Sliders,
    },
    {
      num: '03',
      jp: '余裕率配分',
      title: 'Dual-Mode Allowance',
      desc: 'Bandingkan distribusi merata By Proses melawan distribusi proporsional bobot kesulitan By Hasil Akhir.',
      icon: Database,
    },
    {
      num: '04',
      jp: '帳票出力',
      title: 'Ekspor Excel & PDF',
      desc: 'Workbook .xlsx multi-sheet dengan styling terstruktur serta laporan cetak PDF Landscape.',
      icon: FileSpreadsheet,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Hero Bento Card */}
      <section className="glass-surface rounded-2xl overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
          <div className="lg:col-span-7 p-8 lg:p-10 flex flex-col justify-between gap-6">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
                <span className="text-[#1E3A8A] font-semibold">標準時間・工数計算ワークベンチ</span>
                <span aria-hidden="true">·</span>
                <span>21 Proses Manufaktur</span>
                <span aria-hidden="true">·</span>
                <span>Dual-Mode Allowance</span>
              </div>

              <h1 className="text-3xl lg:text-[34px] font-bold tracking-tight text-slate-900 leading-[1.2] [text-wrap:balance]">
                Kalkulasi Base Cycle Time &amp; Standard UMH Wire Harness
              </h1>

              <p className="text-[15px] leading-relaxed text-slate-600 max-w-xl">
                Sistem standar waktu kerja manufaktur Wire Harness dari pembacaan Part List,
                PPCS, dan Assembly COT hingga kalkulasi matriks 2D, Twist Union-Find, serta
                ekspor laporan standar industri.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onStartWizard}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1E3A8A] text-white text-sm font-semibold hover:bg-[#172E6E] active:scale-[0.99] transition-all whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>Mulai Sekarang</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate('database')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-slate-800 border border-slate-200 text-sm font-semibold hover:bg-slate-50 transition-all whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Database className="w-4 h-4 text-slate-500" />
                <span>Lihat Database Assy</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-5 relative min-h-[240px] lg:min-h-[320px] bg-slate-900">
            <img
              src="/src/assets/images/wire_harness_studio_hero_1794972130349.jpg"
              alt="Rakitan Wire Harness otomotif dengan konektor polimer dan terminal kuningan"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover lg:h-full"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-900/20 to-transparent pointer-events-none" />
            <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between text-white gap-4">
              <div>
                <p className="text-[11px] font-medium text-slate-300">標準工数算出 · Standard Engineering</p>
                <p className="text-sm font-semibold mt-0.5">Base Cycle (0%) &amp; PFD Justified</p>
              </div>
              <span className="font-mono-num text-xs font-semibold text-white/95 bg-slate-950/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/15 shrink-0">
                {records.length} Assy Tersimpan
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Bento Capability Strip (4 columns) */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {capabilities.map((cap) => {
          const Icon = cap.icon;
          return (
            <div
              key={cap.num}
              className="glass-surface rounded-2xl p-5 flex flex-col justify-between gap-4"
            >
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200/70 flex items-center justify-center text-slate-700">
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-[11px] font-medium text-slate-400">
                  <span className="font-mono-num">{cap.num}</span> · {cap.jp}
                </span>
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">{cap.title}</h2>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{cap.desc}</p>
              </div>
            </div>
          );
        })}
      </section>

      {/* Latest Calculation Quick Summary */}
      {latestRecord && (
        <section className="glass-surface rounded-2xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200">
            <div>
              <p className="text-xs font-medium text-slate-500">
                最新計算結果 · Kalkulasi Terakhir
              </p>
              <h2 className="text-lg font-bold text-slate-900 mt-0.5 font-mono-num">
                {latestRecord.params.assyNo} · {latestRecord.params.customer}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onOpenDetail(latestRecord)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Buka Detail UMH</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 pt-5 lg:divide-x lg:divide-slate-200">
            <div className="lg:pr-4">
              <p className="text-xs text-slate-500">Base Cycle (0%)</p>
              <p className="text-2xl font-bold font-mono-num text-slate-900 mt-1">
                {latestRecord.calculation.totalBaseSec.toFixed(2)}{' '}
                <span className="text-xs font-medium text-slate-500">sec</span>
              </p>
            </div>
            <div className="lg:px-6">
              <p className="text-xs text-slate-500">
                Allow By Proses (+{latestRecord.params.pfdAllowancePct}%)
              </p>
              <p className="text-2xl font-bold font-mono-num text-[#047857] mt-1">
                {latestRecord.calculation.totalAllowByProcessSec.toFixed(2)}{' '}
                <span className="text-xs font-medium text-slate-500">sec</span>
              </p>
            </div>
            <div className="lg:px-6">
              <p className="text-xs text-slate-500">Standard UMH REG (Hour)</p>
              <p className="text-2xl font-bold font-mono-num text-slate-900 mt-1">
                {(latestRecord.calculation.totalAllowByFinalSec / 3600).toFixed(4)}{' '}
                <span className="text-xs font-medium text-slate-500">hr</span>
              </p>
            </div>
            <div className="lg:pl-6">
              <p className="text-xs text-slate-500">
                UMH SMV (Hour) · {latestRecord.params.masterCct} CCT
              </p>
              <p className="text-2xl font-bold font-mono-num text-[#1E3A8A] mt-1">
                {(
                  getVariantResult(latestRecord, 'smv').totalAllowByFinalSec / 3600
                ).toFixed(4)}{' '}
                <span className="text-xs font-medium text-slate-500">hr</span>
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
