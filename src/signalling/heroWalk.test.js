import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { heroWalk } from "./heroWalk.js";
import { HERO_IDS, linksOf } from "./heroNetwork.js";
import { SCENARIOS } from "./signallingBinding.js";

const arms = {};
for (const [key, id] of Object.entries(SCENARIOS)) {
  arms[key] = JSON.parse(
    await readFile(new URL(`../../public/scenarios/${id}.json`, import.meta.url), "utf8"),
  );
}

const track = (run, name) => {
  const s = run.series?.[name];
  const v = Array.isArray(s) ? s : s?.values ?? s?.value ?? null;
  assert.ok(Array.isArray(v) && v.length > 1, `no series "${name}"`);
  return v.map(Number);
};
const moves = (run, name) => {
  const v = track(run, name);
  return Math.max(...v) - v[0];
};
/**
 * WHERE A SERIES ENDS, NOT WHERE IT PEAKED — and this distinction is the whole
 * reason this file was rewritten on 2026-09-02. `moves` above is peak-minus-
 * start, and it reads a clean 0.0000 for AMPK under resistance because AMPK's
 * PEAK there is its own first sample: the series then walks DOWNWARD to 0.0667.
 * That blind spot certified the shipped sentence "your workout never moves it
 * at all", which was false. Every claim about a direction now goes through
 * these two.
 */
const ends = (run, name) => {
  const v = track(run, name);
  return v[v.length - 1] - v[0];
};
const endPct = (run, name) => {
  const v = track(run, name);
  return ((v[v.length - 1] - v[0]) / v[0]) * 100;
};
const beat = (arm, id) => heroWalk(arm, arms).find((b) => b.id === id)?.line ?? "";
/** Every number the walk prints inside its bold markers, in order. */
const numbersIn = (line) => [...line.matchAll(/(-?\d+\.\d+)/g)].map((m) => Number(m[1]));

test("every part the walk stands beside is one of the twelve", () => {
  for (const arm of ["resistance", "endurance"]) {
    for (const beat of heroWalk(arm, arms)) {
      assert.ok(
        HERO_IDS.includes(beat.anchor),
        `"${beat.id}" on the ${arm} arm stands beside "${beat.anchor}", which this scale does not draw`,
      );
    }
  }
});

/** The last two sentences are comparisons; one arm cannot make them. */
test("one arm, no walk", () => {
  assert.deepEqual(heroWalk("resistance", null), []);
  assert.deepEqual(heroWalk("resistance", { resistance: arms.resistance }), []);
});

/**
 * THE DOORS, AND THIS IS THE SCREEN'S WHOLE SENTENCE. If the two bouts stop
 * entering at different places the walk's first beat is pointing at nothing in
 * particular and the picture has no argument left.
 */
test("the two bouts really do come in at different doors", () => {
  assert.ok(moves(arms.resistance, "integrin") > 0.5, "resistance does not open the integrin door");
  assert.equal(moves(arms.resistance, "B_AR"), 0, "resistance moves the endurance door");
  assert.ok(moves(arms.endurance, "B_AR") > 0.5, "endurance does not open its own door");
  assert.equal(moves(arms.endurance, "integrin"), 0, "endurance moves the resistance door");
  const door = (arm) => heroWalk(arm, arms).find((b) => b.id === "door")?.anchor;
  assert.equal(door("resistance"), "integrin");
  assert.equal(door("endurance"), "B_AR");
});

test("both bouts really do reach the one the walk calls shared", () => {
  for (const arm of ["resistance", "endurance"]) {
    assert.ok(moves(arms[arm], "JNK") > 0.3, `${arm} barely moves JNK; the trunk beat says both reach it`);
  }
});

/**
 * THE ONE CLEAN SPLIT, RE-AIMED 2026-09-02 — and it was pointing the wrong way.
 *
 * The version this replaces asserted `moves(resistance, "AMPK") === 0` and then
 * matched the shipped sentence *"This one your workout never moves at all"*.
 * The assertion passed and the sentence was false: `moves` is peak-minus-start,
 * AMPK's peak under resistance IS its first sample, and the series runs
 * 0.0792 → 0.0667 from there. A gate that can only see upward motion signed off
 * a claim about the absence of motion. The gate is not deleted, it is re-aimed
 * at the END of each series, and it now asks about the two DIRECTIONS the beat
 * actually names.
 */
