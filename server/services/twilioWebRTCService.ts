import twilio from "twilio";
import { ENV } from "../_core/env";
import { logger } from '../core/logger/index';

const accountSid = ENV.twilioAccountSid;
const authToken = ENV.twilioAuthToken;
const apiKeySid = ENV.twilioApiKey;
const apiKeySecret = ENV.twilioApiSecret;
const twimlAppSid = ENV.twilioTwimlAppSid;

const AccessToken = twilio.jwt.AccessToken;
const VoiceGrant = AccessToken.VoiceGrant;

/**
 * BLOC 6 — VOICE STREAM TOKEN
 * Génère un token JWT spécifique pour le streaming audio temps réel (Media Streams).
 * Ce token est utilisé par le client pour s'authentifier auprès du serveur de transcription.
 */
export function generateVoiceStreamToken(
  callSid: string,
  tenantId: number
): string {
  if (!tenantId || tenantId <= 0) {
    throw new Error("Invalid tenantId for voice stream token");
  }

  try {
    // Utilise le même secret que les tokens d'accès pour la cohérence
    const token = new AccessToken(accountSid!, apiKeySid!, apiKeySecret!, {
      identity: `vst_${callSid}`,
      ttl: 3600, // 1 heure
    });

    // Ajout d'un payload personnalisé pour le routage interne
    (token as unknown).addGrant({
      toPayload: () => ({
        tenant_id: tenantId,
        call_sid: callSid,
        purpose: 'voice_stream_transcription'
      })
    });

    return token.toJwt();
  } catch (error: any) {
    logger.error("[Twilio WebRTC] Error generating voice stream token:", error);
    throw new Error("Failed to generate voice stream token");
  }
}

/**
 * Generate Twilio Access Token for WebRTC Client SDK
 * This token allows the browser to connect to Twilio and make/receive calls
 */
export function generateVoiceAccessToken(
  identity: string,
  tenantId: number
): string {
  // DURCI: Assertion de type et valeur
  if (!tenantId || isNaN(tenantId) || tenantId <= 0) {
    throw new Error("Invalid tenantId for voice access token");
  }

  try {
    if (!accountSid || !apiKeySid || !apiKeySecret) {
      throw new Error("Twilio credentials not configured - cannot generate voice access token");
    }

    // Create an access token
    const token = new AccessToken(accountSid, apiKeySid, apiKeySecret, {
      identity: `${identity}-tenant-${tenantId}`,
      ttl: 3600, // 1 hour
    });

    // Create a Voice grant
    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: twimlAppSid,
      incomingAllow: true,
    });

    // Add the grant to the token
    token.addGrant(voiceGrant);

    // Serialize the token to a JWT string
    return token.toJwt();
  } catch (error: any) {
    logger.error("[Twilio WebRTC] Error generating access token:", error);
    throw new Error("Failed to generate Twilio access token");
  }
}

/**
 * Generate TwiML for outgoing calls
 * This is called when a user initiates a call from the browser
 */
export function generateOutgoingCallTwiML(
  toNumber: string,
  fromNumber: string,
  callerId: string
): string {
  try {
    const response = new twilio.twiml.VoiceResponse();

    // Dial the number
    const dial = response.dial({
      callerId: callerId || fromNumber,
      record: "record-from-answer",
      recordingStatusCallback: ENV.appUrl ? `${ENV.appUrl}/webhooks/recording-status` : undefined,
    });

    dial.number(toNumber);

    return response.toString();
  } catch (error: any) {
    logger.error("[Twilio WebRTC] Error generating outgoing call TwiML:", error);
    throw error;
  }
}

/**
 * Generate TwiML for incoming calls
 * This is called when someone calls your Twilio number
 */
export function generateIncomingCallTwiML(
  agentIdentity: string,
  tenantId: number
): string {
  try {
    const response = new twilio.twiml.VoiceResponse();

    // Greet the caller
    response.say(
      {
        voice: "alice",
        language: "fr-FR",
      },
      "Bienvenue. Nous vous mettons en relation avec un agent."
    );

    // Connect to the agent's browser client
    const dial = response.dial({
      record: "record-from-answer",
      recordingStatusCallback: ENV.appUrl ? `${ENV.appUrl}/webhooks/recording-status` : undefined,
    });

    dial.client(`${agentIdentity}-tenant-${tenantId}`);

    return response.toString();
  } catch (error: any) {
    logger.error("[Twilio WebRTC] Error generating incoming call TwiML:", error);
    throw error;
  }
}

/**
 * Validate phone number format
 */
export function validatePhoneNumber(phoneNumber: string): boolean {
  // E.164 format: +[country code][number]
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phoneNumber);
}

/**
 * Format phone number to E.164
 */
