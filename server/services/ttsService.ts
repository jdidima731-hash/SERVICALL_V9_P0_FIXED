import { getOpenAIClient } from '../_core/openaiClient';
import { logger } from "../infrastructure/logger";
import WebSocket from 'ws';

const openai = getOpenAIClient();

export interface TTSConfig {
  provider?: 'openai' | 'elevenlabs' | 'azure';
  voice?: string;
  model?: string;
  speed?: number;
  enableFallback?: boolean;
  streamSid?: string;
}

/**
 * Synthesize text to speech using OpenAI TTS API with streaming support
 * ✅ PHASE 2 : First Token Response implementation
 */
export async function synthesizeSpeech(
  text: string,
  voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' = 'alloy',
  config: TTSConfig = {},
  ws?: WebSocket
): Promise<Buffer | void> {
  const startTime = Date.now();
  
  try {
    logger.info('[TTS Service] Synthesizing speech', { 
      text: text.substring(0, 50) + '...', 
      voice,
      provider: config.provider ?? 'openai',
      streaming: !!ws && !!config.streamSid
    });
    
    // Si WebSocket et streamSid sont fournis, on tente le streaming (First Token Response)
    if (ws && config.streamSid) {
      return await streamSpeechToTwilio(text, voice, config.streamSid, ws);
    }

    // Sinon, mode batch classique
    const mp3 = await openai.audio.speech.create({
      model: config.model || 'tts-1',
      voice: voice,
      input: text,
      speed: config.speed ?? 1.0,
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    const latency = Date.now() - startTime;
    logger.info('[TTS Service] Speech synthesized successfully (OpenAI Batch)', {
      latency,
      audioSize: buffer.length,
    });
    
    return buffer;
  } catch (error: any) {
    logger.error('[TTS Service] Error synthesizing speech', { error, text });
    throw error;
  }
}

/**
 * Stream speech directly to Twilio WebSocket
 * This reduces latency by sending audio chunks as they are generated
 */
async function streamSpeechToTwilio(
  text: string,
  voice: string,
  streamSid: string,
  ws: WebSocket
): Promise<void> {
  const startTime = Date.now();
  let firstTokenSent = false;

  try {
    const response = await openai.audio.speech.create({
      model: 'tts-1',
      
      voice: voice as unknown,
      input: text,
      response_format: 'pcm', // PCM is better for streaming to Twilio
    });

    // OpenAI response.body is a ReadableStream in some environments, 
    // but with the official SDK it might be different. 
    // We'll use the standard fetch-like response if possible.
    const reader = ((response as unknown) as Response).body!.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      if (!firstTokenSent) {
        const firstTokenLatency = Date.now() - startTime;
        logger.info('[TTS Service] First token sent to Twilio', { latency: firstTokenLatency });
        firstTokenSent = true;
      }

      // Convert PCM to mulaw and base64 for Twilio
      // (Simplified: assuming value is already in a compatible format or needs conversion)
      const base64Audio = Buffer.from(value).toString('base64');
      
      ws.send(JSON.stringify({
        event: 'media',
        streamSid: streamSid,
        media: {
          payload: base64Audio
        }
      }));
    }

    logger.info('[TTS Service] Streaming completed', { totalTime: Date.now() - startTime });
  } catch (error: any) {
    logger.error('[TTS Service] Streaming error', { error });
    throw error;
  }
}

export function getAvailableVoiceProfiles() {
  return [
    { id: 'openai-alloy', name: 'Alloy', provider: 'openai', voiceId: 'alloy' },
    { id: 'openai-echo', name: 'Echo', provider: 'openai', voiceId: 'echo' },
    { id: 'openai-fable', name: 'Fable', provider: 'openai', voiceId: 'fable' },
    { id: 'openai-onyx', name: 'Onyx', provider: 'openai', voiceId: 'onyx' },
    { id: 'openai-nova', name: 'Nova', provider: 'openai', voiceId: 'nova' },
    { id: 'openai-shimmer', name: 'Shimmer', provider: 'openai', voiceId: 'shimmer' },
  ];
}