/**
 * A LINE THAT ONLY ASKS FOR A REPEAT goes to the character, not the model.
 *
 * Owner, 2026-09-06: *"if the user requests to reshow the text through the text
 * box feature our other agent is working on, then the same content should
 * reappear"*. The guide already keeps its last line and `guide/sayAgain.js` is
 * the one seam that brings it back; the box's half is telling a repeat from a
 * question. Whole tokens, the way `src/ask.js` reads the front door's questions
 * — `again`, `repeat`, `reshow`; not `replay`, which is a button on ENERGY —
 * and ONLY when the whole line is a few words: "say that again" is a repeat,
 * "why do muscles tire again and again after a rest?" is a question with the
 * word in it, and a real question must still reach the model.
 */
const REPEAT = new Set(["again", "repeat", "reshow"]);
/** A repeat is a short line. Four tokens holds "can you say again"; a sentence
    that has room for a subject is a question. */
export const REPEAT_MAX_TOKENS = 4;

export function isRepeatAsk(text) {
  const tokens = String(text ?? "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  return tokens.length > 0 && tokens.length <= REPEAT_MAX_TOKENS && tokens.some((t) => REPEAT.has(t));
}
