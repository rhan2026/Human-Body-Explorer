/**
 * Where a licence name goes when somebody presses it.
 *
 * Q15 R3, 2026-08-27. Both anatomy sets ship under CC BY-SA, and the app named
 * both licences in three places and linked neither: the explorer's footer, the
 * body's footer, and the pick card's `licence` row — whose FULL attribution was
 * in a `title`, reachable only by a mouse resting on the right pixel. That is
 * the same mouse-only pattern Q11 R5 took off the evidence badges, and §5's
 * floor is reach.
 *
 * It is also what the licences ask for. BY-SA's attribution clause wants the
 * credit and a way to the terms; naming "CC BY-SA 2.1 Japan" in grey text
 * satisfies the first half and not the second.
 *
 * A map rather than a parser: the two licences this repository actually ships
 * are known, and a wrong guess at a deed URL is worse than no link.
 *
 * NOBODY CALLS THIS AS OF 2026-08-31, AND THAT IS A DEFECT RATHER THAN A NOTE.
 * All three callers went with the surfaces they were on: the pick card with
 * inspect mode, the body's footer and the explorer's footer with canon D4
 * (2026-08-30). The credit line survived the deletion — `App.jsx`'s drawer,
 * under `Data` — but it survived as PLAIN TEXT, so the app is back to naming
 * "CC BY-SA 2.1 JP" and "CC BY-SA 4.0" and linking neither, which is the exact
 * state Q15 R3 was opened against. Kept, unwired, so that whoever gives the
 * credit line a home does not have to rediscover the deed URLs.
 */
const DEEDS = {
  "CC BY-SA 2.1 Japan": "https://creativecommons.org/licenses/by-sa/2.1/jp/",
  "CC BY-SA 2.1 JP": "https://creativecommons.org/licenses/by-sa/2.1/jp/",
  "CC BY-SA 4.0": "https://creativecommons.org/licenses/by-sa/4.0/",
};

/** The deed for a licence this project ships, or null for anything else. */
export const licenceHref = (name) => DEEDS[String(name ?? "").trim()] ?? null;
