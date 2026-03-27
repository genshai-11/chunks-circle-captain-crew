import { useCallback, useState } from 'react';
import { addDoc, collection, doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { evaluateCaptionCrewMeaning } from '@/services/meaningService';
import { transcribeRoundAudio } from '@/services/transcriptionService';
import { useRoundRecorder } from '@/hooks/useRoundRecorder';
import type { RoomDoc, RoomRoundDoc } from './types';

async function waitForCaptainTranscript(params: {
  roomId: string;
  roundId: string;
  timeoutMs?: number;
  intervalMs?: number;
}) {
  const { roomId, roundId, timeoutMs = 25000, intervalMs = 600 } = params;
  if (!db) throw new Error('Firestore not configured');

  const started = Date.now();
  const roundRef = doc(db, 'rooms', roomId, 'rounds', roundId);

  while (Date.now() - started < timeoutMs) {
    const snap = await getDoc(roundRef);
    const data = snap.data() as RoomRoundDoc | undefined;
    const captainTranscript = String(data?.captainTranscript || '').trim();
    if (captainTranscript) return captainTranscript;
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  return '';
}

export function useRoomGame(params: {
  roomId: string;
  room: (RoomDoc & { id: string }) | null;
  rounds: Array<RoomRoundDoc & { id: string }>;
}) {
  const { roomId, room, rounds } = params;
  const user = auth?.currentUser || null;

  const captainRecorder = useRoundRecorder();
  const crewRecorder = useRoundRecorder();

  const [processing, setProcessing] = useState(false);

  const currentRound = rounds.length ? rounds[rounds.length - 1] : null;
  const isCaptain = !!user?.uid && room?.captainId === user.uid;
  const isCrew = !!user?.uid && room?.crewId === user.uid;

  const canStartRound = Boolean(user?.uid && isCaptain);
  const canStartCaptain = Boolean(currentRound && currentRound.status === 'captain_speaking' && isCaptain && !processing);
  const canStartCrew = Boolean(currentRound && currentRound.status === 'crew_speaking' && isCrew && !processing);

  const joinRole = useCallback(
    async (role: 'captain' | 'crew') => {
      if (!db) throw new Error('Firestore not configured');
      if (!user?.uid) throw new Error('Please sign in first');

      const roomRef = doc(db, 'rooms', roomId);
      await updateDoc(roomRef, {
        ...(role === 'captain' ? { captainId: user.uid } : { crewId: user.uid }),
        updatedAt: serverTimestamp(),
      });
    },
    [roomId, user?.uid]
  );

  const createRoom = useCallback(async () => {
    if (!db) throw new Error('Firestore not configured');
    if (!user?.uid) throw new Error('Please sign in first');

    const roomsRef = collection(db, 'rooms');
    const docRef = await addDoc(roomsRef, {
      hostId: user.uid,
      captainId: null,
      crewId: null,
      status: 'waiting',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    } satisfies RoomDoc);

    return docRef.id;
  }, [user?.uid]);

  const startRound = useCallback(async () => {
    if (!db) throw new Error('Firestore not configured');
    if (!user?.uid || !isCaptain) return;

    const roundsRef = collection(db, 'rooms', roomId, 'rounds');
    await addDoc(roundsRef, {
      roomId,
      roundNumber: rounds.length + 1,
      status: 'captain_speaking',
      createdAt: serverTimestamp(),
    } satisfies Partial<RoomRoundDoc>);

    await updateDoc(doc(db, 'rooms', roomId), {
      status: 'playing',
      updatedAt: serverTimestamp(),
    });
  }, [isCaptain, roomId, rounds.length, user?.uid]);

  const startCaptain = useCallback(async () => {
    await captainRecorder.start();
  }, [captainRecorder]);

  const stopCaptain = useCallback(async () => {
    if (!db) return;
    if (!currentRound) return;

    setProcessing(true);
    const blob = await captainRecorder.stop();
    if (!blob) {
      setProcessing(false);
      return;
    }

    const roundRef = doc(db, 'rooms', roomId, 'rounds', currentRound.id);

    // IMPORTANT: move to crew immediately (do not wait transcript)
    const stoppedAtMs = Date.now();
    await updateDoc(roundRef, {
      status: 'crew_speaking',
      captainStoppedAtMs: stoppedAtMs,
    });

    // Background STT
    void (async () => {
      try {
        const result = await transcribeRoundAudio(blob, { role: 'captain', language: 'vi' });
        await updateDoc(roundRef, {
          captainTranscript: result.transcript,
          captainTranscriptMeta: result,
        });
      } catch {
        // ignore; crew can still proceed
      }
    })();

    setProcessing(false);
  }, [captainRecorder, currentRound, roomId]);

  const startCrew = useCallback(async () => {
    if (!db || !currentRound) return;
    const roundRef = doc(db, 'rooms', roomId, 'rounds', currentRound.id);
    await updateDoc(roundRef, {
      crewStartedAtMs: Date.now(),
    });
    await crewRecorder.start();
  }, [crewRecorder, currentRound, roomId]);

  const stopCrew = useCallback(async () => {
    if (!db) return;
    if (!currentRound) return;

    setProcessing(true);
    const blob = await crewRecorder.stop();
    if (!blob) {
      setProcessing(false);
      return;
    }

    const roundRef = doc(db, 'rooms', roomId, 'rounds', currentRound.id);

    // Set evaluating quickly
    await updateDoc(roundRef, {
      status: 'evaluating',
    });

    try {
      const crewResult = await transcribeRoundAudio(blob, { role: 'crew', language: 'en' });
      await updateDoc(roundRef, {
        crewTranscript: crewResult.transcript,
        crewTranscriptMeta: crewResult,
      });

      // Wait for captain transcript if not ready yet
      const snap = await getDoc(roundRef);
      const data = snap.data() as RoomRoundDoc | undefined;
      const captainTranscript =
        String(data?.captainTranscript || '').trim() ||
        (await waitForCaptainTranscript({ roomId, roundId: currentRound.id }));

      const evaluation = await evaluateCaptionCrewMeaning({
        captainTranscript,
        crewTranscript: crewResult.transcript,
        strictness: 'medium',
      });

      const captainStoppedAtMs = Number(data?.captainStoppedAtMs || 0);
      const crewStartedAtMs = Number(data?.crewStartedAtMs || 0);
      const reactionDelayMs =
        captainStoppedAtMs && crewStartedAtMs ? Math.max(0, crewStartedAtMs - captainStoppedAtMs) : undefined;

      await updateDoc(roundRef, {
        meaningScore: evaluation.matchScore,
        feedback: evaluation.reason,
        meaningAnalysis: evaluation,
        reactionDelayMs: reactionDelayMs ?? null,
        status: 'finished',
      });
    } finally {
      setProcessing(false);
    }
  }, [crewRecorder, currentRound, roomId]);

  return {
    user,
    processing,
    currentRound,
    isCaptain,
    isCrew,
    canStartRound,
    canStartCaptain,
    canStartCrew,
    createRoom,
    joinRole,
    startRound,
    captainRecorder,
    crewRecorder,
    startCaptain,
    stopCaptain,
    startCrew,
    stopCrew,
  };
}
