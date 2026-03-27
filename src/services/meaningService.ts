import { loadAdminRuntimeConfig } from '@/services/adminConfigRepository';
import { MeaningEvaluation } from '@/types';

const EVALUATE_MEANING_URL = import.meta.env.DEV ? '/api/evaluateCaptionCrewMeaning' : (import.meta.env.VITE_EVALUATE_MEANING_URL || '');

export async function evaluateCaptionCrewMeaning(payload: {
  captainTranscript: string;
  crewTranscript: string;
  strictness: 'loose' | 'medium' | 'strict';
}) {
  if (!EVALUATE_MEANING_URL) {
    throw new Error('VITE_EVALUATE_MEANING_URL is not configured.');
  }

  const config = loadAdminRuntimeConfig();
  const response = await fetch(EVALUATE_MEANING_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      captainTranscript: payload.captainTranscript,
      crewTranscript: payload.crewTranscript,
      strictness: config.meaningStrictness || payload.strictness,
      meaningWeight: config.meaningWeight,
      feedbackConfig: {
        enabled: config.feedbackEnabled,
        feedbackMode: config.feedbackMode,
        tone: config.feedbackTone,
        showGrammarReminder: config.showGrammarReminder,
        showImprovedSentence: config.showImprovedSentence,
        showWhenMeaningCorrect: config.showWhenMeaningCorrect,
        onlyIfAffectsClarity: config.onlyIfAffectsClarity,
      },
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Meaning evaluation failed');
  }

  return {
    matchScore: Number(data.matchScore || 0),
    decision: data.decision || 'mismatch',
    reason: data.reason || 'Evaluation completed.',
    missingConcepts: Array.isArray(data.missingConcepts) ? data.missingConcepts : [],
    extraConcepts: Array.isArray(data.extraConcepts) ? data.extraConcepts : [],
    grammarNote: typeof data.grammarNote === 'string' ? data.grammarNote : '',
    improvedTranscript: typeof data.improvedTranscript === 'string' ? data.improvedTranscript : '',
    grammarSeverity: data.grammarSeverity || 'none',
    feedbackType: data.feedbackType || 'off',
  } as MeaningEvaluation;
}