test("AMPK is the one the two bouts disagree about, and about the direction", () => {
  assert.ok(
    ends(arms.resistance, "AMPK") < 0,
    "AMPK no longer ends BELOW its start under resistance — the split beat says resistance sends it the other way",
  );
  assert.ok(
    endPct(arms.endurance, "AMPK") > 100,
    "AMPK no longer more than doubles under endurance — the split beat says it does",
  );
  /* The beat quotes four values, and each of them is one of these ends. */
  const line = beat("resistance", "split");
  assert.deepEqual(beat("endurance", "split"), line, "the split beat is a fact about both bouts, not about yours");
  /* IT NO LONGER QUOTES THE FOUR VALUES, 2026-09-02. The owner asked whether
     the narration needed its numbers, and the rule that came out of it is that
     a figure earns its place only when it says something the DRAWING cannot. A
     direction is not one of those — the picture lights one node and dims the
     other. So this asks the archive for the direction, above, and asks the beat
     for the WORD. */
  assert.match(line, /the other way/,
    "the split beat stopped saying resistance sends AMPK the other way — that sentence is a " +
      "correction of a shipped claim that it never moved at all, and it must not be lost again");
});

/**
 * THE TRAP THE `flatter` BEAT WARNS ABOUT, and it is the same one the cell
 * scale catches in AMP: a doubling off a small baseline outranks every other
 * percentage while being one of the smallest actual movements on the screen.
 * If the archive ever makes AMPK the bigger mover in absolute terms too, the
 * warning has become a lie and this goes red.
 */
/* THE `flatter` BEAT AND ITS GATE ARE BOTH GONE, 2026-09-02, and the reason is
   worth keeping. That beat existed only to warn that AMPK's doubling flatters —
   a big percentage off a small baseline. The owner asked whether the narration
   needed its numbers at all, and the answer was that a figure earns its place
   only when it says something the DRAWING cannot. A direction is not one of
   those. With the percentages gone there is nothing left to be flattered by,
   so the caution went too rather than standing over an absence.
   The archive fact it rested on is still gated below, in the direction test. */


/**
 * THE BREAK. The whole screen turns on AMPK splitting cleanly while PGC-1a, the
 * node it feeds, does not split at all. Both halves have to hold: if PGC-1a
 * ever separates the two bouts, "the relay split, what it feeds did not" is
 * simply untrue and the beat has to be rewritten rather than quietly kept.
 */
test("what AMPK feeds does not split, which is the whole surprise", () => {
  const r = endPct(arms.resistance, "PGC_1a");
  const e = endPct(arms.endurance, "PGC_1a");
  assert.ok(
    Math.abs(r - e) < 1,
    `PGC-1a rises ${r.toFixed(1)}% and ${e.toFixed(1)}% — more than a point apart, so "what it feeds did not split" has stopped being true`,
  );
  const seen = numbersIn(beat("resistance", "same"));
  /* THE BEAT NO LONGER QUOTES A FIGURE, 2026-09-02. The owner asked whether
       the narration needed its numbers, and the rule that came out of it is
       that a figure earns its place only when it says something the DRAWING
       cannot. What this gate is FOR is unchanged and is the half above: the
       archive is still asked whether the claim holds. Only the half that read
       the sentence had to move, from counting digits to reading the words the
       beat now uses. */
    assert.match(
      heroWalk("resistance", arms).find((b) => b.id === "same")?.line ?? "",
      /almost exactly the same/,
      "the break beat stopped saying the two rises are almost the same, which is the surprise",
    );
  /* The archive check is above; the beat says "almost exactly the same" rather
     than quoting the two rises, because two numbers a reader has to subtract is
     the drawing's job, not a sentence's. */
  assert.ok(Math.abs(r - e) < 0.5,
    `PGC-1a rises ${r.toFixed(1)}% and ${e.toFixed(1)}% — more than half a point apart, so ` +
      '"almost exactly the same amount" has stopped being true');
});

/**
 * THE ARROWS ARE THE MODEL'S, NOT A TEXTBOOK'S. `expect` and `relay` draw four
 * chains in words. §5's floor is that we do not attribute wiring the archive
 * does not carry, so each one is resolved against the shipped edge list — and
 * each has to be an ACTIVATION, because every one of these beats says "feeds"
 * or "switches on the next".
 */
