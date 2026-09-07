/**
 * The push-up, at its original route.
 *
 * The scene itself is now `MotionScene`, which drives any exercise in the
 * registry off the same rig. This wrapper exists so `#pushup` — the route in
 * every doc, bookmark and screenshot filename in the project — keeps working
 * and keeps landing on the push-up.
 */

import MotionScene from "./MotionScene.jsx";

export default function PushUpScene() {
  return <MotionScene exercise="push_up" />;
}
