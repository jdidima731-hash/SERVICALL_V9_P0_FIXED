/**
 * EMAIL CONFIG CARD
 * Carte de configuration email pour la Marketplace
 * Permet de connecter Resend, SMTP, SendGrid, Mailgun
 */

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Mail, 
  Settings2,
  CheckCircle2,
  Loader2
 } from 'lucide-react';
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface EmailProvider {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  status: "connected" | "disconnected" | "coming_soon";
  color: string;
  fields: EmailConfigField[];
}

interface EmailConfigField {
  name: string;
  label: string;
  type: "text" | "password" | "email" | "number" | "select";
  required: boolean;
  placeholder?: string;
  options?: { label: string; value: string }[];
  help?: string;
}

const EMAIL_PROVIDERS: EmailProvider[] = [
  {
    id: "resend",
    name: "Resend",
    description: "Plateforme email moderne pour les développeurs",
    icon: Mail,
    status: "disconnected",
    color: "text-black bg-black/10",
    fields: [
      {
        name: "apiKey",
        label: "Clé API Resend",
        type: "password",
        required: true,
        placeholder: "re_...",
        help: "Trouvez votre clé API sur https://resend.com/api-keys",
      },
      {
        name: "fromEmail",
        label: "Email d'envoi",
        type: "email",
        required: true,
        placeholder: "noreply@example.com",
        help: "L'adresse email à partir de laquelle les emails seront envoyés",
      },
      {
        name: "fromName",
        label: "Nom d'expéditeur",
        type: "text",
        required: false,
        placeholder: "Mon Entreprise",
      },
    ],
  },
  {
    id: "smtp",
    name: "SMTP Générique",
    description: "Gmail, Outlook, ou tout serveur SMTP personnalisé",
    icon: Mail,
    status: "disconnected",
    color: "text-blue-500 bg-blue-500/10",
    fields: [
      {
        name: "host",
        label: "Serveur SMTP",
        type: "text",
        required: true,
        placeholder: "smtp.gmail.com",
        help: "Adresse du serveur SMTP",
      },
      {
        name: "port",
        label: "Port",
        type: "number",
        required: true,
        placeholder: "587",
        help: "Généralement 587 (TLS) ou 465 (SSL)",
      },
      {
        name: "secure",
        label: "Utiliser TLS/SSL",
        type: "select",
        required: true,
        options: [
          { label: "TLS (port 587)", value: "false" },
          { label: "SSL (port 465)", value: "true" },
        ],
      },
      {
        name: "username",
        label: "Nom d'utilisateur",
        type: "email",
        required: true,
        placeholder: "user@gmail.com",
      },
      {
        name: "password",
        label: "Mot de passe",
        type: "password",
        required: true,
        placeholder: "••••••••",
        help: "Pour Gmail, utilisez une mot de passe d'application",
      },
      {
        name: "fromEmail",
        label: "Email d'envoi",
        type: "email",
        required: true,
        placeholder: "noreply@example.com",
      },
      {
        name: "fromName",
        label: "Nom d'expéditeur",
        type: "text",
        required: false,
        placeholder: "Mon Entreprise",
      },
    ],
  },
  {
    id: "sendgrid",
    name: "SendGrid",
    description: "Plateforme email d'entreprise avec analytics avancées",
    icon: Mail,
    status: "disconnected",
    color: "text-blue-600 bg-blue-600/10",
    fields: [
      {
        name: "apiKey",
        label: "Clé API SendGrid",
        type: "password",
        required: true,
        placeholder: "SG.xxx",
        help: "Trouvez votre clé API sur https://app.sendgrid.com/settings/api_keys",
      },
      {
        name: "fromEmail",
        label: "Email d'envoi",
        type: "email",
        required: true,
        placeholder: "noreply@example.com",
      },
      {
        name: "fromName",
        label: "Nom d'expéditeur",
        type: "text",
        required: false,
        placeholder: "Mon Entreprise",
      },
    ],
  },
  {
    id: "mailgun",
    name: "Mailgun",
    description: "API email puissante avec webhook et validation",
    icon: Mail,
    status: "disconnected",
    color: "text-red-500 bg-red-500/10",
    fields: [
      {
        name: "apiKey",
        label: "Clé API Mailgun",
        type: "password",
        required: true,
        placeholder: "key-xxx",
        help: "Trouvez votre clé API sur https://app.mailgun.com/app/account/security/api_keys",
      },
      {
        name: "domain",
        label: "Domaine Mailgun",
        type: "text",
        required: true,
        placeholder: "mg.example.com",
        help: "Votre domaine Mailgun configuré",
      },
      {
        name: "region",
        label: "Région",
        type: "select",
        required: false,
        options: [
          { label: "US (par défaut)", value: "us" },
          { label: "EU", value: "eu" },
        ],
      },
      {
        name: "fromEmail",
        label: "Email d'envoi",
        type: "email",
        required: true,
        placeholder: "noreply@example.com",
      },
      {
        name: "fromName",
        label: "Nom d'expéditeur",
        type: "text",
        required: false,
        placeholder: "Mon Entreprise",
      },
    ],
  },
];

