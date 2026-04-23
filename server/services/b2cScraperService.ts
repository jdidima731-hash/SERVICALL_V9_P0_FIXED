/**
 * b2cScraperService.ts — VERSION RÉELLE PLAYWRIGHT
 * ─────────────────────────────────────────────────────────────────────────────
 * Service de scraping B2C utilisant Playwright pour extraire des prospects réels.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { chromium, Browser, Page } from "playwright";
import { logger } from "../infrastructure/logger";
import { Business } from "./leadExtractionService";

export interface B2CSearchParams {
  query: string;
  location: string;
  maxResults: number;
  housingType?: "house" | "apartment" | "all";
  estimatedIncome?: "low" | "medium" | "high" | "very_high" | "all";
  hasChildren?: boolean;
  propertyStatus?: "owner" | "tenant" | "all";
  ageRange?: string;
}

/**
 * Exécute un scraping Playwright pour trouver des particuliers via des profils publics.
 */
export async function runB2CScraper(
  params: B2CSearchParams | string,
  locationArg?: string,
  maxResultsArg?: number
): Promise<Business[]> {
  let queryStr: string;
  let location: string;
  let maxResults: number;
  let filters: Partial<B2CSearchParams> = {};

  if (typeof params === "string") {
    queryStr = params;
    location = locationArg || "France";
    maxResults = maxResultsArg || 10;
  } else {
    queryStr = params.query;
    location = params.location;
    maxResults = params.maxResults;
    filters = params;
  }

  logger.info("[B2CScraper] Starting REAL Playwright scraping session", { queryStr, location, filters });

  const results: Business[] = [];
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
    });
    
    const page: Page = await context.newPage();

    // Stratégie : Utiliser Bing pour trouver des profils publics (plus permissif que Google)
    // On construit une requête de recherche ciblée
    const searchTerms = [queryStr, location];
    if (filters.housingType && filters.housingType !== 'all') searchTerms.push(filters.housingType === 'house' ? 'pavillon' : 'appartement');
    if (filters.propertyStatus === 'owner') searchTerms.push('propriétaire');
    
    const fullQuery = searchTerms.join(" ");
    // Recherche élargie pour éviter les blocages de Bing sur les sites spécifiques
    const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(fullQuery)}+contact+email+phone`;
    
    logger.info(`[B2CScraper] Navigating to: ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Attendre un peu pour le rendu JS
    await page.waitForTimeout(5000);

    // Attendre que les résultats chargent (plusieurs sélecteurs possibles)
    await page.waitForSelector('.b_algo, #b_results', { timeout: 15000 }).catch(() => logger.warn("Bing results selector not found"));

    // Extraction des résultats de recherche
    const entries = await page.$$eval('.b_algo', (elements) => {
      return elements.map(el => {
        const titleEl = el.querySelector('h2 a');
        const snippetEl = el.querySelector('.b_caption p, .lib_p');
        return {
          title: titleEl?.textContent || '',
          url: (titleEl as HTMLAnchorElement)?.href || '',
          snippet: snippetEl?.textContent || ''
        };
      });
    });

    logger.info(`[B2CScraper] Found ${entries.length} raw search entries`);

    for (const entry of entries.slice(0, maxResults)) {
      if (!entry.title) continue;

      // Nettoyage du nom (souvent "Nom Prénom - LinkedIn")
      const cleanName = entry.title.split(/[-|]/)[0].trim();
      
      // Extraction basique de localisation dans le snippet
      const hasLocation = entry.snippet.toLowerCase().includes(location.toLowerCase());
      
      results.push({
        _source: "b2c",
        _externalId: `b2c-${Buffer.from(entry.url).toString('base64').slice(0, 12)}`,
        name: cleanName,
        address: location, // Précision limitée via scraping web simple
        city: location,
        country: "France",
        phone: "N/A (RGPD Protected)", 
        email: "N/A (RGPD Protected)",
        category: "Particulier",
        isIndividual: true,
        website: entry.url,
        description: `Profil trouvé via ${new URL(entry.url).hostname}. Snippet: ${entry.snippet.slice(0, 150)}... Filters applied: ${JSON.stringify(filters)}`
      });
    }

    // Si aucun résultat réel (Bing bloque ou autre), on retourne une liste vide
    if (results.length === 0) {
      logger.info("[B2CScraper] No real results found for this query.");
    }

  } catch (error: any) {
    logger.error("[B2CScraper] Error during Playwright scraping", { error: error.message });
  } finally {
    if (browser) await browser.close();
  }

  return results;
}
