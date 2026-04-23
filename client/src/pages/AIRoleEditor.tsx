
/**
 * AIRoleEditor — Éditeur de rôles IA avec configuration vocale avancée
 */
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Brain, Trash2, Plus, Volume2, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { VoiceConfigPanel, type VoiceConfig } from "@/components/VoiceConfigPanel";

const VOICE_PROFILES = [
  { id: "alloy",   name: "Alloy",   gender: "Neutre",   emoji: "🎙️", color: "from-slate-400 to-slate-600" },
  { id: "echo",    name: "Echo",    gender: "Masculin", emoji: "🔵", color: "from-blue-400 to-blue-700"   },
  { id: "fable",   name: "Fable",   gender: "Masculin", emoji: "🟣", color: "from-violet-400 to-violet-700" },
  { id: "onyx",    name: "Onyx",    gender: "Masculin", emoji: "⚫", color: "from-gray-600 to-gray-900"   },
  { id: "nova",    name: "Nova",    gender: "Féminin",  emoji: "🔴", color: "from-rose-400 to-rose-600"   },
  { id: "shimmer", name: "Shimmer", gender: "Féminin",  emoji: "🟡", color: "from-amber-300 to-orange-500" },
];

const DEFAULT_VOICE_CONFIG: VoiceConfig = {
  ttsVoice: "alloy",
  ttsSpeed: 1.0,
  ttsPitch: 1.0,
  ttsLanguage: "fr",
  greetingMessage: "Bonjour, je suis votre assistant Servicall. Comment puis-je vous aider ?",
  farewellMessage: "Merci pour votre appel. Bonne journée !",
  holdMessage: "Veuillez patienter, je recherche l'information pour vous.",
  transferMessage: "Je vous transfère vers un conseiller. Restez en ligne.",
};

interface AIRoleForm {
  name: string;
  type: "agent" | "supervisor";
  systemPrompt: string;
  contextPrompt: string;
  responseGuidelines: string;
  voiceConfig: VoiceConfig;
}