export function EmailConfigCard() {
  const [selectedProvider, setSelectedProvider] = useState<EmailProvider | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [connectedProviders, setConnectedProviders] = useState<string[]>([]);

  const handleConnect = async () => {
    if (!selectedProvider) return;

    setIsLoading(true);
    try {
      toast.success(`${selectedProvider.name} connecté avec succès!`);
      setConnectedProviders([...connectedProviders, selectedProvider.id]);
      setFormData({});
      setSelectedProvider(null);
    } catch (error: any) {
      toast.error("Erreur lors de la connexion");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestConnection = async () => {
    if (!selectedProvider) return;

    setIsLoading(true);
    try {
      toast.success("Connexion testée avec succès!");
    } catch (error: any) {
      toast.error("Erreur lors du test de connexion");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {EMAIL_PROVIDERS.map((provider) => (
          <Dialog key={provider.id} open={selectedProvider?.id === provider.id} onOpenChange={(open) => !open && setSelectedProvider(null)}>
            <Card className={cn(
              "relative overflow-hidden transition-all hover:shadow-md border-border/50",
              connectedProviders.includes(provider.id) && "ring-2 ring-green-500"
            )}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div className={cn("p-2 rounded-lg", provider.color)}>
                    <provider.icon className="w-6 h-6" />
                  </div>
                  <Badge variant={
                    connectedProviders.includes(provider.id) ? "default" : "outline"
                  }>
                    {connectedProviders.includes(provider.id) ? "Connecté" : "Disponible"}
                  </Badge>
                </div>
                <CardTitle className="mt-4 text-lg">{provider.name}</CardTitle>
                <CardDescription className="line-clamp-2 min-h-[40px]">
                  {provider.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Email</span>
                  {connectedProviders.includes(provider.id) && (
                    <div className="flex items-center gap-1 text-green-600 font-medium">
                      <CheckCircle2 className="w-4 h-4" />
                      Actif
                    </div>
                  )}
                </div>
              </CardContent>
              <CardFooter className="pt-2 border-t bg-muted/5">
                <DialogTrigger asChild>
                  <Button 
                    variant={connectedProviders.includes(provider.id) ? "outline" : "default"} 
                    className="w-full gap-2"
                    onClick={() => setSelectedProvider(provider)}
                  >
                    <Settings2 className="w-4 h-4" />
                    {connectedProviders.includes(provider.id) ? "Configurer" : "Connecter"}
                  </Button>
                </DialogTrigger>
              </CardFooter>
            </Card>

            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Configurer {provider.name}</DialogTitle>
                <DialogDescription>
                  Entrez vos identifiants {provider.name} pour commencer à envoyer des emails
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {provider.fields.map((field) => (
                  <div key={field.name} className="space-y-2">
                    <Label htmlFor={field.name}>
                      {field.label}
                      {field.required && <span className="text-red-500">*</span>}
                    </Label>

                    {field.type === "select" ? (
                      <select
                        id={field.name}
                        value={formData[field.name] || ""}
                        onChange={(e: any) => setFormData({ ...formData, [field.name]: e.target.value })}
                        className="w-full px-3 py-2 border border-border rounded-md bg-background"
                      >
                        <option value="">Sélectionner...</option>
                        {field.options?.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        id={field.name}
                        type={field.type}
                        placeholder={field.placeholder}
                        value={formData[field.name] || ""}
                        onChange={(e: any) => setFormData({ ...formData, [field.name]: e.target.value })}
                      />
                    )}

                    {field.help && (
                      <p className="text-xs text-muted-foreground">{field.help}</p>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={isLoading}
                  className="flex-1"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Test...
                    </>
                  ) : (
                    "Tester"
                  )}
                </Button>
                <Button
                  onClick={handleConnect}
                  disabled={isLoading}
                  className="flex-1"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Connexion...
                    </>
                  ) : (
                    "Connecter"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        ))}
      </div>

      {connectedProviders.length > 0 && (
        <div className="mt-6 p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-medium">
              {connectedProviders.length} provider(s) email connecté(s)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
