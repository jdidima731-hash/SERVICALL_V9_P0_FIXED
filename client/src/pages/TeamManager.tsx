import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  Users, UserPlus, Shield, KeyRound, BarChart3, Zap, Brain,
  AlertTriangle, Phone, UserCheck, Eye, Pencil, Trash2, Loader2,
  Target, Award
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * TEAM MANAGER — SERVICALL V8
 * ✅ Gestion d'équipe & Matching IA
 * ✅ FIX V8 : Typage strict et suppression du @ts-nocheck
 */

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type CampaignType = "b2b" | "b2c" | "inbound" | "outbound" | "retention" | "recovery";
type MemberRole = "admin" | "manager" | "agent" | "viewer";

interface TeamMember {
  id: number;
  name: string;
  email: string;
  role: MemberRole;
  isActive: boolean;
  isAtRisk?: boolean;
  performance?: {
    totalCalls: number;
    conversionRate?: number;
    avgQualityScore: number;
  };
}

const CAMPAIGN_LABELS: Record<CampaignType, string> = {
  b2b: "B2B",
  b2c: "B2C",
  inbound: "Inbound",
  outbound: "Outbound",
  retention: "Fidélisation",
  recovery: "Récupération clients",
};

const ROLE_COLORS: Record<MemberRole, string> = {
  admin: "bg-red-100 text-red-700 border-red-200",
  manager: "bg-blue-100 text-blue-700 border-blue-200",
  agent: "bg-green-100 text-green-700 border-green-200",
  viewer: "bg-slate-100 text-slate-600 border-slate-200",
};

