
/**
 * LIVE SUPERVISION PANEL — Supervision temps réel des appels agents
 * ─────────────────────────────────────────────────────────────────────────────
 * Composant intégrable dans le ManagerDashboard pour :
 *  - Afficher la liste des appels agents actifs
 *  - Démarrer/arrêter l'écoute d'un appel
 *  - Changer le mode (listen/whisper/barge)
 *  - WebRTC Twilio Device pour l'audio depuis le navigateur
 *
 * Thème : Compatible avec le design sombre du dashboard existant
 */

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Headphones,
  Mic,
  MicOff,
  Volume2,
  PhoneOff,
  AlertCircle,
  Loader,
  Eye,
  EyeOff,
  Radio,
 } from 'lucide-react';
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

// ── Twilio Device Types ────────────────────────────────────────────────────

declare global {
  interface Window {
    Twilio?: {
      Device: new (token: string, options?: unknown) => TwilioDevice;
    };
  }
}

interface TwilioDevice {
  on(event: string, handler: (...args: unknown[]) => void): void;
  off(event: string, handler: (...args: unknown[]) => void): void;
  connect(params?: { To?: string }): TwilioCall;
  disconnectAll(): void;
  destroy(): void;
  register(): void;
  unregister(): void;
  updateToken(token: string): void;
}

interface TwilioCall {
  on(event: string, handler: (...args: unknown[]) => void): void;
  disconnect(): void;
  mute(muted: boolean): void;
  parameters: {
    From?: string;
    To?: string;
    CallSid?: string;
  };
}

// ── Types locaux ──────────────────────────────────────────────────────────

type SupervisionMode = "listen" | "whisper" | "barge";

interface ActiveCall {
  callSid: string;
  agentId: number;
  agentName: string;
  prospectName: string;
  prospectPhone: string;
  startedAt: string;
  durationSeconds: number;
  isSupervised: boolean;
  supervisorCount: number;
}

interface SupervisionSession {
  callSid: string;
  mode: SupervisionMode;
  conferenceName: string;
  device: TwilioDevice | null;
  call: TwilioCall | null;
  isMuted: boolean;
  isSpeakerOn: boolean;
}

// ── Composant principal ────────────────────────────────────────────────────

