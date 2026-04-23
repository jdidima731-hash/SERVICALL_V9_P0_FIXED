
/**
 * BLOC 5 - ROI & Onboarding Dashboard
 * Visualisation des gains et guide de démarrage
 */

// import React from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, 
  Clock, 
  Euro, 
  CheckCircle2, 
  Circle, 
  ArrowUpRight,
  Zap,
  ShieldCheck
 } from 'lucide-react';

interface ROIDashboardProps {
}


export default function ROIDashboard({ tenantId }: ROIDashboardProps) {
  const { data: metrics, isLoading: metricsLoading } = trpc.aiAutomation.roi.getMetrics.useQuery({
    
    tenantId,
    
    days: 30
  });

  const { data: steps, isLoading: stepsLoading } = trpc.aiAutomation.roi.getOnboardingStatus.useQuery({
    tenantId
  });

  if (metricsLoading || stepsLoading) return <div className="animate-pulse h-48 bg-slate-100 rounded-lg"></div>;

  const completionRate = steps ? (steps.filter(s => s.completed).length / steps.length) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* SECTION ROI - GAINS IA */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-green-500 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="w-4 h-4 text-green-500" /> Temps Gagné (30j)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.timeSavedMinutes} min</div>
            <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3 text-green-500" /> +12% vs mois dernier
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <Euro className="w-4 h-4 text-blue-500" /> Économies Estimées
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.moneySavedEuro} €</div>
            <p className="text-[10px] text-muted-foreground mt-1">Basé sur le coût horaire agent</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-purple-500" /> Taux d'Adoption IA
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.aiConversionRate}%</div>
            <div className="mt-2">
              <Progress value={metrics?.aiConversionRate} className="h-1 bg-purple-100" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SECTION ONBOARDING - CHECKLIST */}
      <Card className="border-none bg-slate-50/50 shadow-inner">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-500" /> Guide de configuration Servicall V2
              </CardTitle>
              <CardDescription className="text-[11px]">
                Complétez ces étapes pour maximiser votre ROI
              </CardDescription>
            </div>
            <Badge variant="secondary" className="bg-white border-slate-200">
              {Math.round(completionRate)}%
            </Badge>
          </div>
          <Progress value={completionRate} className="h-1.5 mt-4" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {steps?.map((step) => (
              <div 
                key={step.id} 
                className={`flex items-center justify-between p-3 rounded-md border ${step.completed ? 'bg-white border-green-100' : 'bg-slate-50 border-slate-200 opacity-70'}`}
              >
                <div className="flex items-center gap-3">
                  {step.completed ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : (
                    <Circle className="w-5 h-5 text-slate-300" />
                  )}
                  <div>
                    <p className={`text-sm font-medium ${step.completed ? 'text-slate-900' : 'text-slate-500'}`}>
                      {step.title}
                    </p>
                    {step.importance === 'high' && !step.completed && (
                      <Badge variant="destructive" className="text-[9px] h-4 py-0">Critique</Badge>
                    )}
                  </div>
                </div>
                {step.completed && (
                  <Badge variant="outline" className="text-[10px] text-green-600 border-green-200 bg-green-50">
                    Actif
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* FOOTER - SÉCURITÉ */}
      <div className="flex items-center justify-center gap-2 py-2 px-4 bg-green-50 rounded-full border border-green-100 w-fit mx-auto">
        <ShieldCheck className="w-4 h-4 text-green-600" />
        <span className="text-[10px] font-semibold text-green-700 uppercase tracking-wider">
          Données sécurisées par PostgreSQL RLS & Isolation Multi-Tenant
        </span>
      </div>
    </div>
  );
}