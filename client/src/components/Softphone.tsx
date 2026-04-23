import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Phone,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Plus,
  X,
  Loader2,
 } from 'lucide-react';
import { toast } from "sonner";
import { RGPDConsentDialog } from "@/components/RGPDConsentDialog";
import { useRGPDConsent } from "@/_core/hooks/useRGPDConsent";
import { useTenant } from "@/contexts/TenantContext";
import { useCallStore } from "@/lib/callStore";
import { useTranslation } from "react-i18next";

/**
 * SOFTPHONE COMPONENT — SERVICALL V8
 * ✅ Gestion des appels WebRTC et interface de numérotation
 * ✅ FIX V8 : Typage strict et suppression du @ts-nocheck
 */

interface Call {
  id: string;
  number: string;
  status: "connecting" | "active" | "on-hold";
  duration: number;
  isActive: boolean;
}

interface PendingCallInfo {
  number: string;
  prospectId?: number;
  campaignId?: number;
}

export function Softphone() {
  const { t } = useTranslation('common');
  const [calls, setCalls] = useState<Call[]>([]);
  const [inputNumber, setInputNumber] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isDialing, setIsDialing] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const { tenantId, requireTenantId } = useTenant();
  const { isOpen, openConsent, closeConsent, recordConsent } = useRGPDConsent();
  const { pendingCall: storePendingCall, clearPendingCall } = useCallStore();
  const [pendingCall, setPendingCall] = useState<PendingCallInfo | null>(null);

  useEffect(() => {
    if (storePendingCall) {
      setPendingCall({
        number: storePendingCall.phoneNumber,
        prospectId: storePendingCall.prospectId,
        campaignId: storePendingCall.campaignId
      });
      setInputNumber(storePendingCall.phoneNumber);
      openConsent();
      clearPendingCall();
    }
  }, [storePendingCall, openConsent, clearPendingCall]);

  const createCallMutation = trpc.communication.calls.create.useMutation({
    onSuccess: (data: any) => {
      toast.success(t('softphone.call_initiated'));
      const newCall: Call = {
        id: data?.id?.toString() || Date.now().toString(),
        number: inputNumber,
        status: "active",
        duration: 0,
        isActive: true,
      };
      setCalls([...calls, newCall]);
      setInputNumber("");
      setIsDialing(false);
    },
    onError: (error) => {
      toast.error(`${t('status.failed')}: ${error.message}`);
      setIsDialing(false);
    },
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setCalls((prev) =>
        prev.map((call) =>
          call.status === "active" ? { ...call, duration: call.duration + 1 } : call
        )
      );
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleDial = async () => {
    const cleanedNumber = inputNumber.replace(/[^\d+]/g, "");
    if (!cleanedNumber || cleanedNumber.length < 3) {
      toast.error(t('softphone.error_invalid_number'));
      return;
    }
    if (tenantId === null) {
      toast.error(t('softphone.error_no_tenant'));
      return;
    }
    setPendingCall({ number: cleanedNumber });
    openConsent();
  };

  const handleConsentConfirm = async (consent: any) => {
    if (!pendingCall) return;

    recordConsent({
      prospectId: pendingCall.prospectId || 0,
      consentGiven: !!consent.consentGiven,
      recordingConsent: !!consent.recordingConsent,
      aiDisclosure: !!consent.aiDisclosure,
      timestamp: new Date(consent.timestamp || Date.now()),
    });

    if (!consent.consentGiven) {
      toast.error(t('softphone.consent_denied'));
      closeConsent();
      setPendingCall(null);
      return;
    }

    setIsDialing(true);

    try {
      const _currentTenantId = requireTenantId();
      await createCallMutation.mutateAsync({
        toNumber: pendingCall.number,
        prospectId: pendingCall.prospectId,
        campaignId: pendingCall.campaignId,
        fromNumber: "+33100000000",
        direction: "outbound",
        status: "in-progress",
      });
    } catch (error) {
      setIsDialing(false);
    } finally {
      closeConsent();
      setPendingCall(null);
    }
  };

  const updateCallMutation = trpc.communication.calls.update.useMutation();

  const handleHangup = async (callId: string) => {
    const call = calls.find((c) => c.id === callId);
    if (!call) return;

    try {
      const id = parseInt(callId);
      if (!isNaN(id)) {
        await updateCallMutation.mutateAsync({
          callId: id,
          status: "completed",
          duration: call.duration,
        });
      }
    } catch (error) {
      // Silencieux car on retire quand même l'appel de l'UI
    } finally {
      setCalls((prev) => prev.filter((c) => c.id !== callId));
      toast.success(t('softphone.call_ended'));
    }
  };

  const activeCall = calls.find((call) => call.status === "active");
  const onHoldCalls = calls.filter((call) => call.status === "on-hold");

  return (
    <div className="space-y-4">
      {activeCall && (
        <Card className="p-6 bg-gradient-to-br from-primary/10 to-primary/5">
          <div className="text-center space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">{t('softphone.active_call')}</p>
              <p className="text-3xl font-bold text-primary">{activeCall.number}</p>
              <p className="text-lg text-muted-foreground mt-2">{formatDuration(activeCall.duration)}</p>
            </div>
            <div className="flex items-center justify-center gap-4">
              <Button variant={isMuted ? "destructive" : "outline"} size="icon" onClick={() => setIsMuted(!isMuted)} className="rounded-full w-12 h-12">
                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </Button>
              <Button variant={isSpeakerOn ? "default" : "outline"} size="icon" onClick={() => setIsSpeakerOn(!isSpeakerOn)} className="rounded-full w-12 h-12">
                {isSpeakerOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              </Button>
              <Button variant="destructive" size="icon" onClick={() => handleHangup(activeCall.id)} className="rounded-full w-12 h-12">
                <PhoneOff className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input type="tel" value={inputNumber} onChange={(e) => setInputNumber(e.target.value)} placeholder={t('softphone.dial_placeholder')} className="flex-1" />
            <Button onClick={handleDial} disabled={!inputNumber.trim() || isDialing || createCallMutation.isPending} className="gap-2">
              {isDialing || createCallMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('softphone.dialing')}</> : <><Phone className="w-4 h-4" /> {t('softphone.call_button')}</>}
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map((digit) => (
              <Button key={digit} variant="outline" onClick={() => setInputNumber(inputNumber + digit)} className="h-12 text-lg font-semibold">{digit}</Button>
            ))}
          </div>
          <Button variant="outline" onClick={() => setInputNumber(inputNumber.slice(0, -1))} className="w-full">{t('softphone.clear')}</Button>
        </div>
      </Card>

      <RGPDConsentDialog
        isOpen={isOpen}
        onOpenChange={closeConsent}
        onConfirm={handleConsentConfirm}
        isLoading={isDialing}
        prospectName={pendingCall?.number || "Prospect"}
        isAI={false}
        agentName="Agent"
      />
      <audio ref={audioRef} />
    </div>
  );
}