test("every arrow the walk types out is one the archive can resolve", () => {
  const links = new Map(
    linksOf(arms.resistance.network?.edges ?? arms.resistance.edges).map((l) => [`${l.from} ${l.to}`, l]),
  );
  for (const pair of ["integrin RhoA", "RhoA JNK", "ROS JNK", "AMPK PGC_1a", "PGC_1a Mitochondrial_Biogenesis"]) {
    const link = links.get(pair);
    assert.ok(link, `the walk draws "${pair.replace(" ", " -> ")}" and the model has no path for it`);
    assert.ok(link.sign > 0, `"${pair.replace(" ", " -> ")}" is not an activation, and the walk says it switches the next one on`);
  }
});

/**
 * THE DOOR THE WALK WATCHES OPEN. Both bouts start their own door at zero and
 * drive it most of the way to one; the beat quotes both ends of that.
 */
test("the door the walk watches really does open, from where it says", () => {
  for (const [arm, door] of [["resistance", "integrin"], ["endurance", "B_AR"]]) {
    const v = track(arms[arm], door);
    assert.equal(v[0], 0, `${door} no longer starts at zero under ${arm}`);
    assert.ok(v[v.length - 1] > 0.9, `${door} no longer opens under ${arm}`);
    /* The two endpoints are gone from the sentence — the picture lights the
       door, which is the whole of what they said. The archive is still asked
       whether it opens, above. */
    assert.match(beat(arm, "opens"), /door opens/,
      `the ${arm} opens beat stopped saying the door opens`);
  }
});

/**
 * AND THE ENDING IS THE MISMATCH. Two bouts that enter at opposite ends arrive
 * within a point of each other, resistance very slightly AHEAD on mitochondrial
 * biogenesis — the wrong way round from what a visitor arrives believing. §5
 * says show it. If the archive ever separates them properly this gate goes red
 * and the sentence has to be rewritten rather than quietly kept.
 */
/* ── THE BEATS THE WALK GREW ON 2026-09-01 ──────────────────────────────────
   The owner asked for the scales to explain themselves properly rather than in
   four lines, so this went from four beats to eight. Every number in the new
   ones is counted off the archive; these ask the archive whether each still
   holds. */

test("the other door really does stay shut, which is a whole beat", () => {
  for (const [arm, shut] of [["resistance", "B_AR"], ["endurance", "integrin"]]) {
    const v = track(arms[arm], shut);
    assert.equal(Math.max(...v), 0,
      `${shut} is no longer flat at zero under ${arm} — the "stays shut" beat quotes its peak`);
  }
  const line = heroWalk("resistance", arms).find((b) => b.id === "shut")?.line ?? "";
  /* THE BEAT NO LONGER QUOTES A FIGURE, 2026-09-02. The owner asked whether
       the narration needed its numbers, and the rule that came out of it is
       that a figure earns its place only when it says something the DRAWING
       cannot. What this gate is FOR is unchanged and is the half above: the
       archive is still asked whether the claim holds. Only the half that read
       the sentence had to move, from counting digits to reading the words the
       beat now uses. */
    /* AND THE WORDING MOVED AGAIN, 2026-09-04. "never touches it — not once, the
       whole time" is true of the archive and reads as a sell: a third novice
       read stopped on exactly that emphasis — *"몸 안에 그렇게 깔끔한 건
       없습니다 … 그 강조 때문에 뒤 열두 줄을 덜 믿게 됐습니다"* — and losing
       trust to a flourish is a bad trade for a claim that did not need it. The
       archive half above is untouched; what is asked here is that the beat still
       says the other door stays shut. */
    assert.match(
    heroWalk("resistance", arms).find((b) => b.id === "shut")?.line ?? "",
    /does not open it|never touches it/,
    "the shut beat stopped saying the other door stays shut",
  );
});

