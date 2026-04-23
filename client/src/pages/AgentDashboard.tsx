
import { Phone, 
  PhoneIncoming, 
  PhoneOutgoing, 
  PhoneMissed,
  Calendar,
  Users,
  TrendingUp,
  Clock,
  CheckCircle,
  Zap
 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { useTenant } from "@/contexts/TenantContext";

export default function AgentDashboard() {
  const { tenantId } = useTenant();

  // Real data from tRPC
  const {data: dashboardData} = trpc.business.dashboard.getManagerDashboard.useQuery(
    { timeRange: "day" },
    { enabled: tenantId > 0 }
  );

  const { data: apiCalls } = trpc.communication.calls.list.useQuery(
    {},
    { enabled: tenantId > 0 }
  );

  const dData = dashboardData as Record<string,unknown> | undefined;
  const aCalls = apiCalls as Record<string,unknown>[] | undefined;

  // ✅ CORRECTION: Vérifications défensives pour éviter les erreurs de lecture
  const stats = [
    { 
      title: "Total Appels", 
      
      value: dData?.kpis?.find((k: any) => k.label === "Appels Totaux")?.value || "0", 
      icon: Phone, 
      color: "text-primary", 
      bg: "bg-primary/10" 
    },
    { 
      title: "Entrants", 
      
      value: dData?.callsByStatus?.active || "0", 
      icon: PhoneIncoming, 
      color: "text-green-600", 
      bg: "bg-green-500/10" 
    },
    { 
      title: "Sortants", 
      
      value: dData?.callsByStatus?.completed || "0", 
      icon: PhoneOutgoing, 
      color: "text-blue-600", 
      bg: "bg-blue-500/10" 
    },
    { 
      title: "Manqués", 
      
      value: dData?.callsByStatus?.failed || "0", 
      icon: PhoneMissed, 
      color: "text-red-600", 
      bg: "bg-red-500/10" 
    },
  ];

  
  const recentCalls = aCalls?.data?.slice(0, 3) || [];

  return (
    <div className="space-y-8 animate-fade-in" data-main-content>
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Bonjour, Agent Elite 👋</h1>
          <p className="text-muted-foreground mt-1">Voici un aperçu de vos performances aujourd'hui.</p>
        </div>
        <div className="flex items-center gap-2 bg-card p-2 rounded-lg border border-border shadow-sm">
          <Clock className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold">Session : 04h 12m</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <Card key={i} className="border-none shadow-md hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                  <h3 className="text-3xl font-black mt-1">{stat.value}</h3>
                </div>
                <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                  <stat.icon className="w-6 h-6" />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-1 text-xs font-bold text-green-600">
                <TrendingUp className="w-3 h-3" />
                <span>+12% vs hier</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <Card className="lg:col-span-2 border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xl font-bold">Activité Récente</CardTitle>
              <CardDescription>Derniers appels et interactions</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="text-primary font-bold">Voir tout</Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentCalls.length > 0 ? recentCalls.map((call: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-transparent hover:border-primary/20 transition-colors cursor-pointer">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white font-bold">
                      {(call.fromNumber || "IN").substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-sm">Appel avec {call.fromNumber || "Inconnu"}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(call.createdAt).toLocaleTimeString()} • Durée: {Math.floor((call.duration || 0) / 60)}:{((call.duration || 0) % 60).toString().padStart(2, '0')}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="rounded-full">Détails</Badge>
                </div>
              )) : (
                <div className="text-center py-8 text-muted-foreground">Aucune activité récente</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Tasks */}
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl font-bold">Tâches Urgentes</CardTitle>
            <CardDescription>Actions prioritaires</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { t: "Rappeler Innovate SAS", d: "Aujourd'hui, 14:30", p: "Haute" },
                { t: "Envoyer devis Tech Corp", d: "Aujourd'hui, 16:00", p: "Moyenne" },
                { t: "Suivi dossier Martin", d: "Demain, 09:00", p: "Basse" },
              ].map((task, i) => (
                <div key={i} className="p-4 rounded-xl border border-border bg-card hover:bg-muted/20 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                      task.p === "Haute" ? "bg-red-100 text-red-600" : 
                      task.p === "Moyenne" ? "bg-orange-100 text-orange-600" : "bg-blue-100 text-blue-600"
                    }`}>
                      {task.p}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-bold">{task.d}</span>
                  </div>
                  <p className="text-sm font-bold">{task.t}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            Actions Rapides
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button variant="outline" className="gap-2 h-12">
              <Phone className="w-4 h-4" />
              Appeler
            </Button>
            <Button variant="outline" className="gap-2 h-12">
              <Users className="w-4 h-4" />
              Prospects
            </Button>
            <Button variant="outline" className="gap-2 h-12">
              <CheckCircle className="w-4 h-4" />
              Tâches
            </Button>
            <Button variant="outline" className="gap-2 h-12">
              <Calendar className="w-4 h-4" />
              Agenda
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}