/**
 * BLOC 7 : Validation des Rendez-vous - Gestion des Conflits
 * Vérifie les chevauchements et les conflits de calendrier
 */


export interface Appointment {
  id?: number;
  agentId: number;
  prospectId: number;
  title: string;
  startTime: Date;
  endTime: Date;
  status?: string;
}

export class AppointmentValidator {
  /**
   * Vérifier s'il y a un conflit avec les rendez-vous existants
   */
  static checkConflicts(
    newAppointment: Appointment,
    existingAppointments: Appointment[]
  ): Appointment[] {
    const conflicts: Appointment[] = [];

    for (const existing of existingAppointments) {
      // Ignorer les rendez-vous annulés ou complétés
      if (existing.status === "cancelled" || existing.status === "completed") {
        continue;
      }

      // Vérifier le chevauchement
      if (this.hasOverlap(newAppointment, existing)) {
        conflicts.push(existing);
      }
    }

    return conflicts;
  }

  /**
   * Vérifier s'il y a chevauchement entre deux rendez-vous
   */
  private static hasOverlap(apt1: Appointment, apt2: Appointment): boolean {
    // Chevauchement : apt1 commence avant la fin d'apt2 ET finit après le début d'apt2
    return apt1.startTime.getTime() < apt2.endTime.getTime() && apt1.endTime.getTime() > apt2.startTime.getTime();
  }

  /**
   * Valider les données du rendez-vous
   */
  static validate(appointment: Appointment): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Vérifier que endTime > startTime
    if (appointment.endTime.getTime() <= appointment.startTime.getTime()) {
      errors.push("End time must be after start time");
    }

    // Vérifier que le rendez-vous n'est pas dans le passé
    if (appointment.startTime.getTime() < new Date().getTime()) {
      errors.push("Appointment cannot be in the past");
    }

    // Vérifier la durée minimale (15 minutes)
    const durationMs = appointment.endTime.getTime() - appointment.startTime.getTime();
    if (durationMs < 15 * 60 * 1000) {
      errors.push("Appointment must be at least 15 minutes long");
    }

    // Vérifier la durée maximale (8 heures)
    if (durationMs > 8 * 60 * 60 * 1000) {
      errors.push("Appointment cannot be longer than 8 hours");
    }

    // Vérifier les IDs
    if (!appointment.agentId || appointment.agentId <= 0) {
      errors.push("Invalid agent ID");
    }

    if (!appointment.prospectId || appointment.prospectId <= 0) {
      errors.push("Invalid prospect ID");
    }

    // Vérifier le titre
    if (!appointment.title || appointment.title.trim().length === 0) {
      errors.push("Title is required");
    }

    if (appointment.title.length > 255) {
      errors.push("Title must be less than 255 characters");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Formater un rendez-vous pour l'affichage
   */
  static format(appointment: Appointment): string {
    const start = appointment.startTime.toLocaleString();
    const end = appointment.endTime.toLocaleString();
    return `${appointment.title} (${start} - ${end})`;
  }
}
