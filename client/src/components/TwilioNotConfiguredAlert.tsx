/**
 * BLOC 3 - Composant d'alerte pour Twilio non configuré
 * Affiche un message clair à l'utilisateur et désactive les fonctionnalités d'appel
 */

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, PhoneOff, Settings, ExternalLink  } from 'lucide-react';

interface TwilioNotConfiguredAlertProps {
  variant?: "alert" | "card";
  showDetails?: boolean;
}

export function TwilioNotConfiguredAlert({ 
  variant = "alert",
  showDetails = true 
}: TwilioNotConfiguredAlertProps) {
  if (variant === "card") {
    return (
      <Card className="border-orange-200 bg-orange-50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <PhoneOff className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <CardTitle className="text-orange-900">Téléphonie non configurée</CardTitle>
              <CardDescription className="text-orange-700">
                Les fonctionnalités d'appel ne sont pas disponibles
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        {showDetails && (
          <CardContent className="space-y-4">
            <p className="text-sm text-orange-800">
              Pour activer la téléphonie, vous devez configurer Twilio dans les paramètres de l'application.
            </p>
            <div className="bg-white rounded-lg p-4 border border-orange-200">
              <h4 className="font-semibold text-sm mb-2 text-orange-900">Variables d'environnement requises :</h4>
              <ul className="text-sm space-y-1 text-orange-800 font-mono">
                <li>• TWILIO_ACCOUNT_SID</li>
                <li>• TWILIO_AUTH_TOKEN</li>
                <li>• TWILIO_PHONE_NUMBER</li>
              </ul>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-2">
                <Settings className="w-4 h-4" />
                Configurer Twilio
              </Button>
              <Button variant="ghost" size="sm" className="gap-2">
                <ExternalLink className="w-4 h-4" />
                Documentation
              </Button>
            </div>
          </CardContent>
        )}
      </Card>
    );
  }

  return (
    <Alert variant="destructive" className="border-orange-300 bg-orange-50">
      <AlertCircle className="h-4 w-4 text-orange-600" />
      <AlertTitle className="text-orange-900">Téléphonie non configurée</AlertTitle>
      <AlertDescription className="text-orange-800">
        {showDetails ? (
          <>
            Les fonctionnalités d'appel ne sont pas disponibles. 
            Veuillez configurer Twilio dans les paramètres de l'application 
            (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER).
          </>
        ) : (
          "Les fonctionnalités d'appel ne sont pas disponibles."
        )}
      </AlertDescription>
    </Alert>
  );
}

/**
 * Composant d'alerte inline pour désactiver un bouton
 */
export function TwilioDisabledTooltip() {
  return (
    <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-orange-100 text-orange-900 text-xs px-3 py-2 rounded-lg shadow-lg whitespace-nowrap z-50 border border-orange-200">
      <div className="flex items-center gap-2">
        <PhoneOff className="w-3 h-3" />
        <span>Téléphonie non configurée</span>
      </div>
      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-orange-100 border-r border-b border-orange-200 rotate-45"></div>
    </div>
  );
}
