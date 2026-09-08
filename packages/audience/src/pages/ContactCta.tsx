import type { InteractionConfig } from '@twilio-preso/shared';
import { telLink, whatsappLink } from '@twilio-preso/shared';

interface ContactCtaProps {
  interaction: InteractionConfig;
  /** The session's own claimed number — what the agent recognises the session by. */
  phoneNumber: string;
  channel: 'call' | 'whatsapp';
}

/**
 * The inbound half of the demo, in the hand: one button that opens the dialler or
 * WhatsApp addressed to this session's number.
 *
 * It is an `<a href>` rather than a scripted `window.open`, because `tel:` and
 * `wa.me` only reliably hand off to the native app from a real user gesture on a
 * real link — and a link still shows the number in the long-press menu for anyone
 * who would rather dial it themselves.
 */
export function ContactCta({ interaction, phoneNumber, channel }: ContactCtaProps) {
  const isCall = channel === 'call';
  const href = isCall ? telLink(phoneNumber) : whatsappLink(phoneNumber);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <h2 className="text-xl font-bold text-center mb-2">{interaction.prompt}</h2>
      <p className="text-accent-2 text-sm text-center mb-8">{phoneNumber}</p>

      <a
        href={href}
        {...(isCall ? {} : { target: '_blank', rel: 'noreferrer' })}
        className="px-10 py-4 rounded-full bg-twilio-red text-white font-bold text-lg text-center animate-pulse"
      >
        {isCall ? '📞 Call now' : '💬 Open WhatsApp'}
      </a>

      <p className="text-accent-2 text-xs text-center mt-8 max-w-xs">
        {isCall
          ? 'The agent already knows your name and what you answered — no menus, no account number.'
          : 'The chat opens ready to send. Nothing to type, no contact to save.'}
      </p>
    </div>
  );
}
