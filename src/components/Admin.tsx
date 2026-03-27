import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ArrowLeft, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const Admin: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [model, setModel] = useState('gemini-3.1-pro-preview');
  const [temperature, setTemperature] = useState(0.7);
  const [systemInstruction, setSystemInstruction] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const [models, setModels] = useState<string[]>([
    'gemini-3.1-pro-preview',
    'gemini-3.1-flash-preview',
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-3.1-flash-lite-preview'
  ]);
  const [fetchingModels, setFetchingModels] = useState(false);

  const fetchAvailableModels = async () => {
    setFetchingModels(true);
    try {
      if (apiUrl && apiKey) {
        // Fetch from custom OpenAI-compatible endpoint
        const baseUrl = apiUrl.replace(/\/$/, '');
        const response = await fetch(`${baseUrl}/models`, {
          headers: {
            'Authorization': `Bearer ${apiKey}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          const modelNames = data.data.map((m: any) => m.id);
          if (modelNames.length > 0) {
            const uniqueModels = Array.from(new Set([...models, ...modelNames]));
            setModels(uniqueModels);
            setMessage('Custom models fetched successfully!');
          }
        } else {
          setMessage('Failed to fetch models from custom API.');
        }
      } else {
        // Fetch from Gemini API
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY}`);
        if (response.ok) {
          const data = await response.json();
          const modelNames = data.models
            .map((m: any) => m.name.replace('models/', ''))
            .filter((name: string) => name.includes('gemini'));
          
          if (modelNames.length > 0) {
            const uniqueModels = Array.from(new Set([...models, ...modelNames]));
            setModels(uniqueModels);
            setMessage('Gemini models fetched successfully!');
          }
        } else {
          setMessage('Failed to fetch models from Gemini API.');
        }
      }
    } catch (error) {
      console.error("Error fetching models:", error);
      setMessage('Error fetching models.');
    } finally {
      setFetchingModels(false);
    }
  };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'settings', 'llm');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.model) setModel(data.model);
          if (data.temperature !== undefined) setTemperature(data.temperature);
          if (data.systemInstruction) setSystemInstruction(data.systemInstruction);
          if (data.apiUrl) setApiUrl(data.apiUrl);
          if (data.apiKey) setApiKey(data.apiKey);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'settings/llm');
      } finally {
        setLoading(false);
      }
    };

    if (profile?.role === 'admin') {
      fetchSettings();
    } else {
      setLoading(false);
    }
  }, [profile]);

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      await setDoc(doc(db, 'settings', 'llm'), {
        model,
        temperature,
        systemInstruction,
        apiUrl,
        apiKey
      });
      setMessage('Settings saved successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/llm');
      setMessage('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-400">Loading...</div>;
  }

  if (profile?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-400 p-6">
        <h1 className="text-2xl font-bold text-red-500 mb-4">Access Denied</h1>
        <p className="mb-6">You do not have permission to view this page.</p>
        <button onClick={() => navigate('/')} className="text-zinc-100 underline">Return to Lobby</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-2xl mx-auto">
        <header className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate('/')} className="p-2 -ml-2 text-zinc-400 hover:text-zinc-100 transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-bold">Admin Settings</h1>
        </header>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-zinc-100">LLM Configuration</h2>
            <button
              onClick={fetchAvailableModels}
              disabled={fetchingModels}
              className="text-sm bg-zinc-800 text-zinc-300 py-1.5 px-3 rounded-lg hover:bg-zinc-700 transition-colors disabled:opacity-50"
            >
              {fetchingModels ? 'Fetching...' : 'Fetch Models'}
            </button>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Model</label>
              <select 
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-zinc-100 focus:outline-none focus:border-zinc-600"
              >
                {models.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">
                Temperature: {temperature}
              </label>
              <input 
                type="range" 
                min="0" 
                max="2" 
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full accent-zinc-100"
              />
              <p className="text-xs text-zinc-500 mt-1">Higher values make output more random, lower values make it more focused.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">System Instruction (Optional)</label>
              <textarea 
                value={systemInstruction}
                onChange={(e) => setSystemInstruction(e.target.value)}
                rows={4}
                placeholder="Override default instructions for meaning evaluation..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-zinc-100 focus:outline-none focus:border-zinc-600 resize-none"
              />
            </div>
            <div className="pt-4 border-t border-zinc-800">
              <h3 className="text-lg font-medium text-zinc-100 mb-4">Custom Provider (e.g., OpenRouter)</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">API Endpoint URL (Optional)</label>
                  <input 
                    type="text"
                    value={apiUrl}
                    onChange={(e) => setApiUrl(e.target.value)}
                    placeholder="e.g., https://openrouter.ai/api/v1"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-zinc-100 focus:outline-none focus:border-zinc-600"
                  />
                  <p className="text-xs text-zinc-500 mt-1">Leave empty to use default Gemini API.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">API Key (Optional)</label>
                  <input 
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter custom API key"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-zinc-100 focus:outline-none focus:border-zinc-600"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-between border-t border-zinc-800">
            <p className={`text-sm ${message.includes('Failed') ? 'text-red-400' : 'text-green-400'}`}>
              {message}
            </p>
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-zinc-100 text-zinc-950 font-medium py-2 px-6 rounded-xl flex items-center gap-2 hover:bg-zinc-200 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
