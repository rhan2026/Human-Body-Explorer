/**
 * Scene furniture — the floor, a bar, a bench, a water line.
 *
 * These are not part of the body and never touch the rig. They exist because a
 * pull-up with no bar reads as a man hanging in the air, and because a contact
 * the viewer cannot see looks like a bug rather than a constraint. Their
 * positions come from the motion's own state where the movement defines them
 * (the barbell is placed at the solved wrists, not the other way round), so
 * nothing here can drift out of agreement with the body.
 */

import { forwardRef } from "react";
import * as THREE from "three";

const BAR_COLOUR = "#8d8880";
const RIG_COLOUR = "#b9b2a8";

/** The push-up's floor grid, unchanged. */
export function Floor({ z = 0.75 }) {
  return <gridHelper args={[4, 20, "#c9c2ba", "#e2ddd6"]} position={[0, 0, z]} />;
}

/** A wide floor for movements that travel, with the grid scrolling under them. */
export const ScrollingFloor = forwardRef(function ScrollingFloor(_, ref) {
  return <gridHelper ref={ref} args={[8, 40, "#c9c2ba", "#e2ddd6"]} position={[0, 0, 0]} />;
});

/** Fixed pull-up bar with uprights, so the height reads as a real height. */
export function PullUpBar({ height = 2.28, span = 1.1 }) {
  return (
    <group>
      <mesh position={[0, height, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.016, 0.016, span, 20]} />
        <meshStandardMaterial color={BAR_COLOUR} roughness={0.45} metalness={0.35} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * span) / 2, height / 2, 0]}>
          <cylinderGeometry args={[0.022, 0.022, height, 14]} />
          <meshStandardMaterial color={RIG_COLOUR} roughness={0.7} metalness={0.15} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * The barbell, placed by the motion at the solved wrist positions.
 *
 * Driving the bar from the hands rather than the hands from the bar is the whole
 * trick: it cannot separate from the grip however the arms solve, so there is no
 * version of this where the hands float off the bar at the bottom of a rep.
 */
export function Barbell({ halfSpan = 0.62, plateRadius = 0.185 }) {
  // No position of its own. The motion drives the wrapping group each frame, and
  // a default offset here would be added on top of that — which is exactly what
  // put the bar a metre above the hands the first time round.
  return (
    <group>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.0135, 0.0135, halfSpan * 2 + 0.42, 18]} />
        <meshStandardMaterial color={BAR_COLOUR} roughness={0.4} metalness={0.4} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (halfSpan + 0.11), 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[plateRadius, plateRadius, 0.05, 28]} />
          <meshStandardMaterial color="#4a4642" roughness={0.72} metalness={0.1} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * A flat bench. `top` is the surface the body is settled onto and `centre` is
 * where along the world Z axis it sits, both handed in by the motion so the
 * bench cannot end up somewhere the body is not.
 */
export function Bench({ top = 0.45, centre = 0.2, length = 1.05, width = 0.3 }) {
  const legInset = 0.12;
  return (
    <group position={[0, 0, centre]}>
      <mesh position={[0, top - 0.035, 0]}>
        <boxGeometry args={[width, 0.07, length]} />
        <meshStandardMaterial color="#57514b" roughness={0.85} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, (top - 0.07) / 2, s * (length / 2 - legInset)]}>
          <boxGeometry args={[width * 0.7, top - 0.07, 0.05]} />
          <meshStandardMaterial color={RIG_COLOUR} roughness={0.7} metalness={0.15} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * The waterline. Single translucent plane at the surface height the swimmer
 * floats at — enough to say "this body is in water", which is the only reason
 * a horizontal body with no ground contact makes sense.
 */
export function Water({ level = 0.92 }) {
  // Small and very faint, and it does not write depth. A large opaque-ish plane
  // seen from above fills the frame and stops reading as a surface at all — it
  // becomes a grey wall behind the swimmer. All this has to do is say "there is
  // a waterline here, and the body is at it".
  return (
    <mesh position={[0, level, 0.85]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[2.4, 3.4]} />
      <meshStandardMaterial
        color="#6ea3c6"
        transparent
        opacity={0.09}
        roughness={0.2}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
