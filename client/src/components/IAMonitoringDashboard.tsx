
import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import {
  Brain, Zap, MessageCircle, TrendingUp, AlertCircle,
  Volume2, Settings2, ExternalLink
} from 'lucide-react';
import { useLocation } from 'wouter';
import { AIInsightsReport } from "./AIInsightsReport";
import { VoiceConfigPanel, type VoiceConfig } from "./VoiceConfigPanel";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

const VOICE_NAMES: Record<string, string> = {
  alloy: 'Alloy', echo: 'Echo', fable: 'Fable',
  onyx: 'Onyx', nova: 'Nova', shimmer: 'Shimmer',
};

function getRoleConfigurationScore(role: Record<string, unknown>): number {
  let score = 0;
  if (role.isActive) score += 30;
  if (role.ttsVoice) score += 20;
  if (role.ttsLanguage) score += 15;
  if (role.greetingMessage) score += 15;
  if (role.farewellMessage) score += 10;
  if (role.transferMessage) score += 10;
  return Math.min(score, 100);
}

function buildConfigurationChartData(roles: Record<string, unknown>[]) {
  return roles.slice(0, 5).map((role, index) => {
    const configScore = getRoleConfigurationScore(role);
    const velocity = Math.max(10, Math.round(Number(role.ttsSpeed ?? 1) * 25));
    return {
      name: String(role.name ?? `Rôle ${index + 1}`).slice(0, 12),
      configScore,
      voiceVelocity: velocity,
    };
  });
}

function buildRoleDistributionData(roles: Record<string, unknown>[]) {
  const active = roles.filter((role) => Boolean(role.isActive)).length;
  const attention = roles.filter((role) => getRoleConfigurationScore(role) < 70).length;
  const inactive = Math.max(roles.length - active, 0);

  return [
    { name: 'Actifs', value: active, color: '#10b981' },
    { name: 'À renforcer', value: attention, color: '#f59e0b' },
    { name: 'Inactifs', value: inactive, color: '#6b7280' },
  ].filter((item) => item.value > 0);
}

// ── Composant ActiveVoiceCard ─────────────────────────────────────────────────

function ActiveVoiceCard({ role }: { role: Record<string, unknown> }) {
  const voice = (role.ttsVoice as string) ?? 'alloy';
  const speed = parseFloat(String(role.ttsSpeed ?? 1));
  const lang  = (role.ttsLanguage as string ?? 'fr').toUpperCase();

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/10">
      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Volume2 className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{role.name as string}</p>
        <p className="text-xs text-muted-foreground">
          {VOICE_NAMES[voice] ?? voice} · ×{speed.toFixed(2)} · {lang}
        </p>
      </div>
      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px] flex-shrink-0">
        Actif
      </Badge>
    </div>
  );
}

// ── VoiceConfigSection — panneau inline dans le monitoring ────────────────────

