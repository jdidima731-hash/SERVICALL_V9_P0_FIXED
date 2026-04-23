import { useState, useRef, useEffect, useCallback } from "react";
import { logger } from "@/lib/logger";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Phone,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  PhoneIncoming,
  PhoneOutgoing,
  Clock,
 } from 'lucide-react';

// Twilio Device types (will be loaded from CDN)
declare global {
  interface Window {
    
    Twilio?: {
      Device: new (token: string, options?: unknown) => TwilioDevice;
    };
  }
}

interface TwilioDevice {
  on(event: string, handler: (arg?: any) => void): void;
  off(event: string, handler: (arg?: any) => void): void;
  connect(params?: { To?: string }): TwilioCall;
  disconnectAll(): void;
  destroy(): void;
  register(): void;
  unregister(): void;
  updateToken(token: string): void;
}

interface TwilioCall {
  on(event: string, handler: (arg?: any) => void): void;
  disconnect(): void;
  mute(muted: boolean): void;
  sendDigits(digits: string): void;
  status(): string;
  parameters: {
    From?: string;
    To?: string;
    CallSid?: string;
  };
}

interface ActiveCall {
  call: TwilioCall;
  direction: "inbound" | "outbound";
  phoneNumber: string;
  status: "connecting" | "ringing" | "active" | "on-hold";
  duration: number;
  startTime: Date;
  callSid?: string;
}


