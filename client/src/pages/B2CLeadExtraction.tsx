/**
 * B2CLeadExtraction.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Vrai moteur B2C style iQualif — recherche de particuliers qualifiés
 * par critères sociodémographiques (âge, revenus, CSP, logement, famille)
 * et potentiel par secteur (immobilier, assurance, énergie, auto, etc.)
 *
 * Sources : INSEE, DGFiP, data.gouv.fr (données agrégées anonymes)
 * RGPD : Profils statistiques représentatifs — aucune donnée nominative réelle
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { Users, Target, TrendingUp, MapPin, Download, Filter,
  Loader2, CheckCircle2, BarChart3, Home, Euro, UserCheck,
  Briefcase, Heart, Zap, ChevronDown, ChevronUp, Info,
  Star, AlertCircle, Phone, User,
 } from 'lucide-react';
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ── Types ────────────────────────────────────────────────────────────────────

type AgeRange = "18-25" | "26-35" | "36-45" | "46-55" | "56-65" | "65+";
type IncomeLevel = "modeste" | "intermediaire" | "confortable" | "aise" | "fortune";
type CSP = "agriculteur" | "artisan_commercant" | "cadre_profession_liberale" |
  "profession_intermediaire" | "employe" | "ouvrier" | "retraite" | "sans_emploi";
type HousingType = "proprietaire" | "locataire" | "hlm" | "autre";
type FamilyStatus = "celibataire" | "en_couple" | "famille" | "senior_seul";

interface B2CProfile {
  _profileId: string;
  _codePostal: string;
  _departement: string;
  ville: string;
  latitude?: number;
  longitude?: number;
  population: number;
  densite: "rural" | "periurbain" | "urbain" | "metropole";
  ageRange: AgeRange;
  csp: CSP;
  incomeLevel: IncomeLevel;
  revenuMedianAnnuel: number;
  housingType: HousingType;
  familyStatus: FamilyStatus;
  nbEnfants: "0" | "1" | "2" | "3+";
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  interests: Array<{ category: string; score: number; signals: string[] }>;
  qualificationScore: number;
  qualificationLabel: "chaud" | "tiede" | "froid";
  potentialByVertical: Record<string, number>;
  tauxChomageLocal: number;
  tauxProprietairesLocal: number;
  revenuFiscalMedian: number;
  indexPrecarite: number;
}

// ── Helpers visuels ──────────────────────────────────────────────────────────

const INCOME_COLORS: Record<IncomeLevel, string> = {
  modeste:       "bg-red-100 text-red-700 border-red-200",
  intermediaire: "bg-orange-100 text-orange-700 border-orange-200",
  confortable:   "bg-yellow-100 text-yellow-700 border-yellow-200",
  aise:          "bg-green-100 text-green-700 border-green-200",
  fortune:       "bg-purple-100 text-purple-700 border-purple-200",
};

const INCOME_LABELS: Record<IncomeLevel, string> = {
  modeste: "Modeste", intermediaire: "Intermédiaire", confortable: "Confortable",
  aise: "Aisé", fortune: "Fortuné",
};

const QUAL_COLORS: Record<string, string> = {
  chaud:  "bg-red-500",
  tiede:  "bg-orange-400",
  froid:  "bg-blue-400",
};

const VERTICAL_ICONS: Record<string, string> = {
  immobilier: "🏠", assurance: "🛡️", energie_renovation: "⚡",
  automobile: "🚗", credit_finance: "💳", sante_mutuelle: "🏥",
  formation_emploi: "📚", voyage_loisirs: "✈️", ecommerce_mode: "🛒",
};

const VERTICAL_LABELS: Record<string, string> = {
  immobilier: "Immobilier", assurance: "Assurance", energie_renovation: "Énergie/Réno",
  automobile: "Auto", credit_finance: "Crédit", sante_mutuelle: "Santé",
  formation_emploi: "Formation", voyage_loisirs: "Voyage", ecommerce_mode: "E-commerce",
};

const CSP_LABELS: Record<CSP, string> = {
  cadre_profession_liberale: "Cadre / Prof. lib.", profession_intermediaire: "Prof. intermédiaire",
  employe: "Employé", ouvrier: "Ouvrier", artisan_commercant: "Artisan/Commerçant",
  agriculteur: "Agriculteur", retraite: "Retraité", sans_emploi: "Sans emploi",
};

const HOUSING_LABELS: Record<HousingType, string> = {
  proprietaire: "Propriétaire 🏠", locataire: "Locataire 🔑", hlm: "HLM 🏢", autre: "Autre",
};

function ScoreBar({ score, color }: { score: number; color?: string }) {
  return (
    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
      <div
        className={cn("h-full rounded-full transition-all", color ?? "bg-violet-500")}
        style={{ width: `${score}%` }}
      />
    </div>
  );
}

// ── Carte de profil B2C ──────────────────────────────────────────────────────

function B2CProfileCard({
  profile, selected, onToggle, showDetails,
}: {
  profile: B2CProfile;
  selected: boolean;
  onToggle: () => void;
  showDetails: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const topInterest = profile.interests[0];
  const _topVertical = Object.entries(profile.potentialByVertical)
    .sort((a, b) => b[1] - a[1])[0];

  return (
    <div
      className={cn(
        "relative rounded-xl border-2 transition-all cursor-pointer select-none",
        selected ? "border-violet-500 bg-violet-50/50 shadow-sm" : "border-slate-200 hover:border-slate-300",
        profile.qualificationLabel === "chaud" && "border-l-4 border-l-red-400",
        profile.qualificationLabel === "tiede" && "border-l-4 border-l-orange-400",
      )}
      onClick={onToggle}
    >
      {/* Header */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {/* Checkbox */}
            <div className={cn(
              "w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all",
              selected ? "border-violet-500 bg-violet-500" : "border-slate-300"
            )}>
              {selected && <CheckCircle2 size={10} className="text-white" />}
            </div>

            {/* Score badge */}
            <div className="flex items-center gap-1.5">
              <div className={cn("w-2 h-2 rounded-full", QUAL_COLORS[profile.qualificationLabel])} />
              <span className="text-xs font-black text-slate-700">{profile.qualificationScore}/100</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            <Badge variant="outline" className="text-[10px] h-4.5 bg-violet-100 text-violet-700 border-violet-200">
              {profile.firstName} {profile.lastName}
            </Badge>
            <Badge variant="outline" className={cn("text-[10px] h-4.5", INCOME_COLORS[profile.incomeLevel])}>
              {INCOME_LABELS[profile.incomeLevel]}
            </Badge>
            <Badge variant="outline" className="text-[10px] h-4.5 bg-slate-50">
              {profile.ageRange} ans
            </Badge>
          </div>
        </div>

        {/* Infos principales */}
        <div className="mt-2 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <User size={10} className="text-violet-500 flex-shrink-0" />
            <span className="font-bold text-slate-800">{profile.firstName} {profile.lastName}</span>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <Phone size={10} className="text-green-500 flex-shrink-0" />
            <span className="font-bold text-slate-700">{profile.phone}</span>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <MapPin size={10} className="text-slate-400 flex-shrink-0" />
            <span className="font-semibold">{profile.address}, {profile.ville}</span>
            <span className="text-slate-400">{profile._codePostal}</span>
            <Badge variant="outline" className="text-[9px] h-3.5 bg-slate-50 text-slate-500">
              {profile.densite}
            </Badge>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <Briefcase size={10} className="text-slate-400 flex-shrink-0" />
            <span>{CSP_LABELS[profile.csp]}</span>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <Home size={10} className="text-slate-400 flex-shrink-0" />
            <span>{HOUSING_LABELS[profile.housingType]}</span>
            <span className="text-slate-400">·</span>
            <span>{profile.familyStatus === "famille" ? `Famille (${profile.nbEnfants} enf.)` :
              profile.familyStatus === "senior_seul" ? "Senior seul(e)" :
              profile.familyStatus.replace("_", " ")}</span>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <Euro size={10} className="text-green-500 flex-shrink-0" />
            <span className="font-semibold text-green-700">
              {profile.revenuMedianAnnuel.toLocaleString("fr-FR")}€/an
            </span>
            <span className="text-slate-400 text-[10px]">
              ({Math.round(profile.revenuMedianAnnuel / 12).toLocaleString("fr-FR")}€/mois)
            </span>
          </div>
        </div>

        {/* Top intérêt + vertical */}
        {topInterest && (
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[10px] text-slate-500">
                  🎯 {VERTICAL_LABELS[topInterest.category] ?? topInterest.category}
                </span>
                <span className="text-[10px] font-bold text-violet-600">{topInterest.score}%</span>
              </div>
              <ScoreBar score={topInterest.score} />
            </div>
          </div>
        )}

        {/* Expand button */}
        {showDetails && (
          <button
            onClick={(e: any) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="mt-2 w-full flex items-center justify-center gap-1 text-[10px] text-slate-400 hover:text-violet-500"
          >
            {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            {expanded ? "Moins" : "Détails"}
          </button>
        )}
      </div>

      {/* Détails expandés */}
      {expanded && (
        <div className="border-t border-slate-100 p-3 space-y-3" onClick={e => e.stopPropagation()}>
          {/* Potentiel par vertical */}
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
              Potentiel par secteur
            </p>
            <div className="space-y-1.5">
              {Object.entries(profile.potentialByVertical)
                .sort((a, b) => b[1] - a[1])
                .map(([vertical, score]) => (
                  <div key={vertical} className="flex items-center gap-2">
                    <span className="text-xs w-3">{VERTICAL_ICONS[vertical]}</span>
                    <span className="text-[10px] text-slate-500 w-24 truncate">
                      {VERTICAL_LABELS[vertical]}
                    </span>
                    <div className="flex-1">
                      <ScoreBar score={score} color={score >= 70 ? "bg-green-500" : score >= 45 ? "bg-yellow-500" : "bg-slate-300"} />
                    </div>
                    <span className="text-[10px] font-semibold text-slate-600 w-6 text-right">{score}</span>
                  </div>
                ))}
            </div>
          </div>

          {/* Données contextuelles */}
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="bg-slate-50 rounded-lg p-2">
              <p className="text-slate-400">Taux propriétaires local</p>
              <p className="font-bold text-slate-700">{profile.tauxProprietairesLocal}%</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-2">
              <p className="text-slate-400">Taux chômage local</p>
              <p className={cn("font-bold", profile.tauxChomageLocal > 12 ? "text-red-600" : "text-slate-700")}>
                {profile.tauxChomageLocal}%
              </p>
            </div>
            <div className="bg-slate-50 rounded-lg p-2">
              <p className="text-slate-400">Revenu fiscal médian</p>
              <p className="font-bold text-slate-700">{profile.revenuFiscalMedian.toLocaleString("fr-FR")}€</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-2">
              <p className="text-slate-400">Indice précarité</p>
              <p className={cn("font-bold", profile.indexPrecarite > 60 ? "text-red-600" : profile.indexPrecarite > 35 ? "text-orange-600" : "text-green-600")}>
                {profile.indexPrecarite}/100
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Panneau de filtres B2C ───────────────────────────────────────────────────

function MultiSelectChips<T extends string>({
  options, selected, onChange, label,
}: {
  options: Array<{ value: T; label: string; color?: string }>;
  selected: T[];
  onChange: (v: T[]) => void;
  label: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-slate-600">{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {options.map(opt => {
          const isSelected = selected.includes(opt.value);
          return (
            <button
              key={opt.value}
              onClick={() => onChange(
                isSelected ? selected.filter((v: any) => v !== opt.value) : [...selected, opt.value]
              )}
              className={cn(
                "text-[11px] px-2.5 py-1 rounded-full border transition-all",
                isSelected
                  ? "border-violet-500 bg-violet-100 text-violet-700 font-semibold"
                  : "border-slate-200 text-slate-500 hover:border-slate-300"
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Page principale ──────────────────────────────────────────────────────────

export function B2CLeadExtractionPage() {
  const [location, setLocation] = useState("");
  const [ageRanges, setAgeRanges] = useState<AgeRange[]>([]);
  const [incomeLevels, setIncomeLevels] = useState<IncomeLevel[]>([]);
  const [csps, setCsps] = useState<CSP[]>([]);
  const [housingTypes, setHousingTypes] = useState<HousingType[]>([]);
  const [familyStatuses, setFamilyStatuses] = useState<FamilyStatus[]>([]);
  const [vertical, setVertical] = useState<string>("");
  const [minVerticalScore, setMinVerticalScore] = useState(50);
  const [minQualScore, setMinQualScore] = useState(40);
  const [maxResults, setMaxResults] = useState(50);
  const [showDetails, setShowDetails] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<B2CProfile[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [filtersOpen, setFiltersOpen] = useState(true);

  const { data: criteria } = trpc.aiAutomation.b2cLeadExtraction.getCriteria.useQuery();

  const searchMutation = trpc.aiAutomation.b2cLeadExtraction.search.useMutation({
    onMutate: () => { setResults([]); setSelected(new Set()); setStats(null); },
    onSuccess: (data: any) => {
      const profiles = (data as any)?.profiles ?? (data as any)?.data?.profiles ?? [];
      setResults(profiles as B2CProfile[]);
      setStats((data as any).stats ?? null);
      if ((data as any).error) toast.warning((data as any).error);
      else if (((data as any).total ?? 0) === 0) toast.info("Aucun profil — élargissez les critères");
      else toast.success(`${(data as any).total} profil(s) B2C trouvé(s) — ${(data as any).communesAnalysees} commune(s) analysée(s)`);
    },
    onError: (err) => toast.error(err.message),
  });

  const importMutation = trpc.aiAutomation.b2cLeadExtraction.importProspects.useMutation({
    onSuccess: (data: any) => {
      toast.success(`✅ ${data.imported} profil(s) importé(s) dans le CRM — ${data.skipped} doublon(s)`);
      setSelected(new Set());
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSearch = () => {
    if (!location.trim()) { toast.error("Entrez une localisation"); return; }
    searchMutation.mutate({
      location: location.trim(),
      ageRanges: ageRanges.length ? ageRanges : undefined,
      incomeLevels: incomeLevels.length ? incomeLevels : undefined,
      csps: csps.length ? csps : undefined,
      housingTypes: housingTypes.length ? housingTypes : undefined,
      familyStatuses: familyStatuses.length ? familyStatuses : undefined,
      vertical: vertical ? vertical as any : undefined,
      minVerticalScore: vertical ? minVerticalScore : undefined,
      minQualificationScore: minQualScore > 0 ? minQualScore : undefined,
      maxResults,
    });
  };

  const toggleProfile = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === results.length) setSelected(new Set());
    else setSelected(new Set(results.map((p: any) => p._profileId)));
  };

  const handleImport = () => {
    const toImport = results.filter((p: any) => selected.has(p._profileId));
    importMutation.mutate({ profiles: toImport as any });
  };

  const QUICK_LOCATIONS = [
    { label: "Paris", icon: "🗼" },
    { label: "Lyon", icon: "🦁" },
    { label: "Marseille", icon: "⛵" },
    { label: "Bordeaux", icon: "🍷" },
    { label: "Île-de-France", icon: "🏙️" },
    { label: "Nord", icon: "⛏️" },
    { label: "93", icon: "🏙️" },
    { label: "06", icon: "☀️" },
  ];

  return (
    <div className="space-y-4" data-main-content>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black flex items-center gap-2">
            <Users size={22} className="text-violet-600" />
            Extraction B2C — Particuliers Qualifiés
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Moteur de ciblage sociodémographique basé sur les données INSEE, DGFiP et data.gouv.fr
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-green-500 text-white text-xs gap-1">
            <CheckCircle2 size={10} /> 100% légal
          </Badge>
          <Badge variant="outline" className="text-xs gap-1 text-slate-500">
            <Info size={10} /> Données agrégées INSEE
          </Badge>
        </div>
      </div>

      {/* Bandeau RGPD */}
      <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700">
        <Info size={14} className="flex-shrink-0 mt-0.5" />
        <div>
          <strong>Sources légales :</strong> INSEE Recensement, DGFiP revenus fiscaux, data.gouv.fr.
          Les profils générés sont des <strong>personas statistiques représentatifs</strong> basés sur
          des données agrégées par commune. Aucune donnée nominative n'est utilisée.
          Conforme RGPD — pas de traitement de données personnelles.
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px,1fr] gap-4">

        {/* ── Panneau de filtres ─────────────────────────────────────────── */}
        <div className="space-y-3">
          <Card className="border-violet-200">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Filter size={14} className="text-violet-500" />
                  Critères de ciblage
                </CardTitle>
                <button onClick={() => setFiltersOpen(!filtersOpen)}
                  className="text-slate-400 hover:text-slate-600">
                  {filtersOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>
            </CardHeader>

            {filtersOpen && (
              <CardContent className="space-y-4 pt-0">
                {/* Localisation */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-600">
                    <MapPin size={11} className="inline mr-1" />
                    Localisation *
                  </Label>
                  <Input
                    placeholder="Paris, Lyon, 93, Île-de-France..."
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleSearch()}
                    className="h-8 text-sm"
                  />
                  <div className="flex flex-wrap gap-1">
                    {QUICK_LOCATIONS.map(q => (
                      <button key={q.label}
                        onClick={() => setLocation(q.label)}
                        className="text-[10px] px-2 py-0.5 rounded-full border border-slate-200 hover:border-violet-300 hover:bg-violet-50 transition-colors">
                        {q.icon} {q.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Secteur cible */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-600">
                    <Target size={11} className="inline mr-1" />
                    Secteur cible
                  </Label>
                  <Select value={vertical} onValueChange={setVertical}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Tous les secteurs" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les secteurs</SelectItem>
                      {criteria?.verticals.map((v: any) => (
                        <SelectItem key={v.value} value={v.value}>
                          {v.icon} {v.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {vertical && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span>Score minimum</span>
                        <span className="font-bold">{minVerticalScore}%</span>
                      </div>
                      <Slider
                        value={[minVerticalScore]}
                        onValueChange={([v]) => setMinVerticalScore(v)}
                        min={0} max={100} step={5}
                        className="w-full"
                      />
                    </div>
                  )}
                </div>

                {/* Âges */}
                {criteria && (
                  <MultiSelectChips
                    label="🎂 Tranches d'âge"
                    options={criteria.ageRanges}
                    selected={ageRanges}
                    onChange={setAgeRanges as any}
                  />
                )}

                {/* Revenus */}
                {criteria && (
                  <MultiSelectChips
                    label="💰 Niveau de revenus"
                    options={criteria.incomeLevels}
                    selected={incomeLevels}
                    onChange={setIncomeLevels as any}
                  />
                )}

                {/* CSP */}
                {criteria && (
                  <MultiSelectChips
                    label="💼 CSP"
                    options={criteria.csps}
                    selected={csps}
                    onChange={setCsps as any}
                  />
                )}

                {/* Logement */}
                {criteria && (
                  <MultiSelectChips
                    label="🏠 Type de logement"
                    options={criteria.housingTypes}
                    selected={housingTypes}
                    onChange={setHousingTypes as any}
                  />
                )}

                {/* Statut familial */}
                {criteria && (
                  <MultiSelectChips
                    label="👨‍👩‍👧 Situation familiale"
                    options={criteria.familyStatuses}
                    selected={familyStatuses}
                    onChange={setFamilyStatuses as any}
                  />
                )}

                {/* Score minimum */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-slate-600">
                      <Star size={11} className="inline mr-1" />
                      Score qualification min.
                    </Label>
                    <span className="text-xs font-bold text-violet-600">{minQualScore}/100</span>
                  </div>
                  <Slider
                    value={[minQualScore]}
                    onValueChange={([v]) => setMinQualScore(v)}
                    min={0} max={90} step={5}
                    className="w-full"
                  />
                  <div className="flex justify-between text-[9px] text-slate-400">
                    <span>Tous</span><span>Chauds uniquement</span>
                  </div>
                </div>

                {/* Nombre max résultats */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-slate-600">
                      Profils max
                    </Label>
                    <span className="text-xs font-bold">{maxResults}</span>
                  </div>
                  <Slider
                    value={[maxResults]}
                    onValueChange={([v]) => setMaxResults(v)}
                    min={10} max={200} step={10}
                  />
                </div>

                {/* Options */}
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-slate-600">Afficher les détails</Label>
                  <Switch checked={showDetails} onCheckedChange={setShowDetails} />
                </div>

                {/* Bouton recherche */}
                <Button
                  className="w-full bg-violet-600 hover:bg-violet-700 gap-2"
                  onClick={handleSearch}
                  disabled={searchMutation.isPending}
                >
                  {searchMutation.isPending
                    ? <><Loader2 size={14} className="animate-spin" />Analyse en cours…</>
                    : <><Users size={14} />Trouver des profils B2C</>}
                </Button>

                {/* Reset */}
                {(ageRanges.length || incomeLevels.length || csps.length || housingTypes.length || familyStatuses.length || vertical) && (
                  <button
                    onClick={() => { setAgeRanges([]); setIncomeLevels([]); setCsps([]); setHousingTypes([]); setFamilyStatuses([]); setVertical(""); }}
                    className="w-full text-xs text-slate-400 hover:text-slate-600 underline"
                  >
                    Réinitialiser les filtres
                  </button>
                )}
              </CardContent>
            )}
          </Card>
        </div>

        {/* ── Résultats ──────────────────────────────────────────────────── */}
        <div className="space-y-3">
          {/* Stats panel */}
          {stats && results.length > 0 && (
            <Card className="border-violet-100 bg-gradient-to-r from-violet-50/50 to-transparent">
              <CardContent className="pt-3 pb-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="text-center">
                    <p className="text-2xl font-black text-violet-600">{results.length}</p>
                    <p className="text-[10px] text-slate-500">Profils trouvés</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-black text-green-600">{stats.avgQualificationScore}</p>
                    <p className="text-[10px] text-slate-500">Score moyen</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-black text-orange-500">
                      {results.filter((p: any) => p.qualificationLabel === "chaud").length}
                    </p>
                    <p className="text-[10px] text-slate-500">Profils chauds 🔥</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-black text-blue-500">
                      {stats.topInterests[0]
                        ? `${stats.topInterests[0].avgScore}%`
                        : "—"}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {stats.topInterests[0]
                        ? `Top: ${VERTICAL_LABELS[stats.topInterests[0].interest] ?? stats.topInterests[0].interest}`
                        : "Top intérêt"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Barre d'actions */}
          {results.length > 0 && (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-700">
                  {results.length} profil(s)
                </span>
                {vertical && (
                  <Badge variant="outline" className="text-xs">
                    {VERTICAL_ICONS[vertical]} {VERTICAL_LABELS[vertical]}
                  </Badge>
                )}
                <button
                  onClick={toggleAll}
                  className="text-xs text-slate-400 hover:text-violet-600 underline underline-offset-2"
                >
                  {selected.size === results.length ? "Tout désélectionner" : "Tout sélectionner"}
                </button>
              </div>

              {selected.size > 0 && (
                <Button
                  size="sm"
                  className="gap-1.5 bg-green-600 hover:bg-green-700 h-8"
                  onClick={handleImport}
                  disabled={importMutation.isPending}
                >
                  {importMutation.isPending
                    ? <Loader2 size={12} className="animate-spin" />
                    : <Download size={12} />}
                  Importer {selected.size} profil(s) dans le CRM
                </Button>
              )}
            </div>
          )}

          {/* Grille de profils */}
          {results.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {results.map(profile => (
                <B2CProfileCard
                  key={profile._profileId}
                  profile={profile}
                  selected={selected.has(profile._profileId)}
                  onToggle={() => toggleProfile(profile._profileId)}
                  showDetails={showDetails}
                />
              ))}
            </div>
          ) : searchMutation.isSuccess && !searchMutation.isPending ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
              <Users size={40} className="mb-3 opacity-20" />
              <p className="text-sm font-semibold text-slate-600">Aucun profil</p>
              <p className="text-xs mt-1 text-center max-w-xs">
                Essayez d'élargir les critères : supprimez des filtres ou abaissez le score minimum
              </p>
            </div>
          ) : !searchMutation.isPending ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-300 bg-slate-50/50 rounded-xl border-2 border-dashed border-slate-100">
              <Target size={48} className="mb-4 opacity-30" />
              <p className="text-base font-semibold text-slate-400">Définissez vos critères</p>
              <p className="text-sm text-slate-400 mt-1 text-center max-w-sm">
                Sélectionnez une localisation et vos critères de ciblage, puis lancez la recherche
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {[
                  { label: "Propriétaires 40-55 ans", icon: "🏠" },
                  { label: "Cadres Île-de-France", icon: "💼" },
                  { label: "Seniors Loire-Atlantique", icon: "👴" },
                  { label: "Familles périurbaines", icon: "👨‍👩‍👧" },
                ].map(ex => (
                  <Badge key={ex.label} variant="outline" className="text-xs cursor-default opacity-60">
                    {ex.icon} {ex.label}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}

          {/* Sticky import bar */}
          {selected.size > 0 && (
            <div className="sticky bottom-4 bg-white/95 backdrop-blur border border-violet-200 rounded-xl p-3 flex items-center justify-between shadow-lg z-10">
              <div>
                <span className="text-sm font-semibold text-violet-700">
                  {selected.size} profil(s) sélectionné(s)
                </span>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Seront créés comme prospects dans votre CRM
                </p>
              </div>
              <Button
                size="sm"
                className="gap-1.5 bg-violet-600 hover:bg-violet-700"
                onClick={handleImport}
                disabled={importMutation.isPending}
              >
                {importMutation.isPending
                  ? <Loader2 size={13} className="animate-spin" />
                  : <Zap size={13} />}
                Importer dans le CRM
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default B2CLeadExtractionPage;
