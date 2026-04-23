import { useState, useEffect } from "react";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Phone,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Pause,
  Play,
  X,
  Minimize2,
  Maximize2,
  PhoneForwarded,
  MoreVertical,
 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface FloatingWebphoneProps {
  initialPhone?: string;
  onClose?: () => void;
}

type CallStatus = "idle" | "dialing" | "ringing" | "connected" | "on-hold";

export function FloatingWebphone({ initialPhone = "", onClose }: FloatingWebphoneProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState(initialPhone);
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [position, setPosition] = useState({ x: window.innerWidth - 400, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Timer pour la durée d'appel
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (callStatus === "connected") {
      interval = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => clearInterval(interval);
  }, [callStatus]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button, input")) return;
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y,
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  const handleDialPad = (digit: string) => {
    if (callStatus === "connected") {
      // Envoyer DTMF
      toast.info(`DTMF: ${digit}`);
    } else {
      setPhoneNumber((prev) => prev + digit);
    }
  };

  const handleCall = () => {
    if (!phoneNumber) {
      toast.error("Veuillez saisir un numéro");
      return;
    }
    setCallStatus("dialing");
    // Simuler la connexion
    setTimeout(() => setCallStatus("ringing"), 1000);
    setTimeout(() => setCallStatus("connected"), 3000);
    toast.success(`Appel vers ${phoneNumber}`);
  };

  const handleHangup = () => {
    setCallStatus("idle");
    setCallDuration(0);
    setIsMuted(false);
    toast.info("Appel terminé");
  };

  const handleHold = () => {
    if (callStatus === "connected") {
      setCallStatus("on-hold");
      toast.info("Appel en attente");
    } else if (callStatus === "on-hold") {
      setCallStatus("connected");
      toast.info("Appel repris");
    }
  };

  const handleTransfer = () => {
    toast.info("Fonction de transfert - À implémenter");
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getStatusColor = () => {
    switch (callStatus) {
      case "dialing":
      case "ringing":
        return "bg-yellow-500";
      case "connected":
        return "bg-green-500";
      case "on-hold":
        return "bg-orange-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusText = () => {
    switch (callStatus) {
      case "dialing":
        return "Composition...";
      case "ringing":
        return "Sonnerie...";
      case "connected":
        return formatDuration(callDuration);
      case "on-hold":
        return "En attente";
      default:
        return "Prêt";
    }
  };

  return (
    <div
      className={cn(
        "fixed z-50 shadow-2xl rounded-xl border border-border bg-card",
        isDragging && "cursor-grabbing",
        !isDragging && "cursor-grab"
      )}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: isMinimized ? "280px" : "360px",
      }}
      onMouseDown={handleMouseDown}
    >
      <CardHeader className="border-b border-border pb-3 pt-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn("w-2 h-2 rounded-full animate-pulse", getStatusColor())} />
            <CardTitle className="text-sm font-semibold">Webphone</CardTitle>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setIsMinimized(!isMinimized)}
            >
              {isMinimized ? <Maximize2 className="h-3 w-3" /> : <Minimize2 className="h-3 w-3" />}
            </Button>
            {onClose && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      {!isMinimized && (
        <CardContent className="pt-4 pb-4 px-4 space-y-4">
          {/* Status & Duration */}
          <div className="text-center">
            <Badge variant="outline" className={cn("mb-2", getStatusColor().replace("bg-", "text-"))}>
              {getStatusText()}
            </Badge>
            {phoneNumber && (
              <p className="text-lg font-semibold">{phoneNumber}</p>
            )}
          </div>

          {/* Phone Number Input */}
          {callStatus === "idle" && (
            <Input
              type="tel"
              placeholder="Numéro de téléphone"
              value={phoneNumber}
              onChange={(e: any) => setPhoneNumber(e.target.value)}
              className="text-center text-lg rounded-xl"
            />
          )}

          {/* Dial Pad */}
          {(callStatus === "idle" || callStatus === "connected") && (
            <div className="grid grid-cols-3 gap-2">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map((digit) => (
                <Button
                  key={digit}
                  variant="outline"
                  className="h-12 text-lg font-semibold rounded-xl hover:scale-[0.98] active:scale-95 transition-transform"
                  onClick={() => handleDialPad(digit)}
                >
                  {digit}
                </Button>
              ))}
            </div>
          )}

          {/* Call Controls */}
          <div className="flex items-center justify-center gap-2">
            {callStatus === "idle" ? (
              <Button
                size="lg"
                className="rounded-full h-14 w-14 bg-green-500 hover:bg-green-600 hover:scale-[0.98] active:scale-95 transition-transform"
                onClick={handleCall}
              >
                <Phone className="h-6 w-6" />
              </Button>
            ) : (
              <>
                {/* Mute */}
                <Button
                  variant="outline"
                  size="icon"
                  className={cn(
                    "rounded-full h-12 w-12 hover:scale-[0.98] active:scale-95 transition-transform",
                    isMuted && "bg-red-500/10 border-red-500"
                  )}
                  onClick={() => setIsMuted(!isMuted)}
                >
                  {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </Button>

                {/* Hold */}
                <Button
                  variant="outline"
                  size="icon"
                  className={cn(
                    "rounded-full h-12 w-12 hover:scale-[0.98] active:scale-95 transition-transform",
                    callStatus === "on-hold" && "bg-orange-500/10 border-orange-500"
                  )}
                  onClick={handleHold}
                >
                  {callStatus === "on-hold" ? (
                    <Play className="h-5 w-5" />
                  ) : (
                    <Pause className="h-5 w-5" />
                  )}
                </Button>

                {/* Hangup */}
                <Button
                  size="lg"
                  className="rounded-full h-14 w-14 bg-red-500 hover:bg-red-600 hover:scale-[0.98] active:scale-95 transition-transform"
                  onClick={handleHangup}
                >
                  <PhoneOff className="h-6 w-6" />
                </Button>

                {/* Speaker */}
                <Button
                  variant="outline"
                  size="icon"
                  className={cn(
                    "rounded-full h-12 w-12 hover:scale-[0.98] active:scale-95 transition-transform",
                    isSpeakerOn && "bg-blue-500/10 border-blue-500"
                  )}
                  onClick={() => setIsSpeakerOn(!isSpeakerOn)}
                >
                  {isSpeakerOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
                </Button>

                {/* More Options */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="rounded-full h-12 w-12 hover:scale-[0.98] active:scale-95 transition-transform"
                    >
                      <MoreVertical className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleTransfer}>
                      <PhoneForwarded className="w-4 h-4 mr-2" />
                      Transférer
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>

          {/* Scripts prédéfinis (si en appel) */}
          {callStatus === "connected" && (
            <div className="border-t border-border pt-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Scripts
              </p>
              <div className="space-y-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs rounded-xl hover:scale-[0.98] active:scale-95 transition-transform"
                  onClick={() => toast.info("Script: Présentation")}
                >
                  📋 Présentation
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs rounded-xl hover:scale-[0.98] active:scale-95 transition-transform"
                  onClick={() => toast.info("Script: Objections")}
                >
                  💬 Réponse aux objections
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs rounded-xl hover:scale-[0.98] active:scale-95 transition-transform"
                  onClick={() => toast.info("Script: Closing")}
                >
                  ✅ Closing
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      )}
    </div>
  );
}
