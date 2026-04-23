import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useQueryState } from "@/_core/hooks/useQueryState";
import { QueryStateRenderer } from "@/components/QueryStateRenderer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Zap, Users, ArrowRightLeft, Plus, Play, Pause, Trash2  } from 'lucide-react';
import { toast } from "sonner";

export default function WorkflowsAndAgentSwitch() {
  const [, _setLocation] = useLocation();
  const [_selectedWorkflow, _setSelectedWorkflow] = useState<number | null>(null);

  // Queries
  const workflowsQuery = trpc.aiAutomation?.workflow?.list?.useQuery({}) || { data: null, isLoading: false, refetch: () => {} };
  const agentSwitchQuery = trpc.aiAutomation?.agentSwitch?.getConfig?.useQuery() || { data: null, isLoading: false, refetch: () => {} };

  // Mutations
  const toggleWorkflowMutation = trpc.aiAutomation?.workflow?.update?.useMutation({
    onSuccess: () => {
      toast.success("Workflow mis à jour");
      workflowsQuery.refetch();
    },
    onError: (error: any) => {
      toast.error(`Erreur: ${error.message}`);
    },
  }) || { mutate: () => {}, mutateAsync: async () => {} };

  const deleteWorkflowMutation = trpc.aiAutomation?.workflow?.delete?.useMutation({
    onSuccess: () => {
      toast.success("Workflow supprimé");
      workflowsQuery.refetch();
    },
    onError: (error: any) => {
      toast.error(`Erreur: ${error.message}`);
    },
  }) || { mutate: () => {}, mutateAsync: async () => {} };

  const updateAgentSwitchMutation = trpc.aiAutomation?.agentSwitch?.updateConfig?.useMutation({
    onSuccess: () => {
      toast.success("Configuration mise à jour");
      agentSwitchQuery.refetch();
    },
    onError: (error: any) => {
      toast.error(`Erreur: ${error.message}`);
    },
  }) || { mutate: () => {}, mutateAsync: async () => {} };

  const workflowsState = useQueryState(workflowsQuery);
  const agentSwitchState = useQueryState(agentSwitchQuery);

  const handleToggleWorkflow = async (workflowId: number, enabled: boolean) => {
    await toggleWorkflowMutation.mutateAsync({
      workflowId,
      enabled: !enabled,
    });
  };

  const handleDeleteWorkflow = async (workflowId: number) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer ce workflow ?")) {
      await deleteWorkflowMutation.mutateAsync({
        workflowId,
      });
    }
  };

  return (
    <div className="space-y-6" data-main-content>
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Workflows & Bascule Agent</h1>
        <p className="text-muted-foreground mt-1">
          Gérez les workflows IA et le pilotage hybride Humain/IA
        </p>
      </div>

      <Tabs defaultValue="workflows" className="space-y-6">
        <TabsList>
          <TabsTrigger value="workflows" className="gap-2">
            <Zap className="w-4 h-4" />
            Workflows
          </TabsTrigger>
          <TabsTrigger value="agent-switch" className="gap-2">
            <ArrowRightLeft className="w-4 h-4" />
            Bascule Agent
          </TabsTrigger>
        </TabsList>

        {/* Workflows Tab */}
        <TabsContent value="workflows" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Workflows IA</h2>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Créer un Workflow
            </Button>
          </div>

          <QueryStateRenderer
            state={workflowsState.state}
            error={workflowsState.error}
            onRetry={() => workflowsQuery.refetch()}
            emptyTitle="Aucun workflow"
            emptyMessage="Créez votre premier workflow pour automatiser vos processus"
            emptyActionLabel="Créer un workflow"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {workflowsQuery.data?.data?.map((workflow: any) => (
                <Card key={workflow.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Zap className="w-5 h-5 text-yellow-500" />
                          {workflow.name}
                        </CardTitle>
                        <CardDescription>{workflow.description}</CardDescription>
                      </div>
                      <Badge variant={workflow.isActive ? "default" : "secondary"}>
                        {workflow.isActive ? "Actif" : "Inactif"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground mb-1">Déclencheur</p>
                      <p className="font-medium">{workflow.triggerType}</p>
                    </div>

                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground mb-1">Action</p>
                      <p className="font-medium">{workflow.action ?? workflow.steps?.[0]?.config?.type ?? "—"}</p>
                    </div>

                    {workflow.aiRoleId && (
                      <div className="p-3 bg-blue-500/10 border border-blue-200 rounded-lg">
                        <p className="text-sm text-muted-foreground mb-1">Rôle IA Associé</p>
                        <p className="font-medium text-blue-700">{workflow.aiRoleName ?? "—"}</p>
                      </div>
                    )}

                    <div className="flex gap-2 pt-4">
                      <Button
                        variant={workflow.isActive ? "default" : "outline"}
                        className="flex-1 gap-2"
                        onClick={() => handleToggleWorkflow(workflow.id, workflow.isActive ?? false)}
                      >
                        {workflow.isActive ? (
                          <>
                            <Pause className="w-4 h-4" />
                            Pause
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4" />
                            Activer
                          </>
                        )}
                      </Button>
                      <Button
                        variant="destructive"
                        className="gap-2"
                        onClick={() => handleDeleteWorkflow(workflow.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </QueryStateRenderer>
        </TabsContent>

        {/* Agent Switch Tab */}
        <TabsContent value="agent-switch" className="space-y-6">
          <h2 className="text-2xl font-bold">Pilotage Hybride Humain/IA</h2>

          <QueryStateRenderer
            state={agentSwitchState.state}
            error={agentSwitchState.error}
            onRetry={() => agentSwitchQuery.refetch()}
          >
            {agentSwitchQuery.data && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* AI Configuration */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="w-5 h-5 text-blue-500" />
                      Configuration IA
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">Taux d'automatisation IA</p>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={agentSwitchQuery.data?.aiAutomationRate || 0}
                            onChange={(e: any) => {
                              updateAgentSwitchMutation.mutate({
                                aiAutomationRate: parseInt(e.target.value),
                              });
                            }}
                            className="flex-1"
                          />
                          <span className="font-bold min-w-12">
                            {agentSwitchQuery.data?.aiAutomationRate || 0}%
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Pourcentage d'appels gérés par l'IA
                        </p>
                      </div>

                      <div>
                        <p className="text-sm text-muted-foreground mb-2">Seuil d'escalade</p>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={agentSwitchQuery.data?.escalationThreshold || 50}
                            onChange={(e: any) => {
                              updateAgentSwitchMutation.mutate({
                                escalationThreshold: parseInt(e.target.value),
                              });
                            }}
                            className="flex-1"
                          />
                          <span className="font-bold min-w-12">
                            {agentSwitchQuery.data?.escalationThreshold || 50}%
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Confiance minimale avant escalade humaine
                        </p>
                      </div>
                    </div>

                    <div className="p-4 bg-blue-500/10 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <strong>Impact :</strong> Les appels avec une confiance inférieure au seuil seront automatiquement escaladés à un agent humain.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Human Agent Configuration */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-green-500" />
                      Configuration Humaine
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="p-4 bg-green-500/10 border border-green-200 rounded-lg">
                        <p className="text-sm text-green-800">
                          Les agents humains reçoivent les appels escaladés par l'IA ou les appels directs selon la configuration de la campagne.
                        </p>
                      </div>
                      
                      <div className="pt-4">
                        <h4 className="text-sm font-semibold mb-2">Historique récent des bascules</h4>
                        <div className="space-y-2">
                          {agentSwitchQuery.data?.recentHistory?.length > 0 ? (
                            agentSwitchQuery.data.recentHistory.map((h: any) => (
                              <div key={h.id} className="text-xs flex justify-between items-center p-2 bg-muted rounded">
                                <span>{new Date(h.createdAt).toLocaleString()}</span>
                                <Badge variant="outline">{h.newAgentType}</Badge>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-muted-foreground">Aucun historique disponible</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </QueryStateRenderer>
        </TabsContent>
      </Tabs>
    </div>
  );
}
