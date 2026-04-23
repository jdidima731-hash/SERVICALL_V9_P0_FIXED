/**
 * OPENAI KEY MANAGER COMPONENT
 * Gestion sécurisée de la clé OpenAI par tenant (BYOK)
 * À intégrer dans WorkflowsAdminRefactored.tsx
 */

import { useState} from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Eye,
  EyeOff,
  Trash2,
  Check,
  AlertCircle,
  Key,
  Loader,
 } from 'lucide-react';
import { trpc } from "@/lib/trpc";

interface OpenAiKeyManagerProps {
  tenantId: number;
}

export function OpenAiKeyManager({ tenantId }: OpenAiKeyManagerProps) {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  // Requêtes tRPC
  const { data: hasKeyData, refetch: refetchHasKey } =
    (trpc as any).aiAutomation?.industryConfig?.hasOpenAiKey?.useQuery() || { data: null, refetch: () => {} };
  const saveKeyMutation = (trpc as any).aiAutomation?.industryConfig?.saveOpenAiKey?.useMutation({
    onSuccess: () => {
      toast.success("Clé OpenAI sauvegardée avec succès");
      setApiKey("");
      setIsOpen(false);
      refetchHasKey();
    },
    onError: (error: any) => {
      toast.error(error.message || "Erreur lors de la sauvegarde");
    },
  }) || { mutateAsync: async () => {}, isPending: false };

  const deleteKeyMutation = (trpc as any).aiAutomation?.industryConfig?.deleteOpenAiKey?.useMutation({
    onSuccess: () => {
      toast.success("Clé OpenAI supprimée");
      refetchHasKey();
    },
    onError: (error: any) => {
      toast.error(error.message || "Erreur lors de la suppression");
    },
  }) || { mutateAsync: async () => {}, isPending: false };

  const testKeyMutation = (trpc as any).aiAutomation?.industryConfig?.testOpenAiKey?.useMutation({
    onSuccess: (data: any) => {
      if (data.data?.isValid) {
        toast.success("Clé OpenAI valide ✓");
      } else {
        toast.error("Clé OpenAI invalide");
      }
    },
    onError: (error: any) => {
      toast.error(error.message || "Erreur lors du test");
    },
  }) || { mutateAsync: async () => {}, isPending: false };

  const handleSaveKey = async () => {
    if (!apiKey.trim()) {
      toast.error("Veuillez entrer une clé API");
      return;
    }

    if (!apiKey.startsWith("sk-")) {
      toast.error("La clé doit commencer par 'sk-'");
      return;
    }

    
    await saveKeyMutation.mutateAsync({ apiKey });
  };

  const handleTestKey = async () => {
    if (!apiKey.trim()) {
      toast.error("Veuillez entrer une clé API");
      return;
    }

    setIsTesting(true);
    await testKeyMutation.mutateAsync({ apiKey });
    setIsTesting(false);
  };

  const handleDeleteKey = async () => {
    if (
      confirm(
        "Êtes-vous sûr de vouloir supprimer la clé OpenAI ? Les workflows IA ne fonctionneront plus."
      )
    ) {
      await deleteKeyMutation.mutateAsync({});
    }
  };

  const hasKey = hasKeyData?.data?.hasKey;

  return (
    <Card className={hasKey ? "border-green-200 bg-green-50/30" : ""}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Key className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <CardTitle className="text-lg">Clé OpenAI (BYOK)</CardTitle>
              <CardDescription>
                Apportez votre propre clé pour utiliser vos crédits OpenAI
              </CardDescription>
            </div>
          </div>
          {hasKey && (
            <Badge variant="default" className="bg-green-600 gap-1">
              <Check className="w-3 h-3" />
              Configurée
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {hasKey ? (
          <div className="space-y-4">
            {/* Status */}
            <div className="bg-green-100/50 border border-green-200 rounded-lg p-3 flex gap-2">
              <Check className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm text-green-900">
                  Clé OpenAI active
                </p>
                <p className="text-xs text-green-800">
                  Vos workflows IA utiliseront votre clé personnelle.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    Mettre à jour
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Mettre à jour la clé OpenAI</DialogTitle>
                    <DialogDescription>
                      Entrez votre nouvelle clé API OpenAI
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="apiKey">Clé API OpenAI</Label>
                      <div className="relative">
                        <Input
                          id="apiKey"
                          type={showKey ? "text" : "password"}
                          placeholder="sk-..."
                          value={apiKey}
                          onChange={(e: any) => setApiKey(e.target.value)}
                          className="pr-10"
                        />
                        <button
                          onClick={() => setShowKey(!showKey)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showKey ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Obtenez votre clé sur{" "}
                        <a
                          href="https://platform.openai.com/api-keys"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline text-primary hover:no-underline"
                        >
                          platform.openai.com/api-keys
                        </a>
                      </p>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2">
                      <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-blue-800">
                        Votre clé est chiffrée et stockée de manière sécurisée.
                        Elle n'est jamais partagée.
                      </p>
                    </div>

                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        onClick={() => setIsOpen(false)}
                      >
                        Annuler
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleTestKey}
                        disabled={isTesting || saveKeyMutation.isPending}
                      >
                        {isTesting ? (
                          <>
                            <Loader className="w-4 h-4 animate-spin mr-2" />
                            Test...
                          </>
                        ) : (
                          "Tester"
                        )}
                      </Button>
                      <Button
                        onClick={handleSaveKey}
                        disabled={saveKeyMutation.isPending}
                      >
                        {saveKeyMutation.isPending
                          ? "Enregistrement..."
                          : "Enregistrer"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteKey}
                disabled={deleteKeyMutation.isPending}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Supprimer
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Info */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm text-amber-900">
                  Aucune clé configurée
                </p>
                <p className="text-xs text-amber-800">
                  Configurez votre clé OpenAI pour activer les workflows IA.
                </p>
              </div>
            </div>

            {/* CTA */}
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button className="w-full gap-2">
                  <Key className="w-4 h-4" />
                  Ajouter ma clé OpenAI
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Configurer votre clé OpenAI</DialogTitle>
                  <DialogDescription>
                    Entrez votre clé API OpenAI pour utiliser les workflows IA
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="apiKey">Clé API OpenAI</Label>
                    <div className="relative">
                      <Input
                        id="apiKey"
                        type={showKey ? "text" : "password"}
                        placeholder="sk-..."
                        value={apiKey}
                        onChange={(e: any) => setApiKey(e.target.value)}
                        className="pr-10"
                      />
                      <button
                        onClick={() => setShowKey(!showKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showKey ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Obtenez votre clé sur{" "}
                      <a
                        href="https://platform.openai.com/api-keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline text-primary hover:no-underline"
                      >
                        platform.openai.com/api-keys
                      </a>
                    </p>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2">
                    <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-800">
                      Votre clé est chiffrée et stockée de manière sécurisée.
                      Elle n'est jamais partagée.
                    </p>
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      onClick={() => setIsOpen(false)}
                    >
                      Annuler
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleTestKey}
                      disabled={isTesting || saveKeyMutation.isPending}
                    >
                      {isTesting ? (
                        <>
                          <Loader className="w-4 h-4 animate-spin mr-2" />
                          Test...
                        </>
                      ) : (
                        "Tester"
                      )}
                    </Button>
                    <Button
                      onClick={handleSaveKey}
                      disabled={saveKeyMutation.isPending}
                    >
                      {saveKeyMutation.isPending
                        ? "Enregistrement..."
                        : "Enregistrer"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default OpenAiKeyManager;