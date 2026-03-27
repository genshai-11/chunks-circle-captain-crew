import { useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ResultCard } from '@/components/ResultCard';
import { SummaryLocationState, TranscriptResult } from '@/types';

function formatConfidence(confidence?: number) {
  if (typeof confidence !== 'number' || Number.isNaN(confidence) || confidence <= 0) return '—';
  return `${Math.round(confidence * 100)}%`;
}

function formatDuration(duration?: number) {
  if (typeof duration !== 'number' || Number.isNaN(duration) || duration <= 0) return '—';
  return `${duration.toFixed(1)}s`;
}

function getTranscriptPlaceholder(transcript?: TranscriptResult | null) {
  if (!transcript) return 'No transcript captured.';
  if (transcript.transcript?.trim()) return transcript.transcript;
  return 'Audio was saved, but no speech was recognized.';
}

function SummaryVoiceCard({
  title,
  subtitle,
  transcript,
  audioUrl,
}: {
  title: string;
  subtitle: string;
  transcript?: TranscriptResult | null;
  audioUrl: string | null;
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
            <span className="metric-value">{formatConfidence(transcript?.confidence)}</span>
          </div>
          <div>
            <span className="metric-label">duration</span>
            <span className="metric-value">{formatDuration(transcript?.duration)}</span>
          </div>
        </div>
      </div>

      <div className="summary-audio-block">
        <span className="metric-label">saved audio</span>
        {audioUrl ? (
          <audio controls preload="metadata" className="summary-audio-player" src={audioUrl} />
        ) : (
          <p className="admin-message">No saved audio available for this role.</p>
        )}
      </div>

      <div className="summary-transcript-block">
        <span className="metric-label">transcript</span>
        <p className="admin-transcript-preview summary-transcript-text">{getTranscriptPlaceholder(transcript)}</p>
      </div>
    </section>
  );
}

export default function AnalysisSummaryPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const summary = (location.state || null) as SummaryLocationState | null;
  const [captainAudioUrl, setCaptainAudioUrl] = useState<string | null>(null);
  const [crewAudioUrl, setCrewAudioUrl] = useState<string | null>(null);

  const hasContent = useMemo(() => !!summary?.evaluation || !!summary?.errorMessage, [summary]);

  useEffect(() => {
    if (summary?.captainAudioUrl) {
      setCaptainAudioUrl(summary.captainAudioUrl);
      return undefined;
    }
    if (!summary?.captainAudioBlob) {
      setCaptainAudioUrl(null);
      return undefined;
    }

    const url = URL.createObjectURL(summary.captainAudioBlob);
    setCaptainAudioUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [summary?.captainAudioBlob, summary?.captainAudioUrl]);

  useEffect(() => {
    if (summary?.crewAudioUrl) {
      setCrewAudioUrl(summary.crewAudioUrl);
      return undefined;
    }
    if (!summary?.crewAudioBlob) {
      setCrewAudioUrl(null);
      return undefined;
    }

    const url = URL.createObjectURL(summary.crewAudioBlob);
    setCrewAudioUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [summary?.crewAudioBlob, summary?.crewAudioUrl]);

  if (!hasContent) {
    return <Navigate to="/" replace />;
  }

  return (
    <main className="screen-shell admin-shell summary-screen">
      <header className="page-header brand-header">
        <div className="chunks-brand-block summary-brand-block">
          <img src="/chunks-logo.png" alt="Chunks" className="chunks-logo summary-logo" />
          <div>
            <p className="page-kicker">Round summary</p>
            <h1 className="page-title">Chunks Circle</h1>
          </div>
        </div>
      </header>

      {summary?.errorMessage && (
        <section className="soft-card admin-section-minimal">
          <p className="game-error summary-error">{summary.errorMessage}</p>
          <div className="action-row">
            <button type="button" className="primary-pill-button" onClick={() => navigate('/', { replace: true })}>
              Back to game
            </button>
          </div>
        </section>
      )}

      {(summary?.captainTranscript || summary?.crewTranscript || summary?.captainAudioBlob || summary?.crewAudioBlob) && (
        <section className="summary-two-up">
          <SummaryVoiceCard
            title="Component 1"
            subtitle="Captain · Vietnamese input"
            transcript={summary?.captainTranscript}
            audioUrl={captainAudioUrl}
          />
          <SummaryVoiceCard
            title="Component 2"
            subtitle="Crew · English response"
            transcript={summary?.crewTranscript}
            audioUrl={crewAudioUrl}
          />
        </section>
      )}

      {summary?.evaluation && (
        <ResultCard
          evaluation={summary.evaluation}
          reactionDelayMs={summary.reactionDelayMs}
          onReset={() => navigate('/', { replace: true })}
        />
      )}
    </main>
  );
}
