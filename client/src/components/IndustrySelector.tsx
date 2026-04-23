/**
 * INDUSTRY SELECTOR COMPONENT
 * Sélection du métier et des capacités activées
 * À intégrer dans WorkflowsAdminRefactored.tsx
 */

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Settings, AlertCircle, Check, Loader2, Building2  } from 'lucide-react';
import { getCapabilityLabel } from "@/utils/capabilityLabels";
import { trpc } from "@/lib/trpc";

// Logger for stability
const logger = {
  info: (...args: unknown[]) => console.log("[INFO]", ...args),
  error: (...args: unknown[]) => console.error("[ERROR]", ...args),
  warn: (...args: unknown[]) => console.warn("[WARN]", ...args),
};

interface Industry {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: string;
  capabilities: string[];
  workflowCount: number;
}

interface IndustrySelectorProps {
  tenantId?: number;
  onIndustrySelected?: (industryId: string) => void;
}

export function IndustrySelector({
  
  tenantId,
  onIndustrySelected,
}: IndustrySelectorProps) {
  const [selectedIndustry, setSelectedIndustry] = useState<Industry | null>(null);
  const [enabledCapabilities, setEnabledCapabilities] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  // Récupérer le catalogue des métiers via le vrai client trpc
  const { data: catalogData, isPending: catalogLoading, error: catalogError } = trpc.aiAutomation.industryConfig.getCatalog.useQuery();
  const { data: currentConfigData, isPending: configLoading, error: configError } = trpc.aiAutomation.industryConfig.getCurrentConfig.useQuery();
  
  const setConfigMutation = trpc.aiAutomation.industryConfig.setConfig.useMutation({
    onSuccess: (data: unknown) => {
      logger.info('[BLOC 0] Configuration métier mise à jour avec succès:', data);
      toast.success("Configuration métier enregistrée avec succès !");
      setIsOpen(false); // Fermer la modale après succès
      if (selectedIndustry) {
        onIndustrySelected?.(selectedIndustry?.id);
      }
    },
    onError: (error) => {
      console.error('[BLOC 0] Échec de mise à jour de la configuration métier:', error);
      toast.error(`Erreur : ${error.message || "Impossible de sauvegarder la configuration"}`);
    },
  });

  // Charger la configuration actuelle
  useEffect(() => {
    if (currentConfigData) {
      const config = currentConfigData?.data ?? currentConfigData;
      // Trouver le métier correspondant
      
      const industriesSource = catalogData?.data?.industries ?? catalogData?.industries;
      
      if (industriesSource) {
        const industriesMap = industriesSource as Record<string, unknown>;
        const industry = Object.values(industriesMap).find(
          
          (ind: unknown) => ind?.id === (config as Record<string, unknown>)?.["industryId"]
        
        );
        if (industry) {
          logger.info('[BLOC 0] Configuration métier chargée:', (config as Record<string, unknown>)?.["industryId"]);
          setSelectedIndustry(industry as Industry);
          
          setEnabledCapabilities((config as Record<string, unknown>)?.["enabledCapabilities"] || []);
        
        } else {
          console.warn('[BLOC 0] Métier non trouvé dans le catalogue:', (config as Record<string, unknown>)?.["industryId"]);
        }
      }
    }
  }, [currentConfigData, catalogData]);

  // Construire la liste des métiers filtrés
  
  const rawIndustries = catalogData?.data?.industries || catalogData?.industries;
  
  
  const industries: Industry[] = rawIndustries
    ? Object.entries(rawIndustries as Record<string, unknown>)
        .map(([id, ind]: [string, any]) => ({
          id: id,
          name: ind.name,
          category: ind.category || "Services",
          description: ind?.description,
          icon: ind?.icon,
          capabilities: ind.capabilities || [],
          workflowCount: ind.workflows?.length || 0,
        }))
        .filter((ind: Industry) => {
          const nameMatch = ind.name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false;
          const categoryMatch = ind.category?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false;
          return nameMatch || categoryMatch;
        })
    : [];

  // Grouper par catégorie
  const groupedByCategory = (industries || []).reduce(
    (acc, industry) => {
      if (!acc[industry.category]) {
        acc[industry.category] = [];
      }
      acc[industry.category]!.push(industry);
      return acc;
    },
    {} as Record<string, Industry[]>
  );

  const handleSelectIndustry = (industry: Industry) => {
    setSelectedIndustry(industry);
    setEnabledCapabilities(industry.capabilities);
  };

  const handleToggleCapability = (capability: string) => {
    setEnabledCapabilities((prev) =>
      prev.includes(capability)
        ? prev.filter((c) => c !== capability)
        : [...prev, capability]
    );
  };

  const handleSave = async () => {
    if (!selectedIndustry || !selectedIndustry?.id) {
      toast.error("Veuillez sélectionner un métier avant d'enregistrer");
      console.error("No industry selected or missing ID", selectedIndustry);
      return;
    }

    try {
      await setConfigMutation.mutateAsync({
        industryId: selectedIndustry?.id,
        
        enabledCapabilities,
        enabledWorkflows: [],
      });
    } catch (err: any) {
      // L'erreur est déjà gérée par onError de la mutation
      console.error("Failed to save industry config:", err);
    }
  };

  // Gestion du chargement
  if (catalogLoading || configLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-sm text-muted-foreground">Chargement de la configuration...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Gestion des erreurs
  if (catalogError || configError) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 text-destructive">
            <AlertCircle className="w-5 h-5" />
            <div>
              <p className="font-semibold">Erreur de chargement</p>
              <p className="text-sm">{catalogError?.message || configError?.message || "Impossible de charger la configuration"}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Carte de résumé du métier sélectionné */}
      {selectedIndustry ? (
        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="text-4xl">{selectedIndustry?.icon}</div>
                <div>
                  <h3 className="text-lg font-bold">{selectedIndustry.name}</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    {selectedIndustry?.description}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {enabledCapabilities.map((cap) => (
                      <Badge key={cap} variant="secondary">
                        {getCapabilityLabel(cap)}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
              <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Settings className="w-4 h-4" />
                    Modifier
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Configuration du métier</DialogTitle>
                    <DialogDescription>
                      Sélectionnez votre métier et les capacités à activer
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-6">
                    {/* Sélection du métier */}
                    <div className="space-y-3">
                      <Label className="text-base font-semibold">
                        Sélectionner un métier
                      </Label>
                      <Input
                        placeholder="Rechercher un métier..."
                        value={searchTerm}
                        onChange={(e: any) => setSearchTerm(e.target.value)}
                        className="mb-4"
                      />

                      <div className="max-h-64 overflow-y-auto space-y-2 border rounded-lg p-4 bg-muted/30">
                        {(Object.entries(groupedByCategory) as [string, Industry[]][]).map(
                          ([category, cats]: [string, Industry[]]) => (
                            <div key={category}>
                              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                                {category}
                              </p>
                              <div className="space-y-2 ml-2">
                                {cats.map((industry: Industry) => (
                                  <button
                                    key={industry.id}
                                    onClick={() => handleSelectIndustry(industry)}
                                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                                      selectedIndustry?.id === industry.id
                                        ? "bg-primary text-white border-primary"
                                        : "bg-white hover:bg-muted/50 border-border"
                                    }`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <span className="text-2xl">{industry?.icon}</span>
                                      <div className="flex-1">
                                        <div className="font-medium">{industry.name}</div>
                                        <div className="text-xs opacity-80 line-clamp-1">{industry?.description}</div>
                                      </div>
                                      {(selectedIndustry as Industry | null)?.id === industry.id && <Check className="w-4 h-4" />}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    </div>

                    {/* Sélection des capacités */}
                    {selectedIndustry && (
                      <div className="space-y-3 p-4 border rounded-lg bg-primary/5">
                        <Label className="text-base font-semibold">
                          Capacités à activer pour {selectedIndustry.name}
                        </Label>
                        <div className="grid grid-cols-2 gap-4">
                          {selectedIndustry.capabilities.map((cap) => (
                            <div key={cap} className="flex items-center space-x-2">
                              <Checkbox
                                id={`cap-${cap}`}
                                checked={enabledCapabilities.includes(cap)}
                                onCheckedChange={() => handleToggleCapability(cap)}
                              />
                              <Label
                                htmlFor={`cap-${cap}`}
                                className="text-sm font-medium leading-none cursor-pointer"
                              >
                                {getCapabilityLabel(cap)}
                              </Label>
                              <Badge variant="outline" className="text-[10px] py-0 px-1">Activé</Badge>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-start gap-2 mt-2 p-2 bg-blue-50 text-blue-700 rounded text-xs">
                          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                          <p>Les capacités sélectionnées déterminent les actions disponibles dans vos workflows.</p>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4 border-t">
                      <Button variant="ghost" onClick={() => setIsOpen(false)}>
                        Annuler
                      </Button>
                      <Button onClick={handleSave} disabled={setConfigMutation.isPending}>
                        {setConfigMutation.isPending ? (
                          <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Enregistrement...</>
                        ) : (
                          "Enregistrer"
                        )}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed border-2 hover:border-primary/50 transition-colors">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-bold mb-1">Configuration du métier</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
              Vous n'avez pas encore configuré votre métier pour ce compte.
            </p>
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Settings className="w-4 h-4" />
                  Configurer mon métier
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Configuration du métier</DialogTitle>
                  <DialogDescription>
                    Sélectionnez votre métier et les capacités à activer
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                  {/* Sélection du métier */}
                  <div className="space-y-3">
                    <Label className="text-base font-semibold">
                      Sélectionner un métier
                    </Label>
                    <Input
                      placeholder="Rechercher un métier..."
                      value={searchTerm}
                      onChange={(e: any) => setSearchTerm(e.target.value)}
                      className="mb-4"
                    />

                    <div className="max-h-64 overflow-y-auto space-y-2 border rounded-lg p-4 bg-muted/30">
                      {(Object.entries(groupedByCategory) as [string, Industry[]][]).map(
                        ([category, cats]: [string, Industry[]]) => (
                          <div key={category}>
                            <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                              {category}
                            </p>
                            <div className="space-y-2 ml-2">
                              {cats.map((industry: Industry) => (
                                <button
                                  key={industry.id}
                                  onClick={() => handleSelectIndustry(industry)}
                                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                                    (selectedIndustry as Industry | null)?.id === industry.id
                                      ? "bg-primary text-white border-primary"
                                      : "bg-white hover:bg-muted/50 border-border"
                                  }`}
                                >
                                  <div className="flex items-center gap-3">
                                    <span className="text-2xl">{industry?.icon}</span>
                                    <div className="flex-1">
                                      <div className="font-medium">{industry.name}</div>
                                      <div className="text-xs opacity-80 line-clamp-1">{industry?.description}</div>
                                    </div>
                                    {(selectedIndustry as Industry | null)?.id === industry.id && <Check className="w-4 h-4" />}
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </div>

                  {/* Sélection des capacités */}
                  {selectedIndustry && (
                    <div className="space-y-3 p-4 border rounded-lg bg-primary/5">
                      <Label className="text-base font-semibold">
                        Capacités à activer pour {(selectedIndustry as Industry).name}
                      </Label>
                      <div className="grid grid-cols-2 gap-4">
                        {(selectedIndustry as Industry).capabilities.map((cap: string) => (
                          <div key={cap} className="flex items-center space-x-2">
                            <Checkbox
                              id={`cap-new-${cap}`}
                              checked={enabledCapabilities.includes(cap)}
                              onCheckedChange={() => handleToggleCapability(cap)}
                            />
                            <Label
                              htmlFor={`cap-new-${cap}`}
                              className="text-sm font-medium leading-none cursor-pointer"
                            >
                              {getCapabilityLabel(cap)}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-3 pt-4 border-t">
                    <Button variant="ghost" onClick={() => setIsOpen(false)}>
                      Annuler
                    </Button>
                    <Button onClick={handleSave} disabled={setConfigMutation.isPending}>
                      {setConfigMutation.isPending ? (
                        <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Enregistrement...</>
                      ) : (
                        "Enregistrer"
                      )}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      )}
    </div>
  );
}