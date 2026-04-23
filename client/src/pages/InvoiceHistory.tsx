/**
 * InvoiceHistory - Historique des factures créées
 * Accessible à tous les rôles (agent, manager, admin)
 * Utilise trpc.billingLegal.invoice.list pour récupérer les vraies factures
 */

import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { FileText,
  Plus,
  Search,
  Receipt,
  ArrowLeft,
  Download,
  Eye,
 } from 'lucide-react';
import { toast } from "sonner";

export default function InvoiceHistory() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isPending } = trpc.billingLegal.invoice.list.useQuery(
    { page, limit: 20 },
    { refetchOnWindowFocus: false }
  );

  
  const invoices = (data as Record<string,unknown>)?.data || [];
  
  const total = (data as Record<string,unknown>)?.total || 0;
  const totalPages = Math.ceil((total as number) / 20);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Payée</Badge>;
      case "draft":
        return <Badge className="bg-gray-500/10 text-gray-600 border-gray-500/20">Brouillon</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">En attente</Badge>;
      case "overdue":
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/20">En retard</Badge>;
      case "cancelled":
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/20">Annulée</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredInvoices = (invoices as Record<string,unknown>[]).filter((inv) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      ((inv.invoiceNumber as string) || "").toLowerCase().includes(searchLower) ||
      ((inv.description as string) || "").toLowerCase().includes(searchLower) ||
      String(inv.id).includes(searchLower)
    );
  });

  const handleDownload = (invoiceId: any) => {
    toast.info(`Téléchargement de la facture #${invoiceId as string} en cours...`);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6" data-main-content>
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/invoices")}
            className="rounded-lg"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-black tracking-tight">Historique des Factures</h1>
            <p className="text-muted-foreground">
        {String(String(total))} facture{total !== 1 ? "s" : ""} au total
            </p>
          </div>
        </div>
        <Button onClick={() => setLocation("/invoices")} className="gap-2">
          <Plus className="w-4 h-4" />
          Nouvelle Facture
        </Button>
      </div>

      {/* Barre de recherche */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher par numéro, description..."
          value={search}
          onChange={(e: any) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Liste des factures */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-primary" />
            Factures créées
          </CardTitle>
          <CardDescription>
            Toutes les factures générées depuis votre espace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isPending ? (
            <LoadingState message="Chargement des factures..." timeout={10000} />
          ) : filteredInvoices.length === 0 ? (
            <div className="py-8">
              <EmptyState
                icon={<FileText className="size-6" />}
                title="Aucune facture"
                description={
                  search
                    ? "Aucune facture ne correspond à votre recherche."
                    : "Créez votre première facture en cliquant sur \"Nouvelle Facture\"."
                }
                actionLabel={search ? undefined : "Créer une facture"}
                onAction={search ? undefined : () => setLocation("/invoices")}
              />
            </div>
          ) : (
            <div className="space-y-3">
              {filteredInvoices.map((invoice: any) => (
                <div
                  key={invoice.id as string}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <FileText className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">
                        {(invoice.invoiceNumber as string) || `FAC-${invoice.id as string}`}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {(invoice.description as string) || "Aucune description"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {invoice.createdAt
                          ? new Date(invoice.createdAt as string).toLocaleDateString("fr-FR", {
                              day: "2-digit",
                              month: "long",
                              year: "numeric",
                            })
                          : "Date inconnue"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-bold text-lg">
                        {parseFloat((invoice.totalAmount as string) || (invoice.amount as string) || "0").toFixed(2)} €
                      </p>
                      <p className="text-xs text-muted-foreground">
                        HT: {parseFloat((invoice.amount as string) || "0").toFixed(2)} € · TVA: {parseFloat((invoice.tax as string) || "0").toFixed(2)} €
                      </p>
                    </div>
                    {getStatusBadge((invoice.status as string) || "pending")}
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toast.info(`Détail de la facture #${invoice.id as string}`)}
                        title="Voir le détail"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDownload(invoice.id)}
                        title="Télécharger"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Page {page} sur {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Précédent
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Suivant
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}