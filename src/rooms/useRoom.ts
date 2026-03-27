import { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { RoomDoc, RoomRoundDoc } from './types';

export function useRoom(roomId: string | null, userId?: string) {
  const [room, setRoom] = useState<(RoomDoc & { id: string }) | null>(null);
  const [rounds, setRounds] = useState<Array<RoomRoundDoc & { id: string }>>([]);
  const [loading, setLoading] = useState(true);

  const enabled = useMemo(() => Boolean(roomId && db), [roomId]);

  useEffect(() => {
    if (!enabled || !roomId || !db) {
      setRoom(null);
      setRounds([]);
      setLoading(false);
      return;
    }

    const roomRef = doc(db, 'rooms', roomId);
    const unsubRoom = onSnapshot(
      roomRef,
      (snap) => {
        if (snap.exists()) {
          setRoom({ id: snap.id, ...(snap.data() as RoomDoc) });
        } else {
          setRoom(null);
        }
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => {
      unsubRoom();
    };
  }, [enabled, roomId]);

  useEffect(() => {
    // Only participants can read rounds. Avoid subscribing until the user has joined.
    if (!enabled || !roomId || !db || !userId || !room) {
      setRounds([]);
      return;
    }

    const isParticipant = room.hostId === userId || room.captainId === userId || room.crewId === userId;
    if (!isParticipant) {
      setRounds([]);
      return;
    }

    const roundsRef = collection(db, 'rooms', roomId, 'rounds');
    const q = query(roundsRef, orderBy('createdAt', 'asc'));
    const unsubRounds = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...(d.data() as RoomRoundDoc) }));
        setRounds(data);
      },
      () => undefined
    );

    return () => {
      unsubRounds();
    };
  }, [enabled, roomId, room, userId]);

  return { room, rounds, loading };
}
