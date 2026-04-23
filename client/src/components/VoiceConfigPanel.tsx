/**
 * VoiceConfigPanel — Panneau de configuration vocale avancée pour un rôle IA
 * Inclut : sélecteur de voix, paramètres audio (vitesse, pitch, langue),
 *          messages personnalisés, test de voix en direct.
 */
import { useState, useRef } from "react";
import { Volume2, Play, Square, Loader2, Mic, MessageSquare, Settings2, Languages, Gauge } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface VoiceConfig {
  ttsVoice: string;
  ttsSpeed: number;
  ttsPitch: number;
  ttsLanguage: string;
  greetingMessage: string;
  farewellMessage: string;
  holdMessage: string;
  transferMessage: string;
}

interface VoiceConfigPanelProps {
  value: VoiceConfig;
  onChange: (config: VoiceConfig) => void;
}

// ─── Données statiques ───────────────────────────────────────────────────────

const VOICE_PROFILES = [
  {
    id: "alloy",
    name: "Alloy",
    gender: "Neutre",
    tone: "Équilibré",
    best: "Usage général",
    color: "from-slate-400 to-slate-600",
    ring: "ring-slate-400",
    badge: "bg-slate-100 text-slate-700",
    waveColor: "#64748b",
  },
  {
    id: "echo",
    name: "Echo",
    gender: "Masculin",
    tone: "Grave & posé",
    best: "Support technique",
    color: "from-blue-400 to-blue-700",
    ring: "ring-blue-400",
    badge: "bg-blue-100 text-blue-700",
    waveColor: "#3b82f6",
  },
  {
    id: "fable",
    name: "Fable",
    gender: "Masculin",
    tone: "Expressif",
    best: "Narration, vente",
    color: "from-violet-400 to-violet-700",
    ring: "ring-violet-400",
    badge: "bg-violet-100 text-violet-700",
    waveColor: "#7c3aed",
  },
  {
    id: "onyx",
    name: "Onyx",
    gender: "Masculin",
    tone: "Profond & fort",
    best: "Autorité, B2B",
    color: "from-gray-600 to-gray-900",
    ring: "ring-gray-500",
    badge: "bg-gray-100 text-gray-700",
    waveColor: "#374151",
  },
  {
    id: "nova",
    name: "Nova",
    gender: "Féminin",
    tone: "Chaleureux",
    best: "Service client",
    color: "from-rose-400 to-rose-600",
    ring: "ring-rose-400",
    badge: "bg-rose-100 text-rose-700",
    waveColor: "#f43f5e",
  },
  {
    id: "shimmer",
    name: "Shimmer",
    gender: "Féminin",
    tone: "Doux & rassurant",
    best: "Santé, bien-être",
    color: "from-amber-300 to-orange-500",
    ring: "ring-amber-400",
    badge: "bg-amber-100 text-amber-700",
    waveColor: "#f59e0b",
  },
];

const LANGUAGES = [
  { code: "fr", label: "Français 🇫🇷" },
  { code: "en", label: "English 🇬🇧" },
  { code: "es", label: "Español 🇪🇸" },
  { code: "de", label: "Deutsch 🇩🇪" },
  { code: "ar", label: "العربية 🇸🇦" },
];

const MESSAGE_FIELDS: { key: keyof VoiceConfig; label: string; icon: string; placeholder: string }[] = [
  {
    key: "greetingMessage",
    label: "Message d'accueil",
    icon: "👋",
    placeholder: "Bonjour, je suis votre assistant. Comment puis-je vous aider ?",
  },
  {
    key: "farewellMessage",
    label: "Message de clôture",
    icon: "🎯",
    placeholder: "Merci pour votre appel. Bonne journée !",
  },
  {
    key: "holdMessage",
    label: "Message d'attente",
    icon: "⏳",
    placeholder: "Veuillez patienter, je recherche l'information pour vous.",
  },
  {
    key: "transferMessage",
    label: "Message de transfert",
    icon: "🔄",
    placeholder: "Je vous transfère vers un conseiller. Restez en ligne.",
  },
];

// ─── Sous-composant : WaveformBars ────────────────────────────────────────────

