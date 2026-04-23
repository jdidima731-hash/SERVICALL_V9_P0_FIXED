
import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { RouterOutputs } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  BarChart, Bar, Line, AreaChart, Area, Pie,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Scatter
} from "recharts";
import { TrendingUp, TrendingDown, Users, Phone, Target, DollarSign, 
  Clock, CheckCircle, AlertCircle, Zap, Brain, MessageSquare,
  Calendar, Workflow, Settings, MoreVertical, Download, Filter
 } from 'lucide-react';
import { cn } from "@/lib/utils";

/**
 * CRM Pro Dashboard - Premium Design v5
 * Affiche les KPIs critiques, tendances et actions rapides
 */
export function CRMProDashboard() {
  const { user } = useAuth();
  const [timeRange, setTimeRange] = useState<"day" | "week" | "month">("week");
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);

  const tenantId = user?.tenantId;

  // Récupérer les données du dashboard
  const { data: dashboardDataRaw, isPending: dashboardLoading } = trpc.business.dashboard.getManagerDashboard.useQuery(
    { timeRange },
    { enabled: !!tenantId, retry: 1 }
  );

  
  const _dashboardData = dashboardDataRaw as RouterOutputs["dashboard"]["getManagerDashboard"];

  // Mock data pour la démo (à remplacer par des vraies données)
  const kpis = [
    {
      id: "calls",
      label: "Appels Totaux",
      value: 2847,
      change: 12,
      icon: Phone,
      color: "bg-blue-500/10 text-blue-600",
      trend: "up"
    },
    {
      id: "conversion",
      label: "Taux de Conversion",
      value: "42.5%",
      change: 3.2,
      icon: Target,
      color: "bg-green-500/10 text-green-600",
      trend: "up"
    },
    {
      id: "revenue",
      label: "Revenu Généré",
      value: "€12,450",
      change: 8.1,
      icon: DollarSign,
      color: "bg-emerald-500/10 text-emerald-600",
      trend: "up"
    },
    {
      id: "satisfaction",
      label: "Satisfaction Client",
      value: "4.7/5",
      change: -0.2,
      icon: MessageSquare,
      color: "bg-purple-500/10 text-purple-600",
      trend: "down"
    }
  ];

  const trendData = [
    { date: "Lun", calls: 380, conversions: 160, revenue: 2400 },
    { date: "Mar", calls: 420, conversions: 180, revenue: 2800 },
    { date: "Mer", calls: 390, conversions: 165, revenue: 2600 },
    { date: "Jeu", calls: 450, conversions: 195, revenue: 3100 },
    { date: "Ven", calls: 520, conversions: 220, revenue: 3500 },
    { date: "Sam", calls: 380, conversions: 150, revenue: 2300 },
    { date: "Dim", calls: 305, conversions: 125, revenue: 1900 },
  ];

  const agentPerformance = [
    { name: "Agent IA #1", calls: 450, conversion: 45, satisfaction: 4.8 },
    { name: "Agent IA #2", calls: 420, conversion: 42, satisfaction: 4.6 },
    { name: "Agent IA #3", calls: 380, conversion: 40, satisfaction: 4.5 },
    { name: "Agent Humain #1", calls: 320, conversion: 38, satisfaction: 4.7 },
    { name: "Agent Humain #2", calls: 295, conversion: 35, satisfaction: 4.4 },
  ];

  const recentActivities = [
    { id: 1, type: "call", title: "Appel complété", description: "Prospect: Jean Dupont", time: "5 min", status: "success" },
    { id: 2, type: "workflow", title: "Workflow déclenché", description: "Campagne: Q1 2026", time: "12 min", status: "processing" },
    { id: 3, type: "alert", title: "Alerte IA", description: "Sentiment négatif détecté", time: "18 min", status: "warning" },
    { id: 4, type: "conversion", title: "Conversion réussie", description: "Montant: €450", time: "25 min", status: "success" },
  ];

  if (dashboardLoading) {
    return (
      <div className="p-8 space-y-6">
        <div className="h-12 bg-slate-200 rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-slate-200 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50 p-8 space-y-8">
      {/* Header Premium */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">
            Tableau de Bord <span className="text-blue-600">CRM Pro</span>
          </h1>
          <p className="text-slate-600 mt-2 font-medium">Supervision en temps réel de vos campagnes et agents IA</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="w-4 h-4" />
            Exporter
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="w-4 h-4" />
            Filtrer
          </Button>
          <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 p-1">
            {(["day", "week", "month"] as const).map((range) => (
              <Button
                key={range}
                variant={timeRange === range ? "default" : "ghost"}
                size="sm"
                onClick={() => setTimeRange(range)}
                className="capitalize text-xs font-bold"
              >
                {range === "day" ? "Jour" : range === "week" ? "Semaine" : "Mois"}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* KPIs Premium Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          const isSelected = selectedMetric === kpi.id;
          
          return (
            <Card
              key={kpi.id}
              className={cn(
                "cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1 border-0 shadow-md",
                isSelected && "ring-2 ring-blue-500 shadow-lg -translate-y-1"
              )}
              onClick={() => setSelectedMetric(isSelected ? null : kpi.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className={cn("p-3 rounded-xl", kpi.color)}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <Badge variant={kpi.trend === "up" ? "default" : "secondary"} className="gap-1">
                    {kpi.trend === "up" ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                    {Math.abs(kpi.change)}%
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{kpi.label}</p>
                <p className="text-3xl font-black text-slate-900 mt-2">{kpi.value}</p>
                <p className="text-xs text-slate-500 mt-2">
                  {kpi.trend === "up" ? "↑" : "↓"} {Math.abs(kpi.change)}% vs. période précédente
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Graphiques Principaux */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tendance Appels & Conversions */}
        <Card className="lg:col-span-2 border-0 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Tendance Appels & Conversions
            </CardTitle>
            <CardDescription>Évolution sur la période sélectionnée</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorConversions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #475569", borderRadius: "8px" }}
                  labelStyle={{ color: "#e2e8f0" }}
                />
                <Area type="monotone" dataKey="calls" stroke="#3b82f6" fillOpacity={1} fill="url(#colorCalls)" name="Appels" />
                <Area type="monotone" dataKey="conversions" stroke="#10b981" fillOpacity={1} fill="url(#colorConversions)" name="Conversions" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Performance par Agent */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-600" />
              Top Agents
            </CardTitle>
            <CardDescription>Performance cette semaine</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {agentPerformance.slice(0, 4).map((agent, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{agent.name}</p>
                  <p className="text-xs text-slate-500">{agent.calls} appels</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-green-600">{agent.conversion}%</p>
                  <p className="text-xs text-slate-500">conv.</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Activités Récentes & Workflows */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activités */}
        <Card className="lg:col-span-2 border-0 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-600" />
              Activités Récentes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentActivities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-4 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                <div className={cn(
                  "p-2 rounded-lg shrink-0",
                  activity.status === "success" && "bg-green-500/10 text-green-600",
                  activity.status === "processing" && "bg-blue-500/10 text-blue-600",
                  activity.status === "warning" && "bg-orange-500/10 text-orange-600",
                )}>
                  {activity.status === "success" && <CheckCircle className="w-5 h-5" />}
                  {activity.status === "processing" && <Zap className="w-5 h-5 animate-pulse" />}
                  {activity.status === "warning" && <AlertCircle className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900">{activity.title}</p>
                  <p className="text-xs text-slate-600">{activity.description}</p>
                </div>
                <p className="text-xs text-slate-500 shrink-0">{activity.time}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-600" />
              Actions Rapides
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button className="w-full justify-start gap-2 bg-blue-600 hover:bg-blue-700 text-white">
              <Phone className="w-4 h-4" />
              Lancer Campagne
            </Button>
            <Button className="w-full justify-start gap-2 variant-outline">
              <Workflow className="w-4 h-4" />
              Créer Workflow
            </Button>
            <Button className="w-full justify-start gap-2 variant-outline">
              <Brain className="w-4 h-4" />
              Configurer IA
            </Button>
            <Button className="w-full justify-start gap-2 variant-outline">
              <Settings className="w-4 h-4" />
              Paramètres
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Breakdown */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-600" />
            Revenu par Canal
          </CardTitle>
          <CardDescription>Répartition des revenus générés</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={[
                { name: "Voice AI", value: 4500, fill: "#3b82f6" },
                { name: "WhatsApp", value: 3200, fill: "#10b981" },
                { name: "Web Chat", value: 2800, fill: "#f59e0b" },
                { name: "Social Media", value: 1950, fill: "#8b5cf6" },
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #475569", borderRadius: "8px" }} labelStyle={{ color: "#e2e8f0" }} />
                <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            
            <div className="space-y-4">
              {[
                { name: "Voice AI", value: "€4,500", percent: 38, color: "bg-blue-600" },
                { name: "WhatsApp", value: "€3,200", percent: 27, color: "bg-green-600" },
                { name: "Web Chat", value: "€2,800", percent: 24, color: "bg-amber-600" },
                { name: "Social Media", value: "€1,950", percent: 17, color: "bg-purple-600" },
              ].map((item, i) => (
                <div key={i}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-bold text-slate-900">{item.name}</span>
                    <span className="text-sm font-black text-slate-600">{item.value}</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all", item.color)} style={{ width: `${item.percent}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}