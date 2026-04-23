import { logger } from "../infrastructure/logger";

// Interface locale pour les métriques de pipeline
export interface PipelineMetrics {
  asrLatency: number[];
  llmLatency: number[];
  ttsLatency: number[];
  totalLatency: number[];
}

/**
 * Call Tracing Service
 * Comprehensive logging and tracing for AI voice calls
 * Tracks every stage of the pipeline with detailed metrics
 */

export interface CallTrace {
  callId: string;
  callSid: string;
  streamSid: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'active' | 'completed' | 'failed' | 'transferred';
  
  // Participant info
  caller: {
    phoneNumber?: string;
    name?: string;
    customerId?: string;
  };
  
  // Pipeline stages
  stages: CallStage[];
  
  // Metrics
  metrics: {
    asrLatency: LatencyMetrics;
    llmLatency: LatencyMetrics;
    ttsLatency: LatencyMetrics;
    totalLatency: LatencyMetrics;
  };
  
  // Conversation
  transcriptions: TranscriptionLog[];
  responses: ResponseLog[];
  actions: ActionLog[];
  
  // Sentiment analysis
  sentimentAnalysis?: {
    averageScore: number;
    trend: 'improving' | 'stable' | 'declining';
    escalationCount: number;
    finalSentiment: string;
  };
  
  // Errors
  errors: ErrorLog[];
  
  // Metadata
  metadata: Record<string, any>;
}

export interface CallStage {
  stage: 'initialization' | 'asr' | 'llm' | 'tts' | 'action' | 'sentiment' | 'transfer' | 'completion';
  timestamp: number;
  duration?: number;
  status: 'started' | 'completed' | 'failed';
  details?: any;
}

export interface LatencyMetrics {
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
  count: number;
}

export interface TranscriptionLog {
  timestamp: number;
  text: string;
  confidence: number;
  duration?: number;
  isFinal: boolean;
}

export interface ResponseLog {
  timestamp: number;
  text: string;
  audioSize: number;
  latency: number;
}

export interface ActionLog {
  timestamp: number;
  action: string;
  arguments: any;
  result: any;
  success: boolean;
  latency: number;
  retryCount?: number;
}

export interface ErrorLog {
  timestamp: number;
  stage: string;
  error: string;
  stack?: string;
  recoverable: boolean;
}

export class CallTracingService {
  private trace: CallTrace;
  private stageStartTimes: Map<string, number> = new Map();

  constructor(callId: string, callSid: string, streamSid: string, caller?: any) {
    this.trace = {
      callId,
      callSid,
      streamSid,
      startTime: Date.now(),
      status: 'active',
      caller: caller || {},
      stages: [],
      metrics: {
        asrLatency: this.initLatencyMetrics(),
        llmLatency: this.initLatencyMetrics(),
        ttsLatency: this.initLatencyMetrics(),
        totalLatency: this.initLatencyMetrics(),
      },
      transcriptions: [],
      responses: [],
      actions: [],
      errors: [],
      metadata: {},
    };

    logger.info('[Call Tracing] Tracing started', {
      callId,
      callSid,
      streamSid,
    });

    this.logStage('initialization', 'started');
  }

  /**
   * Log a pipeline stage
   */
  logStage(
    stage: CallStage['stage'],
    status: CallStage['status'],
    details?: any): void {
    const timestamp = Date.now();
  // const _stageKey = `${stage}-${status}`;

    if (status === 'started') {
      this.stageStartTimes.set(stage, timestamp);
    }

    let duration: number | undefined;
    if (status === 'completed' || status === 'failed') {
      const startTime = this.stageStartTimes.get(stage);
      if (startTime) {
        duration = timestamp - startTime;
        this.stageStartTimes.delete(stage);
      }
    }

    this.trace.stages.push({
      stage,
      timestamp,
      duration,
      status,
      details,
    });

    logger.info('[Call Tracing] Stage logged', {
      callId: this.trace.callId,
      stage: stage as unknown,
      status: status as unknown,
      duration: duration as unknown,
    });
  }

  /**
   * Log transcription
   */
  logTranscription(
    text: string,
    confidence: number,
    isFinal: boolean,
    duration?: number
  ): void {
    this.trace.transcriptions.push({
      timestamp: Date.now(),
      text,
      confidence,
      isFinal,
      duration,
    });

    logger.info('[Call Tracing] Transcription logged', {
      callId: this.trace.callId,
      text: text.substring(0, 50),
      confidence,
      isFinal,
    });
  }

