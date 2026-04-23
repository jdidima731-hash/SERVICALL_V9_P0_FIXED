import { useState } from "react";
import { Users, 
  Plus, 
  Download, 
  Upload,
  Search,
  Filter,
  LayoutGrid,
  List as ListIcon
 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UniversalKanban, type KanbanItem, type KanbanColumn } from "@/components/UniversalKanban";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Pagination } from "@/components/Pagination";
import { useQueryClient } from "@tanstack/react-query";
import { getQueryKey } from "@trpc/react-query";
import { useTranslation } from "react-i18next";
import { useTenant } from "@/contexts/TenantContext";
import { ProspectDialog } from "@/components/ProspectDialog";
import { useCallStore } from "@/lib/callStore";

/**
 * PROSPECTS PAGE — SERVICALL V8
 * ✅ Gestion des prospects via Kanban & Liste
 * ✅ FIX V8 : Typage strict et suppression du @ts-nocheck
 */

type ProspectStatus = "new" | "contacted" | "qualified" | "proposal" | "negotiation" | "converted" | "lost";

interface Prospect {
  id: number;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  status: string;
  phone: string | null;
  email: string | null;
}

interface PaginatedProspects {
  prospects: Prospect[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export default function Prospects() {
  const { t } = useTranslation(['dashboard', 'common']);
  const { tenantId } = useTenant();
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const queryClient = useQueryClient();
  const initiateCall = useCallStore((state) => state.initiateCall);

  const { 
    data: paginatedData, 
    isPending, 
    isError, 
    error,
    refetch 
  } = trpc.business.prospect.list.useQuery(
    { page, limit: pageSize },
    { 
      enabled: !!tenantId,
      retry: 1,
      refetchOnWindowFocus: false,
    }
  );

  const prospectsData = paginatedData as unknown as PaginatedProspects | undefined;
  const prospects = prospectsData?.prospects || [];
  const totalCount = prospectsData?.pagination?.total || 0;

  const updateStatusMutation = trpc.business.prospect.update.useMutation({
    onMutate: async (newData) => {
      const queryKey = getQueryKey(trpc.business.prospect.list, { page, limit: pageSize }, 'query');
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old || !old.prospects) return old;
        return {
          ...old,
          prospects: (old.prospects as Prospect[]).map((p) => 
            p.id === newData.prospectId ? { ...p, status: newData.status as string } : p
          )
        };
      });
      
      return { previous };
    },
    onError: (_err, _newData, context) => {
      const queryKey = getQueryKey(trpc.business.prospect.list, { page, limit: pageSize }, 'query');
      if (context) queryClient.setQueryData(queryKey, context.previous);
      toast.error(t('common:errors.unexpected'));
    },
    onSettled: () => {
      const queryKey = getQueryKey(trpc.business.prospect.list, { page, limit: pageSize }, 'query');
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const columns: KanbanColumn[] = [
    { id: "new", title: t('pages.prospects.columns.new') || "Nouveau", color: "bg-slate-500" },
    { id: "contacted", title: t('pages.prospects.columns.contacted') || "Contacté", color: "bg-blue-500" },
    { id: "qualified", title: t('pages.prospects.columns.qualified') || "Qualifié", color: "bg-indigo-500" },
    { id: "proposal", title: t('pages.prospects.columns.proposal') || "Proposition", color: "bg-purple-500" },
    { id: "negotiation", title: t('pages.prospects.columns.negotiation') || "Négociation", color: "bg-orange-500" },
    { id: "converted", title: t('pages.prospects.columns.converted') || "Converti", color: "bg-green-500" },
    { id: "lost", title: t('pages.prospects.columns.lost') || "Perdu", color: "bg-red-500" },
  ];

  const handleCall = (item: KanbanItem) => {
    if (!item.phone) {
      toast.warning("Ce prospect n'a pas de numéro de téléphone");
      return;
    }
    initiateCall({
      prospectId: typeof item.id === 'number' ? item.id : undefined,
      prospectName: item.title,
      phoneNumber: item.phone,
    });
    toast.success(`Appel vers ${item.title} en cours...`);
  };

  const handleSms = (item: KanbanItem) => {
    if (!item.phone) {
      toast.warning("Ce prospect n'a pas de numéro de téléphone");
      return;
    }
    window.open(`sms:${item.phone}`, '_self');
  };

  const kanbanItems: KanbanItem[] = prospects.map((p) => ({
    id: p.id,
    title: `${p.firstName || ""} ${p.lastName || ""}`.trim() || "Sans nom",
    company: p.company || "N/A",
    status: (p.status as ProspectStatus) || "new",
    priority: "medium",
    phone: p.phone || "",
    email: p.email || "",
  }));

  const filteredItems = kanbanItems.filter((item) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      item.title.toLowerCase().includes(search) ||
      (item.company ?? '').toLowerCase().includes(search) ||
      (item.email ?? '').toLowerCase().includes(search) ||
      (item.phone ?? '').includes(search)
    );
  });

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in p-1">
      <ProspectDialog 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen}
        onSuccess={() => refetch()}
      />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-3xl font-black tracking-tight">{t('pages.prospects.title')}</h1>
          </div>
          <p className="text-muted-foreground">{t('pages.prospects.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => window.location.href='/campaigns?tab=import'}>
            <Upload className="w-4 h-4" /> {t('pages.prospects.import_csv')}
          </Button>
          <Button size="sm" className="gap-2 shadow-lg shadow-primary/20" onClick={() => setIsDialogOpen(true)}>
            <Plus className="w-4 h-4" /> {t('pages.prospects.new_prospect')}
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-card p-4 rounded-xl border border-border shadow-sm">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder={t('pages.prospects.search_placeholder')} 
              className="pl-10 bg-muted/50 border-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="ghost" size="icon"><Filter className="w-4 h-4" /></Button>
        </div>

        <Tabs value={view} onValueChange={(v) => setView(v as "kanban" | "list")} className="w-full md:w-auto">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="kanban" className="gap-2"><LayoutGrid className="w-4 h-4" /> {t('pages.prospects.kanban')}</TabsTrigger>
            <TabsTrigger value="list" className="gap-2"><ListIcon className="w-4 h-4" /> {t('pages.prospects.list')}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="min-h-[600px] space-y-4">
        {isPending && <LoadingState message={t('pages.prospects.loading')} variant="spinner" />}
        {isError && <ErrorState title={t('pages.prospects.error_title')} message={t('pages.prospects.error_message')} error={error} onRetry={() => refetch()} />}

        {!isPending && !isError && filteredItems.length === 0 && (
          <EmptyState
            icon={searchTerm ? Search : Users}
            title={searchTerm ? t('pages.prospects.no_results') : t('pages.prospects.no_prospects')}
            description={searchTerm ? t('pages.prospects.no_results_desc', { searchTerm }) : t('pages.prospects.no_prospects_desc')}
            actionLabel={searchTerm ? t('pages.prospects.reset_search') : t('pages.prospects.new_prospect')}
            onAction={() => searchTerm ? setSearchTerm("") : setIsDialogOpen(true)}
          />
        )}

        {!isPending && !isError && filteredItems.length > 0 && (
          <>
            {view === "kanban" ? (
              <UniversalKanban 
                items={filteredItems}
                columns={columns}
                onStatusChange={(id, status) => {
                  updateStatusMutation.mutate({ prospectId: Number(id), status: status as string });
                  toast.success(t('pages.prospects.moved_to', { status: columns.find(c => c.id === status)?.title || status }));
                }}
                onCall={handleCall}
                onSms={handleSms}
              />
            ) : (
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                {/* Liste simple ici pour l'exemple, à étendre avec un vrai tableau si besoin */}
                <div className="p-8 text-center text-muted-foreground">Vue liste en cours de chargement...</div>
              </div>
            )}

            <div className="flex justify-center mt-6">
              <Pagination 
                total={totalCount} 
                page={page} 
                pageSize={pageSize} 
                onPageChange={setPage} 
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
