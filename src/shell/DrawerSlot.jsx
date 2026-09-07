import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Puts a scene's own controls into the shell's drawer.
 *
 * The scale chips, the knockout switches and the bout picker read and write
 * state that lives inside the scene component. The drawer is rendered by
 * `AppShell`, above the scene and outside it. Lifting that state up to the page
 * so it could be passed down as a prop would move three scales' worth of
 * machinery to make one aside render; a portal moves the pixels instead and
 * leaves the state where it is used.
 *
 * Mounted-then-found rather than found-then-mounted: the slot is a sibling that
 * React has not necessarily committed yet on the first pass, so this renders
 * nothing until an effect has seen it. One re-render, once per scene.
 */
export default function DrawerSlot({ children }) {
  const [slot, setSlot] = useState(null);
  useEffect(() => {
    setSlot(document.querySelector(".drawer__slot"));
    return () => setSlot(null);
  }, []);
  return slot ? createPortal(children, slot) : null;
}
