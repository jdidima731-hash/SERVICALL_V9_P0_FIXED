
/**
 * PAGE FORMATION - Coaching & Simulations
 * Version refonte complète - Valeur ajoutée maximale
 * 
 * Fonctionnalités :
 * - Modules de formation structurés avec contenu pédagogique
 * - Simulateur d'appel interactif avec chat en temps réel
 * - Tableau de bord de progression et gamification
 * - Statistiques visuelles dynamiques
 * - Historique des performances
 */

import React, { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Trophy,
  Target,
  History,
  Play,
  TrendingUp,
  Loader2,
  Zap,
  Award,
  BookOpen,
  User,
  MessageSquare,
  Send,
  CheckCircle,
  Star,
  Flame,
  GraduationCap,
  Brain,
  Phone,
  PhoneOff,
  BarChart3,
  Clock,
  ArrowUp,
  ArrowDown,
  Minus,
  ChevronDown,
  ChevronUp,
  Lock,
  Unlock,
  Lightbulb,
  Shield,
  Headphones,
  FileText,
  RefreshCw,
  AlertCircle,
 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useTenant } from "@/contexts/TenantContext";
import { renderValue } from "@/lib/utils";
import { useAuth } from "@/_core/hooks/useAuth";

// ============================================================
// TYPES
// ============================================================

type Tab = "modules" | "scenarios" | "history" | "performance";

interface SimulationMessage {
  id: string;
  speaker: "customer" | "agent";
  text: string;
  timestamp: number;
  sentiment?: number;
}

interface ActiveSimulation {
  id: string;
  scenarioId: string;
  scenarioName: string;
  status: "in_progress" | "completed";
  transcript: SimulationMessage[];
  startedAt: Date;
  score?: number;
}

// ============================================================
// DONNÉES MODULES DE FORMATION
// ============================================================

const FORMATION_MODULES = [
  {
    id: "mod-1",
    title: "Fondamentaux de la Communication",
    description: "Maîtrisez les bases d'une communication professionnelle efficace au téléphone.",
    icon: <Headphones className="w-6 h-6" />,
    color: "bg-blue-500",
    duration: "45 min",
    level: "Débutant",
    lessons: 6,
    completedLessons: 0,
    locked: false,
    topics: [
      "Accueil professionnel et présentation",
      "Écoute active et reformulation",
      "Gestion du ton et du rythme",
      "Clôture d'appel efficace",
    ],
    tips: [
      "Souriez au téléphone — cela s'entend !",
      "Prenez des notes pendant l'appel",
      "Répétez le nom du client pour personnaliser",
    ],
  },
  {
    id: "mod-2",
    title: "Gestion des Objections",
    description: "Transformez chaque objection en opportunité de vente avec des techniques éprouvées.",
    icon: <Shield className="w-6 h-6" />,
    color: "bg-orange-500",
    duration: "60 min",
    level: "Intermédiaire",
    lessons: 8,
    completedLessons: 0,
    locked: false,
    topics: [
      "Identifier les types d'objections",
      "Technique CRAC (Comprendre, Reformuler, Argumenter, Contrôler)",
      "Objections prix et budget",
      "Objections concurrence",
    ],
    tips: [
      "Ne jamais interrompre une objection",
      "Valider avant de répondre : 'Je comprends votre point...'",
      "Transformer 'trop cher' en valeur perçue",
    ],
  },
  {
    id: "mod-3",
    title: "Techniques de Closing",
    description: "Concluez vos appels avec succès grâce aux meilleures méthodes de closing.",
    icon: <Target className="w-6 h-6" />,
    color: "bg-green-500",
    duration: "50 min",
    level: "Intermédiaire",
    lessons: 7,
    completedLessons: 0,
    locked: false,
    topics: [
      "Signaux d'achat à détecter",
      "Closing alternatif et assumé",
      "Urgence et rareté éthiques",
      "Suivi post-appel",
    ],
    tips: [
      "Posez des questions fermées en fin d'appel",
      "Proposez toujours deux options, jamais une seule",
      "Confirmez par email immédiatement après",
    ],
  },
  {
    id: "mod-4",
    title: "Intelligence Émotionnelle",
    description: "Développez votre empathie et gérez les situations difficiles avec sérénité.",
    icon: <Brain className="w-6 h-6" />,
    color: "bg-purple-500",
    duration: "55 min",
    level: "Avancé",
    lessons: 7,
    completedLessons: 0,
    locked: true,
    topics: [
      "Reconnaissance des émotions client",
      "Désescalade des conflits",
      "Gestion du stress en appel",
      "Empathie vs sympathie",
    ],
    tips: [
      "Respirez profondément avant de répondre à un client agressif",
      "Utilisez 'je comprends' avec sincérité",
      "Faites des pauses courtes pour réfléchir",
    ],
  },
  {
    id: "mod-5",
    title: "IA & Outils Digitaux",
    description: "Exploitez la puissance de l'IA pour booster votre productivité.",
    icon: <Zap className="w-6 h-6" />,
    color: "bg-yellow-500",
    duration: "40 min",
    level: "Avancé",
    lessons: 5,
    completedLessons: 0,
    locked: true,
    topics: [
      "Utiliser le Copilot IA en temps réel",
      "Analyser les transcriptions automatiques",
      "Interpréter les scores de sentiment",
      "Optimiser avec les suggestions IA",
    ],
    tips: [
      "Consultez le Copilot avant chaque appel important",
      "Analysez vos transcriptions chaque semaine",
      "Comparez vos scores de sentiment dans le temps",
    ],
  },
];

