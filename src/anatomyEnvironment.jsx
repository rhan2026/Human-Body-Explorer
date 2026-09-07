import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

import { environmentSource } from "./anatomyStyle.js";

/**
 * Installs the generated room as `scene.environment`.
 *
 * `anatomyStyle.js` carries what the room is and why its mean is so low. What
 * this component owns is the one thing that needs a renderer: PMREM. The
 * pre-filter is what makes a rough surface see a blurred room and a smooth one
 * see a sharp one, and without it an equirect texture assigned straight to
 * `scene.environment` is a mirror at every roughness.
 *
 * ONE PER CANVAS, DISPOSED WITH IT. The render target holds GPU memory and the
 * deep scales unmount whenever a visitor climbs; leaking one per descent is a
 * leak per descent.
 */
export default function AnatomyEnvironment() {
  const { gl, scene } = useThree();

  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const source = environmentSource(THREE);
    const target = pmrem.fromEquirectangular(source);
    scene.environment = target.texture;
    source.dispose();
    pmrem.dispose();
    return () => {
      scene.environment = null;
      target.dispose();
    };
  }, [gl, scene]);

  return null;
}
