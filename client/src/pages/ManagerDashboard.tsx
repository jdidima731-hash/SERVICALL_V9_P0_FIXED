
import React, { useState, useEffect } from "react";
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown, AlertCircle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { RouterOutputs } from "@/types";
import { RealTimeWorkflowMonitor as RealtimeWorkflowMonitor } from "@/components/RealTimeWorkflowMonitor";
import { LiveSupervisionPanel } from "@/components/LiveSupervisionPanel";

// ============================================
// TYPES
// ============================================

interface KPI {
  label: string;
  value: number;
  unit: string;
  trend: number;
  icon: React.ReactNode;
  color: string;
}

interface AgentPerformance {
  agentId: number | null;
  agentName: string;
  totalCalls: number;
  avgDuration: number;
  qualityScore: number;
  conversionRate: number;
  sentiment: "positive" | "neutral" | "negative";
}

interface CallQualityMetric {
  name: string;
  value: number;
  target: number;
}

interface CoachingFeedback {
  agentId: number;
  agentName: string;
  category: string;
  feedback: string;
  severity: "low" | "medium" | "high";
  actionItems: string[];
}

// ============================================
// DASHBOARD MANAGER
// ============================================

export function ManagerDashboard() {
  const [timeRange, setTimeRange] = useState<"day" | "week" | "month">("week");
  const [selectedAgent, setSelectedAgent] = useState<number | null>(null);
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [agentPerformance, setAgentPerformance] = useState<AgentPerformance[]>([]);
  const [coachingFeedback, setCoachingFeedback] = useState<CoachingFeedback[]>([]);
  const [callTrend, setCallTrend] = useState<any[]>([]);
  const [qualityMetrics, setQualityMetrics] = useState<CallQualityMetric[]>([]);

  // Fetch data from tRPC
  const { data: dashboardDataRaw, isPending } = trpc.business.dashboard.getManagerDashboard.useQuery({
    timeRange,
  });
  
  const dashboardData = dashboardDataRaw as RouterOutputs["dashboard"]["getManagerDashboard"];

  // ✅ CORRECTION: Vérifications défensives pour éviter les erreurs
  useEffect(() => {
    if (dashboardData) {
      setKpis(dashboardData.kpis || []);
      setAgentPerformance(dashboardData.agentPerformance || []);
      setCoachingFeedback(dashboardData.coachingFeedback || []);
      setCallTrend(dashboardData.callTrend || []);
      setQualityMetrics(dashboardData.qualityMetrics || []);
    }
  }, [dashboardData]);

  if (isPending) {
    return (
      <div className="flex items-center justify-center h-screen" data-main-content>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">Dashboard Manager</h1>
        <p className="text-slate-400">Suivi en temps réel des performances et coaching IA</p>
      </div>

      {/* Time Range Selector */}
      <div className="flex gap-2 mb-8">
        {(["day", "week", "month"] as const).map((range) => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              timeRange === range
                ? "bg-primary text-white shadow-lg shadow-primary/50"
                : "bg-slate-700 text-slate-300 hover:bg-slate-600"
            }`}
          >
            {range === "day" ? "Aujourd'hui" : range === "week" ? "Cette semaine" : "Ce mois"}
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {kpis.map((kpi, index) => (
          <KPICard key={index} kpi={kpi} />
        ))}
      </div>

      {/* Main Content - Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-slate-700 border-slate-600">
          <TabsTrigger value="overview" className="text-slate-300">
            Vue d'ensemble
          </TabsTrigger>
          <TabsTrigger value="supervision" className="text-slate-300 flex items-center gap-2">
            🎙️ Supervision Live
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
          </TabsTrigger>
          <TabsTrigger value="realtime" className="text-slate-300">
            Workflow Temps Réel
          </TabsTrigger>
          <TabsTrigger value="agents" className="text-slate-300">
            Performance Agents
          </TabsTrigger>
          <TabsTrigger value="quality" className="text-slate-300">
            Qualité d'Appels
          </TabsTrigger>
          <TabsTrigger value="coaching" className="text-slate-300">
            Coaching IA
          </TabsTrigger>
        </TabsList>

        {/* Supervision Live Tab */}
        <TabsContent value="supervision" className="space-y-6">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <LiveSupervisionPanel />
          </div>
        </TabsContent>

        {/* Realtime Workflow Tab */}
        <TabsContent value="realtime" className="space-y-6">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <RealtimeWorkflowMonitor />
          </div>
        </TabsContent>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Call Trend Chart */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Tendance des Appels</CardTitle>
                <CardDescription className="text-slate-400">
                  Nombre d'appels par jour
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={callTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                    <XAxis dataKey="date" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1e293b",
                        border: "1px solid #475569",
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="calls"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ fill: "#3b82f6" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="target"
                      stroke="#10b981"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={{ fill: "#10b981" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Quality Metrics */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Métriques de Qualité</CardTitle>
                <CardDescription className="text-slate-400">
                  Comparaison vs objectifs
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {qualityMetrics.map((metric, index) => (
                  <div key={index}>
                    <div className="flex justify-between mb-2">
                      <span className="text-slate-300">{metric.name}</span>
                      <span className="text-white font-semibold">
                        {metric.value}/{metric.target}
                      </span>
                    </div>
                    <Progress
                      value={(metric.value / metric.target) * 100}
                      className="h-2 bg-slate-700"
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Agents Tab */}
        <TabsContent value="agents" className="space-y-6">
          <div className="grid grid-cols-1 gap-4">
            {agentPerformance.map((agent) => (
              <AgentPerformanceCard
                key={agent.agentId}
                agent={agent}
                isSelected={selectedAgent === agent.agentId}
                onSelect={() => setSelectedAgent(agent.agentId)}
              />
            ))}
          </div>
        </TabsContent>

        {/* Quality Tab */}
        <TabsContent value="quality" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Quality Score Distribution */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Distribution des Scores</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Excellent (90-100)", value: 45, color: "#10b981" },
                        { name: "Bon (80-89)", value: 35, color: "#3b82f6" },
                        { name: "Moyen (70-79)", value: 15, color: "#f59e0b" },
                        { name: "Faible (<70)", value: 5, color: "#ef4444" },
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {[
                        { name: "Excellent (90-100)", value: 45, color: "#10b981" },
                        { name: "Bon (80-89)", value: 35, color: "#3b82f6" },
                        { name: "Moyen (70-79)", value: 15, color: "#f59e0b" },
                        { name: "Faible (<70)", value: 5, color: "#ef4444" },
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Quality Drivers */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Facteurs de Qualité</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { name: "Temps de réponse", value: 85, icon: "clock" },
                  { name: "Satisfaction client", value: 92, icon: "smile" },
                  { name: "Résolution 1er contact", value: 78, icon: "check" },
                  { name: "Professionnalisme", value: 88, icon: "briefcase" },
                ].map((item, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <span className="text-2xl">{item.icon}</span>
                    <div className="flex-1">
                      <p className="text-slate-300 text-sm">{item.name}</p>
                      <Progress value={item.value} className="h-2 bg-slate-700 mt-1" />
                    </div>
                    <span className="text-white font-semibold">{item.value}%</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Coaching Tab */}
        <TabsContent value="coaching" className="space-y-6">
          <div className="grid grid-cols-1 gap-4">
            {coachingFeedback.map((feedback, index) => (
              <CoachingCard key={index} feedback={feedback} />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================
// COMPONENTS
// ============================================

interface KPICardProps {
  kpi: KPI;
}

function KPICard({ kpi }: KPICardProps) {
  const isPositive = kpi.trend >= 0;
  // ✅ BLOC 2: Ne pas afficher de trend si la valeur est à 0 (données insuffisantes)
  const numericValue = typeof kpi.value === 'string' ? parseFloat(kpi.value) : kpi.value;
  const shouldShowTrend = numericValue > 0;

  return (
    <Card className="bg-slate-800 border-slate-700 hover:border-slate-600 transition-all hover:shadow-lg hover:shadow-primary/20">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between mb-4">
          <div className={`p-3 rounded-lg ${kpi.color}`}>
            {kpi.icon}
          </div>
          {shouldShowTrend ? (
            <div
              className={`flex items-center gap-1 text-sm font-semibold ${
                isPositive ? "text-green-400" : "text-red-400"
              }`}
            >
              {isPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              {Math.abs(kpi.trend)}%
            </div>
          ) : (
            <div 
              className="text-slate-500 text-sm font-medium"
              title="Données insuffisantes pour calculer l'évolution"
            >
              —
            </div>
          )}
        </div>
        <h3 className="text-slate-400 text-sm font-medium mb-1">{kpi.label}</h3>
        <p className="text-3xl font-bold text-white">
          {kpi.value}
          <span className="text-lg text-slate-400 ml-2">{kpi.unit}</span>
        </p>
      </CardContent>
    </Card>
  );
}

interface AgentPerformanceCardProps {
  agent: AgentPerformance;
  isSelected: boolean;
  onSelect: () => void;
}

function AgentPerformanceCard({
  agent,
  isSelected,
  onSelect,
}: AgentPerformanceCardProps) {
  const sentimentColors = {
    positive: "text-green-400",
    neutral: "text-blue-400",
    negative: "text-red-400",
  };

  return (
    <Card
      onClick={onSelect}
      className={`bg-slate-800 border-slate-700 cursor-pointer transition-all ${
        isSelected ? "border-primary shadow-lg shadow-primary/20" : "hover:border-slate-600"
      }`}
    >
      <CardContent className="pt-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white">{agent.agentName}</h3>
            <p className="text-slate-400 text-sm">Agent ID: {agent.agentId}</p>
          </div>
          <Badge
            className={`${
              agent.qualityScore >= 85
                ? "bg-green-500"
                : agent.qualityScore >= 70
                ? "bg-yellow-500"
                : "bg-red-500"
            }`}
          >
            {agent.qualityScore.toFixed(1)}/100
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-slate-400 text-sm mb-1">Appels</p>
            <p className="text-2xl font-bold text-white">{agent.totalCalls}</p>
          </div>
          <div>
            <p className="text-slate-400 text-sm mb-1">Durée moyenne</p>
            <p className="text-2xl font-bold text-white">{agent.avgDuration}m</p>
          </div>
          <div>
            <p className="text-slate-400 text-sm mb-1">Taux de conversion</p>
            <p className="text-2xl font-bold text-white">{agent.conversionRate}%</p>
          </div>
          <div>
            <p className="text-slate-400 text-sm mb-1">Sentiment</p>
            <p className={`text-2xl font-bold ${sentimentColors[agent.sentiment]}`}>
              {agent.sentiment === "positive"
                ? "Positif"
                : agent.sentiment === "neutral"
                ? "Neutre"
                : "Négatif"}
            </p>
          </div>
        </div>

        <div>
          <p className="text-slate-400 text-xs mb-2">Score de qualité</p>
          <Progress value={agent.qualityScore} className="h-2 bg-slate-700" />
        </div>
      </CardContent>
    </Card>
  );
}

interface CoachingCardProps {
  feedback: CoachingFeedback;
}

function CoachingCard({ feedback }: CoachingCardProps) {
  const severityColors = {
    low: "bg-blue-500/20 text-blue-300 border-blue-500/50",
    medium: "bg-yellow-500/20 text-yellow-300 border-yellow-500/50",
    high: "bg-red-500/20 text-red-300 border-red-500/50",
  };

  const severityIcons = {
    low: <AlertCircle size={16} />,
    medium: <AlertCircle size={16} />,
    high: <AlertCircle size={16} />,
  };

  return (
    <Card className={`border ${severityColors[feedback.severity]} bg-slate-800`}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white">{feedback.agentName}</h3>
            <p className="text-slate-400 text-sm">{feedback.category}</p>
          </div>
          <div className="flex items-center gap-2">
            {severityIcons[feedback.severity]}
            <Badge
              className={
                feedback.severity === "high"
                  ? "bg-red-500"
                  : feedback.severity === "medium"
                  ? "bg-yellow-500"
                  : "bg-blue-500"
              }
            >
              {feedback.severity === "high"
                ? "Élevée"
                : feedback.severity === "medium"
                ? "Moyenne"
                : "Basse"}
            </Badge>
          </div>
        </div>

        <p className="text-slate-300 mb-4">{feedback.feedback}</p>

        <div>
          <p className="text-slate-400 text-sm font-medium mb-2">Actions recommandées :</p>
          <ul className="space-y-2">
            {feedback.actionItems.map((action, index) => (
              <li key={index} className="flex items-start gap-2 text-slate-300">
                <CheckCircle size={16} className="mt-0.5 text-green-400 flex-shrink-0" />
                <span>{action}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

export default ManagerDashboard;