import { loadAdminRuntimeConfig } from '@/services/adminConfigRepository';
import { TranscriptResult } from '@/types';

const TRANSCRIBE_URL = import.meta.env.DEV ? '/api/transcribeRoundAudio' : (import.meta.env.VITE_TRANSCRIBE_URL || '');

export async function transcribeRoundAudio(audioBlob: Blob, options: { role: 'captain' | 'crew'; language: 'vi' | 'en' }) {
  if (!TRANSCRIBE_URL) {
    throw new Error('VITE_TRANSCRIBE_URL is not configured.');
  }

  const config = loadAdminRuntimeConfig();
  const selectedModel = options.role === 'captain' ? config.captainDeepgramModel : config.crewDeepgramModel;
  const mimeType = audioBlob.type || 'audio/webm;codecs=opus';
  const headers: Record<string, string> = {
    'Content-Type': mimeType,
  };

  if (selectedModel) {
    headers['x-deepgram-model'] = selectedModel;
  }

  const response = await fetch(`${TRANSCRIBE_URL}?role=${options.role}&language=${options.language}`, {
    method: 'POST',
    headers,
    body: audioBlob,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Transcription failed');
  }

  return {
    transcript: String(data.transcript || ''),
    confidence: Number(data.confidence || 0),
    duration: Number(data.duration || 0),
    modelRequested: typeof data.modelRequested === 'string' ? data.modelRequested : selectedModel,
    modelUsed: typeof data.modelUsed === 'string' ? data.modelUsed : selectedModel,
    fallbackUsed: data.fallbackUsed === true,
    requestId: typeof data.requestId === 'string' ? data.requestId : '',
    emptyTranscript: !String(data.transcript || '').trim(),
    roleReceived: typeof data.roleReceived === 'string' ? data.roleReceived : options.role,
    languageReceived: typeof data.languageReceived === 'string' ? data.languageReceived : options.language,
    contentTypeReceived: typeof data.contentTypeReceived === 'string' ? data.contentTypeReceived : mimeType,
  } as TranscriptResult;
}
