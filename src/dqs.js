import * as THREE from "three";

/**
 * Dual quaternion skinning, patched into three.js's standard skinning shader.
 *
 * Linear blend skinning mixes two bone transforms by averaging their *matrices*,
 * which puts the result on the straight chord between where each bone would send
 * the vertex. Rotation moves a vertex along an arc, and the chord always cuts
 * inside it, so at a sharply bent joint the mesh collapses on the inside of the
 * bend and stands off the bone on the outside. The wrist turns nearly 90 degrees
 * in a push-up, which is more than enough to see: the forearm muscles hover a
 * few millimetres clear of the bone all the way round the joint.
 *
 * Narrowing the blend band does not help. It does not reduce the error, it only
 * concentrates it — the smooth bulge becomes a sharp crease. Measured at 45mm,
 * 30mm and 18mm, the artefact got worse, not better.
 *
 * Dual quaternions interpolate along the arc instead. A rigid transform is
 * written as a pair of quaternions — one for rotation, one carrying translation —
 * and blending those and renormalising yields another rigid transform, so no
 * volume is lost anywhere in the transition.
 *
 * Assumes the bind matrix is the identity, which holds because skinSpanningMeshes
 * bakes each mesh to rest-pose world space and binds with an explicit identity.
 */

const DQ_FUNCTIONS = /* glsl */ `
// Rotation quaternion of a rigid mat4. Column-major, so m[c][r].
vec4 dqRotation( mat4 m ) {
  float trace = m[0][0] + m[1][1] + m[2][2];
  vec4 q;
  if ( trace > 0.0 ) {
    float s = sqrt( trace + 1.0 ) * 2.0;
    q = vec4( ( m[1][2] - m[2][1] ) / s, ( m[2][0] - m[0][2] ) / s, ( m[0][1] - m[1][0] ) / s, 0.25 * s );
  } else if ( m[0][0] > m[1][1] && m[0][0] > m[2][2] ) {
    float s = sqrt( 1.0 + m[0][0] - m[1][1] - m[2][2] ) * 2.0;
    q = vec4( 0.25 * s, ( m[1][0] + m[0][1] ) / s, ( m[2][0] + m[0][2] ) / s, ( m[1][2] - m[2][1] ) / s );
  } else if ( m[1][1] > m[2][2] ) {
    float s = sqrt( 1.0 + m[1][1] - m[0][0] - m[2][2] ) * 2.0;
    q = vec4( ( m[1][0] + m[0][1] ) / s, 0.25 * s, ( m[2][1] + m[1][2] ) / s, ( m[2][0] - m[0][2] ) / s );
  } else {
    float s = sqrt( 1.0 + m[2][2] - m[0][0] - m[1][1] ) * 2.0;
    q = vec4( ( m[2][0] + m[0][2] ) / s, ( m[2][1] + m[1][2] ) / s, 0.25 * s, ( m[0][1] - m[1][0] ) / s );
  }
  return normalize( q );
}

// Dual part encoding the translation: 0.5 * (0, t) * qr
vec4 dqTranslation( vec4 qr, vec3 t ) {
  return 0.5 * vec4( qr.w * t + cross( t, qr.xyz ), -dot( t, qr.xyz ) );
}

vec3 dqTransform( vec4 qr, vec4 qd, vec3 v ) {
  vec3 r = v + 2.0 * cross( qr.xyz, cross( qr.xyz, v ) + qr.w * v );
  vec3 t = 2.0 * ( qr.w * qd.xyz - qd.w * qr.xyz + cross( qr.xyz, qd.xyz ) );
  return r + t;
}

vec3 dqRotate( vec4 qr, vec3 v ) {
  return v + 2.0 * cross( qr.xyz, cross( qr.xyz, v ) + qr.w * v );
}
`;

const SKINBASE = /* glsl */ `
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );

	vec4 dqRealX = dqRotation( boneMatX );
	vec4 dqRealY = dqRotation( boneMatY );
	vec4 dqRealZ = dqRotation( boneMatZ );
	vec4 dqRealW = dqRotation( boneMatW );

	// Quaternions double-cover rotations, so a bone whose quaternion came out on
	// the far hemisphere would blend the long way round and turn the mesh inside
	// out. Flip each one to agree with the first influence before summing.
	dqRealY *= sign( dot( dqRealX, dqRealY ) + 1e-6 );
	dqRealZ *= sign( dot( dqRealX, dqRealZ ) + 1e-6 );
	dqRealW *= sign( dot( dqRealX, dqRealW ) + 1e-6 );

	vec4 blendReal =
		skinWeight.x * dqRealX + skinWeight.y * dqRealY +
		skinWeight.z * dqRealZ + skinWeight.w * dqRealW;

	vec4 blendDual =
		skinWeight.x * dqTranslation( dqRealX, boneMatX[3].xyz ) +
		skinWeight.y * dqTranslation( dqRealY, boneMatY[3].xyz ) +
		skinWeight.z * dqTranslation( dqRealZ, boneMatZ[3].xyz ) +
		skinWeight.w * dqTranslation( dqRealW, boneMatW[3].xyz );

	// Renormalising is what makes the result a rigid transform again, and is
	// why nothing shrinks across the joint.
	float dqLen = length( blendReal );
	if ( dqLen > 1e-6 ) {
		blendReal /= dqLen;
		blendDual /= dqLen;
	} else {
		blendReal = vec4( 0.0, 0.0, 0.0, 1.0 );
		blendDual = vec4( 0.0 );
	}
`;

const SKINNORMAL = /* glsl */ `
	objectNormal = dqRotate( blendReal, objectNormal );
	#ifdef USE_TANGENT
		objectTangent = dqRotate( blendReal, objectTangent );
	#endif
`;

const SKINNING = /* glsl */ `
	// Volume preservation, applied in rest space before the bones move anything.
	//
	// Skinning decides where a muscle's ends go, so it already sets the length —
	// what it has no term for is girth. A real muscle keeps its volume, so
	// shortening 40% thickens it about 29% (1/sqrt(0.6)). Scaling only the
	// component perpendicular to the fibre adds exactly that, and leaves the
	// along-fibre component to skinning so the two do not fight.
	{
		vec3 rel = transformed - uFibreCentre;
		float along = dot( rel, uFibreAxis );
		vec3 perp = rel - along * uFibreAxis;
		transformed = uFibreCentre + along * uFibreAxis + perp * uGirth;
	}

	transformed = dqTransform( blendReal, blendDual, transformed );
`;

/**
 * Swaps a material's skinning over to dual quaternions. Safe to call on a
 * material used by several meshes; the patch is idempotent.
 */
export function useDualQuaternionSkinning(material, fibre) {
  if (material.userData.dqs) return material;
  material.userData.dqs = true;

  // Per-material so each muscle carries its own fibre line and current girth.
  const uniforms = {
    uFibreCentre: { value: new THREE.Vector3(...(fibre?.c ?? [0, 0, 0])) },
    uFibreAxis: { value: new THREE.Vector3(...(fibre?.a ?? [0, 1, 0])).normalize() },
    uGirth: { value: 1 },
  };
  material.userData.girth = uniforms.uGirth;

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <skinbase_vertex>", SKINBASE)
      .replace("#include <skinnormal_vertex>", SKINNORMAL)
      .replace("#include <skinning_vertex>", SKINNING)
      .replace(
        "#include <common>",
        `#include <common>\nuniform vec3 uFibreCentre;\nuniform vec3 uFibreAxis;\nuniform float uGirth;\n${DQ_FUNCTIONS}`,
      );
  };
  material.customProgramCacheKey = () => "dqs";
  material.needsUpdate = true;
  return material;
}
