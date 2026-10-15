import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const readConfig = vi.hoisted(() => vi.fn());
vi.mock('../../src/lib/config.js', () => ({ readConfig }));
import { apiRequest } from '../../src/lib/client.js';

beforeEach(() => {
  vi.stubEnv('DM_API_URL', 'https://api.example.test/v1');
  vi.stubEnv('DM_API_KEY', 'unrelated-environment-key');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('sends the stored login credential even when an unrelated environment key is present', async () => {
  readConfig.mockReturnValue({ apiKey: 'stored-account-key' });
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: {} }) });
  vi.stubGlobal('fetch', fetch);

  await apiRequest('/account');

  expect(fetch).toHaveBeenCalledWith(
    'https://api.example.test/v1/account',
    expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: 'Bearer stored-account-key',
      }),
    })
  );
});

it('requires login after stored credentials are removed even if the environment key remains', async () => {
  readConfig.mockReturnValue(null);
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: {} }) });
  vi.stubGlobal('fetch', fetch);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('exit');
  });

  await expect(apiRequest('/account')).rejects.toThrow('exit');
  expect(process.exit).toHaveBeenCalledWith(1);
  expect(fetch).not.toHaveBeenCalled();
});

it('names each rejected field when the API returns a validation error', async () => {
  readConfig.mockReturnValue({ apiKey: 'stored-account-key' });
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: {
          code: 'validation_error',
          message: 'Validation failed',
          details: {
            issues: [
              {
                path: 'status',
                message: 'status must be one of draft, ready, active, paused, ended, completed, cancelled',
              },
            ],
          },
        },
      }),
    })
  );
  const printed: string[] = [];
  vi.spyOn(console, 'error').mockImplementation((line: unknown) => {
    printed.push(String(line));
  });
  vi.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('exit');
  });

  await expect(apiRequest('/mail/campaigns', { query: { status: 'finished' } })).rejects.toThrow('exit');
  expect(printed.join('\n')).toContain(
    'status: status must be one of draft, ready, active, paused, ended, completed, cancelled'
  );
});
