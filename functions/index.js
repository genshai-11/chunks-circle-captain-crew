/* eslint-disable no-console */

const cors = require('cors');
const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

// Init Admin SDK once
try {
  admin.initializeApp();
} catch (e) {
  // ignore if already initialized
}

const corsMw = cors({ origin: true });

function withCors(handler) {
  return (req, res) => corsMw(req, res, () => handler(req, res));
}

function json(res, status, data) {
  res.status(status).set('Content-Type', 'application/json').send(JSON.stringify(data));
}

// ------------------------
// POST /transcribe?role=captain|crew&language=vi|en
// Body: raw audio bytes (webm/opus etc.)
// Headers (optional):
// - x-deepgram-model
// - x-deepgram-api-key (fallback if env not set)
// ------------------------
exports.transcribe = onRequest(
  {
    region: 'us-west1',
    cors: false,
    timeoutSeconds: 300,
    memory: '1GiB'
  },
  withCors(async (req, res) => {
    try {
      if (req.method !== 'POST') {
        return json(res, 405, { error: 'Method not allowed' });
      }

      const language = String(req.query.language || 'vi');
      const model = String(req.get('x-deepgram-model') || (String(req.query.role || '') === 'captain' ? 'nova-3' : 'nova-3'));

      const apiKey = process.env.DEEPGRAM_API_KEY || req.get('x-deepgram-api-key') || '';
      if (!apiKey) {
        return json(res, 400, { error: 'Deepgram API key is not configured. Set DEEPGRAM_API_KEY secret/env or pass x-deepgram-api-key (temporary).' });
      }

      // Read raw body
      const chunks = [];
      let total = 0;
      await new Promise((resolve, reject) => {
        req.on('data', (c) => { chunks.push(c); total += c.length; });
        req.on('end', resolve);
        req.on('error', reject);
      });

      if (!total) {
        return json(res, 400, { error: 'Missing audio body' });
      }

      const body = Buffer.concat(chunks);
      const contentType = req.get('content-type') || 'audio/webm;codecs=opus';

      const url = `https://api.deepgram.com/v1/listen?model=${encodeURIComponent(model)}&language=${encodeURIComponent(language)}&smart_format=true&punctuate=true`;
      const dgRes = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${apiKey}`,
          'Content-Type': contentType
        },
        body
      });

      const text = await dgRes.text();
      if (!dgRes.ok) {
        return json(res, 502, { error: `Deepgram error: ${text}` });
      }

      const data = JSON.parse(text);
      const alt = data?.results?.channels?.[0]?.alternatives?.[0] || {};
      return json(res, 200, {
        transcript: String(alt.transcript || ''),
        confidence: Number(alt.confidence || 0),
        duration: Number(data?.metadata?.duration || 0),
        modelRequested: model,
        modelUsed: model,
        fallbackUsed: false,
        requestId: String(data?.metadata?.request_id || '')
      });
    } catch (e) {
      console.error(e);
      return json(res, 500, { error: e?.message || String(e) });
    }
  })
);

// ------------------------
// POST /evaluateMeaning
// Body: {
//   captainTranscript, crewTranscript,
//   model?, temperature?, systemInstruction?,
//   apiUrl?, apiKey? (optional OpenAI-compatible endpoint)
// }
// Uses GEMINI_API_KEY env if no custom apiUrl/apiKey.
// ------------------------
exports.evaluateMeaning = onRequest(
  {
    region: 'us-west1',
    cors: false,
    timeoutSeconds: 300,
    memory: '1GiB'
  },
  withCors(async (req, res) => {
    try {
      if (req.method !== 'POST') {
        return json(res, 405, { error: 'Method not allowed' });
      }

      const chunks = [];
      await new Promise((resolve, reject) => {
        req.on('data', (c) => chunks.push(c));
        req.on('end', resolve);
        req.on('error', reject);
      });

      const raw = Buffer.concat(chunks).toString('utf8') || '{}';
      const body = JSON.parse(raw);

      const captainTranscript = String(body.captainTranscript || '');
      const crewTranscript = String(body.crewTranscript || '');
      if (!captainTranscript || !crewTranscript) {
        return json(res, 400, { error: 'Missing captainTranscript or crewTranscript' });
      }

      const model = String(body.model || 'gemini-3.1-pro-preview');
      const temperature = Number(body.temperature ?? 0.7);
      const systemInstruction = body.systemInstruction ? String(body.systemInstruction) : undefined;

      const apiUrl = body.apiUrl ? String(body.apiUrl) : undefined;
      const apiKey = body.apiKey ? String(body.apiKey) : undefined;

      // If provided, call OpenAI-compatible endpoint
      if (apiUrl && apiKey) {
        const baseUrl = apiUrl.replace(/\/$/, '');
        const resp = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: 'system',
                content: systemInstruction || 'You are an evaluator of meaning transfer from Vietnamese to English. Focus on meaning preservation, not literal translation. Return JSON with score (0-100) and feedback (1-2 sentences).'
              },
              {
                role: 'user',
                content: `Evaluate how well the Crew transferred the meaning of the Captain's statement from Vietnamese to English.\n\nCaptain (Vietnamese): "${captainTranscript}"\nCrew (English): "${crewTranscript}"\n\nReturn JSON: {"score": number, "feedback": string}`
              }
            ],
            temperature,
            response_format: { type: 'json_object' }
          })
        });

        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          return json(res, 502, { error: data?.error?.message || resp.statusText || 'Custom API error' });
        }
        const content = data?.choices?.[0]?.message?.content || '{}';
        const parsed = JSON.parse(content);
        const score = Number(parsed.score || 0);
        return json(res, 200, {
          matchScore: score,
          decision: score >= 80 ? 'match' : score >= 50 ? 'partial' : 'mismatch',
          reason: String(parsed.feedback || 'Meaning evaluation completed.'),
          missingConcepts: [],
          extraConcepts: []
        });
      }

      // Gemini REST fallback
      const geminiKey = process.env.GEMINI_API_KEY || '';
      if (!geminiKey) {
        return json(res, 400, { error: 'GEMINI_API_KEY is not configured. Set GEMINI_API_KEY secret/env or pass apiUrl/apiKey.' });
      }

      const prompt = `Evaluate how well the Crew transferred the meaning of the Captain's statement from Vietnamese to English.\n\nCaptain (Vietnamese): "${captainTranscript}"\nCrew (English): "${crewTranscript}"\n\nFocus on meaning preservation, not literal translation. Return JSON with score (0-100) and feedback (1-2 sentences).`;

      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(geminiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature },
          systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined
        })
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        return json(res, 502, { error: data?.error?.message || 'Gemini API error' });
      }

      // Extract text then parse JSON
      co
