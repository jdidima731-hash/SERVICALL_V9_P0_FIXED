/**
 * Dialog de Consentement RGPD pour les Appels
 * Affiche le consentement vocal avant de lancer un appel
 */

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { AlertCircle, Mic, MessageSquare  } from 'lucide-react';
import { useState } from "react";

interface RGPDConsentDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (consent: RGPDConsent) => void;
  isLoading?: boolean;
  prospectName?: string;
  isAI?: boolean;
  agentName?: string;
}

export interface RGPDConsent {
  consentGiven: boolean;
  recordingConsent: boolean;
  aiDisclosure: boolean;
  timestamp: Date;
}

export function RGPDConsentDialog({
  isOpen,
  onOpenChange,
  onConfirm,
  isLoading = false,
  prospectName = "Prospect",
  isAI = false,
  agentName = "un agent",
}: RGPDConsentDialogProps) {
  const [recordingConsent, setRecordingConsent] = useState(false);
  const [aiDisclosure, setAiDisclosure] = useState(false);

  const handleConfirm = () => {
    const consent: RGPDConsent = {
      consentGiven: recordingConsent && (isAI ? aiDisclosure : true),
      recordingConsent,
      aiDisclosure: isAI ? aiDisclosure : true,
      timestamp: new Date(),
    };

    onConfirm(consent);
  };

  const canConfirm = recordingConsent && (isAI ? aiDisclosure : true);

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            <AlertDialogTitle>Consentement RGPD</AlertDialogTitle>
          </div>
          <AlertDialogDescription>
            Avant de procéder, veuillez confirmer votre consentement
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-4">
          {/* Informations sur l'appel */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Mic className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium">Appel avec {prospectName}</span>
            </div>
            {isAI ? (
              <Badge variant="outline" className="bg-purple-50">
                Appel par IA
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-green-50">
                Appel par {agentName}
              </Badge>
            )}
          </div>

          {/* Consentement d'enregistrement */}
          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <Checkbox
                id="recording-consent"
                checked={recordingConsent}
                onCheckedChange={(checked) => setRecordingConsent(checked as boolean)}
                disabled={isLoading}
              />
              <Label
                htmlFor="recording-consent"
                className="text-sm cursor-pointer flex-1 pt-1"
              >
                <span className="font-medium">J'accepte l'enregistrement de cet appel</span>
                <p className="text-xs text-muted-foreground mt-1">
                  Cet appel sera enregistré à titre informatif et confidentiel.
                </p>
              </Label>
            </div>
          </div>

          {/* Consentement IA (si applicable) */}
          {isAI && (
            <div className="space-y-2">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="ai-disclosure"
                  checked={aiDisclosure}
                  onCheckedChange={(checked) => setAiDisclosure(checked as boolean)}
                  disabled={isLoading}
                />
                <Label
                  htmlFor="ai-disclosure"
                  className="text-sm cursor-pointer flex-1 pt-1"
                >
                  <span className="font-medium">
                    J'accepte de communiquer avec une intelligence artificielle
                  </span>
                  <p className="text-xs text-muted-foreground mt-1">
                    Vous êtes en communication avec une IA. Vos données seront traitées
                    conformément à notre politique de confidentialité.
                  </p>
                </Label>
              </div>
            </div>
          )}

          {/* Message d'information */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
            <MessageSquare className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">
              {isAI
                ? "Vous recevrez un message vocal confirmant que vous êtes en communication avec une IA."
                : "Un agent confirmera verbalement le consentement d'enregistrement."}
            </p>
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <AlertDialogCancel disabled={isLoading}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!canConfirm || isLoading}
            className="bg-green-600 hover:bg-green-700"
          >
            {isLoading ? "Lancement..." : "Accepter et Appeler"}
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
