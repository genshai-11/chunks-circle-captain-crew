import { collection, doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { RoomDoc } from './types';

function userRoomRef(userId: string, roomId: string) {
  return doc(db!, 'users', userId, 'rooms', roomId);
}


function randomJoinCode(length = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export async function createRoomWithJoinCode(hostId: string) {
  if (!db) throw new Error('Firestore not configured');

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const joinCode = randomJoinCode(6);

    const roomRef = doc(collection(db, 'rooms'));
    const codeRef = doc(db, 'room_codes', joinCode);

    try {
      await runTransaction(db, async (tx) => {
        const codeSnap = await tx.get(codeRef);
        if (codeSnap.exists()) throw new Error('JOIN_CODE_TAKEN');

        tx.set(roomRef, {
          hostId,
          captainId: null,
          crewId: null,
          captainName: null,
          crewName: null,
          captainScore: 0,
          crewScore: 0,
          joinCode,
          status: 'waiting',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        } satisfies RoomDoc as any);

        tx.set(codeRef, {
          roomId: roomRef.id,
          hostId,
          createdAt: serverTimestamp(),
        });

        tx.set(userRoomRef(hostId, roomRef.id), {
          roomId: roomRef.id,
          joinCode,
          role: 'host',
          status: 'waiting',
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        });
      });

      return { roomId: roomRef.id, joinCode };
    } catch (error: any) {
      if (String(error?.message || '').includes('JOIN_CODE_TAKEN')) continue;
      // Retry on contention; otherwise surface.
      if (String(error?.code || '').includes('aborted')) continue;
      throw error;
    }
  }

  throw new Error('Could not allocate a join code. Please try again.');
}

export async function resolveJoinCode(input: string) {
  if (!db) throw new Error('Firestore not configured');

  const code = String(input || '').trim().toUpperCase();
  if (!code) throw new Error('Please enter a room code');

  const snap = await getDoc(doc(db, 'room_codes', code));
  if (!snap.exists()) throw new Error('Room code not found');

  const data = snap.data() as any;
  const roomId = String(data?.roomId || '').trim();
  if (!roomId) throw new Error('Invalid room code mapping');

  return { roomId, joinCode: code };
}
