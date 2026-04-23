import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 }, // Montée progressive à 50 utilisateurs
    { duration: '1m', target: 100 }, // Pic à 100 utilisateurs
    { duration: '30s', target: 0 },   // Descente
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'], // Moins de 1% d'erreurs
    http_req_duration: ['p(95)<500'], // 95% des requêtes sous 500ms
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  // 1. Endpoint public (Health)
  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, {
    'health status is 200': (r) => r.status === 200,
    'health returns json': (r) => r.headers['Content-Type'].includes('application/json'),
  });

  // 2. Endpoint Auth (simulé ou réel si token fourni)
  // Ici on teste la route de login de test si activée
  const loginRes = http.get(`${BASE_URL}/api/oauth/test-login`);
  check(loginRes, {
    'auth status is 200 or 429': (r) => [200, 429].includes(r.status),
  });

  sleep(1);
}
