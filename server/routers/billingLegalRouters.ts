import { router } from "../_core/trpc";
import { billingRouter } from "./billingRouter";
import { invoiceRouter } from "./invoiceRouter";
import { orderRouter } from "./orderRouter";
import { paymentRouter } from "./paymentRouter";
import { rgpdRouter } from "./rgpdRouter";

export const billingLegalRouter = router({
  billing: billingRouter,
  invoice: invoiceRouter,
  order: orderRouter,
  payment: paymentRouter,
  rgpd: rgpdRouter,
});
