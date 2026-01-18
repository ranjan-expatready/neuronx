import { ChannelRoutingPolicyLoader } from '../channel-routing-policy.loader';
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';

describe('ChannelRoutingPolicyLoader', () => {
  let loader: ChannelRoutingPolicyLoader;
  const testConfigPath = join(__dirname, 'test-channel-routing-policy.yaml');

  beforeEach(() => {
    loader = new ChannelRoutingPolicyLoader();
    vi.spyOn(loader['logger'], 'log').mockImplementation(() => {});
    vi.spyOn(loader['logger'], 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    if (existsSync(testConfigPath)) {
      unlinkSync(testConfigPath);
    }
    vi.restoreAllMocks();
  });

  it('should load and validate a valid policy file', () => {
    const validConfig = `
      channelPriorityOrder:
        - voice
        - sms
        - email
        - whatsapp
        - calendar
      riskChannelConstraints:
        critical: email
      dealValueRouting:
        - minValue: 50000
          preferredChannel: whatsapp
          reason: "High-value prospects contacted via WhatsApp"
      slaUrgencyOverrides:
        - urgency: urgent
          commandTypes: ["SEND_MESSAGE"]
          preferredChannel: sms
          reason: "Urgent messages sent via SMS"
      retryFallbacks:
        - maxRetries: 3
          fallbackChannel: email
          reason: "Excessive retries require human intervention via email"
      humanOnlyChannels: []
      riskScoreThresholds:
        critical: 80
        high: 60
        medium: 40
        low: 0
      commandFallbacks:
        - commandType: "EXECUTE_CONTACT"
          fallbackChannel: voice
          reason: "Default contact execution via voice"
        - commandType: "SEND_MESSAGE"
          fallbackChannel: email
          reason: "Default message sending via email"
    `;
    writeFileSync(testConfigPath, validConfig);

    const policy = loader.loadPolicy(testConfigPath);
    expect(policy).toBeDefined();
    expect(policy.channelPriorityOrder).toEqual([
      'voice',
      'sms',
      'email',
      'whatsapp',
      'calendar',
    ]);
    expect(policy.riskChannelConstraints.critical).toBe('email');
    expect(policy.dealValueRouting[0].minValue).toBe(50000);
  });

  it('should throw an error for an invalid policy file (missing required field)', () => {
    const invalidConfig = `
      channelPriorityOrder:
        - voice
        - sms
        - email
      # riskScoreThresholds is missing
      dealValueRouting: []
      slaUrgencyOverrides: []
      retryFallbacks: []
      humanOnlyChannels: []
      commandFallbacks: []
    `;
    writeFileSync(testConfigPath, invalidConfig);

    expect(() => loader.loadPolicy(testConfigPath)).toThrow(
      'Invalid Channel Routing Policy Configuration'
    );
    expect(loader['logger'].error).toHaveBeenCalledWith(
      expect.stringContaining(
        'Validation error: riskScoreThresholds - Required'
      )
    );
  });

  it('should throw an error for a non-existent file', () => {
    expect(() => loader.loadPolicy('/non/existent/path.yaml')).toThrow(
      'Invalid Channel Routing Policy Configuration'
    );
    expect(loader['logger'].error).toHaveBeenCalledWith(
      expect.stringContaining(
        'Failed to load or validate channel routing policy'
      )
    );
  });
});