function WaveformBars({ color, playing }: { color: string; playing: boolean }) {
  const bars = [3, 6, 9, 7, 4, 8, 5, 10, 6, 3, 7, 9, 4, 6, 8];
  return (
    <div className="flex items-center gap-[2px] h-6">
      {bars.map((h, i) => (
        <div
          key={i}
          className="w-[3px] rounded-full transition-all"
          style={{
            height: playing ? `${h * 2}px` : "4px",
            backgroundColor: color,
            opacity: playing ? 0.85 : 0.3,
            animation: playing ? `pulse ${0.4 + i * 0.05}s ease-in-out infinite alternate` : "none",
            animationDelay: `${i * 40}ms`,
          }}
        />
      ))}
      <style>{`
        @keyframes pulse {
          from { transform: scaleY(0.3); }
          to   { transform: scaleY(1.0); }
        }
      `}</style>
    </div>
  );
}

// ─── Sous-composant : SpeedLabel ──────────────────────────────────────────────

function SpeedLabel({ speed }: { speed: number }) {
  if (speed < 0.7) return <span className="text-blue-600 font-semibold">Très lent</span>;
  if (speed < 0.9) return <span className="text-cyan-600 font-semibold">Lent</span>;
  if (speed <= 1.1) return <span className="text-green-600 font-semibold">Normal ✓</span>;
  if (speed <= 1.4) return <span className="text-amber-600 font-semibold">Rapide</span>;
  return <span className="text-red-600 font-semibold">Très rapide</span>;
}

// ─── Composant principal ──────────────────────────────────────────────────────

