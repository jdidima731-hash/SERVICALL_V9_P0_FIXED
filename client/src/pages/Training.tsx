/**
 * FORMATION IA — Module complet Servicall V3
 * ──────────────────────────────────────────
 * Fonctionnalités IA réelles :
 *  1. Génération de parcours de formation personnalisé selon rôle + niveau
 *  2. Quiz adaptatif généré par l'IA (questions + correction détaillée)
 *  3. Coach IA en direct — pose des questions, l'IA évalue et corrige
 *  4. Simulation d'appel client — l'IA joue le client difficile
 *  5. Tableau de bord de progression avec badges
 */

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";
import { GraduationCap, BookOpen, Brain, MessageSquare, Trophy,
  ChevronRight, Loader2, Send, Bot, User, Sparkles,
  CheckCircle2, XCircle, BarChart3, Play, RotateCcw,
  Star, Zap, Target, Clock, Award, TrendingUp, Phone
 } from 'lucide-react';
import { toast } from "sonner";

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────
interface Module {
  id: string;
  title: string;
  description: string;
  duration: string;
  level: "débutant" | "intermédiaire" | "avancé";
  topics: string[];
  completed: boolean;
  score?: number;
}

interface QuizQuestion {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
}

interface QuizState {
  questions: QuizQuestion[];
  current: number;
  answers: number[];
  finished: boolean;
  loading: boolean;
}

interface CoachMessage {
  role: "assistant" | "user";
  content: string;
  feedback?: { score: number; tip: string };
}

type Tab = "dashboard" | "path" | "quiz" | "coach" | "simulation";

const ROLES = ["Agent Commercial", "Responsable CRM", "Chargé de Relation Client", "Superviseur Call Center", "Manager Commercial"];
const LEVELS = ["Débutant", "Intermédiaire", "Avancé"];

// ─────────────────────────────────────────
// Claude API
// ─────────────────────────────────────────
/**
 * Appelle l'IA via le serveur (proxy sécurisé — utilise la clé OpenAI du projet).
 * Aucune clé API n'est exposée côté navigateur.
 */
async function callAI(messages: { role: string; content: string }[], system: string): Promise<string> {
  try {
    const userMessages = messages.map(m => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // Injecter le prompt système dans le premier message
    const augmentedFirst = userMessages[0]
      ? { ...userMessages[0], content: `${system}\n\n${userMessages[0].content}` }
      : { role: "user" as const, content: system };

    const allMessages = [augmentedFirst, ...userMessages.slice(1)];

    const res = await fetch("/api/trpc/ai.chat", {
      method: "POST",
      credentials: "include",
      
      headers: {
        "Content-Type": "application/json",
        
        "x-csrf-token": String((window as unknown as Record<string, unknown>)["__CSRF_TOKEN__"] ?? ""),
      },
      body: JSON.stringify({
        json: {
          message: allMessages[0]?.content ?? "",
          context: {
            conversationHistory: allMessages.slice(1),
          },
          temperature: 0.7,
          maxTokens: 1000,
        },
      }),
    });

    if (!res.ok) throw new Error(`AI request failed: ${res.status}`);
    const data = await res.json();
    // Format de réponse tRPC batch : [{result: {data: {json: {success, response}}}}]
    const payload = Array.isArray(data) ? data[0]?.result?.data?.json : data?.result?.data?.json;
    return payload?.response || payload?.message || "Réponse IA indisponible";
  } catch (err: any) {
    console.error("[Training] callAI error:", err);
    return "Une erreur est survenue. Vérifiez que la clé OpenAI est configurée dans les paramètres.";
  }
}

// ─────────────────────────────────────────
// Progress ring
// ─────────────────────────────────────────
function _ProgressRing({ value, size = 80 }: { value: number; size?: number }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ - (value / 100) * circ;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/40" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth="6"
        strokeDasharray={circ} strokeDashoffset={dash} strokeLinecap="round"
        className="text-primary transition-all duration-700" />
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central" fontSize="14" fontWeight="700"
        className="rotate-90 fill-foreground" transform={`rotate(90, ${size / 2}, ${size / 2})`}>
        {value}%
      </text>
    </svg>
  );
}