test("the input really is a dimensionless dial, which is what the axis shows", () => {
  const surface = String(arms.resistance.protocol?.input_surface ?? "");
  assert.match(surface, /dimensionless/,
    "the archive no longer calls its input dimensionless — the walk tells a first-year that the " +
      "dial is not a weight, and that sentence is the archive's own");
  assert.match(surface, /Nothing calibrates/,
    "the archive no longer says nothing calibrates 1.0 against %1RM or %VO2max; the walk says so " +
      "on its authority");
  /* The `nomap` beat went with the same instruction. The two assertions above
     are the ones that matter and they are untouched: if the archive stops
     calling its input dimensionless, or stops saying nothing calibrates 1.0
     against %1RM, then this scale is quoting a unit it does not have and that
     is a §5 failure whether or not any sentence mentions it. The visitor's reach
     is the axis, which still reads 0 to 1, and the drawer. */
});

test("the bout length the walk quotes is the archive's own", () => {
  const minutes = arms.resistance.protocol?.bout_minutes;
  const line = heroWalk("resistance", arms).find((b) => b.id === "scale")?.line ?? "";
  if (minutes) {
    assert.match(line, new RegExp(`${minutes} minutes`),
      `the archive says ${minutes} bout minutes and the beat quotes something else`);
  }
});

test("the two endings really are close, and the walk counts them", () => {
  const of = (run) => {
    const v = track(run, "Mitochondrial_Biogenesis");
    return ((Math.max(...v) - v[0]) / v[0]) * 100;
  };
  const r = of(arms.resistance);
  const e = of(arms.endurance);
  assert.ok(
    Math.abs(r - e) < 1,
    `mitochondrial biogenesis rises ${r.toFixed(1)}% and ${e.toFixed(1)}% — more than a point apart, so ` +
      '"they end up close" has stopped being true',
  );
  const line = heroWalk("resistance", arms).find((b) => b.id === "out")?.line ?? "";
  const found = [...line.matchAll(/([\d.]+)%/g)].map((m) => Number(m[1]));
  /* THE BEAT NO LONGER QUOTES A FIGURE, 2026-09-02. The owner asked whether
       the narration needed its numbers, and the rule that came out of it is
       that a figure earns its place only when it says something the DRAWING
       cannot. What this gate is FOR is unchanged and is the half above: the
       archive is still asked whether the claim holds. Only the half that read
       the sentence had to move, from counting digits to reading the words the
       beat now uses. */
    assert.match(
    heroWalk("resistance", arms).find((b) => b.id === "out")?.line ?? "",
    /almost the same/,
    "the ending beat stopped saying the two outcomes end up almost the same",
  );
  /* The ending says "almost the same" and hands the SIZE to the `small` beat,
     whose whole argument is that half a percentage point settles nothing. That
     one still quotes its figure, because the smallness IS the claim there and
     no drawing can show it. */
  assert.ok(
    !/\d\.\d%/.test(String(heroWalk).replace(/toFixed\(1\)/g, "")),
    "the ending's percentages are written into the source instead of counted from the archive",
  );
});

/**
 * AND THE ENDING IS THE WRONG WAY ROUND, WHICH IS EXACTLY WHY IT IS NOT SOLD.
 * Resistance ends very slightly AHEAD of endurance on the outcome the endurance
 * story is about. The `small` beat's whole job is to name that gap and then
 * refuse the headline it invites, so the gap it names has to be the archive's
 * and it has to stay small enough to be worth refusing. §5: *"거부보다 표시"*.
 */
test("the gap the walk refuses to sell is the gap the archive has", () => {
  const r = endPct(arms.resistance, "Mitochondrial_Biogenesis");
  const e = endPct(arms.endurance, "Mitochondrial_Biogenesis");
  assert.ok(r > e, "endurance now leads on mitochondrial biogenesis; the walk's surprise is that resistance does");
  const gap = Math.abs(r - e);
  assert.ok(gap < 1, `the two bouts are ${gap.toFixed(2)} points apart — far enough that the walk should stop calling it unsettled`);
  /* THE `small` BEAT WAS DELETED 2026-09-02 (owner: 사족 다 빼). It read the
     0.56 back to the visitor and told them a difference that size settles
     nothing — the character arguing with the reader about a claim it had not
     made.
     THE ARCHIVE HALF ABOVE IS THE HONESTY AND IT STAYS AT FULL STRENGTH. What
     this gate exists for is that the picture's surprise — the two bouts land in
     the same place — must be a fact about the run and not a thing we decided.
     If endurance ever leads, or the gap ever opens past a point, this still goes
     red and the whole closing beat has to be rewritten. That was always the
     load-bearing half; the sentence check was the decoration. */
});
