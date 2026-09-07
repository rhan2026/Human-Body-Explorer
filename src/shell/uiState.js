/**
 * The one piece of chrome state that outlives a scene: whether the drawer is
 * open.
 *
 * It lives outside React because two trees need it that share no parent — the
 * scene's AppShell (which owns the drawer) and the Router's AssistantWidget
 * (which must go inert while the drawer is open, and deliberately never
 * remounts across scale changes). A context provider would force the assistant
 * back inside each scene, which is exactly the remount this avoids. Module
 * scope + useSyncExternalStore is the whole mechanism; a state library for one
 * boolean is not a dependency this repo takes.
 */

import { useSyncExternalStore } from "react";

let panelOpen = false;
const listeners = new Set();

export function setPanelOpen(next) {
  const value = typeof next === "function" ? next(panelOpen) : next;
  if (value === panelOpen) return;
  panelOpen = value;
  for (const listener of listeners) listener();
}

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const read = () => panelOpen;

export function usePanelOpen() {
  return useSyncExternalStore(subscribe, read);
}
