
import React, { useState } from "react";
import { Phone,
  PhoneOff,
  Volume2,
  Mic,
  MicOff,
  ArrowRightLeft,
  Delete,
  X,
 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { trpc, RouterOutputs } from "@/lib/trpc";
import { toast } from "sonner";

interface PhoneDialerProps {
  isOpen: boolean;
  onClose: () => void;
  onCall?: (phoneNumber: string) => void;
  onTransfer?: (phoneNumber: string) => void;
  currentCallActive?: boolean;
  activeCallId?: number; // ✅ FIX P1-A — ID du vrai appel actif
}

export function PhoneDialer({
  isOpen,
  onClose,
  onCall,
  onTransfer,
  currentCallActive = false,
  activeCallId,
}: PhoneDialerProps) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isCallActive, setIsCallActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  // tRPC Mutations for real actions
  
  type BlindTransferOutput = RouterOutputs["softphone"]["blindTransfer"];
  const blindTransferMutation = trpc.communication.softphone.blindTransfer.useMutation({
    onSuccess: (data: BlindTransferOutput) => {
      toast.success(data.message);
    },
    onError: (error) => {
      toast.error(`Erreur de transfert: ${error.message}`);
    }
  });

  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isCallActive) {
      interval = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isCallActive]);

  const handleDigitClick = (digit: string) => {
    setPhoneNumber((prev) => prev + digit);
  };

  const handleDelete = () => {
    setPhoneNumber((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPhoneNumber("");
  };

  const handleCall = () => {
    if (phoneNumber.trim()) {
      onCall?.(phoneNumber);
      setIsCallActive(true);
      setCallDuration(0);
    }
  };

  const handleEndCall = () => {
    setIsCallActive(false);
    setCallDuration(0);
    setPhoneNumber("");
  };

  const handleTransfer = async () => {
    if (phoneNumber.trim() && isCallActive) {
      // Use real API for transfer if we have a call ID (mocked here as 1)
      await blindTransferMutation.mutateAsync({
        callId: activeCallId ?? 0, // ✅ FIX P1-A — vrai callId depuis le contexte
        targetPhoneNumber: phoneNumber
      });
      
      onTransfer?.(phoneNumber);
      handleEndCall();
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }
    return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const dialPad = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    ["*", "0", "#"],
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Clavier Téléphonique</DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Display */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-lg p-6 text-center">
            {(isCallActive || currentCallActive) && (
              <div className="mb-4 text-sm text-green-400 font-semibold">
                Appel en cours • {formatDuration(callDuration)}
              </div>
            )}
            <div className="text-3xl font-bold text-white tracking-widest mb-2 font-mono">
              {phoneNumber || "---"}
            </div>
            {(isCallActive || currentCallActive) && (
              <div className="text-xs text-slate-400">Appel actif</div>
            )}
          </div>

          {/* Phone Number Input */}
          <Input
            type="tel"
            placeholder="Entrez un numéro..."
            value={phoneNumber}
            onChange={(e: any) => setPhoneNumber(e.target.value)}
            className="text-center text-lg font-mono"
          />

          {/* Dial Pad */}
          <div className="grid grid-cols-3 gap-3">
            {dialPad.map((row, rowIndex) => (
              <React.Fragment key={rowIndex}>
                {row.map((digit) => (
                  <Button
                    key={digit}
                    onClick={() => handleDigitClick(digit)}
                    variant="outline"
                    className="h-12 text-lg font-semibold hover:bg-primary hover:text-white transition-colors"
                  >
                    {digit}
                  </Button>
                ))}
              </React.Fragment>
            ))}
          </div>

          {/* Control Buttons */}
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMuted(!isMuted)}
              className={isMuted ? "bg-red-500/20 text-red-600" : ""}
            >
              {isMuted ? (
                <MicOff className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </Button>
            <Button variant="ghost" size="sm">
              <Volume2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              className="text-red-600 hover:bg-red-500/10"
            >
              <Delete className="h-4 w-4" />
            </Button>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            {!(isCallActive || currentCallActive) ? (
              <>
                <Button
                  onClick={handleClear}
                  variant="outline"
                  className="gap-2"
                >
                  Effacer
                </Button>
                <Button
                  onClick={handleCall}
                  disabled={!phoneNumber.trim()}
                  className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                >
                  <Phone className="h-4 w-4" />
                  Appeler
                </Button>
              </>
            ) : (
              <>
                <Button
                  onClick={handleTransfer}
                  disabled={!phoneNumber.trim()}
                  variant="outline"
                  className="gap-2"
                >
                  <ArrowRightLeft className="h-4 w-4" />
                  Transférer
                </Button>
                <Button
                  onClick={handleEndCall}
                  className="gap-2 bg-red-600 hover:bg-red-700 text-white"
                >
                  <PhoneOff className="h-4 w-4" />
                  Raccrocher
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}