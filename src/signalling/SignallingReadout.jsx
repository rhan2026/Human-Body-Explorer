/**
 * What the signalling scale says in words — which is now only what the picture
 * cannot draw.
 *
 * THE 200-OF-200 CEILING IN THE COMMENTS BELOW IS HISTORY, NOT THE BUDGET, and
 * this note is here because the comments read like the budget. Measured
 * 2026-08-30 in a browser at 1280x800, standing, the pass ended by a press:
 * **114 rendered words against `gate-word-budget`'s ceiling of 200.** The
 * arithmetic that shipped through 2026-08-29 — "signalling sits at 200 of its
 * 200, so a fix is bought, not filed" — was true when it was written and stopped
 * being true the same day `uiMode.js` set `SHOW_FIGURES = false`: the clock rows,
 * the protocol row, the authors' score, the undrawn-nodes line, every evidence
 * badge and the sources footer all stopped rendering, and about a third of the
 * screen went with them.
 *
 * WHY IT IS WORTH A PARAGRAPH. Every one of those comments ends in the same
 * instruction — pay for a new sentence by cutting an old one — and an editor who
 * obeys it today deletes a line this screen still needs to buy room it already
 * has. That is the expensive direction of the error, which is why the correction
 * is stated rather than left for the next measurement.
 * `scripts/measure-signalling-standing.mjs` is the measurement, and re-running it
 * is a second: the count is a fact about the flag, so it moves when the flag does.
 *
 * NOT ONE COUNT HERE IS TYPED. The quiet nodes and the fused marks arrive from
 * `signallingBinding.js`, off the bytes the browser downloaded. CLAUDE.md §9
 * forbids writing down a number that something counts. The one exception is the
 * authors' own 18/21 and 12/16, which nothing here counts and nothing here can:
 * they are quoted, and the row that carries them says so.
 *
 * THE TEST FOR A LINE BEING HERE IS NOW ONE QUESTION — could the canvas carry
 * this? — and three of the four survivors pass it the same way: they are about
 * something ABSENT from the canvas. 24 nodes with no mark; 73 pairs whose two
 * marks are one mark; two outputs whose identical marks are one rule rather than
 * two agreeing results. A picture cannot draw what it is not drawing. The fourth
 * is the authors' validation score, which is not a fact about this run at all.
 *
 * WHAT LEFT ON 2026-08-25 AND WHERE IT WENT (fixing-prd §1, §2.3, §3):
 *
 * - The two doors sentence -> the `doors` callout, which reads the arm chip,
 *   names every door in its record, and sits over the fan of edges the scene now
 *   lights. It named two of resistance's nine doors, and the picture had just
 *   started drawing all nine — a sentence about to be contradicted by the canvas
 *   beside it.
 * - The twelve outputs' widest gap -> the `outputs` callout, on the band the
 *   number is about, computed once in `drawnAt` so the two React roots cannot
 *   disagree by a tick. "One session, not training" stayed here: it is the
 *   qualifier on the picture, not a quantity.
 * - PGC_1a's two offsets -> deleted. They differ by 0.0009 and the whole content
 *   of the pair was that they are the same. The paragraph existed to refuse a
 *   claim — "resistance is the larger" — that this screen was never making, and
 *   §5's last line is that we do not argue with a visitor about what we are not
 *   going to say. `drawn.pgc1a` is still computed and still pinned by
 *   `signallingBinding.test.js`, which is `controlDrift`'s standing exactly: the
 *   check survives its digits leaving the screen.
 *
 * THE TWELVE OUTPUTS ARE NOT A BAR CHART, AND THEY ARE NOT A TABLE EITHER
 * (`decisions.md` P-6, fixing-prd §1 and §4). They are a destination whose marks
 * coincide, and the coincidence is the result — so it is drawn, on the canvas,
 * where two marks landing in one place is the whole sentence. A bar chart would
 * manufacture the contrast that is its job; the thirty-six-number table that
 * shipped until 2026-08-25 printed the contrast in the fourth decimal, which
 * does not lie but is not what anyone came to read.
 *
 * NO BAND, ANYWHERE. Three arms are three solid marks. The same rule as AMPK,
 * for the same reason: uncertainty is spread across runs at one instant, and
 * these are three runs at every instant.
 */

