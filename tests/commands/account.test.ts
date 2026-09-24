import { afterEach, expect, it, vi } from 'vitest';
const request = vi.hoisted(() => vi.fn());
vi.mock('../../src/lib/client', () => ({ apiRequest: request, formatDate: () => 'Sep 8, 2026' }));
import { account } from '../../src/commands/account';
afterEach(() => vi.restoreAllMocks());

const response = {
  data: {
    data_engine: 'legacy',
    organization: { id: 42, name: 'QA', createdAt: '2026-09-08' },
    user: { id: 7, authType: 'api_key' },
  },
};
it('keeps the original default account display', async () => {
  request.mockResolvedValue(response);
  const output = vi.spyOn(console, 'log').mockImplementation(() => {});
  await account();
  expect(output.mock.calls.flat().join('\n')).toContain('Organization:');
  expect(output.mock.calls.flat().join('\n')).not.toContain('data_engine');
  expect(request).toHaveBeenCalledWith('/account');
});
it('honors the documented JSON option and exposes the server-resolved engine', async () => {
  request.mockResolvedValue(response);
  const output = vi.spyOn(console, 'log').mockImplementation(() => {});
  await account({ json: true });
  expect(output).toHaveBeenCalledTimes(1);
  expect(JSON.parse(output.mock.calls[0][0])).toEqual(response);
});
