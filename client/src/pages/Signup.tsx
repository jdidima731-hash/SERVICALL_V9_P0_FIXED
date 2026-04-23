/**
 * ✅ CORRECTION BUG SIGNUP: Page d'inscription complète
 * Remplace le simple toast par un vrai formulaire fonctionnel
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { RouterOutputs } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Phone, AlertCircle, Shield, Users, Zap  } from 'lucide-react';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { refreshCsrfToken } from "@/hooks/useCsrfToken";

const signupSchema = z.object({
  name: z
    .string()
    .min(2, "Le nom doit contenir au moins 2 caractères")
    .max(100, "Le nom est trop long"),
  email: z.string().min(1, "L'email est requis").email("Email invalide"),
  password: z
    .string()
    .min(8, "Le mot de passe doit contenir au moins 8 caractères")
    .max(100, "Le mot de passe est trop long"),
  confirmPassword: z.string().min(1, "Veuillez confirmer votre mot de passe"),
  company: z.string().max(200, "Le nom de l'entreprise est trop long").optional(),
}).refine((data: any) => data.password === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});

type SignupFormValues = z.infer<typeof signupSchema>;

export default function Signup() {
  const { t } = useTranslation("common");
  const [error, setError] = useState<string | null>(null);
  const [, setLocation] = useLocation();

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      company: "",
    },
  });

  const utils = trpc.useUtils();
  const registerMutation = trpc.core.auth.register.useMutation({
    onSuccess: async (data: any) => {
      if (data.user) {
        
        utils.core.auth.me.setData(undefined, data.user as RouterOutputs["core"]["auth"]["register"]["user"]);
      }
      toast.success("Compte créé avec succès ! Bienvenue sur Servicall CRM.");

      // ✅ Rafraîchir le token CSRF après inscription (nouvelle session créée)
      try {
        await refreshCsrfToken();
      } catch (e: any) {
        console.warn("[Signup] Impossible de rafraîchir le CSRF token", e);
      }

      // Invalider le cache et naviguer vers le dashboard
      utils.core.auth.me.invalidate();
      setLocation("/dashboard");
    },
    onError: (err) => {
      const errorMessage = err.message || "Erreur lors de la création du compte";
      setError(errorMessage);
      toast.error(errorMessage);
    },
  });

  const onSubmit = (values: SignupFormValues) => {
    setError(null);
    registerMutation.mutate({
      name: values.name,
      email: values.email,
      password: values.password,
      
      company: values.company || undefined,
    });
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary relative overflow-hidden items-center justify-center p-12">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-10 pointer-events-none">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-white rounded-full blur-3xl"></div>
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-blue-400 rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10 max-w-lg text-primary-foreground space-y-8">
          <div className="flex items-center gap-3 mb-12">
            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
              <Phone className="h-10 w-10 text-white" />
            </div>
            <span className="text-3xl font-bold tracking-tight">Servicall CRM</span>
          </div>

          <div className="space-y-6">
            <h1 className="text-4xl font-extrabold leading-tight">
              Créez votre espace CRM en quelques secondes
            </h1>
            <p className="text-xl text-primary-foreground/80 leading-relaxed">
              Rejoignez des milliers d'équipes qui utilisent Servicall pour gérer leurs prospects et booster leurs performances.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 pt-8">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-white/10 rounded-lg">
                <Zap className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Démarrage immédiat</h3>
                <p className="text-primary-foreground/70">
                  Votre espace est prêt en moins d'une minute, sans configuration complexe.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="p-2 bg-white/10 rounded-lg">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Sécurité maximale</h3>
                <p className="text-primary-foreground/70">
                  Isolation multi-tenant, chiffrement des données et conformité RGPD.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="p-2 bg-white/10 rounded-lg">
                <Users className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Collaboration d'équipe</h3>
                <p className="text-primary-foreground/70">
                  Invitez vos agents et managers, gérez les rôles et permissions facilement.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Signup Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 md:p-16 lg:p-24 bg-muted/10">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center lg:text-left space-y-2">
            <div className="lg:hidden flex justify-center mb-6">
              <div className="p-3 bg-primary/10 rounded-2xl">
                <Phone className="h-10 w-10 text-primary" />
              </div>
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground">
              Créer un compte
            </h2>
            <p className="text-muted-foreground">
              Commencez gratuitement, sans carte bancaire requise.
            </p>
          </div>

          {/* Toggle Login / Signup */}
          <div className="flex p-1 bg-muted rounded-lg mb-8">
            <Button
              variant="ghost"
              className="w-1/2 rounded-md"
              onClick={() => setLocation("/login")}
            >
              {t("nav.login")}
            </Button>
            <Button
              variant="ghost"
              className="w-1/2 rounded-md bg-background shadow-sm"
            >
              {t("nav.signup")}
            </Button>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              {error && (
                <Alert
                  variant="destructive"
                  className="animate-in fade-in slide-in-from-top-2"
                >
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground/80">Nom complet</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder="Jean Dupont"
                          className="h-12 bg-background border-muted-foreground/20 focus:border-primary focus:ring-primary"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground/80">Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="jean@exemple.com"
                          className="h-12 bg-background border-muted-foreground/20 focus:border-primary focus:ring-primary"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="company"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground/80">
                        Entreprise{" "}
                        <span className="text-muted-foreground text-xs">(optionnel)</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder="Ma Société SAS"
                          className="h-12 bg-background border-muted-foreground/20 focus:border-primary focus:ring-primary"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground/80">Mot de passe</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          className="h-12 bg-background border-muted-foreground/20 focus:border-primary focus:ring-primary"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground/80">
                        Confirmer le mot de passe
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          className="h-12 bg-background border-muted-foreground/20 focus:border-primary focus:ring-primary"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <p className="text-xs text-muted-foreground">
                En créant un compte, vous acceptez nos{" "}
                <span className="text-primary cursor-pointer hover:underline">
                  Conditions d'utilisation
                </span>{" "}
                et notre{" "}
                <span className="text-primary cursor-pointer hover:underline">
                  Politique de confidentialité
                </span>
                .
              </p>

              <Button
                type="submit"
                className="w-full h-12 text-lg font-semibold shadow-lg shadow-primary/20 transition-all hover:scale-[1.01] active:scale-[0.99]"
                disabled={registerMutation.isPending}
              >
                {registerMutation.isPending ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Création du compte...
                  </div>
                ) : (
                  "Créer mon compte"
                )}
              </Button>
            </form>
          </Form>

          <div className="pt-8 text-center border-t border-muted">
            <p className="text-sm text-muted-foreground">
              Déjà un compte ?{" "}
              <button
                className="text-primary font-medium hover:underline"
                onClick={() => setLocation("/login")}
              >
                Se connecter
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}