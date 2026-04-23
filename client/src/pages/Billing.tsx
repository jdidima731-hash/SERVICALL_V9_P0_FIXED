
import { CreditCard, Download, Package, Loader2, Receipt  } from 'lucide-react';
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";
import type { Subscription, Invoice } from "../../../shared/types/billing";
import { RouterOutputs } from "@/lib/trpc";
import { normalizeSubscription, normalizeInvoices } from "@/utils/normalizers/billing";


type GetSubscriptionOutput = RouterOutputs["billing"]["getSubscription"];

type GetInvoicesOutput = RouterOutputs["billing"]["getInvoices"];

export default function Billing() {
  const { t } = useTranslation('pages');
  const { tenantId } = useTenant();

  // Queries
  
  const { data: subscriptionData, isPending: subscriptionLoading } = trpc.billingLegal.billing.getSubscription.useQuery({ tenantId });
  
  const { data: invoicesData, isPending: invoicesLoading } = trpc.billingLegal.billing.getInvoices.useQuery({ tenantId });

  // ✅ Bloc 3 & 4: Normalisation et Validation Runtime
  const subscription: Subscription | undefined = subscriptionData?.subscription ? normalizeSubscription(subscriptionData.subscription) : undefined;
  const invoices: Invoice[] = invoicesData?.invoices ? normalizeInvoices(invoicesData.invoices) : [];

  const portalMutation = trpc.billingLegal.billing.createPortalSession.useMutation({
    onSuccess: (data: any) => {
      window.location.href = data.url;
    },
    onError: (error) => {
      toast.error(t('billing.error_portal') + error.message);
    },
  });

  const handleManageBilling = () => {
    portalMutation.mutate({
      tenantId,
      returnUrl: window.location.href,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">{t('pages.billing.status_paid')}</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">{t('pages.billing.status_pending')}</Badge>;
      case "failed":
        return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">{t('pages.billing.status_failed')}</Badge>;
      default:
        return <Badge variant="outline">{status.toUpperCase()}</Badge>;
    }
  };

  const getSubscriptionStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">{t('pages.billing.status_active')}</Badge>;
      case "inactive":
        return <Badge className="bg-gray-500/10 text-gray-500 border-gray-500/20">INACTIF</Badge>;
      case "suspended":
        return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">SUSPENDU</Badge>;
      case "cancelled":
        return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">ANNULÉ</Badge>;
      default:
        return <Badge variant="outline">{status.toUpperCase()}</Badge>;
    }
  };

  const handleDownloadInvoice = (_invoiceId: number) => {
    toast.info(t('pages.billing.downloading'));
    // In a real scenario, this would trigger a download
  };

  const paymentLinkMutation = trpc.billingLegal.billing.createPaymentLink.useMutation({
    onSuccess: (data: any) => {
      window.location.href = data.url;
    },
    onError: (error) => {
      toast.error(t('pages.billing.error_payment') + error.message);
    }
  });

  const handleChangePlan = (planId: "starter" | "pro" | "enterprise") => {
    paymentLinkMutation.mutate({ planId });
  };

  if (subscriptionLoading || invoicesLoading) {
    return (
      <div className="space-y-6" data-main-content>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            <CreditCard className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-3xl font-black tracking-tight">{t('pages.billing.title')}</h1>
        </div>
        <LoadingState 
          message="Chargement des informations de facturation..." 
          timeout={10000}
        />
      </div>
    );
  }

  const planNames: Record<string, string> = {
    starter: "Starter",
    pro: "Pro",
    enterprise: "Enterprise",
  };

  const planPrices: Record<string, string> = {
    starter: "29.00 €",
    pro: "149.00 €",
    enterprise: "Personnalisé",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Facturation</h1>
          <p className="text-muted-foreground">Gérez votre abonnement, vos factures et vos méthodes de paiement.</p>
        </div>
        <Button 
          onClick={handleManageBilling} 
          disabled={portalMutation.isPending}
          className="gap-2 shadow-lg shadow-primary/20"
        >
          {portalMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
          Gérer la facturation
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              Abonnement Actuel
            </CardTitle>
            <CardDescription>
              Vous êtes sur le forfait <strong>{subscription ? planNames[subscription.plan] : "N/A"}</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-end">
              <div className="text-3xl font-bold">
                {subscription ? planPrices[subscription.plan] : "N/A"}
                <span className="text-sm font-normal text-muted-foreground">/mois</span>
              </div>
              {subscription && subscription.status && getSubscriptionStatusBadge(subscription.status)}
            </div>
            {subscription && (
              <>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Appels inclus</span>
                    <span>{subscription.callsIncluded} appels</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Sièges agents</span>
                    <span>{subscription.agentSeats} sièges</span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2 w-full">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleChangePlan("starter")}
                disabled={paymentLinkMutation.isPending}
              >
                Passer au Starter
              </Button>
              <Button 
                variant="default" 
                size="sm"
                onClick={() => handleChangePlan("pro")}
                disabled={paymentLinkMutation.isPending}
              >
                Passer au Pro
              </Button>
            </div>
            {paymentLinkMutation.isPending && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Génération du lien Stripe...
              </p>
            )}
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              Méthode de Paiement
            </CardTitle>
            <CardDescription>Votre carte par défaut pour le prélèvement automatique.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-4 py-6">
            <div className="w-12 h-8 bg-slate-200 rounded flex items-center justify-center font-bold text-xs">VISA</div>
            <div className="flex-1">
              <p className="font-medium">Visa se terminant par 4242</p>
              <p className="text-sm text-muted-foreground">Expire le 12/2028</p>
            </div>
            <Button variant="ghost" size="sm">Modifier</Button>
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full">Ajouter une méthode</Button>
          </CardFooter>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historique des Factures</CardTitle>
          <CardDescription>Téléchargez vos factures passées au format PDF.</CardDescription>
        </CardHeader>
        <CardContent>
          {invoices && invoices.length > 0 ? (
            <div className="space-y-4">
              {invoices.map((invoice: Invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-primary/10 rounded">
                      <Download className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">Facture #{invoice.id}</p>
                      <p className="text-sm text-muted-foreground">
                        {invoice.createdAt
                          ? new Date(invoice.createdAt).toLocaleDateString("fr-FR")
                          : "N/A"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <p className="font-bold">
                      {(() => {
                        const amount = invoice.amount;
                        
                        if (typeof amount === 'number') return (Number(amount) || 0).toFixed(2);
                        if (typeof amount === 'string') return parseFloat(amount).toFixed(2);
                        return "0.00";
                      })()}
                      {" €"}
                    </p>
                    {getStatusBadge(invoice.status || "pending")}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDownloadInvoice(invoice.id)}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8">
              <EmptyState 
                icon={<Receipt className="size-6" />}
                title="Aucune facture"
                description="Vos factures apparaîtront ici une fois votre abonnement activé."
                showAction={false}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Informations de Facturation</CardTitle>
          <CardDescription>Détails de votre abonnement et de facturation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {subscription && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Plan</p>
                  <p className="font-semibold">{planNames[subscription.plan]}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Statut</p>
                  <p className="font-semibold">{subscription.status}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Appels inclus</p>
                  <p className="font-semibold">{subscription.callsIncluded}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Sièges agents</p>
                  <p className="font-semibold">{subscription.agentSeats}</p>
                </div>
              </div>
              {subscription.createdAt && (
                <div>
                  <p className="text-sm text-muted-foreground">Date d'activation</p>
                  <p className="font-semibold">
                    {new Date(subscription.createdAt).toLocaleDateString("fr-FR")}
                  </p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}