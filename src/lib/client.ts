/**
 * Shared API client for authenticated CLI commands
 */

import chalk from 'chalk';
import { readConfig, type ApiEnvironment } from './config.js';

const API_URLS: Record<ApiEnvironment, string> = {
  local: 'http://localhost:3001/v1',
  production: 'https://api.dealmachine.com/v1',
} as const;

export interface ApiError {
  error?: {
    code?: string;
    message?: string;
  };
}

export function getApiBaseUrl(): string {
  if (process.env.ATLAS_API_URL) {
    return process.env.ATLAS_API_URL;
  }

  const envVar = process.env.ATLAS_ENVIRONMENT as ApiEnvironment | undefined;
  if (envVar && API_URLS[envVar]) {
    return API_URLS[envVar];
  }

  const config = readConfig();
  if (config?.apiEnvironment && API_URLS[config.apiEnvironment]) {
    return API_URLS[config.apiEnvironment];
  }

  return API_URLS.production;
}

export function getApiKey(): string {
  const config = readConfig();
  if (!config?.apiKey) {
    console.error(chalk.red('Not logged in. Run `atlas login` first.'));
    process.exit(1);
  }
  return config.apiKey;
}

export async function apiRequest<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    body?: Record<string, unknown>;
    query?: Record<string, string | number | boolean | undefined>;
  } = {}
): Promise<T> {
  const { method = 'GET', body, query } = options;
  const apiUrl = getApiBaseUrl();
  const apiKey = getApiKey();

  let url = `${apiUrl}${path}`;
  if (query) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        params.set(key, String(value));
      }
    }
    const queryString = params.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  const response = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Atlas-CLI/0.1.0',
    },
    ...(body && { body: JSON.stringify(body) }),
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as ApiError;
    const message = error.error?.message || `Request failed with status ${response.status}`;
    console.error(chalk.red(`Error: ${message}`));
    process.exit(1);
  }

  return response.json() as Promise<T>;
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
