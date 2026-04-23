/**
 * =====================================================================
 * TEST ANTI-BYPASS RLS HARDENING CANONICAL
 * =====================================================================
 * Ce test garantit que le RLS est fail-closed et qu'aucun accès
 * cross-tenant n'est possible.
 * =====================================================================
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';
import { dbManager } from '../services/dbManager';
import { withTenantContext, withBootstrapContext } from '../services/requestDbContext';
import * as schema from '../../drizzle/schema';

describe('RLS Hardening Canonical Contract', () => {
  let db: any;

  beforeAll(async () => {
    db = dbManager.db;
  });

  afterAll(async () => {
    // Cleanup if needed
  });

  it('1. Isolation tenant : user A ne peut pas voir les données du tenant 2', async () => {
    // Simulation : user A (id=1) accède au tenant 1
    await withTenantContext({ userId: 1, tenantId: 1 }, async (tx) => {
      // Insertion d'un prospect dans le tenant 1
      await tx.insert(schema.prospects).values({
        tenantId: 1,
        firstName: 'Prospect Tenant 1',
        lastName: 'Test',
        email: 'test1@example.com',
        phone: '+33600000001',
        status: 'new'
      }).onConflictDoNothing();

      // Insertion d'un prospect dans le tenant 2 (devrait échouer ou être ignoré par RLS)
      try {
        await tx.insert(schema.prospects).values({
          tenantId: 2,
          firstName: 'Prospect Tenant 2',
          lastName: 'Test',
          email: 'test2@example.com',
          phone: '+33600000002',
          status: 'new'
        });
      } catch (e) {
        // Expected RLS violation
      }

      // Lecture : ne doit retourner que les prospects du tenant 1
      const prospects = await tx.select().from(schema.prospects);
      expect(prospects.every((p: any) => p.tenantId === 1)).toBe(true);
    });
  });

  it('2. getUserTenants bootstrap : fonctionne sans tenant actif mais respecte RLS', async () => {
    // Simulation : auth initiale pour user 1
    await withBootstrapContext(1, async (tx) => {
      // Lecture de tenant_users : ne doit retourner que les associations de l'user 1
      const tenantUsers = await tx.select().from(schema.tenantUsers);
      expect(tenantUsers.every((tu: any) => tu.userId === 1)).toBe(true);
    });
  });

  it('3. Fail-closed RLS : requête sans tenant_id échoue', async () => {
    // Exécution hors contexte transactionnel RLS
    try {
      await db.select().from(schema.prospects);
      expect.fail('La requête aurait dû échouer (RLS fail-closed)');
    } catch (error: any) {
      expect(error.message).toMatch(/RLS_ERROR|permission denied|row level security/i);
    }
  });

  it('4. Fail-closed RLS : requête sans user_id échoue', async () => {
    // Exécution hors contexte transactionnel RLS
    try {
      await db.select().from(schema.users);
      expect.fail('La requête aurait dû échouer (RLS fail-closed)');
    } catch (error: any) {
      expect(error.message).toMatch(/RLS_ERROR|permission denied|row level security/i);
    }
  });

  it('5. Transaction safety : SET LOCAL ne fuit pas', async () => {
    // Contexte 1
    await withTenantContext({ userId: 1, tenantId: 1 }, async (tx) => {
      const res = await tx.execute(sql`SELECT current_setting('app.tenant_id', true) as tid`);
      expect(res[0].tid).toBe('1');
    });

    // Hors contexte, la valeur doit être vide ou null
    const resOutside = await db.execute(sql`SELECT current_setting('app.tenant_id', true) as tid`);
    expect(resOutside[0].tid).toBe('');
  });
});
