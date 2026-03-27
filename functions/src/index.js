/* eslint-disable no-console */

const { onRequest } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Deepgram-Api-Key, X-Deepgram-Model, x-deepgram-api-key, x-deepgram-model',
  'Access-Control-Max-Age': '3600',
};

function applyCors(res) {
  for (const [k, v] of Object.entries(corsHeaders)) res.set(k, v);
}

function handleOptions(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return true;
  }
  return false;
}

function json(res, status, data) {
  applyCors(res);
  res.status(status).json(data);
}

/**
 * POST /transcribeRoundAudio?role=captain|crew&language=vi|en
 * Body: raw audio bytes
 * Optional headers:
 *  - x-deepgram-model
 *  - x-deepgram-api-key (temporary fallback)
 */
exports.transcribeRoundAudio = onRequest(
  {
    region: 'us-west1',
    cors: false,
    invoker: 'public',
    timeoutSeconds: 300,
    memory: '1GiB',
    secrets: ['DEEPGRAM_API_KEY'],
  },
  async (req, res) => {
    try {
      if (handleOptions(req, res)) return;
      if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

      const role = String(req.query.role || 'captain');
      const language = String(req.query.language || (role === 'captain' ? 'vi' : 'en'));
      const model = String(req.headers['x-deepgram-model'] || 'nova-3');

      const apiKey = String(process.env.DEEPGRAM_API_KEY || req.headers['x-deepgram-api-key'] || '');
      if (!apiKey) {
        return json(res, 400, {
          error: 'DEEPGRAM_API_KEY not configured. Set it as a Functions secret/env. Temporary fallback: pass x-deepgram-api-key header.'
        });
      }

      const audioBuffer = req.rawBody;
      if (!audioBuffer || !audioBuffer.length) return json(res, 400, { error: 'Missing audio body' });

      const contentType = String(req.headers['content-type'] || 'audio/webm;codecs=opus');
      const deepgramUrl = `https://api.deepgram.com/v1/listen?model=${encodeURIComponent(model)}&smart_format=true&punctuate=true&language=${encodeURIComponent(language)}`;

      const response = await fetch(deepgramUrl, {
        method: 'POST',
        headers: {
          Authorization: `Token ${apiKey}`,
          'Content-Type': contentType,
        },
        body: audioBuffer,
      });

      if (!response.ok) {
        const t = await response.text();
        return json(res, 502, { error: `Deepgram error (${response.status}): ${t}` });
      }

      const data = await response.json();
      const alt = data?.results?.channels?.[0]?.alternatives?.[0] || {};

      return json(res, 200, {
        transcript: String(alt.transcript || ''),
        confidence: Number(alt.confidence || 0),
        duration: Number(data?.metadata?.duration || 0),
        modelRequested: model,
        modelUsed: model,
        fallbackUsed: false,
        requestId: String(data?.metadata?.request_id || ''),
      });
    } catch (err) {
      logger.error(err);
      return json(res, 500, { error: err?.message || String(err) });
    }
  }
);

/**
 * POST /evaluateCaptionCrewMeaning
 * Body: { captainTranscript, crewTranscript, model?, temperature?, systemInstruction?, apiUrl?, apiKey? }
 * - If apiUrl+apiKey are provided => uses OpenAI-compatible endpoint
 * - Else uses GEMINI_API_KEY (Functions secret/env)
 */
exports.evaluateCaptionCrewMeaning = onRequest(
  {
    region: 'us-west1',
    cors: false,
    invoker: 'public',
    timeoutSeconds: 300,
    memory: '1GiB',
    secrets: ['GEMINI_API_KEY'],
  },
  async (req, res) => {
    try {
      if (handleOptions(req, res)) return;
      if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

      const body = typeof req.body === 'object' && req.body ? req.body : {};
      const captainTranscript = String(body.captainTranscript || '').trim();
      const crewTranscript = String(body.crewTranscript || '').trim();
      if (!captainTranscript || !crewTranscript) {
        return json(res, 400, { error: 'Missing captainTranscript or crewTranscript' });
      }

      const model = String(body.model || 'gemini-3.1-pro-preview');
      const temperature = Number(body.temperature ?? 0.7);
      const systemInstruction = body.systemInstruction ? String(body.systemInstruction) : '';

      const apiUrl = body.apiUrl ? String(body.apiUrl) : '';
      const apiKey = body.apiKey ? String(body.apiKey) : '';

      // OpenAI-compatible endpoint path
      if (apiUrl && apiKey) {
        const baseUrl = apiUrl.replace(/\/$/, '');
        const resp = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            temperature,
            response_format: { type: 'json_object' },
            messages: [
              {
                role: 'system',
                content: systemInstruction || 'Return JSON {"score": number 0-100, "feedback": string}.'
              },
              {
                role: 'user',
                content: `Evaluate how well the Crew transferred meaning from Vietnamese to English.\n\nCaptain (vi): "${captainTranscript}"\nCrew (en): "${crewTranscript}"\n\nReturn JSON: {"score": number, "feedback": string}`
              }
            ]
          })
        });

        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) return json(res, 502, { error: data?.error?.message || resp.statusText || 'Custom API error' });

        const content = data?.choices?.[0]?.message?.content || '{}';
        let parsed;
        try { parsed = JSON.parse(content); } catch { parsed = { score: 0, feedback: String(content) }; }

        const score = Number(parsed.score || 0);
        return json(res, 200, {
          matchScore: score,
          decision: score >= 80 ? 'match' : score >= 50 ? 'partial' : 'mismatch',
          reason: String(parsed.feedback || 'Meaning evaluation completed.'),
          missingConcepts: [],
          extraConcepts: [],
        });
      }

      // Gemini REST path
      const geminiKey = String(process.env.GEMINI_API_KEY || '');
      if (!geminiKey) {
        return json(res, 400, { error: 'GEMINI_API_KEY not configured. Set it as a Functions secret/env or provide apiUrl+apiKey.' });
      }

      const prompt = `${systemInstruction ? `${systemInstruction}\n\n` : ''}Evaluate meaning transfer from Vietnamese to English. Return strict JSON with keys score (0-100) and feedback (1-2 sentences).\n\nCaptain (vi): "${captainTranscript}"\nCrew (en): "${crewTranscript}"`;

      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(geminiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature },
        })
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) return json(res, 502, { error: data?.error?.message || 'Gemini API error' });

      const textOut = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '{}';
      let parsed;
      try { parsed = JSON.parse(textOut); } catch { parsed = { score: 0, feedback: String(textOut) }; }

      const score = Number(parsed.score || 0);
      return json(res, 200, {
        matchScore: score,
        decision: score >= 80 ? 'match' : score >= 50 ? 'partial' : 'mismatch',
        reason: String(parsed.feedback || 'Meaning evaluation completed.'),
        missingConcepts: [],
        extraConcepts: [],
      });
    } catch (err) {
      logger.error(err);
      return json(res, 500, { error: err?.message || String(err) });
    }
  }
);
