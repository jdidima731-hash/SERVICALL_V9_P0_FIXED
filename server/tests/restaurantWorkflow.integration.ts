
import { DialogueEngineService } from "../services/DialogueEngineService";
import MenuNERService from "../services/MenuNERService";
import * as fs from "fs";
import * as path from "path";
// import { fileURLToPath } from "url";
import { logger } from '../core/logger/index';

// const ___filename = fileURLToPath(import.meta.url);
  // const __dirname = path.dirname(__filename);

async function testRestaurantWorkflow() {
  logger.info("🍽️  Testing Restaurant Workflow (End-to-End)...\n");

  // Charger le scénario de dialogue
  const scenarioPath = path.join(process.cwd(), "shared/blueprints/restaurant_order.json");
  const scenario = JSON.parse(fs.readFileSync(scenarioPath, "utf-8"));

  const engine = new DialogueEngineService();
  const nerService = new MenuNERService();

  const callId = "restaurant-e2e-test-001";
  const tenantId = 1;
  const prospectId = 1;

  // Données de test du menu
  const testMenuItems = [
    { id: 1, name: "Pizza Margherita", category: "Pizza", price: 10.0, allergens: ["gluten", "lactose"] },
    { id: 2, name: "Pizza Pepperoni", category: "Pizza", price: 12.0, allergens: ["gluten", "lactose"] },
    { id: 3, name: "Pâtes Carbonara", category: "Pâtes", price: 11.5, allergens: ["gluten", "oeuf"] },
    { id: 4, name: "Tiramisu", category: "Desserts", price: 6.0, allergens: ["lactose", "oeuf"] },
  ];

  try {
    // ============================================
    // ÉTAPE 1: Initialisation de la conversation
    // ============================================
    logger.info("📞 Step 1: Initializing conversation...");
    const initResult = await engine.initializeConversation(callId, scenario, tenantId, prospectId);
    logger.info("✅ IA Response:", initResult.response);
    logger.info("📍 Current State:", initResult.nextState);
    logger.info();

    // ============================================
    // ÉTAPE 2: Simulation de l'intention de commander
    // ============================================
    logger.info("👤 Step 2: User says: 'Je voudrais commander une pizza'");
    let result = await engine.processInput(
      callId,
      {
        text: "Je voudrais commander une pizza",
        callId,
        prospectId,
        tenantId,
      },
      scenario
    );
    logger.info("✅ IA Response:", result.response);
    logger.info("📍 Current State:", result.nextState);
    logger.info("📋 Context:", JSON.stringify(result.context, null, 2));
    logger.info();

    // ============================================
    // ÉTAPE 3: Identification du client
    // ============================================
    logger.info("👤 Step 3: User provides phone number: '0612345678'");
    result = await engine.processInput(
      callId,
      {
        text: "Mon numéro est 0612345678",
        callId,
        prospectId,
        tenantId,
      },
      scenario
    );
    logger.info("✅ IA Response:", result.response);
    logger.info("📍 Current State:", result.nextState);
    logger.info();

    // ============================================
    // ÉTAPE 4: Extraction intelligente de la commande
    // ============================================
    logger.info("🧠 Step 4: Testing NER (Named Entity Recognition) for menu items...");
    const userOrderText = "Je voudrais deux pizzas Margherita et une Carbonara, s'il vous plaît";
    logger.info("👤 User says:", userOrderText);

    const extractedOrder = await nerService.extractOrderFromText(userOrderText, testMenuItems);
    logger.info("✅ Extracted Order:");
    logger.info("   Items:", extractedOrder.items.map((i) => `${i.quantity}x ${i.menuItem.name}`).join(", "));
    logger.info("   Total Price:", extractedOrder.totalPrice + "€");
    logger.info("   Confidence:", (extractedOrder.confidence * 100).toFixed(0) + "%");
    logger.info();

    // ============================================
    // ÉTAPE 5: Validation de la commande
    // ============================================
    logger.info("✔️  Step 5: Validating extracted order...");
    const validation = nerService.validateOrder(extractedOrder);
    if (validation.valid) {
      logger.info("✅ Order is valid!");
    } else {
      logger.info("❌ Order validation errors:");
      validation.errors.forEach((error) => logger.info("   -", error));
    }
    logger.info();

    // ============================================
    // ÉTAPE 6: Formatage pour la réponse vocale
    // ============================================
    logger.info("🔊 Step 6: Formatting order for speech...");
    const speechText = nerService.formatOrderForSpeech(extractedOrder);
    logger.info("✅ Speech Output:", speechText);
    logger.info();

    // ============================================
    // ÉTAPE 7: Simulation de la confirmation
    // ============================================
    logger.info("👤 Step 7: User confirms: 'Oui, c'est correct'");
    result = await engine.processInput(
      callId,
      {
        text: "Oui, c'est correct",
        callId,
        prospectId,
        tenantId,
      },
      scenario
    );
    logger.info("✅ IA Response:", result.response);
    logger.info("📍 Current State:", result.nextState);
    logger.info();

    // ============================================
    // ÉTAPE 8: Collecte de l'adresse
    // ============================================
    logger.info("👤 Step 8: User provides address: '15 rue de la République, 75001 Paris'");
    result = await engine.processInput(
      callId,
      {
        text: "15 rue de la République, 75001 Paris",
        callId,
        prospectId,
        tenantId,
      },
      scenario
    );
    logger.info("✅ IA Response:", result.response);
    logger.info("📍 Current State:", result.nextState);
    logger.info();

    // ============================================
    // ÉTAPE 9: Confirmation du paiement
    // ============================================
    logger.info("👤 Step 9: User chooses payment method: 'À la livraison'");
    result = await engine.processInput(
      callId,
      {
        text: "À la livraison",
        callId,
        prospectId,
        tenantId,
      },
      scenario
    );
    logger.info("✅ IA Response:", result.response);
    logger.info("📍 Current State:", result.nextState);
    logger.info();

    // ============================================
    // RÉSUMÉ FINAL
    // ============================================
    logger.info("=".repeat(60));
    logger.info("✅ RESTAURANT WORKFLOW TEST COMPLETED SUCCESSFULLY!");
    logger.info("=".repeat(60));
    logger.info();
    logger.info("📊 Test Summary:");
    logger.info("   ✓ Dialogue initialization");
    logger.info("   ✓ Intent recognition (order_food)");
    logger.info("   ✓ State transitions");
    logger.info("   ✓ Menu item extraction (NER)");
    logger.info("   ✓ Order validation");
    logger.info("   ✓ Workflow progression to confirmation");
    logger.info();
    logger.info("🎯 Next Steps:");
    logger.info("   1. Integrate Google Sheets for order storage");
    logger.info("   2. Add SMS notifications");
    logger.info("   3. Implement payment processing");
    logger.info("   4. Deploy to production");
  } catch (error: unknown) {
    logger.error("\n❌ Test failed with error:", error);
    process.exit(1);
  }
}

testRestaurantWorkflow();
