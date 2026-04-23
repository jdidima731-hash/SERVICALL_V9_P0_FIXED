
/**
 * BLOC 4 - Live Copilot Panel
 * Interface d'assistance en temps réel pour l'agent pendant l'appel
 */

import { useEffect, useState } from "react";
import { trpc, RouterOutputs } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, 
  MessageSquare, 
  ShieldCheck, 
  TrendingUp, 
  ChevronRight,
  User,
  Calendar,
  Zap
 } from 'lucide-react';

interface LiveCopilotPanelProps {
  tenantId: number;
  transcription: string;
  isActive: boolean;
  prospectName?: string;
}

export default function LiveCopilotPanel({ 
  tenantId, 
  transcription, 
  isActive,
  prospectName 
}: LiveCopilotPanelProps) {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  
  type ExtractedDataOutput = RouterOutputs["copilot"]["extractData"];
  const [extractedData, setExtractedData] = useState<ExtractedDataOutput>({});
  
  const suggestionsMutation = trpc.aiAutomation.copilot.getSuggestions.useMutation();
  const extractMutation = trpc.aiAutomation.copilot.extractData.useMutation();

  // Analyse périodique de la transcription (toutes les 5 secondes si active)
  useEffect(() => {
    if (!isActive || !transcription || transcription.length < 20) return;

    const interval = setInterval(async () => {
      try {
        const result = await suggestionsMutation.mutateAsync({
          
          tenantId,
          transcription: transcription.slice(-500), // Analyser les 500 derniers caractères
          context: { prospectName }
        });
        setSuggestions(result);

        // Extraire les données en parallèle
        const data = await extractMutation.mutateAsync({
          
          tenantId,
          transcription
        });
        setExtractedData(data);
      } catch (err: any) {
        console.error("Copilot analysis error", err);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isActive, transcription, tenantId, prospectName]);

  if (!isActive) return null;

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Suggestions IA */}
      <Card className="border-purple-200 bg-purple-50/30">
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center gap-2 text-purple-700">
            <Sparkles className="w-4 h-4" />
            Copilote IA : Aide en direct
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          <ScrollArea className="h-[250px] pr-4">
            <div className="space-y-3">
              {suggestions.length === 0 && (
                <p className="text-xs text-muted-foreground italic text-center py-4">
                  En attente de transcription pour générer des aides...
                </p>
              )}
              {suggestions.map((s, i) => (
                <div key={i} className="p-3 rounded-md bg-white border border-purple-100 shadow-sm animate-in fade-in slide-in-from-right-2">
                  <div className="flex items-center justify-between mb-1">
                    <Badge variant="outline" className="text-[10px] uppercase bg-purple-50">
                      {s.type === "objection_handling" && <ShieldCheck className="w-3 h-3 mr-1" />}
                      {s.type === "upsell" && <TrendingUp className="w-3 h-3 mr-1" />}
                      {s.type === "next_step" && <ChevronRight className="w-3 h-3 mr-1" />}
                      {s.title}
                    </Badge>
                    <span className="text-[10px] text-purple-400 font-bold">{s.confidence}%</span>
                  </div>
                  <p className="text-sm text-slate-700 font-medium">{s.content}</p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Données extraites en temps réel */}
      <Card className="border-blue-100">
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center gap-2 text-blue-700">
            <Zap className="w-4 h-4" />
            Données détectées
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          <div className="grid grid-cols-1 gap-2">
            <div className="flex items-center justify-between p-2 bg-slate-50 rounded-md">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <User className="w-3 h-3" /> Nom
              </div>
              <span className="text-xs font-bold">{extractedData.firstName ?? "---"} {extractedData.lastName ?? ""}</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-slate-50 rounded-md">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Calendar className="w-3 h-3" /> RDV
              </div>
              <span className="text-xs font-bold">{extractedData.appointmentDate ?? "Non mentionné"}</span>
            </div>
            <div className="p-2 bg-slate-50 rounded-md">
              <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                <MessageSquare className="w-3 h-3" /> Besoin principal
              </div>
              <p className="text-xs font-bold truncate">{extractedData.primaryNeed ?? "Identification en cours..."}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}