/**
 * Links a phone builds from the session's own claimed number. One
 * implementation, because presenter and audience both need them — the QR code on
 * screen and the button in the hand must address the same conversation.
 */

/** Digits only, no `+`: what `wa.me` accepts. */
export function whatsappLink(phone: string): string {
  return `https://wa.me/${phone.replace(/[^\d]/g, '')}`;
}

/** Keeps the leading `+` so the dialler treats it as international wherever the
 *  attendee is roaming from. */
export function telLink(phone: string): string {
  return `tel:+${phone.replace(/[^\d]/g, '')}`;
}
