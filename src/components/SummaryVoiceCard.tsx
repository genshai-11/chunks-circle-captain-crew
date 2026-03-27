import type { TranscriptResult } from '@/types';

function formatConfidence(confidence?: number) {
  if (typeof confidence !== 'number' || Number.isNaN(confidence) || confidence <= 0) return '—';
  return `${Math.round(confidence * 100)}%`;
}

function formatDuration(duration?: number) {
  if (typeof duration !== 'number' || Number.isNaN(duration) || duration <= 0) return '—';
  return `${duration.toFixed(1)}s`;
}

function getTranscriptPlaceholder(text?: string | null) {
  const t = String(text || '').trim();
  if (t) return t;
  return 'No transcript captured.';
}

export function SummaryVoiceCard({
  title,
  subtitle,
  transcript,
  transcriptMeta,
  audioUrl,
  audioFallbackMessage,
}: {
  title: string;
  subtitle: string;
  transcript?: string | null;
  transcriptMeta?: TranscriptResult | null;
  audioUrl: string | null;
  audioFallbackMessage?: string;
}) {
  return (
    <section className="soft-card admin-section-minimal summary-voice-card">
      <div className="summary-voice-header">
        <div>
          <p className="page-kicker summary-voice-kicker">{title}</p>
          <h2 className="section-title">{subtitle}</h2>
        </div>
        <div className="analysis-metrics summary-inline-metrics">
          <div>
            <span className="metric-label">confidence</span>
            <span className="metric-value">{formatConfidence(transcriptMeta?.confidence)}</span>
          </div>
          <div>
            <span className="metric-label">duration</span>
            <span className="metric-value">{formatDuration(transcriptMeta?.duration)}</span>
          </div>
        </div>
      </div>

      <div className="summary-audio-block">
        <span className="metric-label">audio replay</span>
        {audioUrl ? (
          <audio controls preload="metadata" className="summary-audio-player" src={audioUrl} />
        ) : (
          <p className="admin-message">{audioFallbackMessage || 'No saved audio available for this role.'}</p>
        )}
      </div>

      <div className="summary-transcript-block">
        <span className="metric-label">transcript</span>
        <p className="admin-transcript-preview summary-transcript-text">{getTranscriptPlaceholder(transcript)}</p>
      </div>
    </section>
  );
}