export function LiveSupervisionPanel() {
  const [activeCalls, setActiveCalls] = useState<ActiveCall[]>([]);
  const [supervisionSession, setSupervisionSession] = useState<SupervisionSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [_isInitializing, setIsInitializing] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const deviceRef = useRef<TwilioDevice | null>(null);

  // ── tRPC Queries & Mutations ───────────────────────────────────────────

  const { data: callsData, refetch: refetchCalls, isLoading: callsLoading } = trpc.communication.liveListening.getActiveCalls.useQuery(
    undefined,
    { refetchInterval: 3000 } // Rafraîchir toutes les 3s
  );

  const { refetch: refetchToken } = trpc.communication.liveListening.getSupervisorToken.useQuery(undefined, {
    enabled: false,
    retry: false,
  });

  const startSupervisionMutation = trpc.communication.liveListening.startSupervision.useMutation();
  const changeModeMutation = trpc.communication.liveListening.changeMode.useMutation();
  const stopSupervisionMutation = trpc.communication.liveListening.stopSupervision.useMutation();

  // ── Mise à jour de la liste des appels ─────────────────────────────────

  useEffect(() => {
    if (callsData?.calls) {
      setActiveCalls(callsData.calls);
    }
  }, [callsData]);

  // ── Initialisation du Twilio Device ────────────────────────────────────

  const initializeTwilioDevice = async () => {
    try {
      setIsInitializing(true);

      // Charger le SDK Twilio si nécessaire
      if (!window.Twilio) {
        const script = document.createElement("script");
        script.src = "https://sdk.twilio.com/js/client/v1.14/twilio.min.js";
        script.async = true;
        const loadPromise = new Promise<void>((resolve: any) => {
          script.onload = resolve;
        });
        document.head.appendChild(script);
        await loadPromise;
      }

      // ✅ FIX : Déclencher (refetch) AVANT l'initialisation pour garantir la présence d'un token valide
      const { data: tokenData } = await refetchToken();
      const token = tokenData?.token;
      
      if (!token) {
        toast.error("Impossible de générer le token superviseur");
        return;
      }

      // Créer le device
      if (window.Twilio) {
        const device = new window.Twilio.Device(token, {
          logLevel: 1,
          codecPreferences: ["opus", "pcmu"],
        });

        device.on("ready", () => {
          logger.info("[LiveSupervision] Device ready");
          deviceRef.current = device;
        });

        device.on("error", (error: any) => {
          logger.error("[LiveSupervision] Device error", error);
          toast.error(`Erreur Twilio : ${error.message}`);
        });

        device.on("disconnect", () => {
          logger.info("[LiveSupervision] Device disconnected");
          setSupervisionSession(null);
          setCallDuration(0);
        });

        device.register();
        
        // Attendre que le device soit prêt (optionnel mais recommandé)
        await new Promise<void>((resolve: any) => {
          const checkReady = () => {
            if (deviceRef.current) resolve(true);
            else setTimeout(checkReady, 100);
          };
          checkReady();
        });
      }
    } catch (error: any) {
      logger.error("[LiveSupervision] Initialization error", error);
      toast.error("Impossible d'initialiser le device Twilio");
    } finally {
      setIsInitializing(false);
    }
  };

  // ── Démarrer la supervision ────────────────────────────────────────────

  const handleStartSupervision = async (call: ActiveCall, mode: SupervisionMode = "listen") => {
    try {
      setIsLoading(true);

      // Initialiser le device si nécessaire
      if (!deviceRef.current) {
        await initializeTwilioDevice();
      }

      // Démarrer la supervision
      const result = await startSupervisionMutation.mutateAsync({
        callSid: call.callSid,
        mode,
      });

      // Connecter le superviseur à la Conference
      if (deviceRef.current && result.conferenceName) {
        const supervisorCall = deviceRef.current.connect({
          To: result.conferenceName,
        });

        supervisorCall.on("connect", () => {
          logger.info("[LiveSupervision] Connected to conference");
          toast.success(`Supervision démarrée (mode: ${mode})`);
        });

        supervisorCall.on("disconnect", () => {
          logger.info("[LiveSupervision] Disconnected from conference");
          setSupervisionSession(null);
        });

        supervisorCall.on("error", (error: any) => {
          logger.error("[LiveSupervision] Call error", error);
          toast.error(`Erreur appel : ${error.message}`);
        });

        setSupervisionSession({
          callSid: call.callSid,
          mode,
          conferenceName: result.conferenceName,
          device: deviceRef.current,
          call: supervisorCall,
          isMuted: false,
          isSpeakerOn: true,
        });

        // Démarrer le chronomètre
        if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = setInterval(() => {
          setCallDuration((prev) => prev + 1);
        }, 1000);
      }
    } catch (error: any) {
      logger.error("[LiveSupervision] Start supervision error", error);
      toast.error(error.message || "Impossible de démarrer la supervision");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Changer le mode de supervision ─────────────────────────────────────

  const handleChangeMode = async (newMode: SupervisionMode) => {
    if (!supervisionSession) return;

    try {
      await changeModeMutation.mutateAsync({
        callSid: supervisionSession.callSid,
        newMode,
      });

      setSupervisionSession({
        ...supervisionSession,
        mode: newMode,
      });

      toast.success(`Mode changé en ${newMode}`);
    } catch (error: any) {
      logger.error("[LiveSupervision] Change mode error", error);
      toast.error("Impossible de changer le mode");
    }
  };

  // ── Arrêter la supervision ─────────────────────────────────────────────

  const handleStopSupervision = async () => {
    if (!supervisionSession) return;

    try {
      setIsLoading(true);

      // Déconnecter l'appel Twilio
      if (supervisionSession.call) {
        supervisionSession.call.disconnect();
      }

      // Notifier le backend
      await stopSupervisionMutation.mutateAsync({
        callSid: supervisionSession.callSid,
      });

      setSupervisionSession(null);
      setCallDuration(0);
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);

      toast.success("Supervision arrêtée");
    } catch (error: any) {
      logger.error("[LiveSupervision] Stop supervision error", error);
      toast.error("Erreur lors de l'arrêt de la supervision");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Basculer le micro ──────────────────────────────────────────────────

  const handleToggleMute = () => {
    if (supervisionSession?.call) {
      const newMuted = !supervisionSession.isMuted;
      supervisionSession.call.mute(newMuted);
      setSupervisionSession({
        ...supervisionSession,
        isMuted: newMuted,
      });
    }
  };

  // ── Cleanup ────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
      if (deviceRef.current) {
        deviceRef.current.disconnectAll();
        deviceRef.current.destroy();
      }
    };
  }, []);

  // ── Rendu ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Session active */}
      {supervisionSession && (
        <Card className="bg-gradient-to-r from-blue-900/50 to-blue-800/50 border-blue-600">
          <CardHeader>
            <CardTitle className="text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-red-500 animate-pulse" />
                Supervision en cours
              </div>
              <Badge variant="secondary" className="bg-blue-500 text-white border-none">
                {Math.floor(callDuration / 60)}:{(callDuration % 60).toString().padStart(2, "0")}
              </Badge>
            </CardTitle>
            <CardDescription className="text-blue-100">
              Vous écoutez l'appel de <strong>{activeCalls.find(c => c.callSid === supervisionSession.callSid)?.agentName}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button
                variant={supervisionSession.mode === "listen" ? "default" : "outline"}
                size="sm"
                className="gap-2"
                onClick={() => handleChangeMode("listen")}
              >
                <Headphones className="w-4 h-4" />
                Écoute seule
              </Button>
              <Button
                variant={supervisionSession.mode === "whisper" ? "default" : "outline"}
                size="sm"
                className="gap-2"
                onClick={() => handleChangeMode("whisper")}
              >
                <Mic className="w-4 h-4" />
                Chuchoter
              </Button>
              <Button
                variant={supervisionSession.mode === "barge" ? "default" : "outline"}
                size="sm"
                className="gap-2"
                onClick={() => handleChangeMode("barge")}
              >
                <Volume2 className="w-4 h-4" />
                Intervenir
              </Button>
              <div className="flex-1" />
              <Button
                variant="outline"
                size="sm"
                className={supervisionSession.isMuted ? "text-red-500 border-red-500" : ""}
                onClick={handleToggleMute}
              >
                {supervisionSession.isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </Button>
              <Button variant="destructive" size="sm" className="gap-2" onClick={handleStopSupervision}>
                <PhoneOff className="w-4 h-4" />
                Arrêter
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Liste des appels */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Appels Actifs</CardTitle>
              <CardDescription>Agents actuellement en ligne</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetchCalls()} disabled={callsLoading}>
              {callsLoading ? <Loader className="w-4 h-4 animate-spin" /> : "Actualiser"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {activeCalls.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <PhoneOff className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
              <p className="text-muted-foreground">Aucun appel actif pour le moment</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activeCalls.map((call) => (
                <div
                  key={call.callSid}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                      {call.agentName.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium">{call.agentName}</p>
                      <p className="text-sm text-muted-foreground">
                        ↔ {call.prospectName} ({call.prospectPhone})
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-sm font-mono">
                        {Math.floor(call.durationSeconds / 60)}:
                        {(call.durationSeconds % 60).toString().padStart(2, "0")}
                      </p>
                      <div className="flex items-center gap-1 justify-end">
                        <Eye className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{call.supervisorCount}</span>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      className="gap-2"
                      disabled={isLoading || supervisionSession?.callSid === call.callSid}
                      onClick={() => handleStartSupervision(call)}
                    >
                      {supervisionSession?.callSid === call.callSid ? (
                        <>
                          <Radio className="w-4 h-4 animate-pulse" />
                          En cours
                        </>
                      ) : (
                        <>
                          <Headphones className="w-4 h-4" />
                          Écouter
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function _maskName(name: string): string {
  if (!name) return "Inconnu";
  return name.charAt(0) + "*".repeat(name.length - 1);
}

function _maskPhone(phone: string): string {
  if (!phone) return "Masqué";
  return phone.substring(0, 4) + "****" + phone.substring(phone.length - 2);
}
