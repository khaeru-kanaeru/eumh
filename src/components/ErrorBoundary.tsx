import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Terjadi kesalahan tak terduga pada aplikasi.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Application ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-[#f4f6f9]">
          <div className="glass-modal max-w-lg w-full rounded-2xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-slate-900">
                  Terjadi Gangguan Sinkronisasi / Aplikasi
                </h2>
                <p className="text-xs text-slate-600 mt-1">
                  Silakan muat ulang halaman untuk memulihkan koneksi dan sesi kerja Anda.
                </p>
              </div>
            </div>

            <pre className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] font-mono-num text-slate-700 overflow-auto max-h-40 whitespace-pre-wrap break-words">
              {this.state.message}
            </pre>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1E3A8A] text-white text-xs font-semibold hover:bg-[#172E6E] cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Muat Ulang Aplikasi</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
