import { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { RoomDoc, RoomRoundDoc } from './types';

export function useRoom(roomId: string | null) {
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
      unsubRoom();
      unsubRounds();
    };
  }, [enabled, roomId]);

  return { room, rounds, loading };
}
