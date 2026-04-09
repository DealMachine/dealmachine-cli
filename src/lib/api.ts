/**
 * API client for DealMachine device auth flow
 */

import { readConfig, type ApiEnvironment } from './config.js';

const API_URLS: Record<ApiEnvironment, string> = {
  local: 'http://localhost:3001/v1',
  production: 'https://api.v2.dealmachine.com/v1',
} as const;

function getApiBaseUrl(): string {
  const apiUrlOverride = process.env.DM_API_URL || process.env.DEALMACHINE_API_URL;
  if (apiUrlOverride) {
    return apiUrlOverride;
  }

  const envVar = (process.env.DM_ENV || process.env.DEALMACHINE_ENVIRONMENT) as ApiEnvironment | undefined;
  if (envVar && API_URLS[envVar]) {
    return API_URLS[envVar];
  }

  const config = readConfig();
  if (config?.apiEnvironment && API_URLS[config.apiEnvironment]) {
    return API_URLS[config.apiEnvironment];
  }

  return API_URLS.local;
}

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
}

export interface DeviceTokenResponse {
  api_key: string;
  key_id: string;
  organization: {
    id: number;
    name: string;
    slug: string;
  };
}

export interface DeviceAuthError {
  error: {
    code: string;
    message: string;
  };
}

export type PollResult =
  | { status: 'success'; data: DeviceTokenResponse }
  | { status: 'pending' }
  | { status: 'slow_down' }
  | { status: 'denied'; message: string }
  | { status: 'expired'; message: string }
  | { status: 'error'; message: string };

export async function requestDeviceCode(
  clientId: string,
  deviceName?: string
): Promise<DeviceCodeResponse> {
  const response = await fetch(`${getApiBaseUrl()}/auth/device/code`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'dm-cli/0.1.0',
    },
    body: JSON.stringify({
      client_id: clientId,
      device_name: deviceName,
    }),
  });

  if (!response.ok) {
    const error = await response.json() as DeviceAuthError;
    throw new Error(error.error?.message || `Request failed with status ${response.status}`);
  }

  return response.json() as Promise<DeviceCodeResponse>;
}

export async function pollForToken(
  deviceCode: string,
  clientId: string
): Promise<PollResult> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/auth/device/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'dm-cli/0.1.0',
      },
      body: JSON.stringify({
        device_code: deviceCode,
        client_id: clientId,
      }),
    });

    if (response.ok) {
      const data = await response.json() as DeviceTokenResponse;
      return { status: 'success', data };
    }

    const error = await response.json() as DeviceAuthError;
    const errorCode = error.error?.code;

    switch (errorCode) {
      case 'authorization_pending':
        return { status: 'pending' };
      case 'slow_down':
        return { status: 'slow_down' };
      case 'access_denied':
        return { status: 'denied', message: error.error?.message || 'Access denied' };
      case 'expired_token':
        return { status: 'expired', message: error.error?.message || 'Token expired' };
      default:
        return { status: 'error', message: error.error?.message || 'Unknown error' };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error';
    return { status: 'error', message };
  }
}

export async function verifyCredentials(apiKey: string): Promise<{
  valid: boolean;
  organization?: { id: number; name: string };
}> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/account`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'User-Agent': 'dm-cli/0.1.0',
      },
    });

    if (!response.ok) {
      return { valid: false };
    }

    const data = await response.json() as { organization: { id: number; name: string } };

    return {
      valid: true,
      organization: {
        id: data.organization.id,
        name: data.organization.name,
      },
    };
  } catch {
    return { valid: false };
  }
}
