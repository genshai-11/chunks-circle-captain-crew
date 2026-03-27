import { AudioWave } from '@/components/AudioWave';

interface RolePanelProps {
  role: 'captain' | 'crew';
  title: string;
  color: 'blue' | 'red';
  recording: boolean;
  active: boolean;
  disabled: boolean;
  processing?: boolean;
  countdownLabel?: string;
  helperText?: string;
  levels: number[];
  onStart: () => void;
  onStop: () => void;
}

export function RolePanel({
  role,
  title,
  color,
  recording,
  active,
  disabled,
  processing,
  countdownLabel,
  helperText,
  levels,
  onStart,
  onStop,
}: RolePanelProps) {
  const classes = [
    'role-surface',
    `role-surface-${color}`,
    active ? 'is-active' : '',
    disabled ? 'is-disabled' : '',
    recording ? 'is-recording' : '',
    processing ? 'is-processing' : '',
  ].filter(Boolean).join(' ');

  const actionLabel = processing
    ? 'Processing…'
    : recording
      ? 'Tap to stop'
      : disabled
        ? 'Wait'
        : 'Tap to start';

  const description = countdownLabel || helperText || (role === 'captain' ? 'Speak in Vietnamese' : 'Speak in English');

  return (
    <button
      type="button"
      className={classes}
      disabled={disabled && !recording}
      onClick={recording ? onStop : onStart}
      aria-label={`${title} ${actionLabel}`}
    >
      <div className="role-surface-inner">
        <div className="role-surface-copy">
          <span className="role-name">{title}</span>
          <span className="role-hint">{description}</span>
        </div>

        <div className="role-surface-center">
          {recording ? (
            <>
              <AudioWave levels={levels} color={color} />
              <span className="role-action-label">Recording · tap to stop</span>
            </>
          ) : processing ? (
            <>
              <div className="pulse-orbit" />
              <span className="role-action-label">Processing…</span>
            </>
          ) : (
            <>
              <div className="touch-disc" />
              <span className="role-action-label">{actionLabel}</span>
            </>
          )}
        </div>
      </div>
    </button>
  );
}
