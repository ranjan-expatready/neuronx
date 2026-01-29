/**
 * Twilio Client Tests - WI-033: Voice Execution Adapter Hardening
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TwilioClient } from '../twilio.client';
import { VoiceConfiguration } from '../types';

// Mock fetch globally
global.fetch = vi.fn();

describe('TwilioClient', () => {
  let client: TwilioClient;
  let config: VoiceConfiguration;

  beforeEach(() => {
    config = {
      enabled: true,
      twilioAccountSid: 'test_sid',
      twilioAuthToken: 'test_token',
      twilioFromNumber: '+1234567890',
      maxCallDurationSeconds: 300,
      defaultTimeoutSeconds: 30,
      machineDetectionEnabled: false,
      recordingEnabled: false,
      scriptedModeEnabled: true,
      conversationalModeEnabled: false,
      humanAssistEnabled: false,
    };

    client = new TwilioClient(config);
    vi.clearAllMocks();
  });

  describe('createCall', () => {
    it('should create a call with correct parameters', async () => {
      const mockResponse = {
        sid: 'CA123',
        status: 'queued',
        to: '+0987654321',
        from: '+1234567890',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const callRequest = {
        to: '+0987654321',
        from: '+1234567890',
        statusCallback: 'https://example.com/callback',
        statusCallbackEvent: ['answered', 'completed'],
        timeout: 30,
        record: false,
      };

      const result = await client.createCall(callRequest);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.twilio.com/2010-04-01/Accounts/test_sid/Calls.json',
        expect.objectContaining({
          method: 'POST',
          headers: {
            Authorization: 'Basic dGVzdF9zaWQ6dGVzdF90b2tlbg==', // base64 encoded
          },
        })
      );

      expect(result).toEqual(mockResponse);
    });

    it('should handle API errors', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Invalid phone number'),
      });

      const callRequest = {
        to: 'invalid',
        from: '+1234567890',
      };

      await expect(client.createCall(callRequest)).rejects.toThrow(
        'Twilio API error 400'
      );
    });
  });

  describe('fetchCall', () => {
    it('should fetch call details', async () => {
      const mockResponse = {
        sid: 'CA123',
        status: 'completed',
        duration: '45',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.fetchCall('CA123');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.twilio.com/2010-04-01/Accounts/test_sid/Calls/CA123.json',
        expect.any(Object)
      );

      expect(result).toEqual(mockResponse);
    });
  });

  describe('hangupCall', () => {
    it('should hang up a call', async () => {
      const mockResponse = { sid: 'CA123', status: 'completed' };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.hangupCall('CA123');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.twilio.com/2010-04-01/Accounts/test_sid/Calls/CA123.json',
        expect.objectContaining({
          method: 'POST',
        })
      );

      expect(result).toEqual(mockResponse);
    });
  });

  describe('fetchRecording', () => {
    it('should fetch recording details', async () => {
      const mockResponse = {
        sid: 'RE123',
        duration: '30',
        url: 'https://api.twilio.com/recordings/RE123.mp3',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.fetchRecording('RE123');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.twilio.com/2010-04-01/Accounts/test_sid/Recordings/RE123.json',
        expect.any(Object)
      );

      expect(result).toEqual(mockResponse);
    });
  });
});
