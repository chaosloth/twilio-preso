/**
 * Between interactions — right after registering, and after every answer.
 *
 * Not a spinner. A spinner says "this phone is loading something", and an
 * attendee watching one waits on the phone for it to finish — or reloads it,
 * which is worse. Nothing is loading: the next screen arrives when the presenter
 * advances to a slide that asks for something. So this says what is true. The
 * attendee is done (a check, not a progress indicator); what happens next is the
 * presenter's move ("Eyes on the stage"); and the phone is live and will change
 * by itself (a slow pulse beside "Waiting for the presenter", the same idiom as a
 * call-in-progress dot, rather than motion that implies work).
 */
export function Waiting({ name }: { name: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center max-w-xs">
        <div
          className="w-16 h-16 rounded-full border-2 border-twilio-red flex items-center justify-center mx-auto mb-6"
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" className="w-8 h-8 text-twilio-red" fill="none" stroke="currentColor" strokeWidth={3}>
            <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <h2 className="text-2xl font-bold">You're in, {name}!</h2>

        <p className="text-white mt-6 text-lg">Eyes on the stage</p>
        <p className="text-accent-1 mt-1">
          Questions will pop up here on their own when the presenter asks for them.
        </p>

        <div
          className="inline-flex items-center gap-2 mt-8 px-4 py-2 rounded-full bg-[#1e3a5f]/60 text-accent-1 text-sm"
          role="status"
          aria-live="polite"
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-twilio-red opacity-60 animate-ping [animation-duration:2s]" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-twilio-red" />
          </span>
          Waiting for the presenter
        </div>

        <p className="text-accent-3 text-sm mt-6">No need to refresh — keep this page open.</p>
      </div>
    </div>
  );
}
