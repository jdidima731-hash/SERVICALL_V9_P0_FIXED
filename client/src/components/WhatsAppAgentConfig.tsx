import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { 
  MessageSquare, 
  Phone, 
  Calendar, 
  Mail, 
  Users, 
  FileText, 
  Clock, 
  ShieldCheck, 
  ChevronDown, 
  ChevronUp, 
  Save, 
  Loader2,
  CheckCircle2,
  Zap,
  RefreshCw
} from 'lucide-react';
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const CAPABILITIES = [
  { id: "crm", label: "Accès CRM", icon: Users, description: "Consulter et modifier les fiches prospects" },
  { id: "calendar", label: "Agenda", icon: Calendar, description: "Gérer vos rendez-vous et disponibilités" },
  { id: "calls", label: "Appels", icon: Phone, description: "Lancer des appels ou écouter des enregistrements" },
  { id: "email", label: "Email", icon: Mail, description: "Envoyer des emails de suivi ou résumés" },
  { id: "recruitment", label: "Recrutement", icon: FileText, description: "Analyser les CV et candidatures reçues" },
  { id: "briefing", label: "Briefing", icon: Zap, description: "Rapport vocal/texte matinal automatique" },
];

const CHAT_EXAMPLES = [
  { role: "user", text: "Quel est mon planning aujourd'hui ?" },
  { role: "agent", text: "Bonjour ! Vous avez 3 rendez-vous : \n1. 10h : Jean Dupont (Vente)\n2. 14h : Marie Curie (Suivi)\n3. 16h : Pierre Martin (Recrutement)" },
  { role: "user", text: "Appelle le prospect Jean Dupont" },
  { role: "agent", text: "C'est parti ! Je lance l'appel vers Jean Dupont (+33 6...) et je vous transfère le compte-rendu dès que c'est fini." },
];

