import { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, onSnapshot, collection, query, orderBy } from 'firebase/firestore';

export interface Room {
  id: string;
  hostId: string;
  captainId?: string;
  crewId?: string;
  status: 'waiting' | 'playing' | 'finished';
  createdAt: any;
  updatedAt: any;
}

export interface Round {
  id: string;
  roomId: string;
  roundNumber: number;
  captainTranscript?: string;
  crewTranscript?: string;
  meaningScore?: number;
  feedback?: string;
  status: 'captain_speaking' | 'crew_speaking' | 'evaluating' | 'finished';
  createdAt: any;
}

export const useRoom = (roomId: string | null) => {
  const [room, setRoom] = useState<Room | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roomId) {
      setRoom(null);
      setRounds([]);
      setLoading(false);
      return;
    }

    const roomRef = doc(db, 'rooms', roomId);
    const unsubscribeRoom = onSnapshot(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        setRoom({ id: snapshot.id, ...snapshot.data() } as Room);
      } else {
        setRoom(null);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `rooms/${roomId}`);
    });

    const roundsRef = collection(db, 'rooms', roomId, 'rounds');
    const q = query(roundsRef, orderBy('createdAt', 'asc'));
    const unsubscribeRounds = onSnapshot(q, (snapshot) => {
      const roundsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Round));
      setRounds(roundsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `rooms/${roomId}/rounds`);
    });

    return () => {
      unsubscribeRoom();
      unsubscribeRounds();
    };
  }, [roomId]);

  return { room, rounds, loading };
};
