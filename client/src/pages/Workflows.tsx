
/**
 * @deprecated ✅ FIX P1-C — Remplacé par WorkflowsAndAgentSwitch.tsx (route /workflows)
 * Conservé pour compatibilité interne — ne pas référencer dans l'UI produit
 */
import { useState, useEffect } from "react";
import { Zap, 
  Building2, 
  Key, 
  Settings2, 
  CheckCircle2, 
  ArrowLeft, 
  ArrowRight,
  Sparkles
 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { WorkflowBuilder } from "@/components/WorkflowBuilder";
import { IndustrySelector } from "@/components/IndustrySelector";

import { IndustryWorkflowsManager } from "@/components/IndustryWorkflowsManager";
import { OpenAiKeyManager } from "@/components/OpenAiKeyManager";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

export default function WorkflowsPage() {
  // tenantId via currentTenant query (UserPublicDTO ne contient pas tenantId)
  const currentTenantQuery = trpc.core.auth.currentTenant.useQuery();
  // ✅ CORRECTION — tenantId || 1 dangereux (fallback cross-tenant). 
  // On utilise 0 ou undefined pour forcer une erreur ou un chargement si non authentifié.
  
  const tenantId = currentTenantQuery.data?.tenantId;
  
  // État de l'onboarding : 1 (Métier), 2 (OpenAI), 3 (Workflows)
  const [step, setStep] = useState(1);
  const [selectedIndustryId, setSelectedIndustryId] = useState<string | null>(null);
  
  // Récupérer la configuration actuelle du métier
  const {data: currentConfig, isLoading: _configLoading} = trpc.aiAutomation.industryConfig.getCurrentConfig.useQuery(undefined, {
    enabled: !!tenantId
  });
  
  // Initialisation basée sur la config existante
  useEffect(() => {
    if (currentConfig?.data?.industryId) {
      setSelectedIndustryId(currentConfig.data.industryId);
      // ✅ CORRECTION: Si déjà configuré, on passe directement à l'étape 3 pour voir les modèles
      setStep(3);
    }
  }, [currentConfig]);

  const handleSaveWorkflow = (workflow: any) => {
    toast.success("Workflow sauvegardé avec succès");
  };

  const nextStep = () => setStep((s) => Math.min(s + 1, 3));
  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  const steps = [
    { id: 1, title: "Métier", icon: Building2, description: "Identifiez votre secteur" },
    { id: 2, title: "IA", icon: Key, description: "Configurez OpenAI" },
    { id: 3, title: "Workflows", icon: Settings2, description: "Créez vos automatisations" },
  ];

  if (!tenantId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-muted-foreground">Chargement de votre session...</div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-3 md:p-8 animate-in fade-in duration-500" data-main-content>
      {/* Header & Progress */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Zap className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight">Configuration Assistée</h1>
              <p className="text-muted-foreground">Préparez votre assistant intelligent en quelques minutes</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg border">
            {steps.map((s) => (
              <button 
                key={s.id}
                onClick={() => setStep(s.id)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-md transition-all",
                  step === s.id ? "bg-background shadow-sm text-primary" : "text-muted-foreground opacity-60 hover:opacity-100"
                )}
              >
                <s.icon className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">{s.title}</span>
              </button>
            ))}
          </div>
        </div>
        <Progress value={(step / 3) * 100} className="h-2" />
      </div>

      {/* Step Content */}
      <div className="min-h-[500px]">
        {step === 1 && (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-1 space-y-4">
                <h2 className="text-2xl font-bold">Étape 1 : Votre Métier</h2>
                <p className="text-muted-foreground">
                  Sélectionnez votre secteur d'activité pour que nous puissions vous proposer des modèles de workflows adaptés à vos besoins réels.
                </p>
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-blue-700 font-bold">
                    <Sparkles className="w-4 h-4" />
                    <span>Pourquoi ?</span>
                  </div>
                  <p className="text-xs text-blue-600 leading-relaxed">
                    Chaque métier a des besoins spécifiques. Un restaurant gère des réservations, tandis qu'un médecin gère des rendez-vous médicaux.
                  </p>
                </div>
              </div>
              <div className="md:col-span-2">
                <Card className="border-2 border-primary/10 shadow-xl overflow-hidden">
                  <CardHeader className="bg-muted/30 border-b">
                    <CardTitle>Secteur d'activité</CardTitle>
                    <CardDescription>Choisissez le métier qui correspond le mieux à votre entreprise</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <IndustrySelector
                      
                      tenantId={tenantId}
                      onIndustrySelected={(industryId) => {
                        setSelectedIndustryId(industryId);
                        toast.success("Métier configuré avec succès");
                        setTimeout(nextStep, 800);
                      }}
                    />
                  </CardContent>
                  {selectedIndustryId && (
                    <CardFooter className="bg-primary/5 border-t p-4 flex justify-between items-center">
                      <div className="flex items-center gap-2 text-primary font-medium">
                        <CheckCircle2 className="w-5 h-5" />
                        <span>Métier sélectionné</span>
                      </div>
                      <Button onClick={nextStep} className="gap-2">
                        Continuer <ArrowRight className="w-4 h-4" />
                      </Button>
                    </CardFooter>
                  )}
                </Card>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-1 space-y-4">
                <h2 className="text-2xl font-bold">Étape 2 : Intelligence Artificielle</h2>
                <p className="text-muted-foreground">
                  Connectez votre propre clé OpenAI pour activer les capacités de compréhension et de réponse de votre assistant.
                </p>
                <div className="p-4 bg-purple-50 border border-purple-100 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-purple-700 font-bold">
                    <Key className="w-4 h-4" />
                    <span>Sécurité & Coûts</span>
                  </div>
                  <p className="text-xs text-purple-600 leading-relaxed">
                    Nous utilisons le modèle BYOK (Bring Your Own Key). Vous gardez le contrôle total sur vos dépenses et vos données.
                  </p>
                </div>
              </div>
              <div className="md:col-span-2">
                <Card className="border-2 border-primary/10 shadow-xl overflow-hidden">
                  <CardHeader className="bg-muted/30 border-b">
                    <CardTitle>Configuration OpenAI</CardTitle>
                    <CardDescription>Saisissez votre clé API secrète</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <OpenAiKeyManager tenantId={tenantId} />
                  </CardContent>
                  <CardFooter className="bg-muted/20 border-t p-4 flex justify-between">
                    <Button variant="ghost" onClick={prevStep} className="gap-2">
                      <ArrowLeft className="w-4 h-4" /> Retour
                    </Button>
                    <Button onClick={nextStep} className="gap-2">
                      Passer aux Workflows <ArrowRight className="w-4 h-4" />
                    </Button>
                  </CardFooter>
                </Card>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Étape 3 : Vos Automatisations</h2>
                <p className="text-muted-foreground">Activez les modèles prédéfinis ou créez vos propres scénarios.</p>
              </div>
              <Button variant="outline" onClick={prevStep} className="gap-2">
                <ArrowLeft className="w-4 h-4" /> Retour à l'IA
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-8">
              {selectedIndustryId && (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    Modèles recommandés pour votre métier
                  </h3>
                  <IndustryWorkflowsManager
                    industryId={selectedIndustryId}
                    tenantId={tenantId}
                  />
                </div>
              )}

              <div className="space-y-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Settings2 className="w-5 h-5 text-primary" />
                  Éditeur de Workflow personnalisé
                </h3>
                <Card className="border-2 border-primary/5 shadow-lg">
                  <CardContent className="p-0">
                    <WorkflowBuilder tenantId={tenantId} onSave={() => handleSaveWorkflow(null)} />
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}