  /**
   * Log AI response
   */
  logResponse(text: string, audioSize: number, latency: number): void {
    this.trace.responses.push({
      timestamp: Date.now(),
      text,
      audioSize,
      latency,
    });

    logger.info('[Call Tracing] Response logged', {
      callId: this.trace.callId,
      text: text.substring(0, 50),
      audioSize,
      latency,
    });
  }

  /**
   * Log action execution
   */
  logAction(
    action: string,
    args: any,
    result: any,
    success: boolean,
    latency: number,
    retryCount?: number
  ): void {
    this.trace.actions.push({
      timestamp: Date.now(),
      action,
      arguments: args,
      result,
      success,
      latency,
      retryCount,
    });

    logger.info('[Call Tracing] Action logged', {
      callId: this.trace.callId,
      action,
      success,
      latency,
      retryCount,
    });
  }

  /**
   * Log error
   */
  logError(stage: string, error: Error | string, recoverable: boolean): void {
    const errorMessage = typeof error === 'string' ? error : (error instanceof Error ? error.message : String(error));
    const stack = typeof error === 'string' ? undefined : error.stack;

    this.trace.errors.push({
      timestamp: Date.now(),
      stage,
      error: errorMessage,
      stack,
      recoverable,
    });

    logger.error('[Call Tracing] Error logged', {
      callId: this.trace.callId,
      stage,
      error: errorMessage,
      recoverable,
    });
  }

  /**
   * Update metrics from pipeline
   */
  updateMetrics(pipelineMetrics: PipelineMetrics): void {
    this.trace.metrics.asrLatency = this.calculateLatencyMetrics(
      pipelineMetrics.asrLatency
    );
    this.trace.metrics.llmLatency = this.calculateLatencyMetrics(
      pipelineMetrics.llmLatency
    );
    this.trace.metrics.ttsLatency = this.calculateLatencyMetrics(
      pipelineMetrics.ttsLatency
    );
    this.trace.metrics.totalLatency = this.calculateLatencyMetrics(
      pipelineMetrics.totalLatency
    );

    logger.info('[Call Tracing] Metrics updated', {
      callId: this.trace.callId,
      metrics: {
        avgASR: this.trace.metrics.asrLatency.avg,
        avgLLM: this.trace.metrics.llmLatency.avg,
        avgTTS: this.trace.metrics.ttsLatency.avg,
        avgTotal: this.trace.metrics.totalLatency.avg,
      },
    });
  }

  /**
   * Update sentiment analysis summary
   */
  updateSentimentAnalysis(
    averageScore: number,
    trend: 'improving' | 'stable' | 'declining',
    escalationCount: number,
    finalSentiment: string
  ): void {
    this.trace.sentimentAnalysis = {
      averageScore,
      trend,
      escalationCount,
      finalSentiment,
    };

    logger.info('[Call Tracing] Sentiment analysis updated', {
      callId: this.trace.callId,
      sentimentAnalysis: this.trace.sentimentAnalysis,
    });
  }

  /**
   * Add metadata
   */
  addMetadata(key: string, value: any): void {
    this.trace.metadata[key] = value;
  }

  /**
   * Complete the call trace
   */
  complete(status: 'completed' | 'failed' | 'transferred'): void {
    this.trace.endTime = Date.now();
    this.trace.duration = this.trace.endTime - this.trace.startTime;
    this.trace.status = status;

    this.logStage('completion', 'completed', { finalStatus: status });

    logger.info('[Call Tracing] Call completed', {
      callId: this.trace.callId,
      status: status as unknown,
      duration: this.trace.duration as unknown,
      transcriptionCount: this.trace.transcriptions.length,
      responseCount: this.trace.responses.length,
      actionCount: this.trace.actions.length,
      errorCount: this.trace.errors.length,
    });

    // Log comprehensive summary
    this.logSummary();
  }

  /**
   * Get the complete trace
   */
  getTrace(): CallTrace {
    return { ...this.trace };
  }

  /**
   * Get trace as JSON string
   */
  getTraceJSON(): string {
    return JSON.stringify(this.trace, null, 2);
  }

