const { onRequest } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Deepgram-Api-Key, X-Deepgram-Model, x-deepgram-api-key, x-deepgram-model',
  'Access-Control-Max-Age': '3600',
};

function applyCors(res) {
  Object.entries(corsHeaders).forEach(([key, value]) => res.set(key, value));
}

function handleOptions(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return true;
  }
  return false;
}

const defaultSharedConfig = {
  captainDeepgramModel: 'nova-3',
  crewDeepgramModel: 'nova-3',
  router9BaseUrl: 'https://rqlaeq5.9router.com/v1',
  router9Model: '',
  router9FallbackModel: '',
  meaningStrictness: 'medium',
  meaningWeight: 100,
  systemInstruction: '',
};

async function getSharedAdminConfig() {
  try {
    const snap = await admin.firestore().doc('admin_runtime_config/shared').get();
    if (!snap.exists) return defaultSharedConfig;
    return { ...defaultSharedConfig, ...(snap.data() || {}) };
  } catch (error) {
    logger.warn('Could not load shared admin config from Firestore', error);
    return defaultSharedConfig;
  }
}

async function callDeepgramListen({ apiKey, model, language, contentType, audioBuffer }) {
  const deepgramUrl = `https://api.deepgram.com/v1/listen?model=${encodeURIComponent(model)}&smart_format=true&punctuate=true&utterances=true&language=${encodeURIComponent(language)}`;
  const response = await fetch(deepgramUrl, {
    method: 'POST',
    headers: {
      Authorization: `Token ${apiKey}`,
      'Content-Type': contentType,
    },
    body: audioBuffer,
  });

  if (!response.ok) {
    throw new Error(`Deepgram error (${response.status}): ${await response.text()}`);
  }

  return await response.json();
}

function normalizeDeepgramResult(result, meta = {}) {
  const alternative = result?.results?.channels?.[0]?.alternatives?.[0] || {};
  return {
    transcript: alternative.transcript || '',
    confidence: alternative.confidence || 0,
    duration: result?.metadata?.duration || 0,
    requestId: result?.metadata?.request_id || '',
    ...meta,
  };
}

exports.transcribeRoundAudio = onRequest({ cors: false, invoker: 'public' }, async (req, res) => {
  try {
    if (handleOptions(req, res)) return;
    applyCors(res);

    const sharedConfig = await getSharedAdminConfig();
    const role = String(req.query.role || 'captain');
    const language = String(req.query.language || (role === 'captain' ? 'vi' : 'en'));
    const selectedModel = String(req.headers['x-deepgram-model'] || (role === 'captain' ? sharedConfig.captainDeepgramModel : sharedConfig.crewDeepgramModel) || 'nova-3');
    const apiKey = req.headers['x-deepgram-api-key'] || process.env.DEEPGRAM_API_KEY || sharedConfig.deepgramApiKey;
    if (!apiKey) throw new Error('DEEPGRAM_API_KEY not configured');

    const raw = await callDeepgramListen({
      apiKey,
      model: selectedModel,
      language,
      contentType: String(req.headers['content-type'] || 'audio/webm'),
      audioBuffer: req.rawBody,
    });

    const normalized = normalizeDeepgramResult(raw, { modelUsed: selectedModel, fallbackUsed: false });
    res.json({
      transcript: normalized.transcript,
      confidence: normalized.confidence,
      duration: normalized.duration,
      modelRequested: selectedModel,
      modelUsed: normalized.modelUsed,
      fallbackUsed: normalized.fallbackUsed,
      requestId: normalized.requestId,
    });
  } catch (error) {
    logger.error(error);
    applyCors(res);
    res.status(500).json({ error: error.message || 'Transcription failed' });
  }
});

async function callRouterChat({ apiKey, baseUrl, model, fallbackModel, messages }) {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model || fallbackModel,
      temperature: 0.2,
      stream: false,
      response_format: { type: 'json_object' },
      messages,
    }),
  });

  if (!response.ok) {
    throw new Error(`Router9 error (${response.status}): ${await response.text()}`);
  }

  return await response.json();
}

