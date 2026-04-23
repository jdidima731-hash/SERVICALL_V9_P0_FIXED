import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Bot, User, History, TrendingUp  } from 'lucide-react';

export default function AgentSwitch() {
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const utils = trpc.useUtils();

  // Query pour récupérer l'état actuel d'un utilisateur
  const {data: agentTypeData, isLoading: _isLoadingAgentType} = trpc.aiAutomation.agentSwitch.getAgentType.useQuery(
    { userId: selectedUserId! },
    { enabled: !!selectedUserId }
  );

  // Query pour récupérer l'historique
  const { data: historyDataRaw, isLoading: isLoadingHistory } = trpc.aiAutomation.agentSwitch.getUserHistory.useQuery(
    { userId: selectedUserId!, limit: 50 },
    { enabled: !!selectedUserId }
  );
  const historyData = historyDataRaw;

  // Mutations
  const forceHumanMutation = trpc.aiAutomation.agentSwitch.forceHuman.useMutation({
    onSuccess: () => {
      toast.success("Agent basculé vers HUMAIN avec succès");
      
      utils.aiAutomation.agentSwitch.getAgentType.invalidate();
      
      utils.aiAutomation.agentSwitch.getUserHistory.invalidate();
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const forceAIMutation = trpc.aiAutomation.agentSwitch.forceAI.useMutation({
    onSuccess: () => {
      toast.success("Agent basculé vers IA avec succès");
      
      utils.aiAutomation.agentSwitch.getAgentType.invalidate();
      
      utils.aiAutomation.agentSwitch.getUserHistory.invalidate();
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const handleForceHuman = () => {
    if (!selectedUserId) return;
    forceHumanMutation.mutate({
      userId: selectedUserId,
       
       // À adapter selon le contexte
      reason: "Bascule manuelle depuis l'interface admin",
    });
  };

  const handleForceAI = () => {
    if (!selectedUserId) return;
    forceAIMutation.mutate({
      userId: selectedUserId,
       
       // À adapter selon le contexte
      reason: "Bascule manuelle depuis l'interface admin",
    });
  };

  return (
    <div className="space-y-6" data-main-content>
      <div>
        <h1 className="text-3xl font-bold">Gestion des Agents IA/Humain</h1>
        <p className="text-muted-foreground mt-2">
          Basculez entre agent IA et agent humain pour gérer les appels
        </p>
      </div>

      <Tabs defaultValue="control" className="space-y-4">
        <TabsList>
          <TabsTrigger value="control">Contrôle</TabsTrigger>
          <TabsTrigger value="history">Historique</TabsTrigger>
          <TabsTrigger value="stats">Statistiques</TabsTrigger>
        </TabsList>

        <TabsContent value="control" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sélection de l'utilisateur</CardTitle>
              <CardDescription>
                Sélectionnez un utilisateur pour gérer son type d'agent
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">ID Utilisateur</label>
                <input
                  type="number"
                  className="w-full mt-1 px-3 py-2 border rounded-md"
                  placeholder="Entrez l'ID de l'utilisateur"
                  value={selectedUserId || ""}
                  onChange={(e: any) => setSelectedUserId(Number(e.target.value) || null)}
                />
              </div>

              {selectedUserId && agentTypeData && (
                <div className="p-4 bg-muted rounded-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Type d'agent actuel :</span>
                    <Badge
                      variant={agentTypeData.agentType === "AI" ? "default" : "secondary"}
                      className="flex items-center gap-2"
                    >
                      {agentTypeData.agentType === "AI" ? (
                        <>
                          <Bot className="h-4 w-4" />
                          Agent IA
                        </>
                      ) : (
                        <>
                          <User className="h-4 w-4" />
                          Agent Humain
                        </>
                      )}
                    </Badge>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={handleForceAI}
                      disabled={
                        agentTypeData.agentType === "AI" ||
                        forceAIMutation.isPending
                      }
                      className="flex-1"
                      variant={agentTypeData.agentType === "AI" ? "outline" : "default"}
                    >
                      <Bot className="mr-2 h-4 w-4" />
                      Basculer vers IA
                    </Button>
                    <Button
                      onClick={handleForceHuman}
                      disabled={
                        agentTypeData.agentType === "HUMAN" ||
                        forceHumanMutation.isPending
                      }
                      className="flex-1"
                      variant={agentTypeData.agentType === "HUMAN" ? "outline" : "default"}
                    >
                      <User className="mr-2 h-4 w-4" />
                      Basculer vers Humain
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Historique des bascules
              </CardTitle>
              <CardDescription>
                Historique complet des changements de type d'agent
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedUserId ? (
                <p className="text-sm text-muted-foreground">
                  Sélectionnez un utilisateur pour voir son historique
                </p>
              ) : isLoadingHistory ? (
                <p className="text-sm text-muted-foreground">Chargement...</p>
              ) : historyData && historyData.history.length > 0 ? (
                <div className="space-y-2">
                  {historyData.history.map((entry: any) => (
                    <div
                      key={entry.id}
                      className="p-3 border rounded-lg flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">
                          {(entry.previousAgentType as string) || "N/A"} → {entry.newAgentType as string}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {new Date(entry.createdAt as string).toLocaleString("fr-FR")}
                        </span>
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">Par:</span>{" "}
                        <span className="font-medium">{entry.triggeredBy as string}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Aucun historique disponible</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Statistiques
              </CardTitle>
              <CardDescription>
                Vue d'ensemble des bascules d'agents
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Statistiques à venir : nombre de bascules, durée moyenne en IA/Humain, etc.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}