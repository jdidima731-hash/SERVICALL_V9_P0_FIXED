
import { useState } from "react";
import { trpc, RouterOutputs } from "@/lib/trpc";
import { MessageSquare, 
  Send, 
  Smartphone, 
  MessageCircle, 
  Mail,
  Clock, 
  CheckCircle2, 
  XCircle,
  AlertCircle,
  Loader2,
  Paperclip,
  Type
 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface ProspectMessagingTabProps {
  prospectId: number;
  tenantId: number;
}

export function ProspectMessagingTab({prospectId}: ProspectMessagingTabProps) {
  const [messageType, setMessageType] = useState<"sms" | "whatsapp" | "email">("sms");
  const [content, setContent] = useState("");
  const [subject, setSubject] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");

  const utils = trpc.useUtils();

  // Queries
  
  type MessageOutput = RouterOutputs["messaging"]["list"]["data"][number];
  const { data: messages, isPending: isLoadingMessages } = trpc.communication.messaging.list.useQuery({
    prospectId: parseInt(prospectId.toString())
  });

  
  type TemplateOutput = RouterOutputs["messaging"]["getTemplates"][number];
  const { data: templates } = trpc.communication.messaging.getTemplates.useQuery({
    type: messageType
  });

  // Mutation
  const sendMessage = trpc.communication.messaging.send.useMutation({
    onSuccess: () => {
      const typeLabel = messageType.toUpperCase();
      toast.success(`${typeLabel} envoyé avec succès`);
      setContent("");
      setSubject("");
      setSelectedTemplate("");
      
      utils.communication.messaging.list.invalidate();
      
      utils.communication.messaging.getOmnichannelHistory.invalidate();
    },
    onError: (error) => {
      toast.error(`Échec de l'envoi : ${error.message}`);
    }
  });

  const handleSend = () => {
    if (!content.trim()) {
      toast.error("Veuillez saisir un message");
      return;
    }
    if (messageType === "email" && !subject.trim()) {
      toast.error("Veuillez saisir un objet pour l'email");
      return;
    }
    sendMessage.mutate({
      prospectId: parseInt(prospectId.toString()),
      type: messageType,
      content,
      subject: messageType === "email" ? subject : undefined
    });
  };

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = templates?.find((t: TemplateOutput) => t.id.toString() === templateId);
    if (template) {
      setContent(template.content);
      
      if ((template as any)?.metadata && typeof (template as any)?.metadata === 'object' && 'subject' in (template as any)?.metadata) {
        
        setSubject((template as any)?.metadata.subject as string);
      }
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "sent":
      case "delivered":
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-rose-500" />;
      case "pending":
        return <Clock className="w-4 h-4 text-amber-500 animate-pulse" />;
      default:
        return <AlertCircle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Envoi de message */}
      <Card className="border-none shadow-sm bg-white overflow-hidden">
        <CardHeader className="bg-slate-50 border-b pb-4">
          <CardTitle className="text-lg font-black flex items-center gap-2">
            <Send className="w-5 h-5 text-primary" />
            Nouvelle Communication
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Canal de diffusion</label>
              <div className="flex p-1 bg-slate-100 rounded-xl gap-1">
                <Button 
                  variant={messageType === "sms" ? "default" : "ghost"} 
                  className={cn("flex-1 gap-2 rounded-lg font-bold h-10", messageType === "sms" && "shadow-sm")}
                  onClick={() => setMessageType("sms")}
                >
                  <Smartphone className="w-4 h-4" /> SMS
                </Button>
                <Button 
                  variant={messageType === "whatsapp" ? "default" : "ghost"} 
                  className={cn("flex-1 gap-2 rounded-lg font-bold h-10", messageType === "whatsapp" && "shadow-sm")}
                  onClick={() => setMessageType("whatsapp")}
                >
                  <MessageCircle className="w-4 h-4" /> WhatsApp
                </Button>
                <Button 
                  variant={messageType === "email" ? "default" : "ghost"} 
                  className={cn("flex-1 gap-2 rounded-lg font-bold h-10", messageType === "email" && "shadow-sm")}
                  onClick={() => setMessageType("email")}
                >
                  <Mail className="w-4 h-4" /> Email
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Modèle prédéfini</label>
              <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
                <SelectTrigger className="bg-white border-slate-200 rounded-xl h-12">
                  <SelectValue placeholder="Choisir un modèle..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl shadow-xl">
                  {templates?.map((t: Record<string, unknown>) => (
                    <SelectItem key={t.id as string} value={String(t.id ?? '')} className="font-medium">{String(t.name ?? '')}</SelectItem>
                  ))}
                  {(!templates || templates.length === 0) && (
                    <SelectItem value="none" disabled className="text-muted-foreground italic">Aucun modèle disponible</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {messageType === "email" && (
            <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Objet du message</label>
              <div className="relative">
                <Type className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Ex: Confirmation de votre rendez-vous" 
                  className="pl-11 h-12 bg-white border-slate-200 rounded-xl focus:ring-primary/20"
                  value={subject}
                  onChange={(e: any) => setSubject(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Contenu du message</label>
            <Textarea 
              placeholder={messageType === "email" ? "Rédigez votre email ici..." : "Saisissez votre message..."} 
              className="min-h-[150px] bg-white border-slate-200 rounded-xl resize-none focus:ring-primary/20 p-4 font-medium"
              value={content}
              onChange={(e: any) => setContent(e.target.value)}
            />
            <div className="flex justify-between items-center px-1">
              <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-primary rounded-lg h-8 px-2">
                <Paperclip className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Pièce jointe</span>
              </Button>
              <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">
                {content.length} caractères {messageType === "sms" && `| ${Math.ceil(content.length / 160)} SMS`}
              </p>
            </div>
          </div>

          <Button 
            className="w-full gap-3 font-black text-sm h-14 shadow-xl shadow-primary/20 rounded-xl transition-all hover:scale-[1.01] active:scale-[0.99]" 
            onClick={handleSend}
            disabled={sendMessage.isPending || !content.trim()}
          >
            {sendMessage.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
            ENVOYER MAINTENANT
          </Button>
        </CardContent>
      </Card>

      {/* Historique des messages */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Historique des envois</h3>
          <Badge variant="secondary" className="font-bold">{messages?.data?.length || 0} message(s)</Badge>
        </div>

        <div className="space-y-3">
          {isLoadingMessages ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary/40" />
            </div>
          ) : !messages?.data || messages.data.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
              <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-sm font-bold text-slate-400">Aucune communication enregistrée</p>
            </div>
          ) : (
            messages.data.map((msg: MessageOutput) => (
              <div key={msg.id} className="group relative flex gap-4 p-5 rounded-2xl border border-slate-100 bg-white hover:border-primary/20 hover:shadow-md transition-all">
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                  msg.type === "whatsapp" ? "bg-emerald-50 text-emerald-600" :
                  msg.type === "email" ? "bg-indigo-50 text-indigo-600" : "bg-sky-50 text-sky-600"
                )}>
                  {msg.type === "whatsapp" ? <MessageCircle className="w-6 h-6" /> : 
                   msg.type === "email" ? <Mail className="w-6 h-6" /> : <Smartphone className="w-6 h-6" />}
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest h-5 border-slate-200 bg-slate-50">
                        {msg.type}
                      </Badge>
                      <span className="text-[10px] font-bold text-slate-400">
                        {format(new Date(msg.createdAt), "dd MMMM yyyy 'à' HH:mm", { locale: fr })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg">
                      {getStatusIcon(msg.status)}
                      <span className={cn(
                        "text-[10px] font-black uppercase tracking-tighter",
                        msg.status === "failed" ? "text-rose-500" : "text-slate-500"
                      )}>
                        {msg.status}
                      </span>
                    </div>
                  </div>
                  
                  {msg.type === "email" && (msg as any).metadata?.subject && (
                    <p className="text-xs font-black text-slate-800 flex items-center gap-2">
                      <Type className="w-3 h-3 text-primary" />
                      {(msg as any).metadata.subject}
                    </p>
                  )}
                  
                  <p className="text-sm leading-relaxed font-medium text-slate-600 bg-slate-50/50 p-3 rounded-xl border border-slate-50">
                    {msg.content}
                  </p>
                  
                  {msg.error && (
                    <div className="flex items-center gap-2 text-[10px] text-rose-600 font-bold bg-rose-50 p-2 rounded-lg border border-rose-100">
                      <AlertCircle className="w-3 h-3" />
                      Erreur: {msg.error}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}