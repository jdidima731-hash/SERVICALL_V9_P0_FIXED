

import { useParams } from "wouter";
import { Phone, 
  Mail, 
  Calendar, 
  Clock, 
  MessageSquare,
  History,
  Plus,
  Loader2,
  Smartphone,
  MessageCircle,
  FileText,
  AlertCircle,
  CheckCircle2
 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { ProspectMessagingTab } from "@/components/ProspectMessagingTab";
import { useCallStore } from "@/lib/callStore";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { TenantGuard } from "@/components/TenantGuard";

export default function ProspectDetail({ params }: { params?: { readonly id?: string } }) {
  const routeParams = useParams<{ id: string }>();
  const prospectId = parseInt(params?.id ?? routeParams.id ?? "0");
  const { tenantId } = useTenant();
  const initiateCall = useCallStore((state) => state.initiateCall);

  const { data: prospect, isPending } = trpc.business.prospect.getById.useQuery(
    { prospectId },
    { enabled: Boolean(prospectId) }
  );

  // ✅ Utilisation du nouvel historique omnicanal du BLOC 4
  const { data: timeline, isLoading: isLoadingTimeline } = trpc.communication.messaging.getOmnichannelHistory.useQuery(
    { prospectId },
    { enabled: Boolean(prospectId) }
  );

  if (isPending) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4" data-main-content>
        <Loader2 className="w-12 h-12 animate-spin text-primary opacity-20" />
        <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground animate-pulse">Chargement du profil...</p>
      </div>
    );
  }

  const handleCall = () => {
    if (prospect?.phone) {
      initiateCall({
        prospectId: prospect.id,
        prospectName: `${prospect.firstName} ${prospect.lastName}`,
        phoneNumber: prospect.phone,
      });
    } else {
      toast.error("Aucun numéro de téléphone pour ce prospect");
    }
  };

  const getTimelineIcon = (item: any) => {
    if (item.timelineType === 'call') {
      return <Phone className="w-5 h-5" />;
    }
    switch (item.type) {
      case 'sms': return <Smartphone className="w-5 h-5" />;
      case 'whatsapp': return <MessageCircle className="w-5 h-5" />;
      case 'email': return <Mail className="w-5 h-5" />;
      default: return <MessageSquare className="w-5 h-5" />;
    }
  };

  const getTimelineColor = (item: any) => {
    if (item.timelineType === 'call') return "bg-blue-500 shadow-blue-200";
    switch (item.type) {
      case 'sms': return "bg-sky-500 shadow-sky-200";
      case 'whatsapp': return "bg-emerald-500 shadow-emerald-200";
      case 'email': return "bg-indigo-500 shadow-indigo-200";
      default: return "bg-slate-500 shadow-slate-200";
    }
  };

  return (
    <TenantGuard>
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700 p-4 md:p-0">
      {/* Left Column: Profile (25%) */}
      <div className="lg:col-span-1 space-y-6">
        <Card className="border-none shadow-xl shadow-slate-200/50 overflow-hidden rounded-3xl bg-white">
          <div className="h-32 bg-gradient-to-br from-primary to-primary-foreground/20 relative">
            <div className="absolute inset-0 bg-black/5"></div>
          </div>
          <CardContent className="pt-0 -mt-16 text-center relative z-10">
            <div className="w-32 h-32 rounded-3xl bg-white border-[6px] border-white shadow-2xl mx-auto flex items-center justify-center text-4xl font-black text-primary mb-6 rotate-3">
              {prospect?.firstName?.substring(0, 1).toUpperCase() || "P"}{prospect?.lastName?.substring(0, 1).toUpperCase() || "R"}
            </div>
            <h2 className="text-3xl font-black tracking-tighter text-slate-900 mb-1">{prospect?.firstName} {prospect?.lastName}</h2>
            <p className="text-slate-500 text-sm font-bold uppercase tracking-widest mb-6">
              {prospect?.jobTitle || "Prospect"} <span className="mx-2 opacity-30">@</span> {prospect?.company || "Indépendant"}
            </p>
            
            <div className="flex flex-wrap justify-center gap-2 mb-8">
              <Badge className="bg-blue-50 text-blue-600 hover:bg-blue-100 border-none px-3 py-1 font-black text-[10px] uppercase tracking-widest">
                {prospect?.status || "Nouveau"}
              </Badge>
            </div>

            <div className="grid grid-cols-1 gap-3 text-left">
              <div className="group flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 transition-colors hover:bg-white hover:border-primary/20">
                <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                  <Phone className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Téléphone</p>
                  <p className="font-bold text-slate-700 truncate">{prospect?.phone || "Non renseigné"}</p>
                </div>
              </div>
              <div className="group flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 transition-colors hover:bg-white hover:border-primary/20">
                <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                  <Mail className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email</p>
                  <p className="font-bold text-slate-700 truncate">{prospect?.email || "Non renseigné"}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl shadow-slate-200/50 rounded-3xl bg-slate-900 text-white overflow-hidden">
          <CardHeader className="pb-4">
            <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Actions Commerciales</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3">
            <Button className="w-full h-12 gap-3 font-black shadow-lg shadow-primary/20 rounded-xl" onClick={handleCall}>
              <Phone className="w-5 h-5" /> APPELER LE CLIENT
            </Button>
            <Button variant="outline" className="w-full h-12 gap-3 font-black rounded-xl bg-slate-800 border-slate-700 hover:bg-slate-700 text-white" onClick={() => {
              const tabList = document.querySelector('[role="tablist"]');
              const messageTab = tabList?.querySelector('[value="messages"]') as HTMLElement;
              messageTab?.click();
            }}>
              <MessageSquare className="w-5 h-5" /> ENVOYER MESSAGE
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Middle Column: Timeline & Messages (50%) */}
      <div className="lg:col-span-2 space-y-8">
        <Tabs defaultValue="activity" className="w-full">
          <TabsList className="w-full grid grid-cols-2 bg-slate-100 p-1.5 rounded-2xl h-14 shadow-inner">
            <TabsTrigger value="activity" className="rounded-xl font-black uppercase tracking-widest text-[10px] gap-2 data-[state=active]:bg-white data-[state=active]:shadow-lg transition-all">
              <History className="w-4 h-4" /> Historique Omnicanal
            </TabsTrigger>
            <TabsTrigger value="messages" className="rounded-xl font-black uppercase tracking-widest text-[10px] gap-2 data-[state=active]:bg-white data-[state=active]:shadow-lg transition-all">
              <MessageSquare className="w-4 h-4" /> Centre de Messagerie
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="activity" className="mt-8 animate-in fade-in slide-in-from-top-4 duration-500">
            <Card className="border-none shadow-none bg-transparent">
              <CardHeader className="flex flex-row items-center justify-between px-0 pb-8">
                <div>
                  <CardTitle className="text-2xl font-black tracking-tight flex items-center gap-3">
                    <History className="w-7 h-7 text-primary" />
                    Timeline Prospect
                  </CardTitle>
                  <p className="text-slate-500 text-sm font-medium mt-1">Toutes les interactions centralisées par ordre chronologique.</p>
                </div>
                <Button variant="outline" size="sm" className="gap-2 font-black text-[10px] uppercase tracking-widest rounded-xl border-slate-200 h-10 px-4">
                  <Plus className="w-4 h-4" /> Note Interne
                </Button>
              </CardHeader>
              <CardContent className="px-0">
                <div className="space-y-8 relative before:absolute before:left-[24px] before:top-4 before:bottom-4 before:w-[2px] before:bg-slate-100">
                  {isLoadingTimeline ? (
                    <div className="flex flex-col items-center py-20 gap-4">
                      <Loader2 className="w-10 h-10 animate-spin text-slate-200" />
                      <p className="text-xs font-black uppercase tracking-widest text-slate-300">Synchronisation...</p>
                    </div>
                  ) : timeline && timeline.length > 0 ? (
                    timeline.map((item: any, i: number) => (
                      <div key={i} className="relative pl-16 animate-in fade-in slide-in-from-left-4 duration-500" style={{ animationDelay: `${i * 100}ms` }}>
                        <div className={cn(
                          "absolute left-0 top-0 w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-xl z-10 transition-transform hover:scale-110 cursor-default",
                          getTimelineColor(item)
                        )}>
                          {getTimelineIcon(item)}
                        </div>
                        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md hover:border-primary/10 transition-all">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest h-5 bg-slate-50 border-slate-100">
                                  {item.timelineType === 'call' ? 'Appel' : (item.type as string)}
                                </Badge>
                                {item.direction && (
                                  <Badge className={cn(
                                    "text-[9px] font-black uppercase tracking-widest h-5 border-none",
                                    item.direction === 'outbound' ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"
                                  )}>
                                    {item.direction === 'outbound' ? 'Sortant' : 'Entrant'}
                                  </Badge>
                                )}
                              </div>
                              <h4 className="font-black text-slate-800 text-lg tracking-tight">
                                
                                {item.timelineType === 'call' ? `Appel Téléphonique` : 
                                 item.type === 'email' ? ((item.metadata as Record<string,unknown>)?.subject || 'Message Email') : 
                                 `Message ${(item.type as string)?.toUpperCase()}`}
                              </h4>
                            </div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded-lg">
                              {format(new Date(item.createdAt as string), "dd MMM yyyy HH:mm", { locale: fr })}
                            </span>
                          </div>
                          
                          <div className="text-sm text-slate-600 leading-relaxed font-medium bg-slate-50/50 p-4 rounded-2xl border border-slate-50">
                            {item.timelineType === 'call' ? (
                              <div className="space-y-2">
                                <div className="flex items-center gap-4 text-xs font-bold text-slate-500">
                                  <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {item.duration as string} secondes</span>
                                  <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> {item.status as string}</span>
                                </div>
                                {item.summary && <p className="mt-2 text-slate-700 italic border-l-2 border-primary/20 pl-3">{item.summary as string}</p>}
                              </div>
                            ) : (
                              <p>{item.content as string}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-20 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-100">
                      <History className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                      <p className="text-slate-400 font-bold">Aucune activité enregistrée pour ce prospect</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="messages" className="mt-8 animate-in fade-in slide-in-from-top-4 duration-500">
            <ProspectMessagingTab prospectId={prospectId} tenantId={effectiveTenantId} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Right Column: Contextual (25%) */}
      <div className="lg:col-span-1 space-y-8">
        <Card className="border-none shadow-xl shadow-slate-200/50 rounded-3xl bg-white overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100">
            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              Prochaines Étapes
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="p-5 rounded-2xl bg-primary/5 border border-primary/10 relative overflow-hidden group">
              <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform">
                <Calendar className="w-24 h-24" />
              </div>
              <div className="flex items-center gap-2 text-primary mb-3">
                <AlertCircle className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Action requise</span>
              </div>
              <p className="text-sm font-bold text-slate-800 leading-tight">Aucun rendez-vous planifié avec ce prospect.</p>
            </div>
            <Button variant="outline" className="w-full h-12 font-black text-[10px] uppercase tracking-widest rounded-xl border-slate-200 hover:bg-slate-50 transition-colors">
              PLANIFIER UN RDV
            </Button>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl shadow-slate-200/50 rounded-3xl bg-white overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100">
            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Documents & Pièces
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8">
            <div className="text-center">
              <FileText className="w-12 h-12 text-slate-200 mx-auto mb-4" />
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Aucun document</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    </TenantGuard>
  );
}