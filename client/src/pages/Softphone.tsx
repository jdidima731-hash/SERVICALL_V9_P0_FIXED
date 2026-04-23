/**
 * BLOC 3 - Page Softphone avec gestion Twilio et mode dégradé
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { Phone, PhoneOff, Settings } from 'lucide-react';
import { useTwilioStatus } from "@/hooks/useTwilioStatus";
import { TwilioNotConfiguredAlert } from "@/components/TwilioNotConfiguredAlert";
import { SoftphoneWebRTC } from "@/components/SoftphoneWebRTC";
import { GlossaryTerm } from "@/components/GlossaryTerm";

export default function SoftphonePage() {
  const twilioStatus = useTwilioStatus();

  // ÉTAT LOADING
  if (twilioStatus.loading) {
    return (
      <div className="space-y-6 animate-fade-in" data-main-content>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Phone className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-3xl font-black tracking-tight">Softphone</h1>
        </div>
        <LoadingState 
          message="Vérification de la configuration Twilio..." 
          timeout={10000}
        />
      </div>
    );
  }

  // ÉTAT ERROR (Twilio non configuré)
  if (!twilioStatus.isReady) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Phone className="w-6 h-6 text-primary" />
              </div>
              <h1 className="text-3xl font-black tracking-tight">Softphone</h1>
            </div>
            <p className="text-muted-foreground">
              Passez et recevez des appels directement depuis votre navigateur via la technologie <GlossaryTerm termKey="WEBRTC">WebRTC</GlossaryTerm>
            </p>
          </div>
        </div>

        {/* Alerte Twilio non configuré */}
        <TwilioNotConfiguredAlert variant="card" showDetails={true} />

        {/* Informations sur la configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Configuration requise
            </CardTitle>
            <CardDescription>
              Pour utiliser le softphone, configurez les variables d'environnement suivantes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <ConfigItem 
                label="TWILIO_ACCOUNT_SID" 
                configured={twilioStatus.hasToken}
                description="Identifiant de votre compte Twilio"
              />
              <ConfigItem 
                label="TWILIO_AUTH_TOKEN" 
                configured={twilioStatus.hasToken}
                description="Token d'authentification Twilio"
              />
              <ConfigItem 
                label="TWILIO_PHONE_NUMBER" 
                configured={twilioStatus.hasPhoneNumber}
                description="Numéro de téléphone Twilio (format E.164)"
              />
            </div>

            <div className="bg-muted p-4 rounded-lg">
              <h4 className="font-semibold text-sm mb-2">Comment configurer Twilio ?</h4>
              <ol className="text-sm space-y-1 text-muted-foreground list-decimal list-inside">
                <li>Créez un compte sur <a href="https://www.twilio.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">twilio.com</a></li>
                <li>Récupérez vos identifiants (Account SID et Auth Token)</li>
                <li>Achetez un numéro de téléphone Twilio</li>
                <li>Ajoutez les variables d'environnement dans votre fichier .env</li>
                <li>Redémarrez l'application</li>
              </ol>
            </div>

            <Button variant="outline" className="w-full gap-2">
              <Settings className="w-4 h-4" />
              Accéder aux paramètres
            </Button>
          </CardContent>
        </Card>

        {/* Mode démo (optionnel) */}
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>Mode Démo</CardTitle>
            <CardDescription>
              Testez l'interface du softphone sans configuration Twilio
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="secondary" className="w-full gap-2">
              <Phone className="w-4 h-4" />
              Activer le mode démo
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ÉTAT NORMAL (Twilio configuré et prêt)
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-100 rounded-lg">
              <Phone className="w-6 h-6 text-green-600" />
            </div>
            <h1 className="text-3xl font-black tracking-tight">Softphone</h1>
            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
              Prêt
            </span>
          </div>
          <p className="text-muted-foreground">
            Passez et recevez des appels directement depuis votre navigateur
          </p>
        </div>
      </div>

      {/* Softphone fonctionnel */}
      <SoftphoneWebRTC />
    </div>
  );
}

/**
 * Composant pour afficher l'état d'une variable de configuration
 */
function ConfigItem({ 
  label, 
  configured, 
  description 
}: { 
  label: string; 
  configured: boolean; 
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 p-3 bg-white rounded-lg border">
      <div className={`p-1 rounded-full ${configured ? "bg-green-100" : "bg-red-100"}`}>
        {configured ? (
          <Phone className="w-4 h-4 text-green-600" />
        ) : (
          <PhoneOff className="w-4 h-4 text-red-600" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-mono text-sm font-semibold">{label}</p>
          <span className={`px-2 py-0.5 text-xs font-medium rounded ${
            configured 
              ? "bg-green-100 text-green-700" 
              : "bg-red-100 text-red-700"
          }`}>
            {configured ? "Configuré" : "Manquant"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </div>
    </div>
  );
}
