/**
 * leadExtractionService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Service d'extraction de leads depuis 4 fournisseurs :
 *
 *  1. OpenStreetMap / Overpass API  — 100% gratuit, zéro clé requise
 *  2. Google Maps Places API        — BYOK (clé stockée en BYOK chiffrée)
 *  3. Pages Jaunes API              — BYOK (clé stockée en BYOK chiffrée)
 *  4. B2C Scraper (Playwright)      — Extraction de particuliers avec filtres
 *
 * Architecture :
 *  - searchBusinesses(params)       → appelle le bon provider
 *  - geocodeLocation(location)      → résout "Paris" → {lat, lng} via OSM Nominatim
 *  - chaque provider retourne []Business normalisé
 *  - importBusinessesAsProspects()  → insère dans prospects (dédup par phone)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { logger } from "../infrastructure/logger";
import { getAPIKey } from "./byokService";
import { db } from "../db";
import { prospects, leadExtractions } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { runB2CScraper } from "./b2cScraperService";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Business {
  _source: "osm" | "google" | "pagesjaunes" | "servicall" | "b2c";
  _externalId: string;
  name: string;
  address: string;
  city: string;
  postalCode?: string;
  country: string;
  phone?: string;
  website?: string;
  email?: string;
  category?: string;
  rating?: number;
  reviewCount?: number;
  lat?: number;
  lng?: number;
  openingHours?: string[];
  description?: string;
  isIndividual?: boolean;
}

export interface SearchParams {
  query: string;
  location: string;
  radius: number;          // en mètres
  maxResults: number;
  provider: "osm" | "google" | "pagesjaunes" | "servicall" | "b2c" | "auto";
  tenantId: number;
  // Filtres B2C optionnels
  housingType?: "house" | "apartment" | "all";
  estimatedIncome?: "low" | "medium" | "high" | "very_high" | "all";
  hasChildren?: boolean;
  propertyStatus?: "owner" | "tenant" | "all";
  ageRange?: string;
}

export interface SearchResult {
  businesses: Business[];
  total: number;
  provider: string;
  extractionId?: number;
  error?: string;
}

// ── Géocodage via OSM Nominatim (gratuit) ─────────────────────────────────────

export async function geocodeLocation(
  location: string
): Promise<{ lat: number; lng: number; displayName: string } | null> {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", location);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");
    url.searchParams.set("addressdetails", "1");

    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": "Servicall-CRM/3.3 (contact@servicall.com)",
        "Accept-Language": "fr,en",
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      logger.warn("[LeadExtraction] Nominatim geocoding failed", { status: res.status, location });
      return null;
    }

    const results = (await res.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
    }>;

    if (!results.length) return null;

    return {
      lat: parseFloat(results[0]!.lat),
      lng: parseFloat(results[0]!.lon),
      displayName: results[0]!.display_name,
    };
  } catch (err: any) {
    logger.error("[LeadExtraction] Geocoding error", { err, location });
    return null;
  }
}

// ── Provider 1 : OpenStreetMap via Overpass API ───────────────────────────────

function buildOverpassQuery(
  query: string,
  lat: number,
  lng: number,
  radius: number,
  limit: number
): string {
  const amenityMap: Record<string, string> = {
    restaurant: "restaurant", "hôtel": "hotel", hotel: "hotel", pharmacie: "pharmacy", pharmacy: "pharmacy",
    "médecin": "doctors", medecin: "doctors", "généraliste": "doctors", generaliste: "doctors",
    dentiste: "dentist", banque: "bank", bank: "bank", "école": "school", ecole: "school",
    bar: "bar", "café": "cafe", cafe: "cafe", "cinéma": "cinema", cinema: "cinema",
    "théâtre": "theatre", theatre: "theatre", "hôpital": "hospital", hopital: "hospital",
    hospital: "hospital", parking: "parking", poste: "post_office", mairie: "townhall",
    "bibliothèque": "library", bibliotheque: "library", fast_food: "fast_food", fastfood: "fast_food",
    "restauration rapide": "fast_food", pizzeria: "restaurant", brasserie: "restaurant",
    kebab: "fast_food", bureau: "office", clinique: "clinic", kiosque: "kiosk",
    "bureau de poste": "post_office", notaire: "office", avocat: "office",
    comptable: "office", expert: "office",
  };

  const shopMap: Record<string, string> = {
    boulangerie: "bakery", bakery: "bakery", coiffeur: "hairdresser", hairdresser: "hairdresser",
    coiffeuse: "hairdresser", barbier: "barber", garage: "car_repair", car_repair: "car_repair",
    "garagiste": "car_repair", "super marché": "supermarket", "supermarché": "supermarket",
    supermarche: "supermarket", supermarket: "supermarket", "épicerie": "convenience",
    epicerie: "convenience", fleuriste: "florist", florist: "florist", librairie: "books",
    books: "books", boucherie: "butcher", butcher: "butcher", poissonnerie: "seafood",
    fromagerie: "cheese", "pâtisserie": "pastry", patisserie: "pastry", confiserie: "confectionery",
    bijouterie: "jewelry", jewelry: "jewelry", "vêtements": "clothes", vetements: "clothes",
    clothes: "clothes", chaussures: "shoes", shoes: "shoes", "électronique": "electronics",
    electronique: "electronics", electronics: "electronics", informatique: "computer",
    computer: "computer", bricolage: "doityourself", jardinage: "garden_centre",
    opticien: "optician", optician: "optician", pharmacien: "pharmacy", pressing: "dry_cleaning",
    nettoyage: "dry_cleaning", laverie: "laundry", traiteur: "deli", cave: "wine",
    vin: "wine", tabac: "tobacco", presse: "newsagent", jouet: "toys", sport: "sports",
    "articles de sport": "sports", meuble: "furniture", "meubles": "furniture",
    immobilier: "estate_agent", "agence immobilière": "estate_agent", agence: "estate_agent",
    voyages: "travel_agency", "agence de voyage": "travel_agency", photo: "photo", photographe: "photo",
  };

  const craftMap: Record<string, string> = {
    plombier: "plumber", plumber: "plumber", plomberie: "plumber", "électricien": "electrician",
    electricien: "electrician", electricite: "electrician", "électricité": "electrician",
    menuisier: "joiner", menuiserie: "joiner", joiner: "joiner", charpentier: "carpenter",
    carpenter: "carpenter", peintre: "painter", painter: "painter", "maçon": "mason",
    macon: "mason", mason: "mason", maçonnerie: "mason", carreleur: "tiler", tiler: "tiler",
    "couvreur": "roofer", roofer: "roofer", isolation: "insulation", vitrier: "glaziery",
    serrurier: "locksmith", locksmith: "locksmith", serrurerie: "locksmith",
    chauffagiste: "hvac", climatisation: "hvac", hvac: "hvac", plaquiste: "drywall",
    parqueteur: "floorer", carrossier: "car_painter", "mécanicien": "mechanic",
    mecanique: "mechanic", boulanger: "bakery", boucher: "butcher", patissier: "pastry",
    traiteur: "confectionery", couturier: "tailor", tailleur: "tailor", cordonnier: "shoemaker",
    horloger: "watchmaker", bijoutier: "jeweller", tapissier: "upholsterer",
    forgeron: "blacksmith", blacksmith: "blacksmith", imprimeur: "printer", printer: "printer",
    "photographe": "photographer",
  };

  const q = query.toLowerCase().trim();
  const amenity = amenityMap[q];
  const shop = shopMap[q];
  const craft = craftMap[q];
  const around = `(around:${radius},${lat},${lng})`;

  let nodeQuery = "";
  if (amenity) {
    nodeQuery = `node["amenity"="${amenity}"]${around}; way["amenity"="${amenity}"]${around}; relation["amenity"="${amenity}"]${around};`;
  } else if (shop) {
    nodeQuery = `node["shop"="${shop}"]${around}; way["shop"="${shop}"]${around}; relation["shop"="${shop}"]${around};`;
  } else if (craft) {
    nodeQuery = `node["craft"="${craft}"]${around}; way["craft"="${craft}"]${around}; relation["craft"="${craft}"]${around}; node["shop"="${craft}"]${around}; way["shop"="${craft}"]${around}; relation["shop"="${craft}"]${around};`;
  } else {
    const escaped = query.replace(/"/g, '\\"');
    nodeQuery = `node["name"~"${escaped}",i]${around}; node["shop"~"${escaped}",i]${around}; node["amenity"~"${escaped}",i]${around}; way["name"~"${escaped}",i]${around}; way["shop"~"${escaped}",i]${around}; way["amenity"~"${escaped}",i]${around}; relation["name"~"${escaped}",i]${around}; relation["shop"~"${escaped}",i]${around}; relation["amenity"~"${escaped}",i]${around};`;
  }

  return `[out:json][timeout:30]; (${nodeQuery}); out center ${limit} qt;`;
}

function normalizeOSMResult(element: Record<string, any>, idx: number): Business | null {
  const tags = element.tags || {};
  let lat: number | undefined;
  let lng: number | undefined;

  if (typeof element.lat === "number") {
    lat = element.lat;
    lng = element.lon;
  } else if (element.center && typeof element.center.lat === "number") {
    lat = element.center.lat;
    lng = element.center.lon;
  }

  const name = tags.name || tags["name:fr"] || tags["brand"] || tags["operator"] || `Entité OSM #${element.id}`;
  const city = tags["addr:city"] || tags["addr:suburb"] || "";
  const street = tags["addr:street"] || "";
  const housenumber = tags["addr:housenumber"] || "";
  const address = street ? `${housenumber} ${street}`.trim() : "Adresse non répertoriée";

  return {
    _source: "osm",
    _externalId: `osm-${element.id}`,
    name,
    address,
    city,
    postalCode: tags["addr:postcode"],
    country: "France",
    phone: tags.phone || tags["contact:phone"],
    website: tags.website || tags["contact:website"],
    category: tags.amenity || tags.shop || tags.craft || "Business",
    lat,
    lng,
    description: tags.description || tags.note,
  };
}

export async function searchOSM(
  query: string,
  lat: number,
  lng: number,
  radius: number,
  limit: number
): Promise<Business[]> {
  try {
    const overpassQuery = buildOverpassQuery(query, lat, lng, radius, limit);
    const res = await fetch("https://z.overpass-api.de/api/interpreter", {
      method: "POST",
      body: `data=${encodeURIComponent(overpassQuery)}`,
      signal: AbortSignal.timeout(25_000),
    });

    if (!res.ok) throw new Error(`Overpass API error: ${res.status}`);
    const data = (await res.json()) as { elements: any[] };
    return data.elements.map(normalizeOSMResult).filter((b): b is Business => !!b);
  } catch (err: any) {
    logger.error("[LeadExtraction] OSM search error", { err });
    return [];
  }
}

// ── Provider 2 : Google Maps ──────────────────────────────────────────────────

export async function searchGoogle(
  query: string,
  lat: number,
  lng: number,
  radius: number,
  maxResults: number,
  apiKey: string
): Promise<Business[]> {
  try {
    const url = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
    url.searchParams.set("location", `${lat},${lng}`);
    url.searchParams.set("radius", String(radius));
    url.searchParams.set("keyword", query);
    url.searchParams.set("key", apiKey);
    url.searchParams.set("language", "fr");

    const res = await fetch(url.toString());
    const data = await res.json();

    if (data.status === "REQUEST_DENIED") throw new Error(data.error_message || "Accès Google Maps refusé");
    if (data.status === "ZERO_RESULTS") return [];
    
    const places = (data.results || []).slice(0, maxResults);
    return places.map((place: any) => ({
      _source: "google",
      _externalId: `google-${place.place_id}`,
      name: place.name,
      address: place.vicinity || "—",
      city: "", // Google Nearby ne donne pas la ville directement
      country: "France",
      phone: place.formatted_phone_number || place.international_phone_number, // Enrichi si disponible
      website: place.website,
      category: place.types?.[0]?.replace(/_/g, " "),
      rating: place.rating,
      reviewCount: place.user_ratings_total,
      lat: place.geometry.location.lat,
      lng: place.geometry.location.lng,
    }));
  } catch (err: any) {
    logger.error("[LeadExtraction] Google Places error", { err });
    throw err;
  }
}

// ── Provider 3 : Pages Jaunes ─────────────────────────────────────────────────

export async function searchPagesJaunes(
  query: string,
  location: string,
  maxResults: number,
  apiKey: string
): Promise<Business[]> {
  try {
    const url = new URL("https://api.pagesjaunes.fr/v1/pros");
    url.searchParams.set("what", query);
    url.searchParams.set("where", location);
    url.searchParams.set("count", String(Math.min(maxResults, 50)));

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });

    if (res.status === 401 || res.status === 403) throw new Error("Clé Pages Jaunes invalide");
    if (!res.ok) throw new Error(`Pages Jaunes error: ${res.status}`);

    const data = await res.json();
    const listings = data.search_results?.listings || [];

    return listings.map((item: any): Business => ({
      _source: "pagesjaunes",
      _externalId: `pj-${item.id}`,
      name: item.name,
      address: item.address?.street || "—",
      city: item.address?.city || "",
      postalCode: item.address?.zipcode,
      country: "France",
      phone: item.phones?.[0]?.number,
      website: item.urls?.[0]?.href,
      category: item.activity?.label,
    }));
  } catch (err: any) {
    logger.error("[LeadExtraction] Pages Jaunes error", { err });
    throw err;
  }
}

// ── Provider 4 : Servicall Extractor (Hybrid) ─────────────────────────────────

export async function searchServicallExtractor(
  query: string,
  location: string,
  maxResults: number,
  radius: number
): Promise<Business[]> {
  const geo = await geocodeLocation(location);
  if (!geo) return [];
  
  // Hybrid search: OSM + B2C simulation for enrichment
  const [osmResults, b2cResults] = await Promise.all([
    searchOSM(query, geo.lat, geo.lng, radius, Math.floor(maxResults / 2)),
    runB2CScraper({ query, location, maxResults: Math.ceil(maxResults / 2) })
  ]);

  const combined = [
    ...osmResults.map(b => ({ ...b, _source: "servicall" as const, _externalId: `sc-osm-${b._externalId}` })),
    ...b2cResults.map(b => ({ ...b, _source: "servicall" as const, _externalId: `sc-b2c-${b._externalId}` }))
  ];

  return combined.slice(0, maxResults);
}

// ── Point d'entrée principal ──────────────────────────────────────────────────

export async function searchBusinesses(params: SearchParams): Promise<SearchResult> {
  const { query, location, radius, maxResults, tenantId, provider: requested } = params;

  // Cas spécifique B2C — moteur hybride avec fallback INSEE
  if (requested === "b2c") {
    let businesses: Business[] = [];

    // Tentative 1 — scraper annuaires publics
    try {
      businesses = await runB2CScraper({
        query, location, maxResults,
        housingType: params.housingType,
        estimatedIncome: params.estimatedIncome,
        hasChildren: params.hasChildren,
        propertyStatus: params.propertyStatus,
        ageRange: params.ageRange
      });
    } catch (err: any) {
      logger.warn("[LeadExtraction] B2C scraper failed", { err });
    }

    // Tentative 2 — fallback données INSEE/DGFiP si scraper vide ou bloqué
    if (businesses.length === 0) {
      logger.info("[LeadExtraction] B2C fallback: moteur INSEE local");
      try {
        const { searchB2CLeads } = await import("./b2cLeadExtractionService");
        const r = await searchB2CLeads({
          location,
          maxResults,
          tenantId,
          housingTypes: params.propertyStatus && params.propertyStatus !== "all"
            ? [params.propertyStatus === "owner" ? "proprietaire" : "locataire"] as unknown
            : undefined,
          incomeLevels: params.estimatedIncome && params.estimatedIncome !== "all"
            ? [({ low: "modeste", medium: "intermediaire", high: "confortable", very_high: "aise" } as unknown)[params.estimatedIncome]] as unknown
            : undefined,
        });
        businesses = r.profiles.map((p: any): Business => ({
          _source: "b2c",
          _externalId: p._profileId,
          name: `Particulier — ${p.ageRange} ans — ${p.ville}`,
          address: `Zone ${p.densite}`,
          city: p.ville,
          postalCode: p._codePostal,
          country: "France",
          category: `${p.csp?.replace(/_/g, " ")} • ${p.housingType === "proprietaire" ? "Propriétaire" : "Locataire"}`,
          description: `Revenus ~${p.revenuMedianAnnuel?.toLocaleString("fr-FR")}€/an • Score ${p.qualificationScore}/100 (${p.qualificationLabel}) • Intérêt: ${p.interests?.[0]?.category ?? "—"}`,
          isIndividual: true,
          lat: p.latitude,
          lng: p.longitude,
        }));
      } catch (inseeErr) {
        logger.error("[LeadExtraction] INSEE fallback failed", { inseeErr });
      }
    }

    return { businesses, total: businesses.length, provider: "b2c" };
  }

  const geo = await geocodeLocation(location);
  if (!geo) return { businesses: [], total: 0, provider: "osm", error: "Localisation introuvable" };

  let provider: "osm" | "google" | "pagesjaunes" | "servicall" = "osm";
  if (requested === "auto") {
    const gKey = await getAPIKey(tenantId, "google_maps").catch(() => null);
    provider = gKey ? "google" : "osm";
  
  } else if (requested !== "b2c") {
    provider = requested as unknown;
  }

  let businesses: Business[] = [];
  let error: string | undefined;

  try {
    if (provider === "osm") businesses = await searchOSM(query, geo.lat, geo.lng, radius, maxResults);
    else if (provider === "servicall") businesses = await searchServicallExtractor(query, location, maxResults, radius);
    
    else if (provider === "b2c") {
      businesses = await runB2CScraper({
        query,
        location,
        maxResults,
        housingType: params.housingType,
        estimatedIncome: params.estimatedIncome,
        hasChildren: params.hasChildren,
        propertyStatus: params.propertyStatus,
        ageRange: params.ageRange
      });
    } else if (provider === "google") {
      const key = await getAPIKey(tenantId, "google_maps");
      if (!key) throw new Error("Clé Google Maps manquante");
      businesses = await searchGoogle(query, geo.lat, geo.lng, radius, maxResults, key);
    } else if (provider === "pagesjaunes") {
      const key = await getAPIKey(tenantId, "pages_jaunes");
      if (!key) throw new Error("Clé Pages Jaunes manquante");
      businesses = await searchPagesJaunes(query, location, maxResults, key);
    }
  } catch (err: any) {
    error = err.message;
    if (provider !== "osm") {
      businesses = await searchOSM(query, geo.lat, geo.lng, radius, maxResults);
      error = `${provider} erreur: ${err.message}. Repli sur OSM.`;
    }
  }

  return { businesses, total: businesses.length, provider: businesses[0]?._source || provider, error };
}

// ── Import dans les prospects CRM ─────────────────────────────────────────────

export async function importBusinessesAsProspects(
  businesses: Business[],
  tenantId: number,
  extractionId?: number
): Promise<{ imported: number; skipped: number; errors: number }> {
  let imported = 0, skipped = 0, errors = 0;
  for (const biz of businesses) {
    try {
      if (biz.phone) {
        const exist = await db.select().from(prospects).where(and(eq(prospects.tenantId, tenantId), eq(prospects.phone, biz.phone))).limit(1);
        if (exist.length) { skipped++; continue; }
      }
      const parts = biz.name.split(" ");
      await db.insert(prospects).values({
        tenantId,
        firstName: parts[0] || biz.name,
        lastName: parts.slice(1).join(" ") || undefined,
        company: biz.isIndividual ? undefined : biz.name,
        phone: biz.phone,
        email: biz.email,
        source: `extraction-${biz._source}`,
        notes: `📍 ${biz.address}, ${biz.city}\n🏷️ ${biz.category || ""}\n${biz.description || ""}`,
        status: "new",
        metadata: { ...biz, extractionId }
      });
      imported++;
    } catch (err: any) { errors++; }
  }
  if (extractionId && imported > 0) {
    await db.update(leadExtractions).set({ importedCount: imported }).where(eq(leadExtractions.id, extractionId)).catch(() => {});
  }
  return { imported, skipped, errors };
}