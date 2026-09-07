import { Component } from "react";

/**
 * THE SENTENCE THAT STANDS WHERE THE SCENE WOULD HAVE BEEN.
 *
 * This app is careful with the failure paths it knows about. Block the scenario
 * JSON and the cell says "Could not load the coupled run — Failed to fetch", the
 * signalling scale "Could not load the three arms", the fibre "Could not load
 * scenario \"soce_on\"", and the manifest route names the file and the command
 * that rebuilds it. Four failures, four sentences, and §9 protects all of them.
 *
 * The fifth was a blank document. Measured 2026-08-27 with `**\/*.glb` blocked:
 * `#root` came back with an innerHTML length of **0** and two page errors
 * reading "Could not load /models/muscles-individual.glb: Failed to fetch". The
 * loader throws inside a Suspense tree, nothing in this repository caught it —
 * there was no error boundary anywhere — and React unmounted the document.
 *
 * A blank page is the worst state to be left in. It does not say what failed, it
 * does not say whether waiting would help, and it does not say the app is still
 * there. This is the smallest thing that says all three.
 *
 * ONE BOUNDARY AT THE ROUTE, not one per scale. What fails this way is an asset
 * every scene shares, and a boundary inside a scene cannot catch the render that
 * unmounts the scene. Keyed on the route by its caller, so a viewer who moves to
 * another scale gets a fresh attempt rather than a sentence that outlives its
 * cause.
 *
 * The copy names the thing and the retry, and nothing else: §9's default is
 * empty and an error is one of the three things allowed to speak.
 */
export default class SceneBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    const message = this.state.error?.message ?? String(this.state.error);
    return (
      <main className="app">
        <div className="fatal" data-testid="scene-error">
          <p>
            <strong>Could not load this scene.</strong> {message}
          </p>
          <p>Reload to try again — nothing here is saved, so nothing is lost.</p>
        </div>
      </main>
    );
  }
}
