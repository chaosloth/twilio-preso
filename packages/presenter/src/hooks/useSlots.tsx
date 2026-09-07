import { createContext, useContext, type ReactNode } from 'react';
import type { ResolvedStage } from '@twilio-preso/shared';

/**
 * The resolved stage a component is rendering, so stage components can read
 * their editable copy instead of hard-coding it. Provided by `StageContainer`.
 */
const SlotContext = createContext<Record<string, string> | null>(null);

export function SlotProvider({ stage, children }: { stage: ResolvedStage; children: ReactNode }) {
  return <SlotContext.Provider value={stage.slots ?? null}>{children}</SlotContext.Provider>;
}

/**
 * Returns a slot reader. `fallback` is the copy that shipped in the component,
 * used when the deck predates the slot or the stage is rendered outside a
 * provider — a slide should never go blank because a slot went missing.
 * An empty resolved slot is deliberate (the presenter cleared it) and is
 * returned as-is, so callers can hide the element.
 */
export function useSlots(): (key: string, fallback?: string) => string {
  const slots = useContext(SlotContext);
  return (key, fallback = '') => slots?.[key] ?? fallback;
}
