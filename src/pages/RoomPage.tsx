import { useMemo } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { RequirePlayer, usePlayerAuth } from '@/auth/PlayerAuth';
import { RolePanel } from '@/components/RolePanel';
import { ResultCard } from '@/components/ResultCard';
import { db } from '@/lib/firebase';
import { useRoom } from '@/rooms/useRoom';
import { useRoomGame } from '@/rooms/useRoomGame';

export default function RoomPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = usePlayerAuth();

  if (!roomId) return <Navigate to="/" replace />;

  return (
    <RequirePlayer>
      <RoomInner roomId={roomId} userId={user?.uid || ''} onLeave={() => navigate('/')} />
    </RequirePlayer>
  );
}

function RoomInner({ roomId, userId, onLeave }: { roomId: string; userId: string; onLeave: () => void }) {
  const { room, rounds, loading } = useRoom(roomId);
  const game = useRoomGame({ roomId, room, rounds });

  const currentRound = game.currentRound;
  const evaluation = currentRound?.meaningAnalysis || null;

  const canJoinAsCaptain = useMemo(() => !!room && !room.captainId && room.crewId !== userId, [room, userId]);
  const canJoinAsCrew = useMemo(() => !!room && !room.crewId && room.captainId !== userId, [room, userId]);

  const copyInvite = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}/room/${roomId}`);
  };

  const startNewRound = async () => {
    await game.startRound();
  };

  const finishRoom = async () => {
    if (!db || !room) return;
    await updateDoc(doc(db, 'rooms', roomId), { status: 'finished', updatedAt: serverTimestamp() });
  };

  if (loading) {
    return (
      <main className="screen-shell">
        <section className="soft-card admin-section-minimal">
          <p className="muted-copy">Loading room…</p>
        </section>
      </main>
    );
  }

  if (!room) {
    return (
      <main className="screen-shell">
        <section className="soft-card admin-section-minimal">
          <p className="game-error">Room not found.</p>
          <div className="action-row">
            <button type="button" className="ghost-pill-button" onClick={onLeave}>Back</button>
          </div>
        </section>
      </main>
    );
  }

  const showRolePick = !room.captainId || !room.crewId;

  return (
    <main className="game-screen">
      <div className="game-header brand-header">
        <div className="chunks-brand-block">
          <img src="/chunks-logo.png" alt="Chunks" className="chunks-logo" />
          <div>
            <p className="game-kicker">Room</p>
            <h1 className="game-title">{roomId.slice(0, 6)}</h1>
          </div>
        </div>
        <div className="action-row">
          <button type="button" className="ghost-pill-button" onClick={() => void copyInvite()}>Copy invite</button>
          <button type="button" className="ghost-pill-button" onClick={onLeave}>Leave</button>
        </div>
      </div>

      {showRolePick ? (
        <section className="soft-card admin-section-minimal">
          <p className="muted-copy">Choose your role</p>
          <div className="action-row" style={{ marginTop: 12 }}>
            <button type="button" className="primary-pill-button" disabled={!canJoinAsCaptain} onClick={() => void game.joinRole('captain')}>Captain</button>
            <button type="button" className="primary-pill-button" disabled={!canJoinAsCrew} onClick={() => void game.joinRole('crew')}>Crew</button>
          </div>
          <p className="muted-copy" style={{ marginTop: 12 }}>Waiting for both players…</p>
        </section>
      ) : (
        <>
          {!currentRound || currentRound.status === 'finished' ? (
            <section className="soft-card admin-section-minimal">
              {evaluation && (
                <ResultCard evaluation={evaluation} reactionDelayMs={currentRound?.reactionDelayMs || null} onReset={() => void startNewRound()} />
              )}
              <div className="action-row" style={{ marginTop: 12 }}>
                {game.isCaptain ? (
                  <button type="button" className="primary-pill-button" onClick={() => void startNewRound()} disabled={!game.canStartRound}>
                    Start new round
                  </button>
                ) : (
                  <p className="muted-copy">Waiting for Captain to start…</p>
                )}
                <button type="button" className="ghost-pill-button" onClick={() => void finishRoom()}>Finish room</button>
              </div>
            </section>
          ) : (
            <section className="playfield-shell">
              <RolePanel
                role="captain"
                title="Captain"
                color="blue"
                recording={game.captainRecorder.isRecording}
                active={currentRound.status === 'captain_speaking'}
                disabled={!game.canStartCaptain}
                processing={game.processing && game.isCaptain}
                helperText={currentRound.status === 'captain_speaking' ? 'Speak Vietnamese' : 'Wait'}
                levels={game.captainRecorder.levels}
                onStart={() => void game.startCaptain()}
                onStop={() => void game.stopCaptain()}
              />

              <RolePanel
                role="crew"
                title="Crew"
                color="red"
                recording={game.crewRecorder.isRecording}
                active={currentRound.status === 'crew_speaking' || currentRound.status === 'evaluating'}
                disabled={!game.canStartCrew}
                processing={game.processing && game.isCrew}
                helperText={currentRound.status === 'crew_speaking' ? 'Reply in English' : 'Wait'}
                levels={game.crewRecorder.levels}
                onStart={() => void game.startCrew()}
                onStop={() => void game.stopCrew()}
              />
            </section>
          )}
        </>
      )}

      {currentRound?.status === 'evaluating' && (
        <div className="analysis-overlay" role="status" aria-live="polite">
          <div className="spiral-loader" aria-hidden="true">
            <span className="spiral-ring spiral-ring-blue" />
            <span className="spiral-ring spiral-ring-red" />
            <span className="spiral-core" />
          </div>
          <p className="analysis-overlay-title">analyzing meaning</p>
          <p className="analysis-overlay-subtitle">transcribing and comparing meaning</p>
        </div>
      )}
    </main>
  );
}
