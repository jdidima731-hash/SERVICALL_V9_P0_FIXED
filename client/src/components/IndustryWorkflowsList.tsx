/**
 * INDUSTRY WORKFLOWS LIST
 * Affiche les workflows disponibles pour le métier sélectionné
 * ✅ BLOC 1 : Correction des appels tRPC et de la structure de données
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, CheckCircle2, Loader2  } from 'lucide-react';
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface IndustryWorkflowsListProps {
  industryId: string;
  tenantId: number;
}

export function IndustryWorkflowsList({ industryId, tenantId }: IndustryWorkflowsListProps) {
  const [activatingWorkflow, setActivatingWorkflow] = useState<string | null>(null);
  const utils = trpc.useUtils();

  // Récupérer les workflows du métier
  const { data: workflowsData, isLoading, error, refetch } = (trpc as any).aiAutomation?.industryConfig?.getIndustryWorkflows?.useQuery(
    { industryId },
    { 
      enabled: !!industryId,
      staleTime: 0 
    }
  ) || { data: null, isLoading: false, error: null, refetch: () => {} };

  // Re-fetch quand industryId change
  useEffect(() => {
    if (industryId && refetch) {
      refetch();
    }
  }, [industryId, refetch]);

  // Mutation pour importer un blueprint
  const importBlueprintMutation = (trpc as any).aiAutomation?.workflows?.importBlueprint?.useMutation({
    onSuccess: () => {
      toast.success("✅ Workflow activé avec succès !");
      setActivatingWorkflow(null);
      // Rafraîchir la liste des workflows installés
      
      (utils as any).aiAutomation?.workflow?.list?.invalidate();
    },
    onError: (error: any) => {
      toast.error(`❌ Erreur : ${error.message}`);
      setActivatingWorkflow(null);
    },
  }) || { mutateAsync: async () => {} };

  const handleActivateWorkflow = async (blueprintId: string) => {
    setActivatingWorkflow(blueprintId);
    await importBlueprintMutation.mutateAsync({ 
      blueprintId 
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-yellow-200 bg-yellow-50">
        <CardContent className="pt-6">
          <p className="text-sm text-yellow-800">
            ⚠️ Impossible de charger les workflows pour ce métier ({industryId}).
          </p>
        </CardContent>
      </Card>
    );
  }

  // Extraction correcte des données selon la structure renvoyée par le router
  const workflows: Array<Record<string, unknown>> = Array.isArray(workflowsData)
    ? (workflowsData as Array<Record<string, unknown>>)
    : (((workflowsData as Record<string, unknown>)?.['data']) as Array<Record<string, unknown>>) || [];

  if (workflows.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-6 text-center">
          <Zap className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
          <p className="text-sm text-muted-foreground">
            Aucun workflow prédéfini pour le métier "{industryId}"
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Vous pouvez créer vos propres workflows personnalisés
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary" />
          Modèles disponibles ({industryId})
        </h3>
        <Badge variant="secondary">{workflows.length} modèle(s)</Badge>
      </div>

      <div className="grid gap-4">
        {workflows.map((workflow: Record<string, unknown>) => (
          <Card
            key={workflow.id as string}
            className="border-primary/20 hover:border-primary/40 transition-all"
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-base flex items-center gap-2">
                    {String(workflow.name ?? '')}
                    <Badge variant="outline" className="text-xs">
                      {String(workflow.triggerType ?? '')}
                    </Badge>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {String(workflow.description ?? '')}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex gap-2 flex-wrap">
                  {(workflow.actions as Array<Record<string, unknown>> | undefined)?.map((action: Record<string, unknown>, idx: number) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {String(action.type ?? '')}
                    </Badge>
                  ))}
                </div>
                <Button
                  size="sm"
                  className="gap-2"
                  onClick={() => handleActivateWorkflow(workflow.id as string)}
                  disabled={activatingWorkflow === workflow.id}
                >
                  {activatingWorkflow === workflow.id ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Activation...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Activer ce workflow
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}