import { z } from "zod";
import { publicProcedure } from "../procedures";
import { router } from "../_core/trpc";
import { sendEmail } from "../services/emailService";
import { TRPCError } from '@trpc/server';
import { logger } from "../infrastructure/logger";


/**
 * Contact Router - Gestion des demandes de contact
 */
export const contactRouter = router({
  /**
   * Soumettre une demande de contact
   */
  submit: publicProcedure
    .input(
      z.object({
        name: z.string().min(1, "Name is required"),
        email: z.string().email("Invalid email address"),
        phone: z.string().optional(),
        company: z.string().optional(),
        message: z.string().min(1, "Message is required"),
      })
    )
    .mutation(async ({ input }: any) => {
      const { name, email, phone, company, message } = input;

      // Construire le corps de l'email
      const emailBody = `
Nouvelle demande de contact depuis Servicall CRM

Nom: ${name}
Email: ${email}
Téléphone: ${phone || "Non renseigné"}
Entreprise: ${company || "Non renseignée"}

Message:
${message}

---
Envoyé depuis Servicall CRM v2
      `.trim();

      try {
        // Envoyer l'email à servicallc@gmail.com
        await sendEmail(
          "servicallc@gmail.com",
          `Nouvelle demande de contact - ${name}`,
          emailBody
        );

        // Optionnel: Envoyer un email de confirmation au client
        const confirmationBody = `
Bonjour ${name},

Nous avons bien reçu votre demande de contact. Notre équipe vous recontactera dans les plus brefs délais.

Merci de votre intérêt pour Servicall CRM.

Cordialement,
L'équipe Servicall
        `.trim();

        await sendEmail(
          email,
          "Confirmation de votre demande de contact - Servicall CRM",
          confirmationBody
        );

        return {
          success: true,
          message: "Contact request sent successfully",
        };
      } catch (error: any) {
        logger.error("Error sending contact email:", error);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to send contact request' });
      }
    }),
});