// ─────────────────────────────────────────
// Main
// ─────────────────────────────────────────
export default function Training() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [role, setRole] = useState(ROLES[0]);
  const [level, setLevel] = useState(LEVELS[0]);
  const [modules, setModules] = useState<Module[]>([]);
  const [isGeneratingPath, setIsGeneratingPath] = useState(false);
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);

  // Quiz
  const [quiz, setQuiz] = useState<QuizState>({ questions: [], current: 0, answers: [], finished: false, loading: false });
  const [quizTopic, setQuizTopic] = useState("");

  // Coach
  const [coachMessages, setCoachMessages] = useState<CoachMessage[]>([]);
  const [coachInput, setCoachInput] = useState("");
  const [isCoaching, setIsCoaching] = useState(false);
  const [coachTopic, setCoachTopic] = useState("");

  // Simulation
  const [simMessages, setSimMessages] = useState<CoachMessage[]>([]);
  const [simInput, setSimInput] = useState("");
  const [isSimulating, setIsSimulating] = useState(false);
  const [simScenario, setSimScenario] = useState("Client mécontent — facture en litige");
  const [simFeedback, setSimFeedback] = useState<{ score: number; strengths: string[]; improvements: string[] } | null>(null);

  // Progression
  const completedCount = modules.filter(m => m.completed).length;
  const avgScore = modules.filter(m => m.score).reduce((a, m) => a + (m.score || 0), 0) / (modules.filter(m => m.score).length || 1);
  const progress = modules.length ? Math.round((completedCount / modules.length) * 100) : 0;

  const chatEndRef = useRef<HTMLDivElement>(null);
  const simEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [coachMessages]);
  useEffect(() => { simEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [simMessages]);

  // ── GENERATE LEARNING PATH ────────────────
  const generatePath = async () => {
    setIsGeneratingPath(true);
    toast.info("Génération du parcours personnalisé…");
    try {
      const system = `Tu es un expert en formation professionnelle pour les équipes commerciales et CRM. Génère un parcours de formation adapté. Retourne UNIQUEMENT un JSON valide sans markdown :
[
  {
    "id": "m1",
    "title": "...",
    "description": "...",
    "duration": "X min",
    "level": "débutant"|"intermédiaire"|"avancé",
    "topics": ["sujet1", "sujet2", "sujet3"]
  }
]
Génère exactement 5 modules progressifs et pertinents pour le rôle et le niveau donnés.`;
      const raw = await callAI([
        { role: "user", content: `Rôle : ${role}\nNiveau actuel : ${level}\nGénère 5 modules de formation progressifs.` }
      ], system);
      const clean = raw.replace(/```json|```/g, "").trim();
      const parsed: Omit<Module, "completed" | "score">[] = JSON.parse(clean);
      setModules(parsed.map(m => ({ ...m, completed: false })));
      toast.success("Parcours généré ! 5 modules personnalisés.");
      setTab("path");
    } catch {
      toast.error("Erreur de génération. Réessayez.");
    } finally {
      setIsGeneratingPath(false);
    }
  };

  // ── GENERATE QUIZ ─────────────────────────
  const generateQuiz = async (topic: string) => {
    setQuiz(prev => ({ ...prev, loading: true, questions: [], current: 0, answers: [], finished: false }));
    toast.info(`Génération du quiz sur "${topic}"…`);
    try {
      const system = `Tu es un formateur expert. Génère un quiz de 5 questions à choix multiple sur le sujet donné. Retourne UNIQUEMENT un JSON valide sans markdown :
[
  {
    "question": "...",
    "options": ["option A", "option B", "option C", "option D"],
    "correct": 0,
    "explanation": "Explication courte de la bonne réponse."
  }
]`;
      const raw = await callAI([{ role: "user", content: `Sujet du quiz : ${topic}\nContexte : Formation ${role} niveau ${level}` }], system);
      const clean = raw.replace(/```json|```/g, "").trim();
      const questions: QuizQuestion[] = JSON.parse(clean);
      setQuiz({ questions, current: 0, answers: [], finished: false, loading: false });
      setTab("quiz");
    } catch {
      toast.error("Erreur de génération du quiz.");
      setQuiz(prev => ({ ...prev, loading: false }));
    }
  };

  const answerQuiz = (optionIndex: number) => {
    const newAnswers = [...quiz.answers, optionIndex];
    if (quiz.current + 1 >= quiz.questions.length) {
      setQuiz(prev => ({ ...prev, answers: newAnswers, finished: true }));
      const score = Math.round((newAnswers.filter((a, i) => a === quiz.questions[i].correct).length / quiz.questions.length) * 100);
      if (selectedModule) {
        setModules(prev => prev.map(m => m.id === selectedModule.id ? { ...m, completed: true, score } : m));
      }
      toast.success(`Quiz terminé ! Score : ${score}/100`);
    } else {
      setQuiz(prev => ({ ...prev, answers: newAnswers, current: prev.current + 1 }));
    }
  };

  // ── COACH MESSAGE ─────────────────────────
  const startCoach = async () => {
    if (!coachTopic.trim()) { toast.error("Entrez un sujet de formation"); return; }
    setIsCoaching(true);
    const system = `Tu es un coach expert en vente et relation client pour ${role} (niveau ${level}). 
Ton rôle : poser des questions pratiques sur le sujet donné, évaluer les réponses, donner un feedback constructif avec un score /10 et un conseil concret.
Format de réponse : pose UNE seule question à la fois. Après chaque réponse de l'apprenant, donne un feedback bref (2-3 phrases max), puis pose la question suivante.`;
    try {
      const opening = await callAI([
        { role: "user", content: `Je veux me former sur : ${coachTopic}. Je suis ${role}, niveau ${level}.` }
      ], system);
      setCoachMessages([{ role: "assistant", content: opening }]);
      setIsCoaching(false);
    } catch {
      toast.error("Erreur de connexion IA.");
      setIsCoaching(false);
    }
  };

  const sendCoachMessage = async () => {
    if (!coachInput.trim() || isCoaching) return;
    const userMsg: CoachMessage = { role: "user", content: coachInput };
    const newMsgs = [...coachMessages, userMsg];
    setCoachMessages(newMsgs);
    setCoachInput("");
    setIsCoaching(true);
    try {
      const system = `Tu es un coach expert en vente et relation client pour ${role} (niveau ${level}) sur le sujet : ${coachTopic}. 
Évalue la réponse de l'apprenant. Donne : un score /10 entre parenthèses, un feedback en 2 phrases, puis la question suivante ou une conclusion si tu as posé 5+ questions.
Format : "(Score: X/10) [feedback]. [Question suivante]"`;
      const reply = await callAI(newMsgs.map(m => ({ role: m.role, content: m.content })), system);
      setCoachMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch {
      toast.error("Erreur IA.");
    } finally {
      setIsCoaching(false);
    }
  };

  // ── SIMULATION D'APPEL ────────────────────
  const startSimulation = async () => {
    setIsSimulating(true);
    const system = `Tu joues le rôle d'un client dans ce scénario : "${simScenario}". 
Sois réaliste, légèrement difficile mais pas impossible. Réponds comme un vrai client au téléphone. Max 2-3 phrases par réponse.
L'apprenant joue le rôle de l'agent. Commence par te présenter et exposer ton problème.`;
    try {
      const opening = await callAI([{ role: "user", content: "Démarre la simulation" }], system);
      setSimMessages([{ role: "assistant", content: opening }]);
      setSimFeedback(null);
    } catch {
      toast.error("Erreur de démarrage.");
    } finally {
      setIsSimulating(false);
    }
  };

  const sendSimMessage = async () => {
    if (!simInput.trim() || isSimulating) return;
    const userMsg: CoachMessage = { role: "user", content: simInput };
    const newMsgs = [...simMessages, userMsg];
    setSimMessages(newMsgs);
    setSimInput("");
    setIsSimulating(true);
    try {
      const system = `Tu joues le rôle d'un client dans ce scénario : "${simScenario}". Sois réaliste. Max 2 phrases. Si l'agent gère bien, sois de plus en plus satisfait.`;
      const reply = await callAI(newMsgs.map(m => ({ role: m.role, content: m.content })), system);
      setSimMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch {
      toast.error("Erreur IA.");
    } finally {
      setIsSimulating(false);
    }
  };

  const endSimulation = async () => {
    if (simMessages.length < 4) { toast.error("Continuez la simulation un peu plus."); return; }
    setIsSimulating(true);
    toast.info("Analyse de votre performance…");
    try {
      const transcript = simMessages.map(m => `${m.role === "user" ? "Agent" : "Client"}: ${m.content}`).join("\n");
      const system = `Tu es un superviseur expert en relation client. Analyse la performance de l'agent dans cette simulation. Retourne UNIQUEMENT un JSON valide :
{"score": 0-100, "strengths": ["point fort 1", "point fort 2"], "improvements": ["axe d'amélioration 1", "axe d'amélioration 2"]}`;
      const raw = await callAI([{ role: "user", content: `Scénario: ${simScenario}\n\nTranscript:\n${transcript}` }], system);
      const clean = raw.replace(/```json|```/g, "").trim();
      const fb = JSON.parse(clean);
      setSimFeedback(fb);
      toast.success(`Simulation terminée ! Score : ${fb.score}/100`);
    } catch {
      toast.error("Erreur d'analyse.");
    } finally {
      setIsSimulating(false);
    }
  };

  const tabs = [
    { id: "dashboard" as Tab, label: "📊 Tableau de bord", icon: BarChart3 },
    { id: "path" as Tab, label: "🗺️ Mon parcours", icon: BookOpen },
    { id: "quiz" as Tab, label: "🧠 Quiz IA", icon: Brain },
    { id: "coach" as Tab, label: "🎯 Coach IA", icon: Target },
    { id: "simulation" as Tab, label: "📞 Simulation appel", icon: Phone },
  ];

  const quizScore = quiz.finished
    ? Math.round((quiz.answers.filter((a, i) => a === quiz.questions[i].correct).length / quiz.questions.length) * 100)
    : 0;

  // ══════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════
  return (
    <div className="space-y-4 md:space-y-6" data-main-content>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
            <GraduationCap className="h-8 w-8 text-primary" />
            Formation IA
          </h1>
          <p className="text-muted-foreground mt-1">Parcours adaptatifs · Quiz IA · Coach en direct · Simulation d'appel</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded-lg">
            <span className="text-sm text-muted-foreground">Rôle :</span>
            <select value={role} onChange={e => setRole(e.target.value)} className="text-sm font-bold bg-transparent border-none outline-none">
              {ROLES.map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div className="hidden sm:flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded-lg">
            <span className="text-sm text-muted-foreground">Niveau :</span>
            <select value={level} onChange={e => setLevel(e.target.value)} className="text-sm font-bold bg-transparent border-none outline-none">
              {LEVELS.map(l => <option key={l}>{l}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 bg-muted/50 p-1 rounded-xl w-fit">
        {tabs.map((t: any) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 rounded-lg text-sm font-bold transition-all ${tab === t.id ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── DASHBOARD ── */}
      {tab === "dashboard" && (
        <div className="space-y-6">
          {/* Stats row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Modules complétés", value: `${completedCount}/${modules.length || "—"}`, icon: CheckCircle2, color: "text-green-600 bg-green-500/10" },
              { label: "Score moyen", value: modules.filter(m => m.score).length ? `${Math.round(avgScore)}/100` : "—", icon: Star, color: "text-yellow-600 bg-yellow-500/10" },
              { label: "Sessions coach", value: coachMessages.filter(m => m.role === "user").length, icon: MessageSquare, color: "text-blue-600 bg-blue-500/10" },
              { label: "Simulations", value: simFeedback ? 1 : 0, icon: Phone, color: "text-purple-600 bg-purple-500/10" },
            ].map((s, i) => (
              <Card key={i} className="border-none shadow-md">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
                      <h3 className="text-2xl font-black mt-1">{s.value}</h3>
                    </div>
                    <div className={`p-2.5 rounded-xl ${s.color}`}><s.icon className="w-5 h-5" /></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Generate path CTA */}
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
            <CardContent className="pt-6 pb-6">
              <div className="flex flex-col lg:flex-row items-center gap-6">
                <div className="flex-1 space-y-2">
                  <h2 className="text-xl font-black flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Générer mon parcours personnalisé
                  </h2>
                  <p className="text-muted-foreground">
                    L'IA analyse votre rôle <strong>{role}</strong> et votre niveau <strong>{level}</strong> pour créer 5 modules sur mesure.
                  </p>
                  <div className="flex gap-3 flex-wrap">
                    <select value={role} onChange={e => setRole(e.target.value)} className="text-sm font-medium bg-background border rounded-lg px-3 py-1.5 outline-none">
                      {ROLES.map(r => <option key={r}>{r}</option>)}
                    </select>
                    <select value={level} onChange={e => setLevel(e.target.value)} className="text-sm font-medium bg-background border rounded-lg px-3 py-1.5 outline-none">
                      {LEVELS.map(l => <option key={l}>{l}</option>)}
                    </select>
                  </div>
                </div>
                <Button onClick={generatePath} disabled={isGeneratingPath} size="lg" className="gap-2 rounded-full shadow-lg shadow-primary/20 flex-shrink-0">
                  {isGeneratingPath ? <><Loader2 className="h-4 w-4 animate-spin" />Génération…</> : <><Sparkles className="h-4 w-4" />Générer le parcours</>}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Quick actions */}
          <div className="grid sm:grid-cols-3 gap-4">
            <Card className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => setTab("quiz")}>
              <CardContent className="pt-5 pb-5 flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Brain className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="font-bold">Quiz IA</p>
                  <p className="text-sm text-muted-foreground">Testez vos connaissances</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => setTab("coach")}>
              <CardContent className="pt-5 pb-5 flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Target className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="font-bold">Coach IA</p>
                  <p className="text-sm text-muted-foreground">Questions & feedback live</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => setTab("simulation")}>
              <CardContent className="pt-5 pb-5 flex items-center gap-4">
                <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Phone className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <p className="font-bold">Simulation appel</p>
                  <p className="text-sm text-muted-foreground">Entraînez-vous en conditions réelles</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── PARCOURS ── */}
      {tab === "path" && (
        <div className="space-y-4">
          {modules.length === 0 ? (
            <Card className="border-dashed border-2">
              <CardContent className="flex flex-col items-center py-14 text-center gap-4">
                <BookOpen className="h-12 w-12 text-muted-foreground opacity-40" />
                <div>
                  <p className="font-bold text-lg">Aucun parcours généré</p>
                  <p className="text-sm text-muted-foreground mt-1">Retournez au tableau de bord pour générer votre parcours personnalisé.</p>
                </div>
                <Button onClick={() => setTab("dashboard")} variant="outline">Tableau de bord</Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="font-bold">{completedCount}/{modules.length} modules complétés</p>
                <div className="h-2 flex-1 mx-4 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
                <span className="text-sm font-bold text-primary">{progress}%</span>
              </div>
              <div className="grid gap-4">
                {modules.map((mod, i) => (
                  <Card key={mod.id} className={`transition-all ${mod.completed ? "border-green-200 bg-green-50/30" : "hover:border-primary/30"}`}>
                    <CardContent className="pt-5 pb-5">
                      <div className="flex items-start gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm flex-shrink-0 ${mod.completed ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"}`}>
                          {mod.completed ? <CheckCircle2 className="h-5 w-5" /> : i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <h3 className="font-bold">{mod.title}</h3>
                            <Badge variant="outline" className="text-xs capitalize">{mod.level}</Badge>
                            <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{mod.duration}</span>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">{mod.description}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {mod.topics.map((t, j) => (
                              <span key={j} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{t}</span>
                            ))}
                          </div>
                          {mod.score && <p className="text-sm font-bold text-green-600 mt-2">Score obtenu : {mod.score}/100</p>}
                        </div>
                        <Button
                          size="sm"
                          variant={mod.completed ? "outline" : "default"}
                          className="flex-shrink-0 gap-1.5"
                          onClick={() => {
                            setSelectedModule(mod);
                            setQuizTopic(mod.title + " — " + mod.topics.join(", "));
                            generateQuiz(mod.title + " : " + mod.topics.join(", "));
                          }}
                        >
                          {mod.completed ? <><RotateCcw className="h-3.5 w-3.5" />Refaire</> : <><Play className="h-3.5 w-3.5" />Démarrer</>}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── QUIZ ── */}
      {tab === "quiz" && (
        <div className="max-w-2xl space-y-4">
          {quiz.questions.length === 0 && !quiz.loading ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Brain className="h-5 w-5 text-purple-600" />Générer un quiz IA</CardTitle>
                <CardDescription>L'IA crée 5 questions adaptées à votre rôle et niveau sur le sujet de votre choix.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Sujet du quiz</Label>
                  <Input
                    placeholder="Ex: Gestion des objections clients, CRM Servicall, Techniques de closing…"
                    value={quizTopic}
                    onChange={e => setQuizTopic(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && generateQuiz(quizTopic)}
                  />
                </div>
                <Button onClick={() => generateQuiz(quizTopic)} disabled={!quizTopic.trim()} className="w-full gap-2">
                  <Sparkles className="h-4 w-4" /> Générer le quiz
                </Button>
              </CardContent>
            </Card>
          ) : quiz.loading ? (
            <Card>
              <CardContent className="flex flex-col items-center py-14 gap-4">
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
                <p className="font-medium text-muted-foreground">Génération des questions IA…</p>
              </CardContent>
            </Card>
          ) : !quiz.finished ? (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Question {quiz.current + 1} / {quiz.questions.length}</CardTitle>
                  <div className="h-2 w-32 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${((quiz.current) / quiz.questions.length) * 100}%` }} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="font-bold text-lg leading-relaxed">{quiz.questions[quiz.current].question}</p>
                <div className="grid gap-2.5">
                  {quiz.questions[quiz.current].options.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => answerQuiz(i)}
                      className="text-left p-4 rounded-xl border-2 border-muted hover:border-primary hover:bg-primary/5 transition-all font-medium text-sm"
                    >
                      <span className="inline-flex w-6 h-6 rounded-full bg-muted items-center justify-center text-xs font-bold mr-2">
                        {String.fromCharCode(65 + i)}
                      </span>
                      {opt}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-8 pb-8 space-y-6">
                <div className="text-center">
                  <div className={`text-6xl font-black mb-2 ${quizScore >= 70 ? "text-green-600" : quizScore >= 50 ? "text-yellow-600" : "text-red-600"}`}>
                    {quizScore}/100
                  </div>
                  <p className="text-muted-foreground font-medium">
                    {quizScore >= 70 ? "🎉 Excellent ! Vous maîtrisez ce sujet." : quizScore >= 50 ? "📚 Passable — quelques révisions s'imposent." : "💪 Continuez à vous entraîner !"}
                  </p>
                </div>
                <div className="space-y-3">
                  {quiz.questions.map((q, i) => {
                    const isCorrect = quiz.answers[i] === q.correct;
                    return (
                      <div key={i} className={`p-3 rounded-xl border ${isCorrect ? "border-green-200 bg-green-50/40" : "border-red-200 bg-red-50/40"}`}>
                        <div className="flex items-start gap-2 mb-1">
                          {isCorrect ? <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" /> : <XCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />}
                          <p className="text-sm font-medium">{q.question}</p>
                        </div>
                        {!isCorrect && <p className="text-xs text-muted-foreground ml-6">Bonne réponse : {q.options[q.correct]}</p>}
                        <p className="text-xs text-muted-foreground ml-6 mt-1 italic">{q.explanation}</p>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-3">
                  <Button onClick={() => setQuiz({ questions: [], current: 0, answers: [], finished: false, loading: false })} variant="outline" className="gap-2">
                    <RotateCcw className="h-4 w-4" /> Nouveau quiz
                  </Button>
                  <Button onClick={() => setTab("path")} className="gap-2">
                    <BookOpen className="h-4 w-4" /> Retour au parcours
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── COACH ── */}
      {tab === "coach" && (
        <div className="max-w-2xl">
          {coachMessages.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-blue-600" />Coach IA personnel</CardTitle>
                <CardDescription>Choisissez un sujet. Le coach pose des questions pratiques et évalue vos réponses en temps réel.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Sujet de coaching</Label>
                  <Input
                    placeholder="Ex: Traitement des objections prix, Prise de rendez-vous, Écoute active…"
                    value={coachTopic}
                    onChange={e => setCoachTopic(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && startCoach()}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {["Gestion des objections", "Techniques de closing", "Fidélisation client", "Prospection téléphonique"].map(s => (
                    <button key={s} onClick={() => setCoachTopic(s)} className="text-xs px-3 py-2 bg-muted hover:bg-primary/10 hover:text-primary rounded-lg text-left font-medium transition-colors">
                      {s}
                    </button>
                  ))}
                </div>
                <Button onClick={startCoach} disabled={!coachTopic.trim() || isCoaching} className="w-full gap-2">
                  {isCoaching ? <><Loader2 className="h-4 w-4 animate-spin" />Démarrage…</> : <><Zap className="h-4 w-4" />Démarrer la session</>}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Bot className="h-5 w-5 text-primary" /> Coach IA — {coachTopic}
                  </CardTitle>
                  <Button size="sm" variant="ghost" onClick={() => setCoachMessages([])} className="gap-1.5 text-xs">
                    <RotateCcw className="h-3.5 w-3.5" /> Nouvelle session
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="overflow-y-auto space-y-3 mb-4" style={{ maxHeight: "380px" }}>
                  {coachMessages.map((msg, i) => (
                    <div key={i} className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === "assistant" ? "bg-blue-500/10" : "bg-muted"}`}>
                        {msg.role === "assistant" ? <Bot className="h-4 w-4 text-blue-600" /> : <User className="h-4 w-4" />}
                      </div>
                      <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${msg.role === "assistant" ? "bg-muted/60" : "bg-primary text-primary-foreground"}`}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {isCoaching && (
                    <div className="flex gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                        <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Répondez à la question du coach…"
                    value={coachInput}
                    onChange={e => setCoachInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && sendCoachMessage()}
                    disabled={isCoaching}
                  />
                  <Button size="icon" onClick={sendCoachMessage} disabled={isCoaching || !coachInput.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── SIMULATION ── */}
      {tab === "simulation" && (
        <div className="max-w-2xl space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2"><Phone className="h-5 w-5 text-orange-600" />Simulation d'appel client</CardTitle>
              <CardDescription>L'IA joue un client avec un scénario réel. Gérez l'appel, puis obtenez un feedback détaillé.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 mb-4">
                <Label>Scénario</Label>
                <select
                  value={simScenario}
                  onChange={e => setSimScenario(e.target.value)}
                  className="w-full text-sm font-medium bg-background border rounded-lg px-3 py-2 outline-none"
                  disabled={simMessages.length > 0}
                >
                  {["Client mécontent — facture en litige", "Prospect froid — première prise de contact", "Client qui hésite — concurrence moins chère", "Client fidèle — upsell vers plan supérieur", "Annulation d'abonnement — rétention client"].map(s => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>

              {simMessages.length === 0 ? (
                <Button onClick={startSimulation} disabled={isSimulating} className="w-full gap-2">
                  {isSimulating ? <><Loader2 className="h-4 w-4 animate-spin" />Démarrage…</> : <><Phone className="h-4 w-4" />Démarrer la simulation</>}
                </Button>
              ) : (
                <>
                  <div className="overflow-y-auto space-y-3 mb-4" style={{ maxHeight: "320px" }}>
                    {simMessages.map((msg, i) => (
                      <div key={i} className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${msg.role === "assistant" ? "bg-orange-500/10 text-orange-600" : "bg-muted"}`}>
                          {msg.role === "assistant" ? "C" : "A"}
                        </div>
                        <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${msg.role === "assistant" ? "bg-orange-50 text-orange-900 border border-orange-100" : "bg-primary text-primary-foreground"}`}>
                          {msg.role === "assistant" && <span className="text-xs font-bold text-orange-500 block mb-1">Client</span>}
                          {msg.content}
                        </div>
                      </div>
                    ))}
                    {isSimulating && <div className="flex gap-2.5"><div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center"><Loader2 className="h-4 w-4 text-orange-500 animate-spin" /></div></div>}
                    <div ref={simEndRef} />
                  </div>
                  <div className="flex gap-2 mb-3">
                    <Input
                      placeholder="Votre réponse à ce client…"
                      value={simInput}
                      onChange={e => setSimInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && sendSimMessage()}
                      disabled={isSimulating}
                    />
                    <Button size="icon" onClick={sendSimMessage} disabled={isSimulating || !simInput.trim()}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={endSimulation} disabled={isSimulating} variant="outline" className="flex-1 gap-2">
                      <Award className="h-4 w-4" /> Terminer et évaluer
                    </Button>
                    <Button onClick={() => { setSimMessages([]); setSimFeedback(null); }} variant="ghost" size="icon">
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Feedback card */}
          {simFeedback && (
            <Card className={`border-2 ${simFeedback.score >= 70 ? "border-green-200" : simFeedback.score >= 50 ? "border-yellow-200" : "border-red-200"}`}>
              <CardContent className="pt-6 pb-6 space-y-4">
                <div className="text-center">
                  <div className={`text-5xl font-black mb-1 ${simFeedback.score >= 70 ? "text-green-600" : simFeedback.score >= 50 ? "text-yellow-600" : "text-red-600"}`}>
                    {simFeedback.score}/100
                  </div>
                  <p className="text-sm text-muted-foreground">Performance sur cet appel</p>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-bold text-green-600 mb-2 flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" />Points forts</p>
                    <ul className="space-y-1.5">
                      {simFeedback.strengths.map((s, i) => <li key={i} className="text-sm text-muted-foreground">• {s}</li>)}
                    </ul>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-amber-600 mb-2 flex items-center gap-1.5"><TrendingUp className="h-4 w-4" />À améliorer</p>
                    <ul className="space-y-1.5">
                      {simFeedback.improvements.map((s, i) => <li key={i} className="text-sm text-muted-foreground">• {s}</li>)}
                    </ul>
                  </div>
                </div>
                <Button onClick={() => { setSimMessages([]); setSimFeedback(null); }} variant="outline" className="w-full gap-2">
                  <RotateCcw className="h-4 w-4" /> Recommencer ce scénario
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}