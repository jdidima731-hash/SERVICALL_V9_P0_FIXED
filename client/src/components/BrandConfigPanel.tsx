
/**
 * BrandConfigPanel — Configuration de la Personnalité IA de Marque
 * ─────────────────────────────────────────────────────────────────
 * Interface client pour configurer :
 *  · Identité de marque (nom, slogan, ton, langue)
 *  · Rôle et mission de l'IA
 *  · Numéro de téléphone, email, horaires → intégrés dans les réponses
 *  · URL du site web → scraping automatique du contenu
 *  · FAQ personnalisées
 *  · Activation des canaux (WhatsApp, Messenger, Instagram, TikTok)
 *  · Aperçu en temps réel de la réponse IA
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bot, Globe, Phone, Mail, Clock, MessageCircle,
  Sparkles, Eye, Plus, Trash2, Save, RefreshCw,
  Instagram, Facebook, MessageSquare, Loader2,
  ChevronRight, Info, Zap, Settings
 } from 'lucide-react';

// Icône TikTok SVG custom
const TikTokIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.76a4.85 4.85 0 01-1.01-.07z"/>
  </svg>
);

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

interface FAQItem { question: string; answer: string; }

export default function BrandConfigPanel() {
  const [activeTab, setActiveTab] = useState("identity");
  const [isSaving, setIsSaving] = useState(false);
  const [isScrapingUrl, setIsScrapingUrl] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewChannel, setPreviewChannel] = useState<string>("whatsapp");
  const [testMessage, setTestMessage] = useState("Bonjour, quels sont vos tarifs ?");
  const [previewResult, setPreviewResult] = useState<{ prompt: string; sampleReply: string } | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: config, refetch } = trpc.core.tenant.getBrandAIConfig.useQuery();

  // ── State local ───────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    aiRole: "", aiMission: "", tagline: "", tone: "friendly", language: "auto",
    phoneNumber: "", email: "", address: "", businessHours: "", escalationMessage: "",
    websiteUrl: "", scrapedContent: "", customPricingText: "", customInstructions: "",
    includePricing: true, includeProducts: true,
    allowedTopics: ["produits", "tarifs", "rendez-vous"],
    forbiddenTopics: [] as string[],
    faqItems: [] as FAQItem[],
  });

  const [channels, setChannels] = useState({
    whatsapp: false, messenger: false,
    instagram_dm: false, instagram_comment: false,
    tiktok_comment: false, social_manager: false,
    autoReply: { messenger: false, instagram_dm: false, instagram_comment: false, tiktok_comment: false },
  });

  // Synchroniser avec les données DB
  if (config && !isSaving) {
    const synced = {
      aiRole: config.aiRole ?? form.aiRole,
      aiMission: config.aiMission ?? form.aiMission,
      tagline: config.tagline ?? form.tagline,
      tone: config.tone ?? form.tone,
      language: config.language ?? form.language,
      phoneNumber: config.phoneNumber ?? form.phoneNumber,
      email: config.email ?? form.email,
      address: config.address ?? form.address,
      businessHours: config.businessHours ?? form.businessHours,
      escalationMessage: config.escalationMessage ?? form.escalationMessage,
      websiteUrl: config.websiteUrl ?? form.websiteUrl,
      scrapedContent: config.scrapedContent ?? form.scrapedContent,
      customPricingText: config.customPricingText ?? form.customPricingText,
      customInstructions: config.customInstructions ?? form.customInstructions,
      includePricing: config.includePricing ?? form.includePricing,
      includeProducts: config.includeProducts ?? form.includeProducts,
      allowedTopics: config.allowedTopics ?? form.allowedTopics,
      forbiddenTopics: config.forbiddenTopics ?? form.forbiddenTopics,
      faqItems: config.faqItems ?? form.faqItems,
    };
    if (JSON.stringify(synced) !== JSON.stringify(form)) Object.assign(form, synced);
    if (config.channelSettings) Object.assign(channels, config.channelSettings);
  }

  // ── Mutations ────────────────────────────────────────────────────────────
  const updateBrandMutation = trpc.core.tenant.updateBrandAIConfig.useMutation({
    onSuccess: () => { toast.success("Configuration sauvegardée ✓"); refetch(); setIsSaving(false); },
    onError: (e: any) => { toast.error(`Erreur : ${e.message}`); setIsSaving(false); },
  });

  const updateChannelMutation = trpc.core.tenant.updateChannelSettings.useMutation({
    onSuccess: () => { toast.success("Canaux mis à jour ✓"); refetch(); },
    onError: (e: any) => toast.error(`Erreur : ${e.message}`),
  });

  const scrapeWebsiteMutation = trpc.core.tenant.scrapeWebsite.useMutation({
    onSuccess: (data: any) => {
      setForm((f) => ({ ...f, scrapedContent: data.content }));
      toast.success("Contenu du site extrait et résumé ✓");
      setIsScrapingUrl(false);
    },
    onError: (e: any) => { toast.error(`Scraping échoué : ${e.message}`); setIsScrapingUrl(false); },
  });

  const previewMutation = trpc.core.tenant.previewBrandAI.useMutation({
    onSuccess: (data: any) => { setPreviewResult(data); setIsPreviewing(false); },
    onError: (e: any) => { toast.error(`Aperçu échoué : ${e.message}`); setIsPreviewing(false); },
  });

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleSaveBrand = () => {
    setIsSaving(true);
    updateBrandMutation.mutate(form as Parameters<typeof updateBrandMutation.mutate>[0]);
  };

  const handleChannelToggle = (key: string, value: boolean, isAutoReply = false) => {
    if (isAutoReply) {
      const newAutoReply = { ...channels.autoReply, [key]: value };
      setChannels((c) => ({ ...c, autoReply: newAutoReply }));
      
      updateChannelMutation.mutate({ autoReply: newAutoReply });
    } else {
      setChannels((c) => ({ ...c, [key]: value }));
      updateChannelMutation.mutate({ [key]: value });
    }
  };

  const handleScrape = () => {
    if (!form.websiteUrl) return toast.error("Entrez une URL d'abord");
    setIsScrapingUrl(true);
    scrapeWebsiteMutation.mutate({ url: form.websiteUrl });
  };

  const handlePreview = () => {
    setIsPreviewing(true);
    previewMutation.mutate({ channel: previewChannel as "whatsapp", testMessage });
  };

  const addFAQ = () => setForm((f) => ({ ...f, faqItems: [...f.faqItems, { question: "", answer: "" }] }));
  const removeFAQ = (i: number) => setForm((f) => ({ ...f, faqItems: f.faqItems.filter((_, idx) => idx !== i) }));
  const updateFAQ = (i: number, field: "question" | "answer", val: string) =>
    setForm((f) => { const items = [...f.faqItems]; items[i] = { ...items[i], [field]: val }; return { ...f, faqItems: items }; });

  // ── UI ────────────────────────────────────────────────────────────────────
  const channelList = [
    { key: "whatsapp", label: "WhatsApp IA 24/7", icon: <WhatsAppIcon className="w-4 h-4" />, color: "text-green-500", desc: "Répond automatiquement à tous les messages WhatsApp", hasAutoReply: false },
    { key: "messenger", label: "Facebook Messenger", icon: <Facebook className="w-4 h-4" />, color: "text-blue-500", desc: "Répond aux messages privés sur votre page Facebook", hasAutoReply: true },
    { key: "instagram_dm", label: "Instagram DM", icon: <Instagram className="w-4 h-4" />, color: "text-pink-500", desc: "Répond aux messages directs Instagram", hasAutoReply: true },
    { key: "instagram_comment", label: "Commentaires Instagram", icon: <Instagram className="w-4 h-4" />, color: "text-purple-500", desc: "Répond aux commentaires publics sur vos posts", hasAutoReply: true },
    { key: "tiktok_comment", label: "Commentaires TikTok", icon: <TikTokIcon className="w-4 h-4" />, color: "text-slate-700", desc: "Répond aux commentaires sur vos vidéos TikTok", hasAutoReply: true },
    { key: "social_manager", label: "Gestionnaire Social Media", icon: <Sparkles className="w-4 h-4" />, color: "text-amber-500", desc: "Accès au module publication & planification multi-plateformes", hasAutoReply: false },
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-xl">
          <Bot className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Configuration IA de Marque</h1>
          <p className="text-muted-foreground text-sm">Définissez la personnalité, les connaissances et les canaux de votre assistant IA</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="identity" className="gap-1.5"><Bot className="w-4 h-4" />Identité</TabsTrigger>
          <TabsTrigger value="knowledge" className="gap-1.5"><Globe className="w-4 h-4" />Connaissances</TabsTrigger>
          <TabsTrigger value="channels" className="gap-1.5"><MessageCircle className="w-4 h-4" />Canaux</TabsTrigger>
          <TabsTrigger value="preview" className="gap-1.5"><Eye className="w-4 h-4" />Aperçu</TabsTrigger>
        </TabsList>

        {/* ── ONGLET 1 : IDENTITÉ ──────────────────────────────────────── */}
        <TabsContent value="identity" className="space-y-4 pt-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Personnalité de l'assistant</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Rôle de l'IA</Label>
                  <Input placeholder="ex: assistante commerciale, support client..." value={form.aiRole} onChange={(e: any) => setForm((f) => ({ ...f, aiRole: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Slogan / tagline</Label>
                  <Input placeholder="ex: Votre expert en cuisine méditerranéenne" value={form.tagline} onChange={(e: any) => setForm((f) => ({ ...f, tagline: e.target.value }))} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Mission de l'IA <span className="text-muted-foreground text-xs">(décrivez précisément ce que l'IA doit faire)</span></Label>
                <Textarea
                  placeholder="ex: Tu es l'assistante de la boutique Zara Tunis. Tu renseignes les clients sur nos collections, nos horaires et tu les orientes vers notre boutique au Lac 2. Tu ne parles jamais de prix sans avoir vérifié la disponibilité. Si quelqu'un veut un devis, tu prends son numéro et tu transmets à l'équipe."
                  rows={4} value={form.aiMission}
                  onChange={(e: any) => setForm((f) => ({ ...f, aiMission: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Ton de la communication</Label>
                  <Select value={form.tone} onValueChange={(v: any) => setForm((f) => ({ ...f, tone: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="friendly">Chaleureux et accessible</SelectItem>
                      <SelectItem value="formal">Professionnel et formel</SelectItem>
                      <SelectItem value="dynamic">Dynamique et enthousiaste</SelectItem>
                      <SelectItem value="luxury">Élégant et haut de gamme</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Langue de réponse</Label>
                  <Select value={form.language} onValueChange={(v: any) => setForm((f) => ({ ...f, language: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto-détection (recommandé)</SelectItem>
                      <SelectItem value="fr">Français uniquement</SelectItem>
                      <SelectItem value="ar">Arabe standard</SelectItem>
                      <SelectItem value="dar">Darija marocain</SelectItem>
                      <SelectItem value="tun">Tunisien</SelectItem>
                      <SelectItem value="alg">Algérien</SelectItem>
                      <SelectItem value="en">Anglais</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Coordonnées & Horaires</CardTitle><CardDescription>Intégrées automatiquement dans les réponses IA</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />Numéro de téléphone</Label>
                  <Input placeholder="+216 XX XXX XXX" value={form.phoneNumber} onChange={(e: any) => setForm((f) => ({ ...f, phoneNumber: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" />Email de contact</Label>
                  <Input placeholder="contact@votre-marque.com" value={form.email} onChange={(e: any) => setForm((f) => ({ ...f, email: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Adresse</Label>
                <Input placeholder="ex: Avenue de la Liberté, Tunis 1002" value={form.address} onChange={(e: any) => setForm((f) => ({ ...f, address: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />Horaires d'ouverture</Label>
                <Input placeholder="ex: Lundi-Vendredi 9h-18h, Samedi 10h-14h" value={form.businessHours} onChange={(e: any) => setForm((f) => ({ ...f, businessHours: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Message d'escalade <span className="text-muted-foreground text-xs">(quand l'IA ne sait pas répondre)</span></Label>
                <Input placeholder="ex: Je transmets votre demande à notre équipe qui vous rappellera sous 2h." value={form.escalationMessage} onChange={(e: any) => setForm((f) => ({ ...f, escalationMessage: e.target.value }))} />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSaveBrand} disabled={isSaving} className="gap-2">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Sauvegarder l'identité
            </Button>
          </div>
        </TabsContent>

        {/* ── ONGLET 2 : CONNAISSANCES ──────────────────────────────────── */}
        <TabsContent value="knowledge" className="space-y-4 pt-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Globe className="w-4 h-4" />Contenu de votre site web</CardTitle>
              <CardDescription>L'IA lira cette page pour comprendre vos produits, services et tarifs</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input placeholder="https://votre-site.com/a-propos" value={form.websiteUrl} onChange={(e: any) => setForm((f) => ({ ...f, websiteUrl: e.target.value }))} className="flex-1" />
                <Button variant="outline" onClick={handleScrape} disabled={isScrapingUrl} className="gap-2 shrink-0">
                  {isScrapingUrl ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  {isScrapingUrl ? "Analyse..." : "Analyser"}
                </Button>
              </div>
              {form.scrapedContent && (
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-green-600"><Zap className="w-3.5 h-3.5" />Contenu extrait et résumé</Label>
                  <Textarea rows={6} value={form.scrapedContent} onChange={(e: any) => setForm((f) => ({ ...f, scrapedContent: e.target.value }))} className="font-mono text-xs" />
                  <p className="text-xs text-muted-foreground">Vous pouvez éditer ce contenu manuellement pour préciser les informations.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Tarifs & Produits</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <p className="font-medium text-sm">Inclure le catalogue produits</p>
                  <p className="text-xs text-muted-foreground">L'IA connaît vos produits/services configurés dans le CRM</p>
                </div>
                <Switch checked={form.includeProducts} onCheckedChange={(v: any) => setForm((f) => ({ ...f, includeProducts: v }))} />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <p className="font-medium text-sm">Inclure les tarifs</p>
                  <p className="text-xs text-muted-foreground">L'IA communique les prix depuis votre catalogue</p>
                </div>
                <Switch checked={form.includePricing} onCheckedChange={(v: any) => setForm((f) => ({ ...f, includePricing: v }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Informations tarifaires complémentaires</Label>
                <Textarea placeholder="ex: Nos tarifs sont TTC. Livraison gratuite dès 50€. Devis personnalisé sur demande pour les commandes pro. Paiement en 3x sans frais disponible." rows={3} value={form.customPricingText} onChange={(e: any) => setForm((f) => ({ ...f, customPricingText: e.target.value }))} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>Questions Fréquentes (FAQ)</span>
                <Button size="sm" variant="outline" onClick={addFAQ} className="gap-1.5 h-8"><Plus className="w-3.5 h-3.5" />Ajouter</Button>
              </CardTitle>
              <CardDescription>L'IA utilisera ces réponses en priorité pour les questions connues</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {form.faqItems.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Aucune FAQ. Ajoutez des Q&R pour améliorer les réponses.</p>
              )}
              {form.faqItems.map((item, i) => (
                <div key={i} className="flex gap-2 p-3 rounded-lg border">
                  <div className="flex-1 space-y-2">
                    <Input placeholder="Question client" value={item.question} onChange={(e: any) => updateFAQ(i, "question", e.target.value)} className="text-sm" />
                    <Textarea placeholder="Réponse de l'IA" value={item.answer} onChange={(e: any) => updateFAQ(i, "answer", e.target.value)} rows={2} className="text-sm" />
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => removeFAQ(i)} className="h-8 w-8 text-red-500 self-start"><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Instructions spéciales</CardTitle></CardHeader>
            <CardContent>
              <Textarea
                placeholder="ex: Toujours demander le numéro de commande avant de traiter une réclamation. Ne jamais confirmer une disponibilité sans consulter le stock. Proposer systématiquement notre offre promotionnelle du mois."
                rows={4} value={form.customInstructions}
                onChange={(e: any) => setForm((f) => ({ ...f, customInstructions: e.target.value }))}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSaveBrand} disabled={isSaving} className="gap-2">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Sauvegarder les connaissances
            </Button>
          </div>
        </TabsContent>

        {/* ── ONGLET 3 : CANAUX ─────────────────────────────────────────── */}
        <TabsContent value="channels" className="space-y-4 pt-2">
          <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
            <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
            <p className="text-sm text-blue-800 dark:text-blue-300">
              Activez uniquement les canaux dont vous avez connecté les comptes. Les canaux désactivés ne répondront pas même si un webhook reçoit un message.
            </p>
          </div>

          <div className="space-y-3">
            {channelList.map((ch) => (
              <Card key={ch.key} className="overflow-hidden">
                <div className="flex items-center gap-4 p-4">
                  <div className={`p-2 rounded-lg bg-muted ${ch.color}`}>{ch.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{ch.label}</p>
                      {channels[ch.key as keyof typeof channels] === true && (
                        <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 text-xs">Actif</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{ch.desc}</p>
                  </div>
                  <Switch
                    checked={channels[ch.key as keyof typeof channels] === true}
                    onCheckedChange={(v: any) => handleChannelToggle(ch.key, v)}
                  />
                </div>
                {ch.hasAutoReply && channels[ch.key as keyof typeof channels] === true && (
                  <div className="border-t px-4 py-3 bg-muted/30 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium">Réponse automatique IA</p>
                      <p className="text-xs text-muted-foreground">L'IA répond immédiatement sans intervention humaine</p>
                    </div>
                    <Switch
                      checked={channels.autoReply[ch.key as keyof typeof channels.autoReply] === true}
                      onCheckedChange={(v: any) => handleChannelToggle(ch.key, v, true)}
                    />
                  </div>
                )}
              </Card>
            ))}
          </div>

          <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
            <CardContent className="pt-4">
              <div className="flex gap-3">
                <Settings className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-sm text-amber-800 dark:text-amber-300">Webhooks à configurer</p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                    Pour que les réponses automatiques fonctionnent, configurez ces URLs dans vos apps Meta/TikTok :
                  </p>
                  <div className="mt-2 space-y-1">
                    <code className="block text-xs bg-amber-100 dark:bg-amber-900/50 px-2 py-1 rounded">/api/social-webhook/meta → Facebook Messenger + Instagram</code>
                    <code className="block text-xs bg-amber-100 dark:bg-amber-900/50 px-2 py-1 rounded">/api/social-webhook/tiktok → TikTok commentaires</code>
                    <code className="block text-xs bg-amber-100 dark:bg-amber-900/50 px-2 py-1 rounded">/api/whatsapp/webhook → WhatsApp Business</code>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── ONGLET 4 : APERÇU ─────────────────────────────────────────── */}
        <TabsContent value="preview" className="space-y-4 pt-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Eye className="w-4 h-4" />Tester votre assistant IA</CardTitle>
              <CardDescription>Simulez une vraie conversation pour vérifier les réponses avant de l'activer</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Canal à simuler</Label>
                  <Select value={previewChannel} onValueChange={setPreviewChannel}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="messenger">Messenger</SelectItem>
                      <SelectItem value="instagram_dm">Instagram DM</SelectItem>
                      <SelectItem value="instagram_comment">Commentaire Instagram</SelectItem>
                      <SelectItem value="tiktok_comment">Commentaire TikTok</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Message de test</Label>
                  <Input value={testMessage} onChange={(e: any) => setTestMessage(e.target.value)} placeholder="Bonjour, quels sont vos tarifs ?" />
                </div>
              </div>

              <Button onClick={handlePreview} disabled={isPreviewing} className="w-full gap-2">
                {isPreviewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {isPreviewing ? "Génération en cours..." : "Générer l'aperçu"}
              </Button>

              {previewResult && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="w-4 h-4 text-green-600" />
                      <p className="font-medium text-sm text-green-800 dark:text-green-300">Réponse de l'IA</p>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{previewResult.sampleReply}</p>
                  </div>

                  <Button variant="ghost" size="sm" onClick={() => setShowPrompt(!showPrompt)} className="gap-1.5 text-xs text-muted-foreground">
                    <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showPrompt ? "rotate-90" : ""}`} />
                    {showPrompt ? "Masquer" : "Voir"} le prompt système complet
                  </Button>

                  {showPrompt && (
                    <div className="p-3 rounded-lg bg-muted border">
                      <pre className="text-xs whitespace-pre-wrap font-mono text-muted-foreground overflow-auto max-h-80">
                        {previewResult.prompt}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}