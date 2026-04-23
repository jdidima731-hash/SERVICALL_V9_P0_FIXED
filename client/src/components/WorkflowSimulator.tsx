
/**
 * WORKFLOW SIMULATOR COMPONENT
 * Panneau de simulation pour tester les workflows
 * ✅ BLOC 3 : Refonte visuelle et support des nouvelles actions
 */

import { useState } from "react";
import { Play, 
  X, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Activity,
  Terminal,
  RefreshCw,
  Cpu,
  Database,
  ShieldCheck,
  Zap
 } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SimulationLog {
  stepName: string;
  stepType: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  message: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

interface WorkflowSimulatorProps {
  workflow: Record<string, unknown>;
  onClose: () => void;
}

export function WorkflowSimulator({ workflow, onClose }: WorkflowSimulatorProps) {
  const [logs, setLogs] = useState<SimulationLog[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [result, setResult] = useState<any>(null);
  
  const { data: hasKeyData } = trpc.aiAutomation.industryConfig.hasOpenAiKey.useQuery();

  const simulateMutation = trpc.aiAutomation.workflows.simulate.useMutation({
    onSuccess: (data: any) => {
      setLogs(data.logs || []);
      setResult(data);
      setIsSimulating(false);
      if (data.success) {
        toast.success("Simulation terminée !");
      } else {
        toast.error("La simulation a détecté des erreurs.");
      }
    },
    onError: (error) => {
      setIsSimulating(false);
      toast.error(`Erreur système : ${error.message}`);
    }
  });

  const handleStartSimulation = () => {
    setIsSimulating(true);
    setLogs([]);
    setResult(null);
    
    // Simuler un délai pour l'effet "traitement"
    setTimeout(() => {
      simulateMutation.mutate({
        workflowData: workflow,
        mockData: {
          prospect: {
            id: 123,
            firstName: "Jean",
            lastName: "Dupont",
            phone: "+33612345678",
            company: "Servicall Demo"
          },
          last_message: "Bonjour, je souhaiterais obtenir un devis pour votre service de secrétariat.",
          transcription: "Client: Bonjour je voudrais un devis. Agent: Très bien je m'en occupe.",
          source: "Appel entrant"
        }
      });
    }, 1200);
  };

  const getStatusIcon = (status: SimulationLog['status']) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="text-emerald-400 w-4 h-4" />;
      case 'failed': return <XCircle className="text-rose-500 w-4 h-4" />;
      case 'running': return <RefreshCw className="text-sky-400 w-4 h-4 animate-spin" />;
      case 'skipped': return <Clock className="text-slate-500 w-4 h-4" />;
      default: return <Clock className="text-slate-600 w-4 h-4" />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 border-l border-slate-800 shadow-2xl animate-in slide-in-from-right duration-500 w-[450px]">
      {/* Header */}
      <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/20 rounded-xl">
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-black text-white tracking-tight">Debug Console</h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Environnement de Test</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white">
          <X size={20} />
        </Button>
      </div>

      <div className="p-6 flex-1 overflow-hidden flex flex-col gap-6">
        {/* Control Card */}
        <Card className="border-slate-800 bg-slate-900/50 shadow-none overflow-hidden">
          <div className="p-4 bg-gradient-to-r from-primary/10 to-transparent border-b border-slate-800">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-xs font-black text-white uppercase tracking-tighter">Workflow à tester</span>
            </div>
            
            <p className="text-lg font-bold text-white truncate">{String(workflow.name)}</p>
          </div>
          <CardContent className="p-4">
            {!hasKeyData?.data?.hasKey && (
              <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex gap-3">
                <ShieldCheck className="w-5 h-5 text-amber-500 shrink-0" />
                <p className="text-[11px] text-amber-200/80 leading-tight">
                  <strong>Attention :</strong> Aucune clé OpenAI configurée. Les actions IA seront simulées avec des réponses statiques.
                </p>
              </div>
            )}
            <Button 
              className="w-full h-12 gap-3 font-black text-sm shadow-xl shadow-primary/10 rounded-xl" 
              onClick={handleStartSimulation} 
              disabled={isSimulating}
            >
              {isSimulating ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Play size={18} fill="currentColor" />}
              {isSimulating ? "EXÉCUTION EN COURS..." : "LANCER LE WORKFLOW"}
            </Button>
          </CardContent>
        </Card>

        {/* Console Area */}
        <div className="flex-1 flex flex-col min-h-0 border border-slate-800 rounded-2xl bg-black/40 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/30">
            <div className="flex items-center gap-2">
              <Terminal size={14} className="text-primary" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Pipeline Logs</span>
            </div>
            <div className="flex gap-1">
              <div className="w-2 h-2 rounded-full bg-slate-800" />
              <div className="w-2 h-2 rounded-full bg-slate-800" />
              <div className="w-2 h-2 rounded-full bg-slate-800" />
            </div>
          </div>
          
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-6">
              {logs.length === 0 && !isSimulating && (
                <div className="flex flex-col items-center justify-center py-20 text-slate-700 text-center">
                  <Cpu size={48} className="mb-4 opacity-10" />
                  <p className="text-xs font-bold uppercase tracking-widest opacity-30">Console en attente</p>
                </div>
              )}

              {isSimulating && logs.length === 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 animate-pulse">
                    <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]"></div>
                    <p className="text-[11px] font-mono text-primary uppercase font-bold tracking-widest">Initialisation du moteur...</p>
                  </div>
                  <div className="flex items-center gap-3 opacity-50">
                    <div className="w-2 h-2 rounded-full bg-slate-700"></div>
                    <p className="text-[11px] font-mono text-slate-500">Chargement des variables de contexte...</p>
                  </div>
                </div>
              )}

              {logs.map((log, index) => (
                <div key={index} className="relative pl-6 animate-in fade-in slide-in-from-left-4 duration-500">
                  {/* Vertical Line Connector */}
                  {index < logs.length - 1 && (
                    <div className="absolute left-[7px] top-6 bottom-[-24px] w-[2px] bg-slate-800" />
                  )}
                  
                  <div className="absolute left-0 top-1.5 z-10 bg-slate-950 rounded-full">
                    {getStatusIcon(log.status)}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-primary uppercase tracking-tighter">{log.stepName}</span>
                        <Badge variant="outline" className="text-[8px] h-4 border-slate-800 text-slate-500 px-1">{log.stepType}</Badge>
                      </div>
                      <span className="text-[9px] text-slate-600 font-mono">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                    
                    <div className={cn(
                      "p-3 rounded-xl border font-mono text-[11px] leading-relaxed",
                      log.status === 'failed' ? "bg-rose-500/5 border-rose-500/20 text-rose-200" : "bg-slate-900/50 border-slate-800 text-slate-300"
                    )}>
                      {log.message}
                      
                      {log.data && (
                        <div className="mt-3 pt-3 border-t border-slate-800/50">
                          <div className="flex items-center gap-1.5 mb-2 text-[9px] text-slate-500 uppercase font-bold">
                            <Database className="w-3 h-3" /> Output Data
                          </div>
                          <pre className="text-[10px] text-sky-400/80 overflow-x-auto bg-black/20 p-2 rounded-lg">
                            {JSON.stringify(log.data, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Final Result Summary */}
        {result && (
          <div className={cn(
            "p-4 rounded-2xl border flex items-center justify-between animate-in zoom-in-95 duration-300",
            result.success ? "bg-emerald-500/10 border-emerald-500/20" : "bg-rose-500/10 border-rose-500/20"
          )}>
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded-lg", result.success ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400")}>
                {result.success ? <ShieldCheck className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Rapport Final</p>
                <p className="text-sm font-bold text-white">{result.success ? "Exécution Réussie" : "Exécution Partielle"}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Performance</p>
              <p className="text-sm font-mono font-bold text-primary">{result.duration}ms</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}