/**
 * =====================================================================
 * shared/eventTypes.ts — SERVICALL V8
 * BLOC 3 — EVENT / TRIGGER SYSTEM : CANON UNIQUE
 * =====================================================================
 * Contrat public unique pour tous les triggers système.
 * RÈGLE : Dot notation uniquement (ex: call.received).
 * =====================================================================
 */

export const EVENT_TYPES = [
  'call.received',
  'call.completed',
  'prospect.created',
  'appointment.scheduled',
  'whatsapp.message.received',
  'order.created',
  'payment.completed',
  'live.call.started'
] as const;

export type EventType = typeof EVENT_TYPES[number];

/**
 * Type guard pour valider un event type.
 */
export function isValidEventType(event: string): event is EventType {
  return EVENT_TYPES.includes(event as EventType);
}

/**
 * Mapping legacy pour la migration (snake_case -> dot.notation).
 */
export const LEGACY_EVENT_MAPPING: Record<string, EventType> = {
  'call_received': 'call.received',
  'call_completed': 'call.completed',
  'prospect_created': 'prospect.created',
  'appointment_scheduled': 'appointment.scheduled',
  'whatsapp_message_received': 'whatsapp.message.received',
  'order_created': 'order.created',
  'payment_completed': 'payment.completed',
  'live_call_started': 'live.call.started'
};
