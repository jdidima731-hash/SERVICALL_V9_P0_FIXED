declare namespace Express {
  export interface Request {
    tenantId?: number;
    apiKeyTenantId?: number;
    rawBody?: Buffer;
  }
}
