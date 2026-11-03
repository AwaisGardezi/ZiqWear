import { Link } from "react-router-dom";
import { RailFrame } from "../components/rail/RailFrame";

/**
 * The Rail — every piece hanging in 3D, with the full control panel: garment
 * chips, puff + flow sliders, and the drop-a-mockup reskin. This is the React
 * port of the static wardrobe.html mount.
 */
export function Wardrobe() {
  return (
    <div className="pt-16">
      {/* THE RAIL — every piece hanging, turn one to face you */}
      <RailFrame panel limit={40} hostClassName="rail-shell" />

      {/* RAIL NOTES */}
      <section className="section" style={{ background: "var(--paper, #f4efe6)" }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div style={{ marginBottom: "12px" }}>
            <p
              style={{
                fontFamily: "var(--font-ui, Comfortaa, sans-serif)",
                fontSize: "11px",
                letterSpacing: "0.24em",
                textTransform: "uppercase",
                color: "var(--accent, #86622a)",
                margin: 0,
              }}
            >
              How the rail works
            </p>
            <h2
              style={{
                fontFamily: "var(--font-display, 'Instrument Serif', Georgia, serif)",
                fontSize: "clamp(28px, 4vw, 40px)",
                color: "var(--ink, #1b1714)",
                margin: "6px 0 0",
              }}
            >
              Hang it, <em>turn it</em>, take it home.
            </h2>
          </div>

          <div className="rail-notes">
            <div className="rail-note">
              <span className="rail-note__n">01</span>
              <h3>Turn a piece</h3>
              <p>
                Everything hangs edge-on, the way it does in the shop. Run your cursor across the rail and the piece you
                want swings round to face you.
              </p>
            </div>
            <div className="rail-note">
              <span className="rail-note__n">02</span>
              <h3>Open it</h3>
              <p>
                Click to pull it off the rail. The rest settle back along the bar. Pick your size, check what is left, and
                put it straight in the bag.
              </p>
            </div>
            <div className="rail-note">
              <span className="rail-note__n">03</span>
              <h3>Set the hang</h3>
              <p>
                Puff changes how much of the garment you see. Flow lets the fabric move. Drop a transparent mockup on an
                open piece to reskin it.
              </p>
            </div>
          </div>

          <div className="rail-cta">
            <Link to="/shop" className="btn btn-primary">
              Shop everything
            </Link>
            <Link to="/" className="btn btn-secondary">
              Back to the storefront
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
