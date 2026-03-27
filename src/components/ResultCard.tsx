import { MeaningEvaluation } from '@/types';

interface ResultCardProps {
  evaluation: MeaningEvaluation | null;
  reactionDelayMs: number | null;
  onReset: () => void;
}

function DetailList({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;

  return (
    <div className="analysis-detail-block">
      <span className="metric-label">{title}</span>
      <ul className="analysis-detail-list">
        {items.map((item) => (
          <li key={`${title}-${item}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function ResultCard({ evaluation, reactionDelayMs, onReset }: ResultCardProps) {
  if (!evaluation) {
    return null;
  }

  return (
    <section className="analysis-card">
      <div className="analysis-topline">
        <span className="analysis-label">llm meaning analysis</span>
        <span className={`analysis-pill decision-${evaluation.decision}`}>{evaluation.decision}</span>
      </div>

      <div className="analysis-score-block">
        <div className="analysis-score">{evaluation.matchScore}</div>
        <div className="analysis-caption">meaning match</div>
      </div>

      <div className="analysis-metrics">
        <div>
          <span className="metric-label">response delay</span>
          <span className="metric-value">{reactionDelayMs != null ? `${(reactionDelayMs / 1000).toFixed(2)}s` : '—'}</span>
        </div>
        <div>
          <span className="metric-label">feedback mode</span>
          <span className="metric-value">{evaluation.feedbackType || 'off'}</span>
        </div>
      </div>

      <div className="analysis-detail-block">
        <span className="metric-label">summary</span>
        <p className="analysis-reason">{evaluation.reason}</p>
      </div>

      <div className="analysis-grid-two-up">
        <DetailList title="missing meaning" items={evaluation.missingConcepts} />
        <DetailList title="extra meaning" items={evaluation.extraConcepts} />
      </div>

      {(evaluation.grammarNote || evaluation.improvedTranscript) && (
        <div className="analysis-grid-two-up">
          {evaluation.grammarNote && (
            <div className="analysis-detail-block">
              <span className="metric-label">clarity note</span>
              <p className="analysis-reason">{evaluation.grammarNote}</p>
            </div>
          )}
          {evaluation.improvedTranscript && (
            <div className="analysis-detail-block">
              <span className="metric-label">suggested English</span>
              <p className="analysis-reason">{evaluation.improvedTranscript}</p>
            </div>
          )}
        </div>
      )}

      <button type="button" className="primary-pill-button" onClick={onReset}>
        Play again
      </button>
    </section>
  );
}
