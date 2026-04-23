/**
 * Public API routes stub
 */
import { Router } from 'express';

export const publicApiRouter = Router();

publicApiRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

export default publicApiRouter;
