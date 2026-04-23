import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { logger } from "../infrastructure/logger";


/**
 * Google Calendar Service - Synchronisation des rendez-vous
 */

  // const _SCOPES = ["https://www.googleapis.com/auth/calendar.events"];

export function getOAuth2Client(): OAuth2Client {
  return new google.auth.OAuth2(
    process.env['GOOGLE_CLIENT_ID'],
    process.env['GOOGLE_CLIENT_SECRET'],
    process.env['GOOGLE_REDIRECT_URI']
  );
}

/**
 * Create an event in Google Calendar
 */
export async function createGoogleEvent(
  accessToken: string,
  appointment: {
    title: string;
    description?: string;
    startTime: Date;
    endTime: Date;
    location?: string;
    prospectEmail?: string;
  }
): Promise<string | null> {
  try {
    const auth = getOAuth2Client();
    auth.setCredentials({ access_token: accessToken });

    const calendar = google.calendar({ version: "v3", auth });

    const event = {
      summary: appointment.title,
      location: appointment.location,
      description: appointment.description,
      start: {
        dateTime: appointment.startTime.toISOString(),
        timeZone: "UTC",
      },
      end: {
        dateTime: appointment.endTime.toISOString(),
        timeZone: "UTC",
      },
      attendees: appointment.prospectEmail ? [{ email: appointment.prospectEmail }] : [],
      reminders: {
        useDefault: false,
        overrides: [
          { method: "email", minutes: 24 * 60 },
          { method: "popup", minutes: 30 },
        ],
      },
    };

    const response = await calendar.events.insert({
      calendarId: "primary",
      requestBody: event,
    });

    return response.data.id ?? null;
  } catch (error: any) {
    logger.error("[Google Calendar] Error creating event:", error);
    return null;
  }
}

/**
 * Update an event in Google Calendar
 */
export async function updateGoogleEvent(
  accessToken: string,
  eventId: string,
  appointment: {
    title?: string;
    description?: string;
    startTime?: Date;
    endTime?: Date;
    location?: string;
  }
): Promise<boolean> {
  try {
    const auth = getOAuth2Client();
    auth.setCredentials({ access_token: accessToken });

    const calendar = google.calendar({ version: "v3", auth });

    const event: any= {};
    if (appointment.title) event.summary = appointment.title;
    if (appointment.location) event.location = appointment.location;
    if (appointment.description) event.description = appointment.description;
    if (appointment.startTime) event.start = { dateTime: appointment.startTime.toISOString() };
    if (appointment.endTime) event.end = { dateTime: appointment.endTime.toISOString() };

    await calendar.events.patch({
      calendarId: "primary",
      eventId: eventId,
      requestBody: event,
    });

    return true;
  } catch (error: any) {
    logger.error("[Google Calendar] Error updating event:", error);
    return false;
  }
}

/**
 * Delete an event from Google Calendar
 */
export async function deleteGoogleEvent(
  accessToken: string,
  eventId: string
): Promise<boolean> {
  try {
    const auth = getOAuth2Client();
    auth.setCredentials({ access_token: accessToken });

    const calendar = google.calendar({ version: "v3", auth });

    await calendar.events.delete({
      calendarId: "primary",
      eventId: eventId,
    });

    return true;
  } catch (error: any) {
    logger.error("[Google Calendar] Error deleting event:", error);
    return false;
  }
}
