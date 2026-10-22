import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const { request, config, saveConfig } = vi.hoisted(() => ({ request: vi.fn(), config: vi.fn(), saveConfig: vi.fn() }));
vi.mock('../../src/lib/client.js', () => ({ apiRequest: request, getApiBaseUrl: () => 'https://api.example.test/v1' }));
vi.mock('../../src/lib/config.js', () => ({ readConfig: config, writeConfig: saveConfig }));
import { checkout, plans, signup } from '../../src/commands/onboarding.js';

const catalog = {
  plans: [{ id: 'basic', name: 'Basic', pricing: { currency: 'usd', monthly_price_cents: 9900, annual_price_cents: 99000 },
    stripe_price_ids: { monthly: 'price_month', annual: 'price_year' }, features: ['Property and people enrichment'],
    credits: { enrichment_per_month: 1000 }, seats: { min: 1, max: 10 } }],
  free_tier: { enrichment_credit_cap: 0, ai_credit_cap: 1000000, api_access: true },
};

beforeEach(() => { vi.clearAllMocks(); request.mockResolvedValue(catalog); config.mockReturnValue({ apiKey: 'fixture' }); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('self-serve onboarding commands', () => {
  it.each([true, false])('stores a new signup credential without exposing it in output (JSON=%s)', async json => {
    const secret = 'dm_sk_test_signup_fixture';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ api_key: secret, key_id: 'key_fixture',
      organization: { id: 42, name: 'Fixture', slug: 'fixture' }, message: 'Created' }), { status: 201 })));
    const output = vi.spyOn(console, 'log').mockImplementation(() => {});
    await signup({ email: 'fixture@example.test', login: true, json });
    expect(saveConfig).toHaveBeenCalledWith(expect.objectContaining({ apiKey: secret, organizationId: 42 }));
    expect(JSON.stringify(output.mock.calls)).not.toContain(secret);
    if (json) expect(JSON.parse(output.mock.calls[0][0])).toMatchObject({ api_key_saved: true, key_id: 'key_fixture' });
  });

  it('previews the recurring price without creating checkout until approved', async () => {
    const output = vi.spyOn(console, 'log').mockImplementation(() => {});
    await checkout({ priceId: 'price_year', quantity: '2', json: true });
    expect(JSON.parse(output.mock.calls[0][0])).toMatchObject({ checkout_created: false, confirmation_required: true,
      quote: { amount_cents: 198000, currency: 'usd', billing_interval: 'year', quantity: 2 } });
    expect(request.mock.calls).toEqual([['/account/plans']]);
  });

  it('creates only the approved checkout and preserves payment-pending information', async () => {
    const pending = { checkout_url: 'https://checkout.stripe.com/c/pay/fixture', payment_status: 'pending' };
    request.mockResolvedValueOnce(catalog).mockResolvedValueOnce(pending);
    const output = vi.spyOn(console, 'log').mockImplementation(() => {});
    await checkout({ priceId: 'price_month', yes: true, json: true });
    expect(request.mock.calls).toEqual([['/account/plans'], ['/checkout', { method: 'POST', body: { price_id: 'price_month', quantity: 1 } }]]);
    expect(JSON.parse(output.mock.calls[0][0])).toEqual(pending);
  });

  it('shows the connected workspace catalog and free allowance', async () => {
    const output = vi.spyOn(console, 'log').mockImplementation(() => {});
    await plans({ json: true });
    expect(request).toHaveBeenCalledWith('/account/plans');
    expect(JSON.parse(output.mock.calls[0][0])).toEqual(catalog);
  });
});
