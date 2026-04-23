declare module '@opentelemetry/sdk-node' { export class NodeSDK { constructor(config?: any); start(): void; } }
declare module '@opentelemetry/auto-instrumentations-node' { export function getNodeAutoInstrumentations(config?: any): any[]; }
declare module '@opentelemetry/exporter-trace-otlp-http' { export class OTLPTraceExporter { constructor(config?: any); } }
declare module '@opentelemetry/resources' { export class Resource { static default(): any; constructor(attrs: any); } }
declare module '@opentelemetry/semantic-conventions' { export const SEMRESATTRS_SERVICE_NAME: string; export const SEMRESATTRS_SERVICE_VERSION: string; }
