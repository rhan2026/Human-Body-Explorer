import { useEffect } from "react";
import { attachAskBridge } from "./bridge.js";

/**
 * The one line in `main.jsx` that puts the API behind the question box.
 * Everything it does is `bridge.js`, attached for the life of the shell —
 * mounted once, beside the box, so a reply the model answers with `navigate`
 * keeps streaming while the scene underneath is swapped.
 */
export default function AskBridge() {
  useEffect(() => attachAskBridge(), []);
  return null;
}
