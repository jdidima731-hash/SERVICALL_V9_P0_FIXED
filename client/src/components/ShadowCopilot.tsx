/**
 * SHADOW COPILOT — Assistant IA temps réel pendant les appels
 * Souffle des suggestions à l'agent sans que le client n'entende.
 * Réponses aux objections, infos produit, ton à adopter.
 * Fichier NOUVEAU — indépendant, zéro import modifié.
 */

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bot, Mic, MicOff, Lightbulb, TrendingUp,
  AlertCircle, ChevronRight, Sparkles, X,
  ThumbsUp, ThumbsDown, Minimize2, Maximize2,
  MessageSquare, BarChart3,
 } from 'lucide-react';

interface CopilotSuggestion {
  id: string;
  type: "objection" | "opportunity" | "info" | "tone";
  text: string;
  confidence: number;
  usedAt?: number;
}

interface ShadowCopilotProps {
  isCallActive?: boolean;
  transcription?: string;
  prospectName?: string;
  className?: string;
  onClose?: () => void;
}

const _OBJECTION_RESPONSES: Record<string, string> = {
  "prix":     "Comprenez l'investissement — proposez un retour sur ROI chiffré et une offre d'essai 30 jours.",
  "temps":    "Rassurez : l'onboarding prend 2h, l'équipe est formée en 1 semaine. Proposez un pilote limité.",
  "concurrent": "Différenciez sur la qualité IA MENA et le support local. Demandez : 'Qu'est-ce qui vous manque chez eux ?'",
  "budget":   "Fractionnez le coût mensuel. Montrez l'économie réalisée vs situation actuelle.",
  "decider":  "Proposez une présentation courte pour les décideurs. Offrez un dossier PDF personnalisé.",
};

const MOCK_SUGGESTIONS: CopilotSuggestion[] = [
  { id: "1", type: "objection",    text: "Objection prix détectée — Montrez le ROI : 3 agents remplacés = +180€/mois d'économie",      confidence: 0.91 },
  { id: "2", type: "opportunity",  text: "Signal d'achat détecté — Le prospect a demandé 'combien ça coûte exactement'. Proposez une démo immédiate.", confidence: 0.84 },
  { id: "3", type: "info",         text: "Ce prospect a eu 2 appels précédents. Dernière note : 'Intéressé par le module WhatsApp'.",    confidence: 0.99 },
  { id: "4", type: "tone",         text: "Ton détecté : client pressé. Allez droit au but, évitez les longues présentations.",           confidence: 0.76 },
];

const TYPE_CONFIG = {
  objection:   { label: "Objection",   color: "text-red-500",    bg: "bg-red-500/10",    Icon: AlertCircle },
  opportunity: { label: "Opportunité", color: "text-green-600",  bg: "bg-green-500/10",  Icon: TrendingUp },
  info:        { label: "Contexte",    color: "text-blue-600",   bg: "bg-blue-500/10",   Icon: MessageSquare },
  tone:        { label: "Ton",         color: "text-purple-600", bg: "bg-purple-500/10", Icon: BarChart3 },
} as const;

