
import React, { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowRight, Check, Target, Brain, Users  } from 'lucide-react';
import { toast } from "sonner";

type CampaignStep = "details" | "targeting" | "ai" | "review";

interface CampaignForm {
  name: string;
  description: string;
  activityType: string;
  targetAudience: string;
  prospectCount: number;
  aiEnabled: boolean;
  aiRoleId?: number;
  conversionGoal: number;
  status: "draft" | "active" | "paused" | "completed";
}

const ACTIVITY_TYPES = [
  { id: "prospection", label: "Prospection Commerciale" },
  { id: "medical", label: "Secrétariat Médical" },
  { id: "hotel", label: "Hôtellerie / Réservation" },
  { id: "restaurant", label: "Restauration / Commande" },
  { id: "real_estate", label: "Immobilier" },
  { id: "legal", label: "Juridique" },
  { id: "logistics", label: "Logistique / Suivi" },
  { id: "services", label: "Artisanat / Services" },
  { id: "education", label: "Formation / École" }
];

export default function CampaignWizard() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<CampaignStep>("details");
  const [formData, setFormData] = useState<CampaignForm>({
    name: "",
    description: "",
    activityType: "prospection",
    targetAudience: "",
    prospectCount: 0,
    aiEnabled: false,
    conversionGoal: 20,
    status: "draft",
  });

  const { tenantId } = useTenant();

  // Récupérer les modèles IA réels depuis le backend
  const { data: aiModelsData, isLoading: _isLoadingModels } = trpc.aiAutomation.ai.listModels.useQuery();
  const aiModels = aiModelsData?.roles || [];

  // Mutations
  const createCampaignMutation = trpc.business.campaign.create.useMutation({
    onSuccess: (data: unknown) => {
      toast.success("Campagne créée avec succès");
      
      setLocation(`/campaigns/${data.id}`);
    },
    
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const handleCreateCampaign = async () => {
    if (!formData.name.trim()) {
      toast.error("Veuillez entrer un nom de campagne");
      return;
    }

    await createCampaignMutation.mutateAsync({
      
      tenantId,
      ...formData,
    });
  };

  const steps: { id: CampaignStep; label: string; icon: React.ReactNode }[] = [
    { id: "details", label: "Détails", icon: <Target className="w-4 h-4" /> },
    { id: "targeting", label: "Ciblage", icon: <Users className="w-4 h-4" /> },
    { id: "ai", label: "IA", icon: <Brain className="w-4 h-4" /> },
    { id: "review", label: "Révision", icon: <Check className="w-4 h-4" /> },
  ];

  const StepIndicator = () => (
    <div className="flex items-center gap-2 mb-8">
      {steps.map((s, idx) => (
        <React.Fragment key={s.id}>
          <button
            onClick={() => setStep(s.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
              step === s.id
                ? "bg-primary text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {s.icon}
            {s.label}
          </button>
          {idx < steps.length - 1 && <ArrowRight className="w-4 h-4 text-muted-foreground" />}
        </React.Fragment>
      ))}
    </div>
  );

  return (
    <div className="space-y-6" data-main-content>
      <div>
        <Button
          variant="ghost"
          className="mb-2"
          onClick={() => setLocation("/campaigns")}
        >
          ← Retour aux campagnes
        </Button>
        <h1 className="text-3xl font-bold">Créer une Campagne</h1>
        <p className="text-muted-foreground mt-1">
          Configurez votre campagne métier avec l'IA
        </p>
      </div>

      <StepIndicator />

      <Card>
        <CardHeader>
          <CardTitle>
            {step === "details" && "Détails de la Campagne"}
            {step === "targeting" && "Ciblage des Prospects"}
            {step === "ai" && "Configuration IA"}
            {step === "review" && "Révision et Création"}
          </CardTitle>
          <CardDescription>
            {step === "details" && "Définissez le nom et le type de métier"}
            {step === "targeting" && "Définissez votre audience cible"}
            {step === "ai" && "Configurez l'automatisation IA"}
            {step === "review" && "Vérifiez les paramètres avant création"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {step === "details" && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Nom de la campagne *</label>
                <Input
                  placeholder="Ex: Secrétariat Dr Martin"
                  value={formData.name}
                  onChange={(e: any) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Type d'activité (Métier)</label>
                <select
                  value={formData.activityType}
                  onChange={(e: any) => setFormData({ ...formData, activityType: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md bg-background"
                >
                  {ACTIVITY_TYPES.map((type) => (
                    <option key={type.id} value={type.id}>{type.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Description</label>
                <Textarea
                  placeholder="Décrivez les objectifs de cette campagne..."
                  value={formData.description}
                  onChange={(e: any) => setFormData({ ...formData, description: e.target.value })}
                  className="min-h-24"
                />
              </div>
            </div>
          )}

          {step === "targeting" && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Audience cible</label>
                <Textarea
                  placeholder="Ex: Patients du cabinet, Clients habituels..."
                  value={formData.targetAudience}
                  onChange={(e: any) => setFormData({ ...formData, targetAudience: e.target.value })}
                  className="min-h-24"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Nombre de contacts estimé</label>
                <Input
                  type="number"
                  placeholder="100"
                  value={formData.prospectCount}
                  onChange={(e: any) => setFormData({ ...formData, prospectCount: parseInt(e.target.value) || 0 })}
                  min="0"
                />
              </div>
            </div>
          )}

          {step === "ai" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 border rounded-lg">
                <Checkbox
                  checked={formData.aiEnabled}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, aiEnabled: checked as boolean })
                  }
                />
                <div>
                  <p className="font-medium">Activer l'IA Métier</p>
                  <p className="text-sm text-muted-foreground">
                    L'IA utilisera le script spécifique au métier : {ACTIVITY_TYPES.find((t: any) => t.id === formData.activityType)?.label}
                  </p>
                </div>
              </div>

              {formData.aiEnabled && (
                <div>
                  <label className="text-sm font-medium mb-2 block">Modèle de voix / Rôle IA</label>
                  <select
                    value={formData.aiRoleId || ""}
                    onChange={(e: any) =>
                      setFormData({
                        ...formData,
                        aiRoleId: e.target.value ? parseInt(e.target.value) : undefined,
                      })
                    }
                    className="w-full px-3 py-2 border rounded-md bg-background"
                  >
                    <option value="">Sélectionner un rôle...</option>
                    {aiModels.map((model: any) => (
                      <option key={model.id} value={model.id}>
                        {model.name} ({model.model})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {step === "review" && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nom</span>
                  <span className="font-medium">{formData.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Métier</span>
                  <Badge variant="outline">
                    {ACTIVITY_TYPES.find((t: any) => t.id === formData.activityType)?.label}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Contacts</span>
                  <span className="font-medium">{formData.prospectCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">IA Activée</span>
                  <Badge variant={formData.aiEnabled ? "default" : "secondary"}>
                    {formData.aiEnabled ? "Oui" : "Non"}
                  </Badge>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            {step !== "details" && (
              <Button
                variant="outline"
                onClick={() => {
                  const stepOrder: CampaignStep[] = ["details", "targeting", "ai", "review"];
                  const currentIdx = stepOrder.indexOf(step);
                  const prevStep = stepOrder[currentIdx - 1];
                  if (prevStep) setStep(prevStep);
                }}
              >
                ← Précédent
              </Button>
            )}

            {step !== "review" && (
              <Button
                onClick={() => {
                  const stepOrder: CampaignStep[] = ["details", "targeting", "ai", "review"];
                  const currentIdx = stepOrder.indexOf(step);
                  const nextStep = stepOrder[currentIdx + 1];
                  if (nextStep) setStep(nextStep);
                }}
                className="ml-auto"
              >
                Suivant →
              </Button>
            )}

            {step === "review" && (
              <Button
                onClick={handleCreateCampaign}
                disabled={createCampaignMutation.isPending}
                className="ml-auto gap-2"
              >
                <Check className="w-4 h-4" />
                {createCampaignMutation.isPending ? "Création..." : "Lancer la Campagne"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}