export function formatPhoneNumber(phoneNumber: string, defaultCountryCode = "+33"): string {
  // Remove all non-digit characters
  let cleaned = phoneNumber.replace(/\D/g, "");

  // If it starts with 0, replace with country code
  if (cleaned.startsWith("0")) {
    cleaned = defaultCountryCode.replace("+", "") + cleaned.substring(1);
  }

  // Add + prefix if not present
  if (!cleaned.startsWith("+")) {
    cleaned = "+" + cleaned;
  }

  return cleaned;
}

/**
 * Get call status
 */
export async function getCallStatus(callSid: string): Promise<{
  status: string;
  duration: number;
  from: string;
  to: string;
}> {
  try {
    const client = twilio(accountSid, authToken);
    const call = await client.calls(callSid).fetch();

    return {
      status: call.status,
      duration: parseInt(call.duration ?? "0"),
      from: call.from,
      to: call.to,
    };
  } catch (error: any) {
    logger.error("[Twilio WebRTC] Error getting call status:", error);
    throw error;
  }
}

/**
 * Mute/Unmute a call participant
 */
export async function muteParticipant(
  callSid: string,
  muted: boolean
): Promise<void> {
  try {
    const client = twilio(accountSid, authToken);
    await client.calls(callSid).update({
      twiml: generateMuteTwiML(muted),
    });
  } catch (error: any) {
    logger.error("[Twilio WebRTC] Error muting participant:", error);
    throw error;
  }
}

/**
 * Generate TwiML for mute/unmute
 */
function generateMuteTwiML(muted: boolean): string {
  const response = new twilio.twiml.VoiceResponse();
  
  if (muted) {
    response.say("Vous êtes en sourdine.");
  }
  
  return response.toString();
}

/**
 * Hold/Unhold a call
 */
export async function holdCall(
  callSid: string,
  hold: boolean
): Promise<void> {
  try {
    const client = twilio(accountSid, authToken);
    
    if (hold) {
      const response = new twilio.twiml.VoiceResponse();
      response.play({
        loop: 10,
      }, "https://api.twilio.com/cowbell.mp3");
      
      await client.calls(callSid).update({
        twiml: response.toString(),
      });
    } else {
      // Resume the call - reconnect with original TwiML
      const response = new twilio.twiml.VoiceResponse();
      response.say("Reprise de l'appel.");
      
      await client.calls(callSid).update({
        twiml: response.toString(),
      });
    }
  } catch (error: any) {
    logger.error("[Twilio WebRTC] Error holding call:", error);
    throw error;
  }
}

/**
 * Transfer call to another number
 */
export async function transferCallToNumber(
  callSid: string,
  toNumber: string
): Promise<void> {
  try {
    const client = twilio(accountSid, authToken);
    const response = new twilio.twiml.VoiceResponse();

    response.say(
      {
        voice: "alice",
        language: "fr-FR",
      },
      "Transfert en cours."
    );

    response.dial(toNumber);

    await client.calls(callSid).update({
      twiml: response.toString(),
    });
  } catch (error: any) {
    logger.error("[Twilio WebRTC] Error transferring call:", error);
    throw error;
  }
}

/**
 * Conference call support
 */
export function generateConferenceTwiML(
  conferenceName: string,
  _participantLabel: string
): string {
  const response = new twilio.twiml.VoiceResponse();

  const dial = response.dial();
  dial.conference({
    startConferenceOnEnter: true,
    endConferenceOnExit: false,
    record: "record-from-start",
    recordingStatusCallback: ENV.appUrl ? `${ENV.appUrl}/webhooks/conference-recording` : undefined,
  }, conferenceName);

  return response.toString();
}

/**
 * Get recording URL
 */
export async function getRecordingUrl(recordingSid: string): Promise<string> {
  try {
    const client = twilio(accountSid, authToken);
    const recording = await client.recordings(recordingSid).fetch();
    
    // Construct the full URL
    const baseUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}`;
    return `${baseUrl}${recording.uri.replace(".json", ".mp3")}`;
  } catch (error: any) {
    logger.error("[Twilio WebRTC] Error getting recording URL:", error);
    throw error;
  }
}

/**
 * Download recording
 */
export async function downloadRecording(recordingSid: string): Promise<Buffer> {
  try {
    const client = twilio(accountSid, authToken);
    const recording = await client.recordings(recordingSid).fetch();
    
    // Download the recording
    const response = await fetch(
      `https://api.twilio.com${recording.uri.replace(".json", ".mp3")}`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        },
      }
    );

    return Buffer.from(await response.arrayBuffer());
  } catch (error: any) {
    logger.error("[Twilio WebRTC] Error downloading recording:", error);
    throw error;
  }
}
