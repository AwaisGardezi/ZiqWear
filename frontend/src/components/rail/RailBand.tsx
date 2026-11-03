import { Link } from "react-router-dom";
import { RailFrame } from "./RailFrame";

/**
 * The panel-less rail band for the homepage — the same 3D rail the wardrobe
 * page gets, stripped of its control column. Hover turns a piece, click pulls
 * it off the rail, and the buy row works through the app's real cart.
 */
export function RailBand() {
  return (
    <section className="rail-shell rail-shell--band" aria-label="3D wardrobe rail">
      <div className="rail-band__head">
        <div className="rail-band__head-inner">
          <div>
            <p className="eyebrow">New way to browse</p>
            <h2>
              Walk the <em>rail</em>
            </h2>
          </div>
          <Link to="/wardrobe" className="rail-band__link">
            Open the full wardrobe
          </Link>
        </div>
      </div>
      <RailFrame panel={false} limit={12} hostClassName="rail-band__stage" />
    </section>
  );
}