function VoiceConfigSection() {
  const { user } = useAuth();
  const tenantId = (user as any)?.tenantId ?? 0;
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [voiceConfig, setVoiceConfig] = useState<VoiceConfig>({
    ttsVoice: 'alloy', ttsSpeed: 1.0, ttsPitch: 1.0, ttsLanguage: 'fr',
    greetingMessage: 'Bonjour, je suis votre assistant Servicall. Comment puis-je vous aider ?',
    farewellMessage: 'Merci pour votre appel. Bonne journée !',
    holdMessage: 'Veuillez patienter, je recherche l\'information pour vous.',
    transferMessage: 'Je vous transfère vers un conseiller. Restez en ligne.',
  });
  const [isSaving, setIsSaving] = useState(false);

  const rolesQuery = trpc.aiAutomation.ai.listModels.useQuery({ tenantId });
  const updateMutation = trpc.aiAutomation.ai.updateModel.useMutation({
    onSuccess: () => { toast.success('Configuration vocale sauvegardée'); setIsSaving(false); rolesQuery.refetch(); },
    onError: (e) => { toast.error(`Erreur : ${e.message}`); setIsSaving(false); },
  });

  const roles = (rolesQuery.data?.roles ?? []) as Record<string, unknown>[];
  const activeRoles = roles.filter(r => r.isActive);

  // Charger la config voix quand un rôle est sélectionné
  const handleSelectRole = (role: Record<string, unknown>) => {
    setSelectedRoleId(role.id as number);
    setVoiceConfig({
      ttsVoice:        (role.ttsVoice as string)        ?? 'alloy',
      ttsSpeed:        parseFloat(String(role.ttsSpeed  ?? 1.0)),
      ttsPitch:        parseFloat(String(role.ttsPitch  ?? 1.0)),
      ttsLanguage:     (role.ttsLanguage as string)     ?? 'fr',
      greetingMessage: (role.greetingMessage as string) ?? '',
      farewellMessage: (role.farewellMessage as string) ?? '',
      holdMessage:     (role.holdMessage as string)     ?? '',
      transferMessage: (role.transferMessage as string) ?? '',
    });
  };

  const handleSave = async () => {
    if (!selectedRoleId) { toast.error('Sélectionnez un rôle'); return; }
    setIsSaving(true);
    await updateMutation.mutateAsync({ tenantId, modelId: selectedRoleId, ...voiceConfig });
  };

  if (rolesQuery.isPending) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-muted-foreground gap-2">
        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        Chargement des rôles...
      </div>
    );
  }

  if (roles.length === 0) {
    return (
      <div className="text-center py-8 space-y-2">
        <Volume2 className="w-8 h-8 text-muted-foreground mx-auto" />
        <p className="text-sm font-medium">Aucun rôle IA configuré</p>
        <p className="text-xs text-muted-foreground">Créez un rôle IA pour configurer sa voix</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4">
      {/* Liste des rôles */}
      <div className="space-y-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-2">
          Rôles IA
        </p>
        {roles.map(role => (
          <button
            key={role.id as number}
            onClick={() => handleSelectRole(role)}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all ${
              selectedRoleId === (role.id as number)
                ? 'bg-primary/8 border border-primary/20 shadow-sm'
                : 'border border-transparent hover:bg-muted/60'
            }`}
          >
            <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
              <Volume2 className="w-3 h-3 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{role.name as string}</p>
              <p className="text-[11px] text-muted-foreground">
                {VOICE_NAMES[(role.ttsVoice as string) ?? 'alloy'] ?? 'Alloy'}
              </p>
            </div>
            {(role.isActive as boolean) && (
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
            )}
          </button>
        ))}
      </div>

      {/* Panneau de config */}
      {selectedRoleId ? (
        <div className="space-y-4">
          <VoiceConfigPanel value={voiceConfig} onChange={setVoiceConfig} />
          <div className="flex justify-end">
            <Button size="sm" onClick={handleSave} disabled={isSaving} className="min-w-[130px]">
              {isSaving
                ? <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />Sauvegarde...</>
                : <><Settings2 className="w-3.5 h-3.5 mr-1.5" />Sauvegarder</>}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-48 rounded-xl border-2 border-dashed border-muted">
          <p className="text-sm text-muted-foreground">← Sélectionnez un rôle pour configurer sa voix</p>
        </div>
      )}
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────

export const IAMonitoringDashboard: React.FC = () => {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const tenantId = (user as any)?.tenantId ?? 0;
  const rolesQuery = trpc.aiAutomation.ai.listModels.useQuery({ tenantId });
  const roles = ((rolesQuery.data?.roles ?? []) as Record<string, unknown>[]);
  const activeRoles = roles.filter(r => r.isActive);
  const configurationChartData = useMemo(() => buildConfigurationChartData(roles), [roles]);
  const roleDistributionData = useMemo(() => buildRoleDistributionData(roles), [roles]);
  const averageConfigurationScore = useMemo(() => {
    if (roles.length === 0) return 0;
    return Math.round(roles.reduce((sum, role) => sum + getRoleConfigurationScore(role), 0) / roles.length);
  }, [roles]);
  const configuredLanguages = useMemo(() => new Set(roles.map((role) => String(role.ttsLanguage ?? 'fr').toUpperCase())).size, [roles]);
  const rolesNeedingAttention = useMemo(() => roles.filter((role) => getRoleConfigurationScore(role) < 70).length, [roles]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4 md:p-8 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            Monitoring IA & Performance
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Vue d'ensemble · Configuration vocale · Insights temps réel
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            Système Opérationnel
          </Badge>
          <Button variant="outline" size="sm" onClick={() => setLocation('/ai-roles')} className="gap-1.5">
            <ExternalLink className="w-3.5 h-3.5" />
            Éditeur complet
          </Button>
        </div>
      </div>

      {/* Tabs principales */}
      <Tabs defaultValue="monitoring" className="space-y-6">
        <TabsList className="grid grid-cols-2 w-fit">
          <TabsTrigger value="monitoring" className="gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" /> Performance
          </TabsTrigger>
          <TabsTrigger value="voice" className="gap-1.5">
            <Volume2 className="w-3.5 h-3.5" /> Configuration Vocale
          </TabsTrigger>
        </TabsList>

        {/* ── Tab Performance ────────────────────────────────────────────── */}
        <TabsContent value="monitoring" className="space-y-6 mt-0">

          {/* Insights */}
          <div>
            <AIInsightsReport />
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Rôles IA configurés", value: String(roles.length), icon: MessageCircle, color: "blue", trend: `${activeRoles.length} rôle(s) actif(s)` },
              { label: "Score moyen de configuration", value: `${averageConfigurationScore}%`, icon: Zap, color: "yellow", trend: "Basé sur les paramètres vocaux enregistrés" },
              { label: "Langues couvertes", value: String(configuredLanguages), icon: TrendingUp, color: "green", trend: "Calculé depuis les rôles IA" },
              { label: "Rôles à renforcer", value: String(rolesNeedingAttention), icon: AlertCircle, color: "red", trend: rolesNeedingAttention > 0 ? "Nécessite attention" : "Aucune alerte bloquante", alert: rolesNeedingAttention > 0 },
            ].map(kpi => (
              <Card key={kpi.label} className="hover:shadow-md transition-shadow border-none bg-card/50 backdrop-blur-sm">
                <CardContent className="pt-5">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">{kpi.label}</p>
                      <p className="text-3xl font-bold tracking-tight">{kpi.value}</p>
                    </div>
                    <div className={`p-3 bg-${kpi.color}-500/10 rounded-xl`}>
                      <kpi.icon className={`h-6 w-6 text-${kpi.color}-600`} />
                    </div>
                  </div>
                  <div className={`mt-3 flex items-center text-xs font-medium ${
                    kpi.alert ? "text-red-600 bg-red-50" : "text-green-600 bg-green-50"
                  } w-fit px-2 py-1 rounded-full`}>
                    {!kpi.alert && <TrendingUp className="h-3 w-3 mr-1" />}
                    <span>{kpi.trend}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Charts + rôles actifs */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Qualité de Configuration des Rôles IA</CardTitle>
                </CardHeader>
                <CardContent className="h-[260px]">
                  {configurationChartData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                      Aucune donnée de rôle disponible pour afficher le monitoring.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={configurationChartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" />
                        <YAxis yAxisId="left" orientation="left" stroke="#8884d8" domain={[0, 100]} />
                        <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" domain={[0, 100]} />
                        <Tooltip />
                        <Bar yAxisId="left" dataKey="configScore" fill="#3b82f6" radius={[4,4,0,0]} name="Score configuration" />
                        <Bar yAxisId="right" dataKey="voiceVelocity" fill="#10b981" radius={[4,4,0,0]} name="Vélocité voix" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>

            </Card>

            <div className="space-y-4">
              {/* Sentiment */}
              <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Répartition des Rôles</CardTitle>
                  </CardHeader>
                  <CardContent className="h-[160px] flex flex-col items-center justify-center pt-0">
                    {roleDistributionData.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                        Aucun rôle à répartir.
                      </div>
                    ) : (
                      <>
                        <ResponsiveContainer width="100%" height="80%">
                          <PieChart>
                            <Pie data={roleDistributionData} cx="50%" cy="50%" innerRadius={45} outerRadius={60} paddingAngle={5} dataKey="value">
                              {roleDistributionData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="flex gap-3">
                          {roleDistributionData.map((item) => (
                            <div key={item.name} className="flex items-center gap-1">
                              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                              <span className="text-[11px] text-muted-foreground">{item.name}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </CardContent>

              </Card>

              {/* Rôles actifs */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>Agents Actifs</span>
                    <Badge variant="secondary">{activeRoles.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  {activeRoles.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-3">Aucun agent actif</p>
                  ) : activeRoles.slice(0, 3).map(role => (
                    <ActiveVoiceCard key={role.id as number} role={role} />
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ── Tab Configuration Vocale ───────────────────────────────────── */}
        <TabsContent value="voice" className="mt-0">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Volume2 className="w-5 h-5 text-primary" />
                    Configuration Vocale des Agents
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Modifiez la voix, la vitesse, la langue et les messages de chaque agent IA.
                    Les changements sont appliqués immédiatement aux nouveaux appels.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setLocation('/ai-roles')} className="gap-1.5 flex-shrink-0">
                  <ExternalLink className="w-3.5 h-3.5" />
                  Éditeur complet
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <VoiceConfigSection />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
