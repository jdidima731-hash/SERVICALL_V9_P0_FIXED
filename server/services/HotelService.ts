import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { hotelRooms, bookings } from "../../drizzle/schema-industries";
import { eq, and, gte, lte } from "drizzle-orm";
import { logger } from "../infrastructure/logger";

export interface AvailabilityRequest {
  tenantId: number;
  checkIn: Date;
  checkOut: Date;
  roomType?: string;
  numGuests?: number;
}

export interface RoomAvailability {
  roomId: number;
  roomNumber: string;
  roomType: string;
  pricePerNight: number;
  available: boolean;
}

export class HotelService {
  private db: any;

  constructor(connectionString?: string) {
    // Note: HotelService is designed for production use with a real database.
    // In test mode, it will attempt to connect but gracefully handle failures.
    try {
      const connStr = connectionString || process.env['DATABASE_URL'] || (() => { throw new Error("DATABASE_URL environment variable is required"); })();
      const client = postgres(connStr);
      this.db = drizzle(client);
    } catch (error: any) {
      logger.warn("HotelService: Could not initialize database connection", { error: error instanceof Error ? error.message : String(error) });
      this.db = null;
    }
  }

  /**
   * Vérifie la disponibilité des chambres pour les dates spécifiées
   */
  async checkAvailability(request: AvailabilityRequest): Promise<RoomAvailability[]> {
    try {
      logger.info("Checking room availability", {
        tenantId: request.tenantId,
        checkIn: request.checkIn,
        checkOut: request.checkOut,
        roomType: request.roomType,
      });

      // Récupérer toutes les chambres du tenant
      let roomsQuery = this.db.select().from(hotelRooms).where(eq(hotelRooms.tenantId, request.tenantId));

      if (request.roomType) {
        roomsQuery = roomsQuery.where(eq(hotelRooms.roomType, request.roomType));
      }

      const allRooms = await roomsQuery;

      // Pour chaque chambre, vérifier les réservations existantes
      const availableRooms: RoomAvailability[] = [];

      for (const room of allRooms) {
        const conflictingBookings = await this.db
          .select()
          .from(bookings)
          .where(
            and(
              eq(bookings.roomId, room.id),
              eq(bookings.status, "confirmed"),
              // Vérifier les chevauchements de dates
              lte(bookings.checkIn, request.checkOut),
              gte(bookings.checkOut, request.checkIn)
            )
          );

        if (conflictingBookings.length === 0) {
          availableRooms.push({
            roomId: room.id,
            roomNumber: room.roomNumber,
            roomType: room.roomType,
            pricePerNight: parseFloat(room.pricePerNight),
            available: true,
          });
        }
      }

      logger.info("Availability check completed", {
        totalRooms: allRooms.length,
        availableRooms: availableRooms.length,
      });

      return availableRooms;
    } catch (error: any) {
      logger.error("Error checking availability", error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Crée une nouvelle réservation
   */
  async createBooking(
    tenantId: number,
    roomId: number,
    prospectId: number,
    checkIn: Date,
    checkOut: Date,
    totalPrice: number
  ): Promise<any> {
    try {
      logger.info("Creating booking", {
        tenantId,
        roomId,
        prospectId,
        checkIn,
        checkOut,
        totalPrice,
      });

      // Vérifier une dernière fois la disponibilité
      const availability = await this.checkAvailability({
        tenantId,
        checkIn,
        checkOut,
      });

      const roomAvailable = availability.find((r) => r.roomId === roomId);
      if (!roomAvailable) {
        throw new Error("Room is not available for the selected dates");
      }

      // Créer la réservation
      const [newBooking] = await this.db
        .insert(bookings)
        .values({
          tenantId,
          roomId,
          prospectId,
          checkIn,
          checkOut,
          totalPrice,
          status: "confirmed",
        })
        .returning();

      logger.info("Booking created successfully", {
        bookingId: newBooking.id,
      });

      return newBooking;
    } catch (error: any) {
      logger.error("Error creating booking:", error);
      throw error;
    }
  }

  /**
   * Calcule le prix total pour une réservation
   */
  calculateTotalPrice(pricePerNight: number, checkIn: Date, checkOut: Date): number {
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
    return pricePerNight * nights;
  }

  /**
   * Récupère les détails d'une réservation
   */
  async getBookingDetails(bookingId: number): Promise<any> {
    try {
      const booking = await this.db.select().from(bookings).where(eq(bookings.id, bookingId));

      if (booking.length === 0) {
        throw new Error(`Booking ${bookingId} not found`);
      }

      const room = await this.db.select().from(hotelRooms).where(eq(hotelRooms.id, booking[0].roomId));

      return {
        ...booking[0],
        room: room[0],
      };
    } catch (error: any) {
      logger.error("Error getting booking details:", error);
      throw error;
    }
  }

  /**
   * Annule une réservation
   */
  async cancelBooking(bookingId: number): Promise<any> {
    try {
      logger.info("Cancelling booking", { bookingId });

      const [cancelledBooking] = await this.db
        .update(bookings)
        .set({ status: "cancelled" })
        .where(eq(bookings.id, bookingId))
        .returning();

      logger.info("Booking cancelled successfully", { bookingId });

      return cancelledBooking;
    } catch (error: any) {
      logger.error("Error cancelling booking:", error);
      throw error;
    }
  }
}

export default HotelService;
