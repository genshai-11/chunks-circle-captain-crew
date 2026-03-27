import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '@/auth/AdminAuthContext';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const { signIn, signUp, sendReset, loading } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (mode === 'signin') {
        await signIn(email, password);
      } else {
        await signUp(email, password);
      }
      navigate('/admin', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Admin authentication failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (!email.trim()) {
        throw new Error('Enter your admin email first.');
      }
      await sendReset(email);
      setNotice('Password reset email sent. Check your inbox and spam folder.');
    } catch (err: any) {
      setError(err.message || 'Could not send reset email.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="screen-shell admin-shell">
      <header className="page-header">
        <div>
          <p className="page-kicker">Admin access</p>
          <h1 className="page-title">Sign in</h1>
        </div>
      </header>

      <section className="soft-card admin-section-minimal auth-card">
        <p className="muted-copy">Admin navigation is only visible after a valid admin login.</p>

        <div className="action-row">
          <button type="button" className={mode === 'signin' ? 'primary-pill-button' : 'ghost-pill-button'} onClick={() => setMode('signin')} disabled={busy || loading}>
            Sign in
          </button>
          <button type="button" className={mode === 'signup' ? 'primary-pill-button' : 'ghost-pill-button'} onClick={() => setMode('signup')} disabled={busy || loading}>
            Create admin account
          </button>
        </div>

        <form className="auth-form" onSubmit={submit}>
          <label className="field-stack">
            <span>Email</span>
            <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="field-stack">
            <span>Password</span>
            <input type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          </label>
          {error && <p className="game-error auth-error">{error}</p>}
          {notice && <p className="auth-notice">{notice}</p>}
          <button className="primary-pill-button" type="submit" disabled={busy || loading}>
            {busy ? 'Please wait…' : mode === 'signin' ? 'Continue to admin' : 'Create and continue'}
          </button>
        </form>

        <div className="action-row auth-secondary-actions">
          <button type="button" className="ghost-pill-button" onClick={() => void handleReset()} disabled={busy || loading}>
            Send reset email
          </button>
        </div>
      </section>
    </main>
  );
}
