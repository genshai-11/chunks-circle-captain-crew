import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addDoc, collection, limit, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { usePlayerAuth } from '@/auth/PlayerAuth';

interface LobbyRoom {
  id: string;
  hostId: string;
  captainId?: string;
  crewId?: string;
  status: string;
  createdAt?: any;
}

export default function LobbyPage() {
  const navigate = useNavigate();
  const { user, signOutPlayer } = usePlayerAuth();

  const [roomCode, setRoomCode] = useState('');
  const [rooms, setRooms] = useState<LobbyRoom[]>([]);

  const canUseDb = useMemo(() => Boolean(db && user?.uid), [user?.uid]);

  useEffect(() => {
    if (!db || !canUseDb) return;

    const q = query(collection(db, 'rooms'), orderBy('createdAt', 'desc'), limit(12));
    const unsub = onSnapshot(q, (snap) => {
      setRooms(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    });

    return () => unsub();
  }, [canUseDb]);

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
        <p className="muted-copy">Recent rooms</p>
        <ul className="history-grid" style={{ marginTop: 12 }}>
          {rooms.map((r) => (
            <li key={r.id} className="history-card">
              <div className="analysis-topline history-card-topline">
                <span className="analysis-label">room</span>
                <span className={`analysis-pill decision-${r.status === 'waiting' ? 'partial' : 'match'}`}>{r.status}</span>
              </div>
              <div style={{ marginTop: 10 }}>
                <div className="metric-label">id</div>
                <div className="metric-value" style={{ wordBreak: 'break-all' }}>{r.id}</div>
              </div>
              <div className="action-row" style={{ marginTop: 12 }}>
                <button type="button" className="ghost-pill-button" onClick={() => navigate(`/room/${r.id}`)}>
                  Open
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
