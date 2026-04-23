import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { loadStripe, Stripe as StripeJS } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Loader2 } from 'lucide-react';
import { trpc } from "../lib/trpc"; // Import tRPC client

/**
 * Composant de formulaire de paiement Stripe
 */
function PaymentForm({ 
  invoiceId, 
  amount, 
  invoiceNumber, 
  token 
}: { 
  invoiceId: number; 
  amount: number; 
  invoiceNumber: string;
  token: string;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [, setLocation] = useLocation();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Utilisation des mutations tRPC au lieu de fetch REST
  const createPaymentIntent = trpc.billingLegal.payment.createPaymentIntent.useMutation();
  const confirmPayment = trpc.billingLegal.payment.confirmPayment.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      setError("Stripe n'est pas chargé. Veuillez recharger la page.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // 1. Créer le paiement via tRPC (BYOK-aware)
      const { clientSecret, paymentIntentId } = await createPaymentIntent.mutateAsync({
        invoiceId,
        token,
      });

      if (!clientSecret) {
        throw new Error("Erreur lors de la création du paiement");
      }

      // 2. Confirmer le paiement côté Stripe
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        throw new Error("Élément de carte non trouvé");
      }

      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: { name: "Client" },
        },
      });

      if (stripeError) {
        setError(stripeError.message || "Erreur lors du paiement");
        setIsProcessing(false);
        return;
      }

      if (paymentIntent?.status === "succeeded") {
        setSuccess(true);
        
        // 3. Confirmer le paiement côté backend via tRPC
        await confirmPayment.mutateAsync({
          invoiceId,
          paymentIntentId: paymentIntent.id,
          token,
        });

        // Rediriger vers la page de confirmation
        setTimeout(() => {
          setLocation(`/invoice/payment-success/${invoiceId}`);
        }, 2000);
      }
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue");
    } finally {
      setIsProcessing(false);
    }
  };

  if (success) {
    return (
      <div className="text-center space-y-4">
        <div className="text-green-600 text-5xl">✓</div>
        <h3 className="text-lg font-semibold text-green-600">Paiement réussi!</h3>
        <p className="text-gray-600">Redirection en cours...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="border rounded-lg p-4 bg-gray-50">
        <label className="block text-sm font-medium text-gray-700 mb-2">Informations de carte</label>
        <CardElement
          options={{
            style: {
              base: {
                fontSize: "16px",
                color: "#424770",
                "::placeholder": {
                  color: "#aab7c4",
                },
              },
              invalid: {
                color: "#9e2146",
              },
            },
          }}
          className="p-3 border border-gray-300 rounded"
        />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="text-sm text-gray-700">
          <div className="font-semibold mb-2">Montant à payer</div>
          <div className="text-2xl font-bold text-blue-600">{amount.toFixed(2)} €</div>
          <div className="text-xs text-gray-600 mt-2">
            Facture: {invoiceNumber}
          </div>
        </div>
      </div>

      <Button
        type="submit"
        loading={isProcessing}
        disabled={!stripe}
        className="w-full"
      >
        Payer {amount.toFixed(2)} €
      </Button>

      <Alert className="bg-blue-50 border-blue-200">
        <AlertDescription className="text-xs">
          <strong>Sécurité :</strong> Votre paiement est sécurisé par Stripe. Vos données de carte ne sont jamais stockées sur nos serveurs.
        </AlertDescription>
      </Alert>
    </form>
  );
}

/**
 * Page de paiement public (sans authentification requise)
 */
