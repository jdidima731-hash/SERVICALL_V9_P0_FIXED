
import { trpc, RouterOutputs } from "@/lib/trpc";
import { toast } from "sonner";

type TenantOutput = RouterOutputs["core"]["auth"]["myTenants"][number];
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";

export function TenantSelector() {
  const { t } = useTranslation(['common']);
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const {data: tenants} = trpc.core.auth.myTenants.useQuery();

  if (!user || !tenants || tenants.length === 0) {
    return null;
  }

  // BLOC P1 : Le tenantId est gere par le backend (cookie)
  const { tenantId: currentTenantId } = useTenant();

  const switchTenantMutation = trpc.core.tenant.switchTenant.useMutation({
    onSuccess: (data: any) => {
      // Une fois le cookie mis à jour, on redirige
      setLocation(`/dashboard`);
      // Recharger pour s'assurer que tout le contexte est frais
      window.location.reload();
    },
    onError: (error) => {
      toast.error(`Erreur lors du changement d'espace : ${error.message}`);
    }
  });

  const handleTenantChange = async (tenantId: string) => {
    const id = parseInt(tenantId);
    if (!isNaN(id)) {
      await switchTenantMutation.mutateAsync({ tenantId: id });
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={currentTenantId?.toString() || ""} onValueChange={handleTenantChange}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder={t('common:placeholders.select_workspace', 'Sélectionner un espace de travail')} />
        </SelectTrigger>
        <SelectContent>
          {tenants
            .map((item: TenantOutput) => (
              <SelectItem key={item.id} value={item.id.toString()}>
                <div className="flex items-center gap-2">
                  
                  {item.logo && (
                    <img
                      
                      src={item.logo as string}
                      alt={item.name as string}
                      className="w-4 h-4 rounded"
                    />
                  )}
                  <span>{item.name as string}</span>
                  <span className="text-xs text-muted-foreground">
                    ({item.role as string})
                  </span>
                </div>
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    </div>
  );
}