import { SHOW_FIGURES, SHOW_SOURCES } from "../uiMode.js";
import EvidenceBadge from "../Evidence.jsx";
import { readable, SEPARATION, secondsPerMinute } from "./signallingBinding.js";

/**
 * A model node id, spelled the way a reader reads it.
 *
 * The network file names its nodes `Mitochondrial_Biogenesis`. That is the
 * file's spelling and it belongs in the record; in a sentence it is a word with
 * a bar through it. Underscores become spaces and nothing else changes — the
 * ids themselves are still read off the archive by `signallingClaims.test.js`.
 */
// `readable` moved to signallingBinding.js on 2026-08-29 so the outputs plate can spell the same node the same way.

export default function SignallingReadout({
  drawn,
  arms,
  routes,
  arm = "both",
  requestedT = null,
}) {
  if (!drawn) return <p className="note">Waiting for the first frame…</p>;

  const runSeconds = arms.resistance.grid.tEnd * secondsPerMinute;
  const outOfRange = requestedT !== null && (requestedT < 0 || requestedT > runSeconds);
  /* ONE FORMATTER FOR THE REQUEST AND THE RANGE IT IS OUTSIDE. They were
     `.toFixed(0)` and the rounding made the banner contradict itself: at
     `@2694.4s` it printed "2694 s is off the end … 0 to 2694 s", and at
     `@-0.4s` it printed "-0 s". A banner whose own two numbers disagree is
     worse than a silent snap, because it looks like an answer. */
  const s = (v) => v.toFixed(1);
  const { protocol } = arms.resistance;
  /* THE SETTLING IS BEFORE THE BOUT, NOT AFTER IT, and that ORDER is the whole
     of what the screen now says. `protocol.protocol` reads "notebook cells
     8/11/12: 15 h settling, then 45 min held" and `start_state` "the 15 h
     baseline"; read as recovery it turns the screen into a bout with an
     aftermath rather than a settled network pushed once. The durations
     themselves left the screen on 2026-08-25 and stayed in the badge's title,
     so `baseline_minutes` is no longer divided into hours here — nothing on
     screen counts in hours any more. */

  /* HOW MUCH OF THE PICTURE IS ONE MARK WEARING TWO COLOURS, this frame.
     Counted off the same values the marks are drawn from, over every drawn
     slot, so it moves with the run rather than describing the moment someone
     happened to look. At t = 0 it is all of them. PRINTED only when both arms
     are on screen: with one arm hidden, nothing is on top of anything. */
  return (
    <div className="fiber-metrics sig-metrics">
      {/* §9 KEEPS THIS WHOLE. It is the error string, and its numbers are the
          two that have contradicted each other before: the request and the run
          it is outside, at one precision. Shortened only where it explained
          itself twice. */}
      {(outOfRange || drawn.outOfRange) && (
        <p className="note cell-out-of-range">
          {/* THE ASKED INSTANT IS THE VIEWER'S NUMBER, not ours, so it is
              printed as asked — `s()` made "9999s" into "9999.0 s". The span
              after it still goes through `s()`: that one IS ours, read off the
              archive, and one decimal is the precision it is known to. */}
          <strong>{String(Number(requestedT ?? drawn.requestedT))} s is outside this run.</strong>{" "}
          {/* THE RANGE COMES BACK HERE AND NOWHERE ELSE, and it is the one span
              left on any screen. Every other duration went on 2026-08-25 —
              "no timeframes anywhere" — and this edit took this one with them,
              which was wrong twice over. §5 says an input outside the scenario
              grid is said VISIBLY and a silent snap is a bug; §9 says an error
              string is not the place a word budget saves words. And
              `gate-word-budget:228` had already been tightened onto exactly this
              failure, in its own words: "a screen could have printed the sentence
              and no numbers and passed."
              A reader who asked for an instant that does not exist is owed the
              one that does. The BOUT's length is still gone — what returns is
              what this archive covers, which is the answer to their question
              rather than a fact about the protocol. */}
          The archive covers 0 to {s(runSeconds)} s — not the body clock you descended from — and the
          clock below starts at the nearest instant it has.
        </p>
      )}
      {/* AN INSTANT THAT ARRIVED IN RANGE IS THE ONE NOBODY SEES. The banner above
          catches a request outside the archive; this catches the opposite and more
          dangerous case. 6.1 s is a body-clock instant and it is also, arithmetically,
          0.1 min of this network's 44.9 — so `outOfRange` is false, nothing fires,
          and a number that meant one thing quietly becomes another. §5 calls the
          silent version of that a bug.
          It fires for ANY instant that reaches this scale, because none should:
          `scaleRoute.js`'s `hashForScale` drops `t` across this cut, so a `t` here
          was typed or is stale, and either way the reader is the one person who
          needs to be told what it turned into. At 60x replay it is gone from the
          clock within a second of arriving, which is why it has to be said rather
          than shown. */}
      {Number.isFinite(requestedT) && !outOfRange && !drawn.outOfRange && (
        <p className="note cell-out-of-range" data-testid="carried-instant">
          <strong>{s(requestedT)} s is {(requestedT / secondsPerMinute).toFixed(1)} min here.</strong> Not
          the body clock you descended from — this scale runs on its own.
        </p>
      )}
      {/* NO LAP COUNTER, 2026-08-30 (canon D8). It read "Replay N — every node
          dropping back at the seam is the recording restarting", and the owner,
          told what it was for, still could not tell what it was doing: it
          apologised in a sentence for something the picture already does. One
          lap, always looping. What a rewind IS becomes the tour's job to show. */}

      {/* ONE HEADING OVER EVERY NUMBER THAT IS NOT A SENTENCE. There were five —
          Clock, The split, The trunk, The arrival, The control that did nothing —
          and each titled a paragraph that has since become a line or left. A
          heading per line is a table of contents for five rows.
          "The run ·" came off it on 2026-08-25: three words for what the three
          rows under it already are, and the half that earns its place is the
          half that says WHOSE clock — this scale's minutes are not the body's
          seconds, and that is the one thing a viewer arriving from a push-up
          gets wrong. */}
      {SHOW_FIGURES && <p className="label">The network's clock</p>}
      {SHOW_FIGURES && (
      <dl className="meta meta--evidence">
        <dt>
          t{" "}
          <EvidenceBadge
            source={arms.resistance}
            title="the archived sample this frame landed on."
          >
            Derived
          </EvidenceBadge>
        </dt>
        <dd>
          {/* THE POSITION WITHOUT THE LENGTH. This read "16.0 of 44.9 min"; the
              44.9 is the run's span and spans are off the screens. The instant
              stays because the header's clock reading went with them, and a
              scrubber whose position is nowhere on screen is a control a viewer
              cannot aim. */}
          {drawn.tMinutes.toFixed(1)} min
        </dd>
        <dt>
          Protocol{" "}
          <EvidenceBadge source={arms.resistance} title={protocol.protocol}>
            Curated
          </EvidenceBadge>
        </dt>
        {/* THE SPAN LEFT AND THE ORDER STAYED. "15 h settling, then 45 min
            held" told a viewer two durations and one fact, and the fact is the
            only half that changes what they are looking at: the network was
            brought to REST first and the bout was run from there. Read as
            recovery it turns the screen into a bout with an aftermath rather
            than a settled network pushed once. The hours and the minutes are
            still one press away in the badge's title, which is the source and
            not the screen. */}
        <dd>brought to rest first, then held</dd>
        {/* THE AUTHORS' TWO SCORES, TYPED, AND THAT IS CORRECT HERE. §9 forbids
            writing down a number something on this screen counts; nothing counts
            these. They are quoted off the paper's Figure 3 and the archive
            cannot reproduce them — `cannot_be_recomputed` says why, one press
            away under "What is not ours". Ours would be a claim of validation we
            have not made. */}
        {/* THE HEADING DOES THE TEACHING, BECAUSE THERE IS NO ROOM FOR A LINE.
            Q11, 2026-08-27: on screen this row read `Their validation` over
            `18/21 resistance · 12/16 endurance`, which is a ratio of nothing a
            visitor can name. The sentence that says what 18 and 21 are is real
            and one press away on the badge — §5's floor is met — but the floor
            is reach and this question is about teaching.
            `They matched` costs the same two words as `Their validation` and
            turns the row into a sentence: they matched 18/21 resistance, 12/16
            endurance. That mattered because signalling sits at 199 of its 200
            rendered words and a longer heading would have had to displace one.
            The verb is theirs, not ours — the badge says "the authors' own
            score … Quoted, not recomputed", and `decisions.md` #19's rule is
            not to RAISE a verb, which reporting their own word does not. */}
        <dt>
          They matched{" "}
          {/* NO `source`, AND THAT IS THE RULE RATHER THAN AN OVERSIGHT.
              `decisions.md` #18: a record attaches to a number only when the
              number is a function of that scenario's values. 18/21 and 12/16 are
              the authors' own score against published experiments, transcribed
              from their Figure 3 by hand — opening our run's archive, validation
              and pin underneath them would attribute their score to our
              provenance, which is §5's failure with better typography. The
              transcription's own sentence is the whole answer and it is the
              title. `a-number-says-where-it-came-from.spec.js` is the case that
              exists for this, and it had lost its subject when the cell scale's
              transcribed threshold went — this is the same rule, one scale over,
              and it was being broken here. */}
          {/* `paper`, not `source`, for the reason the comment above gives: our
              archive under their score would be §5's failure with better
              typography. The PAPER is theirs and the sentence names its Figure
              3, so Q15 R1's rule applies — a badge that names a paper opens it. */}
          <EvidenceBadge
            paper="doi:10.1113/EP091712"
            title="the authors' own score against nine published papers, transcribed from their Figure 3. Quoted, not recomputed."
          >
            Curated
          </EvidenceBadge>
        </dt>
        <dd>
          <span className="sig-arm--resistance">18/21</span> resistance ·{" "}
          <span className="sig-arm--endurance">12/16</span> endurance
        </dd>
        {/* CONTROL DRIFT LEFT, AND THE SCENE IS WHERE IT ALWAYS WAS. The row read
            "Control drift · Derived · 0.0000" — the strongest number on this
            screen, that nothing moved in the arm that did nothing, stated in the
            one place a reader skips. `gate-word-budget`'s second test is whether
            the PICTURE can carry a sentence, and here it already does: the
            control arm is drawn in its own colour beside the two bouts
            (`signalling.css:36`, and `cellGeometry.test.js` is what stops it
            being drawn by fading instead), and a band that does not move is the
            whole claim. `signallingBinding.js` still computes it and
            `signallingBinding.test.js:195` still pins it at 0 — what left is the
            digits, not the check. */}
      </dl>
      )}


      {/* THE TWO DOORS ARE A PICTURE NOW, so the sentence that was here is gone
          — SignallingScale.jsx's `doors` callout and signallingGeometry.js's lit
          entry edges. It read "Resistance enters at integrin and TGFB; endurance
          at B_AR and ROS", which was two of resistance's nine doors and two of
          endurance's two, and the scene had just started drawing all fifteen. A
          sentence that undercounts the canvas beside it is worse than no
          sentence: a viewer counts lines, gets nine, and learns the panel cannot
          be trusted. Every door is named in the callout's record, which is where
          a name is usable — no mark on this canvas is captioned, so an id in a
          column was a word a reader could not attach to anything. */}
      {/* `quietButMoving` stays in the code and off the screen: 17 of these 24 DO
          move, by less than OUR threshold, which is a fact about the threshold.
          signallingClaims.test.js measures it off the shipped bytes and fails if
          this file ever calls them motionless — so the sentence names the
          threshold instead of the nodes. */}
      {/* AND WHAT THE AUTHORS' OWN UNCERTAINTY DOES TO THAT THRESHOLD. Q26 R2,
          2026-08-29: the paper draws no band, but it publishes a perturbation
          — n_H and EC50 from 1.4/0.5 to 2.0/0.6 — and every one of our 260
          reaction rows carries their default, so it runs. Measured on this
          protocol: 88 of 121 nodes end the bout more than 0.05 from where they
          end here, median 0.1395. 0.05 is the number this very sentence decides
          with. Seven words, paid for in the same round by five off the extent
          line, one off the fused-mark note and one off the footer — signalling
          sat at 200 of 200 and rule 1 said a fix is bought, not filed. (114 now
          — the header. What was bought stays bought; the next fix is cheaper.)
          `provenance.uncertainty` carries the whole of it. */}
      {SHOW_FIGURES && (
        <p className="note">
          <strong>{routes.quiet.length} nodes are not drawn</strong> — neither bout passes our{" "}
          {SEPARATION} threshold, which their parameters clear on most nodes.
        </p>
      )}
      {/* THE FUSED COUNT LEFT FOR THE PICTURE, and this is the note that was
          under it. Q3 R2 put the sentence on the stage, where the misreading it
          guards against is made — `SignallingScale.jsx` carries the reason —
          and R5 took the copy out of here, because a claim that is on screen
          twice is one claim a viewer has to reconcile. Same move
          `CellReadout.jsx` made with the sensor table and this file made with
          the outputs number: what leaves, leaves. `FiberMetrics.jsx` states the
          rule — "a second copy in the panel would put one measured claim on
          screen twice". */}
      {/* THE NUMBER WENT TO THE OUTPUTS CALLOUT AND THE LESSON STAYED. The
          widest of the twelve gaps is a quantity about a band, and it is on that
          band now; this is the qualifier, which no arrangement of marks can
          draw. fixing-prd §2.3: the paper's "differential response" is about
          TRAINING, and a viewer who reads two coinciding columns as "these
          bouts do the same thing" has over-read a 45-minute run by months. */}
      {/* "Both" for "The two", one word lighter — Q14 R1 needed two words to give
          the split plates a denominator and this scale was at 200 of 200. The
          claim is untouched: one session is not training. */}
      {/* THE ARRIVAL CAVEAT MOVED DOWN on 2026-08-30, under the list it is about.
          It used to sit here, ahead of everything: "one session is not training"
          qualified a destination the screen had not yet named, so a reader met
          the disclaimer before the claim. Naming the twelve gave it a subject to
          stand behind, which is the only reason it can be moved rather than the
          only reason it could be read. See the block below. */}
      {/* KEPT, AND A TOOLTIP IS NOT WHERE IT GOES. Reading two identical numbers
          as two results is a misreading a reader makes without being warned, and
          P-6 in decisions.md turns on it. Q3 R5 tried moving it into the
          `outputs` callout's record — one press from the band those two marks
          are drawn in, which answers "it never says WHICH two of the twelve".
          `gate-word-budget` refused it in its own words: prose moved into a
          tooltip "has not been cut, it has been put where only a mouse user
          hovering the right pixel will ever see it. The §5 record belongs there;
          a paragraph does not." Hidden words went 189 to 223 against 186 shown.
          So it stays visible, and which two of the twelve is a real gap that
          wants a sixth anchor rather than a tooltip. */}
      {/* THE FILE'S SPELLING IS NOT THE READER'S. Q11, 2026-08-27: this
          paragraph printed `Mitochondrial_Biogenesis` and `PGC_1a` — node ids
          straight out of the network file, underscore and all — inside a
          sentence a visitor is meant to read. Swept every rendered word on all
          three deep scales for `\w+_\w+`: the fibre has none, the cell has
          none, and these are the two.
          `readable` turns the underscore into a space and changes nothing else,
          so this is not a rename; `PGC-1α` is the same name the literature
          spells with a greek alpha, and the `<code>` still marks it as an
          identifier rather than a word. The file's own form stays in the
          record, which is where an identifier is useful.

          AND `, not two` CAME OFF IN THE SAME EDIT, because spelling the id
          out cost a word and this scale was at 200 of 200. Measured: 201 with
          the underscore gone and the emphasis in, 199 without it. What is left
          says the same thing — "are one number — one rule each off PGC-1α" is
          the reason, and `not two` was the emphasis on it. `TODO.md` filed this
          ceiling two rounds before it was hit; the next word on this screen
          still has to displace one. */}
      {/* IN BEGINNER WORDS since 2026-08-30 (T16). This said "Angiogenesis and
          Mitochondrial Biogenesis are one number — one rule each off PGC-1α":
          two outcome names and a node id, three terms the depth table keeps off
          this layer. The honesty claim survives — two of the drawn outcomes
          move as one and a viewer deserves to know the picture is showing them
          one thing twice — and the names and the mechanism live in the record
          for the day the figures return. */}
      {/* THE STANDING PROSE WENT WITH THE PANEL on 2026-08-30 ("right sidebar
          삭제해"). Three things were here and all three were one day old: the
          twelve destinations in plain words, the note that two of them move as
          one, and the arrival caveat under them.
          THEY ARE NOT LOST AND THIS IS WHERE TO FIND THEM. `plainly` still maps
          every destination in `signallingBinding.js`, `signallingClaims.test.js`
          still fails if one loses its words or if a name reaches the screen the
          archive does not draw, and `drawn.identicalOutputs` is still computed
          and still pinned — the same standing `controlDrift` and `drawn.pgc1a`
          have had since 2026-08-25. What left is the paragraphs, not the claims
          or the checks.
          WHY THEY MATTERED, KEPT SO THE NEXT ROUND DOES NOT REDISCOVER IT: the
          bottom band is the end of the whole four-scale descent, the cell
          scale's row in the depth table ends on "that starts the changes", and
          until they existed the answer on screen was a plate reading `what the
          cell ends up doing` over twelve anonymous marks. Under a pass-only
          screen their home is a beat, which is a change to the storyboard's
          shape rather than a line to move. */}
      {/* PGC_1a'S TWO OFFSETS LEFT ON 2026-08-25, AND THE WHOLE PARAGRAPH WITH
          THEM. The history is worth keeping because it is the argument: a
          headline over them once read "Resistance is the larger here", which
          announced a 0.0007 difference as a result and — the two offsets being
          EXACTLY equal for the first six samples — fell through a strict `>` and
          printed "Endurance is the larger here" over two +0.0000s. That headline
          was deleted and the two numbers stayed, which left a paragraph whose
          entire content was that +0.1667 and +0.1644 are the same number.
          It is gone now for the reason §5 ends on: it existed to refuse a claim
          this screen was never making, and we do not argue with a visitor about
          what we are not going to say. "One trunk feeds both" is what the Y in
          the geometry draws, in the channel that can draw it.
          `drawn.pgc1a` stays computed and `signallingBinding.test.js:157` stays
          red if the identity breaks — same standing as `controlDrift` above, and
          the same reason: the digits leaving the screen is not the check leaving
          the repository. */}

      {/* THE TWELVE-OUTPUT TABLE IS GONE, disclosure and all. Thirty-six
          four-decimal numbers that agree to two decimals were a third of this
          panel, and `<details>` is a tab in all but name (fixing-prd §4). What
          the table was for — the arrival — is the one sentence above it, and the
          twelve marks are drawn on the canvas where the coincidence is the
          picture rather than a column of digits.

          "WHAT CANNOT BE OURS" went the same way on 2026-08-17 and for the same
          reason: three Curated paragraphs at the bottom of a panel nobody had
          read that far, all three now behind the badge on any number here. The
          two scores it quoted are the "Their validation" row above; the input
          surface is a field of the shipped record and reaches a reader through
          any badge on this screen — it was ALSO on SignallingScale.jsx's arrival
          line until 2026-08-25, and that line went with the exercise link. */}
      {/* THE FIELD-OF-VIEW LINE LEFT THIS SCALE on 2026-08-30, by the owner's
          call on the first-visitor audit's finding: "a caption promising a size
          that then refuses one, in five terms nothing on screen explains." Read
          cold it is exactly that — `Field of view: one cell's web of signals. No
          measured extent: the layout is ours.` announces a measurement and then
          spends its second half withdrawing it, in front of a reader who never
          asked. §5's own last line is that we do not argue with a visitor about
          what we are not going to say, and a scale with no geometry saying so
          out loud is that argument, unprompted.
          IT IS NOT THE SAME LINE ON THE OTHER TWO SCALES, which is why this goes
          here and not in a sweep. The fibre's states a real size (6.6 µm) and
          the cell's qualifies a model that HAS an extent; both are answering a
          question a viewer can ask of the picture. This one had no size to give
          — the Fowler network is 121 ODEs with no compartments, no distances and
          no cell boundary — so the whole line was overhead.
          `SIGNALLING_EXTENT` AND ITS TEST STAY. Same standing as `drawn.pgc1a`
          and `controlDrift` above: what left is the words on screen, not the
          claim or the check. `signallingGeometry.test.js` still pins it to "no
          measured extent", still refuses a count and still refuses a duration,
          which is the honest position kept in the record for whoever turns the
          figures back on. The constant now has no consumer on this screen, and
          that is deliberate rather than an oversight.
          THREE BROWSER GATES READ THIS LINE and are repointed rather than
          loosened — see gate-evidence-survives, gate-word-budget and
          gate-the-ride. None of them loses a scale it was grading; each loses
          the one scale that no longer draws the thing it grades. */}
    </div>
  );
}
