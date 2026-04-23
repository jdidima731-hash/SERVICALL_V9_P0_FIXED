/**
 * Page /admin — Dashboard Administration Servicall CRM
 * ✅ CORRECTION: Route /admin créée pour résoudre le 404
 * Ce composant sert de point d'entrée public à la route /admin.
 * Il réexporte AdminDashboard pour assurer la compatibilité avec le router.
 */
import { AdminDashboard } from "./AdminDashboard";

export default function AdminPage() {
  return (
    <div data-main-content>
      <AdminDashboard />
    </div>
  );
}
