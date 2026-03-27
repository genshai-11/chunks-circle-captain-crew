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
  feedbackEnabled: true,
  feedbackMode: 'gentle',
  feedbackTone: 'encouraging',
  showGrammarReminder: false,
  showImprovedSentence: false,
  showWhenMeaningCorrect: false,
  onlyIfAffectsClarity: true,
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

async function callDeepgramListen({ apiKey, model, language, contentType, audioBuffer, detectLanguage = false }) {
  const deepgramUrl = `https://api.deepgram.com/v1/listen?model=${encodeURIComponent(model)}&smart_format=true&punctuate=true&utterances=true&detect_language=${detectLanguage ? 'true' : 'false'}${language ? `&language=${encodeURIComponent(language)}` : ''}`;
  const response = await fetch(deepgramUrl, {
    method: 'POST',
    headers: {
      Authorization: `Token ${apiKey}`,
      'Content-Type': contentType,
    },
    body: audioBuffer,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Deepgram error (${response.status}): ${text}`);
  }

  return await response.json();
}

function normalizeDeepgramResult(result, meta = {}) {
  const alternative = result?.results?.channels?.[0]?.alternatives?.[0] || {};
  return {
    transcript: alternative.transcript || '',
    words: alternative.words || [],
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
    const selectedModel = String(
      req.headers['x-deepgram-model'] ||
      (role === 'captain' ? sharedConfig.captainDeepgramModel : sharedConfig.crewDeepgramModel) ||
      'nova-3'
    );
    const apiKey = req.headers['x-deepgram-api-key'] || process.env.DEEPGRAM_API_KEY || sharedConfig.deepgramApiKey;
    if (!apiKey) throw new Error('DEEPGRAM_API_KEY not configured');

    const contentType = String(req.headers['content-type'] || 'audio/webm');
    const audioBuffer = req.rawBody;
    const audioBytes = audioBuffer?.length || audioBuffer?.byteLength || 0;

    logger.info('STT request received', { role, language, selectedModel, contentType, audioBytes });

    if (!audioBuffer || !audioBytes) {
      throw new Error('No audio payload received');
    }

    const primaryRaw = await callDeepgramListen({
      apiKey,
      model: selectedModel,
      language,
      contentType,
      audioBuffer,
      detectLanguage: false,
    });

    let normalized = normalizeDeepgramResult(primaryRaw, { modelUsed: selectedModel, fallbackUsed: false });
    logger.info('STT primary result', {
      role,
      language,
      selectedModel,
      transcriptLength: normalized.transcript.length,
      confidence: normalized.confidence,
      duration: normalized.duration,
      words: normalized.words.length,
      requestId: normalized.requestId,
    });

    const shouldFallback = !normalized.transcript.trim() && selectedModel !== 'nova-2';
    if (shouldFallback) {
      logger.warn('STT empty transcript, retrying fallback model', { role, language, selectedModel, contentType, audioBytes });
      const fallbackRaw = await callDeepgramListen({
        apiKey,
        model: 'nova-2',
        language,
        contentType,
        audioBuffer,
        detectLanguage: false,
      });
      const fallbackNormalized = normalizeDeepgramResult(fallbackRaw, { modelUsed: 'nova-2', fallbackUsed: true });
      logger.info('STT fallback result', {
        role,
        language,
        transcriptLength: fallbackNormalized.transcript.length,
        confidence: fallbackNormalized.confidence,
        duration: fallbackNormalized.duration,
        words: fallbackNormalized.words.length,
        requestId: fallbackNormalized.requestId,
      });

      if (fallbackNormalized.transcript.trim()) {
        normalized = fallbackNormalized;
      }
    }

    res.json({
      transcript: normalized.transcript,
      words: normalized.words,
      confidence: normalized.confidence,
      duration: normalized.duration,
      modelRequested: selectedModel,
      modelUsed: normalized.modelUsed,
      fallbackUsed: normalized.fallbackUsed,
      roleReceived: role,
      languageReceived: language,
      contentTypeReceived: contentType,
      requestId: normalized.requestId,
    });
  } catch (error) {
    logger.error(error);
    applyCors(res);
    res.status(500).json({ error: error.message || 'Transcription failed' });
  }
});

async function callRouterChat({ apiKey, baseUrl, model, fallbackModel, messages, temperature = 0.2, responseFormat }) {
  if (!apiKey) throw new Error('ROUTER9_API_KEY not configured');
  if (!model && !fallbackModel) throw new Error('No Router9 model configured');

  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model || fallbackModel,
      temperature,
      stream: false,
      ...(responseFormat ? { response_format: responseFormat } : {}),
      messages,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Router9 error (${response.status}): ${text}`);
  }

  return await response.json();
}

