import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock chalk to return plain text (no ANSI codes in test output)
vi.mock('chalk', () => {
  const handler: ProxyHandler<object> = {
    get: () => new Proxy((str: string) => str, handler),
    apply: (_target, _this, args) => args[0],
  };
  return { default: new Proxy({}, handler) };
});

import { truncate, printTable, printJson, printKeyValue } from '../../src/lib/output';

describe('output helpers', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(console.log).mockClear();
  });

  describe('truncate', () => {
    it('returns string unchanged when shorter than max', () => {
      expect(truncate('hello', 10)).toBe('hello');
    });

    it('truncates with ellipsis at maxLen', () => {
      expect(truncate('hello world', 6)).toBe('hello…');
    });

    it('handles exact length', () => {
      expect(truncate('hello', 5)).toBe('hello');
    });
  });

  describe('printJson', () => {
    it('outputs formatted JSON', () => {
      printJson({ a: 1, b: 'two' });
      expect(console.log).toHaveBeenCalledWith(
        JSON.stringify({ a: 1, b: 'two' }, null, 2)
      );
    });
  });

  describe('printTable', () => {
    it('prints no results message for empty rows', () => {
      printTable([]);
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('no results'));
    });

    it('prints header and rows', () => {
      printTable([{ name: 'Alice', age: 30 }], ['name', 'age']);
      // At least header + separator + 1 row = 3 calls
      expect(vi.mocked(console.log).mock.calls.length).toBeGreaterThanOrEqual(3);
    });

    it('auto-detects columns from first row', () => {
      printTable([{ x: 1, y: 2 }]);
      const allOutput = vi.mocked(console.log).mock.calls.map(c => c[0]).join('\n');
      expect(allOutput).toContain('x');
      expect(allOutput).toContain('y');
    });
  });

  describe('printKeyValue', () => {
    it('prints key-value pairs', () => {
      printKeyValue({ name: 'Test', count: 42 });
      expect(vi.mocked(console.log).mock.calls.length).toBe(2);
    });
  });
});
