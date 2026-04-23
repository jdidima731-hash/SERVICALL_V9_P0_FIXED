import { ReactNode } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/_core/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Building2  } from 'lucide-react';
import { useLocation } from 'wouter';

interface TenantGuardProps {
  children: ReactNode;
  requireTenant?: boolean;
}

export function TenantGuard({ children, requireTenant = true }: TenantGuardProps) {
  const { tenantId, isReady } = useTenant();
  const { isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();

  // Attendre que l'authentification et le tenant soient prêts
  if (loading || !isReady) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  // Si l'utilisateur n'est pas authentifié, laisser le hook useAuth gérer la redirection
  if (!isAuthenticated) {
    return <>{children}</>;
  }

  // Si un tenant est requis mais absent, afficher un message d'erreur
  if (requireTenant && (tenantId === null || tenantId === undefined)) {
    return (
      <div className="flex items-center justify-center min-h-[400px] p-4">
        <Card className="max-w-md w-full border-destructive/50 shadow-lg">
          <CardHeader>
            <div className="flex items-center gap-2 text-destructive mb-2">
              <AlertCircle className="h-5 w-5" />
              <CardTitle>Entreprise non sélectionnée</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Vous devez sélectionner une entreprise pour accéder à cette page.
            </p>
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => setLocation('/select-tenant')}
                className="w-full"
              >
                <Building2 className="mr-2 h-4 w-4" />
                Sélectionner une entreprise
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
