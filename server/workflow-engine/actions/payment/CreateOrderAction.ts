/**
 * CREATE ORDER ACTION
 * Crée une commande pour la vente de produits
 */

import { z } from "zod";
import type { ActionHandler, ActionResult } from "@server/workflow-engine/types";
import type { FinalExecutionContext } from "@server/workflow-engine/structured-types";
import { Logger } from "@server/infrastructure/logger";
import { OrderService } from "@server/services/orderService";

/** Type d'un article de commande — aligné avec OrderService.createOrder */
interface OrderItem {
  productId?: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

// Schéma d'un article de commande (avec valeurs par défaut pour la flexibilité)
const OrderItemSchema = z.object({
  productId: z.string().optional(),
  name: z.string().default('Produit'),
  quantity: z.number().positive().default(1),
  unitPrice: z.number().nonnegative().default(0),
  // Alias pour compatibilité avec les configs existantes
  price: z.number().nonnegative().optional(),
});

// Configuration structurée
const CreateOrderConfigSchema = z.object({
  prospect_id: z.number().optional(),
  items: z.array(OrderItemSchema).optional(),
  product_name: z.string().optional(),
  quantity: z.number().optional(),
  unit_price: z.number().optional(),
  total: z.number().optional(),
  reference: z.string().optional(),
  currency: z.string().optional(),
  status: z.string().optional(),
  notes: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
type CreateOrderConfig = z.infer<typeof CreateOrderConfigSchema>;

interface PersistedOrder {
  id?: string | number;
  orderNumber?: string;
  totalAmount?: number;
  [key: string]: unknown;
}

export class CreateOrderAction implements ActionHandler<CreateOrderConfig, FinalExecutionContext, PersistedOrder> {
  name = 'create_order';
  private logger = new Logger('CreateOrderAction');

  async execute(
    context: FinalExecutionContext,
    config: CreateOrderConfig
  ): Promise<ActionResult<PersistedOrder>> {
    try {
      const validatedConfig = CreateOrderConfigSchema.parse(config);

      const prospectId: number | undefined =
        validatedConfig.prospect_id ?? context.variables.prospect?.id;

      // Construction des items de commande avec types stricts
      const rawItems = validatedConfig.items ?? [];
      const items: OrderItem[] = rawItems.length > 0
        ? rawItems.map((item) => ({
            productId: item.productId,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice ?? item.price ?? 0,
          }))
        : [
            {
              name: validatedConfig.product_name ?? 'Produit par défaut',
              quantity: validatedConfig.quantity ?? 1,
              unitPrice: validatedConfig.unit_price ?? validatedConfig.total ?? 0,
            }
          ];

      if (items.length === 0) {
        throw new Error('No items provided for order');
      }

      const totalAmount = validatedConfig.total ?? this.calculateTotal(items);
      const orderNumber = validatedConfig.reference ?? `ORD-${Date.now()}`;

      const order = await OrderService.createOrder({
        tenantId: context.tenant.id,
        prospectId,
        orderNumber,
        items,
        totalAmount,
        currency: validatedConfig.currency ?? 'EUR',
        status: validatedConfig.status ?? 'pending',
        notes: validatedConfig.notes,
        metadata: {
          workflow_id: context.workflow.id,
          workflow_execution_id: context.event.id,
          source: 'workflow_action',
          ...(validatedConfig.metadata ?? {}),
        }
      });

      const persistedOrder: PersistedOrder = typeof order === 'object' && order !== null ? order : {};
      context.variables.order = persistedOrder;
      context.variables.order_id = persistedOrder.id;
      context.variables.order_number = persistedOrder.orderNumber;
      context.variables.order_total = persistedOrder.totalAmount;

      this.logger.info('Order created and saved', {
        order_number: persistedOrder.orderNumber,
        total_amount: persistedOrder.totalAmount,
        tenant: context.tenant.id
      });

      return { success: true, data: persistedOrder };
    } catch (error: unknown) {
      this.logger.error('Failed to create order', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private calculateTotal(items: OrderItem[]): number {
    return items.reduce((total, item) => total + item.unitPrice * item.quantity, 0);
  }

  validate(config: Record<string, unknown>): boolean {
    const items = config['items'];
    if (items !== undefined) {
      return Array.isArray(items) && items.length > 0;
    }
    // items peut venir de product_name/quantity/unit_price
    return true;
  }
}
