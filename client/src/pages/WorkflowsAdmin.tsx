/**
 * @deprecated ✅ FIX P1-C — Remplacé par WorkflowsAndAgentSwitch.tsx (route /workflows)
 * Conservé pour compatibilité interne — ne pas référencer dans l'UI produit
 */
/**
 * WORKFLOWS ADMIN REFACTORED - UPDATED VERSION
 * Intégration de la configuration métier et de la gestion de la clé OpenAI
 * 
 * À REMPLACER : client/src/pages/WorkflowsAdminRefactored.tsx
 */

import { useState } from "react";
import { Zap, ChevronRight  } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkflowBuilder } from "@/components/WorkflowBuilder";
import { IndustrySelector } from "@/components/IndustrySelector";
import { OpenAiKeyManager } from "@/components/OpenAiKeyManager";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { TenantGuard } from "@/components/TenantGuard";

export default function WorkflowsAdminRefactored() {
  const { user } = useAuth();
  const tenantId = (user as {tenantId?: number})?.tenantId;
  const [activeTab, setActiveTab] = useState("setup");

  const handleSaveWorkflow = () => {
    toast.success("Workflow sauvegardé avec succès");
  };

  return (
    <TenantGuard>
    <div className="space-y-6" data-main-content>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Zap className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Éditeur de Workflows
          </h1>
          <p className="text-muted-foreground">
            Configurez votre métier, activez les capacités et créez des automatisations IA
          </p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-muted/50 p-1 rounded-xl border border-border">
          <TabsTrigger value="setup" className="gap-2 rounded-lg">
            <span className="text-lg">⚙️</span>
            <span className="hidden sm:inline">Configuration</span>
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-2 rounded-lg">
            <span className="text-lg">🔑</span>
            <span className="hidden sm:inline">Clé OpenAI</span>
          </TabsTrigger>
          <TabsTrigger value="workflows" className="gap-2 rounded-lg">
            <span className="text-lg">⚡</span>
            <span className="hidden sm:inline">Workflows</span>
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: CONFIGURATION MÉTIER */}
        <TabsContent value="setup" className="space-y-6 pt-4">
          <div className="grid gap-6">
            {/* Info Card */}
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-6">
                <div className="flex gap-4">
                  <div className="text-blue-600 text-2xl">💡</div>
                  <div>
                    <h3 className="font-semibold text-blue-900 mb-1">
                      Comment ça marche ?
                    </h3>
                    <p className="text-sm text-blue-800">
                      <strong>Étape 1 :</strong> Sélectionnez votre métier (hôtel, restaurant, médecin, etc.)
                      <br />
                      <strong>Étape 2 :</strong> Activez les capacités dont vous avez besoin (SMS, Agenda, Appels, WhatsApp, etc.)
                      <br />
                      <strong>Étape 3 :</strong> Configurez votre clé OpenAI pour activer l'IA
                      <br />
                      <strong>Étape 4 :</strong> Créez et activez vos workflows automatisés
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Industry Selector */}
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className="text-2xl">🏢</span>
                Sélectionner votre métier
              </h2>
              <IndustrySelector
                
                tenantId={tenantId as number}
                onIndustrySelected={(industryId) => {
                }}
              />
            </div>

            {/* Progression Indicator */}
            <Card className="bg-gradient-to-r from-primary/5 to-transparent border-primary/20">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold">
                      ✓
                    </div>
                    <span className="text-muted-foreground">Métier</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center font-bold">
                      2
                    </div>
                    <span className="text-muted-foreground">Clé OpenAI</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center font-bold">
                      3
                    </div>
                    <span className="text-muted-foreground">Workflows</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 2: CLÉ OPENAI */}
        <TabsContent value="ai" className="space-y-6 pt-4">
          <div className="grid gap-6">
            {/* Info Card */}
            <Card className="bg-purple-50 border-purple-200">
              <CardContent className="pt-6">
                <div className="flex gap-4">
                  <div className="text-purple-600 text-2xl">🤖</div>
                  <div>
                    <h3 className="font-semibold text-purple-900 mb-1">
                      Pourquoi une clé personnelle ?
                    </h3>
                    <p className="text-sm text-purple-800">
                      Servicall utilise votre propre clé OpenAI (BYOK - Bring Your Own Key).
                      Cela signifie que vous contrôlez vos crédits, vos données et vos coûts.
                      Aucune clé n'est stockée sur nos serveurs sans chiffrement.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* OpenAI Key Manager */}
            <OpenAiKeyManager tenantId={tenantId as number} />

            {/* Avantages */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Avantages du modèle BYOK</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li className="flex gap-2">
                    <span className="text-green-600">✓</span>
                    <span>Vous payez directement OpenAI, pas de frais intermédiaires</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-green-600">✓</span>
                    <span>Vos données restent privées et chiffrées</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-green-600">✓</span>
                    <span>Vous contrôlez totalement vos limites d'utilisation</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-green-600">✓</span>
                    <span>Pas de dépendance à nos crédits internes</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 3: WORKFLOWS */}
        <TabsContent value="workflows" className="space-y-6 pt-4">
          <div className="grid gap-6">
            {/* Info Card */}
            <Card className="bg-green-50 border-green-200">
              <CardContent className="pt-6">
                <div className="flex gap-4">
                  <div className="text-green-600 text-2xl">⚡</div>
                  <div>
                    <h3 className="font-semibold text-green-900 mb-1">
                      Créer vos automatisations
                    </h3>
                    <p className="text-sm text-green-800">
                      Utilisez les templates prêts à l'emploi de votre métier ou créez vos propres workflows.
                      Chaque workflow s'exécute automatiquement selon le déclencheur que vous définissez.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Workflow Builder */}
            <WorkflowBuilder tenantId={tenantId as number} onSave={handleSaveWorkflow} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
    </TenantGuard>
  );
}