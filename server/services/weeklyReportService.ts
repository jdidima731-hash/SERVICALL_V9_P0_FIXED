/**
 * WEEKLY REPORT SERVICE
 * Génération et envoi des rapports hebdomadaires aux tenants actifs
 */

import { logger } from "../infrastructure/logger";
import { getDbInstance } from "../db";
import { tenants, tenantUsers, users, calls, appointments } from "../../drizzle/schema";
import { eq, and, gte, sql, desc } from "drizzle-orm";

interface WeeklyStats {
  totalCalls: number;
  totalAppointments: number;
  conversionRate: number;
  topAgent: string | null;
}

async function getWeeklyStats(tenantId: number): Promise<WeeklyStats> {
  const db = getDbInstance();
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  // 1. Nombre total d'appels de la semaine
  const callsResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(calls)
    .where(and(eq(calls.tenantId, tenantId), gte(calls.createdAt, oneWeekAgo)));
  
  const totalCalls = callsResult[0]?.count || 0;

  // 2. Nombre total de rendez-vous de la semaine
  const appointmentsResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(appointments)
    .where(and(eq(appointments.tenantId, tenantId), gte(appointments.createdAt, oneWeekAgo)));
  
  const totalAppointments = appointmentsResult[0]?.count || 0;

  // 3. Taux de conversion (RDV / Appels)
  const conversionRate = totalCalls > 0 ? (totalAppointments / totalCalls) * 100 : 0;

  // 4. Meilleur agent (celui qui a le plus de RDV)
  const topAgentResult = await db
    .select({ name: users.name })
    .from(appointments)
    .innerJoin(users, eq(users.id, appointments.userId))
    .where(and(eq(appointments.tenantId, tenantId), gte(appointments.createdAt, oneWeekAgo)))
    .groupBy(users.name)
    .orderBy(desc(sql`count(*)`))
    .limit(1);

  const topAgent = topAgentResult[0]?.name || null;

  return {
    totalCalls,
    totalAppointments,
    conversionRate,
    topAgent,
  };
}

async function sendReportToTenant(
  tenantId: number,
  tenantName: string,
  ownerEmail: string,
  stats: WeeklyStats
): Promise<void> {
  // Import dynamique pour éviter les dépendances circulaires
  const { SendEmailAction } = await import("../workflow-engine/actions/messaging/SendEmailAction");
  const { WorkflowExecutor } = await import("../workflow-engine/core/WorkflowExecutor");

  // Create a dummy context for the action execution
  const dummyContext = {
    tenantId,
    logger,
    // Add other necessary context properties if SendEmailAction requires them
  } as unknown;

  const sendEmailAction = new SendEmailAction();
  await sendEmailAction.execute(dummyContext, {
    to: ownerEmail,
    subject: `📊 Rapport hebdomadaire — ${tenantName}`,
    body: `
      <h2>Votre rapport hebdomadaire Servicall</h2>
      <p>Bonjour,</p>
      <p>Voici le résumé de la semaine pour <strong>${tenantName}</strong> :</p>
      <ul>
        <li>📞 Appels traités : <strong>${stats.totalCalls}</strong></li>
        <li>📅 Rendez-vous pris : <strong>${stats.totalAppointments}</strong></li>
        <li>📈 Taux de conversion : <strong>${stats.conversionRate.toFixed(1)}%</strong></li>
        ${stats.topAgent ? `<li>🏆 Meilleur agent : <strong>${stats.topAgent}</strong></li>` : ""}
      </ul>
      <p>Bonne semaine,<br/>L'équipe Servicall</p>
    `,
  }).catch((err: any) => {
    logger.warn("[WeeklyReport] Email send failed", { tenantId, err });
  });
}

export const WeeklyReportService = {
  async sendToAllActiveTenants(): Promise<void> {
    logger.info("[WeeklyReport] Starting weekly report distribution");
    try {
      const db = getDbInstance();

      // Récupérer tous les tenants actifs avec leur propriétaire
      const activeTenants = await (db as unknown)
        .select({
          id: tenants.id,
          name: tenants.name,
          ownerEmail: users.email,
        })
        .from(tenants)
        .innerJoin(tenantUsers, and(
          eq(tenantUsers.tenantId, tenants.id),
          eq(tenantUsers.role, "owner"),
          eq(tenantUsers.isActive, true),
        ))
        .innerJoin(users, eq(users.id, tenantUsers.userId))
        .where(eq(tenants.isActive, true));

      logger.info(`[WeeklyReport] Sending to ${activeTenants.length} tenant(s)`);

      for (const tenant of activeTenants) {
        try {
          const stats = await getWeeklyStats(tenant.id);
          await sendReportToTenant(tenant.id, tenant.name, tenant.ownerEmail, stats);
          logger.info("[WeeklyReport] Report sent", { tenantId: tenant.id });
        } catch (err: any) {
          logger.error("[WeeklyReport] Failed for tenant", { tenantId: tenant.id, err });
        }
      }

      logger.info("[WeeklyReport] Distribution complete");
    } catch (error: any) {
      logger.error("[WeeklyReport] Fatal error", { error });
      throw error;
    }
  },
};
