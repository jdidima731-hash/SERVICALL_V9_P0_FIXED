/**
 * UNIFIED INBOX — Boîte de réception omnicanale
 * WhatsApp + Messenger + Instagram + SMS + Appels manqués
 * Vue chronologique unique par contact.
 * Fichier NOUVEAU — aucun import modifié dans le reste du projet.
 */

import { useState } from "react";
import { useLocation } from "wouter";

import { useIsMobile } from "@/hooks/useMobile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, MessageSquare, Phone, Instagram, Facebook,
  MessageCircle, Filter, RefreshCw, Send, Mic, Paperclip,
  CheckCheck, Clock, AlertCircle, ChevronLeft,
  Smartphone, Globe, Bot, User,
 } from 'lucide-react';
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Channel = "all" | "whatsapp" | "sms" | "messenger" | "instagram" | "call";

interface Conversation {
  id: string;
  contactName: string;
  contactPhone?: string;
  channel: Exclude<Channel, "all">;
  lastMessage: string;
  lastMessageTime: Date;
  unread: number;
  status: "open" | "resolved" | "pending";
  sentiment?: "positive" | "neutral" | "negative";
  prospectId?: number;
  avatar?: string;
}

const CHANNEL_CONFIG = {
  whatsapp:  { label: "WhatsApp",  color: "text-green-500",  bg: "bg-green-500/10",  Icon: MessageCircle },
  sms:       { label: "SMS",       color: "text-blue-500",   bg: "bg-blue-500/10",   Icon: Smartphone },
  messenger: { label: "Messenger", color: "text-blue-600",   bg: "bg-blue-600/10",   Icon: Facebook },
  instagram: { label: "Instagram", color: "text-pink-500",   bg: "bg-pink-500/10",   Icon: Instagram },
  call:      { label: "Appel",     color: "text-orange-500", bg: "bg-orange-500/10", Icon: Phone },
} as const;

