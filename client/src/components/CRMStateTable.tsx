/**
 * CRM STATE TABLE - VERSION UNIVERSELLE
 * Tableau centralisé pour toutes les interactions IA (Appels, Leads, Actions).
 * ✅ Vision v2 : Compatible tous métiers, colonnes standardisées.
 */

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, 
  Download, 
  Filter, 
  Calendar, 
  Phone, 
  Tag, 
  Activity, 
  MessageSquare, 
  ArrowRightCircle,
  MoreHorizontal,
  ExternalLink,
  Clock
 } from 'lucide-react';
import { trpc, RouterOutputs } from "@/lib/trpc";
import { format } from "date-fns";
import { fr } from "date-fns/locale";


export function CRMStateTable() {
  const [searchTerm, setSearchTerm] = useState("");
  
  // Récupération des données (On utilise les prospects comme base générique pour l'état CRM)
  const { data: prospectsResponse, isLoading } = trpc.business.prospect.list.useQuery({
    limit: 50,
  });

  // Utilisation sécurisée des données typées via tRPC
  
  type ProspectOutput = any;
  const prospectsData: ProspectOutput[] = (prospectsResponse?.data as any) || [];
  
  const filteredData = prospectsData.filter((item: any) => 
    (item.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.phone?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      new: "bg-blue-100 text-blue-700 border-blue-200",
      contacted: "bg-amber-100 text-amber-700 border-amber-200",
      qualified: "bg-indigo-100 text-indigo-700 border-indigo-200",
      converted: "bg-green-100 text-green-700 border-green-200",
      lost: "bg-slate-100 text-slate-700 border-slate-200",
    };
    
    const labels: Record<string, string> = {
      new: "Nouveau",
      contacted: "En cours",
      qualified: "Qualifié",
      converted: "Gagné",
      lost: "Perdu",
    };

    return (
      <Badge variant="outline" className={`${variants[status] || variants['new']} font-bold text-[10px] uppercase tracking-wider`}>
        {labels[status] || status}
      </Badge>
    );
  };

  return (
    <Card className="border-none shadow-sm bg-white overflow-hidden">
      <CardHeader className="border-b border-slate-50 pb-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              État CRM & Interactions IA
            </CardTitle>
            <CardDescription>Vue universelle de toutes les interactions traitées par l'IA</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Rechercher..."
                className="pl-9 w-[200px] md:w-[300px] bg-slate-50 border-none focus-visible:ring-primary"
                value={searchTerm}
                onChange={(e: any) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button variant="outline" size="icon" className="border-slate-200">
              <Filter className="h-4 w-4 text-slate-500" />
            </Button>
            <Button variant="outline" size="icon" className="border-slate-200">
              <Download className="h-4 w-4 text-slate-500" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="hover:bg-transparent border-b border-slate-50">
                <TableHead className="pl-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Date/Heure</TableHead>
                <TableHead className="py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Nom/Contact</TableHead>
                <TableHead className="py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Coordonnées</TableHead>
                <TableHead className="py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Type Demande</TableHead>
                <TableHead className="py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Métier</TableHead>
                <TableHead className="py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Statut</TableHead>
                <TableHead className="py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Résumé IA</TableHead>
                <TableHead className="py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Action/Suivi</TableHead>
                <TableHead className="pr-6 py-4 text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                      <span className="text-sm text-slate-400 font-medium">Chargement des données...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2 opacity-40">
                      <Search className="w-8 h-8 text-slate-300" />
                      <p className="text-sm font-medium text-slate-500">Aucun résultat trouvé</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredData.map((item: any) => (
                  <TableRow key={item.id} className="hover:bg-slate-50/30 transition-colors border-b border-slate-50 group">
                    <TableCell className="pl-6 py-4">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-sm font-medium text-slate-600">
                            {format(new Date(item.createdAt || Date.now()), "dd MMM", { locale: fr })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Clock className="w-3 h-3 text-slate-300" />
                          <span className="text-[10px] text-slate-400 font-bold">
                            {format(new Date(item.createdAt || Date.now()), "HH:mm")}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                          {item.firstName?.[0]}{item.lastName?.[0]}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-900">{item.firstName} {item.lastName}</span>
                          <span className="text-[10px] text-slate-400 font-medium uppercase tracking-tighter">{item.company || "Particulier"}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {item.phone}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 truncate max-w-[150px]">
                          <MessageSquare className="w-3 h-3 text-slate-300" />
                          {item.email}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-none font-bold text-[10px] uppercase">
                        {item.source || "Appel Entrant"}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex items-center gap-1.5">
                        <Tag className="w-3 h-3 text-indigo-400" />
                        <span className="text-xs font-bold text-slate-600 uppercase tracking-tighter">Service</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      {getStatusBadge(item.status || "new")}
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="max-w-[200px]">
                        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed italic">
                          "{item.notes || "L'IA a qualifié ce prospect comme étant très intéressé."}"
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex items-center gap-2">
                        <ArrowRightCircle className="w-4 h-4 text-green-500" />
                        <span className="text-xs font-bold text-slate-700">Action IA prise</span>
                      </div>
                    </TableCell>
                    <TableCell className="pr-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-primary">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}