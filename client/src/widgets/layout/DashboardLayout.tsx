import { useAuth } from "@/entities/user/model/useAuth";
import { SidebarProvider } from "@/shared/ui/sidebar";
import { SidebarWidget } from "@/widgets/sidebar/SidebarWidget";
import { LoadingFallback } from "@/shared/ui/loading-state";
import { ReactNode } from "react";

export function DashboardLayout({ children }: { children: ReactNode }) {
  const { loading, user } = useAuth();

  if (loading) return <LoadingFallback />;
  if (!user) return <div>Auth Required</div>; // À remplacer par un composant dédié

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full">
        <SidebarWidget />
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}
