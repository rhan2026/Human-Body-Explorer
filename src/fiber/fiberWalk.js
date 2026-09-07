import { valuesOf } from "../cell/cellChain.js";

/**
 * What the guide says on the fibre scale, and which part it says it beside.
 *
 * WHY THIS IS A WALK AND NOT THE TOUR, AND WHY THE TOUR IS STILL HERE.
 * `cellWalk.js` and `heroWalk.js` replaced storyboards that had been stood down
 * — their scales arrived and said nothing at all. This scale is the opposite
 * case: `fiberTour.js` is real, it travels, and pressing a part still plays that
 * part's demonstration. What it was NOT is an explanation for somebody who has
 * never heard the words. It opens on *"Deep inside a muscle fibre: one
 * sarcomere"* and expects a reader to already know what a sarcomere, a
 * cisterna and troponin are, because it was written to be watched rather than
 * to teach.
 *
 * So the arrival is the walk's and the presses stay the tour's
 * (`MuscleFiberVisualization.jsx` wires the precedence, `FiberScene.jsx` no
 * longer plays the storyboard at a visitor unasked). This moves no camera,
 * seeks no clock and touches nothing the run is doing — every anchor is a
 * `LEVELS.sarcomere` anchor id, and it plays once, on arrival.
 *
 * ── THE ARC, AND IT IS THE ARCHIVE'S RATHER THAN MINE ────────────────────────
 * A reader arrives believing a muscle "just contracts", and that it fades
 * because it runs out. Measured on the shipped `soce_on.json`:
 *
 *   peak pull, repetition 1 → 10   0.8713 → 0.3239   falls every repetition
 *   peak calcium, 1 → 10           27.15 → 26.74 µM  the tenth is 99% of the first
 *   store, per-repetition ceiling  547 → 448 µM      falls every repetition
 *   store at its emptiest          167.9 µM          18% of the resting load
 *   phosphate                      1505 → 7492 µM    rises at every sample
 *
 * The fade is real and the store does run down — so the expected answer is
 * genuinely available to a reader, which is what makes it worth breaking. What
 * the archive then says is that the command never weakened and the store never
 * emptied.
 *
 * WHAT THIS DELIBERATELY DOES NOT SAY. The tour's closing beat names the cause
 * — *"waste around the strands took the pull, not the store"* — on the authors'
 * own attribution (their Figure 6C: fixing myoplasmic phosphate almost entirely
 * eliminated the force reduction). That is THEIR finding about THEIR model, and
 * this file computes no such thing: it counts a rise in phosphate beside a fall
 * in pull, and a correlation is not a cause. §5 — our arithmetic does not go in
 * the authors' mouths. So the waste beat reports the rise and the ending stays
 * on the mismatch, which is what these series actually measure.
 *
 * EVERY FIGURE IS COUNTED AT BUILD TIME. §9: *"세어 나오는 값을 글자로 박지
 * 마라"*. A typed percentage goes stale the day the Python layer re-exports and
 * nothing tells anybody; `fiberWalk.test.js` re-asks the archive for each of
 * these sentences and fails when one stops being true.
 */

/**
 * @typedef {object} WalkBeat
 * @property {string} id      stable
 * @property {string} anchor  a `LEVELS.sarcomere` anchor id
 * @property {string} line    one sentence, present tense, about what is there
 * @property {number} ms      how long it holds
 */

/** A series' own first sample. */
function startOf(run, name) {
  const v = valuesOf(run, name);
  return Array.isArray(v) && v.length ? Number(v[0]) : null;
}

/** How many times over a series' peak stands above its own start. */
function fold(run, name) {
  const a = startOf(run, name);
  const v = valuesOf(run, name);
  if (!Number.isFinite(a) || a === 0 || !Array.isArray(v)) return null;
  return Math.max(...v.map(Number)) / a;
}

/**
 * The largest value inside each repetition's own cycle.
 *
 * WHY PER REPETITION AND NOT OVER THE RUN. The two halves of this walk's ending
 * are both comparisons between the first repetition and the last — the pull
 * falls, the calcium does not — and a run-wide maximum cannot see either. The
 * window is the protocol's own `cycle_s`, so it follows a re-export rather than
 * agreeing with one by hand.
 */
function repPeaks(run, name) {
  const t = valuesOf(run, "t");
  const v = valuesOf(run, name);
  const { cycle_s: cycle, repetitions: reps } = run?.protocol ?? {};
  if (!Array.isArray(t) || !Array.isArray(v) || !(cycle > 0) || !(reps > 0)) return null;
  const out = [];
  for (let k = 0; k < reps; k += 1) {
    let best = -Infinity;
    for (let i = 0; i < t.length; i += 1) {
      if (t[i] >= k * cycle && t[i] < (k + 1) * cycle && Number(v[i]) > best) best = Number(v[i]);
    }
    if (!Number.isFinite(best)) return null;
    out.push(best);
  }
  return out;
}

