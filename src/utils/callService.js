import twilio from 'twilio';
import dotenv from 'dotenv';
import axios from 'axios';
import { Activity } from '../models/Activity.models.js';
import { CallLog } from '../models/CallLogs.models.js';
import { ApiError } from './ApiError.js';

dotenv.config();
// Initialize Twilio client

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

if (!accountSid || !authToken) {
  throw new ApiError(500, 'Twilio credentials not configured');
}

const client = twilio(accountSid, authToken);

/**
 * Make an outbound call to a contact
 * @param {string} toNumber - The contact's phone number
 * @param {string} agentExtension - The agent's phone extension
 * @param {string} callId - The database ID of the call record
 * @returns {Promise} - The Twilio call object
 */
export const makeCall = async (leadId, userId, fromNumber, toNumber) => {
  console.log(leadId, userId, fromNumber, toNumber);
  try {
    // Normalize phone number
    const normalizedNumber = normalizePhoneNumber(toNumber);

    const callLog = await CallLog.create({
      lead: leadId,
      user: userId,
      callType: 'outgoing',
      status: 'initiated',
      duration: 0,
      calledFrom: fromNumber,
      calledTo: toNumber,
      startTime: Date.now(),
    });

    if (!callLog) {
      throw new ApiError(500, 'Failed to create call log');
    }

    // calling using twilio
    try {
      const response = await client.calls.create({
        twiml: `
            <Response>
                <Say>Hello, this is message from the twilio call testing, I hope you are fine and doing well..</Say>
            </Response>
            `,
        from: fromNumber,
        to: toNumber,
      });
      return response.sid;
    } catch (error) {
      console.log('twilio calling error', error);
    }
  } catch (error) {
    console.error('Error making call:', error);
    throw error;
  }
};

/**
 * End an active call
 * @param {string} callSid - The Twilio call SID
 * @returns {Promise} - The updated Twilio call object
 */
export const endCall = async (callSid) => {
  try {
    // End the call
    const call = await client.calls(callSid).update({ status: 'completed' });

    return call;
  } catch (error) {
    console.error('Error ending call:', error);
    throw error;
  }
};

/**
 * Generate TwiML for call connection
 * @param {string} agentNumber - The agent's phone number
 * @returns {string} - TwiML markup
 */
export const generateConnectTwiML = (agentNumber) => {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const response = new VoiceResponse();

  // Add a brief message
  response.say('Connecting your call. Please wait.');

  // Dial the agent
  const dial = response.dial({
    callerId: twilioPhoneNumber,
    timeout: 20,
    record: 'record-from-answer',
    recordingStatusCallback: `${baseUrl}/api/twilio/recording-status`,
  });

  dial.number(agentNumber);

  return response.toString();
};

/**
 * Generate TwiML for voicemail
 * @returns {string} - TwiML markup
 */
export const generateVoicemailTwiML = () => {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const response = new VoiceResponse();

  response.say('Please leave a message after the tone.');

  response.record({
    action: `${baseUrl}/api/twilio/handle-recording`,
    maxLength: 120,
    transcribe: true,
    transcribeCallback: `${baseUrl}/api/twilio/transcription`,
  });

  return response.toString();
};

/**
 * Normalize a phone number to E.164 format
 * @param {string} phoneNumber - The phone number to normalize
 * @returns {string} - E.164 formatted phone number
 */
const normalizePhoneNumber = (phoneNumber) => {
  // Remove all non-numeric characters
  let cleaned = phoneNumber.replace(/\D/g, '');

  // Ensure US format with country code
  if (cleaned.length === 10) {
    cleaned = `+1${cleaned}`;
  } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
    cleaned = `+${cleaned}`;
  } else if (!cleaned.startsWith('+')) {
    cleaned = `+${cleaned}`;
  }

  return cleaned;
};
