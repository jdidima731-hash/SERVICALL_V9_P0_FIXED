/**
 * Hook pour gérer le consentement RGPD vocal
 */

import { useState, useCallback } from "react";
import { toast } from "sonner";

export interface RGPDConsentRecord {
  prospectId: number;
  consentGiven: boolean;
  recordingConsent: boolean;
  aiDisclosure: boolean;
  timestamp: Date;
  callSid?: string;
}

/**
 * Hook pour gérer le consentement RGPD
 * @example
 * const { isOpen, openConsent, closeConsent, handleConsent } = useRGPDConsent();
 *
 * const handleCall = async () => {
 *   const consent = await handleConsent({
 *     prospectId: 1,
 *     isAI: true,
 *   });
 *
 *   if (consent.consentGiven) {
 *     await initiateCall(prospectPhone, consent);
 *   }
 * };
 */
export function useRGPDConsent() {
  const [isOpen, setIsOpen] = useState(false);
  const [consentRecords, setConsentRecords] = useState<RGPDConsentRecord[]>([]);
  const [lastConsent, setLastConsent] = useState<RGPDConsentRecord | null>(null);

  const openConsent = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeConsent = useCallback(() => {
    setIsOpen(false);
  }, []);

  const recordConsent = useCallback((consent: RGPDConsentRecord) => {
    setConsentRecords((prev) => [...prev, consent]);
    setLastConsent(consent);

    // Sauvegarder en localStorage pour audit
    const records = JSON.parse(localStorage.getItem("rgpd_consents") || "[]");
    records.push({
      ...consent,
      timestamp: consent.timestamp.toISOString(),
    });
    localStorage.setItem("rgpd_consents", JSON.stringify(records));

    if (consent.consentGiven) {
      toast.success("✅ Consentement enregistré");
    } else {
      toast.warning("⚠️ Consentement refusé");
    }
  }, []);

  const getConsentHistory = useCallback((prospectId: number) => {
    return consentRecords.filter((r) => r.prospectId === prospectId);
  }, [consentRecords]);

  const hasValidConsent = useCallback(
    (prospectId: number, maxAgeMinutes: number = 60) => {
      const history = getConsentHistory(prospectId);
      if (history.length === 0) return false;

      const lastRecord = history[history.length - 1];
      const ageMinutes =
        (Date.now() - lastRecord!.timestamp.getTime()) / (1000 * 60);

      return lastRecord!.consentGiven && ageMinutes <= maxAgeMinutes;
    },
    [getConsentHistory]
  );

  const clearConsents = useCallback(() => {
    setConsentRecords([]);
    setLastConsent(null);
    localStorage.removeItem("rgpd_consents");
    toast.info("Historique de consentement effacé");
  }, []);

  return {
    isOpen,
    openConsent,
    closeConsent,
    recordConsent,
    getConsentHistory,
    hasValidConsent,
    clearConsents,
    lastConsent,
    consentRecords,
  };
}

/**
 * Hook pour afficher les messages RGPD
 */
export function useRGPDMessages() {
  const getHumanCallMessage = (agentName: string, prospectName: string) => {
    return `Bonjour ${prospectName}, ${agentName} de Servicall à l'appareil. Nous aimerions vous appeler et enregistrer cet appel à titre informatif. Acceptez-vous ?`;
  };

  const getAICallMessage = (prospectName: string) => {
    return `Bonjour ${prospectName}. Vous êtes en communication avec une intelligence artificielle de Servicall. Acceptez-vous d'être appelé et enregistré ? Appuyez sur 1 pour accepter, ou 2 pour refuser.`;
  };

  const getConsentConfirmation = (isAI: boolean) => {
    return isAI
      ? "Votre consentement a été enregistré. L'IA va procéder à l'appel."
      : "Votre consentement a été enregistré. L'agent va procéder à l'appel.";
  };

  const getConsentRefusal = () => {
    return "Consentement refusé. L'appel ne sera pas lancé.";
  };

  return {
    getHumanCallMessage,
    getAICallMessage,
    getConsentConfirmation,
    getConsentRefusal,
  };
}
