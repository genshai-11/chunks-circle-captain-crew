import { ReactNode, useEffect, useState } from 'react';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';

const provider = new GoogleAuthProvider();

export function usePlayerAuth() {
  const [user, setUser] = useState<User | null>(auth?.currentUser || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    return onAuthStateChanged(auth, (next) => {
      setUser(next);
      setLoading(false);
    });
  }, []);

  const signInGoogle = async () => {
    if (!auth) throw new Error('Firebase Auth is not configured');
    await signInWithPopup(auth, provider);
  };

  const signOutPlayer = async () => {
    if (!auth) return;
    await signOut(auth);
  };

  return { user, loading, signInGoogle, signOutPlayer };
}

export function RequirePlayer({ children }: { children: ReactNode }) {
  const { user, loading, signInGoogle } = usePlayerAuth();

  if (loading) {
    return (
      <main className="screen-shell">
        <section className="soft-card admin-section-minimal">
          <p className="muted-copy">Loading…</p>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="screen-shell">
        <section className="soft-card admin-section-minimal auth-card">
          <p className="page-kicker">Captain & Crew</p>
          <h1 className="page-title">Sign in</h1>
          <p className="muted-copy">Sign in with Google to create/join a room.</p>
          <div className="action-row">
            <button type="button" className="primary-pill-button" onClick={() => void signInGoogle()}>
              Sign in with Google
            </button>
          </div>
        </section>
      </main>
    );
  }

  return <>{children}</>;
}
