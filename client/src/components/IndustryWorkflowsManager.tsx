
/**
 * INDUSTRY WORKFLOWS MANAGER
 * Gère la sélection automatique des workflows pour un métier
 * Permet à l'utilisateur d'ajouter/supprimer des workflows avant import
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Zap, CheckCircle2, Loader2, Plus, Trash2, AlertCircle  } from 'lucide-react';
import { trpc, RouterOutputs } from "@/lib/trpc";
import { toast } from "sonner";


type WorkflowOutput = RouterOutputs["industryConfig"]["getIndustryWorkflows"]["data"][number];

interface IndustryWorkflowsManagerProps {
  industryId: string;
  tenantId: number;
  onWorkflowsSelected?: (workflowIds: string[]) => void;
}

export function IndustryWorkflowsManager({
  industryId,
  
  _unusedTenantId,
  onWorkflowsSelected,
}: IndustryWorkflowsManagerProps) {
  const [selectedWorkflows, setSelectedWorkflows] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const utils = trpc.useUtils();

  // Récupérer les workflows du métier
  const { data: workflowsData, isLoading, error, refetch } = trpc.aiAutomation.industryConfig.getIndustryWorkflows.useQuery(
    { industryId },
    { enabled: !!industryId, staleTime: 0 }
  );

  // Récupérer la configuration actuelle du tenant
  const { data: _currentConfig } = trpc.aiAutomation.industryConfig.getCurrentConfig.useQuery();

  // ✅ FIX A3 — Mutation unique : importe tous les blueprints du métier en un appel
  const importBlueprintsForIndustryMutation = trpc.aiAutomation.workflow.importBlueprintsForIndustry.useMutation({
    onSuccess: (data: any) => {
      if (data.failed === 0) {
        toast.success(`✅ ${data.imported} workflow(s) activé(s) avec succès !`);
      } else {
        toast.warning(`⚠️ ${data.imported} importé(s), ${data.failed} échoué(s). Vérifiez les logs.`);
      }
      setIsImporting(false);
      setIsOpen(false);
      
      utils.aiAutomation.workflow.list.invalidate();
      onWorkflowsSelected?.(selectedWorkflows);
    },
    onError: (error) => {
      toast.error(`❌ Erreur : ${error.message}`);
      setIsImporting(false);
    },
  });

  // Conserver l'ancienne mutation pour la compatibilité des autres composants
  const _importBlueprintMutation = trpc.aiAutomation.workflow.importBlueprint.useMutation({
    onSuccess: () => {
      toast.success("✅ Workflow activé avec succès !");
      
      utils.aiAutomation.workflow.list.invalidate();
    },
    onError: (error) => {
      toast.error(`❌ Erreur : ${error.message}`);
    },
  });

  // Auto-sélectionner les workflows recommandés au chargement
  useEffect(() => {
    if (industryId && refetch) {
      refetch();
    }
  }, [industryId, refetch]);

  // Initialiser avec les workflows recommandés du métier
  useEffect(() => {
    if (workflowsData?.data && Array.isArray(workflowsData.data)) {
      const workflowIds = workflowsData.data.map((w) => w.id);
      setSelectedWorkflows(workflowIds);
    }
  }, [workflowsData]);

  const workflows: WorkflowOutput[] = workflowsData?.data || [];

  const handleToggleWorkflow = (workflowId: string) => {
    setSelectedWorkflows((prev) =>
      prev.includes(workflowId)
        ? prev.filter((id: any) => id !== workflowId)
        : [...prev, workflowId]
    );
  };

  const handleImportSelected = async () => {
    if (selectedWorkflows.length === 0) {
      toast.error("Veuillez sélectionner au moins un workflow");
      return;
    }

    setIsImporting(true);
    try {
      // ✅ FIX A3 — un seul appel serveur pour tous les blueprints sélectionnés
      await importBlueprintsForIndustryMutation.mutateAsync({
        industryId,
        blueprintIds: selectedWorkflows,
      });
    } catch (err: any) {
      console.error("Failed to import workflows:", err);
    } finally {
      setIsImporting(false);
    }
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
          <div className="flex items-center gap-2 text-yellow-800">
            <AlertCircle className="w-5 h-5" />
            <p className="text-sm">
              ⚠️ Impossible de charger les workflows pour ce métier.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (workflows.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-6 text-center">
          <Zap className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
          <p className="text-sm text-muted-foreground">
            Aucun workflow prédéfini pour ce métier
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              <CardTitle className="text-base">
                Workflows recommandés ({selectedWorkflows.length}/{workflows.length})
              </CardTitle>
            </div>
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Plus className="w-4 h-4" />
                  Gérer
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Sélectionner les workflows</DialogTitle>
                  <DialogDescription>
                    Choisissez les workflows à activer pour ce métier. Les workflows sélectionnés seront importés automatiquement.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <ScrollArea className="h-[400px] border rounded-lg p-4">
                    <div className="space-y-3">
                      {workflows.map((workflow: WorkflowOutput) => (
                        <div
                          key={workflow.id}
                          className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                        >
                          <Checkbox
                            id={workflow.id}
                            checked={selectedWorkflows.includes(workflow.id)}
                            onCheckedChange={() => handleToggleWorkflow(workflow.id)}
                            className="mt-1"
                          />
                          <div className="flex-1 min-w-0">
                            <Label
                              htmlFor={workflow.id}
                              className="text-sm font-medium cursor-pointer"
                            >
                              {workflow.name}
                            </Label>
                            <p className="text-xs text-muted-foreground mt-1">
                              {workflow.description}
                            </p>
                            <div className="flex gap-2 mt-2 flex-wrap">
                              <Badge variant="outline" className="text-xs">
                                {workflow.triggerType}
                              </Badge>
                              {workflow.actions?.slice(0, 2).map((action: Record<string, unknown>, idx: number) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  
                                  {String(action.type)}
                                </Badge>
                              ))}
                              {workflow.actions?.length > 2 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{workflow.actions.length - 2} actions
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      onClick={() => setIsOpen(false)}
                    >
                      Annuler
                    </Button>
                    <Button
                      onClick={handleImportSelected}
                      disabled={selectedWorkflows.length === 0 || isImporting}
                      className="gap-2"
                    >
                      {isImporting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Import en cours...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          Importer {selectedWorkflows.length} workflow(s)
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {selectedWorkflows.length > 0 ? (
              workflows
                .filter((w: WorkflowOutput) => selectedWorkflows.includes(w.id))
                .map((workflow: WorkflowOutput) => (
                  <Badge key={workflow.id} variant="secondary" className="flex items-center gap-1">
                    {workflow.name}
                    <button
                      onClick={() => handleToggleWorkflow(workflow.id)}
                      className="ml-1 hover:text-destructive"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </Badge>
                ))
            ) : (
              <p className="text-sm text-muted-foreground">Aucun workflow sélectionné</p>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedWorkflows.length > 0 && (
        <div className="flex gap-2">
          <Button
            onClick={handleImportSelected}
            disabled={isImporting}
            className="gap-2 flex-1"
          >
            {isImporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Import en cours...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Importer les workflows sélectionnés
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}