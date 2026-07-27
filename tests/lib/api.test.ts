import { afterEach, describe, expect, it, vi } from 'vitest';
import { verifyCredentials } from '../../src/lib/api';

describe('CLI API helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.DM_API_URL;
  });

  it('verifies credentials from the current account response envelope', async () => {
    process.env.DM_API_URL = 'https://api.example.test/v1';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          organization: {
            id: 145,
            name: 'Lecko Org',
            slug: 'lecko',
          },
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(verifyCredentials('dm_sk_live_test')).resolves.toEqual({
      valid: true,
      organization: {
        id: 145,
        name: 'Lecko Org',
        slug: 'lecko',
      },
    });
    expect(fetchMock).toHaveBeenCalledWith('https://api.example.test/v1/account', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer dm_sk_live_test',
        'User-Agent': 'dm-cli/0.1.5',
      },
    });
  });

  it('returns invalid when the account response does not include an organization', async () => {
    process.env.DM_API_URL = 'https://api.example.test/v1';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: {} }),
      })
    );

    await expect(verifyCredentials('dm_sk_live_test')).resolves.toEqual({ valid: false });
  });
});
