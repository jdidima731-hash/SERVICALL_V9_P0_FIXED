import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmailConfigCard } from "./EmailConfigCard";
import { ApiKeysMarketplace } from "./ApiKeysMarketplace";
import { WhatsAppAgentConfig } from "./WhatsAppAgentConfig";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ShoppingCart, 
  Globe, 
  Cloud, 
  MessageSquare, 
  Calendar, 
  ExternalLink, 
  Settings2,
  CheckCircle2,
  Plus,
  Mail,
  Key,
  Zap,
  Phone,
  Bell,
  Monitor,
  Clock,
  PhoneForwarded,
  Bot,
  Save,
  Loader2,
  AlertCircle,
  ArrowRight,
  Copy,
  Info
 } from 'lucide-react';
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";

interface IntegrationApp {
  id: string;
  name: string;
  description: string;
  category: "Caisse" | "Stockage" | "Web" | "Communication" | "API";
  icon: React.ComponentType<{ className?: string }>;
  status: "connected" | "disconnected" | "coming_soon";
  color: string;
}

const APPS: IntegrationApp[] = [
  {
    id: "pos",
    name: "Caisse Enregistreuse",
    description: "Synchronisez vos commandes IA avec Lightspeed, SumUp ou Square.",
    category: "Caisse",
    icon: ShoppingCart,
    status: "connected",
    color: "text-blue-500 bg-blue-500/10",
  },
  {
    id: "drive",
    name: "Google Drive",
    description: "Sauvegardez vos rapports et réservations sur Google Sheets.",
    category: "Stockage",
    icon: Cloud,
    status: "disconnected",
    color: "text-green-500 bg-green-500/10",
  },
  {
    id: "website",
    name: "API Site Web",
    description: "Connectez votre site WordPress ou Shopify via Webhooks.",
    category: "Web",
    icon: Globe,
    status: "disconnected",
    color: "text-purple-500 bg-purple-500/10",
  },
  {
    id: "whatsapp",
    name: "WhatsApp Client",
    description: "Envoyez des confirmations de commande et répondez aux clients.",
    category: "Communication",
    icon: MessageSquare,
    status: "connected",
    color: "text-emerald-500 bg-emerald-500/10",
  },
  {
    id: "calendar",
    name: "Google Calendar",
    description: "Synchronisation bidirectionnelle des rendez-vous.",
    category: "Communication",
    icon: Calendar,
    status: "disconnected",
    color: "text-red-500 bg-red-500/10",
  },
  {
    id: "custom-api",
    name: "API Personnalisée",
    description: "Ajoutez vos propres endpoints API pour une intégration sur mesure.",
    category: "API",
    icon: Key,
    status: "disconnected",
    color: "text-orange-500 bg-orange-500/10",
  },
];

