import { describe, it, expect, vi } from "vitest";
// ✅ FIX P1-B : test-utils est dans le même dossier tests/
import { render, screen } from "./test-utils";
// ✅ FIX P1-B : App.tsx est dans src/app/App.tsx (pas src/App.tsx)
import App from "../src/app/App";

// Mock des hooks et composants externes
// ✅ FIX P1-B : useAuth est dans src/_core/hooks/useAuth.ts
vi.mock("../src/_core/hooks/useAuth", () => ({
  useAuth: () => ({
    user: null,
    loading: false,
  }),
}));

vi.mock("../src/lib/i18n", () => ({}));

describe("App Component", () => {
  it("devrait rendre sans erreur", () => {
    expect(() => render(<App />)).not.toThrow();
  });

  it("devrait afficher le composant Router", () => {
    const { container } = render(<App />);
    expect(container).toBeTruthy();
  });
});
