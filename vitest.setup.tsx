import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { trpc } from './client/src/lib/trpc';
import { httpBatchLink } from '@trpc/client';
import { vi } from 'vitest';
import React from 'react';

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // Deprecated
    removeListener: vi.fn(), // Deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock useAuth hook
vi.mock('./client/src/_core/hooks/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: { id: 'test-user', email: 'test@example.com', role: 'admin', tenantId: 'test-tenant' },
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
    checkAuth: vi.fn(),
  }),
}));

// Mock fetch for CSRF token
vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
  if (typeof input === 'string' && input.endsWith('/api/csrf-token')) {
    return Promise.resolve(new Response(JSON.stringify({ csrfToken: 'mock-csrf-token' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
  }
  // Fallback for other fetch calls if any
  return Promise.reject(new Error(`Unhandled fetch request for: ${input}`));
}));

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: 'http://localhost:3000/trpc',
      // You can add headers or other configurations here if needed
    }),
  ],
});

// The renderWithProviders function will be defined in a separate test-utils file.