// ─── Dialog WhatsApp : redirige vers l'onglet Agent IA ────────────────────────
function WhatsAppDialog({ onGoToAgent }: { onGoToAgent: () => void }) {
  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-emerald-500" />
          Configuration WhatsApp Client
        </DialogTitle>
        <DialogDescription>
          Envoyez des confirmations de commande et répondez aux clients via WhatsApp.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
          <Info className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-emerald-800">Configuration via l'onglet Agent IA</p>
            <p className="text-xs text-emerald-700 leading-relaxed">
              La configuration WhatsApp (numéro owner, Twilio, capacités de l'agent) se fait dans
              l'onglet <strong>Agent IA</strong> ci-dessus. Cliquez sur le bouton ci-dessous pour y accéder directement.
            </p>
          </div>
        </div>
        <div className="p-3 bg-muted/30 rounded-lg border text-xs text-muted-foreground space-y-1">
          <p className="font-semibold text-foreground">Ce que vous pouvez configurer :</p>
          <ul className="space-y-0.5 list-disc list-inside">
            <li>Numéro WhatsApp de l'owner</li>
            <li>Heure du briefing matinal automatique</li>
            <li>Identifiants Twilio (Account SID / Auth Token)</li>
            <li>Capacités de l'agent (CRM, agenda, appels…)</li>
          </ul>
        </div>
      </div>
      <DialogFooter>
        <Button className="w-full gap-2" onClick={onGoToAgent}>
          <Bot className="w-4 h-4" />
          Aller à l'onglet Agent IA
          <ArrowRight className="w-4 h-4 ml-auto" />
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ─── Dialog Google Drive : instructions Service Account ───────────────────────
function GoogleDriveDialog() {
  const [serviceAccountKey, setServiceAccountKey] = useState("");
  const [spreadsheetId, setSpreadsheetId] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const saveKeyMutation = trpc.byok.saveKey.useMutation({
    onSuccess: () => {
      toast.success("Clé Google Drive enregistrée !");
      setIsSaving(false);
    },
    onError: (err) => {
      toast.error(err.message || "Erreur lors de la sauvegarde");
      setIsSaving(false);
    },
  });

  const handleSave = () => {
    if (!serviceAccountKey.trim()) {
      toast.error("Veuillez coller le JSON de votre compte de service Google.");
      return;
    }
    try {
      JSON.parse(serviceAccountKey);
    } catch {
      toast.error("Le JSON du compte de service est invalide.");
      return;
    }
    setIsSaving(true);
    saveKeyMutation.mutate({ provider: "google_service_account", key: serviceAccountKey });
    if (spreadsheetId.trim()) {
      saveKeyMutation.mutate({ provider: "google_spreadsheet_id", key: spreadsheetId.trim() });
    }
  };

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Cloud className="w-5 h-5 text-green-500" />
          Configuration Google Drive
        </DialogTitle>
        <DialogDescription>
          Sauvegardez vos rapports et réservations sur Google Sheets via un compte de service.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4">
        {/* Instructions */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
          <p className="text-xs font-bold text-blue-800 flex items-center gap-1">
            <Info className="w-3.5 h-3.5" />
            Comment obtenir votre clé de service
          </p>
          <ol className="text-[11px] text-blue-700 space-y-1 list-decimal list-inside leading-relaxed">
            <li>Ouvrez <strong>Google Cloud Console</strong> → IAM &amp; Admin → Comptes de service</li>
            <li>Créez un compte de service ou sélectionnez-en un existant</li>
            <li>Onglet <strong>Clés</strong> → Ajouter une clé → JSON</li>
            <li>Partagez votre Google Sheet avec l'email du compte de service</li>
          </ol>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            JSON du compte de service Google *
          </Label>
          <textarea
            className="w-full h-28 px-3 py-2 rounded-md border border-input bg-muted/20 text-xs font-mono resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder={'{\n  "type": "service_account",\n  "project_id": "...",\n  "private_key": "...",\n  ...\n}'}
            value={serviceAccountKey}
            onChange={(e) => setServiceAccountKey(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="spreadsheet-id" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            ID du Google Sheet (optionnel)
          </Label>
          <Input
            id="spreadsheet-id"
            placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
            value={spreadsheetId}
            onChange={(e) => setSpreadsheetId(e.target.value)}
            className="text-xs bg-muted/20"
          />
          <p className="text-[10px] text-muted-foreground">
            Retrouvez l'ID dans l'URL de votre Sheet : docs.google.com/spreadsheets/d/<strong>[ID]</strong>/edit
          </p>
        </div>
      </div>
      <DialogFooter>
        <Button className="w-full gap-2" onClick={handleSave} disabled={isSaving}>
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Enregistrer la configuration
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ─── Dialog API Site Web : webhook URL + secret ───────────────────────────────
function WebsiteApiDialog() {
  const [webhookSecret, setWebhookSecret] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const saveKeyMutation = trpc.byok.saveKey.useMutation({
    onSuccess: () => {
      toast.success("Configuration Webhook enregistrée !");
      setIsSaving(false);
    },
    onError: (err) => {
      toast.error(err.message || "Erreur lors de la sauvegarde");
      setIsSaving(false);
    },
  });

  const webhookUrl = `${window.location.origin}/api/webhooks/site`;

  const handleCopy = () => {
    navigator.clipboard.writeText(webhookUrl).then(() => toast.success("URL copiée !"));
  };

  const handleSave = () => {
    if (!webhookSecret.trim()) {
      toast.error("Veuillez saisir un secret de webhook.");
      return;
    }
    setIsSaving(true);
    saveKeyMutation.mutate({ provider: "webhook_site_secret", key: webhookSecret.trim() });
  };

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-purple-500" />
          API Site Web — Webhook
        </DialogTitle>
        <DialogDescription>
          Connectez votre site WordPress ou Shopify pour recevoir des événements en temps réel.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            URL du Webhook à configurer sur votre site
          </Label>
          <div className="flex gap-2">
            <Input
              readOnly
              value={webhookUrl}
              className="text-xs bg-muted/20 font-mono"
            />
            <Button variant="outline" size="icon" onClick={handleCopy}>
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="webhook-secret" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Secret de signature (HMAC-SHA256) *
          </Label>
          <Input
            id="webhook-secret"
            type="password"
            placeholder="whsec_..."
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
            className="bg-muted/20"
          />
          <p className="text-[10px] text-muted-foreground">
            Définissez ce secret dans votre plugin WordPress / Shopify pour sécuriser les appels entrants.
          </p>
        </div>
        <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">Synchronisation auto</Label>
            <p className="text-xs text-muted-foreground">Mise à jour toutes les 15 minutes</p>
          </div>
          <Switch defaultChecked />
        </div>
      </div>
      <DialogFooter>
        <Button className="w-full gap-2" onClick={handleSave} disabled={isSaving}>
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Enregistrer la configuration
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ─── Dialog Google Calendar : OAuth ──────────────────────────────────────────
function GoogleCalendarDialog() {
  const [isConnecting, setIsConnecting] = useState(false);

  const handleOAuth = () => {
    setIsConnecting(true);
    // Redirection vers le flux OAuth Google Calendar
    window.location.href = "/api/auth/google-calendar";
  };

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-red-500" />
          Google Calendar — OAuth
        </DialogTitle>
        <DialogDescription>
          Synchronisation bidirectionnelle des rendez-vous avec votre agenda Google.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <Info className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-red-800">Connexion via OAuth 2.0</p>
            <p className="text-xs text-red-700 leading-relaxed">
              Cliquez sur le bouton ci-dessous pour vous connecter à votre compte Google.
              Vous serez redirigé vers la page d'autorisation Google, puis ramené ici automatiquement.
            </p>
          </div>
        </div>
        <div className="p-3 bg-muted/30 rounded-lg border text-xs text-muted-foreground space-y-1">
          <p className="font-semibold text-foreground">Permissions demandées :</p>
          <ul className="space-y-0.5 list-disc list-inside">
            <li>Lecture et écriture des événements de votre agenda</li>
            <li>Accès aux calendriers partagés</li>
          </ul>
        </div>
      </div>
      <DialogFooter>
        <Button className="w-full gap-2" onClick={handleOAuth} disabled={isConnecting}>
          {isConnecting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Calendar className="w-4 h-4" />
          )}
          Connecter Google Calendar
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ─── Dialog API Personnalisée ─────────────────────────────────────────────────
function CustomApiDialog() {
  const [apiKey, setApiKey] = useState("");
  const [apiEndpoint, setApiEndpoint] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const saveKeyMutation = trpc.byok.saveKey.useMutation({
    onSuccess: () => {
      toast.success("Configuration API personnalisée enregistrée !");
      setIsSaving(false);
    },
    onError: (err) => {
      toast.error(err.message || "Erreur lors de la sauvegarde");
      setIsSaving(false);
    },
  });

  const handleSave = () => {
    if (!apiEndpoint.trim()) {
      toast.error("Veuillez saisir l'URL de votre endpoint API.");
      return;
    }
    setIsSaving(true);
    if (apiKey.trim()) {
      saveKeyMutation.mutate({ provider: "custom_api_key", key: apiKey.trim() });
    }
    if (apiEndpoint.trim()) {
      saveKeyMutation.mutate({ provider: "custom_api_endpoint", key: apiEndpoint.trim() });
    }
    if (!apiKey.trim()) {
      toast.success("Endpoint API enregistré !");
      setIsSaving(false);
    }
  };

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Key className="w-5 h-5 text-orange-500" />
          API Personnalisée
        </DialogTitle>
        <DialogDescription>
          Ajoutez vos propres endpoints API pour une intégration sur mesure.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="api-endpoint" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            URL de l'endpoint API *
          </Label>
          <Input
            id="api-endpoint"
            placeholder="https://api.monsite.com/v1/webhook"
            value={apiEndpoint}
            onChange={(e) => setApiEndpoint(e.target.value)}
            className="bg-muted/20"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="custom-api-key" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Clé API (optionnel)
          </Label>
          <Input
            id="custom-api-key"
            type="password"
            placeholder="Bearer sk-..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="bg-muted/20"
          />
        </div>
        <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">Synchronisation auto</Label>
            <p className="text-xs text-muted-foreground">Mise à jour toutes les 15 minutes</p>
          </div>
          <Switch defaultChecked />
        </div>
      </div>
      <DialogFooter>
        <Button className="w-full gap-2" onClick={handleSave} disabled={isSaving}>
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Enregistrer la configuration
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────
export function IntegrationMarketplace({ onConfigurePOS }: { onConfigurePOS?: () => void }) {
  const [activeTab, setActiveTab] = useState<string>("apps");
  const [callbackConfig, setCallbackConfig] = useState({
    callbackPhone: "",
    callbackNotifyMode: "crm" as "crm" | "phone" | "both",
    isAvailableForTransfer: true,
  });
  const [callbackConfigLoading, setCallbackConfigLoading] = useState(false);
  const [callbackConfigSaving, setCallbackConfigSaving] = useState(false);
  const [pendingCallbacks, setPendingCallbacks] = useState<any[]>([]);
  const [callbacksLoading, setCallbacksLoading] = useState(false);

  useEffect(() => {
    if (activeTab === "callbacks") {
      loadCallbackConfig();
      loadCallbacks();
    }
  }, [activeTab]);

  async function loadCallbackConfig() {
    setCallbackConfigLoading(true);
    try {
      const res = await fetch("/api/callbacks/config", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setCallbackConfig({
          callbackPhone: data.data?.callbackPhone ?? "",
          callbackNotifyMode: data.data?.callbackNotifyMode ?? "crm",
          isAvailableForTransfer: data.data?.isAvailableForTransfer ?? true,
        });
      }
    } catch { /* silencieux */ }
    finally { setCallbackConfigLoading(false); }
  }

  async function loadCallbacks() {
    setCallbacksLoading(true);
    try {
      const res = await fetch("/api/callbacks?limit=15", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setPendingCallbacks(data.data ?? []);
      }
    } catch { /* silencieux */ }
    finally { setCallbacksLoading(false); }
  }

  async function saveCallbackConfig() {
    setCallbackConfigSaving(true);
    try {
      const res = await fetch("/api/callbacks/config", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(callbackConfig),
      });
      if (res.ok) {
        toast.success("Configuration rappels sauvegardée ✅");
      } else {
        const err = await res.json();
        toast.error(err.error ?? "Erreur de sauvegarde");
      }
    } catch { toast.error("Erreur réseau"); }
    finally { setCallbackConfigSaving(false); }
  }

  // Rendu du dialog spécifique à chaque app
  const renderAppDialog = (app: IntegrationApp) => {
    switch (app.id) {
      case "whatsapp":
        return (
          <WhatsAppDialog
            onGoToAgent={() => setActiveTab("agent")}
          />
        );
      case "drive":
        return <GoogleDriveDialog />;
      case "website":
        return <WebsiteApiDialog />;
      case "calendar":
        return <GoogleCalendarDialog />;
      case "custom-api":
        return <CustomApiDialog />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">App Marketplace</h2>
          <p className="text-muted-foreground">Connectez vos outils préférés en quelques secondes.</p>
        </div>
        <Button className="gap-2" onClick={() => toast.success("Merci pour votre suggestion !")}>
          <Plus className="w-4 h-4" />
          Suggérer une App
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 bg-muted/50 p-1 rounded-xl border border-border">
          <TabsTrigger value="apps" className="gap-2 rounded-lg">
            <ShoppingCart className="w-4 h-4" />
            <span className="hidden sm:inline">Apps</span>
          </TabsTrigger>
          <TabsTrigger value="agent" className="gap-2 rounded-lg">
            <Bot className="w-4 h-4" />
            <span className="hidden sm:inline">Agent IA</span>
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-2 rounded-lg">
            <Mail className="w-4 h-4" />
            <span className="hidden sm:inline">Email</span>
          </TabsTrigger>
          <TabsTrigger value="keys" className="gap-2 rounded-lg">
            <Key className="w-4 h-4" />
            <span className="hidden sm:inline">Clés API</span>
          </TabsTrigger>
          <TabsTrigger value="callbacks" className="gap-2 rounded-lg relative">
            <PhoneForwarded className="w-4 h-4" />
            <span className="hidden sm:inline">Rappels</span>
            {pendingCallbacks.filter(c => c.status === "pending" || c.status === "notified").length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                {pendingCallbacks.filter(c => c.status === "pending" || c.status === "notified").length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="apps" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {APPS.map((app) => (
              <Dialog key={app.id}>
                <Card className={cn(
                  "relative overflow-hidden transition-all hover:shadow-md border-border/50",
                  app.status === "coming_soon" && "opacity-70 grayscale-[0.5]"
                )}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div className={cn("p-2 rounded-lg", app.color)}>
                        <app.icon className="w-6 h-6" />
                      </div>
                      <Badge variant={
                        app.status === "connected" ? "default" : 
                        app.status === "coming_soon" ? "secondary" : "outline"
                      }>
                        {app.status === "connected" ? "Connecté" : 
                         app.status === "coming_soon" ? "Bientôt" : "Disponible"}
                      </Badge>
                    </div>
                    <CardTitle className="mt-4 text-lg">{app.name}</CardTitle>
                    <CardDescription className="line-clamp-2 min-h-[40px]">
                      {app.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{app.category}</span>
                      {app.status === "connected" && (
                        <div className="flex items-center gap-1 text-green-600 font-medium">
                          <CheckCircle2 className="w-4 h-4" />
                          Actif
                        </div>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter className="pt-2 border-t bg-muted/5">
                    <div className="flex w-full gap-2">
                      {app.id === "pos" ? (
                        <Button 
                          variant="outline" 
                          className="flex-1 gap-2"
                          onClick={() => onConfigurePOS?.()}
                        >
                          <Settings2 className="w-4 h-4" />
                          Configurer
                        </Button>
                      ) : (
                        <DialogTrigger asChild>
                          <Button 
                            variant={app.status === "connected" ? "outline" : "default"} 
                            className="flex-1 gap-2"
                            disabled={app.status === "coming_soon"}
                          >
                            <Settings2 className="w-4 h-4" />
                            {app.status === "connected" ? "Configurer" : "Installer"}
                          </Button>
                        </DialogTrigger>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => toast.info(`Ouverture de la documentation ${app.name}`)}>
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardFooter>
                </Card>

                {/* Dialog spécifique à chaque app */}
                {renderAppDialog(app)}
              </Dialog>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="agent" className="pt-4">
          <WhatsAppAgentConfig />
        </TabsContent>

        <TabsContent value="email" className="space-y-4 pt-4">
          <EmailConfigCard />
        </TabsContent>

        <TabsContent value="keys" className="space-y-4 pt-4">
          <ApiKeysMarketplace />
        </TabsContent>

        <TabsContent value="callbacks" className="space-y-4 pt-4">
          <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/20 rounded-xl">
            <div className="p-2 bg-primary/10 rounded-lg shrink-0">
              <PhoneForwarded className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Rappels intelligents</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Quand l'IA ne peut pas répondre ou qu'un humain est demandé, un rappel automatique
                est planifié. Configurez comment vous souhaitez être notifié.
              </p>
            </div>
          </div>

          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-primary" />
                Mes préférences de rappel
              </CardTitle>
              <CardDescription>
                Choisissez comment recevoir les notifications de rappels clients
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {callbackConfigLoading ? (
                <div className="h-24 flex items-center justify-center text-muted-foreground text-sm">
                  Chargement...
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        callbackConfig.isAvailableForTransfer ? "bg-green-500" : "bg-gray-400"
                      )} />
                      <div>
                        <p className="text-sm font-medium">Disponible pour transfert</p>
                        <p className="text-xs text-muted-foreground">
                          {callbackConfig.isAvailableForTransfer
                            ? "L'IA peut vous transférer des appels en direct"
                            : "Les appels seront planifiés en rappel automatiquement"}
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={callbackConfig.isAvailableForTransfer}
                      onCheckedChange={(v: any) =>
                        setCallbackConfig((c) => ({ ...c, isAvailableForTransfer: v }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Mode de notification</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: "crm",   icon: Monitor,    label: "CRM uniquement",    desc: "Notification dans l'interface" },
                        { value: "phone", icon: Phone,      label: "Téléphone",          desc: "Appel sur votre numéro" },
                        { value: "both",  icon: Bell,       label: "Les deux",           desc: "CRM + appel téléphonique" },
                      ].map(({ value, icon: Icon, label, desc }) => (
                        <div
                          key={value}
                          onClick={() =>
                            setCallbackConfig((c) => ({ ...c, callbackNotifyMode: value as any }))
                          }
                          className={cn(
                            "p-3 rounded-xl border-2 cursor-pointer transition-all text-center",
                            callbackConfig.callbackNotifyMode === value
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/40"
                          )}
                        >
                          <Icon className={cn(
                            "w-5 h-5 mx-auto mb-1",
                            callbackConfig.callbackNotifyMode === value ? "text-primary" : "text-muted-foreground"
                          )} />
                          <p className="text-xs font-semibold">{label}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {(callbackConfig.callbackNotifyMode === "phone" || callbackConfig.callbackNotifyMode === "both") && (
                    <div className="space-y-2">
                      <Label htmlFor="callback-phone" className="text-sm font-medium flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-primary" />
                        Votre numéro de rappel
                      </Label>
                      <Input
                        id="callback-phone"
                        type="tel"
                        placeholder="+33 6 12 34 56 78"
                        value={callbackConfig.callbackPhone ?? ""}
                        onChange={(e: any) =>
                          setCallbackConfig((c) => ({ ...c, callbackPhone: e.target.value }))
                        }
                        className="bg-muted/30 border-border"
                      />
                    </div>
                  )}

                  <Button
                    onClick={saveCallbackConfig}
                    disabled={callbackConfigSaving}
                    className="w-full gap-2"
                  >
                    {callbackConfigSaving ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    Enregistrer la configuration
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  Rappels planifiés
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadCallbacks}
                  className="text-xs"
                >
                  Actualiser
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {callbacksLoading ? (
                <div className="h-16 flex items-center justify-center text-muted-foreground text-sm">
                  Chargement...
                </div>
              ) : pendingCallbacks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Aucun rappel en attente.
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingCallbacks.map((c) => (
                    <div key={c.id} className="p-3 rounded-lg border border-border bg-muted/10 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold">{c.prospectName || "Prospect inconnu"}</p>
                        <p className="text-xs text-muted-foreground">{c.prospectPhone}</p>
                      </div>
                      <Badge variant="outline">{c.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