export function InvoicePaymentPage() {
  const [_match, params] = useRoute("/invoice/payment/:token");
  const token = params ? params?.token as string : undefined;
  const [invoice, setInvoice] = useState<any>(null);
  const [stripePromise, setStripePromise] = useState<Promise<StripeJS | null> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // tRPC query pour récupérer la clé publique Stripe du tenant
  const stripeConfigQuery = trpc.billingLegal.payment.getStripePublicKey.useQuery(
    { token: token || "" },
    { enabled: !!token }
  );

  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        if (!token) {
          setError("Token invalide");
          setIsLoading(false);
          return;
        }

        // Récupérer la facture via l'API publique (REST conservé pour la validation initiale du token)
        const response = await fetch(`/api/invoice/validate-token?token=${token}`);
        if (!response.ok) {
          throw new Error("Facture non trouvée ou lien expiré");
        }

        const data = await response.json();
        setInvoice(data.invoice);
      } catch (err: any) {
        setError(err.message || "Erreur lors du chargement de la facture");
      } finally {
        setIsLoading(false);
      }
    };

    fetchInvoice();
  }, [token]);

  // Charger Stripe dynamiquement une fois que la clé publique est disponible
  useEffect(() => {
    if (stripeConfigQuery.data?.publicKey) {
      setStripePromise(loadStripe(stripeConfigQuery.data.publicKey));
    }
  }, [stripeConfigQuery.data?.publicKey]);

  if (isLoading || stripeConfigQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-2xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center space-x-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Chargement de la facture et de la configuration de paiement...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !invoice || stripeConfigQuery.isError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-2xl">
          <CardContent className="pt-6">
            <Alert variant="destructive">
              <AlertDescription>
                <div className="font-medium">Erreur</div>
                <div className="text-sm mt-2">
                  {error || stripeConfigQuery.error?.message || "Facture non trouvée ou configuration Stripe manquante"}
                </div>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (invoice.status === "paid") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="text-green-600">✓ Facture déjà payée</CardTitle>
            <CardDescription>Cette facture a déjà été réglée</CardDescription>
          </CardHeader>
          <CardContent>
            <Alert className="bg-green-50 border-green-200">
              <AlertDescription>
                <div className="font-medium">Facture {invoice.invoiceNumber as string}</div>
                <div className="text-sm mt-1">Montant payé: {parseFloat(invoice.totalAmount as string).toFixed(2)} €</div>
                <div className="text-sm mt-1">Payée le: {new Date(invoice.paidAt as string).toLocaleString("fr-FR")}</div>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalAmount = parseFloat(invoice.totalAmount as string);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Paiement de facture</CardTitle>
          <CardDescription>Complétez le paiement de votre facture en toute sécurité</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Résumé de la facture */}
          <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
            <div>
              <div className="text-sm text-gray-600">Numéro de facture</div>
              <div className="text-lg font-semibold">{invoice.invoiceNumber as string}</div>
            </div>

            {invoice.description && (
              <div>
                <div className="text-sm text-gray-600">Description</div>
                <div className="text-gray-800">{invoice.description as string}</div>
              </div>
            )}

            <div className="border-t pt-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-600">Montant HT</div>
                  <div className="text-lg font-semibold">
                    {parseFloat(invoice.amount as string).toFixed(2)} €
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">TVA</div>
                  <div className="text-lg font-semibold">
                    {parseFloat(invoice.tax as string).toFixed(2)} €
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t pt-3">
              <div className="text-sm text-gray-600">Montant total TTC</div>
              <div className="text-2xl font-bold text-blue-600">
                {totalAmount.toFixed(2)} €
              </div>
            </div>
          </div>

          {/* Formulaire de paiement Stripe */}
          {stripePromise && (
            <Elements stripe={stripePromise}>
              <PaymentForm
                invoiceId={invoice.id as number}
                amount={totalAmount}
                invoiceNumber={invoice.invoiceNumber as string}
                token={token!}
              />
            </Elements>
          )}

          {/* Informations légales */}
          <div className="border-t pt-4 space-y-3">
            <Alert className="bg-blue-50 border-blue-200">
              <AlertDescription className="text-xs text-gray-700">
                <div className="font-semibold mb-2">🔒 Sécurité du paiement</div>
                <p>
                  Ce paiement est traité de manière sécurisée par Stripe, un leader mondial du paiement en ligne.
                  Vos données de carte bancaire ne sont jamais stockées sur nos serveurs.
                </p>
              </AlertDescription>
            </Alert>

            <div className="text-xs text-gray-500">
              <p>
                En effectuant ce paiement, vous acceptez les conditions générales de vente et confirmez
                votre engagement à régler le montant indiqué.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default InvoicePaymentPage;
