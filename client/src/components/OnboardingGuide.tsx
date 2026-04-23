import { useState } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronRight,
  CheckCircle2,
  Zap,
  Sparkles,
  X,
  Users,
  MessageSquare,
  ShieldCheck
 } from 'lucide-react';
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface OnboardingStep {
  id: number;
  title: string;
  description: string;
  details: string[];
  icon: React.ReactNode;
  color: string;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 1,
    title: "Bienvenue sur Servicall v2",
    description: "Votre centre de commande omnicanal propulsé par l'IA.",
    details: [
      "Gestion unifiée des Appels, SMS, WhatsApp et Emails.",
      "Moteur d'automatisation intelligent pour vos processus métiers.",
      "Interface ultra-rapide conçue pour la performance commerciale.",
    ],
    icon: <Sparkles className="w-8 h-8" />,
    color: "text-primary bg-primary/10",
  },
  {
    id: 2,
    title: "Pipeline & Prospects",
    description: "Visualisez votre flux commercial en un coup d'œil.",
    details: [
      "Nouveau Kanban interactif avec drag & drop fluide.",
      "Fiches prospects enrichies avec historique omnicanal complet.",
      "Scoring automatique des intentions pour prioriser vos actions.",
    ],
    icon: <Users className="w-8 h-8" />,
    color: "text-blue-500 bg-blue-50",
  },
  {
    id: 3,
    title: "Moteur de Workflows IA",
    description: "Automatisez les tâches répétitives sans coder.",
    details: [
      "Blueprints métiers prêts à l'emploi (Immobilier, Assurance, etc.).",
      "Actions IA : Résumé d'appel, Analyse de sentiment et d'intention.",
      "Simulateur en temps réel pour tester vos séquences avant activation.",
    ],
    icon: <Zap className="w-8 h-8" />,
    color: "text-amber-500 bg-amber-50",
  },
  {
    id: 4,
    title: "Communication Omnicanale",
    description: "Engagez vos clients sur tous leurs canaux favoris.",
    details: [
      "Envoyez des SMS, WhatsApp et Emails depuis une interface unique.",
      "Templates dynamiques avec variables personnalisées.",
      "Timeline centralisée pour ne jamais perdre le fil d'une discussion.",
    ],
    icon: <MessageSquare className="w-8 h-8" />,
    color: "text-emerald-500 bg-emerald-50",
  },
  {
    id: 5,
    title: "Sécurité & Conformité",
    description: "Une plateforme robuste et respectueuse des normes.",
    details: [
      "Audit Trail complet pour une traçabilité totale des actions.",
      "Conformité RGPD native avec gestion des bases légales.",
      "Infrastructure haute disponibilité avec cache optimisé.",
    ],
    icon: <ShieldCheck className="w-8 h-8" />,
    color: "text-indigo-500 bg-indigo-50",
  },
];

interface OnboardingGuideProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function OnboardingGuide({ open = false, onOpenChange }: OnboardingGuideProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const step = ONBOARDING_STEPS[currentStep];

  const handleNext = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onOpenChange?.(false);
      localStorage.setItem("onboarding_completed", "true");
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleClose = () => {
    onOpenChange?.(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 overflow-hidden border-none rounded-3xl shadow-2xl">
        <div className="relative">
          {/* Header Image/Pattern */}
          <div className="h-32 bg-gradient-to-br from-slate-900 to-slate-800 relative flex items-center justify-center overflow-hidden">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary via-transparent to-transparent scale-150" />
            </div>
            <div className={cn("p-4 rounded-2xl shadow-xl z-10 transition-all duration-500 transform scale-110", step!.color)}>
              {step!.icon}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="absolute top-4 right-4 text-slate-400 hover:text-white hover:bg-white/10 rounded-full h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="p-8 space-y-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <div className="text-center space-y-2">
                  <h2 className="text-3xl font-black tracking-tight text-slate-900">{step!.title}</h2>
                  <p className="text-slate-500 font-medium">{step!.description}</p>
                </div>

                <div className="space-y-3">
                  {step!.details.map((detail, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 group hover:border-primary/20 hover:bg-white transition-all"
                    >
                      <div className="mt-1 flex-shrink-0 w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      </div>
                      <span className="text-sm font-bold text-slate-700 leading-snug">{detail}</span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Footer */}
            <div className="space-y-6">
              {/* Progress */}
              <div className="flex items-center gap-2">
                {ONBOARDING_STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "h-1.5 rounded-full transition-all duration-500",
                      i === currentStep ? "flex-[3] bg-primary" : i < currentStep ? "flex-1 bg-primary/30" : "flex-1 bg-slate-100"
                    )}
                  />
                ))}
              </div>

              <div className="flex gap-4">
                <Button
                  variant="ghost"
                  onClick={handlePrev}
                  disabled={currentStep === 0}
                  className="flex-1 h-12 rounded-xl font-black uppercase tracking-widest text-[10px] text-slate-400 disabled:opacity-0"
                >
                  Précédent
                </Button>
                <Button
                  onClick={handleNext}
                  className="flex-[2] h-12 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-primary/20 group"
                >
                  {currentStep === ONBOARDING_STEPS.length - 1 ? (
                    "C'est parti !"
                  ) : (
                    <>
                      Continuer
                      <ChevronRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
