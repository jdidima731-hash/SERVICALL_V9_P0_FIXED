/**
 * CHURN SCORE WIDGET — Score de risque de départ client
 * Basé sur : sentiment moyen, fréquence contact, objections répétées
 * Composant NOUVEAU — s'intègre dans ProspectDetail360 ou Dashboard.
 * Zéro modification d'un fichier existant nécessaire.
 */

import { useMemo } from "react";
import { TrendingDown, TrendingUp, Minus, AlertTriangle, ShieldCheck, Flame  } from 'lucide-react';
import { cn } from "@/lib/utils";

export interface ChurnSignal {
  label: string;
  impact: "positive" | "negative" | "neutral";
  value: string;
}

export interface ChurnScoreProps {
  prospectName?: string;
  sentimentHistory?: ("positive" | "neutral" | "negative")[];
  daysSinceLastContact?: number;
  objectionCount?: number;
  callCount?: number;
  className?: string;
}

function computeChurnScore({
  sentimentHistory = [],
  daysSinceLastContact = 0,
  objectionCount = 0,
  callCount = 0,
}: Omit<ChurnScoreProps, "prospectName" | "className">): {
  score: number;
  level: "low" | "medium" | "high" | "critical";
  signals: ChurnSignal[];
} {
  let score = 50; // base neutre
  const signals: ChurnSignal[] = [];

  // Sentiment
  if (sentimentHistory.length > 0) {
    const negPct = sentimentHistory.filter(s => s === "negative").length / sentimentHistory.length;
    const posPct = sentimentHistory.filter(s => s === "positive").length / sentimentHistory.length;
    score += negPct * 30 - posPct * 20;
    if (negPct > 0.5) signals.push({ label: "Sentiment négatif dominant", impact: "negative", value: `${Math.round(negPct * 100)}%` });
    else if (posPct > 0.6) signals.push({ label: "Sentiment positif", impact: "positive", value: `${Math.round(posPct * 100)}%` });
    else signals.push({ label: "Sentiment neutre", impact: "neutral", value: `${Math.round(posPct * 100)}% pos.` });
  }

  // Silence (jours sans contact)
  if (daysSinceLastContact > 30) { score += 25; signals.push({ label: "Silence prolongé", impact: "negative", value: `${daysSinceLastContact}j` }); }
  else if (daysSinceLastContact > 14) { score += 12; signals.push({ label: "Contact espacé", impact: "negative", value: `${daysSinceLastContact}j` }); }
  else { signals.push({ label: "Contact récent", impact: "positive", value: `${daysSinceLastContact}j` }); }

  // Objections
  if (objectionCount >= 4) { score += 20; signals.push({ label: "Nombreuses objections", impact: "negative", value: `×${objectionCount}` }); }
  else if (objectionCount >= 2) { score += 8; signals.push({ label: "Quelques objections", impact: "neutral", value: `×${objectionCount}` }); }

  // Engagement (appels)
  if (callCount >= 5) { score -= 15; signals.push({ label: "Fort engagement", impact: "positive", value: `${callCount} appels` }); }
  else if (callCount <= 1 && daysSinceLastContact > 7) { score += 10; signals.push({ label: "Faible engagement", impact: "negative", value: `${callCount} appels` }); }

  const finalScore = Math.max(0, Math.min(100, Math.round(score)));
  const level = finalScore >= 75 ? "critical" : finalScore >= 55 ? "high" : finalScore >= 35 ? "medium" : "low";

  return { score: finalScore, level, signals };
}

const LEVEL_CONFIG = {
  low:      { label: "Fidèle",        color: "text-green-600",  bg: "bg-green-500/10",  border: "border-green-200",  Icon: ShieldCheck, ring: "#22c55e" },
  medium:   { label: "À surveiller",  color: "text-yellow-600", bg: "bg-yellow-500/10", border: "border-yellow-200", Icon: Minus,       ring: "#eab308" },
  high:     { label: "À risque",      color: "text-orange-600", bg: "bg-orange-500/10", border: "border-orange-200", Icon: TrendingDown, ring: "#f97316" },
  critical: { label: "Danger départ", color: "text-red-600",    bg: "bg-red-500/10",    border: "border-red-200",    Icon: Flame,       ring: "#ef4444" },
} as const;

export function ChurnScoreWidget({
  prospectName,
  sentimentHistory = ["positive", "neutral", "negative", "negative"],
  daysSinceLastContact = 18,
  objectionCount = 3,
  callCount = 2,
  className,
}: ChurnScoreProps) {
  const { score, level, signals } = useMemo(
    () => computeChurnScore({ sentimentHistory, daysSinceLastContact, objectionCount, callCount }),
    [sentimentHistory, daysSinceLastContact, objectionCount, callCount]
  );

  const cfg = LEVEL_CONFIG[level];
  const Icon = cfg.Icon;

  // Arc SVG
  const r = 38;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;

  return (
    <div className={cn("rounded-2xl border p-4 bg-card", cfg.border, className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Risque de départ</p>
          {prospectName && <p className="text-sm font-semibold truncate">{prospectName}</p>}
        </div>
        <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border", cfg.bg, cfg.border, cfg.color)}>
          <Icon className="w-3.5 h-3.5" />
          {cfg.label}
        </div>
      </div>

      <div className="flex items-center gap-5 mt-4">
        {/* Gauge arc */}
        <div className="relative w-[88px] h-[88px] flex-shrink-0">
          <svg viewBox="0 0 88 88" className="w-full h-full -rotate-90">
            <circle cx="44" cy="44" r={r} fill="none" stroke="currentColor" className="text-muted/30" strokeWidth="8" />
            <circle
              cx="44" cy="44" r={r} fill="none"
              stroke={cfg.ring} strokeWidth="8"
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeLinecap="round"
              style={{ transition: "stroke-dasharray 0.6s ease" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-black leading-none">{score}</span>
            <span className="text-[10px] text-muted-foreground font-medium">/100</span>
          </div>
        </div>

        {/* Signals */}
        <div className="flex-1 space-y-1.5">
          {signals.slice(0, 3).map((sig, i) => (
            <div key={i} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                {sig.impact === "negative" ? <TrendingDown className="w-3 h-3 text-red-400 flex-shrink-0" /> :
                 sig.impact === "positive" ? <TrendingUp className="w-3 h-3 text-green-500 flex-shrink-0" /> :
                 <Minus className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
                <span className="text-xs text-muted-foreground truncate">{sig.label}</span>
              </div>
              <span className={cn("text-xs font-bold flex-shrink-0",
                sig.impact === "negative" ? "text-red-500" :
                sig.impact === "positive" ? "text-green-600" : "text-muted-foreground"
              )}>{sig.value}</span>
            </div>
          ))}
        </div>
      </div>

      {level === "critical" || level === "high" ? (
        <div className={cn("mt-3 rounded-xl px-3 py-2 text-xs font-medium flex items-center gap-2", cfg.bg, cfg.color)}>
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          {level === "critical"
            ? "Action urgente recommandée — Contactez ce client aujourd'hui"
            : "Planifiez un appel de suivi dans les 48h"}
        </div>
      ) : null}
    </div>
  );
}
