import { google, calendar_v3 } from "googleapis";
import { JWT } from "google-auth-library";
import { logger } from "../../lib/logger";

export interface CalendarSyncConfig {
  eventTitle: string;
  startDate: string | Date;
  endDate: string | Date;
  description?: string;
  attendeeEmail?: string;
}

export class CalendarSyncAction {
  private calendar: calendar_v3.Calendar | null;
  // ✅ BLOC 3 FIX (TS2564) : Propriété rendue optionnelle pour éviter l'erreur
  // "Property 'auth' has no initializer and is not definitely assigned in the constructor"
  private auth?: JWT;

  constructor() {
    const keyFile = process.env['GOOGLE_SERVICE_ACCOUNT_KEY'];

    if (!keyFile) {
      logger.warn("GOOGLE_SERVICE_ACCOUNT_KEY environment variable not set. Calendar sync disabled.");
      this.calendar = null;
      // ✅ BLOC 3 FIX : auth reste undefined (optionnel), pas besoin d'assigner null
      return;
    }

    try {
      const keyData = JSON.parse(keyFile);

      this.auth = new JWT({
        email: keyData.client_email,
        key: keyData.private_key,
        scopes: ["https://www.googleapis.com/auth/calendar"],
      });

      this.calendar = google.calendar({ version: "v3", auth: this.auth });
    } catch (error: unknown) {
      logger.error("Error initializing Calendar API:", error);
      this.calendar = null;
    }
  }

  /**
   * Synchronise un événement avec Google Calendar
   */
  async execute(config: CalendarSyncConfig, context: Record<string, unknown>): Promise<unknown> {
    try {
      if (!this.calendar) {
        logger.warn("Calendar API not initialized. Skipping calendar sync.");
        return {
          success: false,
          message: "Calendar API not configured",
        };
      }

      // ✅ BLOC 3 FIX (TS2564) : Guard de sécurité sur auth optionnel
      if (!this.auth) {
        logger.warn("Calendar auth not initialized. Skipping calendar sync.");
        return {
          success: false,
          message: "Calendar auth not configured",
        };
      }

      // Interpoler les variables dans les champs
      const eventTitle = this.interpolateText(config["eventTitle"], context);
      const description = config["description"] ? this.interpolateText(config["description"], context) : "";
      const startDate = this.parseDate(config["startDate"], context);
      const endDate = this.parseDate(config["endDate"], context);

      logger.info("Creating calendar event", {
        title: eventTitle,
        startDate,
        endDate,
      });

      // Créer l'événement
      const event = {
        summary: eventTitle,
        description,
        start: {
          dateTime: new Date(startDate).toISOString(),
          timeZone: "Europe/Paris",
        },
        end: {
          dateTime: new Date(endDate).toISOString(),
          timeZone: "Europe/Paris",
        },
        attendees: config["attendeeEmail"] ? [{ email: config["attendeeEmail"] }] : [],
      };

      const response = await this.calendar.events.insert({
        calendarId: "primary",
        requestBody: event,
      });

      logger.info("Calendar event created successfully", {
        eventId: response.data.id,
      });

      return {
        success: true,
        eventId: response.data.id,
        eventLink: response.data.htmlLink,
      };
    } catch (error: unknown) {
      logger.error("Error syncing to calendar:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Interpole les variables dans le texte
   */
  private interpolateText(text: string, context: Record<string, unknown>): string {
    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return context[key] !== undefined ? String(context[key]) : match;
    });
  }

  /**
   * Parse une date depuis le contexte
   */
  private parseDate(dateValue: string | Date, context: Record<string, unknown>): Date {
    if (dateValue instanceof Date) {
      return dateValue;
    }

    // Vérifier si c'est une variable de contexte
    if (typeof dateValue === "string" && dateValue.includes("{{")) {
      const interpolated = this.interpolateText(dateValue, context);
      return new Date(interpolated);
    }

    return new Date(dateValue);
  }
}

export default CalendarSyncAction;
