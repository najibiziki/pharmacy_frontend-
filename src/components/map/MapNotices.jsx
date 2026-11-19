import "./MapNotices.css";

/** One pill at a time: error beats loading beats info. */
export default function MapNotices({ notice, loading, error }) {
  if (error) return <div className="map-notice map-notice--error">{error}</div>;

  if (loading)
    return (
      <div className="map-notice map-notice--loading">Loading pharmacies…</div>
    );

  if (notice) return <div className="map-notice">{notice}</div>;
  return null;
}
