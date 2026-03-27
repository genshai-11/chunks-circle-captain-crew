import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, orderBy, query, limit } from 'firebase/firestore';
import { usePlayerAuth } from '@/auth/PlayerAuth';
import { createRoomWithJoinCode, resolveJoinCode } from '@/rooms/roomService';
import { db } from '@/lib/firebase';

export default function LobbyPage() {
  const navigate = useNavigate();
  const { user, signOutPlayer } = usePlayerAuth();

  const [roomCode, setRoomCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [myRooms, setMyRooms] = useState<Array<{ roomId: string; joinCode?: string; role?: string; status?: string; updatedAt?: any }>>([]);

  const canUseDb = useMemo(() => Boolean(user?.uid), [user?.uid]);

  useEffect(() => {
    if (!db || !user?.uid) {
      setMyRooms([]);
      return undefined;
    }

    const q = query(collection(db, 'users', user.uid, 'rooms'), orderBy('updatedAt', 'desc'), limit(12));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => d.data() as any).filter(Boolean);
        setMyRooms(rows);
      },
      () => setMyRooms([])
    );

    return () => unsub();
  }, [user?.uid]);

  const createRoom = async () => {
    if (!user?.uid) return;

    const { roomId } = await createRoomWithJoinCode(user.uid);
    navigate(`/room/${roomId}`);
  };

  const joinRoom = async () => {
    setJoinError('');
    const code = roomCode.trim();
    if (!code) return;

    // If user pasted a full roomId, allow it.
    if (code.length >= 12) {
      navigate(`/room/${code}`);
      return;
    }

    try {
      const { roomId } = await resolveJoinCode(code);
      navigate(`/room/${roomId}`);
    } catch (error: any) {
      setJoinError(error?.message || 'Could not join room.');
    }
  };

  return (
    <main className="screen-shell">
      <header className="page-header">
        <div>
          <p className="page-kicker">Captain & Crew</p>
          <h1 className="page-title">Rooms</h1>
          <p className="muted-copy">Create a room and invite your partner to join as Captain/Crew.</p>
        </div>
        <div className="action-row">
          <button type="button" className="ghost-pill-button" onClick={() => void signOutPlayer()}>
            Sign out
          </button>
        </div>
      </header>

      <section className="soft-card admin-section-minimal">
        <div className="action-row">
          <button type="button" className="primary-pill-button" onClick={() => void createRoom()}>
            Create new room
          </button>
        </div>

        <div className="field-stack" style={{ marginTop: 16 }}>
          <label>Join by room code</label>
          <div className="action-row">
            <input value={roomCode} onChange={(e) => setRoomCode(e.target.value)} placeholder="Enter 6-char code (e.g., JBQ9KC) or paste full room id" />
            <button type="button" className="primary-pill-button" onClick={() => void joinRoom()}>
              Join
            </button>
          </div>
          {joinError && <p className="game-error" style={{ marginTop: 8 }}>{joinError}</p>}
        </div>

        {myRooms.length > 0 && (
          <div className="field-stack" style={{ marginTop: 16 }}>
            <label>My rooms</label>
            <div className="action-row">
              {myRooms.map((r) => (
                <button
                  key={r.roomId}
                  type="button"
                  className="ghost-pill-button"
                  onClick={() => navigate(`/room/${r.roomId}`)}
                >
                  {(String(r.joinCode || r.roomId.slice(0, 6))).toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="soft-card admin-section-minimal" style={{ marginTop: 16 }}>
        <p className="muted-copy">
          Tip: share the room link (or room id) with your partner. We intentionally do not list public rooms.
        </p>
      </section>
    </main>
  );
}