export function VoiceConfigPanel({ value, onChange }: VoiceConfigPanelProps) {
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [testText, setTestText] = useState("");
  const [isTestLoading, setIsTestLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const profile = VOICE_PROFILES.find(v => v.id === value.ttsVoice) ?? VOICE_PROFILES[0];

  const set = (partial: Partial<VoiceConfig>) => onChange({ ...value, ...partial });

  // ── Prévisualisation d'une voix ───────────────────────────────────────────
  const previewVoice = async (voiceId: string) => {
    if (playingVoice) {
      audioRef.current?.pause();
      setPlayingVoice(null);
      return;
    }
    setPlayingVoice(voiceId);
    const vp = VOICE_PROFILES.find(v => v.id === voiceId);
    const sampleText =
      value.greetingMessage ||
      `Bonjour, je suis ${vp?.name ?? voiceId}. Je suis votre assistant Servicall.`;

    try {
      const resp = await fetch("/api/tts-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voice: voiceId,
          text: sampleText.slice(0, 200),
          speed: value.ttsSpeed,
        }),
      });
      if (!resp.ok) throw new Error("Indisponible");
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { URL.revokeObjectURL(url); setPlayingVoice(null); };
      audio.onerror = () => { setPlayingVoice(null); };
      await audio.play();
    } catch {
      toast.error("Prévisualisation indisponible — vérifiez la clé OpenAI BYOK");
      setPlayingVoice(null);
    }
  };

  // ── Test personnalisé ──────────────────────────────────────────────────────
  const runCustomTest = async () => {
    const text = testText.trim() || value.greetingMessage;
    if (!text) { toast.error("Entrez un texte de test"); return; }
    if (isTestLoading) { audioRef.current?.pause(); setIsTestLoading(false); return; }
    setIsTestLoading(true);
    try {
      const resp = await fetch("/api/tts-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voice: value.ttsVoice, text: text.slice(0, 300), speed: value.ttsSpeed }),
      });
      if (!resp.ok) throw new Error();
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { URL.revokeObjectURL(url); setIsTestLoading(false); };
      audio.onerror = () => setIsTestLoading(false);
      await audio.play();
    } catch {
      toast.error("Test indisponible — vérifiez la clé OpenAI BYOK");
      setIsTestLoading(false);
    }
  };

  return (
    <div className="space-y-1">
      <Tabs defaultValue="voice" className="w-full">
        <TabsList className="grid grid-cols-3 mb-4">
          <TabsTrigger value="voice" className="gap-1.5 text-xs">
            <Volume2 className="w-3.5 h-3.5" /> Voix
          </TabsTrigger>
          <TabsTrigger value="audio" className="gap-1.5 text-xs">
            <Settings2 className="w-3.5 h-3.5" /> Audio
          </TabsTrigger>
          <TabsTrigger value="messages" className="gap-1.5 text-xs">
            <MessageSquare className="w-3.5 h-3.5" /> Messages
          </TabsTrigger>
        </TabsList>

        {/* ── Onglet Voix ─────────────────────────────────────────────────── */}
        <TabsContent value="voice" className="space-y-4 mt-0">
          <div className="grid grid-cols-2 gap-2.5">
            {VOICE_PROFILES.map(vp => {
              const isSelected = value.ttsVoice === vp.id;
              const isPlaying  = playingVoice === vp.id;
              return (
                <div
                  key={vp.id}
                  onClick={() => set({ ttsVoice: vp.id })}
                  className={`
                    relative rounded-xl border-2 p-3 cursor-pointer transition-all duration-200
                    ${isSelected
                      ? `border-primary bg-primary/5 shadow-sm ring-2 ${vp.ring} ring-offset-1`
                      : "border-border bg-card hover:border-primary/40 hover:bg-muted/40"}
                  `}
                >
                  {/* Gradient avatar */}
                  <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${vp.color} flex items-center justify-center mb-2`}>
                    <span className="text-white text-xs font-bold">{vp.name[0]}</span>
                  </div>

                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm leading-tight">{vp.name}</p>
                      <p className="text-[11px] text-muted-foreground">{vp.gender} · {vp.tone}</p>
                    </div>
                    {/* Bouton écoute */}
                    <button
                      onClick={e => { e.stopPropagation(); previewVoice(vp.id); }}
                      disabled={!!playingVoice && playingVoice !== vp.id}
                      className={`
                        ml-1 p-1.5 rounded-full transition-all
                        ${isPlaying
                          ? "bg-primary text-white shadow"
                          : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"}
                        disabled:opacity-30
                      `}
                      title={isPlaying ? "Arrêter" : "Écouter"}
                    >
                      {isPlaying
                        ? <Square className="w-3 h-3" />
                        : <Play className="w-3 h-3" />}
                    </button>
                  </div>

                  {/* Waveform animée */}
                  <div className="mt-2">
                    <WaveformBars color={vp.waveColor} playing={isPlaying} />
                  </div>

                  {/* Badge usage */}
                  <div className="mt-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${vp.badge}`}>
                      {vp.best}
                    </span>
                  </div>

                  {/* Indicateur sélectionné */}
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Test personnalisé */}
          <div className="rounded-xl border bg-muted/30 p-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Mic className="w-3.5 h-3.5" /> Test avec voix sélectionnée
              <Badge variant="outline" className="text-[10px] py-0 ml-auto">{profile.name}</Badge>
            </p>
            <Textarea
              value={testText}
              onChange={e => setTestText(e.target.value)}
              placeholder={value.greetingMessage || "Entrez un texte ou laissez vide pour tester le message d'accueil..."}
              rows={2}
              className="text-sm resize-none bg-white"
            />
            <Button
              size="sm"
              variant={isTestLoading ? "destructive" : "default"}
              onClick={runCustomTest}
              className="w-full gap-2"
            >
              {isTestLoading
                ? <><Square className="w-3.5 h-3.5" /> Arrêter</>
                : <><Play className="w-3.5 h-3.5" /> Tester la voix</>}
            </Button>
          </div>
        </TabsContent>

        {/* ── Onglet Audio ─────────────────────────────────────────────────── */}
        <TabsContent value="audio" className="space-y-5 mt-0">

          {/* Vitesse */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <Gauge className="w-4 h-4 text-muted-foreground" />
                Vitesse de parole
              </label>
              <div className="flex items-center gap-2">
                <SpeedLabel speed={value.ttsSpeed} />
                <span className="text-xs text-muted-foreground font-mono w-8 text-right">
                  ×{value.ttsSpeed.toFixed(2)}
                </span>
              </div>
            </div>
            <Slider
              value={[value.ttsSpeed]}
              min={0.25}
              max={4.0}
              step={0.05}
              onValueChange={([v]) => set({ ttsSpeed: v })}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground px-1">
              <span>0.25× Très lent</span>
              <span className="text-green-600 font-medium">1.0× Normal</span>
              <span>4.0× Très rapide</span>
            </div>
          </div>

          {/* Pitch */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-muted-foreground" />
                Hauteur tonale (Pitch)
              </label>
              <span className="text-xs text-muted-foreground font-mono">
                {value.ttsPitch.toFixed(2)}×
                {value.ttsPitch < 0.85 ? " 🔈 grave" : value.ttsPitch > 1.15 ? " 🔉 aigu" : " ✓ neutre"}
              </span>
            </div>
            <Slider
              value={[value.ttsPitch]}
              min={0.5}
              max={2.0}
              step={0.05}
              onValueChange={([v]) => set({ ttsPitch: v })}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground px-1">
              <span>0.5× Grave</span>
              <span className="text-green-600 font-medium">1.0× Neutre</span>
              <span>2.0× Aigu</span>
            </div>
            <p className="text-[11px] text-amber-600 bg-amber-50 px-2.5 py-1.5 rounded-lg">
              ⚠ Le pitch est appliqué via traitement audio côté serveur (roadmap).
              OpenAI TTS ne supporte pas encore ce paramètre nativement.
            </p>
          </div>

          {/* Langue */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-1.5">
              <Languages className="w-4 h-4 text-muted-foreground" />
              Langue de l'agent
            </label>
            <div className="grid grid-cols-3 gap-2">
              {LANGUAGES.map(lang => (
                <button
                  key={lang.code}
                  onClick={() => set({ ttsLanguage: lang.code })}
                  className={`
                    px-2 py-2 rounded-lg border text-sm font-medium transition-all
                    ${value.ttsLanguage === lang.code
                      ? "border-primary bg-primary/5 text-primary ring-1 ring-primary"
                      : "border-border hover:border-primary/40 hover:bg-muted/40"}
                  `}
                >
                  {lang.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Utilisé pour la détection automatique de la langue du prospect et le choix du prompt système.
            </p>
          </div>

          {/* Résumé config */}
          <div className="rounded-xl bg-muted/40 border p-3 space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground">Résumé configuration</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {[
                ["Voix", profile.name + " (" + profile.gender + ")"],
                ["Vitesse", `×${value.ttsSpeed.toFixed(2)}`],
                ["Pitch", `×${value.ttsPitch.toFixed(2)}`],
                ["Langue", LANGUAGES.find(l => l.code === value.ttsLanguage)?.label ?? value.ttsLanguage],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-medium">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* ── Onglet Messages ───────────────────────────────────────────────── */}
        <TabsContent value="messages" className="space-y-4 mt-0">
          {MESSAGE_FIELDS.map(field => (
            <div key={field.key} className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <span>{field.icon}</span>
                {field.label}
              </label>
              <div className="relative">
                <Textarea
                  value={(value[field.key] as string) ?? ""}
                  onChange={e => set({ [field.key]: e.target.value })}
                  placeholder={field.placeholder}
                  rows={2}
                  className="text-sm resize-none pr-10"
                />
                {/* Bouton écoute inline */}
                <button
                  onClick={() => {
                    const text = (value[field.key] as string)?.trim() || field.placeholder;
                    fetch("/api/tts-preview", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ voice: value.ttsVoice, text: text.slice(0, 200), speed: value.ttsSpeed }),
                    })
                      .then(r => r.ok ? r.blob() : Promise.reject())
                      .then(blob => {
                        const url = URL.createObjectURL(blob);
                        new Audio(url).play().then(() => {}).catch(() => {});
                      })
                      .catch(() => toast.error("Prévisualisation indisponible"));
                  }}
                  className="absolute right-2 top-2 p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                  title="Écouter ce message"
                >
                  <Play className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground px-0.5">
                {(value[field.key] as string)?.length ?? 0} / 300 caractères
              </p>
            </div>
          ))}
          <p className="text-[11px] text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
            💡 Ces messages seront prononcés par l'agent IA avec la voix et les paramètres audio configurés ci-dessus.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Export par défaut ────────────────────────────────────────────────────────
export default VoiceConfigPanel;
