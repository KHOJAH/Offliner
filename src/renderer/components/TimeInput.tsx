// src/renderer/components/TimeInput.tsx
interface TimeInputProps {
  label: string;
  value: number; // seconds
  onChange: (seconds: number) => void;
  maxDuration: number;
}

export default function TimeInput({ label, value, onChange, maxDuration }: TimeInputProps) {
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;

  const handleChange = (type: 'minutes' | 'seconds') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const num = parseInt(e.target.value, 10) || 0;
    if (type === 'minutes') {
      const newSeconds = num * 60 + (value % 60);
      onChange(Math.min(Math.max(0, newSeconds), maxDuration));
    } else {
      const newSeconds = Math.floor(value / 60) * 60 + num;
      onChange(Math.min(Math.max(0, newSeconds), maxDuration));
    }
  };

  return (
    <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
      {label}:
      <input
        type="number"
        value={minutes}
        onChange={handleChange('minutes')}
        min={0}
        max={Math.floor(maxDuration / 60)}
        className="input"
        style={{ width: 60, padding: '4px 8px' }}
      />
      :
      <input
        type="number"
        value={seconds}
        onChange={handleChange('seconds')}
        min={0}
        max={59}
        className="input"
        style={{ width: 60, padding: '4px 8px' }}
      />
    </label>
  );
}
