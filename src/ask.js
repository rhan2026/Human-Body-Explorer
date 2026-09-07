import { serializeHash } from "./scaleRoute.js";

/**
 * The questions the front door can answer, and where each one goes.
 *
 * A QUESTION IS A DESTINATION, NOT A PARAGRAPH. `docs/fixing-prd.md` §7.4 names
 * the thing this file exists to not be: "a chatbot that explains a scale in
 * text is this whole document's failure mode with a better interface". So there
 * is no answer string anywhere below. An entry holds a SCALE, and the answering
 * is that the scene starts running — the store draining, the calcium arriving,
 * the movement moving.
 *
 * THE OTHER HALF OF THE DOOR IS STILL LOCKED, AND THIS IS NOT IT.
 * `decisions.md` #8 gates the conversational layer on API keys that have not
 * arrived, and CLAUDE.md §2 forbids a consumption endpoint in an empty
 * skeleton. Everything here is offline and stays that way: a token set, a list
 * of four, and `serializeHash`. No client, no key, no request, and above all no
 * generated sentence — a stub that pretends to talk is worse than a door that
 * says it is locked, because the pretend answer is the one that gets believed.
 * Unmatched text comes back as `null` and the caller says it has no answer.
 *
 * THE INSTANTS ARE GONE, 2026-08-30, AND WHAT THEY BOUGHT IS NOW FREE.
 * Two entries used to carry a second read off `public/scenarios/soce_on.json` —
 * `tired` went to 5.202 s, the emptiest the SR store ever gets, and `calcium` to
 * 2.763 s, the run's highest free calcium — with `ask.test.js` re-deriving both
 * from the shipped bytes on every run.
 *
 * They left with the `t` in the grammar (`scaleRoute.js`'s header). The reason
 * is not tidiness: a hash naming an instant is how the fibre scale decided a
 * viewer was NOT to be given the guided pass — `state?.t == null ||
 * arrivedFromInside()` — so these two questions were the app's own front door
 * sending people to a frozen frame with the explanation switched off. The pass
 * is 25.8 s and four camera stops, and it visits the draining store; the link
 * put a viewer on one motionless picture of it instead.
 *
 * WHAT WAS LOST WITH THEM, said plainly: three tests in `ask.test.js` that
 * pinned those two seconds to the archive's own extrema. Nothing else measured
 * that pairing, and no test replaces it here — the fibre scale's pass is where
 * the trough is now shown, and it is that scale's to hold.
 *
 * The hash is built by `scaleRoute.js` and never spelled here. It owns the
 * grammar; a string typed in this file is a route that stops agreeing with it
 * the first time the grammar changes.
 */
export const QUESTIONS = Object.freeze([
  Object.freeze({
    id: "tired",
    text: "Why do muscles get tired?",
    scale: "fiber",
    keywords: Object.freeze([
      "tired", "tire", "tires", "tiring", "fatigue", "fatigued", "fatigues",
      "exhausted", "exhaustion", "weaker", "failure", "store", "supply",
    ]),
  }),
  Object.freeze({
    id: "calcium",
    text: "What does calcium actually do?",
    scale: "fiber",
    keywords: Object.freeze(["calcium", "ca2", "troponin", "tropomyosin"]),
  }),
  Object.freeze({
    id: "body",
    text: "What is my body doing when I lift?",
    scale: "body",
    keywords: Object.freeze(["lift", "lifts", "lifting", "body", "movement", "rep", "reps"]),
  }),
  Object.freeze({
    id: "cell",
    text: "What does exercise change inside a cell?",
    scale: "cell",
    /* The cell scale draws the bout beside `ampk_francis_rest_control` — the
       same model, the same parameters, ATP demand held flat — so what separates
       the two rows is the energy cost of the bout and nothing else
       (`cellBinding.js`). The question is literally what that pair is for. */
    keywords: Object.freeze([
      "cell", "cells", "cellular", "ampk", "signal", "signals", "signalling",
      "signaling", "molecular", "energy", "sensor",
    ]),
  }),
]);

/** The hash for a question, on the exercise the caller has resolved. */
export function hashFor(question, exercise) {
  return serializeHash({ exercise, scale: question.scale });
}

const tokens = (text) =>
  new Set(
    String(text ?? "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean),
  );

/**
 * The question a typed line is asking, or `null`.
 *
 * WHOLE TOKENS, NOT SUBSTRINGS, and that is the whole of the cleverness. A
 * substring search makes "ca" match "because" and "can", which is the shape of
 * matching that looks like understanding right up to the moment it sends
 * somebody to the wrong scale. A keyword that is not a token of the input does
 * not match, and nothing is stemmed — the inflections are listed by hand above,
 * which is boring and is also the reason a reader can predict what this does.
 *
 * First entry in `QUESTIONS` order wins. `ask.test.js` pins that no two
 * questions share a keyword, so the order is a tie-break that never has to be
 * used rather than a rule a reader has to hold.
 */
export function matchQuestion(text) {
  const asked = tokens(text);
  return QUESTIONS.find((q) => q.keywords.some((k) => asked.has(k))) ?? null;
}