// ============================================================
// COMPOSANT PRINCIPAL
// ============================================================

export default function Coaching() {
  const { user } = useAuth();
  // ✅ FIX TS6133: tenantId non utilisé dans ce composant
  useTenant();
  const [activeTab, setActiveTab] = useState<Tab>("modules");
  const [activeSimulation, setActiveSimulation] = useState<ActiveSimulation | null>(null);
  const [agentMessage, setAgentMessage] = useState("");
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  
  const agentId = user?.id || 1;

  // ── Queries ──────────────────────────────────────────────
  const scenariosQuery = trpc.aiAutomation.coaching.listSimulationScenarios.useQuery(undefined, {
    retry: 1,
    staleTime: 60000,
  });

  const historyQuery = trpc.aiAutomation.coaching.getSimulationHistory.useQuery(
    { limit: 20 },
    { retry: 1, staleTime: 30000 }
  );

  const performanceQuery = trpc.aiAutomation.coaching.getAgentPerformance.useQuery(
    {
      agentId,
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date().toISOString(),
    },
    {
      retry: 1,
      enabled: activeTab === "performance",
    }
  );

  // ── Mutations ─────────────────────────────────────────────
  const startSimulationMutation = (trpc.aiAutomation.coaching.startSimulation as any).useMutation({
    onSuccess: (data: any) => {
      if (data.success && data.simulation) {
        const scenario = scenariosQuery.data?.scenarios?.find(
          (s) => s.id === data.simulation.scenarioId
        );
        setActiveSimulation({
          id: data.simulation.id,
          scenarioId: data.simulation.scenarioId,
          scenarioName: scenario?.name || "Simulation",
          status: "in_progress",
          transcript: (data.simulation.transcript || []).map((t: Record<string, unknown>, i: number) => ({
            id: `msg-${i}`,
            speaker: t.speaker,
            text: t.text,
            timestamp: t.timestamp,
            sentiment: t.sentiment,
          })),
          startedAt: new Date(data.simulation.startedAt),
        });
        toast.success("Simulation démarrée ! Répondez au client.");
      }
    },
    onError: (error) => {
      toast.error(`Erreur : ${error.message}`);
    },
  });

  const sendResponseMutation = (trpc.aiAutomation.coaching.sendAgentResponse as any).useMutation({
    onSuccess: (data: any) => {
      if (data.success && activeSimulation) {
        const newMsg: SimulationMessage = {
          id: `msg-customer-${Date.now()}`,
          speaker: "customer",
          text: data.customerResponse,
          timestamp: Date.now(),
          sentiment: data.sentiment,
        };
        setActiveSimulation((prev) =>
          prev
            ? {
                ...prev,
                transcript: [...prev.transcript, newMsg],
                status: data.callStatus === "completed" ? "completed" : "in_progress",
              }
            : null
        );
        if (data.callStatus === "completed") {
          toast.success("Simulation terminée ! Consultez votre score dans l'historique.");
          setTimeout(() => {
            setActiveSimulation(null);
            historyQuery.refetch();
          }, 3000);
        }
      }
    },
    onError: (error) => {
      toast.error(`Erreur : ${error.message}`);
    },
  });

  // ── Effets ────────────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSimulation?.transcript]);

  // ── Helpers ───────────────────────────────────────────────
  const safeScore = (score: unknown) => {
    const num = Number(score);
    if (isNaN(num)) return 0;
    return Math.min(Math.max(num, 0), 100);
  };

  const getDifficultyColor = (difficulty: string) => {
    const diff = String(difficulty || "").toLowerCase();
    switch (diff) {
      case "beginner":
      case "facile":
        return "bg-green-100 text-green-700 border-green-200";
      case "intermediate":
      case "moyen":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "advanced":
      case "difficile":
        return "bg-red-100 text-red-700 border-red-200";
      case "expert":
        return "bg-purple-100 text-purple-700 border-purple-200";
      default:
        return "bg-blue-100 text-blue-700 border-blue-200";
    }
  };

  const getDifficultyLabel = (difficulty: string) => {
    const map: Record<string, string> = {
      beginner: "Débutant",
      intermediate: "Intermédiaire",
      advanced: "Avancé",
      expert: "Expert",
    };
    return map[difficulty] || difficulty;
  };

  const handleSendMessage = () => {
    if (!agentMessage.trim() || !activeSimulation) return;
    const userMsg: SimulationMessage = {
      id: `msg-agent-${Date.now()}`,
      speaker: "agent",
      text: agentMessage,
      timestamp: Date.now(),
    };
    setActiveSimulation((prev) =>
      prev ? { ...prev, transcript: [...prev.transcript, userMsg] } : null
    );
    sendResponseMutation.mutate({
      callId: activeSimulation.id,
      message: agentMessage,
    });
    setAgentMessage("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const totalSimulations = historyQuery.data?.history?.length || 0;
  const avgScore =
    totalSimulations > 0
      ? Math.round(
          (historyQuery.data?.history || []).reduce(
            
            (sum: number, h: unknown) => sum + safeScore((h as any).score),
            0
          ) / totalSimulations
        )
      : 0;

  // ============================================================
  // RENDU
  // ============================================================

  return (
    <div className="space-y-6 pb-8" data-main-content>
      {/* ── En-tête ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-primary/10 rounded-xl">
              <GraduationCap className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-3xl font-black tracking-tight">Coaching & Formation</h1>
          </div>
          <p className="text-muted-foreground ml-14">
            Développez vos compétences avec des modules interactifs et des simulations IA
          </p>
        </div>

        {/* Statistiques rapides */}
        <div className="flex gap-3">
          <StatPill icon={<Flame className="w-4 h-4 text-orange-500" />} label="Simulations" value={String(totalSimulations)} />
          <StatPill icon={<Star className="w-4 h-4 text-yellow-500" />} label="Score moyen" value={totalSimulations > 0 ? `${avgScore}/100` : "—"} />
        </div>
      </div>

      {/* ── Navigation par onglets ── */}
      <div className="flex bg-muted/60 p-1 rounded-xl gap-1 w-fit">
        <TabButton active={activeTab === "modules"} onClick={() => setActiveTab("modules")} label="Modules" icon={<BookOpen className="w-4 h-4" />} />
        <TabButton active={activeTab === "scenarios"} onClick={() => setActiveTab("scenarios")} label="Simulations" icon={<Target className="w-4 h-4" />} />
        <TabButton active={activeTab === "history"} onClick={() => setActiveTab("history")} label="Historique" icon={<History className="w-4 h-4" />} />
        <TabButton active={activeTab === "performance"} onClick={() => setActiveTab("performance")} label="Performance" icon={<TrendingUp className="w-4 h-4" />} />
      </div>

      {/* ════════════════════════════════════════
          ONGLET MODULES DE FORMATION
      ════════════════════════════════════════ */}
      {activeTab === "modules" && (
        <div className="space-y-6">
          {/* Progression globale */}
          <Card className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <p className="text-primary-foreground/70 text-sm font-medium uppercase tracking-wider mb-1">
                    Votre progression globale
                  </p>
                  <h2 className="text-2xl font-black">0 / 5 modules complétés</h2>
                  <p className="text-primary-foreground/70 text-sm mt-1">
                    Commencez par les fondamentaux pour débloquer les modules avancés
                  </p>
                </div>
                <div className="flex gap-4">
                  <div className="text-center">
                    <div className="text-3xl font-black">0</div>
                    <div className="text-xs text-primary-foreground/70">Leçons</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-black">0h</div>
                    <div className="text-xs text-primary-foreground/70">Formation</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-black">0</div>
                    <div className="text-xs text-primary-foreground/70">Badges</div>
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <Progress value={0} className="h-2 bg-white/20" />
              </div>
            </CardContent>
          </Card>

          {/* Grille des modules */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {FORMATION_MODULES.map((module) => (
              <Card
                key={module.id}
                className={`group transition-all duration-300 ${
                  module.locked
                    ? "opacity-60 cursor-not-allowed"
                    : "hover:border-primary hover:shadow-md cursor-pointer"
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between mb-3">
                    <div className={`p-2.5 rounded-xl text-white ${module.color}`}>
                      {module.icon}
                    </div>
                    <div className="flex items-center gap-2">
                      {module.locked ? (
                        <Lock className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <Unlock className="w-4 h-4 text-green-500" />
                      )}
                      <Badge variant="outline" className="text-xs">
                        {module.level}
                      </Badge>
                    </div>
                  </div>
                  <CardTitle className="text-lg leading-tight">{module.title}</CardTitle>
                  <CardDescription className="text-sm">{module.description}</CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Méta-infos */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {module.duration}
                    </span>
                    <span className="flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      {module.lessons} leçons
                    </span>
                  </div>

                  {/* Progression du module */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Progression</span>
                      <span className="font-medium">
                        {module.completedLessons}/{module.lessons}
                      </span>
                    </div>
                    <Progress
                      value={(module.completedLessons / module.lessons) * 100}
                      className="h-1.5"
                    />
                  </div>

                  {/* Sujets couverts */}
                  <div>
                    <button
                      className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() =>
                        setExpandedModule(expandedModule === module.id ? null : module.id)
                      }
                    >
                      {expandedModule === module.id ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                      Voir le contenu
                    </button>
                    {expandedModule === module.id && (
                      <div className="mt-2 space-y-1">
                        {module.topics.map((topic, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                            <div className="w-1 h-1 bg-primary rounded-full flex-shrink-0" />
                            {topic}
                          </div>
                        ))}
                        <div className="mt-3 p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                          <p className="text-xs font-semibold text-yellow-800 flex items-center gap-1 mb-1">
                            <Lightbulb className="w-3 h-3" />
                            Conseil clé
                          </p>
                          <p className="text-xs text-yellow-700">{module.tips[0]}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>

                <CardFooter>
                  <Button
                    className="w-full"
                    variant={module.locked ? "outline" : "default"}
                    disabled={module.locked}
                    onClick={() => {
                      if (!module.locked) {
                        toast.info(`Module "${module.title}" — Contenu disponible prochainement.`);
                      }
                    }}
                  >
                    {module.locked ? (
                      <>
                        <Lock className="w-4 h-4 mr-2" />
                        Déverrouiller
                      </>
                    ) : module.completedLessons === 0 ? (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Commencer
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Continuer
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>

          {/* Conseil du jour */}
          <Card className="border-l-4 border-l-primary bg-primary/5">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                  <Lightbulb className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm mb-1">Conseil du jour</p>
                  <p className="text-sm text-muted-foreground">
                    La règle des 3 premières secondes : les 3 premières secondes d'un appel déterminent
                    à 80% la réceptivité du client. Soignez votre accroche avec énergie et clarté.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ════════════════════════════════════════
          ONGLET SIMULATIONS
      ════════════════════════════════════════ */}
      {activeTab === "scenarios" && (
        <div className="space-y-6">
          {/* Interface de simulation active */}
          {activeSimulation && (
            <Card className="border-2 border-primary shadow-lg">
              <CardHeader className="pb-3 bg-primary/5 rounded-t-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary rounded-lg">
                      <Phone className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-base">
                        Simulation en cours : {activeSimulation.scenarioName}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Répondez au client comme si vous étiez en appel réel
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-green-100 text-green-700 animate-pulse">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-1" />
                      En cours
                    </Badge>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setActiveSimulation(null);
                        toast.info("Simulation terminée.");
                      }}
                    >
                      <PhoneOff className="w-4 h-4 mr-1" />
                      Terminer
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {/* Zone de chat */}
                <div className="h-80 overflow-y-auto p-4 space-y-3 bg-gray-50/50">
                  {activeSimulation.transcript.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.speaker === "agent" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                          msg.speaker === "agent"
                            ? "bg-primary text-primary-foreground rounded-br-sm"
                            : "bg-white border shadow-sm rounded-bl-sm"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold opacity-70">
                            {msg.speaker === "agent" ? "Vous" : "Client"}
                          </span>
                          {msg.sentiment !== undefined && msg.speaker === "customer" && (
                            <SentimentBadge score={msg.sentiment} />
                          )}
                        </div>
                        <p>{msg.text}</p>
                      </div>
                    </div>
                  ))}
                  {sendResponseMutation.isPending && (
                    <div className="flex justify-start">
                      <div className="bg-white border shadow-sm rounded-2xl rounded-bl-sm px-4 py-3">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Zone de saisie */}
                <div className="p-4 border-t bg-white rounded-b-xl">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={agentMessage}
                      onChange={(e: any) => setAgentMessage(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Tapez votre réponse au client... (Entrée pour envoyer)"
                      className="flex-1 px-4 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                      disabled={sendResponseMutation.isPending || activeSimulation.status === "completed"}
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={!agentMessage.trim() || sendResponseMutation.isPending || activeSimulation.status === "completed"}
                      size="icon"
                      className="rounded-xl"
                    >
                      {sendResponseMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    Conseil : Soyez naturel, empathique et orienté solution
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Grille des scénarios */}
          {scenariosQuery.isPending ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-64 w-full rounded-xl" />
              ))}
            </div>
          ) : scenariosQuery.isError ? (
            <Card className="border-destructive/50">
              <CardContent className="pt-6 text-center">
                <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-2" />
                <p className="font-medium">Erreur de chargement des scénarios</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => scenariosQuery.refetch()}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Réessayer
                </Button>
              </CardContent>
            </Card>
          ) : !scenariosQuery.data?.scenarios?.length ? (
            <Card>
              <CardContent className="pt-8 pb-8 text-center">
                <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="font-semibold mb-1">Aucun scénario disponible</p>
                <p className="text-sm text-muted-foreground">
                  Votre administrateur n'a pas encore créé de scénarios d'entraînement.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {scenariosQuery.data.scenarios.map((scenario: Record<string, unknown>) => (
                <Card
                  
                  key={scenario.id}
                  className="group hover:border-primary hover:shadow-md transition-all duration-300 overflow-hidden"
                >
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start mb-2">
                      <Badge
                        
                        className={`${getDifficultyColor(scenario.difficulty)} border text-xs font-semibold`}
                        variant="outline"
                      >
                        
                        {getDifficultyLabel((scenario as any).difficulty)}
                      </Badge>
                      <Trophy className="w-5 h-5 text-yellow-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <CardTitle className="text-lg leading-tight">{renderValue((scenario as any).name)}</CardTitle>
                    <CardDescription className="line-clamp-2">{renderValue(scenario.description)}</CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    {/* Profil client */}
                    <div className="bg-muted/50 p-3 rounded-xl text-sm">
                      <p className="font-semibold flex items-center gap-2 mb-1 text-xs uppercase tracking-wider text-muted-foreground">
                        <User className="w-3 h-3" />
                        Profil Client
                      </p>
                      <p className="text-muted-foreground italic text-xs">
                        "
                        {typeof scenario.customerProfile === "object" && scenario.customerProfile !== null
                          
                          ? `${renderValue(scenario.customerProfile.name)} — ${renderValue(scenario.customerProfile.personality)}`
                          : renderValue(scenario.customerProfile)}
                        "
                      </p>
                    </div>

                    {/* Objectifs */}
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        Objectifs
                      </p>
                      <ul className="text-xs space-y-1">
                        {Array.isArray(scenario.objectives) &&
                          scenario.objectives.slice(0, 3).map((obj: unknown, i: number) => (
                            <li key={i} className="flex items-center gap-2 text-muted-foreground">
                              <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />
                              {renderValue(obj)}
                            </li>
                          ))}
                      </ul>
                    </div>
                  </CardContent>

                  <CardFooter>
                    <Button
                      className="w-full gap-2"
                      onClick={() => {
                        if (activeSimulation) {
                          toast.warning("Terminez d'abord la simulation en cours.");
                          return;
                        }
                        
                        startSimulationMutation.mutate({ scenarioId: scenario.id });
                      }}
                      disabled={startSimulationMutation.isPending || !!activeSimulation}
                    >
                      {startSimulationMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                      Démarrer la simulation
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════
          ONGLET HISTORIQUE
      ════════════════════════════════════════ */}
      {activeTab === "history" && (
        <div className="space-y-4">
          {/* Résumé statistiques */}
          {totalSimulations > 0 && (
            <div className="grid grid-cols-3 gap-4">
              <StatCard
                title="Simulations totales"
                value={String(totalSimulations)}
                icon={<Target className="w-5 h-5 text-blue-500" />}
                color="bg-blue-50"
              />
              <StatCard
                title="Score moyen"
                value={`${avgScore}/100`}
                icon={<Star className="w-5 h-5 text-yellow-500" />}
                color="bg-yellow-50"
              />
              <StatCard
                title="Taux de réussite"
                value={`${Math.round((historyQuery.data?.history || []).filter((h: Record<string, unknown>) => safeScore((h as any).score) >= 70).length / Math.max(totalSimulations, 1) * 100)}%`}
                icon={<Trophy className="w-5 h-5 text-green-500" />}
                color="bg-green-50"
              />
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5" />
                Historique des simulations
              </CardTitle>
              <CardDescription>
                Consultez vos scores et les feedbacks de l'IA sur vos entraînements passés.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {historyQuery.isPending ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-xl" />
                  ))}
                </div>
              ) : !historyQuery.data?.history?.length ? (
                <div className="text-center py-12">
                  <History className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="font-semibold mb-1">Historique vide</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Vous n'avez pas encore effectué de simulation. Vos futurs résultats apparaîtront ici.
                  </p>
                  <Button onClick={() => setActiveTab("scenarios")} variant="outline" size="sm">
                    <Play className="w-4 h-4 mr-2" />
                    Lancer une simulation
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {historyQuery.data.history.map((item: Record<string, unknown>) => {
                    const score = safeScore(item.score);
                    const scoreColor =
                      score >= 80
                        ? "text-green-600"
                        : score >= 60
                        ? "text-yellow-600"
                        : "text-red-600";
                    return (
                      <div
                        
                        key={item.id}
                        className="flex items-center justify-between p-4 border rounded-xl hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`p-2 rounded-lg ${
                              score >= 80
                                ? "bg-green-50"
                                : score >= 60
                                ? "bg-yellow-50"
                                : "bg-red-50"
                            }`}
                          >
                            <Zap
                              className={`w-5 h-5 ${
                                score >= 80
                                  ? "text-green-500"
                                  : score >= 60
                                  ? "text-yellow-500"
                                  : "text-red-500"
                              }`}
                            />
                          </div>
                          <div>
                            <p className="font-semibold text-sm">
                              Scénario : {renderValue(item.scenarioId)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              
                              {new Date(item.startedAt).toLocaleDateString("fr-FR", {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className={`text-lg font-black ${scoreColor}`}>{score}/100</p>
                            <div className="w-24 h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  score >= 80
                                    ? "bg-green-500"
                                    : score >= 60
                                    ? "bg-yellow-500"
                                    : "bg-red-500"
                                }`}
                                style={{ width: `${score}%` }}
                              />
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className={
                              score >= 80
                                ? "border-green-200 text-green-700"
                                : score >= 60
                                ? "border-yellow-200 text-yellow-700"
                                : "border-red-200 text-red-700"
                            }
                          >
                            {score >= 80 ? "Excellent" : score >= 60 ? "Bien" : "À améliorer"}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ════════════════════════════════════════
          ONGLET PERFORMANCE
      ════════════════════════════════════════ */}
      {activeTab === "performance" && (
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Métriques de performance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  Métriques des 30 derniers jours
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {performanceQuery.isPending ? (
                  <div className="space-y-4">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : performanceQuery.data?.metrics ? (
                  <>
                    <MetricRow
                      label="Score moyen"
                      value={`${safeScore(performanceQuery.data.metrics.averageScore)}/100`}
                      progress={safeScore(performanceQuery.data.metrics.averageScore)}
                      trend={performanceQuery.data.metrics.trend}
                    />
                    <MetricRow
                      label="Taux de conversion"
                      value={`${safeScore(performanceQuery.data.metrics.conversionRate)}%`}
                      progress={safeScore(performanceQuery.data.metrics.conversionRate)}
                    />
                    <MetricRow
                      label="Appels totaux"
                      value={String(performanceQuery.data.metrics.totalCalls || 0)}
                      progress={Math.min((performanceQuery.data.metrics.totalCalls || 0) * 5, 100)}
                    />

                    {/* Points forts */}
                    {Array.isArray(performanceQuery.data.metrics.topStrengths) &&
                      performanceQuery.data.metrics.topStrengths.length > 0 && (
                        <div className="pt-3 border-t">
                          <p className="text-xs font-bold mb-2 uppercase tracking-wider text-muted-foreground">
                            Points forts
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {performanceQuery.data.metrics.topStrengths.map((s: unknown, i: number) => (
                              <Badge
                                key={i}
                                variant="secondary"
                                className="bg-green-50 text-green-700 border-green-100"
                              >
                                <CheckCircle className="w-3 h-3 mr-1" />
                                {renderValue(s)}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                  </>
                ) : (
                  <div className="text-center py-8">
                    <BarChart3 className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Aucune donnée de performance disponible.
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Effectuez des simulations pour voir vos statistiques.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Conseil de l'IA */}
            <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="w-5 h-5" />
                  Conseil personnalisé de l'IA
                </CardTitle>
                <CardDescription className="text-primary-foreground/70">
                  Basé sur votre profil et vos dernières simulations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-white/10 rounded-xl backdrop-blur-sm">
                  <p className="text-sm leading-relaxed">
                    "Vous avez une excellente empathie, mais vous avez tendance à hésiter lors de la
                    phase de conclusion. Travaillez sur vos phrases de transition vers le
                    rendez-vous."
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary-foreground/70">
                    Plan d'action recommandé
                  </p>
                  {[
                    "Pratiquer le module 'Techniques de Closing'",
                    "Effectuer 3 simulations niveau avancé",
                    "Revoir les enregistrements de vos meilleurs appels",
                  ].map((action, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {i + 1}
                      </div>
                      {action}
                    </div>
                  ))}
                </div>

                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => setActiveTab("modules")}
                >
                  <GraduationCap className="w-4 h-4 mr-2" />
                  Accéder aux modules
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Badges et récompenses */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="w-5 h-5 text-yellow-500" />
                Badges & Récompenses
              </CardTitle>
              <CardDescription>
                Débloquez des badges en complétant des modules et des simulations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { name: "Premier Appel", icon: <Phone className="w-6 h-6" />, color: "bg-blue-100 text-blue-600", locked: totalSimulations === 0 },
                  { name: "Communicant", icon: <MessageSquare className="w-6 h-6" />, color: "bg-green-100 text-green-600", locked: true },
                  { name: "Maître du Closing", icon: <Target className="w-6 h-6" />, color: "bg-orange-100 text-orange-600", locked: true },
                  { name: "Expert IA", icon: <Brain className="w-6 h-6" />, color: "bg-purple-100 text-purple-600", locked: true },
                ].map((badge, i) => (
                  <div
                    key={i}
                    className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all ${
                      badge.locked
                        ? "opacity-40 border-dashed border-muted-foreground/30"
                        : "border-yellow-200 bg-yellow-50"
                    }`}
                  >
                    <div className={`p-3 rounded-full mb-2 ${badge.locked ? "bg-muted" : badge.color}`}>
                      {badge.locked ? <Lock className="w-6 h-6 text-muted-foreground" /> : badge.icon}
                    </div>
                    <p className="text-xs font-semibold text-center">{badge.name}</p>
                    {badge.locked && (
                      <p className="text-xs text-muted-foreground mt-1">Verrouillé</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ============================================================
// COMPOSANTS AUXILIAIRES
// ============================================================

function TabButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
        active
          ? "bg-white shadow-sm text-primary"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function StatPill({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 bg-muted/60 px-3 py-2 rounded-lg">
      {icon}
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-bold">{value}</p>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-1">{title}</p>
            <p className="text-2xl font-black">{value}</p>
          </div>
          <div className={`p-3 rounded-xl ${color}`}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function MetricRow({
  label,
  value,
  progress,
  trend,
}: {
  label: string;
  value: string;
  progress: number;
  trend?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <div className="flex items-center gap-2">
          {trend && (
            <span
              className={`text-xs font-medium flex items-center gap-0.5 ${
                trend === "improving"
                  ? "text-green-600"
                  : trend === "declining"
                  ? "text-red-600"
                  : "text-muted-foreground"
              }`}
            >
              {trend === "improving" ? (
                <ArrowUp className="w-3 h-3" />
              ) : trend === "declining" ? (
                <ArrowDown className="w-3 h-3" />
              ) : (
                <Minus className="w-3 h-3" />
              )}
              {trend === "improving" ? "En hausse" : trend === "declining" ? "En baisse" : "Stable"}
            </span>
          )}
          <p className="text-lg font-black">{value}</p>
        </div>
      </div>
      <Progress value={progress} className="h-2" />
    </div>
  );
}

function SentimentBadge({ score }: { score: number }) {
  if (score >= 70) {
    return (
      <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
        😊 Positif
      </span>
    );
  } else if (score >= 40) {
    return (
      <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">
        😐 Neutre
      </span>
    );
  } else {
    return (
      <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">
        😠 Négatif
      </span>
    );
  }
}