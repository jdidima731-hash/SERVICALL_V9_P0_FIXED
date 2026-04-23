import OpenAI from 'openai';
import { AI_MODEL } from '../_core/aiModels';
import { getOpenAIClient } from "../_core/openaiClient";
import { logger } from "../infrastructure/logger";

export interface MenuItem {
  id: number;
  name: string;
  category: string;
  price: number;
  allergens?: string[];
}

export interface ExtractedOrder {
  items: Array<{
    menuItem: MenuItem;
    quantity: number;
    specialRequests?: string;
  }>;
  totalPrice: number;
  confidence: number;
}

export class MenuNERService {
  private openai: OpenAI;

  constructor(_apiKey?: string) {
    this.openai = getOpenAIClient();
  }

  /**
   * Extrait les articles de menu et les quantités du texte utilisateur
   */
  async extractOrderFromText(
    text: string,
    menuItems: MenuItem[]
  ): Promise<ExtractedOrder> {
    try {
      // Créer un catalogue de menu pour le contexte de l'IA
      const menuCatalog = menuItems
        .map((item: any) => `- ${item.name} (${item.category}, ${item.price}€)`)
        .join("\n");

      const response = await this.openai.chat.completions.create({
        model: AI_MODEL.DEFAULT,
        messages: [
          {
            role: "system",
            content: `You are an expert in extracting food orders from natural language text.
            
Given the following menu:
${menuCatalog}

Extract the following from the user's input:
1. Each menu item mentioned (must match exactly with the menu)
2. The quantity for each item (default to 1 if not specified)
3. Any special requests or modifications
4. Confidence score (0-1) for the extraction

Return a JSON object with the following structure:
{
  "items": [
    {
      "menuItemName": "string",
      "quantity": number,
      "specialRequests": "string or null"
    }
  ],
  "confidence": number,
  "unrecognizedItems": ["string"]
}

If no items are recognized, return an empty items array with confidence 0.`,
          },
          {
            role: "user",
            content: text,
          },
        ],
        temperature: 0.3,
      });

      const content = response.choices[0]!.message.content;
      if (!content) {
        return { items: [], totalPrice: 0, confidence: 0 };
      }

      const parsed = JSON.parse(content);

      // Mapper les noms d'articles aux objets MenuItem
      const extractedItems = parsed.items
        .map((item: any) => {
          const menuItem = menuItems.find(
            (m) => m.name.toLowerCase() === item.menuItemName.toLowerCase()
          );
          if (!menuItem) return null;

          return {
            menuItem,
            quantity: item.quantity ?? 1,
            specialRequests: item.specialRequests || undefined,
          };
        })
        .filter((item: any) => item !== null);

      // Calculer le prix total
      const totalPrice = extractedItems.reduce(
        (sum: number, item: any) => sum + item.menuItem.price * item.quantity,
        0
      );

      logger.info("Order extracted from text", {
        itemCount: extractedItems.length,
        totalPrice,
        confidence: parsed.confidence,
      });

      return {
        items: extractedItems,
        totalPrice,
        confidence: parsed.confidence ?? 0.5,
      };
    } catch (error: any) {
      logger.error("Error extracting order from text:", error);
      return { items: [], totalPrice: 0, confidence: 0 };
    }
  }

  /**
   * Valide une commande extraite
   */
  validateOrder(order: ExtractedOrder): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (order.items.length === 0) {
      errors.push("La commande ne contient aucun article");
    }

    if (order.confidence < 0.5) {
      errors.push("La confiance d'extraction est trop faible");
    }

    for (const item of order.items) {
      if (item.quantity <= 0) {
        errors.push(`La quantité pour ${item.menuItem.name} doit être positive`);
      }
      if (item.quantity > 10) {
        errors.push(`La quantité pour ${item.menuItem.name} semble trop élevée`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Formate une commande pour l'affichage vocal
   */
  formatOrderForSpeech(order: ExtractedOrder): string {
    const itemsList = order.items
      .map((item: any) => `${item.quantity} ${item.menuItem.name}`)
      .join(", ");

    return `Votre commande comprend ${itemsList}. Le total est de ${order.totalPrice.toFixed(2)}€.`;
  }
}

export default MenuNERService;