// ─────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────
export default function TeamManager() {
  const [activeTab, setActiveTab] = useState("team");

  // ── Centre de Contrôle state ──
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState<{ id: number; name: string } | null>(null);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [createForm, setCreateForm] = useState({ email: "", name: "", role: "agent" as MemberRole, password: "" });
  const [newPassword, setNewPassword] = useState("");

  // ── Matching state ──
  const [campaignType, setCampaignType] = useState<CampaignType>("outbound");
  const [matchingDays, setMatchingDays] = useState(60);
  const [selectedAgent, setSelectedAgent] = useState<number | null>(null);

  // ── tRPC queries & mutations ──
  const teamQuery = trpc.core.teamManager.getTeamWithStats.useQuery(undefined, { refetchOnWindowFocus: false });
  const patternsQuery = trpc.core.teamManager.getAgentPatterns.useQuery({ days: matchingDays }, { enabled: activeTab === "patterns" });
  const matchingQuery = trpc.core.teamManager.getPredictiveMatching.useQuery(
    { campaignType, days: matchingDays },
    { enabled: activeTab === "matching" }
  );
  const insightsQuery = trpc.core.teamManager.getAgentInsights.useQuery(
    { agentId: selectedAgent!, days: 30 },
    { enabled: !!selectedAgent }
  );

  const createMember = trpc.core.teamManager.createMember.useMutation({
    onSuccess: (data: any) => {
      toast.success(data?.isNew ? "Compte créé avec succès ✅" : "Membre ajouté au compte ✅");
      setShowCreateModal(false);
      setCreateForm({ email: "", name: "", role: "agent", password: "" });
      teamQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const resetPassword = trpc.core.teamManager.resetPassword.useMutation({
    onSuccess: () => {
      toast.success("Mot de passe réinitialisé ✅");
      setShowResetModal(null);
      setNewPassword("");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateRole = trpc.core.teamManager.updateMemberRole.useMutation({
    onSuccess: () => { toast.success("Mis à jour ✅"); teamQuery.refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const removeMember = trpc.core.teamManager.removeMember.useMutation({
    onSuccess: () => { toast.success("Membre retiré"); teamQuery.refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const team = (teamQuery.data as TeamMember[]) ?? [];
  const activeAgents = team.filter(m => m.role === "agent" && m.isActive);
  const atRiskCount = team.filter(m => m.isAtRisk).length;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6 text-violet-600" />
            Team Manager
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Centre de contrôle & Intelligence de répartition prédictive
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} className="gap-2 bg-violet-600 hover:bg-violet-700">
          <UserPlus className="w-4 h-4" />
          Nouveau membre
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Users, label: "Membres total", value: team.length, color: "text-blue-600 bg-blue-50" },
          { icon: UserCheck, label: "Agents actifs", value: activeAgents.length, color: "text-green-600 bg-green-50" },
          { icon: AlertTriangle, label: "À risque", value: atRiskCount, color: atRiskCount > 0 ? "text-amber-600 bg-amber-50" : "text-slate-500 bg-slate-50" },
          { icon: Brain, label: "Profils analysés", value: patternsQuery.data?.length ?? "—", color: "text-violet-600 bg-violet-50" },
        ].map((kpi) => (
          <Card key={kpi.label} className="border-border shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn("p-2 rounded-lg", kpi.color)}>
                <kpi.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{teamQuery.isLoading ? "..." : kpi.value}</p>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 w-full md:w-auto">
          <TabsTrigger value="team" className="gap-2">
            <Shield className="w-4 h-4" /> Équipe
          </TabsTrigger>
          <TabsTrigger value="matching" className="gap-2">
            <Target className="w-4 h-4" /> Matching IA
          </TabsTrigger>
          <TabsTrigger value="patterns" className="gap-2">
            <BarChart3 className="w-4 h-4" /> Patterns
          </TabsTrigger>
        </TabsList>

        <TabsContent value="team" className="space-y-4 pt-4">
          {teamQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
            </div>
          ) : team.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center py-12 text-muted-foreground">
                <Users className="w-10 h-10 mb-3 opacity-40" />
                <p className="font-medium">Aucun membre encore</p>
                <p className="text-sm mt-1">Créez le premier compte agent ou manager</p>
                <Button className="mt-4 gap-2" onClick={() => setShowCreateModal(true)}>
                  <UserPlus className="w-4 h-4" /> Créer un membre
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {team.map((member) => (
                <Card key={member.id} className={cn(
                  "border-border shadow-sm transition-all hover:shadow-md",
                  !member.isActive && "opacity-60",
                  member.isAtRisk && "border-amber-200"
                )}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold truncate">{member.name}</p>
                          {member.isAtRisk && (
                            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                      </div>
                      <Badge className={cn("text-[10px] shrink-0 ml-2", ROLE_COLORS[member.role] ?? ROLE_COLORS.viewer)}>
                        {member.role}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {member.performance && (
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-muted/30 rounded-lg p-2">
                          <p className="text-sm font-bold">{member.performance.totalCalls}</p>
                          <p className="text-[10px] text-muted-foreground">Appels</p>
                        </div>
                        <div className="bg-muted/30 rounded-lg p-2">
                          <p className="text-sm font-bold">
                            {member.performance.conversionRate !== undefined
                              ? `${Math.round(member.performance.conversionRate)}%`
                              : "—"}
                          </p>
                          <p className="text-[10px] text-muted-foreground">Conversion</p>
                        </div>
                        <div className="bg-muted/30 rounded-lg p-2">
                          <p className="text-sm font-bold">
                            {member.performance.avgQualityScore > 0
                              ? member.performance.avgQualityScore
                              : "—"}
                          </p>
                          <p className="text-[10px] text-muted-foreground">Qualité</p>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2 pt-2">
                      <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => setSelectedMember(member)}>
                        <Eye className="w-3 h-3 mr-1" /> Détails
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setShowResetModal({ id: member.id, name: member.name })}>
                        <KeyRound className="w-3 h-3" />
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-600" onClick={() => removeMember.mutate({ memberId: member.id })}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Modal Création */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouveau membre</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={createForm.email} onChange={e => setCreateForm({...createForm, email: e.target.value})} placeholder="agent@example.com" />
            </div>
            <div className="space-y-2">
              <Label>Nom complet</Label>
              <Input value={createForm.name} onChange={e => setCreateForm({...createForm, name: e.target.value})} placeholder="Jean Dupont" />
            </div>
            <div className="space-y-2">
              <Label>Rôle</Label>
              <Select value={createForm.role} onValueChange={(v: MemberRole) => setCreateForm({...createForm, role: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="agent">Agent</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="viewer">Observateur</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>Annuler</Button>
            <Button onClick={() => createMember.mutate(createForm)} disabled={createMember.isPending}>
              {createMember.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