export function WhatsAppAgentConfig() {
  const [isActive, setIsActive] = useState(true);
  const [ownerPhone, setOwnerPhone] = useState("");
  const [briefingTime, setBriefingTime] = useState("08:00");
  const [showTwilio, setShowTwilio] = useState(false);
  const [twilioSid, setTwilioSid] = useState("");
  const [twilioToken, setTwilioToken] = useState("");
  const [selectedCaps, setSelectedCaps] = useState<string[]>(["crm", "calendar", "briefing"]);
  const [initialized, setInitialized] = useState(false);

  // ✅ FIX: Charger la config existante au montage pour pré-remplir les champs
  const configQuery = trpc.core.tenant.getWhatsAppAgentConfig.useQuery(undefined, {
    staleTime: 30_000,
    retry: 1,
  });

  useEffect(() => {
    if (configQuery.data && !initialized) {
      const d = configQuery.data;
      setIsActive(d.isActive);
      setOwnerPhone(d.ownerWhatsappPhone);
      setBriefingTime(d.briefingTime);
      setTwilioSid(d.twilioSid ?? "");
      setTwilioToken(d.twilioToken ?? "");
      setSelectedCaps(d.capabilities.length > 0 ? d.capabilities : ["crm", "calendar", "briefing"]);
      setInitialized(true);
    }
  }, [configQuery.data, initialized]);

  const saveMutation = trpc.core.tenant.saveWhatsAppAgentConfig.useMutation({
    onSuccess: () => {
      toast.success("Configuration de l'Agent IA sauvegardée !");
      // Invalider le cache pour que la prochaine ouverture recharge les données fraîches
      configQuery.refetch();
    },
    onError: (err) => toast.error(err.message || "Erreur lors de la sauvegarde"),
  });

  const handleSave = () => {
    saveMutation.mutate({
      isActive,
      ownerWhatsappPhone: ownerPhone,
      briefingTime,
      twilioSid: twilioSid || undefined,
      twilioToken: twilioToken || undefined,
      capabilities: selectedCaps,
    });
  };

  const toggleCap = (id: string) => {
    setSelectedCaps(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  if (configQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Chargement de la configuration...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header & Status */}
      <div className="flex items-center justify-between p-4 bg-primary/5 border border-primary/10 rounded-2xl">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-xl">
            <MessageSquare className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-bold">Agent IA Personnel (WhatsApp)</h3>
            <p className="text-sm text-muted-foreground">Pilotez votre business par message vocal ou texte.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {configQuery.data?.updatedAt && (
            <span className="text-[10px] text-muted-foreground hidden sm:block">
              Dernière sauvegarde : {new Date(configQuery.data.updatedAt).toLocaleDateString("fr-FR")}
            </span>
          )}
          <div className="flex items-center gap-3 bg-background p-2 px-4 rounded-full border shadow-sm">
            <span className={cn("text-xs font-bold uppercase tracking-wider", isActive ? "text-green-600" : "text-slate-400")}>
              {isActive ? "Actif" : "Inactif"}
            </span>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Config */}
        <div className="lg:col-span-2 space-y-6">
          {/* Capabilities Grid */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-500" />
                Capacités de l'Agent
              </CardTitle>
              <CardDescription>Activez les modules que l'IA peut piloter pour vous.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {CAPABILITIES.map((cap) => (
                  <div 
                    key={cap.id}
                    onClick={() => toggleCap(cap.id)}
                    className={cn(
                      "p-3 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3",
                      selectedCaps.includes(cap.id) 
                        ? "border-primary bg-primary/5 shadow-sm" 
                        : "border-border hover:border-primary/30 bg-muted/20"
                    )}
                  >
                    <div className={cn(
                      "p-2 rounded-lg shrink-0",
                      selectedCaps.includes(cap.id) ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                    )}>
                      <cap.icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-bold">{cap.label}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{cap.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Owner Config */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                Configuration Personnelle
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="owner-phone" className="text-xs font-bold">Votre Numéro WhatsApp (Owner)</Label>
                  <Input 
                    id="owner-phone"
                    placeholder="+33 6 12 34 56 78"
                    value={ownerPhone}
                    onChange={(e) => setOwnerPhone(e.target.value)}
                    className="bg-muted/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="briefing-time" className="text-xs font-bold">Heure du Briefing Matinal</Label>
                  <select 
                    id="briefing-time"
                    value={briefingTime}
                    onChange={(e) => setBriefingTime(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-input bg-muted/30 text-sm"
                  >
                    {Array.from({ length: 6 }, (_, i) => i + 6).map(h => (
                      <React.Fragment key={h}>
                        <option value={`${h.toString().padStart(2, '0')}:00`}>{h}h00</option>
                        <option value={`${h.toString().padStart(2, '0')}:30`}>{h}h30</option>
                      </React.Fragment>
                    ))}
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Twilio Collapsible */}
          <Card className="border-border/50 shadow-sm overflow-hidden">
            <div 
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => setShowTwilio(!showTwilio)}
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-bold">Configuration Twilio (Avancé)</span>
              </div>
              {showTwilio ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
            {showTwilio && (
              <CardContent className="pt-0 pb-4 space-y-4 animate-in slide-in-from-top-2 duration-300">
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg mb-2">
                  <p className="text-[10px] text-blue-700 leading-relaxed">
                    Ces identifiants sont chiffrés en AES-256. Ils permettent à l'Agent IA d'utiliser votre propre compte Twilio pour les notifications WhatsApp.
                  </p>
                </div>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Account SID</Label>
                    <Input 
                      type="password" 
                      placeholder="AC..." 
                      value={twilioSid}
                      onChange={(e) => setTwilioSid(e.target.value)}
                      className="h-8 text-xs bg-muted/20"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Auth Token</Label>
                    <Input 
                      type="password" 
                      placeholder="••••••••" 
                      value={twilioToken}
                      onChange={(e) => setTwilioToken(e.target.value)}
                      className="h-8 text-xs bg-muted/20"
                    />
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        </div>

        {/* Chat Preview */}
        <div className="space-y-6">
          <Card className="border-border/50 shadow-md bg-slate-950 text-white overflow-hidden h-full flex flex-col">
            <CardHeader className="bg-slate-900/50 border-b border-white/10 py-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <CardTitle className="text-xs font-bold">Aperçu WhatsApp Agent</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-4 space-y-4 overflow-y-auto max-h-[400px]">
              {CHAT_EXAMPLES.map((msg, i) => (
                <div key={i} className={cn(
                  "max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed",
                  msg.role === "user" 
                    ? "bg-slate-800 ml-auto rounded-tr-none" 
                    : "bg-green-900/40 border border-green-500/20 mr-auto rounded-tl-none"
                )}>
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                </div>
              ))}
            </CardContent>
            <CardFooter className="p-3 bg-slate-900/50 border-t border-white/10">
              <div className="w-full h-8 bg-slate-800 rounded-full flex items-center px-3">
                <span className="text-[10px] text-slate-500 italic">Tapez une commande...</span>
              </div>
            </CardFooter>
          </Card>

          <Button 
            onClick={handleSave} 
            disabled={saveMutation.isPending}
            className="w-full h-12 rounded-xl shadow-lg shadow-primary/20 gap-2 font-bold"
          >
            {saveMutation.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            Sauvegarder l'Agent IA
          </Button>
        </div>
      </div>
    </div>
  );
}
