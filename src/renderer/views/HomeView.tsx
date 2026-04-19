// src/renderer/views/HomeView.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import URLInput from '@/components/URLInput';
import { ipcClient } from '@/renderer/ipc/client';
import { useUIStore } from '@/renderer/stores/uiStore';

export default function HomeView() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const addToast = useUIStore((s) => s.addToast);

  const handleURL = (url: string) => {
    if (!url.trim()) return;
    
    const isPlaylist = url.includes('list=') || url.includes('playlist?');
    if (isPlaylist) {
      navigate('/playlist', { state: { url, autoAnalyze: true } });
    } else {
      navigate('/video', { state: { url, autoAnalyze: true } });
    }
  };

  return (
    <div className="page-container" style={{ 
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      textAlign: 'center'
    }}>
      <div style={{ width: '100%', maxWidth: 900, marginBottom: 64 }}>
        <h1 style={{ 
          fontSize: 48, 
          fontWeight: 800, 
          marginBottom: 16,
          letterSpacing: '-0.03em',
          background: 'linear-gradient(135deg, var(--text-primary) 0%, var(--accent) 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          OFFLINER
        </h1>
        <p style={{ 
          fontSize: 18,
          color: 'var(--text-secondary)', 
          marginBottom: 48,
          maxWidth: 600,
          margin: '0 auto 48px'
        }}>
          Experience the fastest, most elegant way to capture your favorite content.
        </p>
        
        <URLInput 
          onURL={handleURL} 
          loading={loading} 
          placeholder="Paste video or playlist link here..." 
        />
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(3, 1fr)', 
        gap: 24,
        width: '100%',
        maxWidth: 800
      }}>
        <QuickActionCard 
          title="Video" 
          subtitle="Full HD Downloads" 
          onClick={() => navigate('/video')} 
        />
        <QuickActionCard 
          title="Audio" 
          subtitle="Studio Quality" 
          onClick={() => navigate('/audio')} 
        />
        <QuickActionCard 
          title="Clips" 
          subtitle="Precise Trimming" 
          onClick={() => navigate('/clips')} 
        />
      </div>
    </div>
  );
}

function QuickActionCard({ title, subtitle, onClick }: { title: string; subtitle: string; onClick: () => void }) {
  return (
    <div className="glass glass-hover" onClick={onClick} style={{
      padding: '24px 20px',
      borderRadius: 'var(--radius-md)',
      cursor: 'pointer',
      textAlign: 'center',
      transition: 'all var(--transition-spring)',
    }}>
      <div style={{ 
        fontWeight: 700, 
        fontSize: 16,
        marginBottom: 4,
        color: 'var(--text-primary)',
        fontFamily: '"Plus Jakarta Sans", sans-serif'
      }}>{title}</div>
      <div style={{ 
        fontSize: 13, 
        color: 'var(--text-tertiary)',
        fontWeight: 500
      }}>{subtitle}</div>
    </div>
  );
}
