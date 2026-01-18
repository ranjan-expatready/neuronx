/**
 * Twilio Client - WI-033: Voice Execution Adapter Hardening
 *
 * Thin HTTP client wrapper around Twilio REST API.
 * NO business logic - pure API communication.
 */

import {
  TwilioCallRequest,
  TwilioCallResponse,
  VoiceConfiguration,
} from './types';

/**
 * Twilio API client - thin wrapper with no business logic
 */
export class TwilioClient {
  private accountSid: string;
  private authToken: string;
  private baseUrl: string;

  constructor(config: VoiceConfiguration) {
    if (!config.twilioAccountSid || !config.twilioAuthToken) {
      throw new Error('Twilio account SID and auth token are required');
    }

    this.accountSid = config.twilioAccountSid;
    this.authToken = config.twilioAuthToken;
    this.baseUrl = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}`;
  }

  /**
   * Create an outbound call
   */
  async createCall(request: TwilioCallRequest): Promise<TwilioCallResponse> {
    const url = `${this.baseUrl}/Calls.json`;

    const formData = new FormData();
    formData.append('To', request.to);
    formData.append('From', request.from);

    if (request.url) formData.append('Url', request.url);
    if (request.twiml) formData.append('Twiml', request.twiml);
    if (request.statusCallback)
      formData.append('StatusCallback', request.statusCallback);
    if (request.statusCallbackEvent) {
      formData.append(
        'StatusCallbackEvent',
        request.statusCallbackEvent.join(' ')
      );
    }
    if (request.statusCallbackMethod) {
      formData.append('StatusCallbackMethod', request.statusCallbackMethod);
    }
    if (request.timeout) formData.append('Timeout', request.timeout.toString());
    if (request.record !== undefined)
      formData.append('Record', request.record.toString());
    if (request.recordingChannels)
      formData.append('RecordingChannels', request.recordingChannels);
    if (request.recordingStatusCallback) {
      formData.append(
        'RecordingStatusCallback',
        request.recordingStatusCallback
      );
    }
    if (request.recordingStatusCallbackMethod) {
      formData.append(
        'RecordingStatusCallbackMethod',
        request.recordingStatusCallbackMethod
      );
    }
    if (request.machineDetection)
      formData.append('MachineDetection', request.machineDetection);
    if (request.machineDetectionTimeout) {
      formData.append(
        'MachineDetectionTimeout',
        request.machineDetectionTimeout.toString()
      );
    }
    if (request.machineDetectionSpeechThreshold) {
      formData.append(
        'MachineDetectionSpeechThreshold',
        request.machineDetectionSpeechThreshold.toString()
      );
    }
    if (request.machineDetectionSpeechEndThreshold) {
      formData.append(
        'MachineDetectionSpeechEndThreshold',
        request.machineDetectionSpeechEndThreshold.toString()
      );
    }
    if (request.machineDetectionSilenceTimeout) {
      formData.append(
        'MachineDetectionSilenceTimeout',
        request.machineDetectionSilenceTimeout.toString()
      );
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${this.accountSid}:${this.authToken}`)}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Twilio API error ${response.status}: ${errorText}`);
    }

    return response.json();
  }

  /**
   * Fetch call details
   */
  async fetchCall(callSid: string): Promise<TwilioCallResponse> {
    const url = `${this.baseUrl}/Calls/${callSid}.json`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${btoa(`${this.accountSid}:${this.authToken}`)}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Twilio API error ${response.status}: ${errorText}`);
    }

    return response.json();
  }

  /**
   * Update call (hang up, redirect, etc.)
   */
  async updateCall(
    callSid: string,
    updates: Partial<TwilioCallRequest>
  ): Promise<TwilioCallResponse> {
    const url = `${this.baseUrl}/Calls/${callSid}.json`;

    const formData = new FormData();
    if (updates.url) formData.append('Url', updates.url);
    if (updates.twiml) formData.append('Twiml', updates.twiml);
    if (updates.statusCallback)
      formData.append('StatusCallback', updates.statusCallback);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${this.accountSid}:${this.authToken}`)}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Twilio API error ${response.status}: ${errorText}`);
    }

    return response.json();
  }

  /**
   * Hang up a call
   */
  async hangupCall(callSid: string): Promise<TwilioCallResponse> {
    return this.updateCall(callSid, {
      twiml: '<Response><Hangup/></Response>',
    });
  }

  /**
   * Fetch recording details
   */
  async fetchRecording(recordingSid: string): Promise<any> {
    const url = `${this.baseUrl}/Recordings/${recordingSid}.json`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${btoa(`${this.accountSid}:${this.authToken}`)}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Twilio API error ${response.status}: ${errorText}`);
    }

    return response.json();
  }

  /**
   * Delete recording
   */
  async deleteRecording(recordingSid: string): Promise<void> {
    const url = `${this.baseUrl}/Recordings/${recordingSid}.json`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Basic ${btoa(`${this.accountSid}:${this.authToken}`)}`,
      },
    });

    if (!response.ok && response.status !== 204) {
      const errorText = await response.text();
      throw new Error(`Twilio API error ${response.status}: ${errorText}`);
    }
  }
}
