import WebSocket from "ws";
import { logger } from "../infrastructure/logger";
import { VoicePipelineService } from "./voicePipelineService";

export interface RealtimeVoiceTokenCompat {
  tenantId: number;
  callSid: string;
  callId: number;
  expiresAt: number;
  agentId?: number;
  agentMode?: "AI" | "HUMAN" | "BOTH";
  prospectPhone?: string;
  prospectName?: string;
  prospectId?: number;
}

type IncomingWsMessage = {
  event?: string;
  streamSid?: string;
  media?: {
    payload?: string;
  };
};

export class RealtimeVoicePipelineCompat {
  private readonly ws: WebSocket;
  private readonly token: RealtimeVoiceTokenCompat;
  private pipeline: VoicePipelineService | null = null;
  private streamSid: string;

  constructor(ws: WebSocket, token: RealtimeVoiceTokenCompat) {
    this.ws = ws;
    this.token = token;
    this.streamSid = token.callSid;
  }

  async start(): Promise<void> {
    this.pipeline = new VoicePipelineService(this.ws, {
      callId: String(this.token.callId),
      callSid: this.token.callSid,
      streamSid: this.streamSid,
      tenantId: this.token.tenantId,
      prospectPhone: this.token.prospectPhone,
      prospectName: this.token.prospectName,
      prospectId: this.token.prospectId,
    });

    await this.pipeline.start();

    this.ws.on("message", async (raw: WebSocket.RawData) => {
      try {
        const message = JSON.parse(raw.toString()) as IncomingWsMessage;

        if (message.streamSid) {
          this.streamSid = message.streamSid;
        }

        if (message.event === "media" && message.media?.payload && this.pipeline) {
          await this.pipeline.processAudio(message.media.payload);
          return;
        }

        if (message.event === "start") {
          logger.info("[RealtimeVoicePipelineCompat] Flux vocal démarré", {
            callSid: this.token.callSid,
            streamSid: this.streamSid,
          });
          return;
        }

        if (message.event === "stop") {
          await this.stop();
        }
      } catch (error: any) {
        logger.warn("[RealtimeVoicePipelineCompat] Message WebSocket ignoré", {
          error: error?.message ?? String(error),
          callSid: this.token.callSid,
        });
      }
    });

    this.ws.on("close", () => {
      void this.stop();
    });

    this.ws.on("error", (error) => {
      logger.error("[RealtimeVoicePipelineCompat] Erreur WebSocket", {
        error: error instanceof Error ? error.message : String(error),
        callSid: this.token.callSid,
      });
    });
  }

  async stop(): Promise<void> {
    if (!this.pipeline) {
      return;
    }

    const pipeline = this.pipeline;
    this.pipeline = null;
    await pipeline.stop();
    logger.info("[RealtimeVoicePipelineCompat] Flux vocal arrêté", {
      callSid: this.token.callSid,
      streamSid: this.streamSid,
    });
  }
}