export function ShadowCopilot({
  isCallActive = false,
  prospectName = "Client",
  className,
  onClose,
}: ShadowCopilotProps) {
  const [suggestions, setSuggestions] = useState<CopilotSuggestion[]>([]);
  const [isListening, setIsListening] = useState(isCallActive);
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  // Simule l'arrivée progressive de suggestions
  useEffect(() => {
    if (!isListening) { setSuggestions([]); return; }
    MOCK_SUGGESTIONS.forEach((s, i) => {
      timerRef.current = setTimeout(() => {
        setSuggestions(prev => prev.find((p: any) => p.id === s.id) ? prev : [...prev, s]);
      }, (i + 1) * 2200);
    });
    return () => clearTimeout(timerRef.current);
  }, [isListening]);

  const activeSuggestion = suggestions[activeIdx];

  const handleUsed = (id: string) => {
    setSuggestions(prev => prev.map(s => s.id === id ? { ...s, usedAt: Date.now() } : s));
  };

  const handleDismiss = (id: string) => {
    setSuggestions(prev => prev.filter(s => s.id !== id));
    setActiveIdx(0);
  };

  return (
    <div className={cn(
      "rounded-2xl border bg-card shadow-lg transition-all duration-300 overflow-hidden",
      isMinimized ? "w-48" : "w-full max-w-sm",
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b bg-primary/5">
        <div className="flex items-center gap-2">
          <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", isListening ? "bg-green-500/20" : "bg-muted")}>
            <Bot className={cn("w-4 h-4", isListening ? "text-green-600" : "text-muted-foreground")} />
          </div>
          <div>
            <p className="text-xs font-bold leading-none">Shadow Copilot</p>
            {!isMinimized && (
              <p className={cn("text-[10px] mt-0.5", isListening ? "text-green-600" : "text-muted-foreground")}>
                {isListening ? `Écoute active — ${prospectName}` : "En attente d'appel"}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {isListening && !isMinimized && (
            <div className="flex gap-0.5 items-end h-4 mr-1">
              {[3, 5, 4, 6, 3].map((h, i) => (
                <div key={i} className="w-0.5 bg-green-500 rounded-full animate-pulse" style={{ height: h * 2, animationDelay: `${i * 0.1}s` }} />
              ))}
            </div>
          )}
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsMinimized(!isMinimized)}>
            {isMinimized ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
          </Button>
          {onClose && <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}><X className="w-3 h-3" /></Button>}
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Controls */}
          <div className="flex items-center gap-2 px-3 py-2 border-b">
            <Button size="sm" variant={isListening ? "default" : "outline"}
              className={cn("h-7 text-xs gap-1 flex-1", isListening && "bg-green-600 hover:bg-green-700")}
              onClick={() => setIsListening(!isListening)}>
              {isListening ? <><Mic className="w-3 h-3" />Actif</> : <><MicOff className="w-3 h-3" />Démarrer</>}
            </Button>
            <Badge variant="outline" className="text-xs h-7 px-2">
              {suggestions.length} suggestion{suggestions.length !== 1 ? "s" : ""}
            </Badge>
          </div>

          {/* Tabs mini */}
          {suggestions.length > 0 && (
            <div className="flex gap-1 px-3 py-2 overflow-x-auto">
              {suggestions.map((s, i) => {
                const cfg = TYPE_CONFIG[s.type];
                return (
                  <button key={s.id} onClick={() => setActiveIdx(i)}
                    className={cn(
                      "flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition-all border",
                      activeIdx === i ? cn(cfg.bg, cfg.color, "border-current/20") : "text-muted-foreground border-transparent hover:bg-muted"
                    )}>
                    <cfg.Icon className="w-3 h-3" />
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Active suggestion */}
          <div className="p-3 min-h-[120px]">
            {!isListening && suggestions.length === 0 && (
              <div className="flex flex-col items-center justify-center h-24 text-muted-foreground gap-2">
                <Sparkles className="w-6 h-6 opacity-30" />
                <p className="text-xs text-center">Activez l'écoute pour recevoir des suggestions en temps réel</p>
              </div>
            )}
            {isListening && suggestions.length === 0 && (
              <div className="flex flex-col items-center justify-center h-24 text-muted-foreground gap-2">
                <div className="flex gap-1">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: `${i * 0.2}s` }} />
                  ))}
                </div>
                <p className="text-xs">Analyse en cours…</p>
              </div>
            )}
            {activeSuggestion && (
              <div className={cn("rounded-xl p-3 border", TYPE_CONFIG[activeSuggestion.type].bg)}>
                <div className="flex items-start gap-2">
                  <Lightbulb className={cn("w-4 h-4 flex-shrink-0 mt-0.5", TYPE_CONFIG[activeSuggestion.type].color)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-relaxed">{activeSuggestion.text}</p>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1">
                        <div className="w-16 h-1.5 bg-muted/50 rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${activeSuggestion.confidence * 100}%` }} />
                        </div>
                        <span className="text-[10px] text-muted-foreground">{Math.round(activeSuggestion.confidence * 100)}%</span>
                      </div>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleUsed(activeSuggestion.id)}>
                          <ThumbsUp className="w-3 h-3 text-green-500" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleDismiss(activeSuggestion.id)}>
                          <ThumbsDown className="w-3 h-3 text-muted-foreground" />
                        </Button>
                        {suggestions.length > 1 && (
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setActiveIdx((activeIdx + 1) % suggestions.length)}>
                            <ChevronRight className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