  /**
   * Log comprehensive summary
   */
  private logSummary(): void {
    const summary = {
      callId: this.trace.callId,
      duration: `${(this.trace.duration! / 1000).toFixed(2)}s`,
      status: this.trace.status,
      
      conversation: {
        transcriptions: this.trace.transcriptions.length,
        responses: this.trace.responses.length,
        actions: this.trace.actions.length,
      },
      
      performance: {
        avgASRLatency: `${this.trace.metrics.asrLatency.avg.toFixed(0)}ms`,
        avgLLMLatency: `${this.trace.metrics.llmLatency.avg.toFixed(0)}ms`,
        avgTTSLatency: `${this.trace.metrics.ttsLatency.avg.toFixed(0)}ms`,
        avgTotalLatency: `${this.trace.metrics.totalLatency.avg.toFixed(0)}ms`,
        p95TotalLatency: `${this.trace.metrics.totalLatency.p95.toFixed(0)}ms`,
      },
      
      sentiment: this.trace.sentimentAnalysis,
      
      reliability: {
        errorCount: this.trace.errors.length,
        successRate: this.calculateSuccessRate(),
      },
    };

    logger.info('[Call Tracing] Call summary', summary as unknown);
  }

  /**
   * Calculate success rate
   */
  private calculateSuccessRate(): string {
    const totalActions = this.trace.actions.length;
    if (totalActions === 0) return 'N/A';

    const successfulActions = this.trace.actions.filter(a => a.success).length;
    const rate = (successfulActions / totalActions) * 100;
    return `${rate.toFixed(1)}%`;
  }

  /**
   * Calculate latency metrics from array
   */
  private calculateLatencyMetrics(latencies: number[]): LatencyMetrics {
    if (latencies.length === 0) {
      return this.initLatencyMetrics();
    }

    const sorted = [...latencies].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);

    return {
      min: sorted[0] ?? 0,
      max: sorted[sorted.length - 1] ?? 0,
      avg: sum / sorted.length,
      p50: this.percentile(sorted, 50),
      p95: this.percentile(sorted, 95),
      p99: this.percentile(sorted, 99),
      count: sorted.length,
    };
  }

  /**
   * Calculate percentile
   */
  private percentile(sorted: number[], p: number): number {
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)] ?? 0;
  }

  /**
   * Initialize empty latency metrics
   */
  private initLatencyMetrics(): LatencyMetrics {
    return {
      min: 0,
      max: 0,
      avg: 0,
      p50: 0,
      p95: 0,
      p99: 0,
      count: 0,
    };
  }
}

/**
 * Global trace storage (in production, use database)
 */
const activeTraces = new Map<string, CallTracingService>();

/**
 * Create a new call trace
 */
export function createCallTrace(
  callId: string,
  callSid: string,
  streamSid: string,
  caller?: any): CallTracingService {
  const trace = new CallTracingService(callId, callSid, streamSid, caller);
  activeTraces.set(callId, trace);
  return trace;
}

/**
 * Get an active trace
 */
export function getCallTrace(callId: string): CallTracingService | undefined {
  return activeTraces.get(callId);
}

/**
 * Complete and remove a trace
 */
export function completeCallTrace(
  callId: string,
  status: 'completed' | 'failed' | 'transferred'
): CallTrace | undefined {
  const trace = activeTraces.get(callId);
  if (trace) {
    trace.complete(status);
    const finalTrace = trace.getTrace();
    activeTraces.delete(callId);
    
    // In production, save to database here
    saveTraceToStorage(finalTrace);
    
    return finalTrace;
  }
  return undefined;
}

/**
 * Save trace to persistent storage (placeholder)
 */
async function saveTraceToStorage(trace: CallTrace): Promise<void> {
  // In production, save to database
  logger.info('[Call Tracing] Trace saved to storage', {
    callId: trace.callId,
    duration: trace.duration as unknown,
    status: trace.status as unknown,
  });
}

/**
 * Get all active traces
 */
export function getActiveTraces(): CallTrace[] {
  return Array.from(activeTraces.values()).map((t: any) => t.getTrace());
}

/**
 * Export trace to file
 */
export function exportTraceToFile(callId: string): string | undefined {
  const trace = activeTraces.get(callId);
  if (trace) {
    return trace.getTraceJSON();
  }
  return undefined;
}
