import { loadAdminRuntimeConfig } from '@/services/adminConfigRepository';

const FETCH_MODELS_URL = import.meta.env.DEV ? '/api/fetchRouterModels' : (import.meta.env.VITE_FETCH_MODELS_URL || '');
const TEST_ROUTER_URL = import.meta.env.DEV ? '/api/testRouterCompletion' : (import.meta.env.VITE_TEST_ROUTER_URL || '');

export interface RouterModelInfo {
  id: string;
  object?: string;
  owned_by?: string;
}

export async function fetchRouterModels() {
  const config = loadAdminRuntimeConfig();
  if (!FETCH_MODELS_URL) throw new Error('VITE_FETCH_MODELS_URL is not configured.');

  const response = await fetch(FETCH_MODELS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      routerApiKey: config.router9ApiKey,
      routerBaseUrl: config.router9BaseUrl,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Failed to fetch Router9 models');
  return Array.isArray(data.models) ? data.models as RouterModelInfo[] : [];
}

export async function testRouterCompletion() {
  const config = loadAdminRuntimeConfig();
  if (!TEST_ROUTER_URL) throw new Error('VITE_TEST_ROUTER_URL is not configured.');

  const response = await fetch(TEST_ROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      routerApiKey: config.router9ApiKey,
      routerBaseUrl: config.router9BaseUrl,
      model: config.router9Model,
      fallbackModel: config.router9FallbackModel,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Router9 test failed');
  return data;
}
