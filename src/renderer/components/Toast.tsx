// src/renderer/components/Toast.tsx
import { useUIStore } from '@/stores/uiStore';
import type { Toast } from '@/types';

const typeIcons: Record<Toast['type'], string> = {
  info: 'ℹ️',
  success: '✅',
  warning: '⚠️',
  error: '🚨',
};

const typeColors: Record<Toast['type'], string> = {
  info: 'var(--accent)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  error: 'var(--error)',
};

export default function ToastContainer() {
  const toasts = useUIStore((s) => s.toasts);
  const removeToast = useUIStore((s) => s.removeToast);

  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      right: 24,
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column-reverse',
      gap: 12,
      pointerEvents: 'none'
    }}>
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="glass toast-item"
          onClick={() => removeToast(toast.id)}
          style={{
            padding: '16px 20px',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 16,
            cursor: 'pointer',
            minWidth: 320,
            maxWidth: 420,
            pointerEvents: 'auto',
            position: 'relative',
            overflow: 'hidden',
            WebkitAppRegion: 'no-drag'
          } as any}
        >
          <div style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: `${typeColors[toast.type]}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            flexShrink: 0
          }}>
            {typeIcons[toast.type]}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ 
              fontWeight: 700, 
              fontSize: 14, 
              color: 'var(--text-primary)',
              fontFamily: '"Plus Jakarta Sans", sans-serif'
            }}>
              {toast.title}
            </div>
            {toast.message && (
              <div style={{ 
                fontSize: 13, 
                color: 'var(--text-secondary)', 
                marginTop: 2,
                lineHeight: 1.4
              }}>
                {toast.message}
              </div>
            )}
          </div>
          <div style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 4,
            background: typeColors[toast.type]
          }} />
        </div>
      ))}
    </div>
  );
}
