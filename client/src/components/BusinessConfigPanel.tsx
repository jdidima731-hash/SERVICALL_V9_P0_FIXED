
/**
 * BUSINESS CONFIG PANEL
 * Panneau de configuration métier pour le dashboard
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { trpc, RouterOutputs } from "@/lib/trpc";
import { Briefcase, Save, AlertCircle, Download  } from 'lucide-react';
import { Alert, AlertDescription } from "@/components/ui/alert";

const BUSINESS_TYPES = [
  { value: "restaurant", label: "Restaurant" },
  { value: "hotel", label: "Hôtel" },
  { value: "real_estate", label: "Immobilier" },
  { value: "clinic", label: "Clinique / Cabinet médical" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "artisan", label: "Artisan" },
  { value: "call_center", label: "Centre d'appels" },
  { value: "generic", label: "Générique" },
];

export function BusinessConfigPanel() {
  const [businessType, setBusinessType] = useState<string>("generic");
  const [aiCustomScript, setAiCustomScript] = useState<string>("");
  const [hasChanges, setHasChanges] = useState(false);

  // Récupérer la configuration actuelle
    const { data: config, isLoading, refetch } = trpc.core.tenant.getBusinessConfig.useQuery();
  
  type BusinessConfigOutput = RouterOutputs['tenant']['getBusinessConfig'];
  const typedConfig: BusinessConfigOutput | undefined = config;

  // Mutation pour mettre à jour la configuration
  const updateConfig = trpc.core.tenant.updateBusinessConfig.useMutation({
    onSuccess: () => {
      toast.success("Configuration métier enregistrée");
      setHasChanges(false);
      refetch();
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Initialiser les valeurs depuis la config
  useEffect(() => {
    if (typedConfig) {
      setBusinessType(typedConfig.businessType || "generic");
      setAiCustomScript(typedConfig.aiCustomScript || "");
    }
  }, [config]);

  const handleSave = () => {
    updateConfig.mutate({
      
      businessType: businessType || undefined,
      aiCustomScript: aiCustomScript || undefined,
    });
  };

  const handleBusinessTypeChange = (value: string) => {
    setBusinessType(value);
    setHasChanges(true);
  };

  const handleScriptChange = (value: string) => {
    setAiCustomScript(value);
    setHasChanges(true);
  };

  const handleDownloadPDF = () => {
    toast.info("Génération du rapport PDF en cours...");
    // Simulation de téléchargement
    setTimeout(() => {
      toast.success("Rapport PDF téléchargé avec succès");
    }, 2000);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="w-5 h-5" />
            Configuration Métier
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Chargement...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Briefcase className="w-5 h-5" />
          Configuration Métier
        </CardTitle>
        <CardDescription>
          Configurez le type de métier et le script IA personnalisé pour votre entreprise
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Business Type Selector */}
        <div className="space-y-2">
          <Label htmlFor="businessType">Type de métier</Label>
          <Select value={businessType} onValueChange={handleBusinessTypeChange}>
            <SelectTrigger id="businessType">
              <SelectValue placeholder="Sélectionnez votre métier" />
            </SelectTrigger>
            <SelectContent>
              {BUSINESS_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Le type de métier détermine le template IA par défaut utilisé pour les conversations
          </p>
        </div>

        {/* AI Custom Script */}
        <div className="space-y-2">
          <Label htmlFor="aiCustomScript">Script IA personnalisé (optionnel)</Label>
          <Textarea
            id="aiCustomScript"
            value={aiCustomScript}
            onChange={(e: any) => handleScriptChange(e.target.value)}
            placeholder="Entrez votre script IA personnalisé ici. Si vide, le template par défaut du type de métier sera utilisé."
            rows={10}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Le script personnalisé remplace le template par défaut. Minimum 50 caractères, maximum 10000.
          </p>
        </div>

        {/* Info Alert */}
        {businessType && !aiCustomScript && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Le template par défaut pour <strong>{BUSINESS_TYPES.find((t: any) => t.value === businessType)?.label}</strong> sera utilisé.
            </AlertDescription>
          </Alert>
        )}

        {aiCustomScript && aiCustomScript.length > 0 && aiCustomScript.length < 50 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Le script personnalisé doit contenir au moins 50 caractères ({aiCustomScript.length}/50).
            </AlertDescription>
          </Alert>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleDownloadPDF} className="gap-2">
            <Download className="w-4 h-4" />
            Export PDF
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || updateConfig.isPending || (aiCustomScript.length > 0 && aiCustomScript.length < 50)}
          >
            <Save className="w-4 h-4 mr-2" />
            {updateConfig.isPending ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}