function ChannelIcon({ channel, className }: { channel: Exclude<Channel, "all">; className?: string }) {
  const cfg = CHANNEL_CONFIG[channel];
  return <cfg.Icon className={cn("w-4 h-4", cfg.color, className)} />;
}

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "maintenant";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}j`;
}

// Données de démo enrichies
const DEMO_CONVERSATIONS: Conversation[] = [
  { id: "1", contactName: "Fatima Benali",    channel: "whatsapp",  lastMessage: "Bonjour, je voulais savoir si votre offre est toujours disponible ?", lastMessageTime: new Date(Date.now() - 3 * 60000),     unread: 2, status: "open",     sentiment: "positive", prospectId: 1 },
  { id: "2", contactName: "Karim Mansouri",   channel: "messenger", lastMessage: "D'accord, je confirme mon rendez-vous pour demain à 14h.", lastMessageTime: new Date(Date.now() - 12 * 60000),    unread: 0, status: "resolved", sentiment: "positive", prospectId: 2 },
  { id: "3", contactName: "Leila Hamidi",     channel: "instagram", lastMessage: "Super service ! Je recommande à tous mes contacts 😊", lastMessageTime: new Date(Date.now() - 28 * 60000),    unread: 1, status: "open",     sentiment: "positive" },
  { id: "4", contactName: "+212 6 12 34 56",  channel: "call",      lastMessage: "Appel manqué — 2 tentatives",  lastMessageTime: new Date(Date.now() - 45 * 60000),    unread: 1, status: "pending",  sentiment: "neutral" },
  { id: "5", contactName: "Ahmed Tazi",       channel: "sms",       lastMessage: "Merci pour votre rappel. Je reviendrai vers vous en fin de semaine.", lastMessageTime: new Date(Date.now() - 2 * 3600000),   unread: 0, status: "open",     sentiment: "neutral",  prospectId: 5 },
  { id: "6", contactName: "Sara Chraibi",     channel: "whatsapp",  lastMessage: "Le prix est trop élevé pour notre budget actuel.", lastMessageTime: new Date(Date.now() - 5 * 3600000),   unread: 0, status: "open",     sentiment: "negative", prospectId: 6 },
  { id: "7", contactName: "Youssef El Amrani",channel: "messenger", lastMessage: "Je peux avoir une démo ce vendredi ?",  lastMessageTime: new Date(Date.now() - 8 * 3600000),   unread: 3, status: "open",     sentiment: "positive" },
  { id: "8", contactName: "Nadia Skalli",     channel: "instagram", lastMessage: "Comment puis-je configurer mon compte ?",  lastMessageTime: new Date(Date.now() - 24 * 3600000),  unread: 0, status: "pending",  sentiment: "neutral" },
];

export default function UnifiedInbox() {
  const [, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const [channel, setChannel] = useState<Channel>("all");
  const [search, setSearch] = useState("");
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);

  const conversations = DEMO_CONVERSATIONS.filter(c => {
    if (channel !== "all" && c.channel !== channel) return false;
    if (search && !c.contactName.toLowerCase().includes(search.toLowerCase()) &&
        !c.lastMessage.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalUnread = DEMO_CONVERSATIONS.reduce((sum, c) => sum + c.unread, 0);

  const handleSend = async () => {
    if (!replyText.trim() || !selectedConv) return;
    setIsSending(true);
    await new Promise(r => setTimeout(r, 600));
    toast.success(`Message envoyé via ${CHANNEL_CONFIG[selectedConv.channel].label}`);
    setReplyText("");
    setIsSending(false);
  };

  const showDetail = isMobile ? !!selectedConv : true;
  const showList   = isMobile ? !selectedConv : true;

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-0" data-main-content>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-1">
        {isMobile && selectedConv ? (
          <Button variant="ghost" size="sm" onClick={() => setSelectedConv(null)} className="gap-1">
            <ChevronLeft className="w-4 h-4" /> Retour
          </Button>
        ) : (
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <MessageSquare className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight">Inbox Omnicanal</h1>
              <p className="text-sm text-muted-foreground">{totalUnread > 0 ? `${totalUnread} non lus` : "Tout lu"}</p>
            </div>
          </div>
        )}
        <div className="flex items-center gap-2">
          {!isMobile && <Button variant="outline" size="sm" className="gap-1"><RefreshCw className="w-3 h-3" />Sync</Button>}
          <Button variant="outline" size="sm" className="gap-1"><Filter className="w-3 h-3" />{!isMobile && "Filtres"}</Button>
        </div>
      </div>

      {/* Channel tabs */}
      {!selectedConv || !isMobile ? (
        <div className="mb-3 overflow-x-auto">
          <Tabs value={channel} onValueChange={(v: any) => setChannel(v as Channel)}>
            <TabsList className="flex-nowrap">
              <TabsTrigger value="all" className="gap-1.5 whitespace-nowrap">
                <Globe className="w-3.5 h-3.5" />Tous
                {totalUnread > 0 && <Badge variant="destructive" className="h-4 px-1 text-[10px]">{totalUnread}</Badge>}
              </TabsTrigger>
              {(Object.entries(CHANNEL_CONFIG) as [Exclude<Channel,"all">, typeof CHANNEL_CONFIG[keyof typeof CHANNEL_CONFIG]][]).map(([ch, cfg]) => (
                <TabsTrigger key={ch} value={ch} className="gap-1.5 whitespace-nowrap">
                  <cfg.Icon className={cn("w-3.5 h-3.5", cfg.color)} />
                  {cfg.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      ) : null}

      {/* Main layout */}
      <div className="flex gap-4 flex-1 min-h-0">

        {/* Conversation list */}
        {showList && (
          <div className={cn("flex flex-col min-h-0", isMobile ? "w-full" : "w-80 flex-shrink-0")}>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Rechercher..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="flex-1 overflow-y-auto space-y-1 pr-1">
              {conversations.length === 0 && (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                  <MessageSquare className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-sm">Aucune conversation</p>
                </div>
              )}
              {conversations.map((conv) => (
                <button key={conv.id} onClick={() => setSelectedConv(conv)}
                  className={cn(
                    "w-full text-left p-3 rounded-xl transition-all border",
                    selectedConv?.id === conv.id
                      ? "bg-primary/10 border-primary/30"
                      : "bg-card border-border/50 hover:bg-accent/50",
                    conv.unread > 0 && "border-primary/20"
                  )}>
                  <div className="flex items-start gap-3">
                    <div className="relative flex-shrink-0">
                      <Avatar className="w-10 h-10">
                        <AvatarFallback className="text-sm font-bold bg-primary/10 text-primary">
                          {conv.contactName[0]?.toUpperCase() ?? "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className={cn("absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center border-2 border-background", CHANNEL_CONFIG[conv.channel].bg)}>
                        <ChannelIcon channel={conv.channel} className="w-2.5 h-2.5" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn("font-semibold text-sm truncate", conv.unread > 0 && "font-bold")}>{conv.contactName}</span>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className="text-[11px] text-muted-foreground">{timeAgo(conv.lastMessageTime)}</span>
                          {conv.unread > 0 && (
                            <Badge className="h-4.5 min-w-4.5 px-1 text-[10px] bg-primary">{conv.unread}</Badge>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{conv.lastMessage}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Badge variant="outline" className={cn("text-[10px] px-1.5 h-4", 
                          conv.status === "open" ? "text-green-600 border-green-200" :
                          conv.status === "pending" ? "text-orange-500 border-orange-200" :
                          "text-muted-foreground")}>
                          {conv.status === "open" ? "Ouvert" : conv.status === "pending" ? "En attente" : "Résolu"}
                        </Badge>
                        {conv.sentiment === "negative" && <AlertCircle className="w-3 h-3 text-red-400" />}
                        {conv.sentiment === "positive" && <CheckCheck className="w-3 h-3 text-green-400" />}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Conversation detail */}
        {showDetail && (
          <div className={cn("flex flex-col flex-1 min-h-0 min-w-0")}>
            {!selectedConv ? (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3 rounded-2xl border border-dashed border-border/50">
                <MessageSquare className="w-12 h-12 opacity-20" />
                <p className="text-sm font-medium">Sélectionnez une conversation</p>
                <p className="text-xs opacity-60">ou commencez une nouvelle discussion</p>
              </div>
            ) : (
              <Card className="flex flex-col flex-1 min-h-0">
                {/* Conv header */}
                <CardHeader className="py-3 px-4 border-b flex-row items-center gap-3 space-y-0">
                  <div className="relative">
                    <Avatar className="w-9 h-9">
                      <AvatarFallback className="text-sm font-bold bg-primary/10 text-primary">
                        {selectedConv.contactName[0]?.toUpperCase() ?? "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className={cn("absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center border-2 border-background", CHANNEL_CONFIG[selectedConv.channel].bg)}>
                      <ChannelIcon channel={selectedConv.channel} className="w-2.5 h-2.5" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm leading-none">{selectedConv.contactName}</p>
                    <p className={cn("text-xs mt-0.5", CHANNEL_CONFIG[selectedConv.channel].color)}>
                      via {CHANNEL_CONFIG[selectedConv.channel].label}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {selectedConv.prospectId && (
                      <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => setLocation(`/prospects/${selectedConv.prospectId}`)}>
                        <User className="w-3 h-3" />Profil
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1">
                      <Bot className="w-3 h-3" />IA
                    </Button>
                  </div>
                </CardHeader>

                {/* Messages zone */}
                <CardContent className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
                  <div className="flex justify-center">
                    <Badge variant="outline" className="text-[11px] text-muted-foreground">
                      <Clock className="w-3 h-3 mr-1" />{timeAgo(selectedConv.lastMessageTime)}
                    </Badge>
                  </div>
                  {/* Message du contact */}
                  <div className="flex gap-2 max-w-[85%]">
                    <Avatar className="w-7 h-7 flex-shrink-0 mt-1">
                      <AvatarFallback className="text-xs bg-muted">{selectedConv.contactName[0]}</AvatarFallback>
                    </Avatar>
                    <div className="bg-muted rounded-2xl rounded-tl-sm px-3.5 py-2.5">
                      <p className="text-sm leading-relaxed">{selectedConv.lastMessage}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{timeAgo(selectedConv.lastMessageTime)}</p>
                    </div>
                  </div>
                  {/* Réponse IA exemple */}
                  <div className="flex gap-2 max-w-[85%] ml-auto flex-row-reverse">
                    <div className="w-7 h-7 flex-shrink-0 rounded-full bg-primary/10 flex items-center justify-center mt-1">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                    <div className="bg-primary/10 border border-primary/20 rounded-2xl rounded-tr-sm px-3.5 py-2.5">
                      <p className="text-sm leading-relaxed">Bonjour ! Merci pour votre message. Je vais vous transmettre les informations demandées dans les plus brefs délais.</p>
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <span className="text-[10px] text-muted-foreground">IA · il y a 2 min</span>
                        <CheckCheck className="w-3 h-3 text-primary" />
                      </div>
                    </div>
                  </div>
                </CardContent>

                {/* Reply box */}
                <div className="border-t p-3">
                  <div className="flex items-end gap-2">
                    <div className="flex-1 min-w-0">
                      <textarea
                        className="w-full resize-none bg-muted/50 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-primary/50 min-h-[44px] max-h-32"
                        placeholder={`Répondre via ${CHANNEL_CONFIG[selectedConv.channel].label}…`}
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                        rows={1}
                      />
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <Button size="icon" variant="outline" className="h-10 w-10 rounded-xl">
                        <Paperclip className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="outline" className="h-10 w-10 rounded-xl">
                        <Mic className="w-4 h-4" />
                      </Button>
                      <Button size="icon" className="h-10 w-10 rounded-xl" onClick={handleSend} disabled={!replyText.trim() || isSending}>
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
                    Réponse automatique IA activée · <button className="underline hover:text-primary transition-colors">Désactiver</button>
                  </p>
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
