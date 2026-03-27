interface AudioWaveProps {
  levels: number[];
  color: 'blue' | 'red';
}

export function AudioWave({ levels, color }: AudioWaveProps) {
  return (
    <div className={`audio-wave audio-wave-${color}`} aria-hidden="true">
      {levels.map((level, index) => {
        const waveLevel = Math.max(0.18, Math.min(1, level || 0));
        return (
          <span
            key={`${color}-${index}`}
            className="audio-wave-bar"
            style={{ ['--wave-level' as string]: waveLevel, ['--wave-index' as string]: index } as React.CSSProperties}
          >
            <span className="audio-wave-bar-fill" />
            <span className="audio-wave-bar-cap" />
          </span>
        );
      })}
    </div>
  );
}