/** The quietest the pull gets once the bursts are over, against its own peak. */
function pullAfterTheBursts(run) {
  const t = valuesOf(run, "t");
  const f = valuesOf(run, "force_relative");
  const { t_exercise_s: work, cycle_s: cycle } = run?.protocol ?? {};
  if (!Array.isArray(t) || !Array.isArray(f) || !(work > 0) || !(cycle > 0)) return null;
  let most = 0;
  for (let i = 0; i < t.length; i += 1) if (t[i] >= work + cycle && Number(f[i]) > most) most = Number(f[i]);
  const peak = Math.max(...f.map(Number));
  return peak > 0 ? most / peak : null;
}

/**
 * TAKES THE PAGE'S OWN MEASUREMENT OF THE STORE, and does not repeat it.
 * `storeCeilings` is what `fiberTour` already uses to decide which two frames
 * its ending cuts between, and a walk that measured the refill some other way
 * could disagree with the picture it is standing on — the one thing a caption
 * must never do.
 *
 * @param scenario the loaded run (either archive shape — see `valuesOf`)
 * @param ceilings `storeCeilings(scenario)`, where the store got back to after
 *   each repetition
 * @returns {WalkBeat[]} empty when either is missing — a walk that names a
 *   measurement it could not make is worse than no walk
 */
