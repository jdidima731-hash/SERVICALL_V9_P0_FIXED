/**
 * =====================================================================
 * TEST ISOLATION MULTI-TENANT (BLOC P1)
 * =====================================================================
 * Ce test garantit que l'isolation multi-tenant est strictement gérée
 * par le backend (RLS) et que les tentatives d'injection manuelle
 * de tenantId par le client sont inopérantes ou rejetées.
 * =====================================================================
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { dbManager } from '../services/dbManager';
import { withTenantContext } from '../services/requestDbContext';
import * as schema from '../../drizzle/schema';
import { eq, and } from 'drizzle-orm';

describe('Isolation Multi-Tenant (BLOC P1)', () => {
  let db: any;

  beforeAll(async () => {
    db = dbManager.db;
  });

  it('P1-1 : Un utilisateur ne peut pas accéder aux données d\'un autre tenant via injection RLS', async () => {
    // User 1 appartient au Tenant 1
    // User 1 tente d'accéder au Tenant 2 (auquel il n'appartient pas)
    
    // Simulation du middleware RLS qui résoudrait le tenantId depuis le cookie
    // Ici on teste directement la couche service/DB avec le contexte RLS forcé
    
    await withTenantContext({ userId: 1, tenantId: 1 }, async (tx) => {
      // Lecture des prospects : RLS doit filtrer automatiquement
      const prospects = await tx.select().from(schema.prospects);
      
      // Vérification : tous les prospects retournés DOIVENT appartenir au tenant 1
      const hasOtherTenantData = prospects.some((p: any) => p.tenantId !== 1);
      expect(hasOtherTenantData).toBe(false);
    });
  });

  it('P1-2 : Une tentative d\'insertion dans un autre tenant est bloquée par RLS', async () => {
    await withTenantContext({ userId: 1, tenantId: 1 }, async (tx) => {
      try {
        // Tentative d'insertion malveillante dans le tenant 2
        await tx.insert(schema.prospects).values({
          tenantId: 2,
          firstName: 'Hacker',
          lastName: 'Test',
          email: 'hacker@example.com',
          phone: '+33600000000',
          status: 'new'
        });
        
        // Si l'insertion réussit, on vérifie si elle a été "redressée" par RLS ou si elle a échoué
        const inserted = await tx.select().from(schema.prospects).where(eq(schema.prospects.email, 'hacker@example.com'));
        
        if (inserted.length > 0) {
           // Si inséré, il DOIT être dans le tenant 1 (redressement RLS via DEFAULT ou trigger)
           // Ou alors RLS aurait dû lever une erreur si la policy est RESTRICTIVE
           expect(inserted[0].tenantId).toBe(1);
        }
      } catch (error: any) {
        // Succès du test : RLS a bloqué l'insertion (Violation de policy)
        expect(error.message).toMatch(/permission denied|row level security/i);
      }
    });
  });

  it('P1-3 : Le contexte RLS est réinitialisé après chaque transaction (No Leak)', async () => {
    // Transaction 1 : Tenant 1
    await withTenantContext({ userId: 1, tenantId: 1 }, async (tx) => {
      const tid = await tx.execute(sql`SELECT current_setting('app.tenant_id')`);
      expect(tid[0].current_setting).toBe('1');
    });

    // Transaction 2 : Tenant 2
    await withTenantContext({ userId: 2, tenantId: 2 }, async (tx) => {
      const tid = await tx.execute(sql`SELECT current_setting('app.tenant_id')`);
      expect(tid[0].current_setting).toBe('2');
    });

    // Hors transaction : Pas de tenant_id
    try {
      await db.execute(sql`SELECT current_setting('app.tenant_id')`);
      // current_setting sans le 2ème paramètre 'true' lève une erreur si la variable n'est pas définie
      expect.fail('Devrait lever une erreur car app.tenant_id n\'est pas défini hors transaction');
    } catch (error: any) {
      expect(error.message).toMatch(/unrecognized configuration parameter "app.tenant_id"/);
    }
  });
});

import { sql } from 'drizzle-orm';
