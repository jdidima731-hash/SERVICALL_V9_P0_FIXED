import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'jsdom',
    setupFiles: './vitest.setup.tsx',
    // ✅ FIX P2 : inclure les tests serveur (contrats statiques) + tests client
    include: [
      'client/**/*.{test,spec}.?(c|m)[jt]s?(x)',
      // Tests serveur statiques (pas de DB) — contrats de cohérence
      'server/tests/action-types-contract.test.ts',
      'server/tests/rbac-guards.test.ts',
      'server/tests/tenant-db-guards.test.ts',
    ],
    // Les tests nécessitant une vraie DB (rls, tenant-isolation) restent hors scope jsdom
    exclude: [
      'server/tests/rls-hardening-contract.test.ts',
      'server/tests/tenant-isolation-p1.test.ts',
    ],
  },
});
