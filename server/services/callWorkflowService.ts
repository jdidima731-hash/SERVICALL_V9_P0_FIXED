import * as db from "../db";
import * as aiService from "./aiService";
import * as recordingService from "./recordingService";
import { retryWithBackoff } from "./errorHandlingService";
import { logger } from "../infrastructure/logger";
import { metrics } from "./metricsService";

/**
 * Call Workflow Service - Gère le traitement automatique après un appel
 */

export interface CallProcessingResult {
  callId: number;
  transcription: string;
  summary: string;
  recordingUrl: string;
  sentiment: string;
  qualityScore: number;
}

/**
 * Process a completed call:
 * 1. Download recording from Twilio
 * 2. Upload to S3
 * 3. Transcribe with Whisper
 * 4. Summarize with GPT-4
 * 5. Analyze quality and sentiment
 * 6. Update database
 */
export async function processCompletedCall(
  callId: number,
  twilioRecordingUrl: string
): Promise<CallProcessingResult> {
  const startTime = Date.now();
  try {
    logger.info(`[Call Workflow] Starting processing for call ${callId}`, { module: "WORKFLOW", callId });

    // 1. Get call details from DB
    
    const call = await db.getCallById(callId);
    if (!call) {
      throw new Error(`Call ${callId} not found in database`);
    }

    // 2. Download from Twilio and Store in S3 (with Retry)
    logger.info(`[Call Workflow] Storing recording for call ${callId} in S3`, { module: "WORKFLOW", callId, tenantId: call.tenantId });
    const { key, url: s3Url } = await retryWithBackoff(
      () => recordingService.downloadAndStoreRecording(
        twilioRecordingUrl,
        call.tenantId,
        callId
      ),
      { maxRetries: 3, initialDelayMs: 2000 }
    );

    // 3. Transcribe with Whisper (with Retry)
    logger.info(`[Call Workflow] Transcribing call ${callId}`, { module: "WORKFLOW", callId, tenantId: call.tenantId });
    const transcription = await retryWithBackoff(
      () => aiService.transcribeCallRecording(s3Url),
      { maxRetries: 2, initialDelayMs: 3000 }
    );

    // 4. Generate Summary with GPT-4
    logger.info(`[Call Workflow] Generating summary for call ${callId}`, { module: "WORKFLOW", callId, tenantId: call.tenantId });
    const summary = await aiService.generateCallSummary(transcription, {
      duration: call.duration ?? 0,
      callReason: "Appel client", 
      prospectName: "Client", 
    });

    // 5. Analyze Quality and Sentiment
    logger.info(`[Call Workflow] Analyzing quality for call ${callId}`, { module: "WORKFLOW", callId, tenantId: call.tenantId });
    const analysis = await aiService.analyzeCallQuality(transcription);

    // 6. Update Call in Database
    logger.info(`[Call Workflow] Updating database for call ${callId}`, { module: "WORKFLOW", callId, tenantId: call.tenantId });
    
    await db.updateCall(callId, {
      status: "completed",
      recordingUrl: s3Url,
      recordingKey: key,
      transcription,
      summary,
      qualityScore: analysis.qualityScore.toString(),
      sentiment: analysis.sentiment,
    });

    // 7. Update Prospect Notes and Campaign Status if applicable
    if (call.prospectId) {
      
      const prospect = await db.getProspectById(call.prospectId);
      if (prospect) {
        const updatedNotes = `${prospect.notes ?? ""}\n\n--- Résumé d'appel (${new Date().toLocaleDateString()}) ---\n${summary}`;
        
        await db.updateProspect(call.prospectId, {
          notes: updatedNotes,
          status: "contacted",
        });

        // ✅ Synchronisation avec les campagnes en cours
        if (call.campaignId) {
          const { campaignProspects } = await import("../../drizzle/schema-campaigns");
          const { eq, and } = await import("drizzle-orm");
          const database = await db.getDb();
          await database
            .update(campaignProspects)
            .set({ 
              status: "completed", 
              completedAt: new Date(),
              notes: `Appel réussi. Résumé: ${summary.substring(0, 200)}...`
            })
            .where(
              and(
                eq(campaignProspects.campaignId, call.campaignId),
                eq(campaignProspects.prospectId, call.prospectId)
              )
            );
          logger.info(`[Call Workflow] Campaign prospect updated to completed`, { 
            callId, 
            campaignId: call.campaignId, 
            prospectId: call.prospectId 
          });
        }
      }
    }

    const totalDuration = Date.now() - startTime;
    metrics.recordBusinessMetric("call_processing_duration", totalDuration, "ms", call.tenantId);
    metrics.recordBusinessMetric("call_processed_count", 1, "count", call.tenantId);

    return {
      callId,
      transcription,
      summary,
      recordingUrl: s3Url,
      sentiment: analysis.sentiment,
      qualityScore: analysis.qualityScore,
    };
  } catch (error: any) {
    logger.error(`[Call Workflow] Error processing call ${callId}:`, error, { module: "WORKFLOW", callId });
    
    // Update call status to failed in case of error
    
    await db.updateCall(callId, { status: "failed" }).catch(() => {});
    
    throw error;
  }
}