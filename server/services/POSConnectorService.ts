/**
 * POS CONNECTOR SERVICE
 * Service de connexion et synchronisation avec les systèmes de caisse (POS)
 */

import { logger } from "../infrastructure/logger";

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  vatRate: number;
}

export interface OrderData {
  id: string;
  tenantId: number;
  items: OrderItem[];
  totalAmount: number;
  vatAmount: number;
  customerName?: string;
  customerPhone?: string;
}

export interface OrderResult {
  success: boolean;
  posOrderId?: string;
  error?: string;
}

/**
 * Interface commune pour tous les adaptateurs POS
 */
export interface POSAdapter {
  name: string;
  testConnection(config: any): Promise<boolean>;
  createOrder(config: any, order: OrderData): Promise<OrderResult>;
  updateOrder(config: any, posOrderId: string, data: Partial<OrderData>): Promise<boolean>;
  cancelOrder(config: any, posOrderId: string): Promise<boolean>;
}

// ============================================
// ADAPTERS IMPLÉMENTATIONS (Simulations API)
// ============================================

class LightspeedAdapter implements POSAdapter {
  name = "lightspeed";
  async testConnection(config: any) {
    logger.info("[Lightspeed] Testing connection", { apiKey: config.apiKey?.substring(0, 5) + "..." });
    return !!config.apiKey;
  }
  async createOrder(_config: any, order: OrderData): Promise<OrderResult> {
    logger.info("[Lightspeed] Creating order", { orderId: order.id });
    return { success: true, posOrderId: `LS-${crypto.randomUUID().replace(/-/g,"").slice(0,9)}` };
  }
  async updateOrder() { return true; }
  async cancelOrder() { return true; }
}

class SumUpAdapter implements POSAdapter {
  name = "sumup";
  async testConnection(config: any) { return !!config.accessToken; }
  async createOrder(_config: any, _order: OrderData): Promise<OrderResult> {
    return { success: true, posOrderId: `SU-${crypto.randomUUID().replace(/-/g,"").slice(0,9)}` };
  }
  async updateOrder() { return true; }
  async cancelOrder() { return true; }
}

class ZettleAdapter implements POSAdapter {
  name = "zettle";
  async testConnection(config: any) { return !!config.clientId && !!config.clientSecret; }
  async createOrder(_config: any, _order: OrderData): Promise<OrderResult> {
    return { success: true, posOrderId: `ZE-${crypto.randomUUID().replace(/-/g,"").slice(0,9)}` };
  }
  async updateOrder() { return true; }
  async cancelOrder() { return true; }
}

class SquareAdapter implements POSAdapter {
  name = "square";
  async testConnection(config: any) { return !!config.accessToken; }
  async createOrder(_config: any, _order: OrderData): Promise<OrderResult> {
    return { success: true, posOrderId: `SQ-${crypto.randomUUID().replace(/-/g,"").slice(0,9)}` };
  }
  async updateOrder() { return true; }
  async cancelOrder() { return true; }
}

class TillerAdapter implements POSAdapter {
  name = "tiller";
  async testConnection(config: any) { return !!config.apiKey; }
  async createOrder(_config: any, _order: OrderData): Promise<OrderResult> {
    return { success: true, posOrderId: `TI-${crypto.randomUUID().replace(/-/g,"").slice(0,9)}` };
  }
  async updateOrder() { return true; }
  async cancelOrder() { return true; }
}

// ============================================
// SERVICE PRINCIPAL
// ============================================

export class POSConnectorService {
  private adapters: Map<string, POSAdapter> = new Map();

  constructor() {
    this.registerAdapter(new LightspeedAdapter());
    this.registerAdapter(new SumUpAdapter());
    this.registerAdapter(new ZettleAdapter());
    this.registerAdapter(new SquareAdapter());
    this.registerAdapter(new TillerAdapter());
  }

  private registerAdapter(adapter: POSAdapter) {
    this.adapters.set(adapter.name, adapter);
  }

  /**
   * Récupère l'adaptateur pour un provider donné
   */
  getAdapter(provider: string): POSAdapter | undefined {
    return this.adapters.get(provider.toLowerCase());
  }

  /**
   * Teste la connexion avec un provider
   */
  async testConnection(provider: string, config: any): Promise<boolean> {
    const adapter = this.getAdapter(provider);
    if (!adapter) throw new Error(`Provider POS inconnu: ${provider}`);
    
    try {
      return await adapter.testConnection(config);
    } catch (error: any) {
      logger.error(`[POSConnectorService] Test connection failed for ${provider}`, { error });
      return false;
    }
  }

  /**
   * Envoie une commande vers le POS
   */
  async syncOrder(provider: string, config: any, order: OrderData): Promise<OrderResult> {
    const adapter = this.getAdapter(provider);
    if (!adapter) throw new Error(`Provider POS inconnu: ${provider}`);

    try {
      logger.info(`[POSConnectorService] Syncing order to ${provider}`, { orderId: order.id });
      const result = await adapter.createOrder(config, order);
      return result;
    } catch (error: any) {
      logger.error(`[POSConnectorService] Sync order failed for ${provider}`, { orderId: order.id, error });
      return { 
        success: false, 
        error: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : "Erreur inconnue lors de la synchronisation POS" 
      };
    }
  }
}

// Export singleton
export const posConnectorService = new POSConnectorService();
