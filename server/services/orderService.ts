import { getDbInstance } from "../db";
import * as schema from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { logger } from "../infrastructure/logger";

export class OrderService {
  /**
   * Créer une commande avec ses articles
   */
  static async createOrder(data: {
    tenantId: number;
    prospectId?: number;
    orderNumber: string;
    status?: string;
    totalAmount: number;
    currency?: string;
    paymentStatus?: string;
    shippingAddress?: any;
    billingAddress?: any;
    notes?: string;
    metadata?: any;
    items: Array<{
      productId?: string;
      name: string;
      quantity: number;
      unitPrice: number;
    }>;
  }) {
    const db = getDbInstance();
    
    try {
      return await db.transaction(async (tx: any) => {
        // 1. Insérer la commande
        const [order] = await tx.insert(schema.orders).values({
          tenantId: data.tenantId,
          prospectId: data.prospectId,
          orderNumber: data.orderNumber,
          status: data.status ?? 'pending',
          totalAmount: data.totalAmount.toString(),
          currency: data.currency ?? 'EUR',
          paymentStatus: data.paymentStatus ?? 'unpaid',
          shippingAddress: data.shippingAddress,
          billingAddress: data.billingAddress,
          notes: data.notes,
          metadata: data.metadata,
        }).returning();

        // 2. Insérer les articles
        if (data.items && data.items.length > 0) {
          const itemsToInsert = data.items.map((item: any) => ({
            orderId: order.id,
            productId: item.productId,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice.toString(),
            totalPrice: (item.unitPrice * item.quantity).toString(),
          }));
          await tx.insert(schema.orderItems).values(itemsToInsert);
        }

        logger.info(`[OrderService] Order created: ${order.orderNumber}`, { orderId: order.id });
        return order;
      });
    } catch (error: any) {
      logger.error(`[OrderService] Failed to create order`, { error: (error instanceof Error ? error.message : String(error)) });
      throw error;
    }
  }

  /**
   * Récupérer les commandes d'un tenant
   */
  static async getOrdersByTenant(tenantId: number) {
    const db = getDbInstance();
    return await db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.tenantId, tenantId))
      .orderBy(desc(schema.orders.createdAt));
  }

  /**
   * Récupérer les détails d'une commande
   */
  static async getOrderDetails(orderId: number) {
    const db = getDbInstance();
    const order = await db.query.orders.findFirst({
      where: eq(schema.orders.id, orderId),
      with: {
        items: true,
      },
    });
    return order;
  }
}