export default function AIRoleEditor() {
  const [, setLocation] = useLocation();
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<"prompt" | "voice">("prompt");

  const [formData, setFormData] = useState<AIRoleForm>({
    name: "",
    type: "agent",
    systemPrompt: "",
    contextPrompt: "",
    responseGuidelines: "",
    voiceConfig: DEFAULT_VOICE_CONFIG,
  });

  const { user } = useAuth();
  const tenantId = (user as any)?.tenantId ?? 0;

  const rolesQuery     = trpc.aiAutomation.ai.listModels.useQuery({ tenantId });
  const roleDetailQuery = trpc.aiAutomation.ai.getModel.useQuery(
    { tenantId, modelId: selectedRoleId ?? 0 },
    { enabled: !!selectedRoleId }
  );

  const createRoleMutation = trpc.aiAutomation.ai.createModel.useMutation({
    onSuccess: () => { toast.success("Rôle IA créé"); setIsCreating(false); rolesQuery.refetch(); },
    onError: (e) => toast.error(`Erreur : ${e.message}`),
  });

  const updateRoleMutation = trpc.aiAutomation.ai.updateModel.useMutation({
    onSuccess: () => { toast.success("Rôle IA mis à jour"); setIsSaving(false); rolesQuery.refetch(); },
    onError: (e) => { toast.error(`Erreur : ${e.message}`); setIsSaving(false); },
  });

  const deleteRoleMutation = trpc.aiAutomation.ai.deleteModel.useMutation({
    onSuccess: () => { toast.success("Rôle supprimé"); setSelectedRoleId(null); rolesQuery.refetch(); },
    onError: (e) => toast.error(`Erreur : ${e.message}`),
  });

  useEffect(() => {
    if (!roleDetailQuery.data) return;
    const d = roleDetailQuery.data as Record<string, unknown>;
    setFormData({
      name: (d.name as string) ?? "",
      type: (d.type as "agent" | "supervisor") ?? "agent",
      systemPrompt: (d.systemPrompt as string) ?? (d.prompt as string) ?? "",
      contextPrompt: (d.contextPrompt as string) ?? "",
      responseGuidelines: (d.responseGuidelines as string) ?? "",
      voiceConfig: {
        ttsVoice:        (d.ttsVoice as string)        ?? DEFAULT_VOICE_CONFIG.ttsVoice,
        ttsSpeed:        parseFloat(String(d.ttsSpeed  ?? DEFAULT_VOICE_CONFIG.ttsSpeed)),
        ttsPitch:        parseFloat(String(d.ttsPitch  ?? DEFAULT_VOICE_CONFIG.ttsPitch)),
        ttsLanguage:     (d.ttsLanguage as string)     ?? DEFAULT_VOICE_CONFIG.ttsLanguage,
        greetingMessage: (d.greetingMessage as string) ?? DEFAULT_VOICE_CONFIG.greetingMessage,
        farewellMessage: (d.farewellMessage as string) ?? DEFAULT_VOICE_CONFIG.farewellMessage,
        holdMessage:     (d.holdMessage as string)     ?? DEFAULT_VOICE_CONFIG.holdMessage,
        transferMessage: (d.transferMessage as string) ?? DEFAULT_VOICE_CONFIG.transferMessage,
      },
    });
  }, [roleDetailQuery.data]);

  const buildPayload = () => ({
    tenantId,
    name:               formData.name,
    prompt:             formData.systemPrompt,
    description:        formData.contextPrompt,
    model:              "gpt-4",
    temperature:        0.7,
    isActive:           true,
    ...formData.voiceConfig,
  });

  const handleCreate = async () => {
    if (!formData.name.trim()) { toast.error("Nom requis"); return; }
    await createRoleMutation.mutateAsync(buildPayload());
  };

  const handleUpdate = async () => {
    if (!selectedRoleId) return;
    setIsSaving(true);
    await updateRoleMutation.mutateAsync({ modelId: selectedRoleId, ...buildPayload() });
  };

  const handleDelete = async () => {
    if (!selectedRoleId || !confirm("Supprimer ce rôle IA ?")) return;
    await deleteRoleMutation.mutateAsync({ tenantId, modelId: selectedRoleId });
  };

  const voice = VOICE_PROFILES.find(v => v.id === formData.voiceConfig.ttsVoice) ?? VOICE_PROFILES[0];
  const showForm = isCreating || !!selectedRoleId;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6" data-main-content>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" className="mb-1 -ml-2" onClick={() => setLocation("/dashboard")}>
            ← Retour
          </Button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="w-6 h-6 text-primary" />
            Éditeur de Rôles IA
          </h1>
          <p className="text-sm text-muted-foreground">Configurez vos agents IA — comportement, voix, messages</p>
        </div>
        <Button size="sm" onClick={() => { setIsCreating(true); setSelectedRoleId(null); setActiveSection("prompt"); }}>
          <Plus className="w-4 h-4 mr-1" /> Nouveau rôle
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">

        {/* ── Liste des rôles ────────────────────────────────────────────── */}
        <Card className="h-fit">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Rôles configurés
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            {rolesQuery.isPending ? (
              <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                Chargement...
              </div>
            ) : (rolesQuery.data?.roles ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Aucun rôle configuré.<br />
                <button className="text-primary hover:underline mt-1" onClick={() => setIsCreating(true)}>
                  Créer le premier →
                </button>
              </p>
            ) : (
              <div className="space-y-1">
                {(rolesQuery.data?.roles ?? []).map(role => {
                  const r = role as Record<string, unknown>;
                  const vp = VOICE_PROFILES.find(v => v.id === r.ttsVoice) ?? VOICE_PROFILES[0];
                  const isSelected = selectedRoleId === (r.id as number);
                  return (
                    <button
                      key={r.id as number}
                      onClick={() => { setSelectedRoleId(r.id as number); setIsCreating(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left ${
                        isSelected
                          ? "bg-primary/8 border border-primary/20 shadow-sm"
                          : "hover:bg-muted/60 border border-transparent"
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${vp.color} flex items-center justify-center flex-shrink-0`}>
                        <span className="text-white text-[10px] font-bold">{vp.name[0]}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{r.name as string}</p>
                        <p className="text-[11px] text-muted-foreground">{vp.name} · {(r.ttsLanguage as string ?? "fr").toUpperCase()}</p>
                      </div>
                      {(r.isActive as boolean) && (
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" title="Actif" />
                      )}
                      {isSelected && <ChevronRight className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Formulaire ─────────────────────────────────────────────────── */}
        {!showForm ? (
          <Card className="flex items-center justify-center min-h-[400px]">
            <div className="text-center space-y-3 p-8">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                <Brain className="w-8 h-8 text-primary" />
              </div>
              <p className="font-medium">Sélectionnez un rôle</p>
              <p className="text-sm text-muted-foreground">ou créez-en un nouveau avec le bouton ci-dessus</p>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* En-tête du formulaire */}
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${voice.color} flex items-center justify-center shadow-sm`}>
                    <Volume2 className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Nom du rôle</label>
                      <Input
                        value={formData.name}
                        onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                        placeholder="Ex: Agent commercial, Support médical..."
                        className="mt-1 h-8 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Type</label>
                      <select
                        className="w-full mt-1 h-8 border rounded-md px-2 text-sm bg-background"
                        value={formData.type}
                        onChange={e => setFormData(p => ({ ...p, type: e.target.value as "agent" | "supervisor" }))}
                      >
                        <option value="agent">Agent IA</option>
                        <option value="supervisor">Superviseur</option>
                      </select>
                    </div>
                  </div>
                  <Badge variant={formData.voiceConfig.ttsLanguage === "fr" ? "default" : "secondary"} className="self-end mb-1">
                    {formData.voiceConfig.ttsLanguage.toUpperCase()}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Sections Prompt / Voice */}
            <div className="grid grid-cols-2 gap-1 bg-muted rounded-lg p-1">
              <button
                onClick={() => setActiveSection("prompt")}
                className={`py-1.5 px-3 rounded-md text-sm font-medium transition-all ${
                  activeSection === "prompt" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                🧠 Comportement IA
              </button>
              <button
                onClick={() => setActiveSection("voice")}
                className={`py-1.5 px-3 rounded-md text-sm font-medium transition-all ${
                  activeSection === "voice" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                🎙️ Voix & Audio
              </button>
            </div>

            {activeSection === "prompt" ? (
              <Card>
                <CardContent className="pt-4 space-y-4">
                  <div>
                    <label className="text-sm font-medium">Prompt système</label>
                    <p className="text-xs text-muted-foreground mb-1">Instructions principales du comportement de l'agent</p>
                    <Textarea
                      value={formData.systemPrompt}
                      onChange={e => setFormData(p => ({ ...p, systemPrompt: e.target.value }))}
                      placeholder="Tu es un agent IA professionnel spécialisé dans... Ton rôle est de..."
                      rows={5}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Contexte métier</label>
                    <Textarea
                      value={formData.contextPrompt}
                      onChange={e => setFormData(p => ({ ...p, contextPrompt: e.target.value }))}
                      placeholder="Informations spécifiques à l'entreprise, secteur d'activité, contraintes..."
                      rows={3}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Directives de réponse</label>
                    <Textarea
                      value={formData.responseGuidelines}
                      onChange={e => setFormData(p => ({ ...p, responseGuidelines: e.target.value }))}
                      placeholder="Toujours tutoyer le client, répondre en moins de 30 secondes, éviter les sujets..."
                      rows={3}
                      className="text-sm"
                    />
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="pt-4">
                  <VoiceConfigPanel
                    value={formData.voiceConfig}
                    onChange={vc => setFormData(p => ({ ...p, voiceConfig: vc }))}
                  />
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => { setIsCreating(false); setSelectedRoleId(null); }}>
                Annuler
              </Button>
              {!isCreating && (
                <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleteRoleMutation.isPending}>
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Supprimer
                </Button>
              )}
              <Button
                size="sm"
                onClick={isCreating ? handleCreate : handleUpdate}
                disabled={createRoleMutation.isPending || isSaving}
                className="min-w-[120px]"
              >
                {(createRoleMutation.isPending || isSaving) ? (
                  <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" /> Sauvegarde...</>
                ) : isCreating ? "Créer le rôle" : "Sauvegarder"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
