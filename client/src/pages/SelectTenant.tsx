import { useState } from "react";
import { useTenant } from "@/contexts/TenantContext";
import { Building2, ChevronRight, Loader2  } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

/**
 * BLOC 1: Page de Sélection d'Entreprise (Tenant)
 * Permet à l'utilisateur de choisir le tenant sur lequel il souhaite travailler
 *
 * ✅ FIX CRITIQUE: Après switchTenant, on force un rechargement complet (window.location.href)
 * pour que le cookie servicall_tenant soit bien lu par le serveur et que le cache
 * tRPC auth.me soit réinitialisé avec le tenantId correct.
 */
export default function SelectTenant() {
  const { setTenantId } = useTenant();
  const [selectedTenantId, setSelectedTenantId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Récupérer la liste des tenants auxquels l'utilisateur a accès
  const { data: tenants, isLoading: isLoadingTenants } = trpc.core.tenant.list.useQuery();

  // ✅ FIX CRITIQUE: Appel API switchTenant pour créer le cookie de session tenant
  const switchTenantMutation = trpc.core.tenant.switchTenant.useMutation({
    onSuccess: () => {
      toast.success("Entreprise sélectionnée avec succès");
      // ✅ FIX: Forcer un rechargement complet pour que le cookie tenant soit lu
      // et que le cache tRPC auth.me soit réinitialisé avec le tenantId correct.
      // Sans ce rechargement, user reste null dans DashboardLayout et le menu est vide.
      window.location.href = "/dashboard";
    },
    onError: (error) => {
      toast.error("Erreur lors de la sélection de l'entreprise: " + error.message);
      setIsLoading(false);
      setSelectedTenantId(null);
    },
  });

  const handleSelectTenant = async (tenantId: number) => {
    try {
      setIsLoading(true);
      setSelectedTenantId(tenantId);

      // Mettre à jour le contexte tenant local
      setTenantId(tenantId);

      // ✅ FIX: Appel API pour créer le cookie servicall_tenant côté serveur
      await switchTenantMutation.mutateAsync({ tenantId });
    } catch (_error) {
      // Géré par onError du mutation
    }
  };

  // Si aucun tenant n'est disponible
  if (!isLoadingTenants && (!tenants || tenants.length === 0)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-amber-100 rounded-lg">
                <Building2 className="w-6 h-6 text-amber-600" />
              </div>
            </div>
            <CardTitle>Aucune Entreprise Disponible</CardTitle>
            <CardDescription>
              Aucune entreprise n'a été associée à votre compte.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Veuillez contacter l'administrateur pour ajouter votre compte à une entreprise.
            </p>
            <Button
              variant="outline"
              onClick={() => { window.location.href = "/login"; }}
              className="w-full"
            >
              Retour à la Connexion
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-primary/10 rounded-lg">
              <Building2 className="w-8 h-8 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl font-black mb-2">Sélectionnez une Entreprise</h1>
          <p className="text-muted-foreground">
            Choisissez l'entreprise sur laquelle vous souhaitez travailler
          </p>
        </div>

        {/* Loading State */}
        {isLoadingTenants ? (
          <div className="flex justify-center items-center py-12">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-muted-foreground">Chargement des entreprises...</p>
            </div>
          </div>
        ) : (
          /* Tenants Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tenants?.map((tenant) => (
              <Card
                key={tenant.id}
                className="cursor-pointer hover:shadow-lg transition-shadow hover:border-primary"
                onClick={() => handleSelectTenant(tenant.id)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{tenant.name}</CardTitle>
                      <CardDescription className="text-xs mt-1">
                        {tenant.slug}
                      </CardDescription>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent>
                  <Button
                    className="w-full"
                    disabled={isLoading && selectedTenantId === tenant.id}
                    onClick={(e: any) => {
                      e.stopPropagation();
                      handleSelectTenant(tenant.id);
                    }}
                  >
                    {isLoading && selectedTenantId === tenant.id ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sélection...
                      </>
                    ) : (
                      <>
                        <ChevronRight className="w-4 h-4 mr-2" />
                        Sélectionner
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>Vous pouvez changer d'entreprise à tout moment depuis les paramètres.</p>
        </div>
      </div>
    </div>
  );
}
