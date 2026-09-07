/**
 * What one picked muscle mesh actually is, assembled from `muscle-map.json`.
 *
 * The manifest has carried this since the mesh set was built and none of it
 * reached a pixel: `grep -rl "FMA" src/` returned nothing while every mesh in
 * the file had an FMA id, a BodyParts3D id and a licence beside it. This is the
 * lookup that ends that, and it is deliberately the only place that decides what
 * an incomplete record is allowed to look like.
 *
 * KEYED BY MESH NAME, never by position. The manifest also exposes a `fmaIds`
 * array per muscle, and it must not be read alongside `meshes`: the two are
 * filtered by different predicates, so the five Z-Anatomy muscles ship two
 * meshes beside an empty id list, and a positional read gives a muscle its
 * neighbour's ontology id. `meshOntology` exists so that cannot happen.
 *
 * THE THREE ABSENCES ARE DIFFERENT CLAIMS, and collapsing them is the failure
 * this module is shaped around:
 *
 *   - no id            the mesh came from Z-Anatomy, which publishes neither an
 *                      FMA nor a BodyParts3D id. The mesh is known; the id does
 *                      not exist. Show the gap.
 *   - not in the roles the exercise was assessed and this muscle is not in it.
 *   - not in the map   nobody ever assessed it. Saying "not involved" here would
 *                      be an assertion about work that was never done — 170 of
 *                      467 meshes were never given a role at all.
 */

/** In the map, but this exercise does not list it. */
export const ROLE_ABSENT = "absent";
/** Not in the muscle map, so no exercise ever assessed it. */
export const ROLE_UNMAPPED = "unmapped";

const ROLES = ["primary", "secondary", "stabilizer"];

/** `bp3d` / `z-anatomy` are the manifest's own words; these are its own credits. */
const ATTRIBUTION_KEY = { bp3d: "bodyParts3D", "z-anatomy": "zAnatomy" };

/* Read out of the credit rather than written again here, so the short form on
   screen cannot drift from the full credit the CC BY-SA licences require. */
const shortLicence = (credit) => credit?.match(/CC BY-SA [\d.]+(?: \w+)?/)?.[0] ?? null;

/**
 * @param picked  the pick payload — `{ name, key, label, group }`
 * @param map     the parsed `muscle-map.json`
 * @param roles   `map.exercises[<id>]` for the exercise on screen, or null when
 *                none is selected. Null means "no role sentence", NOT "no role".
 */
export function anatomyNode(picked, map, roles) {
  /* THE GLB SPELLS MESH NAMES WITH UNDERSCORES AND THE MANIFEST WITH SPACES.
     `left_iliotibial_tract` against `left iliotibial tract` — measured, every
     lookup missed and every mesh came back with no id, which reads exactly like
     an ontology that was never exported. The pick handler already does this
     substitution for its `meshChain` lookup, so the two spellings were a known
     fact that had not reached here. Raw name first, so a manifest that ever
     keys by the underscored form still wins. */
  const onto =
    map?.meshOntology?.[picked?.name] ??
    map?.meshOntology?.[picked?.name?.replace(/_/g, " ")] ??
    null;
  const credit = onto?.source ? (map?.attribution?.[ATTRIBUTION_KEY[onto.source]] ?? null) : null;

  let role = null;
  let roleLabel = null;
  if (roles) {
    if (!picked?.key) {
      role = ROLE_UNMAPPED;
      roleLabel = "Outside the exercise roster — no role was ever assigned";
    } else {
      role = ROLES.find((r) => (roles[r] ?? []).includes(picked.key)) ?? ROLE_ABSENT;
      roleLabel =
        role === ROLE_ABSENT
          ? `Not involved in ${roles.label}`
          : `${role[0].toUpperCase()}${role.slice(1)} in ${roles.label}`;
    }
  }

  return {
    mesh: picked?.name ?? null,
    label: picked?.label ?? null,
    group: picked?.group ?? null,
    key: picked?.key ?? null,
    fmaId: onto?.fmaId ?? null,
    bpId: onto?.bpId ?? null,
    source: onto?.source ?? null,
    isTendon: onto?.isTendon ?? false,
    licence: shortLicence(credit),
    attribution: credit,
    role,
    roleLabel,
    /* Carried, not judged. Bench press says "PRD section 8.2" and the other five
       say "curated" — the manifest's own evidenceNote calls the whole layer
       Curated and says the rest await review. Putting that beside the role is
       the cheapest honest thing this panel does. */
    /* ONLY WHERE A ROLE WAS ACTUALLY ASSIGNED. This first rode along on every
       record, so an unrostered tendon read "Outside the exercise roster — no
       role was ever assigned · PRD section 8.2", crediting a source for a
       judgement it never made — the §5 failure with better typography. */
    roleSource: role && role !== ROLE_UNMAPPED ? roles?.source ?? null : null,
  };
}
