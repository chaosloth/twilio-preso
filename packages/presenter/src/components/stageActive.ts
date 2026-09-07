import { createContext, useContext } from 'react';

/**
 * Whether this slide is the one on screen. Stages use it to hold back expensive
 * or animated content until they are the current slide.
 *
 * In its own module so `StageScene` and `Stage` can both provide it without
 * either importing the other.
 */
export const StageActiveContext = createContext(false);

export function useIsStageActive(): boolean {
  return useContext(StageActiveContext);
}
