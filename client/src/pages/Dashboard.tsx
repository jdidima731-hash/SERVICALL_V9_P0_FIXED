import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { RouterOutputs } from "@/types";
import { Card } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";

import { Building2,
  DollarSign,
  Smile,
  Calendar,
  LayoutDashboard,
  Settings2,
  Activity,
  CheckCircle2
 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CRMStateTable } from "@/components/CRMStateTable";
import { AIWorkflowConfig } from "@/components/AIWorkflowConfig";
import { RealTimeWorkflowMonitor } from "@/components/RealTimeWorkflowMonitor";

export default function DashboardFixed() {
  // const {_t} = useTranslation(['dashboard', 'common']);
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState("crm-state");
  
  
  const tenantId = user?.tenantId || 0;

  const { 
    data: dashboardDataRaw, 
    isPending: dashboardLoading, 
    isError: dashboardError,
    refetch 
  } = trpc.business.dashboard.getManagerDashboard.useQuery(
    { timeRange: "week" },
    { enabled: tenantId > 0, retry: 1 }
  );

  
  const dashboardData = dashboardDataRaw as RouterOutputs["business"]["dashboard"]["getManagerDashboard"];

  if (authLoading || dashboardLoading) {
    return (
      <div className="p-8 space-y-6">
        <LoadingState variant="skeleton" skeletonCount={4} />
      </div>
    );
  }

  if (dashboardError) {
    return (
      <div className="p-8">
        <ErrorState onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6 animate-fade-in bg-slate-50/50 min-h-screen" data-main-content>
      {/* Header Unifié */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900">ServiceCall <span className="text-primary">V8 PRO</span></h1>
          <p className="text-muted-foreground font-medium">Plateforme IA Autonome & Supervision Live</p>
        </div>
        <div className="flex items-center gap-3 bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 rounded-xl border border-green-500/20">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-bold text-green-700 uppercase tracking-wider">IA Active</span>
          </div>
          <div className="h-4 w-px bg-slate-200" />
          <div className="px-3 py-1.5">
            <span className="text-xs font-medium text-slate-500">Tenant: <span className="text-slate-900 font-bold">Demo</span></span>
          </div>
        </div>
      </div>

      {/* Navigation Principale par Onglets */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
        <TabsList className="bg-slate-200/50 p-1.5 rounded-2xl border border-slate-200 w-fit">
          <TabsTrigger value="crm-state" className="gap-2 px-6 py-2.5 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-md transition-all">
            <CheckCircle2 className="w-4 h-4" />
            <span className="font-bold">État CRM</span>
          </TabsTrigger>
          <TabsTrigger value="monitoring" className="gap-2 px-6 py-2.5 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-md transition-all">
            <Activity className="w-4 h-4" />
            <span className="font-bold">Live Monitoring</span>
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-2 px-6 py-2.5 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-md transition-all">
            <Settings2 className="w-4 h-4" />
            <span className="font-bold">Configuration IA</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2 px-6 py-2.5 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-md transition-all">
            <LayoutDashboard className="w-4 h-4" />
            <span className="font-bold">Analytique</span>
          </TabsTrigger>
        </TabsList>

        {/* Contenu : État CRM (Centralisé) */}
        <TabsContent value="crm-state" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <CRMStateTable />
        </TabsContent>

        {/* Contenu : Live Monitoring */}
        <TabsContent value="monitoring" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <RealTimeWorkflowMonitor />
        </TabsContent>

        {/* Contenu : Configuration IA (Workflow IA) */}
        <TabsContent value="config" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <AIWorkflowConfig />
        </TabsContent>

        {/* Contenu : Analytique (KPIs existants) */}
	        <TabsContent value="analytics" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
	          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
	            {dashboardData?.kpis?.map((kpi, i: number) => (
	              <Card key={i} className="p-6 border-none shadow-sm hover:shadow-md transition-all bg-white">
	                <div className="flex items-center justify-between">
	                  <div>
	                    <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">{kpi.label as string}</p>
	                    <div className="flex items-baseline gap-1 mt-2">
	                      <span className="text-3xl font-black text-slate-900">{kpi.value as string}</span>
	                      <span className="text-sm font-bold text-slate-400">{kpi.unit as string}</span>
	                    </div>
	                  </div>
	                  <div className={`p-4 rounded-2xl ${kpi.color as string} shadow-inner`}>
	                    {kpi.icon === "building" && <Building2 className="w-6 h-6" />}
	                    {kpi.icon === "dollar" && <DollarSign className="w-6 h-6" />}
	                    {kpi.icon === "smile" && <Smile className="w-6 h-6" />}
	                    {kpi.icon === "calendar" && <Calendar className="w-6 h-6" />}
	                  </div>
	                </div>
	              </Card>
	            ))}
	          </div>
	        </TabsContent>
      </Tabs>
    </div>
  );
}