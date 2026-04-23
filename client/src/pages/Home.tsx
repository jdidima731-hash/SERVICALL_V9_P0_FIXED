/**
 * Home Page — Landing Page Servicall
 * Plateforme complète : Dialer IA, CRM, Lead Extraction, Workflows,
 * Recrutement, Formation, Réseaux Sociaux + WhatsApp IA (feature additionnelle)
 */

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Phone, Users, BarChart3, ArrowRight, Zap, MessageSquare,
  Lock, CheckCircle, Rocket, Database, Brain, Workflow,
  Mail, TrendingUp, GraduationCap, Key, CreditCard,
  Settings, ChevronRight, Shield, Smartphone, Send,
  Mic, Target, UserCheck, Share2, Calendar, Headphones,
  PlayCircle, Search, Star, Building2, Layers
} from 'lucide-react';
import { useEffect } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useAuth } from "@/_core/hooks/useAuth";

const WA_GREEN = "#25D366";

export default function Home() {
  const { t } = useTranslation('common');
  const { loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && isAuthenticated) setLocation("/dashboard");
  }, [loading, isAuthenticated, setLocation]);

  const handleStart = () => setLocation(isAuthenticated ? "/dashboard" : "/login");

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">{t('actions.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20">

      {/* ── Navigation ─────────────────────────────────────────────────────── */}
      <nav className="border-b bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary p-2 rounded-xl">
              <Phone className="h-6 w-6 text-white" />
            </div>
            <span className="text-2xl font-black tracking-tighter">
              SERVICALL<span className="text-primary">.</span>
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#platform"   className="hover:text-primary transition-colors">Plateforme</a>
            <a href="#modules"    className="hover:text-primary transition-colors">Modules</a>
            <a href="#segments"   className="hover:text-primary transition-colors">Secteurs</a>
            <a href="#pricing"    className="hover:text-primary transition-colors">Tarifs</a>
          </div>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <Button variant="ghost" className="hidden sm:flex" onClick={handleStart}>
              {isAuthenticated ? "Dashboard" : "Connexion"}
            </Button>
            <Button className="rounded-full px-6 shadow-lg shadow-primary/20" onClick={handleStart}>
              {isAuthenticated ? "Dashboard" : "Démarrer"}
            </Button>
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="relative pt-20 pb-32 overflow-hidden">
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[140px]" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-blue-400/5 rounded-full blur-[100px]" />
        </div>

        <div className="container mx-auto px-4 text-center space-y-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-bold">
            <Rocket className="h-4 w-4" />
            <span>CRM + Dialer IA + Extraction + Workflows + Recrutement + Réseaux Sociaux</span>
          </div>

          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight leading-[0.9] max-w-6xl mx-auto">
            La plateforme tout-en-un pour{" "}
            <span className="text-primary">vendre plus</span>{" "}
            et mieux gérer vos clients
          </h1>

          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Servicall centralise votre prospection, vos appels IA, votre CRM, vos workflows,
            le recrutement, la formation et vos réseaux sociaux — dans une seule plateforme assistée par l'IA.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
            <Button size="lg" className="h-16 px-10 text-xl rounded-full shadow-2xl shadow-primary/30 group" onClick={handleStart}>
              {isAuthenticated ? "Aller au Dashboard" : "Démarrer Gratuitement"}
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button size="lg" variant="outline" className="h-16 px-10 text-xl rounded-full" onClick={() => setLocation("/marketplace")}>
              Voir une démo
            </Button>
          </div>

          {/* Pills résumé modules */}
          <div className="pt-10 flex flex-wrap justify-center gap-3">
            {[
              { icon: <Mic className="h-3.5 w-3.5" />,      label: "Dialer IA" },
              { icon: <Search className="h-3.5 w-3.5" />,   label: "Lead Extraction" },
              { icon: <Users className="h-3.5 w-3.5" />,    label: "CRM Avancé" },
              { icon: <Workflow className="h-3.5 w-3.5" />, label: "Workflows No-Code" },
              { icon: <Share2 className="h-3.5 w-3.5" />,   label: "Réseaux Sociaux IA" },
              { icon: <UserCheck className="h-3.5 w-3.5" />,label: "Recrutement IA" },
              { icon: <GraduationCap className="h-3.5 w-3.5" />, label: "Formation" },
              { icon: <Smartphone className="h-3.5 w-3.5" style={{ color: WA_GREEN }} />, label: "WhatsApp IA" },
            ].map(({ icon, label }) => (
              <div key={label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-sm font-medium text-muted-foreground">
                {icon}{label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats ──────────────────────────────────────────────────────────── */}
      <section className="bg-primary py-16 text-primary-foreground">
        <div className="container mx-auto px-4 grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
          {[
            { val: "60+",   label: "Actions workflow disponibles" },
            { val: "10",    label: "Modules métier intégrés" },
            { val: "100%",  label: "Chiffré AES-256" },
            { val: "24/7",  label: "Agents IA disponibles" },
          ].map(({ val, label }) => (
            <div key={label} className="space-y-2">
              <div className="text-4xl md:text-5xl font-black">{val}</div>
              <div className="text-primary-foreground/70 font-medium">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Plateforme overview ─────────────────────────────────────────────── */}
      <section id="platform" className="py-32 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center space-y-4 mb-20">
            <h2 className="text-sm font-black uppercase tracking-widest text-primary">Vue d'ensemble</h2>
            <p className="text-4xl md:text-5xl font-black tracking-tight">
              Tout ce qu'il faut pour développer votre business
            </p>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              De la génération de leads jusqu'au suivi client, en passant par les appels IA et la gestion d'équipe — une seule plateforme, zéro outil externe.
            </p>
          </div>

          {/* 3 piliers principaux */}
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            {[
              {
                icon: <Target className="h-10 w-10 text-blue-500" />,
                bg: "bg-blue-500/10",
                title: "Prospecter & Vendre plus",
                desc: "Dialer prédictif IA, extracteur de leads automatisé, campagnes multi-canal, scoring prédictif. Votre pipeline toujours plein.",
                items: ["Dialer IA prédictif", "Extraction Google Maps / Pages Jaunes / CSV", "Campagnes SMS, appels, WhatsApp", "Scoring et qualification automatique"],
              },
              {
                icon: <Brain className="h-10 w-10 text-purple-500" />,
                bg: "bg-purple-500/10",
                title: "Gérer & Fidéliser vos clients",
                desc: "CRM complet avec mémoire IA, workflows automatisés, agenda, messagerie unifiée et vue 360° par prospect.",
                items: ["CRM prospects & clients", "Mémoire IA par contact", "Workflows no-code visuels", "Messagerie unifiée (email, SMS, WhatsApp)"],
              },
              {
                icon: <GraduationCap className="h-10 w-10 text-green-500" />,
                bg: "bg-green-500/10",
                title: "Développer & Piloter votre équipe",
                desc: "Recrutement assisté IA, coaching et formation des agents, monitoring en temps réel, rapports hebdomadaires.",
                items: ["Recrutement IA avec entretiens automatisés", "Formation et coaching des agents", "Monitoring IA temps réel", "Rapports & KPIs hebdomadaires"],
              },
            ].map(({ icon, bg, title, desc, items }) => (
              <div key={title} className="rounded-3xl border-2 p-8 bg-background hover:shadow-xl transition-shadow space-y-6">
                <div className={`w-16 h-16 ${bg} rounded-2xl flex items-center justify-center`}>{icon}</div>
                <h3 className="text-2xl font-black">{title}</h3>
                <p className="text-muted-foreground">{desc}</p>
                <ul className="space-y-2">
                  {items.map(i => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span>{i}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Modules détaillés ──────────────────────────────────────────────── */}
      <section id="modules" className="py-32 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center space-y-4 mb-20">
            <h2 className="text-sm font-black uppercase tracking-widest text-primary">Modules</h2>
            <p className="text-4xl md:text-5xl font-black tracking-tight">Chaque module, une puissance</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">

            {/* Dialer IA */}
            <Card className="border-2 border-primary/20 shadow-xl hover:-translate-y-2 transition-transform duration-300">
              <CardHeader className="space-y-4">
                <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center">
                  <Headphones className="h-8 w-8 text-primary" />
                </div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-xl font-bold">Dialer IA Prédictif</CardTitle>
                  <span className="px-2 py-0.5 bg-primary text-primary-foreground text-xs font-black rounded-full">CŒUR</span>
                </div>
                <CardDescription className="text-base">
                  Vos agents IA passent et reçoivent des appels, qualifient les prospects, détectent les objections et handoffent intelligemment aux humains. Transcription, scoring et coaching automatiques après chaque appel.
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Lead Extraction */}
            <Card className="border-none shadow-xl hover:-translate-y-2 transition-transform duration-300">
              <CardHeader className="space-y-4">
                <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center">
                  <Search className="h-8 w-8 text-blue-500" />
                </div>
                <CardTitle className="text-xl font-bold">Extracteur de Leads IA</CardTitle>
                <CardDescription className="text-base">
                  Trouvez automatiquement des prospects qualifiés sur Google Maps, Pages Jaunes et fichiers CSV. Enrichissement IA, déduplication, import direct dans le CRM.
                </CardDescription>
              </CardHeader>
            </Card>

            {/* CRM */}
            <Card className="border-none shadow-xl hover:-translate-y-2 transition-transform duration-300">
              <CardHeader className="space-y-4">
                <div className="w-14 h-14 bg-purple-500/10 rounded-2xl flex items-center justify-center">
                  <Users className="h-8 w-8 text-purple-500" />
                </div>
                <CardTitle className="text-xl font-bold">CRM avec Mémoire IA</CardTitle>
                <CardDescription className="text-base">
                  Vue 360° par prospect, historique complet des interactions, résumés automatiques par IA, suggestions de prochaines actions. Votre CRM qui pense avec vous.
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Workflows */}
            <Card className="border-none shadow-xl hover:-translate-y-2 transition-transform duration-300">
              <CardHeader className="space-y-4">
                <div className="w-14 h-14 bg-green-500/10 rounded-2xl flex items-center justify-center">
                  <Workflow className="h-8 w-8 text-green-500" />
                </div>
                <CardTitle className="text-xl font-bold">Workflows Visuels No-Code</CardTitle>
                <CardDescription className="text-base">
                  Éditeur drag-and-drop, 60+ actions disponibles (appel, SMS, email, condition, IA, délai…), blueprints par industrie, simulation avant déploiement.
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Campagnes */}
            <Card className="border-none shadow-xl hover:-translate-y-2 transition-transform duration-300">
              <CardHeader className="space-y-4">
                <div className="w-14 h-14 bg-orange-500/10 rounded-2xl flex items-center justify-center">
                  <Target className="h-8 w-8 text-orange-500" />
                </div>
                <CardTitle className="text-xl font-bold">Campagnes Multi-canal</CardTitle>
                <CardDescription className="text-base">
                  Lancez des campagnes d'appels prédictifs, SMS et WhatsApp en masse. Gestion des relances automatiques, A/B testing, analyse de performance.
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Réseaux Sociaux */}
            <Card className="border-none shadow-xl hover:-translate-y-2 transition-transform duration-300">
              <CardHeader className="space-y-4">
                <div className="w-14 h-14 bg-pink-500/10 rounded-2xl flex items-center justify-center">
                  <Share2 className="h-8 w-8 text-pink-500" />
                </div>
                <CardTitle className="text-xl font-bold">Réseaux Sociaux IA</CardTitle>
                <CardDescription className="text-base">
                  Planification et publication automatique, génération de contenu par IA, social listening, unified inbox pour tous vos réseaux depuis un seul endroit.
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Recrutement */}
            <Card className="border-none shadow-xl hover:-translate-y-2 transition-transform duration-300">
              <CardHeader className="space-y-4">
                <div className="w-14 h-14 bg-indigo-500/10 rounded-2xl flex items-center justify-center">
                  <UserCheck className="h-8 w-8 text-indigo-500" />
                </div>
                <CardTitle className="text-xl font-bold">Recrutement IA</CardTitle>
                <CardDescription className="text-base">
                  Entretiens téléphoniques automatisés, scoring des candidats, analyse de la voix et du contenu, rapport de synthèse pour chaque candidat.
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Formation */}
            <Card className="border-none shadow-xl hover:-translate-y-2 transition-transform duration-300">
              <CardHeader className="space-y-4">
                <div className="w-14 h-14 bg-teal-500/10 rounded-2xl flex items-center justify-center">
                  <GraduationCap className="h-8 w-8 text-teal-500" />
                </div>
                <CardTitle className="text-xl font-bold">Formation & Coaching Agents</CardTitle>
                <CardDescription className="text-base">
                  Analyse des transcriptions d'appels, scoring automatique, recommandations personnalisées par agent, modules de formation intégrés.
                </CardDescription>
              </CardHeader>
            </Card>

            {/* WhatsApp IA — feature additionnelle bien positionnée */}
            <Card className="border-none shadow-xl hover:-translate-y-2 transition-transform duration-300 relative overflow-hidden">
              <div className="absolute top-4 right-4 px-2 py-0.5 rounded-full text-xs font-black text-white"
                   style={{ backgroundColor: WA_GREEN }}>NOUVEAU</div>
              <CardHeader className="space-y-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                     style={{ backgroundColor: `${WA_GREEN}18` }}>
                  <Smartphone className="h-8 w-8" style={{ color: WA_GREEN }} />
                </div>
                <CardTitle className="text-xl font-bold">Agent WhatsApp IA</CardTitle>
                <CardDescription className="text-base">
                  En complément du dialer : votre agent répond aussi sur WhatsApp Business via Meta API directe. Prise de RDV, devis, relances — 24h/24 sur le canal préféré de vos clients.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* ── Dialer IA — section dédiée (cœur du produit) ─────────────────── */}
      <section className="py-32 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-bold mb-4">
                  <Mic className="h-4 w-4" /> Le cœur de Servicall
                </div>
                <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4">
                  Un dialer IA qui vend à votre place
                </h2>
                <p className="text-xl text-muted-foreground leading-relaxed">
                  Vos agents IA passent des dizaines d'appels simultanés, qualifient les prospects, répondent aux objections et transfèrent les deals chauds à vos commerciaux humains en temps réel.
                </p>
              </div>
              <div className="space-y-4">
                {[
                  { icon: <PlayCircle className="h-5 w-5 text-primary" />, title: "Appels sortants prédictifs", desc: "L'IA détecte le meilleur moment pour appeler et optimise le taux de décroché." },
                  { icon: <Brain className="h-5 w-5 text-purple-500" />,   title: "Qualification intelligente", desc: "Scoring automatique de chaque prospect en temps réel pendant l'appel." },
                  { icon: <Headphones className="h-5 w-5 text-blue-500" />, title: "Handoff humain instantané", desc: "Dès qu'un prospect est chaud, transfert immédiat vers votre commercial." },
                  { icon: <BarChart3 className="h-5 w-5 text-orange-500" />, title: "Transcription & coaching", desc: "Chaque appel analysé, scoré, avec recommandations pour progresser." },
                ].map(({ icon, title, desc }) => (
                  <div key={title} className="flex gap-4 p-4 rounded-2xl bg-background border hover:shadow-md transition-shadow">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-muted flex items-center justify-center">{icon}</div>
                    <div>
                      <h3 className="font-bold">{title}</h3>
                      <p className="text-muted-foreground text-sm">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Softphone mockup */}
            <div className="flex justify-center">
              <div className="w-80 rounded-3xl bg-gray-900 shadow-2xl overflow-hidden border border-gray-700">
                <div className="px-6 py-4 bg-gray-800 flex items-center justify-between">
                  <span className="text-white font-bold text-sm">Servicall Dialer</span>
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  <div className="bg-gray-800 rounded-2xl p-4 text-center">
                    <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Users className="h-8 w-8 text-primary" />
                    </div>
                    <div className="text-white font-bold">Martin Dupont</div>
                    <div className="text-green-400 text-sm">● En cours — 02:34</div>
                  </div>
                  <div className="bg-gray-800 rounded-xl p-3 space-y-2">
                    <div className="text-gray-400 text-xs font-bold uppercase">IA Score en temps réel</div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full" style={{ width: "78%" }} />
                      </div>
                      <span className="text-green-400 text-sm font-bold">78%</span>
                    </div>
                    <div className="text-gray-400 text-xs">Prospect qualifié — Budget confirmé</div>
                  </div>
                  <div className="bg-gray-800 rounded-xl p-3 space-y-1">
                    <div className="text-gray-400 text-xs font-bold uppercase">Transcription live</div>
                    <p className="text-gray-300 text-xs">"…oui je suis intéressé, vous pouvez m'envoyer une offre…"</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {["Mute", "Transfer", "🔥 Hot"].map(a => (
                      <button key={a} className={`py-2 rounded-xl text-xs font-bold ${a === "🔥 Hot" ? "bg-primary text-white" : "bg-gray-700 text-gray-300"}`}>{a}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Extraction + CRM ───────────────────────────────────────────────── */}
      <section className="py-32 bg-background">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Lead extraction */}
            <div className="rounded-3xl bg-muted/50 border p-8 space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center">
                  <Search className="h-6 w-6 text-blue-500" />
                </div>
                <h3 className="text-2xl font-black">Extraction de Leads</h3>
              </div>
              <div className="space-y-3">
                {[
                  { source: "Google Maps", count: "2 847 leads", status: "✅ Importés" },
                  { source: "Pages Jaunes", count: "1 203 leads", status: "✅ Enrichis" },
                  { source: "Fichier CSV",  count: "500 leads",   status: "🔄 En cours" },
                ].map(({ source, count, status }) => (
                  <div key={source} className="flex items-center justify-between bg-background rounded-xl px-4 py-3 border">
                    <div>
                      <div className="font-semibold text-sm">{source}</div>
                      <div className="text-muted-foreground text-xs">{count}</div>
                    </div>
                    <div className="text-sm font-medium">{status}</div>
                  </div>
                ))}
              </div>
              <p className="text-muted-foreground text-sm">Import automatique, enrichissement IA, déduplication, qualification — directement dans votre CRM.</p>
            </div>

            {/* CRM 360 */}
            <div className="space-y-6">
              <div>
                <h2 className="text-4xl font-black tracking-tight mb-4">
                  Un CRM qui connaît vos clients mieux que vous
                </h2>
                <p className="text-xl text-muted-foreground leading-relaxed">
                  L'IA mémorise chaque interaction, résume l'historique et vous suggère la prochaine action optimale pour chaque prospect.
                </p>
              </div>
              {[
                { icon: <Brain className="h-5 w-5 text-purple-500" />, title: "Mémoire IA par contact", desc: "Résumé automatique de chaque échange. L'agent sait toujours où en est la relation." },
                { icon: <Calendar className="h-5 w-5 text-blue-500" />, title: "Vue 360° et agenda intégré", desc: "Appels, emails, WhatsApp, RDV — tout l'historique d'un client en un coup d'œil." },
                { icon: <TrendingUp className="h-5 w-5 text-green-500" />, title: "Scoring prédictif", desc: "L'IA identifie vos prospects les plus chauds et priorise votre pipeline." },
              ].map(({ icon, title, desc }) => (
                <div key={title} className="flex gap-4 p-4 rounded-2xl border hover:shadow-md transition-shadow">
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-muted flex items-center justify-center">{icon}</div>
                  <div>
                    <h3 className="font-bold">{title}</h3>
                    <p className="text-muted-foreground text-sm">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Réseaux Sociaux + Recrutement + Formation ──────────────────────── */}
      <section className="py-32 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center space-y-4 mb-20">
            <h2 className="text-sm font-black uppercase tracking-widest text-primary">Au-delà du CRM</h2>
            <p className="text-4xl md:text-5xl font-black tracking-tight">Gérez aussi votre équipe et votre image</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <Share2 className="h-8 w-8 text-pink-500" />, bg: "bg-pink-500/10",
                title: "Réseaux Sociaux IA",
                points: [
                  "Planification & publication automatique",
                  "Génération de contenu par IA",
                  "Social listening & veille",
                  "Unified inbox multicanal",
                  "Analytics de performance",
                ],
              },
              {
                icon: <UserCheck className="h-8 w-8 text-indigo-500" />, bg: "bg-indigo-500/10",
                title: "Recrutement IA",
                points: [
                  "Entretiens téléphoniques automatisés",
                  "Scoring voix & contenu candidat",
                  "Rapport de synthèse par candidat",
                  "Comparaison multi-candidats",
                  "Intégration workflow de recrutement",
                ],
              },
              {
                icon: <GraduationCap className="h-8 w-8 text-teal-500" />, bg: "bg-teal-500/10",
                title: "Formation & Coaching",
                points: [
                  "Analyse des appels par agent",
                  "Scoring automatique des performances",
                  "Recommandations personnalisées",
                  "Modules de formation intégrés",
                  "Suivi de progression en temps réel",
                ],
              },
            ].map(({ icon, bg, title, points }) => (
              <div key={title} className="bg-background rounded-3xl border p-8 space-y-6 hover:shadow-xl transition-shadow">
                <div className={`w-14 h-14 ${bg} rounded-2xl flex items-center justify-center`}>{icon}</div>
                <h3 className="text-2xl font-black">{title}</h3>
                <ul className="space-y-2">
                  {points.map(p => (
                    <li key={p} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <ChevronRight className="h-4 w-4 text-primary flex-shrink-0" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WhatsApp IA — en complément ────────────────────────────────────── */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="rounded-3xl p-8 md:p-12 border-2 flex flex-col lg:flex-row gap-10 items-center"
               style={{ borderColor: `${WA_GREEN}40`, background: `linear-gradient(135deg, ${WA_GREEN}06, transparent)` }}>
            <div className="flex-shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center"
                 style={{ backgroundColor: `${WA_GREEN}18` }}>
              <Smartphone className="h-9 w-9" style={{ color: WA_GREEN }} />
            </div>
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-3">
                <h3 className="text-2xl font-black">Agent WhatsApp IA — Disponible en add-on</h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-black text-white" style={{ backgroundColor: WA_GREEN }}>NOUVEAU</span>
              </div>
              <p className="text-muted-foreground text-lg">
                En complément du dialer, vos agents IA répondent aussi sur WhatsApp Business via Meta API directe (v21.0).
                Prise de RDV, devis, relances, briefing owner quotidien — sans intermédiaire, sans frais supplémentaires de transit.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                {["Connexion directe Meta API", "Signature HMAC-SHA256", "Routing owner / client", "Briefing quotidien", "Templates par industrie"].map(f => (
                  <span key={f} className="flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-muted">
                    <CheckCircle className="h-3.5 w-3.5 flex-shrink-0" style={{ color: WA_GREEN }} />{f}
                  </span>
                ))}
              </div>
            </div>
            <Button className="flex-shrink-0 h-12 px-8 rounded-full text-white font-bold" style={{ backgroundColor: WA_GREEN }}
                    onClick={handleStart}>
              Activer WhatsApp IA
            </Button>
          </div>
        </div>
      </section>

      {/* ── Segments ───────────────────────────────────────────────────────── */}
      <section id="segments" className="py-32 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center space-y-4 mb-20">
            <h2 className="text-sm font-black uppercase tracking-widest text-primary">Secteurs</h2>
            <p className="text-4xl md:text-5xl font-black tracking-tight">Conçu pour votre métier</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { emoji: "🍽️", name: "Restaurants & Hôtels",   use: "Réservations, commandes, fidélisation clients" },
              { emoji: "🏥", name: "Cabinets médicaux",       use: "RDV, rappels patients, suivi post-consultation" },
              { emoji: "🔧", name: "Artisans & PME",          use: "Devis, planning, relances, suivi chantier" },
              { emoji: "🏠", name: "Agences immobilières",    use: "Qualif mandats, visites, relances acquéreurs" },
            ].map(({ emoji, name, use }) => (
              <div key={name} className="p-6 rounded-2xl border bg-background hover:border-primary hover:shadow-lg transition-all text-center space-y-3">
                <div className="text-5xl">{emoji}</div>
                <h3 className="font-black text-lg">{name}</h3>
                <p className="text-muted-foreground text-sm">{use}</p>
                <Button variant="ghost" size="sm" className="text-primary" onClick={handleStart}>
                  Voir le blueprint <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Sécurité ───────────────────────────────────────────────────────── */}
      <section className="py-32 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center space-y-4 mb-20">
            <h2 className="text-sm font-black uppercase tracking-widest text-primary">Architecture</h2>
            <p className="text-4xl md:text-5xl font-black tracking-tight">BYOK — Vos clés, vos données</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { icon: <Key className="h-8 w-8 text-primary" />,        bg: "bg-primary/10",    title: "Clés API Centralisées",  desc: "OpenAI, Meta, Twilio, Stripe, SendGrid — une interface unifiée." },
              { icon: <Lock className="h-8 w-8 text-green-500" />,     bg: "bg-green-500/10",  title: "AES-256-CBC",            desc: "Chaque clé chiffrée individuellement. Isolation totale par tenant." },
              { icon: <Shield className="h-8 w-8 text-blue-500" />,    bg: "bg-blue-500/10",   title: "HMAC-SHA256 Webhooks",   desc: "Signature vérifiée sur chaque webhook entrant (Meta, Stripe, Twilio)." },
              { icon: <CheckCircle className="h-8 w-8 text-teal-500" />,bg: "bg-teal-500/10",  title: "Tests Temps Réel",       desc: "Validez vos clés API avant sauvegarde." },
              { icon: <Building2 className="h-8 w-8 text-purple-500" />,bg: "bg-purple-500/10",title: "Multi-Tenant RLS",       desc: "Isolation PostgreSQL Row Level Security. Données jamais croisées." },
              { icon: <BarChart3 className="h-8 w-8 text-orange-500" />,bg: "bg-orange-500/10",title: "Audit Logging",          desc: "Tous les accès enregistrés. Conformité RGPD native." },
            ].map(({ icon, bg, title, desc }) => (
              <Card key={title} className="border-none shadow-xl hover:-translate-y-2 transition-transform duration-300">
                <CardHeader className="space-y-4">
                  <div className={`w-14 h-14 ${bg} rounded-2xl flex items-center justify-center`}>{icon}</div>
                  <CardTitle className="text-xl font-bold">{title}</CardTitle>
                  <CardDescription className="text-base">{desc}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ────────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-32 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center space-y-4 mb-20">
            <h2 className="text-sm font-black uppercase tracking-widest text-primary">Tarifs</h2>
            <p className="text-4xl md:text-5xl font-black tracking-tight">Simple. Tout inclus.</p>
          </div>
          <div className="max-w-2xl mx-auto">
            <div className="rounded-3xl border-2 border-primary p-10 text-center space-y-8 bg-background shadow-2xl">
              <div>
                <span className="px-4 py-1.5 rounded-full bg-primary text-primary-foreground text-sm font-black">Plateforme Complète</span>
              </div>
              <div className="flex items-baseline justify-center gap-2">
                <span className="text-6xl font-black">179€</span>
                <span className="text-muted-foreground text-lg">/trimestre</span>
              </div>
              <p className="text-muted-foreground">+ 99€ onboarding unique — 3 mois minimum</p>
              <div className="grid sm:grid-cols-2 gap-3 text-left">
                {[
                  "Dialer IA prédictif",
                  "Extracteur de leads",
                  "CRM avec mémoire IA",
                  "Workflows no-code 60+ actions",
                  "Campagnes multi-canal",
                  "Réseaux sociaux IA",
                  "Recrutement IA",
                  "Formation & coaching agents",
                  "Monitoring IA temps réel",
                  "Blueprints par industrie",
                  "Stripe Connect + facturation",
                  "Agent WhatsApp IA (Meta API)",
                ].map(f => (
                  <div key={f} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              <Button size="lg" className="w-full h-14 text-lg rounded-full shadow-xl shadow-primary/30" onClick={handleStart}>
                {isAuthenticated ? "Aller au Dashboard" : "Démarrer Gratuitement"}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <p className="text-muted-foreground text-sm">Sans engagement après 3 mois · Support inclus · Configuration en 15 min</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────────────── */}
      <section className="py-32 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 text-center space-y-8">
          <h2 className="text-5xl md:text-6xl font-black tracking-tight">
            Tout pour vendre plus,<br />gérer mieux, croître vite.
          </h2>
          <p className="text-xl md:text-2xl opacity-90 max-w-2xl mx-auto">
            Dialer IA, CRM, Leads, Workflows, Réseaux Sociaux, Recrutement, Formation — une seule plateforme, un seul abonnement.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
            <Button size="lg" variant="secondary" className="h-16 px-10 text-xl rounded-full group" onClick={handleStart}>
              {isAuthenticated ? "Aller au Dashboard" : "Démarrer Gratuitement"}
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button size="lg" variant="outline"
                    className="h-16 px-10 text-xl rounded-full text-primary-foreground border-primary-foreground hover:bg-primary-foreground/10"
                    onClick={() => setLocation("/contact")}>
              Parler à un expert
            </Button>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t bg-muted/30 py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="bg-primary p-1.5 rounded-lg"><Phone className="h-4 w-4 text-white" /></div>
                <span className="font-black text-lg">SERVICALL</span>
              </div>
              <p className="text-muted-foreground text-sm">Plateforme CRM IA tout-en-un pour PME</p>
            </div>
            <div>
              <h4 className="font-bold mb-4">Modules</h4>
              <ul className="space-y-2 text-muted-foreground text-sm">
                {["Dialer IA", "Lead Extraction", "CRM", "Workflows", "Réseaux Sociaux", "Recrutement"].map(m => (
                  <li key={m}><a href="#modules" className="hover:text-primary transition-colors">{m}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Secteurs</h4>
              <ul className="space-y-2 text-muted-foreground text-sm">
                {["Restaurants", "Cabinets médicaux", "Artisans", "Immobilier"].map(s => (
                  <li key={s}><a href="#segments" className="hover:text-primary transition-colors">{s}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Légal</h4>
              <ul className="space-y-2 text-muted-foreground text-sm">
                <li><a href="/privacy" className="hover:text-primary transition-colors">Confidentialité</a></li>
                <li><a href="/terms"   className="hover:text-primary transition-colors">Conditions</a></li>
                <li><a href="/contact" className="hover:text-primary transition-colors">Contact</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t pt-8 text-center text-muted-foreground text-sm">
            <p>&copy; 2026 Servicall. Tous droits réservés.</p>
          </div>
        </div>
      </footer>

    </div>
  );
}
