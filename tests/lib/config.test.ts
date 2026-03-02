import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

// Mock fs and os to avoid touching real filesystem
vi.mock('node:fs');
vi.mock('node:os', () => ({
  homedir: vi.fn(() => '/tmp/test-home'),
}));

import { readConfig, writeConfig, deleteConfig, configExists, getConfigValue, setConfigValue } from '../../src/lib/config';

const CONFIG_DIR = path.join('/tmp/test-home', '.dealmachine');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

const sampleConfig = {
  apiKey: 'dm_sk_live_test123',
  keyId: 'key_1',
  organizationId: 7,
  organizationName: 'Test Org',
  organizationSlug: 'test-org',
};

describe('CLI config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('readConfig', () => {
    it('returns null when config file does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      expect(readConfig()).toBeNull();
    });

    it('returns parsed config when file exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(sampleConfig));
      const config = readConfig();
      expect(config).toEqual(sampleConfig);
    });

    it('returns null on invalid JSON', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('not json');
      expect(readConfig()).toBeNull();
    });
  });

  describe('writeConfig', () => {
    it('creates config directory and writes file with secure permissions', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      writeConfig(sampleConfig);
      expect(fs.mkdirSync).toHaveBeenCalledWith(CONFIG_DIR, { mode: 0o700 });
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        CONFIG_FILE,
        JSON.stringify(sampleConfig, null, 2),
        { mode: 0o600, encoding: 'utf-8' }
      );
    });

    it('skips mkdir when directory exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      writeConfig(sampleConfig);
      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });
  });

  describe('deleteConfig', () => {
    it('deletes config file and returns true', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      expect(deleteConfig()).toBe(true);
      expect(fs.unlinkSync).toHaveBeenCalledWith(CONFIG_FILE);
    });

    it('returns false when file does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      expect(deleteConfig()).toBe(false);
    });
  });

  describe('configExists', () => {
    it('returns true when file exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      expect(configExists()).toBe(true);
    });

    it('returns false when file does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      expect(configExists()).toBe(false);
    });
  });

  describe('getConfigValue', () => {
    it('returns specific config value', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(sampleConfig));
      expect(getConfigValue('apiKey')).toBe('dm_sk_live_test123');
      expect(getConfigValue('organizationId')).toBe(7);
    });

    it('returns null when no config', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      expect(getConfigValue('apiKey')).toBeNull();
    });
  });

  describe('setConfigValue', () => {
    it('updates a single config value', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(sampleConfig));
      const result = setConfigValue('organizationName', 'New Name');
      expect(result).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalled();
      const writtenData = JSON.parse(
        vi.mocked(fs.writeFileSync).mock.calls[0][1] as string
      );
      expect(writtenData.organizationName).toBe('New Name');
    });

    it('returns false when no config exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      expect(setConfigValue('apiKey', 'new')).toBe(false);
    });
  });
});
