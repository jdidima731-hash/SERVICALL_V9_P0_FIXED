import { z } from "zod";
import { router } from "../_core/trpc";
import { tenantProcedure } from "../procedures";
import { OrderService } from "../services/orderService";

export const orderRouter = router({
  /**
   * Récupérer toutes les commandes du tenant
   */
  list: tenantProcedure.query(async ({ ctx }) => {
    return await OrderService.getOrdersByTenant(ctx.tenantId!);
  }),

  /**
   * Récupérer les détails d'une commande
   */
  get: tenantProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }: any) => {
      return await OrderService.getOrderDetails(input.id);
    }),

  /**
   * Créer une commande manuellement
   */
  create: tenantProcedure
    .input(z.object({
      prospectId: z.number().optional(),
      orderNumber: z.string(),
      items: z.array(z.object({
        productId: z.string().optional(),
        name: z.string(),
        quantity: z.number(),
        unitPrice: z.number(),
      })),
      totalAmount: z.number(),
      currency: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }: any) => {
      return await OrderService.createOrder({
        ...input,
        tenantId: ctx.tenantId!,
      });
    }),
});
