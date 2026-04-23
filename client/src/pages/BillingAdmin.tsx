
import { useState } from "react";
import { useTenant } from "@/contexts/TenantContext";
import { CreditCard,
  Download,
  CheckCircle2,
  AlertCircle,
  Package,
  Loader2,
  Edit2,
  Trash2,
  TrendingUp,
  DollarSign,
  Calendar,
 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Page d'administration complète de la facturation
 * Gère les abonnements, les plans, les factures et les paiements
 */
export default function BillingAdmin() {
  const { tenantId } = useTenant();

  const [selectedPlan, setSelectedPlan] = useState<string>("pro");
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  // Queries
  const { data: subscriptionRaw, isPending: subscriptionLoading } =
    trpc.billingLegal.billing.getSubscription.useQuery({ tenantId });
  const subscription = subscriptionRaw?.subscription ?? null;
  
  const {data: invoicesRaw, isPending: _invoicesLoading} =
    trpc.billingLegal.billing.getInvoices.useQuery({ tenantId });
  const invoices = invoicesRaw?.invoices ?? [];
  
  const { data: plansRaw, isPending: plansLoading } =
    trpc.billingLegal.billing.getPlans.useQuery();
  const plans = plansRaw?.plans;
  
  const { data: usageStats, isPending: statsLoading } =
    trpc.billingLegal.billing.getUsageStats.useQuery({ days: 30 });

  // Mutations
  const updatePlanMutation = trpc.billingLegal.billing.updateSubscriptionPlan.useMutation();
  const cancelSubscriptionMutation =
    trpc.billingLegal.billing.cancelSubscription.useMutation();
  const downloadInvoiceMutation = trpc.billingLegal.billing.downloadInvoice.useMutation();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return (
          <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
            PAYÉE
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
            EN ATTENTE
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-red-500/10 text-red-500 border-red-500/20">
            ÉCHOUÉE
          </Badge>
        );
      case "open":
        return (
          <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">
            OUVERTE
          </Badge>
        );
      default:
        return <Badge variant="outline">{status.toUpperCase()}</Badge>;
    }
  };

  const getSubscriptionStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
            ACTIF
          </Badge>
        );
      case "inactive":
        return (
          <Badge className="bg-gray-500/10 text-gray-500 border-gray-500/20">
            INACTIF
          </Badge>
        );
      case "suspended":
        return (
          <Badge className="bg-red-500/10 text-red-500 border-red-500/20">
            SUSPENDU
          </Badge>
        );
      case "cancelled":
        return (
          <Badge className="bg-red-500/10 text-red-500 border-red-500/20">
            ANNULÉ
          </Badge>
        );
      default:
        return <Badge variant="outline">{status.toUpperCase()}</Badge>;
    }
  };

  const handleUpgradePlan = async () => {
    try {
      await updatePlanMutation.mutateAsync({
        newPlanId: selectedPlan,
      });
      toast.success("Plan mis à jour avec succès");
      setShowUpgradeDialog(false);
    } catch (error: any) {
      toast.error("Erreur lors de la mise à jour du plan");
    }
  };

  const handleCancelSubscription = async () => {
    try {
      await cancelSubscriptionMutation.mutateAsync();
      toast.success("Abonnement annulé avec succès");
      setShowCancelDialog(false);
    } catch (error: any) {
      toast.error("Erreur lors de l'annulation de l'abonnement");
    }
  };

  const handleDownloadInvoice = async (invoiceId: string) => {
    try {
      const result = await downloadInvoiceMutation.mutateAsync({
        invoiceId,
      });
      if (result.pdfUrl) {
        window.open(result.pdfUrl, "_blank");
        toast.success("Téléchargement de la facture en cours...");
      }
    } catch (error: any) {
      toast.error("Erreur lors du téléchargement de la facture");
    }
  };

  if (subscriptionLoading || plansLoading || statsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen" data-main-content>
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  const planNames: Record<string, string> = {
    starter: "Starter",
    pro: "Pro",
    enterprise: "Enterprise",
  };

  const planPrices: Record<string, string> = {
    starter: "29,00 €",
    pro: "149,00 €",
    enterprise: "Personnalisé",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Gestion de la Facturation
        </h1>
        <p className="text-muted-foreground">
          Gérez votre abonnement, vos factures et vos méthodes de paiement.
        </p>
      </div>

      {/* Statistiques de Facturation */}
      {usageStats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Appels Total
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {usageStats.totalCalls}
              </div>
              <p className="text-xs text-muted-foreground">
                Ce mois-ci
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Utilisation IA
              </CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {usageStats.usagePercentage.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">
                Du quota inclus
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Appels Restants
              </CardTitle>
              <AlertCircle className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {usageStats.callsRemaining}
              </div>
              <p className="text-xs text-muted-foreground">
                Avant dépassement
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Plan Actuel
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {planNames[usageStats.plan] || usageStats.plan}
              </div>
              <p className="text-xs text-muted-foreground">
                Forfait actif
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Abonnement Actuel */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              Abonnement Actuel
            </CardTitle>
            <CardDescription>
              Vous êtes sur le forfait{" "}
              <strong>
                {subscription ? planNames[(subscription as any)?.plan] : "N/A"}
              </strong>
              .
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-end">
              <div className="text-3xl font-bold">
                {subscription ? planPrices[(subscription as any)?.plan] : "N/A"}
                <span className="text-sm font-normal text-muted-foreground">
                  /mois
                </span>
              </div>
              {subscription && getSubscriptionStatusBadge((subscription as any).status)}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Utilisation du quota d'appels</span>
                <span className="font-medium">{usageStats?.totalCalls} / {usageStats?.callsIncluded}</span>
              </div>
              <Progress value={usageStats?.usagePercentage || 0} className="h-2" />
            </div>

            <div className="pt-4 border-t space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span>Prochaine facturation le <strong>{subscription ? new Date((subscription as any).currentPeriodEnd).toLocaleDateString() : "N/A"}</strong></span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CreditCard className="w-4 h-4 text-muted-foreground" />
                <span>Moyen de paiement : <strong>•••• 4242</strong></span>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex gap-3">
            <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
              <DialogTrigger asChild>
                <Button className="flex-1">Changer de Plan</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Changer de Forfait</DialogTitle>
                  <DialogDescription>
                    Sélectionnez le nouveau plan pour votre entreprise. Les changements seront appliqués immédiatement au prorata.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Choisir un plan</label>
                    <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez un plan" />
                      </SelectTrigger>
                      <SelectContent>
                        {plans?.map((plan: any) => (
                          <SelectItem key={plan.id} value={plan.id}>
                            {plan.name} — {plan.price} € / mois
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="p-4 bg-muted rounded-lg text-sm space-y-2">
                    <p className="font-medium">Inclus dans le plan {planNames[selectedPlan]} :</p>
                    <ul className="list-disc list-inside text-muted-foreground">
                      <li>{plans?.find((p: any) => p.id === selectedPlan)?.callsIncluded} appels par mois</li>
                      {plans?.find((p: any) => p.id === selectedPlan)?.features.map((f: string, i: number) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setShowUpgradeDialog(false)}>Annuler</Button>
                  <Button onClick={handleUpgradePlan} disabled={updatePlanMutation.isPending}>
                    {updatePlanMutation.isPending ? "Mise à jour..." : "Confirmer le changement"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            
            <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" className="text-destructive hover:bg-destructive/10">Annuler</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Annuler l'abonnement</DialogTitle>
                  <DialogDescription>
                    Êtes-vous sûr de vouloir annuler votre abonnement ? Vous perdrez l'accès aux fonctionnalités premium à la fin de la période de facturation actuelle.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex justify-end gap-3 pt-4">
                  <Button variant="outline" onClick={() => setShowCancelDialog(false)}>Conserver mon plan</Button>
                  <Button variant="destructive" onClick={handleCancelSubscription} disabled={cancelSubscriptionMutation.isPending}>
                    {cancelSubscriptionMutation.isPending ? "Annulation..." : "Confirmer l'annulation"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              Méthode de Paiement
            </CardTitle>
            <CardDescription>
              Gérez vos cartes et vos préférences de paiement.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 border rounded-xl bg-muted/30">
              <div className="flex items-center gap-4">
                <div className="w-12 h-8 bg-primary/10 rounded flex items-center justify-center border">
                  <span className="text-[10px] font-bold">VISA</span>
                </div>
                <div>
                  <p className="font-medium">Visa se terminant par 4242</p>
                  <p className="text-xs text-muted-foreground">Expire le 12/2025</p>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px]">PAR DÉFAUT</Badge>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-medium">Préférences de facturation</h4>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Facturation automatique</span>
                <Badge className="bg-green-500/10 text-green-500 border-green-500/20">ACTIVÉE</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Email de facturation</span>
                <span className="font-medium">compta@entreprise.fr</span>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full">
              <Edit2 className="w-4 h-4 mr-2" />
              Modifier les informations
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Historique des Factures */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="w-5 h-5 text-primary" />
            Historique des Factures
          </CardTitle>
          <CardDescription>
            Consultez et téléchargez vos factures passées.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="h-10 px-4 text-left font-medium">Numéro</th>
                  <th className="h-10 px-4 text-left font-medium">Date</th>
                  <th className="h-10 px-4 text-left font-medium">Montant</th>
                  <th className="h-10 px-4 text-left font-medium">Statut</th>
                  <th className="h-10 px-4 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {invoices.length > 0 ? (
                  invoices.map((invoice: any) => (
                    <tr key={invoice.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="p-4 font-medium">{invoice.number}</td>
                      <td className="p-4 text-muted-foreground">
                        {new Date(invoice.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-4 font-semibold">{(invoice.amount / 100).toFixed(2)} €</td>
                      <td className="p-4">
                        {getStatusBadge(invoice.status)}
                      </td>
                      <td className="p-4 text-right">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleDownloadInvoice(invoice.id)}
                          disabled={downloadInvoiceMutation.isPending}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      Aucune facture disponible pour le moment.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