exports.fetchRouterModels = onRequest({ cors: false, invoker: 'public' }, async (req, res) => {
  try {
    if (handleOptions(req, res)) return;
    applyCors(res);

    const sharedConfig = await getSharedAdminConfig();
    const apiKey = req.body.routerApiKey || process.env.ROUTER9_API_KEY || sharedConfig.router9ApiKey;
    const baseUrl = req.body.routerBaseUrl || process.env.ROUTER9_BASE_URL || sharedConfig.router9BaseUrl || 'https://rqlaeq5.9router.com/v1';
    if (!apiKey) throw new Error('ROUTER9_API_KEY not configured');

    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/models`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Router9 models error (${response.status}): ${text}`);
    }

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
    const baseUrl = req.body.routerBaseUrl || process.env.ROUTER9_BASE_URL || sharedConfig.router9BaseUrl || 'https://rqlaeq5.9router.com/v1';
    const model = req.body.model || process.env.ROUTER9_MODEL || sharedConfig.router9Model;
    const fallbackModel = req.body.fallbackModel || process.env.ROUTER9_FALLBACK_MODEL || sharedConfig.router9FallbackModel;

    const completion = await callRouterChat({
      apiKey,
      baseUrl,
      model,
      fallbackModel,
      temperature: 0,
      messages: [
        { role: 'system', content: 'Reply with a single short sentence.' },
        { role: 'user', content: 'Say: Router9 connection OK' },
      ],
    });

    const content = completion?.choices?.[0]?.message?.content || '';
    res.json({ ok: true, content, model: model || fallbackModel || '' });
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
    const baseUrl = req.body.routerBaseUrl || process.env.ROUTER9_BASE_URL || sharedConfig.router9BaseUrl || 'https://rqlaeq5.9router.com/v1';
    const model = req.body.model || process.env.ROUTER9_MODEL || sharedConfig.router9Model;
    const fallbackModel = req.body.fallbackModel || process.env.ROUTER9_FALLBACK_MODEL || sharedConfig.router9FallbackModel;

    if (!apiKey) throw new Error('ROUTER9_API_KEY not configured');
    if (!model && !fallbackModel) throw new Error('No Router9 model configured');

    const captainTranscript = String(req.body.captainTranscript || '').trim();
    const crewTranscript = String(req.body.crewTranscript || '').trim();
    const strictness = String(req.body.strictness || sharedConfig.meaningStrictness || 'medium');
    const meaningWeight = typeof req.body.meaningWeight === 'number' ? req.body.meaningWeight : sharedConfig.meaningWeight || 100;
    const feedbackConfig = req.body.feedbackConfig && typeof req.body.feedbackConfig === 'object'
      ? req.body.feedbackConfig
      : {
          enabled: sharedConfig.feedbackEnabled,
          feedbackMode: sharedConfig.feedbackMode,
          tone: sharedConfig.feedbackTone,
          showGrammarReminder: sharedConfig.showGrammarReminder,
          showImprovedSentence: sharedConfig.showImprovedSentence,
          showWhenMeaningCorrect: sharedConfig.showWhenMeaningCorrect,
          onlyIfAffectsClarity: sharedConfig.onlyIfAffectsClarity,
        };

    const feedbackEnabled = feedbackConfig.enabled !== false;
    const feedbackMode = String(feedbackConfig.feedbackMode || 'gentle');
    const feedbackTone = String(feedbackConfig.tone || 'encouraging');
    const showGrammarReminder = feedbackConfig.showGrammarReminder !== false;
    const showImprovedSentence = feedbackConfig.showImprovedSentence !== false;
    const showWhenMeaningCorrect = feedbackConfig.showWhenMeaningCorrect !== false;
    const onlyIfAffectsClarity = feedbackConfig.onlyIfAffectsClarity === true;

    const prompt = `You are evaluating whether an English response preserves the meaning of an original Vietnamese sentence.\n\nScore ONLY by meaning and intent, not by literal word overlap. Natural paraphrases that preserve the same meaning should receive 95-100. Minor grammar mistakes must NOT reduce score unless they change meaning or clarity significantly.\n\nReturn strict JSON only with keys: matchScore, decision, reason, missingConcepts, extraConcepts, grammarNote, improvedTranscript, grammarSeverity, feedbackType.\n- matchScore: integer 0-100 based only on meaning equivalence\n- decision: one of match, partial, mismatch\n- reason: concise explanation focused on meaning\n- missingConcepts: string[] for important missing meaning elements only\n- extraConcepts: string[] for important added meaning only\n- grammarNote: short gentle note, or empty string if no reminder should be shown\n- improvedTranscript: smoother or more natural version, or empty string if not needed\n- grammarSeverity: one of none, minor, medium, major\n- feedbackType: one of off, gentle, balanced, detailed\n\nFeedback policy:\n- Feedback enabled: ${feedbackEnabled}\n- Feedback mode: ${feedbackMode}\n- Tone: ${feedbackTone}\n- Show grammar reminder: ${showGrammarReminder}\n- Show improved sentence: ${showImprovedSentence}\n- Show feedback when meaning is correct: ${showWhenMeaningCorrect}\n- Only show feedback if clarity is affected: ${onlyIfAffectsClarity}\n\nIf feedback is disabled, return empty grammarNote and improvedTranscript, grammarSeverity=none, feedbackType=off.\nIf meaning is correct and feedback is allowed, keep the wording gentle and encouraging.\nIf onlyIfAffectsClarity is true, hide minor grammar reminders that do not affect understanding.\n\nStrictness: ${strictness}\nMeaning weight hint: ${meaningWeight}\nCaptain original Vietnamese: ${captainTranscript}\nCrew English response: ${crewTranscript}`;

    const completion = await callRouterChat({
      apiKey,
      baseUrl,
      model,
      fallbackModel,
      temperature: 0.2,
      responseFormat: { type: 'json_object' },
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
      grammarNote: typeof parsed?.grammarNote === 'string' ? parsed.grammarNote : '',
      improvedTranscript: typeof parsed?.improvedTranscript === 'string' ? parsed.improvedTranscript : '',
      grammarSeverity: ['none', 'minor', 'medium', 'major'].includes(parsed?.grammarSeverity) ? parsed.grammarSeverity : 'none',
      feedbackType: ['off', 'gentle', 'balanced', 'detailed'].includes(parsed?.feedbackType) ? parsed.feedbackType : (feedbackEnabled ? feedbackMode : 'off'),
    });
  } catch (error) {
    logger.error(error);
    applyCors(res);
    res.status(500).json({ error: error.message || 'Meaning evaluation failed' });
  }
});
