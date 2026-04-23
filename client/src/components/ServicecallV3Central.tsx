/**
 * SERVICALL v2 — Intelligence Centrale
 * Composant principal combinant les 4 modules IA :
 *   1. Analyse d'Entretien (Recrutement)
 *   2. Résumé Professionnel Décisionnel
 *   3. Qualification Appels Entrants
 *   4. Parsing CV / Mails
 *
 * Température : 0.3 pour analyse technique, 0.7 pour résumés
 * Format de sortie : JSON strict 100% Français
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Separator,
} from "@/components/ui/separator";
import { Brain,
  FileText,
  Phone,
  Mail,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  User,
  Sparkles,
  BarChart3,
  Clock,
  Shield,
  Zap,
  ChevronRight,
  Copy,
  Download,
 } from 'lucide-react';
import { toast } from "sonner";

// ============================================================
// TYPES STRICTS — Servicall v2
// ============================================================

interface CriteriaScore {
  score: number;
  comment: string;
  weight: number;
}

interface EmotionEvent {
  timestamp: number;
  emotion: string;
  intensity: number;
}

interface BehavioralAnalysis {
  emotions: string[];
  emotionTimeline: EmotionEvent[];
  coherenceScore: number;
  honestyScore: number;
  communicationScore: number;
}

interface InterviewAnalysisResult {
  criteriaScores: {
    technical: CriteriaScore;
    communication: CriteriaScore;
    coherence: CriteriaScore;
    honesty: CriteriaScore;
    motivation: CriteriaScore;
  };
  behavioralAnalysis: BehavioralAnalysis;
  redFlags: string[];
  strengths: string[];
  culturalFit?: number;
  globalScore?: number;
}

interface ProfessionalSummaryResult {
  globalProfile: string;
  differentiatingStrength: string;
  majorRiskOrRecommendation: string;
  decisionRecommendation: "RECRUTER" | "ENTRETIEN_COMPLEMENTAIRE" | "REJETER";
  confidence: number;
}

interface CallQualificationResult {
  callerName: string | null;
  callerCompany: string | null;
  callerPhone: string | null;
  callerEmail: string | null;
  callIntent: "Vente" | "Support" | "Réclamation" | "Administratif" | "Autre";
  urgency: "high" | "medium" | "low";
  shouldTransferImmediately: boolean;
  recommendedDepartment: string | null;
  summary: string;
  notes: string;
}

interface CVMailParsingResult {
  fullName: string | null;
  email: string | null;
  phone: string | null;
  currentPosition: string | null;
  yearsOfExperience: number | null;
  topSkills: string[];
  educationLevel: string | null;
  motivationArguments?: string[];
  rawData?: Record<string, unknown>;
}

// ============================================================
// HELPERS UI
// ============================================================

function ScoreBadge({ score, max = 10 }: { score: number; max?: number }) {
  const pct = (score / max) * 100;
  const color =
    pct >= 80
      ? "bg-green-100 text-green-800 border-green-200"
      : pct >= 60
      ? "bg-yellow-100 text-yellow-800 border-yellow-200"
      : "bg-red-100 text-red-800 border-red-200";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${color}`}
    >
      {score.toFixed(1)} / {max}
    </span>
  );
}

function UrgencyBadge({ urgency }: { urgency: "high" | "medium" | "low" }) {
  const map = {
    high: "bg-red-100 text-red-800 border-red-200",
    medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
    low: "bg-green-100 text-green-800 border-green-200",
  };
  const labels = { high: "Haute", medium: "Moyenne", low: "Faible" };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${map[urgency]}`}
    >
      {urgency === "high" && <AlertTriangle className="h-3 w-3" />}
      {urgency === "medium" && <Clock className="h-3 w-3" />}
      {urgency === "low" && <CheckCircle2 className="h-3 w-3" />}
      {labels[urgency]}
    </span>
  );
}

function JsonBlock({ data }: { data: unknown }) {
  const text = JSON.stringify(data, null, 2);
  const copy = () => {
    navigator.clipboard.writeText(text);
    toast.success("JSON copié dans le presse-papier");
  };
  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-2 right-2 h-7 px-2 text-xs"
        onClick={copy}
      >
        <Copy className="h-3 w-3 mr-1" /> Copier
      </Button>
      <ScrollArea className="h-48 w-full rounded-md border bg-muted/30 p-3">
        <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">
          {text}
        </pre>
      </ScrollArea>
    </div>
  );
}

// ============================================================
// MODULE 1 — ANALYSE D'ENTRETIEN
// ============================================================

function InterviewAnalysisModule() {
  const [transcript, setTranscript] = useState("");
  const [businessType, setBusinessType] = useState("centre d'appels");
  const [result, setResult] = useState<InterviewAnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const analyzeInterview = trpc.aiAutomation.servicallV3.analyzeInterview.useMutation();

  const handleAnalyze = async () => {
    if (!transcript.trim() || transcript.length < 50) {
      toast.error("Le transcript doit contenir au moins 50 caractères.");
      return;
    }
    setIsLoading(true);
    try {
      // Utiliser le router recruitment existant
      const res = await analyzeInterview.mutateAsync({
        transcript,
        businessType,
      });
      setResult(res as unknown as InterviewAnalysisResult);
      toast.success("Analyse terminée avec succès");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur lors de l'analyse";
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const criteriaLabels: Record<string, string> = {
    technical: "Compétences Techniques",
    communication: "Communication",
    coherence: "Cohérence",
    honesty: "Honnêteté",
    motivation: "Motivation",
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-2">
          <Label htmlFor="transcript">Transcript de l'entretien</Label>
          <Textarea
            id="transcript"
            placeholder="Collez ici le transcript complet de l'entretien téléphonique ou en présentiel..."
            className="min-h-[180px] font-mono text-sm"
            value={transcript}
            onChange={(e: any) => setTranscript(e.target.value)}
          />
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="businessType">Secteur d'activité</Label>
            <Input
              id="businessType"
              placeholder="ex: centre d'appels, médical..."
              value={businessType}
              onChange={(e: any) => setBusinessType(e.target.value)}
            />
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">
              Critères évalués
            </p>
            <ul className="mt-2 space-y-1">
              {Object.values(criteriaLabels).map((label) => (
                <li key={label} className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                  <ChevronRight className="h-3 w-3" /> {label}
                </li>
              ))}
            </ul>
          </div>
          <Button
            className="w-full"
            onClick={handleAnalyze}
            disabled={isLoading || !transcript.trim()}
          >
            {isLoading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analyse en cours...</>
            ) : (
              <><Brain className="h-4 w-4 mr-2" /> Analyser l'entretien</>
            )}
          </Button>
        </div>
      </div>

      {result && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Separator />
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-lg">Résultats de l'analyse IA</h3>
            {result.globalScore !== undefined && (
              <Badge variant="outline" className="ml-auto">
                Score global : {result.globalScore.toFixed(1)} / 10
              </Badge>
            )}
          </div>

          {/* Scores par critère */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(result.criteriaScores || {}).map(([key, val]) => (
              <Card key={key} className="border-none bg-muted/40">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">
                      {criteriaLabels[key] || key}
                    </span>
                    <ScoreBadge score={val.score} />
                  </div>
                  <Progress value={(val.score / 10) * 100} className="h-1.5 mb-2" />
                  <p className="text-xs text-muted-foreground">{val.comment}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Analyse comportementale */}
          {result.behavioralAnalysis && (
            <Card className="border-none bg-muted/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Analyse Comportementale
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {result.behavioralAnalysis.emotions?.map((emotion) => (
                    <Badge key={emotion} variant="secondary" className="text-xs">
                      {emotion}
                    </Badge>
                  ))}
                </div>
                {result.behavioralAnalysis.emotionTimeline?.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Chronologie émotionnelle</p>
                    <div className="space-y-1">
                      {result.behavioralAnalysis.emotionTimeline.map((event, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <span className="text-muted-foreground w-12 shrink-0">
                            {event.timestamp}s
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {event.emotion}
                          </Badge>
                          <Progress
                            value={event.intensity * 100}
                            className="h-1 flex-1"
                          />
                          <span className="text-muted-foreground w-8 text-right">
                            {Math.round(event.intensity * 100)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Red Flags & Strengths */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {result.redFlags && result.redFlags.length > 0 && (
              <Card className="border-none bg-red-50 dark:bg-red-950/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-red-700 dark:text-red-400">
                    <AlertTriangle className="h-4 w-4" /> Points d'alerte
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1">
                    {result.redFlags.map((flag, i) => (
                      <li key={i} className="text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
                        <span className="mt-0.5 shrink-0">•</span> {flag}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
            {result.strengths && result.strengths.length > 0 && (
              <Card className="border-none bg-green-50 dark:bg-green-950/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-green-700 dark:text-green-400">
                    <CheckCircle2 className="h-4 w-4" /> Points forts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1">
                    {result.strengths.map((strength, i) => (
                      <li key={i} className="text-sm text-green-700 dark:text-green-300 flex items-start gap-2">
                        <span className="mt-0.5 shrink-0">•</span> {strength}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>

          {/* JSON brut */}
          <details className="group">
            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 select-none">
              <ChevronRight className="h-3 w-3 group-open:rotate-90 transition-transform" />
              Voir le JSON brut
            </summary>
            <div className="mt-2">
              <JsonBlock data={result} />
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

// ============================================================
// MODULE 2 — RÉSUMÉ PROFESSIONNEL DÉCISIONNEL
// ============================================================

function ProfessionalSummaryModule() {
  const [transcript, setTranscript] = useState("");
  const [businessType, setBusinessType] = useState("centre d'appels");
  const [result, setResult] = useState<ProfessionalSummaryResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const generateSummary = trpc.aiAutomation.servicallV3.generateSummary.useMutation();

  const _SYSTEM_PROMPT = `Tu es un recruteur expert (Servicall v2 — Module Résumé Professionnel).
Analyse le transcript d'entretien fourni et génère une note de synthèse décisionnelle STRICTEMENT en JSON valide selon ce format :
{
  "globalProfile": "Description du profil global en 1-2 phrases",
  "differentiatingStrength": "Point fort différenciant en 1 phrase",
  "majorRiskOrRecommendation": "Risque majeur ou recommandation de suivi en 1 phrase",
  "decisionRecommendation": "RECRUTER" | "ENTRETIEN_COMPLEMENTAIRE" | "REJETER",
  "confidence": 0.0-1.0
}
Ton direct, analytique, professionnel. Maximum 4 phrases au total. 100% Français.`;

  const handleGenerate = async () => {
    if (!transcript.trim() || transcript.length < 50) {
      toast.error("Le transcript doit contenir au moins 50 caractères.");
      return;
    }
    setIsLoading(true);
    try {
      const res = await generateSummary.mutateAsync({
        transcript,
        businessType,
      });
      const parsed = res as unknown as ProfessionalSummaryResult;
      setResult(parsed);
      toast.success("Résumé généré avec succès");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur lors de la génération";
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const decisionColors = {
    RECRUTER: "bg-green-100 text-green-800 border-green-300",
    ENTRETIEN_COMPLEMENTAIRE: "bg-yellow-100 text-yellow-800 border-yellow-300",
    REJETER: "bg-red-100 text-red-800 border-red-300",
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-2">
          <Label htmlFor="transcript-summary">Transcript de l'entretien</Label>
          <Textarea
            id="transcript-summary"
            placeholder="Collez ici le transcript de l'entretien pour générer une note de synthèse décisionnelle..."
            className="min-h-[180px] font-mono text-sm"
            value={transcript}
            onChange={(e: any) => setTranscript(e.target.value)}
          />
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Secteur d'activité</Label>
            <Input
              placeholder="ex: médical, restauration..."
              value={businessType}
              onChange={(e: any) => setBusinessType(e.target.value)}
            />
          </div>
          <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-800">
            <p className="text-xs text-purple-700 dark:text-purple-300 font-medium">Format de sortie</p>
            <ul className="mt-2 space-y-1 text-xs text-purple-600 dark:text-purple-400">
              <li className="flex items-center gap-1"><ChevronRight className="h-3 w-3" /> Profil global</li>
              <li className="flex items-center gap-1"><ChevronRight className="h-3 w-3" /> Point fort différenciant</li>
              <li className="flex items-center gap-1"><ChevronRight className="h-3 w-3" /> Risque majeur</li>
              <li className="flex items-center gap-1"><ChevronRight className="h-3 w-3" /> Décision : RECRUTER / REJETER</li>
            </ul>
          </div>
          <Button
            className="w-full"
            onClick={handleGenerate}
            disabled={isLoading || !transcript.trim()}
          >
            {isLoading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Génération...</>
            ) : (
              <><FileText className="h-4 w-4 mr-2" /> Générer le résumé</>
            )}
          </Button>
        </div>
      </div>

      {result && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Separator />
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-lg">Note de Synthèse Décisionnelle</h3>
            <span
              className={`ml-auto inline-flex items-center px-3 py-1 rounded-full text-sm font-bold border ${
                decisionColors[result.decisionRecommendation] || decisionColors.ENTRETIEN_COMPLEMENTAIRE
              }`}
            >
              {result.decisionRecommendation}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <Card className="border-none bg-muted/40">
              <CardContent className="pt-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Profil Global
                </p>
                <p className="text-sm">{result.globalProfile}</p>
              </CardContent>
            </Card>
            {result.differentiatingStrength && (
              <Card className="border-none bg-green-50 dark:bg-green-950/20">
                <CardContent className="pt-4">
                  <p className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide mb-1">
                    Point Fort Différenciant
                  </p>
                  <p className="text-sm text-green-800 dark:text-green-300">{result.differentiatingStrength}</p>
                </CardContent>
              </Card>
            )}
            {result.majorRiskOrRecommendation && (
              <Card className="border-none bg-orange-50 dark:bg-orange-950/20">
                <CardContent className="pt-4">
                  <p className="text-xs font-semibold text-orange-700 dark:text-orange-400 uppercase tracking-wide mb-1">
                    Risque Majeur / Recommandation
                  </p>
                  <p className="text-sm text-orange-800 dark:text-orange-300">{result.majorRiskOrRecommendation}</p>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Confiance IA :</span>
            <Progress value={(result.confidence || 0) * 100} className="h-2 flex-1" />
            <span className="text-xs font-medium">{Math.round((result.confidence || 0) * 100)}%</span>
          </div>

          <details className="group">
            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 select-none">
              <ChevronRight className="h-3 w-3 group-open:rotate-90 transition-transform" />
              Voir le JSON brut
            </summary>
            <div className="mt-2">
              <JsonBlock data={result} />
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

// ============================================================
// MODULE 3 — QUALIFICATION APPELS ENTRANTS
// ============================================================

function CallQualificationModule() {
  const [transcription, setTranscription] = useState("");
  const [businessType, setBusinessType] = useState("centre d'appels");
  const [departments, setDepartments] = useState("Commercial, Support, Administratif");
  const [result, setResult] = useState<CallQualificationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const qualifyCaller = trpc.aiAutomation.servicallV3.qualifyCall.useMutation();

  const handleQualify = async () => {
    if (!transcription.trim() || transcription.length < 20) {
      toast.error("La transcription doit contenir au moins 20 caractères.");
      return;
    }
    setIsLoading(true);
    try {
      const res = await qualifyCaller.mutateAsync({
        transcription,
        businessType,
        departments: departments.split(",").map((d) => d.trim()),
      });
      const mapped: CallQualificationResult = res as unknown as CallQualificationResult;
      setResult(mapped);
      toast.success("Qualification terminée");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur lors de la qualification";
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function __mapIntent(reason: string): CallQualificationResult["callIntent"] {
    const r = reason.toLowerCase();
    if (r.includes("vente") || r.includes("achat") || r.includes("devis")) return "Vente";
    if (r.includes("support") || r.includes("aide") || r.includes("problème")) return "Support";
    if (r.includes("réclamation") || r.includes("plainte") || r.includes("remboursement")) return "Réclamation";
    if (r.includes("admin") || r.includes("facture") || r.includes("contrat")) return "Administratif";
    return "Autre";
  }

  const intentColors: Record<string, string> = {
    Vente: "bg-green-100 text-green-800 border-green-200",
    Support: "bg-blue-100 text-blue-800 border-blue-200",
    Réclamation: "bg-red-100 text-red-800 border-red-200",
    Administratif: "bg-gray-100 text-gray-800 border-gray-200",
    Autre: "bg-purple-100 text-purple-800 border-purple-200",
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-2">
          <Label htmlFor="transcription-call">Transcription de l'appel entrant</Label>
          <Textarea
            id="transcription-call"
            placeholder="Collez ici la transcription de l'appel entrant à qualifier..."
            className="min-h-[160px] font-mono text-sm"
            value={transcription}
            onChange={(e: any) => setTranscription(e.target.value)}
          />
        </div>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Secteur</Label>
            <Input
              placeholder="ex: immobilier, médical..."
              value={businessType}
              onChange={(e: any) => setBusinessType(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Départements (séparés par virgule)</Label>
            <Input
              placeholder="Commercial, Support, RH..."
              value={departments}
              onChange={(e: any) => setDepartments(e.target.value)}
            />
          </div>
          <Button
            className="w-full"
            onClick={handleQualify}
            disabled={isLoading || !transcription.trim()}
          >
            {isLoading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Qualification...</>
            ) : (
              <><Phone className="h-4 w-4 mr-2" /> Qualifier l'appel</>
            )}
          </Button>
        </div>
      </div>

      {result && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Separator />
          <div className="flex items-center gap-2 flex-wrap">
            <Phone className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-lg">Résultat de Qualification</h3>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${
                intentColors[result.callIntent] || intentColors['Autre']
              }`}
            >
              {result.callIntent}
            </span>
            <UrgencyBadge urgency={result.urgency} />
            {result.shouldTransferImmediately && (
              <Badge variant="destructive" className="text-xs">
                Transfert immédiat requis
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Card className="border-none bg-muted/40">
              <CardContent className="pt-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Informations Appelant
                </p>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{result.callerName || "Inconnu"}</span>
                  </div>
                  {result.callerCompany && (
                    <div className="flex items-center gap-2">
                      <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{result.callerCompany}</span>
                    </div>
                  )}
                  {result.callerPhone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{result.callerPhone}</span>
                    </div>
                  )}
                  {result.callerEmail && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{result.callerEmail}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card className="border-none bg-muted/40">
              <CardContent className="pt-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Analyse & Redirection
                </p>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs">Résumé : </span>
                    <span>{result.summary}</span>
                  </div>
                  {result.recommendedDepartment && (
                    <div>
                      <span className="text-muted-foreground text-xs">Département recommandé : </span>
                      <Badge variant="outline" className="text-xs">{result.recommendedDepartment}</Badge>
                    </div>
                  )}
                  {result.notes && (
                    <div>
                      <span className="text-muted-foreground text-xs">Notes : </span>
                      <span className="text-xs">{result.notes}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {result.shouldTransferImmediately && (
            <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
              <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
              <p className="text-sm text-red-700 dark:text-red-300 font-medium">
                Urgence détectée — Transfert immédiat vers un agent humain recommandé.
              </p>
            </div>
          )}

          <details className="group">
            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 select-none">
              <ChevronRight className="h-3 w-3 group-open:rotate-90 transition-transform" />
              Voir le JSON brut
            </summary>
            <div className="mt-2">
              <JsonBlock data={result} />
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

// ============================================================
// MODULE 4 — PARSING CV / MAILS
// ============================================================

function CVMailParsingModule() {
  const [content, setContent] = useState("");
  const [contentType, setContentType] = useState<"cv" | "mail">("cv");
  const [result, setResult] = useState<CVMailParsingResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const analyzeDoc = trpc.aiAutomation.servicallV3.parseDocument.useMutation();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _CV_PROMPT = `Tu es un expert en parsing de CV (Servicall v2 — Module Parsing CV).
Extrais les informations suivantes du CV fourni et réponds UNIQUEMENT en JSON valide :
{
  "fullName": "Nom complet ou null",
  "email": "Email ou null",
  "phone": "Téléphone ou null",
  "currentPosition": "Poste actuel ou null",
  "yearsOfExperience": 0,
  "topSkills": ["compétence1", "compétence2", "compétence3", "compétence4", "compétence5"],
  "educationLevel": "Niveau de formation ou null"
}
100% Français. JSON strict sans texte supplémentaire.`;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _MAIL_PROMPT = `Tu es un expert en parsing de mails de candidature (Servicall v2 — Module Parsing Mail).
Extrais les informations suivantes du mail fourni et réponds UNIQUEMENT en JSON valide :
{
  "fullName": "Nom complet ou null",
  "email": "Email ou null",
  "phone": "Téléphone ou null",
  "currentPosition": "Poste actuel ou null",
  "yearsOfExperience": 0,
  "topSkills": ["compétence1", "compétence2", "compétence3", "compétence4", "compétence5"],
  "educationLevel": "Niveau de formation ou null",
  "motivationArguments": ["argument1", "argument2", "argument3"]
}
100% Français. JSON strict sans texte supplémentaire.`;

  const handleParse = async () => {
    if (!content.trim() || content.length < 30) {
      toast.error("Le contenu doit contenir au moins 30 caractères.");
      return;
    }
    setIsLoading(true);
    try {
      const res = await analyzeDoc.mutateAsync({
        content,
        documentType: contentType,
      });
      const parsed = res as unknown as CVMailParsingResult;
      setResult(parsed);
      toast.success("Parsing terminé avec succès");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur lors du parsing";
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const exportResult = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `servicall_v3_parsing_${contentType}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Fichier JSON exporté");
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-2">
          <div className="flex items-center gap-3 mb-2">
            <Label>Type de contenu</Label>
            <div className="flex gap-2">
              <Button
                variant={contentType === "cv" ? "default" : "outline"}
                size="sm"
                onClick={() => setContentType("cv")}
              >
                <FileText className="h-3.5 w-3.5 mr-1" /> CV
              </Button>
              <Button
                variant={contentType === "mail" ? "default" : "outline"}
                size="sm"
                onClick={() => setContentType("mail")}
              >
                <Mail className="h-3.5 w-3.5 mr-1" /> Mail
              </Button>
            </div>
          </div>
          <Textarea
            placeholder={
              contentType === "cv"
                ? "Collez ici le contenu texte du CV à analyser..."
                : "Collez ici le contenu du mail de candidature (avec lettre de motivation si présente)..."
            }
            className="min-h-[200px] font-mono text-sm"
            value={content}
            onChange={(e: any) => setContent(e.target.value)}
          />
        </div>
        <div className="space-y-4">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg border border-indigo-200 dark:border-indigo-800">
            <p className="text-xs text-indigo-700 dark:text-indigo-300 font-medium">
              Données extraites
            </p>
            <ul className="mt-2 space-y-1 text-xs text-indigo-600 dark:text-indigo-400">
              <li className="flex items-center gap-1"><ChevronRight className="h-3 w-3" /> Nom complet</li>
              <li className="flex items-center gap-1"><ChevronRight className="h-3 w-3" /> Email & Téléphone</li>
              <li className="flex items-center gap-1"><ChevronRight className="h-3 w-3" /> Poste actuel</li>
              <li className="flex items-center gap-1"><ChevronRight className="h-3 w-3" /> Années d'expérience</li>
              <li className="flex items-center gap-1"><ChevronRight className="h-3 w-3" /> Top 5 compétences</li>
              <li className="flex items-center gap-1"><ChevronRight className="h-3 w-3" /> Niveau de formation</li>
              {contentType === "mail" && (
                <li className="flex items-center gap-1"><ChevronRight className="h-3 w-3" /> 3 arguments motivation</li>
              )}
            </ul>
          </div>
          <Button
            className="w-full"
            onClick={handleParse}
            disabled={isLoading || !content.trim()}
          >
            {isLoading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Parsing...</>
            ) : (
              <><Zap className="h-4 w-4 mr-2" /> Extraire les données</>
            )}
          </Button>
        </div>
      </div>

      {result && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Separator />
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-lg">Données Extraites</h3>
            <Button variant="outline" size="sm" className="ml-auto" onClick={exportResult}>
              <Download className="h-3.5 w-3.5 mr-1" /> Exporter JSON
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Card className="border-none bg-muted/40">
              <CardContent className="pt-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Informations Personnelles
                </p>
                <div className="space-y-1.5 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">{result.fullName || "Non renseigné"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{result.email || "Non renseigné"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{result.phone || "Non renseigné"}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-none bg-muted/40">
              <CardContent className="pt-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Profil Professionnel
                </p>
                <div className="space-y-1.5 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs">Poste actuel : </span>
                    <span>{result.currentPosition || "Non renseigné"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Expérience : </span>
                    <span>{result.yearsOfExperience !== null ? `${result.yearsOfExperience} ans` : "Non renseigné"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Formation : </span>
                    <span>{result.educationLevel || "Non renseigné"}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {result.topSkills && result.topSkills.length > 0 && (
            <Card className="border-none bg-muted/40">
              <CardContent className="pt-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Top 5 Compétences Clés
                </p>
                <div className="flex flex-wrap gap-2">
                  {result.topSkills.map((skill, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {result.motivationArguments && result.motivationArguments.length > 0 && (
            <Card className="border-none bg-blue-50 dark:bg-blue-950/20">
              <CardContent className="pt-4">
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide mb-2">
                  Arguments de Motivation (Lettre)
                </p>
                <ol className="space-y-1">
                  {result.motivationArguments.map((arg, i) => (
                    <li key={i} className="text-sm text-blue-800 dark:text-blue-300 flex items-start gap-2">
                      <span className="font-bold shrink-0">{i + 1}.</span> {arg}
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}

          <details className="group">
            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 select-none">
              <ChevronRight className="h-3 w-3 group-open:rotate-90 transition-transform" />
              Voir le JSON brut
            </summary>
            <div className="mt-2">
              <JsonBlock data={result} />
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

// ============================================================
// COMPOSANT PRINCIPAL — SERVICALL V3 INTELLIGENCE CENTRALE
// ============================================================

export default function ServicecallV3Central() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="p-3 bg-primary/10 rounded-xl shrink-0">
          <Brain className="h-7 w-7 text-primary" />
        </div>
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-black tracking-tight">
              Intelligence Centrale
            </h1>
            <Badge className="bg-primary/10 text-primary border-primary/20 font-semibold">
              Servicall v2
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">
            Plateforme unifiée : Analyse d'entretien IA, résumé décisionnel, qualification d'appels et parsing CV/mails.
          </p>
        </div>
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Brain, label: "Analyse Entretien", desc: "Scores 0-10 par critère", color: "text-blue-600 bg-blue-50 dark:bg-blue-950/30" },
          { icon: FileText, label: "Résumé Décisionnel", desc: "3 points clés + décision", color: "text-purple-600 bg-purple-50 dark:bg-purple-950/30" },
          { icon: Phone, label: "Qualification Appels", desc: "Intent + Urgence + Transfert", color: "text-green-600 bg-green-50 dark:bg-green-950/30" },
          { icon: Mail, label: "Parsing CV / Mails", desc: "Extraction automatisée", color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30" },
        ].map(({ icon: Icon, label, desc, color }) => (
          <Card key={label} className="border-none bg-card/50">
            <CardContent className="pt-4 pb-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <p className="text-sm font-semibold leading-tight">{label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Onglets des 4 modules */}
      <Tabs defaultValue="interview" className="w-full">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 w-full h-auto gap-1 p-1">
          <TabsTrigger value="interview" className="flex items-center gap-1.5 text-xs py-2">
            <Brain className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Analyse</span> Entretien
          </TabsTrigger>
          <TabsTrigger value="summary" className="flex items-center gap-1.5 text-xs py-2">
            <FileText className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Résumé</span> Décisionnel
          </TabsTrigger>
          <TabsTrigger value="calls" className="flex items-center gap-1.5 text-xs py-2">
            <Phone className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Qualification</span> Appels
          </TabsTrigger>
          <TabsTrigger value="parsing" className="flex items-center gap-1.5 text-xs py-2">
            <Mail className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Parsing</span> CV/Mails
          </TabsTrigger>
        </TabsList>

        <TabsContent value="interview" className="mt-4">
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Brain className="h-4 w-4 text-primary" />
                Module 1 — Analyse d'Entretien IA
              </CardTitle>
              <CardDescription>
                Évalue les compétences techniques, l'intelligence émotionnelle, la cohérence et la motivation.
                Détecte les signaux faibles et les red flags.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <InterviewAnalysisModule />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary" className="mt-4">
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-primary" />
                Module 2 — Résumé Professionnel Décisionnel
              </CardTitle>
              <CardDescription>
                Génère une note de synthèse en 3 points : profil global, point fort différenciant,
                risque majeur. Recommandation finale : RECRUTER / ENTRETIEN_COMPLEMENTAIRE / REJETER.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ProfessionalSummaryModule />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calls" className="mt-4">
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Phone className="h-4 w-4 text-primary" />
                Module 3 — Qualification Appels Entrants
              </CardTitle>
              <CardDescription>
                Extrait nom, entreprise et coordonnées. Détermine l'intention (Vente, Support, Réclamation,
                Administratif), évalue l'urgence et décide du transfert immédiat si nécessaire.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CallQualificationModule />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="parsing" className="mt-4">
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Mail className="h-4 w-4 text-primary" />
                Module 4 — Parsing CV / Mails de Candidature
              </CardTitle>
              <CardDescription>
                Extrait automatiquement : nom, email, téléphone, poste actuel, années d'expérience,
                top 5 compétences, niveau de formation. Si lettre de motivation présente : 3 arguments clés.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CVMailParsingModule />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Footer informatif */}
      <Card className="border-none bg-muted/30">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-start gap-3">
            <TrendingUp className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Servicall v2 — Intelligence Centrale</p>
              <p>
                Température IA : <strong>0.3</strong> pour l'analyse technique (précision maximale) ·
                <strong> 0.7</strong> pour les résumés et synthèses (créativité contrôlée).
                Toutes les réponses sont en <strong>JSON valide strict</strong>, 100% Français.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
