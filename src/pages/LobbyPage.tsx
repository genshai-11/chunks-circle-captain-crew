import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { usePlayerAuth } from '@/auth/PlayerAuth';

export default function LobbyPage() {
  const navigate = useNavigate();
  const { user, signOutPlayer } = usePlayerAuth();

  const [roomCode, setRoomCode] = useState('');

  const canUseDb = useMemo(() => Boolean(db && user?.uid), [user?.uid]);

  const createRoom = async () => {
    if (!db || !user?.uid) return;

    const ref = await addDoc(collection(db, 'rooms'), {
      hostId: user.uid,
      status: 'waiting',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    navigate(`/room/${ref.id}`);
  };

  const joinRoom = () => {
    const code = roomCode.trim();
    if (!code) return;
    navigate(`/room/${code}`);
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
            <input value={roomCode} onChange={(e) => setRoomCode(e.target.value)} placeholder="Paste room id" />
            <button type="button" className="primary-pill-button" onClick={joinRoom}>
              Join
            </button>
          </div>
        </div>
      </section>

      <section className="soft-card admin-section-minimal" style={{ marginTop: 16 }}>
        <p className="muted-copy">
          Tip: share the room link (or room id) with your partner. We intentionally do not list public rooms.
        </p>
      </section>
    </main>
  );
}
