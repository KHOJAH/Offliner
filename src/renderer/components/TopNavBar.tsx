// src/renderer/components/TopNavBar.tsx
import { useNavigate, useLocation } from 'react-router-dom';

const tabs = [
  { path: '/', label: 'Home', icon: '🏠' },
  { path: '/video', label: 'Video', icon: '📹' },
  { path: '/audio', label: 'Audio', icon: '🎵' },
  { path: '/playlist', label: 'Playlist', icon: '📋' },
  { path: '/clips', label: 'Clips', icon: '🎬' },
  { path: '/queue', label: 'Queue', icon: '⏱️' },
  { path: '/settings', label: 'Settings', icon: '⚙️' },
];

interface WindowControlProps {
  type: 'minimize' | 'maximize' | 'close';
  onClick: () => void;
}

const WindowControl = ({ type, onClick }: WindowControlProps) => {
  const getHoverColor = () => {
    if (type === 'close') return 'var(--error)';
    return 'var(--accent)';
  };

  return (
    <button
      onClick={onClick}
      style={{
        width: '14px',
        height: '14px',
        borderRadius: '50%',
        border: 'none',
        backgroundColor: 'var(--text-tertiary)',
        cursor: 'pointer',
        transition: 'all var(--transition-fast)',
        WebkitAppRegion: 'no-drag',
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      } as any}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = getHoverColor();
        e.currentTarget.style.transform = 'scale(1.1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--text-tertiary)';
        e.currentTarget.style.transform = 'scale(1)';
      }}
      title={type.charAt(0).toUpperCase() + type.slice(1)}
    />
  );
};

export default function TopNavBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const activePath = location.pathname;

  const handleMinimize = () => (window as any).electronAPI?.minimize();
  const handleMaximize = () => (window as any).electronAPI?.maximize();
  const handleClose = () => (window as any).electronAPI?.close();

  return (
    <nav
      className="glass"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        height: '56px',
        margin: '12px 12px 0 12px',
        WebkitAppRegion: 'drag',
        position: 'relative',
        zIndex: 100,
      } as any}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div 
          style={{ 
            fontSize: '18px', 
            fontWeight: 800, 
            color: 'var(--accent)', 
            letterSpacing: '-0.5px',
            fontFamily: "'Plus Jakarta Sans', sans-serif"
          }}
        >
          OFFLINER
        </div>
        <div style={{ display: 'flex', gap: '6px', WebkitAppRegion: 'no-drag' } as any}>
          {tabs.map((tab) => {
            const isActive = activePath === tab.path;
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                style={{
                  background: isActive ? 'rgba(14, 165, 233, 0.15)' : 'transparent',
                  border: 'none',
                  color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '13px',
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontWeight: isActive ? 700 : 500,
                  transition: 'all var(--transition-fast)',
                  outline: 'none',
                } as any}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.4)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }
                }}
              >
                <span style={{ fontSize: '15px', filter: isActive ? 'none' : 'grayscale(100%) opacity(0.7)' }}>
                  {tab.icon}
                </span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          paddingLeft: '20px',
          WebkitAppRegion: 'no-drag',
        } as any}
      >
        <WindowControl type="minimize" onClick={handleMinimize} />
        <WindowControl type="maximize" onClick={handleMaximize} />
        <WindowControl type="close" onClick={handleClose} />
      </div>
    </nav>
  );
}