exports.fetchRouterModels = onRequest({ cors: false, invoker: 'public' }, async (req, res) => {
  try {
    if (handleOptions(req, res)) return;
    applyCors(res);
    const sharedConfig = await getSharedAdminConfig();
    const apiKey = req.body.routerApiKey || process.env.ROUTER9_API_KEY || sharedConfig.router9ApiKey;
    const baseUrl = req.body.routerBaseUrl || process.env.ROUTER9_BASE_URL || sharedConfig.router9BaseUrl;
    if (!apiKey) throw new Error('ROUTER9_API_KEY not configured');

    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!response.ok) throw new Error(`Router9 models error (${response.status}): ${await response.text()}`);
    const result = await response.json();
    res.json({ models: Array.isArray(result?.data) ? result.data : [] });
  } catch (error) {
    logger.error(error);
    applyCors(res);
    res.status(500).json({ error: error.message || 'Failed to fetch models' });
  }
});

exports.testRouterCompletion = onRequest({ cors: false, invoker: 'public' }, async (req, res) => {
  try {
    if (handleOptions(req, res)) return;
    applyCors(res);
    const sharedConfig = await getSharedAdminConfig();
    const apiKey = req.body.routerApiKey || process.env.ROUTER9_API_KEY || sharedConfig.router9ApiKey;
    const baseUrl = req.body.routerBaseUrl || process.env.ROUTER9_BASE_URL || sharedConfig.router9BaseUrl;
    const model = req.body.model || process.env.ROUTER9_MODEL || sharedConfig.router9Model;
    const fallbackModel = req.body.fallbackModel || process.env.ROUTER9_FALLBACK_MODEL || sharedConfig.router9FallbackModel;
    const completion = await callRouterChat({
      apiKey,
      baseUrl,
      model,
      fallbackModel,
      messages: [
        { role: 'system', content: 'Reply with a single short sentence.' },
        { role: 'user', content: 'Say: Router9 connection OK' },
      ],
    });
    res.json({ ok: true, content: completion?.choices?.[0]?.message?.content || '' });
  } catch (error) {
    logger.error(error);
    applyCors(res);
    res.status(500).json({ error: error.message || 'Router9 completion test failed' });
  }
});

exports.evaluateCaptionCrewMeaning = onRequest({ cors: false, invoker: 'public' }, async (req, res) => {
  try {
    if (handleOptions(req, res)) return;
    applyCors(res);
    const sharedConfig = await getSharedAdminConfig();
    const apiKey = req.body.routerApiKey || process.env.ROUTER9_API_KEY || sharedConfig.router9ApiKey;
    const baseUrl = req.body.routerBaseUrl || process.env.ROUTER9_BASE_URL || sharedConfig.router9BaseUrl;
    const model = req.body.model || process.env.ROUTER9_MODEL || sharedConfig.router9Model;
    const fallbackModel = req.body.fallbackModel || process.env.ROUTER9_FALLBACK_MODEL || sharedConfig.router9FallbackModel;

    const captainTranscript = String(req.body.captainTranscript || '').trim();
    const crewTranscript = String(req.body.crewTranscript || '').trim();
    const strictness = String(req.body.strictness || sharedConfig.meaningStrictness || 'medium');
    const meaningWeight = typeof req.body.meaningWeight === 'number' ? req.body.meaningWeight : sharedConfig.meaningWeight || 100;
    const systemInstruction = String(req.body.systemInstruction || sharedConfig.systemInstruction || '');

    const prompt = `${systemInstruction ? `${systemInstruction}\n\n` : ''}You are evaluating whether an English response preserves the meaning of an original Vietnamese sentence. Return strict JSON only with keys: matchScore, decision, reason, missingConcepts, extraConcepts.\n\nStrictness: ${strictness}\nMeaning weight hint: ${meaningWeight}\nCaptain original Vietnamese: ${captainTranscript}\nCrew English response: ${crewTranscript}`;

    const completion = await callRouterChat({
      apiKey,
      baseUrl,
      model,
      fallbackModel,
      messages: [
        { role: 'system', content: 'Be concise. Return only valid JSON with the requested keys.' },
        { role: 'user', content: prompt },
      ],
    });

    const raw = completion?.choices?.[0]?.message?.content;
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const semanticScore = Math.max(0, Math.min(100, Number(parsed?.matchScore) || 0));

    res.json({
      matchScore: semanticScore,
      decision: parsed?.decision || (semanticScore >= 80 ? 'match' : semanticScore >= 50 ? 'partial' : 'mismatch'),
      reason: parsed?.reason || 'Meaning evaluation completed.',
      missingConcepts: Array.isArray(parsed?.missingConcepts) ? parsed.missingConcepts : [],
      extraConcepts: Array.isArray(parsed?.extraConcepts) ? parsed.extraConcepts : [],
    });
  } catch (error) {
    logger.error(error);
    applyCors(res);
    res.status(500).json({ error: error.message || 'Meaning evaluation failed' });
  }
});
