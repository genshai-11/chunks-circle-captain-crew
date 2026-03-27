import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdminAuth } from '@/auth/AdminAuthContext';
import { defaultGameSettings, loadSettings, saveSettings } from '@/services/roundRepository';
import { GameSettings } from '@/types';

export default function SettingsPage() {
  const { isAdmin } = useAdminAuth();
  const [settings, setSettings] = useState<GameSettings>(defaultGameSettings);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadSettings().then(setSettings).catch(() => undefined);
  }, []);

  const handleSave = async () => {
    await saveSettings(settings);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  };

  return (
    <main className="screen-shell admin-shell">
      <header className="page-header">
        <div>
          <p className="page-kicker">Settings</p>
          <h1 className="page-title">Timing</h1>
        </div>
      </header>

      <section className="soft-card admin-section-minimal">
        <label className="field-stack">
          <span>Max crew start delay (ms)</span>
          <input
            type="number"
            value={settings.maxCrewStartDelayMs}
            onChange={(e) => setSettings((prev) => ({ ...prev, maxCrewStartDelayMs: Number(e.target.value || 0) }))}
          />
        </label>

        <label className="field-stack">
          <span>Meaning strictness fallback</span>
          <select
            value={settings.strictness}
            onChange={(e) => setSettings((prev) => ({ ...prev, strictness: e.target.value as GameSettings['strictness'] }))}
          >
            <option value="loose">Loose</option>
            <option value="medium">Medium</option>
            <option value="strict">Strict</option>
          </select>
        </label>

        <label className="toggle-row">
          <input
            type="checkbox"
            checked={settings.showCountdown}
            onChange={(e) => setSettings((prev) => ({ ...prev, showCountdown: e.target.checked }))}
          />
          Show countdown during crew waiting phase
        </label>

        <div className="action-row">
          <button className="primary-pill-button" onClick={handleSave}>Save settings</button>
          {saved && <span className="save-pill">Saved</span>}
          {isAdmin ? (
            <span className="save-pill">Admin active</span>
          ) : (
            <Link to="/admin-login" className="ghost-pill-button admin-link-button">Admin sign in</Link>
          )}
        </div>
      </section>
    </main>
  );
}
