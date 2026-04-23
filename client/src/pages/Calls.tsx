
import { useState } from "react";
import { Phone,
  Download,
  Search,
  ArrowDownLeft,
  ArrowUpRight,
  XCircle,
  Clock,
  MoreVertical,
 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PhoneDialer } from "@/components/PhoneDialer";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Pagination } from "@/components/Pagination";
import { LoadingState } from "@/components/ui/loading-state";
import { useTranslation } from "react-i18next";

interface Call {
  id: string;
  contactName: string;
  phone: string;
  type: "inbound" | "outbound" | "missed";
  duration: number;
  date: Date;
  status: "completed" | "missed" | "ongoing";
  notes: string;
}

export default function CallsRefactored() {
  const { t, i18n } = useTranslation(['dashboard', 'common']);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [sortBy, setSortBy] = useState("recent");
  const [isDialerOpen, setIsDialerOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Real data from tRPC with pagination
  const { data: paginatedData, isPending } = trpc.communication.calls.list.useQuery(
    { page, limit: pageSize },
    { retry: 1 }
  );

  const apiCalls = paginatedData?.items || [];
  const totalCount = paginatedData?.total || 0;

  // Transform API data to our Call interface
  const calls: Call[] = apiCalls.map((c) => ({
    id: String(c.id),
    contactName: "Inconnu", // Note: contactName n'est pas dans le DTO Call, à récupérer via prospectId si besoin
    phone: "N/A", // Note: fromNumber/toNumber ne sont pas dans le DTO Call simplifié
    type: c.callType === "inbound" ? "inbound" : (c.callType === "outbound" ? "outbound" : "missed"),
    duration: c.duration || 0,
    date: c.createdAt,
    status: c.status === "completed" ? "completed" : (c.status === "failed" ? "missed" : "ongoing"),
    notes: "", // Note: summary n'est pas dans le DTO Call simplifié
  }));

  const filteredCalls = calls.filter((call) => {
    const matchesSearch =
      call.contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      call.phone.includes(searchTerm);
    const matchesFilter = filterType === "all" || call.type === filterType;
    return matchesSearch && matchesFilter;
  });

  const sortedCalls = [...filteredCalls].sort((a, b) => {
    if (sortBy === "recent") return b.date.getTime() - a.date.getTime();
    if (sortBy === "duration") return b.duration - a.duration;
    return 0;
  });

  const getCallTypeIcon = (type: string) => {
    if (type === "inbound") return <ArrowDownLeft className="w-4 h-4 text-green-500" />;
    if (type === "outbound") return <ArrowUpRight className="w-4 h-4 text-blue-500" />;
    return <XCircle className="w-4 h-4 text-red-500" />;
  };

  const getCallTypeBadge = (type: string) => {
    const badges: Record<string, any> = {
      inbound: {
        label: t('pages.calls.inbound'),
        className: "bg-green-500/10 text-green-600 border-green-500/20",
      },
      outbound: {
        label: t('pages.calls.outbound'),
        className: "bg-blue-500/10 text-blue-600 border-blue-500/20",
      },
      missed: {
        label: t('pages.calls.missed'),
        className: "bg-red-500/10 text-red-600 border-red-500/20",
      },
    };
    const badge = badges[type] || badges['outbound'];
    return badge;
  };

  const formatDuration = (seconds: number) => {
    if (seconds === 0) return "-";
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  const formatDate = (date: Date) => {
    return date.toLocaleString(i18n.language === 'fr' ? 'fr-FR' : 'en-US', {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in" data-main-content>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Phone className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">
              {t('pages.calls.title')}
            </h1>
          </div>
          <p className="text-muted-foreground">
            {t('pages.calls.subtitle')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setIsDialerOpen(true)}
            className="gap-2 bg-green-600 hover:bg-green-700 text-white"
          >
            <Phone className="w-4 h-4" />
            {t('pages.calls.call')}
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="w-4 h-4" />
            {t('pages.calls.export')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={t('pages.calls.search_placeholder')}
                  value={searchTerm}
                  onChange={(e: any) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('pages.calls.all_calls')}</SelectItem>
                <SelectItem value="inbound">{t('pages.calls.inbound_calls')}</SelectItem>
                <SelectItem value="outbound">{t('pages.calls.outbound_calls')}</SelectItem>
                <SelectItem value="missed">{t('pages.calls.missed_calls')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">{t('pages.calls.most_recent')}</SelectItem>
                <SelectItem value="duration">{t('pages.calls.duration_long')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Calls Table */}
      <Card>
        <CardHeader className="border-b border-border">
          <CardTitle>{t('pages.calls.table_title')} ({totalCount})</CardTitle>
          <CardDescription>{t('pages.calls.table_subtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {isPending ? (
            <LoadingState variant="spinner" />
          ) : sortedCalls.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Phone className="w-12 h-12 text-muted-foreground mb-3 opacity-30" />
              <p className="text-muted-foreground">{t('pages.calls.no_calls')}</p>
            </div>
          ) : (
            <div className="space-y-3 md:space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left pb-3 font-medium">{t('pages.calls.contact')}</th>
                      <th className="text-left pb-3 font-medium">{t('pages.calls.type')}</th>
                      <th className="text-left pb-3 font-medium">{t('pages.calls.date')}</th>
                      <th className="text-left pb-3 font-medium">{t('pages.calls.duration')}</th>
                      <th className="text-right pb-3 font-medium">{t('pages.calls.actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {sortedCalls.map((call) => {
                      const badge = getCallTypeBadge(call.type);
                      return (
                        <tr key={call.id} className="group hover:bg-muted/50 transition-colors">
                          <td className="py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                                {call.contactName.charAt(0)}
                              </div>
                              <div>
                                <p className="font-medium">{call.contactName}</p>
                                <p className="text-xs text-muted-foreground">{call.phone}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4">
                            <div className="flex items-center gap-2">
                              {getCallTypeIcon(call.type)}
                              <Badge variant="outline" className={badge.className}>
                                {badge.label}
                              </Badge>
                            </div>
                          </td>
                          <td className="py-4 text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <Clock className="w-3 h-3" />
                              {formatDate(call.date)}
                            </div>
                          </td>
                          <td className="py-4 text-muted-foreground">
                            {formatDuration(call.duration)}
                          </td>
                          <td className="py-4 text-right">
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination 
                page={page}
                pageSize={pageSize}
                totalCount={totalCount}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {isDialerOpen && (
        <PhoneDialer
          isOpen={isDialerOpen}
          onClose={() => setIsDialerOpen(false)}
          onCall={(num) => {
            toast.success(t('pages.calls.dialing_to', { number: num }));
            setIsDialerOpen(false);
          }}
        />
      )}
    </div>
  );
}
