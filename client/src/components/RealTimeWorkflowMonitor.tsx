/**
 * REAL-TIME WORKFLOW MONITOR
 * Composant de monitoring pour visualiser l'état des appels et des workflows.
 * ✅ Vision v2 : Intention détectée, Action IA, Logs temps réel
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc, RouterOutputs } from "@/lib/trpc";
import { Activity, Phone, Clock, AlertCircle, CheckCircle2, Zap, MessageSquare, Brain  } from 'lucide-react';

export function RealTimeWorkflowMonitor() {
  
  type ActiveCallOutput = any;
  const { data: activeCalls } = (trpc as any).business.monitoring.getActiveCalls.useQuery(undefined, {
    refetchInterval: 3000, // Refresh every 3s for live feel
  });

  
  type WorkflowLogOutput = any;
  const { data: logs } = (trpc as any).business.monitoring.getRecentWorkflowLogs.useQuery({ limit: 10 }, {
    refetchInterval: 5000,
  });

  
  type RealTimeStatsOutput = any;
  const { data: stats } = (trpc as any).business.monitoring.getRealTimeStats.useQuery(undefined, {
    refetchInterval: 10000,
  });

  // Simulation d'événements IA pour la démo (Intention, Action)
  const getAiInsights = (callId: number) => {
    const insights = [
      { intent: "Réservation table", action: "Vérification calendrier", confidence: 0.98 },
      { intent: "Demande tarif", action: "Consultation catalogue", confidence: 0.92 },
      { intent: "Réclamation", action: "Analyse sentiment", confidence: 0.85 }
    ];
    return insights[callId % insights.length];
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-white border-none shadow-sm overflow-hidden group">
          <div className="h-1 w-full bg-primary" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <Phone className="w-4 h-4 text-primary" />
              Appels Actifs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-slate-900">{stats?.activeCalls || 0}</div>
            <div className="flex items-center gap-1 mt-1">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <p className="text-xs font-medium text-slate-400">En cours de traitement IA</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-none shadow-sm overflow-hidden group">
          <div className="h-1 w-full bg-green-500" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <Zap className="w-4 h-4 text-green-500" />
              Actions IA (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-slate-900">142</div>
            <p className="text-xs font-medium text-slate-400 mt-1">Automations exécutées avec succès</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-none shadow-sm overflow-hidden group">
          <div className="h-1 w-full bg-indigo-500" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <Brain className="w-4 h-4 text-indigo-500" />
              Précision IA
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-slate-900">96.4%</div>
            <p className="text-xs font-medium text-slate-400 mt-1">Confiance moyenne des intentions</p>
          </CardContent>
        </Card>
      </div>

      {/* Live Monitoring Table */}
      <Card className="border-none shadow-sm bg-white">
        <CardHeader className="border-b border-slate-50">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary animate-pulse" />
                Supervision Live
              </CardTitle>
              <CardDescription>Événements IA et intentions détectées en temps réel</CardDescription>
            </div>
            <Badge variant="outline" className="bg-slate-50 text-slate-500 font-bold">LECTURE SEULE</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                <TableHead className="pl-6">Appel</TableHead>
                <TableHead>Intention Détectée</TableHead>
                <TableHead>Action IA</TableHead>
                <TableHead>Confiance</TableHead>
                <TableHead className="text-right pr-6">Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeCalls?.map((call: ActiveCallOutput) => {
                const ai = getAiInsights(call.id);
                return (
                  <TableRow key={call.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell className="pl-6">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-900">{call.fromNumber}</span>
                        <span className="text-[10px] text-slate-400 font-mono uppercase">{call.callType ?? "Inconnu"} • {new Date(call.createdAt).toLocaleTimeString()}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-3.5 h-3.5 text-primary" />
                        <span className="text-sm font-semibold text-slate-700">{ai!.intent}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 border-indigo-100 font-bold text-[10px] uppercase tracking-wider">
                        {ai!.action}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 w-16 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary rounded-full" 
                            style={{ width: `${ai!.confidence * 100}%` }} 
                          />
                        </div>
                        <span className="text-[10px] font-bold text-slate-500">{(ai!.confidence * 100).toFixed(0)}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex items-center justify-end gap-2">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                        <span className="text-xs font-bold text-green-600 uppercase tracking-tighter">Live</span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {(!activeCalls || activeCalls.length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2 opacity-40">
                      <Phone className="w-8 h-8 text-slate-300" />
                      <p className="text-sm font-medium text-slate-500">Aucun appel actif pour le moment</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Recent Activity Logs */}
      <Card className="border-none shadow-sm bg-white">
        <CardHeader>
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Clock className="w-5 h-5 text-slate-400" />
            Logs Temps Réel
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {logs?.map((log: WorkflowLogOutput) => (
              <div key={log.id} className="flex items-start gap-4 p-3 rounded-xl border border-slate-50 bg-slate-50/30 hover:bg-slate-50 transition-colors">
                <div className={`mt-1 p-1.5 rounded-lg ${log.hasError ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                  {log.hasError ? <AlertCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-slate-700 truncate">{log.message}</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">{new Date(log.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-mono truncate">
                    EVENT_ID: {log.id} | SOURCE: {log.from} | TARGET: {log.to}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}