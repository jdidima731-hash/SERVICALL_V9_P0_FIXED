import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

import { Button } from './ui/button';
import { Lightbulb, AlertTriangle, Info, MessageSquare, CheckCircle, XCircle  } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

interface AssistData {
  complianceAlert?: string;
  suggestions?: string[];
  relevantInfo?: string;
}

interface AgentAssistProps {
  tenantId: number;
  callSid: string;
  transcription: string;
  
  onSuggestionClick: (suggestion: string) => void;
}

/**
 * Hook useDebounce personnalisé
 * ✅ Bloc 10: Évite les requêtes inutiles et réduit les coûts
 */
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState(value);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

export const AgentAssist: React.FC<AgentAssistProps> = ({
  tenantId,
  callSid,
  transcription,
  
  onSuggestionClick
}) => {
  const [assistData, setAssistData] = useState<AssistData | null>(null);

  // ✅ Bloc 10: Débouncer la transcription avec un délai de 1 seconde
  const debouncedTranscription = useDebounce(transcription, 1000);

  const recordDecisionMutation = trpc.communication.softphone.recordAIDecision.useMutation();
  
  const { data: realAssistData } = trpc.communication.softphone.getAgentAssist.useQuery(
    { 
      callId: parseInt(callSid) || 0, 
      transcription: debouncedTranscription 
    },
    { 
      // ✅ Bloc 10: Configuration optimisée
      enabled: debouncedTranscription.length > 20,
      refetchInterval: 5000,
      staleTime: 2000, // 2 secondes
    }
  );

  useEffect(() => {
    if (realAssistData) {
      setAssistData(realAssistData as AssistData);
    }
  }, [realAssistData]);

  const handleDecision = async (suggestion: string, accepted: boolean) => {
    try {
      await recordDecisionMutation.mutateAsync({
        callId: parseInt(callSid) || 0,
        decision: suggestion,
        metadata: {
          accepted,
          tenantId,
          timestamp: new Date().toISOString()
        }
      });
      
      if (accepted) {
        onSuggestionClick(suggestion);
        toast.success("Suggestion appliquée");
      } else {
        toast.info("Suggestion rejetée");
      }
    } catch (error: any) {
      console.error("Erreur lors de l'enregistrement de la décision", error);
    }
  };

  if (!assistData) return null;

  return (
    <Card className="border-blue-200 bg-blue-50/30 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold flex items-center gap-2 text-blue-700">
          <Lightbulb className="h-4 w-4" />
          Assistant IA en temps réel
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {assistData.complianceAlert && (
          <div className="flex items-start gap-2 p-2 rounded bg-red-100 text-red-800 text-xs border border-red-200">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{assistData.complianceAlert}</span>
          </div>
        )}

        <div className="space-y-3">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
            <MessageSquare className="h-3 w-3" /> Suggestions d'actions
          </p>
          <div className="space-y-2">
            {assistData.suggestions?.map((suggestion: string, i: number) => (
              <div key={i} className="flex items-center justify-between gap-2 bg-white p-2 rounded border border-blue-100 shadow-sm">
                <span className="text-xs font-medium">{suggestion}</span>
                <div className="flex gap-1">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 text-green-600 hover:bg-green-50"
                    onClick={() => handleDecision(suggestion, true)}
                  >
                    <CheckCircle className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 text-red-600 hover:bg-red-50"
                    onClick={() => handleDecision(suggestion, false)}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {assistData.relevantInfo && (
          <div className="p-2 rounded bg-blue-100/50 text-blue-900 text-xs border border-blue-200">
            <p className="font-bold flex items-center gap-1 mb-1">
              <Info className="h-3 w-3" /> Contexte Prospect
            </p>
            {assistData.relevantInfo}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
