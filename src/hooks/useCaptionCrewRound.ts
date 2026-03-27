import { useCallback, useEffect, useRef, useState } from 'react';
import { evaluateCaptionCrewMeaning } from '@/services/meaningService';
import { uploadRoundAudio } from '@/services/roundAudioStorage';
import { defaultGameSettings, loadSettings, saveRound } from '@/services/roundRepository';
import { transcribeRoundAudio } from '@/services/transcriptionService';
import { GameSettings, MeaningEvaluation, RoundRecord, RoundState, TranscriptResult } from '@/types';
import { useRoundRecorder } from './useRoundRecorder';

function createRoundId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function useCaptionCrewRound() {
  const captainRecorder = useRoundRecorder();
  const crewRecorder = useRoundRecorder();

  const [state, setState] = useState<RoundState>('captain-ready');
  const [settings, setSettings] = useState<GameSettings>(defaultGameSettings);
  const [captainTranscript, setCaptainTranscript] = useState<TranscriptResult | null>(null);
  const [crewTranscript, setCrewTranscript] = useState<TranscriptResult | null>(null);
  const [captainAudioBlob, setCaptainAudioBlob] = useState<Blob | null>(null);
  const [captainAudioUrl, setCaptainAudioUrl] = useState<string | null>(null);
  const [crewAudioUrl, setCrewAudioUrl] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<MeaningEvaluation | null>(null);
  const [reactionDelayMs, setReactionDelayMs] = useState<number | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [countdownMs, setCountdownMs] = useState<number | null>(null);

  const captainAudioBlobRef = useRef<Blob | null>(null);
  const captainStoppedAtRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);
  const captainTranscriptPromiseRef = useRef<Promise<TranscriptResult> | null>(null);
  const activeRoundTokenRef = useRef(0);

  useEffect(() => {
    loadSettings().then(setSettings).catch(() => undefined);
  }, []);

  const clearCrewTimers = useCallback(() => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    if (countdownIntervalRef.current) window.clearInterval(countdownIntervalRef.current);
    timeoutRef.current = null;
    countdownIntervalRef.current = null;
    setCountdownMs(null);
  }, []);

  const startCaptainTranscriptionPrefetch = useCallback((blob: Blob) => {
    const roundToken = activeRoundTokenRef.current;
    const promise = transcribeRoundAudio(blob, { role: 'captain', language: 'vi' })
      .then((result) => {
        if (activeRoundTokenRef.current === roundToken) {
          setCaptainTranscript(result);
        }
        return result;
      });

    captainTranscriptPromiseRef.current = promise;
    return promise;
  }, []);

  const resetRound = useCallback(() => {
    activeRoundTokenRef.current += 1;
    captainRecorder.reset();
    crewRecorder.reset();
    setState('captain-ready');
    setCaptainTranscript(null);
    setCrewTranscript(null);
    setCaptainAudioBlob(null);
    setCaptainAudioUrl(null);
    setCrewAudioUrl(null);
    setEvaluation(null);
    setReactionDelayMs(null);
    setFeedbackError(null);
    captainAudioBlobRef.current = null;
    captainStoppedAtRef.current = null;
    captainTranscriptPromiseRef.current = null;
    clearCrewTimers();
  }, [captainRecorder, clearCrewTimers, crewRecorder]);

  const startCaptain = useCallback(async () => {
    resetRound();
    setState('captain-recording');
    await captainRecorder.start();
  }, [captainRecorder, resetRound]);

  const stopCaptain = useCallback(async () => {
    const blob = await captainRecorder.stop();
    if (!blob) {
      setFeedbackError('No Captain audio captured.');
      setState('captain-ready');
      return;
    }

    captainAudioBlobRef.current = blob;
    setCaptainAudioBlob(blob);
    captainStoppedAtRef.current = Date.now();
    setState('crew-waiting');
    setCountdownMs(settings.maxCrewStartDelayMs);
    startCaptainTranscriptionPrefetch(blob);

    const waitingStartedAt = Date.now();
    timeoutRef.current = window.setTimeout(() => {
      setReactionDelayMs(Date.now() - (captainStoppedAtRef.current || Date.now()));
      setEvaluation({ matchScore: 0, decision: 'timeout', reason: 'Crew started too late.', feedbackType: 'off' });
      setState('crew-timeout');
    }, settings.maxCrewStartDelayMs);

    countdownIntervalRef.current = window.setInterval(() => {
      const elapsed = Date.now() - waitingStartedAt;
      setCountdownMs(Math.max(settings.maxCrewStartDelayMs - elapsed, 0));
    }, 100);
  }, [captainRecorder, settings.maxCrewStartDelayMs, startCaptainTranscriptionPrefetch]);

  const startCrew = useCallback(async () => {
    if (state !== 'crew-waiting') return;
    const delay = Date.now() - (captainStoppedAtRef.current || Date.now());
    setReactionDelayMs(delay);
    if (delay > settings.maxCrewStartDelayMs) {
      clearCrewTimers();
      setEvaluation({ matchScore: 0, decision: 'timeout', reason: 'Crew started too late.', feedbackType: 'off' });
      setState('crew-timeout');
      return;
    }

    clearCrewTimers();
    setState('crew-recording');
    await crewRecorder.start();
  }, [clearCrewTimers, crewRecorder, settings.maxCrewStartDelayMs, state]);

  const stopCrew = useCallback(async () => {
    setState('crew-processing');
    const crewBlob = await crewRecorder.stop();
    if (!crewBlob) {
      setFeedbackError('No Crew audio captured.');
      setState('crew-waiting');
      return;
    }

    if (!captainAudioBlobRef.current) {
      setFeedbackError('Captain audio is missing. Please try again.');
      setState('captain-ready');
      return;
    }

    try {
      setState('evaluating');
      const roundToken = activeRoundTokenRef.current;
      const captainPromise = captainTranscriptPromiseRef.current || startCaptainTranscriptionPrefetch(captainAudioBlobRef.current);
      const [captainResult, crewResult] = await Promise.all([
        captainPromise,
        transcribeRoundAudio(crewBlob, { role: 'crew', language: 'en' }),
      ]);

      setCaptainTranscript(captainResult);
      setCrewTranscript(crewResult);

      const result = await evaluateCaptionCrewMeaning({
        captainTranscript: captainResult.transcript,
        crewTranscript: crewResult.transcript,
        strictness: settings.strictness,
      });

      setEvaluation(result);
      setState('results');

      const roundId = createRoundId();
      void (async () => {
        try {
          const [captainAudio, crewAudio] = await Promise.all([
            uploadRoundAudio(roundId, 'captain', captainAudioBlobRef.current!),
            uploadRoundAudio(roundId, 'crew', crewBlob),
          ]);

          if (activeRoundTokenRef.current === roundToken) {
            setCaptainAudioUrl(captainAudio.url);
            setCrewAudioUrl(crewAudio.url);
          }

          const round: RoundRecord = {
            id: roundId,
            createdAt: new Date().toISOString(),
            state: 'results',
            captainTranscript: captainResult,
            crewTranscript: crewResult,
            evaluation: result,
            reactionDelayMs: reactionDelayMs || undefined,
            timeoutLost: false,
            captainAudioUrl: captainAudio.url,
            crewAudioUrl: crewAudio.url,
            captainAudioPath: captainAudio.path,
            crewAudioPath: crewAudio.path,
            captainAudioMimeType: captainAudio.mimeType,
            crewAudioMimeType: crewAudio.mimeType,
          };
          await saveRound(round);
        } catch (backgroundError) {
          console.warn('Background save failed', backgroundError);
        }
      })();
    } catch (error: any) {
      setFeedbackError(error.message || 'Analysis failed.');
      setState('results');
    }
  }, [crewRecorder, reactionDelayMs, settings.strictness, startCaptainTranscriptionPrefetch]);

  useEffect(() => () => clearCrewTimers(), [clearCrewTimers]);

  return {
    state,
    settings,
    setSettings,
    captainRecorder,
    crewRecorder,
    captainTranscript,
    crewTranscript,
    captainAudioBlob,
    captainAudioUrl,
    crewAudioBlob: crewRecorder.audioBlob,
    crewAudioUrl,
    evaluation,
    feedbackError,
    reactionDelayMs,
    countdownMs,
    canStartCaptain: state === 'captain-ready',
    canStartCrew: state === 'crew-waiting',
    startCaptain,
    stopCaptain,
    startCrew,
    stopCrew,
    resetRound,
  };
}
