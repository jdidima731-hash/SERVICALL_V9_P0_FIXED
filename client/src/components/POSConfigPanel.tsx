/**
 * POS CONFIG PANEL
 * Panneau de configuration pour la connexion aux systèmes de caisse (POS)
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { trpc, RouterOutputs, RouterInputs } from "@/lib/trpc";
import { CreditCard, Save, RefreshCw, CheckCircle2, XCircle, History  } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";


type PosConfigOutput = RouterOutputs["business"]["pos"]["getConfig"];

type PosProviderInput = RouterInputs["business"]["pos"]["updateConfig"]["provider"];

type PosConfigDetailsInput = RouterInputs["business"]["pos"]["updateConfig"]["config"];

type PosSyncHistoryOutput = RouterOutputs["business"]["pos"]["getSyncHistory"]["history"][number];

const POS_PROVIDERS = [
  { value: "lightspeed", label: "Lightspeed" },
  { value: "sumup", label: "SumUp" },
  { value: "zettle", label: "Zettle (PayPal)" },
  { value: "square", label: "Square" },
  { value: "tiller", label: "Tiller (SumUp)" },
  { value: "none", label: "Aucun" },
] as const;

export function POSConfigPanel() {
  const [provider, setProvider] = useState<PosProviderInput>("none");
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [config, setConfig] = useState<PosConfigDetailsInput>({});
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message?: string } | null>(null);

  // Queries
  const { data: currentConfig, isLoading, refetch } = trpc.business.pos.getConfig.useQuery();
  const { data: historyData } = trpc.business.pos.getSyncHistory.useQuery({ limit: 10 });

  // Mutations
  const updateConfig = trpc.business.pos.updateConfig.useMutation({
    onSuccess: () => {
      toast.success("Configuration POS mise à jour");
      refetch();
    },
    onError: (error) => toast.error(`Erreur: ${error.message}`),
  });

  const testConnection = trpc.business.pos.testConnection.useMutation({
    onSuccess: (data: any) => {
      setIsTesting(false);
      setTestResult({ success: data.success, message: data.error });
      if (data.success) toast.success("Connexion POS réussie !");
      else toast.error("Échec de la connexion POS");
    },
  });

  useEffect(() => {
    if (currentConfig) {
      setProvider(currentConfig.provider as PosProviderInput);
      setSyncEnabled(currentConfig.syncEnabled);
      setConfig((currentConfig.config as PosConfigDetailsInput) || {});
    }
  }, [currentConfig]);

  const handleSave = () => {
    updateConfig.mutate({
      provider,
      syncEnabled,
      config,
    });
  };

  const handleTest = () => {
    setIsTesting(true);
    testConnection.mutate({ provider, config });
  };

  const renderConfigFields = () => {
    if (provider === "none") return null;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
        {(provider === "lightspeed" || provider === "tiller") && (
          <div className="space-y-2">
            <Label>Clé API</Label>
            <Input 
              type="password" 
              value={(config as any)?.apiKey || ""} 
              onChange={(e: any) => setConfig({ ...config, apiKey: e.target.value })}
              placeholder="Entrez votre clé API"
            />
          </div>
        )}
        {(provider === "sumup" || provider === "square") && (
          <div className="space-y-2">
            <Label>Access Token</Label>
            <Input 
              type="password" 
              value={(config as any)?.accessToken || ""} 
              onChange={(e: any) => setConfig({ ...config, accessToken: e.target.value })}
              placeholder="OAuth Access Token"
            />
          </div>
        )}
        {provider === "zettle" && (
          <>
            <div className="space-y-2">
              <Label>Client ID</Label>
              <Input 
                value={(config as any)?.clientId || ""} 
                onChange={(e: any) => setConfig({ ...config, clientId: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Client Secret</Label>
              <Input 
                type="password"
                value={(config as any)?.clientSecret || ""} 
                onChange={(e: any) => setConfig({ ...config, clientSecret: e.target.value })}
              />
            </div>
          </>
        )}
        <div className="space-y-2">
          <Label>ID Marchand (Optionnel)</Label>
          <Input 
            value={(config as any)?.merchantId || ""} 
            onChange={(e: any) => setConfig({ ...config, merchantId: e.target.value })}
          />
        </div>
      </div>
    );
  };

  if (isLoading) return <div>Chargement de la configuration...</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            Connexion Caisse (POS)
          </CardTitle>
          <CardDescription>
            Connectez votre système de caisse pour synchroniser automatiquement les commandes IA.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="posProvider">Système de caisse</Label>
                <Select value={provider} onValueChange={(val: any) => setProvider(val)}>
                  <SelectTrigger id="posProvider">
                    <SelectValue placeholder="Choisir un provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {POS_PROVIDERS.map((p: any) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
                <div className="space-y-0.5">
                  <Label>Synchronisation automatique</Label>
                  <p className="text-xs text-muted-foreground">Envoyer les commandes IA directement à la caisse</p>
                </div>
                <Switch 
                  checked={syncEnabled} 
                  onCheckedChange={setSyncEnabled} 
                  disabled={provider === "none"}
                />
              </div>
            </div>

            <div className="flex-1 flex flex-col justify-center items-center p-6 border-2 border-dashed rounded-xl bg-muted/10">
              {testResult ? (
                <div className="text-center space-y-2">
                  {testResult.success ? (
                    <>
                      <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
                      <p className="font-bold text-green-600">Connexion Établie</p>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-12 h-12 text-red-500 mx-auto" />
                      <p className="font-bold text-red-600">Erreur de Connexion</p>
                      <p className="text-xs text-muted-foreground">{testResult.message}</p>
                    </>
                  )}
                  <Button variant="outline" size="sm" onClick={() => setTestResult(null)}>Réinitialiser</Button>
                </div>
              ) : (
                <div className="text-center space-y-4">
                  <RefreshCw className={`w-12 h-12 text-muted-foreground mx-auto ${isTesting ? 'animate-spin' : ''}`} />
                  <p className="text-sm text-muted-foreground">Testez vos identifiants avant d'activer</p>
                  <Button 
                    variant="secondary" 
                    onClick={handleTest} 
                    disabled={provider === "none" || isTesting}
                  >
                    {isTesting ? "Test en cours..." : "Tester la connexion"}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {renderConfigFields()}

          <div className="flex justify-end pt-4">
            <Button onClick={handleSave} disabled={updateConfig.isPending}>
              <Save className="w-4 h-4 mr-2" />
              {updateConfig.isPending ? "Enregistrement..." : "Enregistrer la configuration"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Historique de synchronisation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="w-5 h-5" />
            Dernières Synchronisations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>ID Commande</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>POS ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historyData?.history.map((order: PosSyncHistoryOutput) => (
                <TableRow key={order.id}>
                  <TableCell className="text-xs">
                    {new Date(order.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{order.crmOrderId}</TableCell>
                  <TableCell>{order.totalAmount} €</TableCell>
                  <TableCell>
                    <Badge variant={order.status === "synced" ? "default" : "destructive"}>
                      {order.status === "synced" ? "Synchronisé" : "Échec"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{order.posOrderId || "-"}</TableCell>
                </TableRow>
              ))}
              {(!historyData || historyData.history.length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                    Aucune synchronisation récente
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
