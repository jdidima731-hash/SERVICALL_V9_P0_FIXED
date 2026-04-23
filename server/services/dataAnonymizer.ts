/**
 * BLOC 9 : Service d'Anonymisation des Données Sensibles
 * Anonymise les données sensibles dans les logs
 */

export class DataAnonymizer {
  /**
   * Anonymiser un numéro de téléphone
   * +33612345678 → +33****5678
   */
  static anonymizePhoneNumber(phone: string): string {
    if (!phone || phone.length < 4) return "***";
    return phone.substring(0, phone.length - 4) + "****";
  }

  /**
   * Anonymiser un email
   * user@example.com → u***@example.com
   */
  static anonymizeEmail(email: string): string {
    if (!email || !email.includes("@")) return "***@***";
    const [localPart, domain] = email.split("@");
    return localPart!.substring(0, 1) + "***@" + domain;
  }

  /**
   * Anonymiser un objet récursivement
   */
  static anonymizeObject(
    obj: any, 
    sensitiveFields = ["phone", "email", "password", "token", "secret", "key"]
  ): any {
    if (!obj) return obj;

    if (Array.isArray(obj)) {
      return obj.map((item: any) => this.anonymizeObject(item, sensitiveFields));
    }

    if (typeof obj === "object") {
      const anonymized: any= {};
      for (const [key, value] of Object.entries(obj)) {
        if (sensitiveFields.includes(key.toLowerCase())) {
          if (typeof value === "string") {
            if (key.toLowerCase() === "phone") {
              anonymized[key] = this.anonymizePhoneNumber(value);
            } else if (key.toLowerCase() === "email") {
              anonymized[key] = this.anonymizeEmail(value);
            } else {
              anonymized[key] = "***";
            }
          }
        } else if (typeof value === "object") {
          anonymized[key] = this.anonymizeObject(value, sensitiveFields);
        } else {
          anonymized[key] = value;
        }
      }
      return anonymized;
    }

    return obj;
  }
}