export function SoftphoneWebRTC() {
  // const {_tenantId} = useTenant();
  const [device, setDevice] = useState<TwilioDevice | null>(null);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check if Twilio is configured
  const { data: configData } = trpc.communication.softphone.checkTwilioConfig.useQuery(undefined, {
    staleTime: 30000,
  });
  const isConfigured = configData?.isConfigured;

  // Get Twilio access token from backend
  const { data: tokenData, refetch: refetchToken } = trpc.communication.phone.getAccessToken.useQuery(
    undefined,
    {
      enabled: false,
      retry: false,
    }
  );

  // Initialize Twilio Device
  useEffect(() => {
    const initializeTwilioDevice = async () => {
      try {
        // Load Twilio SDK from CDN if not already loaded
        if (!window.Twilio) {
          const script = document.createElement("script");
          script.src = "https://sdk.twilio.com/js/client/v1.14/twilio.min.js";
          script.async = true;
          script.onload = () => {
            logger.info("[Softphone] Twilio SDK loaded");
            refetchToken();
          };
          script.onerror = () => {
            setError("Impossible de charger le SDK Twilio");
            toast.error("Erreur de chargement du SDK Twilio");
          };
          document.body.appendChild(script);
        } else {
          refetchToken();
        }
      } catch (err: any) {
        console.error("[Softphone] Initialization error:", err);
        setError("Erreur d'initialisation");
        toast.error("Erreur d'initialisation du softphone");
      }
    };

    initializeTwilioDevice();

    return () => {
      if (device) {
        device.destroy();
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, []);

  // Setup device when token is received
  useEffect(() => {
    if (tokenData?.token && window.Twilio) {
      try {
        const twilioDevice = new window.Twilio.Device(tokenData.token, {
          codecPreferences: ["opus", "pcmu"],
          fakeLocalDTMF: true,
          enableRingingState: true,
        });

        // Device ready
        twilioDevice.on("ready", () => {
          logger.info("[Softphone] Device ready");
          setIsInitialized(true);
          setIsRegistered(true);
          toast.success("Softphone prêt");
        });

        // Device error
        twilioDevice.on("error", (error: any) => {
          console.error("[Softphone] Device error:", error);
          setError(error.message);
          toast.error(`Erreur: ${error.message}`);
        });

        // Incoming call
        
        twilioDevice.on("incoming", (call: TwilioCall) => {
          logger.info("[Softphone] Incoming call:", call.parameters);
          
          const incomingCall: ActiveCall = {
            call,
            direction: "inbound",
            phoneNumber: call.parameters.From || "Inconnu",
            status: "ringing",
            duration: 0,
            startTime: new Date(),
            callSid: call.parameters.CallSid,
          };

          setActiveCall(incomingCall);
          toast.info(`Appel entrant de ${incomingCall.phoneNumber}`, {
            duration: 10000,
          });

          // Setup call event handlers
          setupCallHandlers(call, incomingCall);
        });

        // Device offline
        twilioDevice.on("offline", () => {
          logger.info("[Softphone] Device offline");
          setIsRegistered(false);
          toast.warning("Softphone hors ligne");
        });

        // Register the device
        twilioDevice.register();
        setDevice(twilioDevice as TwilioDevice);
      } catch (err: any) {
        console.error("[Softphone] Device setup error:", err);
        setError("Erreur de configuration");
        toast.error("Erreur de configuration du softphone");
      }
    }
  }, [tokenData]);

  // Setup call event handlers
  const setupCallHandlers = useCallback((call: TwilioCall, _callData: ActiveCall) => {
    call.on("accept", () => {
      logger.info("[Softphone] Call accepted");
      setActiveCall((prev) => prev ? { ...prev, status: "active" } : null);
      startDurationTimer();
      toast.success("Appel connecté");
    });

    call.on("disconnect", () => {
      logger.info("[Softphone] Call disconnected");
      setActiveCall(null);
      setIsMuted(false);
      stopDurationTimer();
      toast.info("Appel terminé");
    });

    call.on("cancel", () => {
      logger.info("[Softphone] Call cancelled");
      setActiveCall(null);
      toast.info("Appel annulé");
    });

    call.on("reject", () => {
      logger.info("[Softphone] Call rejected");
      setActiveCall(null);
      toast.info("Appel rejeté");
    });

    call.on("error", (error: any) => {
      console.error("[Softphone] Call error:", error);
      if (error.code === 31000) {
        toast.error("Erreur de micro : Veuillez autoriser l'accès au microphone");
      } else {
        toast.error(`Erreur d'appel: ${error.message}`);
      }
      setActiveCall(null);
      stopDurationTimer();
    });
  }, []);

  // Start duration timer
  const startDurationTimer = () => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }

    durationIntervalRef.current = setInterval(() => {
      setActiveCall((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          duration: Math.floor((Date.now() - prev.startTime.getTime()) / 1000),
        };
      });
    }, 1000);
  };

  // Stop duration timer
  const stopDurationTimer = () => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  };

  // Create call record mutation
  const createCallMutation = trpc.communication.calls.create.useMutation();

  // Make outbound call
  const handleCall = async () => {
    if (!device || !phoneNumber.trim()) {
      toast.error("Veuillez entrer un numéro de téléphone");
      return;
    }

    try {
      const call = device.connect({
        To: phoneNumber,
      });

      const outgoingCall: ActiveCall = {
        call,
        direction: "outbound",
        phoneNumber,
        status: "connecting",
        duration: 0,
        startTime: new Date(),
      };

      setActiveCall(outgoingCall);
      setPhoneNumber("");
      toast.info(`Appel vers ${phoneNumber}...`);

      setupCallHandlers(call, outgoingCall);

      // Create call record in database
      await createCallMutation.mutateAsync({
        fromNumber: "WebRTC",
        toNumber: phoneNumber,
        direction: "outbound",
        status: "in-progress",
      });
    } catch (err: any) {
      console.error("[Softphone] Call error:", err);
      toast.error("Erreur lors de l'appel");
    }
  };

  // Answer incoming call
  const handleAnswer = () => {
    if (activeCall && activeCall.status === "ringing") {
      activeCall.call.on("accept", () => {
        setActiveCall((prev) => prev ? { ...prev, status: "active" } : null);
        startDurationTimer();
      });
      // Accept is automatic when call handlers are set up
      toast.success("Appel accepté");
    }
  };

  // Hangup call
  const handleHangup = () => {
    if (activeCall) {
      activeCall.call.disconnect();
      setActiveCall(null);
      setIsMuted(false);
      stopDurationTimer();
    }
  };

  // Toggle mute
  const handleToggleMute = () => {
    if (activeCall) {
      const newMutedState = !isMuted;
      activeCall.call.mute(newMutedState);
      setIsMuted(newMutedState);
      toast.info(newMutedState ? "Micro coupé" : "Micro activé");
    }
  };

  // Toggle speaker (note: browser limitation - this is more of a UI indicator)
  const handleToggleSpeaker = () => {
    setIsSpeakerOn(!isSpeakerOn);
    toast.info(isSpeakerOn ? "Haut-parleur désactivé" : "Haut-parleur activé");
  };

  // Send DTMF digits
  const handleDigitPress = (digit: string) => {
    if (activeCall && activeCall.status === "active") {
      activeCall.call.sendDigits(digit);
    } else {
      setPhoneNumber((prev) => prev + digit);
    }
  };

  // Format duration
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Render status indicator
  const renderStatusIndicator = () => {
    if (!isInitialized) {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="w-2 h-2 rounded-full bg-gray-400 animate-pulse" />
          Initialisation...
        </div>
      );
    }

    if (!isRegistered) {
      return (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          Hors ligne
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 text-sm text-green-600">
        <div className="w-2 h-2 rounded-full bg-green-500" />
        En ligne
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Status Bar */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Softphone WebRTC</h3>
          {renderStatusIndicator()}
        </div>
        {error && (
          <p className="text-sm text-destructive mt-2">{error}</p>
        )}
      </Card>

      {/* Active Call Display */}
      {activeCall && (
        <Card className="p-6 bg-gradient-to-br from-primary/10 to-primary/5">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-2">
              {activeCall.direction === "inbound" ? (
                <PhoneIncoming className="w-6 h-6 text-green-600" />
              ) : (
                <PhoneOutgoing className="w-6 h-6 text-blue-600" />
              )}
              <span className="text-sm font-medium text-muted-foreground">
                {activeCall.direction === "inbound" ? "Appel entrant" : "Appel sortant"}
              </span>
            </div>

            <div>
              <p className="text-3xl font-bold text-primary">
                {activeCall.phoneNumber}
              </p>
              <div className="flex items-center justify-center gap-2 mt-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <p className="text-lg text-muted-foreground">
                  {formatDuration(activeCall.duration)}
                </p>
              </div>
              <p className="text-sm text-muted-foreground mt-1 capitalize">
                {activeCall.status === "connecting" && "Connexion..."}
                {activeCall.status === "ringing" && "Sonnerie..."}
                {activeCall.status === "active" && "En cours"}
                {activeCall.status === "on-hold" && "En attente"}
              </p>
            </div>

            {/* Call Controls */}
            <div className="flex items-center justify-center gap-4">
              {activeCall.status === "ringing" && activeCall.direction === "inbound" && (
                <Button
                  variant="default"
                  size="icon"
                  onClick={handleAnswer}
                  className="rounded-full w-14 h-14 bg-green-600 hover:bg-green-700"
                >
                  <Phone className="w-6 h-6" />
                </Button>
              )}

              {activeCall.status === "active" && (
                <>
                  <Button
                    variant={isMuted ? "destructive" : "outline"}
                    size="icon"
                    onClick={handleToggleMute}
                    className="rounded-full w-12 h-12"
                  >
                    {isMuted ? (
                      <MicOff className="w-5 h-5" />
                    ) : (
                      <Mic className="w-5 h-5" />
                    )}
                  </Button>

                  <Button
                    variant={isSpeakerOn ? "default" : "outline"}
                    size="icon"
                    onClick={handleToggleSpeaker}
                    className="rounded-full w-12 h-12"
                  >
                    {isSpeakerOn ? (
                      <Volume2 className="w-5 h-5" />
                    ) : (
                      <VolumeX className="w-5 h-5" />
                    )}
                  </Button>
                </>
              )}

              <Button
                variant="destructive"
                size="icon"
                onClick={handleHangup}
                className="rounded-full w-14 h-14"
              >
                <PhoneOff className="w-6 h-6" />
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Dial Pad */}
      {!activeCall && (
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                type="tel"
                value={phoneNumber}
                onChange={(e: any) => setPhoneNumber(e.target.value)}
                onKeyPress={(e: any) => {
                  if (e.key === "Enter") {
                    handleCall();
                  }
                }}
                placeholder={isConfigured === false ? "Twilio non configuré — voir Paramètres" : "+33 6 12 34 56 78"}  // ✅ FIX P1-A
                className="flex-1 text-lg"
                disabled={!isRegistered || isConfigured === false}
              />
              <Button
                onClick={handleCall}
                disabled={!phoneNumber.trim() || !isRegistered || isConfigured === false}
                className="gap-2"
                size="lg"
                variant={isConfigured === false ? "secondary" : "default"}
              >
                {isConfigured === false ? <VolumeX className="w-5 h-5" /> : <Phone className="w-5 h-5" />}
                {isConfigured === false ? "Désactivé" : "Appeler"}
              </Button>
            </div>
            {isConfigured === false && (
              <p className="text-[10px] text-orange-600 mt-1 font-medium text-center">
                ⚠️ Twilio non configuré. Mode démonstration uniquement.
              </p>
            )}

            {/* Dial Pad Buttons */}
            <div className="grid grid-cols-3 gap-2">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map(
                (digit) => (
                  <Button
                    key={digit}
                    variant="outline"
                    onClick={() => handleDigitPress(digit)}
                    className="h-14 text-xl font-semibold"
                    disabled={!isRegistered}
                  >
                    {digit}
                  </Button>
                )
              )}
            </div>

            {/* Backspace */}
            <Button
              variant="outline"
              onClick={() => setPhoneNumber((prev) => prev.slice(0, -1))}
              className="w-full"
              disabled={!phoneNumber || !isRegistered}
            >
              ← Effacer
            </Button>
          </div>
        </Card>
      )}

      {/* Instructions */}
      {!activeCall && !isRegistered && (
        <Card className="p-4 bg-muted/50">
          <p className="text-sm text-muted-foreground text-center">
            Le softphone se connecte... Veuillez patienter.
          </p>
        </Card>
      )}
    </div>
  );
}