export function fiberWalk(scenario, ceilings) {
  if (!scenario) return [];
  if (!Array.isArray(ceilings) || ceilings.length < 2) return [];

  const full = startOf(scenario, "Ca_SR_total");
  const calciumFold = fold(scenario, "Ca_myo_total");
  const phosphateFold = fold(scenario, "Pi_myo_total");
  const pull = repPeaks(scenario, "force_relative");
  const calcium = repPeaks(scenario, "Ca_myo_total");
  const store = valuesOf(scenario, "Ca_SR_total");
  const quiet = pullAfterTheBursts(scenario);
  if (!Number.isFinite(full) || full === 0 || !pull || !calcium || !Array.isArray(store)) return [];
  if (![calciumFold, phosphateFold, quiet].every(Number.isFinite)) return [];

  const pullFall = (pull[0] - pull[pull.length - 1]) / pull[0];
  const calciumKept = calcium[calcium.length - 1] / calcium[0];
  const firstRefill = ceilings[0].value / full;
  const lastRefill = ceilings[ceilings.length - 1].value / full;
  const leftAtWorst = Math.min(...store.map(Number)) / full;

  const pct = (v) => `${Math.round(v * 100)}%`;
  /* A BOUND RATHER THAN A ROUNDING. The pull after the bursts is four
     hundredths of a percent of its peak, and `pct` would print that as 0% — a
     number the run never had, over a run that is still drawing a value. So the
     sentence says "under", and the figure is rounded the only way a bound may
     be rounded, which is up. */
  const under = (v) => `${(Math.ceil(v * 1000) / 10).toFixed(1)}%`;
  /* One decimal below ten and none above it. `fold` answers 4.98 for phosphate
     and 291.04 for calcium, and a tenth of a decimal place is meaning on one
     and noise on the other. */
  const times = (v) => (v >= 10 ? `${Math.round(v)}x` : `${v.toFixed(1)}x`);

  return [
    {
      id: "unit",
      anchor: "myosin",
      /* NAME THE THING YOU ARE STANDING IN. A novice read of this walk
         (2026-09-04) stopped on the fact that every other part gets a name and
         the piece the whole floor is about did not — "뭐라고 불러야 할지 모르니
         나중에 다시 언급할 수가 없습니다". It also needs to be one of many, or a
         muscle sounds like it is a single block. */
      /* THE WORD THE FLOOR IS NAMED AFTER ARRIVED WITH A `the` AND NO
         INTRODUCTION — a novice read (2026-09-04): *"fibre가 정관사를 달고 처음
         나옵니다. 근육, 블록, sarcomere는 봤는데 fibre가 그중 뭔지 안
         알려줍니다."* One clause places it. */
      line: "A muscle is a bundle of long **fibres**, and each fibre is built from blocks like this one, end to end.",
      ms: 7100,
    },
    {
      id: "named",
      anchor: "myosin",
      line: "One block is called a **sarcomere**. Everything from here on happens inside one.",
      ms: 4600,
    },
    {
      id: "thick",
      anchor: "myosin",
      line: "These thick strands are **myosin**. They do the pulling.",
      ms: 3700,
    },
    {
      id: "thin",
      anchor: "actin",
      line: "These thin strands are **actin**. Myosin grabs them and drags them inward.",
      ms: 4600,
    },
    {
      id: "latch",
      anchor: "tropomyosin",
      line: "But actin is covered. **Tropomyosin** lies across the places myosin would grab, so nothing can pull.",
      ms: 5800,
    },
    {
      id: "command",
      anchor: "t-tubule",
      /* THE TUBE ARRIVED FROM NOWHERE. Same novice read: "튜브가 갑자기
         등장합니다. 앞에서 튜브 얘기가 없었습니다." A signal from the brain has
         to get to the middle of a fibre, and the channel is how. Say that, then
         name it. */
      line: "Your brain's order arrives as an electrical pulse. It has to reach the middle of the fibre.",
      ms: 5700,
    },
    {
      id: "channel",
      anchor: "t-tubule",
      line: "So it travels down a narrow channel that runs inward — the **T-tubule**.",
      ms: 4600,
    },
    {
      id: "store",
      anchor: "sr",
      line: "Wrapped around that channel is a store of **calcium**: the **terminal cisterna**. Each pulse opens it.",
      ms: 5800,
    },
    {
      id: "flood",
      anchor: "sr",
      /* NO MULTIPLE. This read "Calcium floods out — 291x above its resting
         level", and the owner's rule of 2026-09-04 is that a figure like that
         helps nobody: *"숫자가 내가 20살인데 뭔 도움이 되겠어 그냥 이해를
         돕는거야"*. The fact the multiple was carrying — that the fibre is
         almost calcium-free at rest — is the part worth keeping, in words. */
      /* "EMPTY" TWICE, SIX LINES APART, ABOUT DIFFERENT THINGS. A third read
         (2026-09-04): *"공간이 비었다는 건지 창고가 비었다는 건지, 잠깐 앞뒤가
         안 맞는 줄 알았습니다."* The space around the strands is what fills; the
         store is what empties. One word each. */
      line: "Calcium pours out. At rest there is almost none of it loose around the strands — this is bare to flooded in an instant.",
      ms: 7700,
    },
    {
      id: "unlock",
      anchor: "tropomyosin",
      line: "Calcium lands on **troponin**, troponin pulls tropomyosin aside, and the grab sites open: calcium arrives → the cover moves → myosin pulls.",
      ms: 7600,
    },
    {
      id: "fade",
      anchor: "myosin",
      /* WHICH CLOCK THIS FLOOR IS ON. A third novice read (2026-09-04): *"어느 층이 1초인지 한 세트인지 한 세션인지 6주인지 아무도 안 말해줍니다. 그래서 네 층이 동시에 벌어지는 것처럼 읽히고, 하강이 공간처럼 보이는데 절반은 사실 시간입니다."* One clause per floor, in words. */
      line: "Now watch one whole set go by. **The pull gets weaker every repetition** — what you feel near the end of it.",
      ms: 7400,
    },
    {
      id: "drain",
      anchor: "sr",
      /* SAY THAT THE DEFICIT IS SMALL, or the two lines after this read as a
         retraction. The read: *"뭔가가 줄어든다고 해놓고 안 줄어든다고 하고,
         13번이 틀린 건지 그냥 작은 건지 안 말해줍니다."* */
      line: "And the store gets back slightly less after every burst — refilling a little slower than it empties.",
      ms: 6400,
    },
    {
      id: "expect",
      anchor: "sr",
      line: "So you might expect this: **the store runs down → less calcium → the pull fades.**",
      ms: 5800,
    },
    {
      id: "but",
      anchor: "t-tubule",
      line: "But that is not what happens. The last burst still delivers **nearly as much calcium as the first.**",
      ms: 6100,
    },
    {
      id: "left",
      anchor: "sr",
      line: "And the store never comes close to empty. At its lowest it is still most of the way full.",
      ms: 6300,
    },
    {
      id: "waste",
      anchor: "tropomyosin",
      /* THE CONCLUSION RESTED ON AN UNNAMED NOUN. The novice read stopped dead
         here: "waste가 뭔지 한 글자도 안 나옵니다 … 그런데 이게 이 층의
         결론입니다." The name was always in this line; what was missing is where
         it comes from and why it stays. Both are one clause each, and the first
         of them is the hook the next floor opens on. */
      /* THE MOST LOAD-BEARING CLAUSE IN THE DESCENT, AND IT WAS AN ASIDE. The
         third read picked this as the single line to change: *"이 한 구절에
         3층·4층 전체가 매달려 있는데, 다른 목적의 문장 안에 곁가지로
         들어갑니다. 칼슘은 네 줄을 받았는데 이건 대시 하나를 받습니다."*
         Two beats: what myosin spends, then what is left of it. */
      line: "So what is? Every grab costs myosin something. It splits a **fuel molecule** to get the energy for one pull.",
      ms: 7600,
    },
    {
      id: "leftover",
      anchor: "myosin",
      line: "Splitting it leaves a piece over — a **phosphate** — and that piece does not get used again.",
      ms: 5900,
    },
    {
      id: "clog",
      anchor: "actin",
      /* "GETS IN THE WAY" WAS A SHRUG AT THE FLOOR'S OWN ANSWER. The read:
         *"열 줄 전에 칼슘이 troponin에 앉고 troponin이 tropomyosin을 젖힌다는
         정확한 사슬을 줬으면서, 정작 내가 지치는 이유는 '가로막는다'입니다.
         무엇을요?"* Say where it sits, in the words this floor already taught. */
      line: "That phosphate does not leave. It sits where myosin grips, and every grip after it is a little weaker.",
      ms: 6200,
    },
    {
      id: "surprise",
      anchor: "myosin",
      line: "So the surprise is: **the muscle tires not because the signal fades, but because the leftovers pile up.**",
      ms: 6700,
    },
  ];
}
