// src/renderer/components/Toast.tsx
import { useUIStore } from '@/stores/uiStore';
import type { Toast } from '@/types';

const typeColors: Record<Toast['type'], { color: string; border: string; bg: string }> = {
  info: { color: 'var(--accent)', border: 'var(--accent)', bg: 'var(--accent-subtle)' },
  success: { color: 'var(--success)', border: 'var(--success)', bg: 'var(--accent-subtle)' },
  warning: { color: 'var(--warning)', border: 'var(--warning)', bg: 'var(--accent-subtle)' },
  error: { color: 'var(--error)', border: 'var(--error)', bg: 'var(--accent-subtle)' },
};

function ToastIcon({ type }: { type: Toast['type'] }) {
  switch (type) {
    case 'success':
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      );
    case 'error':
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      );
    case 'warning':
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      );
    case 'info':
    default:
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
  }
}

export default function ToastContainer() {
  const toasts = useUIStore((s) => s.toasts);
  const removeToast = useUIStore((s) => s.removeToast);

  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex flex-col-reverse gap-3 pointer-events-none"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((toast) => {
        const themeStyle = typeColors[toast.type] || typeColors.info;
        return (
          <div
            key={toast.id}
            onClick={() => removeToast(toast.id)}
            role="status"
            className="glass pointer-events-auto flex items-start gap-3 p-4 rounded-2xl shadow-lg border border-[var(--border-hairline)] min-w-[320px] max-w-[420px] cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] animate-spring-in relative overflow-hidden"
            style={{
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 border border-[var(--border-hairline)]"
              style={{
                background: themeStyle.bg,
                color: themeStyle.color,
              }}
            >
              <ToastIcon type={toast.type} />
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="font-semibold text-sm text-[var(--text-primary)] leading-snug">
                {toast.title}
              </div>
              {toast.message && (
                <div className="text-xs text-[var(--text-secondary)] mt-0.5 leading-relaxed line-clamp-3">
                  {toast.message}
                </div>
              )}
            </div>
            <div
              className="absolute left-0 top-0 bottom-0 w-1"
              style={{
                background: themeStyle.border,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

