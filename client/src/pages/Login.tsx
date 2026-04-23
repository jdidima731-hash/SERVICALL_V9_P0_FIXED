import { useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { RouterOutputs } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Phone, AlertCircle, Shield, Zap, MessageSquare  } from 'lucide-react';
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

const loginSchema = z.object({
  email: z.string().min(1, "L'email est requis").email("Email invalide"),
  password: z.string().min(1, "Le mot de passe est requis"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Login() {
  // useTranslation disponible quand i18n sera activé
  // const { t } = useTranslation("common");
  const [error, setError] = useState<string | null>(null);
  const [, setLocation] = useLocation();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const utils = trpc.useUtils();

  const loginMutation = trpc.core.auth.login.useMutation({
    onSuccess: async (data: any) => {
      if (data.user) {
        utils.core.auth.me.setData(undefined, data.user as RouterOutputs["core"]["auth"]["me"]);
      }
      toast.success("Connexion réussie ! Bienvenue sur Servicall.");
      try {
        await refreshCsrfToken();
      } catch {
        /* non bloquant */
      }
      // utils.auth.me.invalidate(); // Bug 3 Fix: Ne pas invalider immédiatement pour éviter de perdre l'état isAuthenticated
      setLocation("/select-tenant");
    },
    onError: (err) => {
      setError(err.message || "Identifiants invalides. Vérifiez votre email et mot de passe.");
    },
  });

  const onSubmit = (values: LoginFormValues) => {
    setError(null);
    loginMutation.mutate({ email: values.email, password: values.password });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo & Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 shadow-lg shadow-blue-500/30">
            <Phone className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">Servicall</h1>
            <p className="text-blue-300 text-sm mt-1">CRM & Call Center Intelligent</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl space-y-6">
          <div>
            <h2 className="text-xl font-bold text-white">Connexion</h2>
            <p className="text-slate-400 text-sm mt-1">Accédez à votre espace de travail</p>
          </div>

          {error && (
            <Alert variant="destructive" className="bg-red-500/10 border-red-500/30">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-red-300">{error}</AlertDescription>
            </Alert>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-300 text-sm font-medium">Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="admin@votreentreprise.com"
                        autoComplete="email"
                        className="bg-white/10 border-white/20 text-white placeholder:text-slate-500 focus:border-blue-400 focus:ring-blue-400/20 h-11"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-red-400 text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-300 text-sm font-medium">Mot de passe</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        autoComplete="current-password"
                        className="bg-white/10 border-white/20 text-white placeholder:text-slate-500 focus:border-blue-400 focus:ring-blue-400/20 h-11"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-red-400 text-xs" />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full h-11 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg shadow-lg shadow-blue-500/25 transition-all"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Connexion en cours...
                  </span>
                ) : (
                  "Se connecter"
                )}
              </Button>
            </form>
          </Form>

          <div className="text-center">
            <span className="text-slate-400 text-sm">Pas encore de compte ? </span>
            <button
              onClick={() => setLocation("/signup")}
              className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
            >
              S'inscrire
            </button>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Shield, label: "Sécurisé" },
            { icon: Zap, label: "Rapide" },
            { icon: MessageSquare, label: "Intelligent" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-1 p-3 bg-white/5 rounded-xl border border-white/10">
              <Icon className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-slate-400">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
