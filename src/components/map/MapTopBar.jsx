import { useState } from "react";
import { useMap } from "react-leaflet";
import { Link } from "react-router-dom";
import "./MapTopBar.css";

const MAX_RESULTS = 6;

function MapTopBar({ pharmacies = [] }) {
  const map = useMap();
  const [search, setSearch] = useState("");

  const value = search.toLowerCase().trim();

  const results = value
    ? pharmacies.filter(
        (pharmacy) =>
          pharmacy.name?.toLowerCase().includes(value) ||
          pharmacy.address?.toLowerCase().includes(value),
      )
    : [];

  const handleSelect = (pharmacy) => {
    if (pharmacy.latitude == null || pharmacy.longitude == null) return;
    map.setView([pharmacy.latitude, pharmacy.longitude], 16);
    setSearch("");
  };

  return (
    <div className="map-top-bar">
      <div className="search-container">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search pharmacy or place..."
          aria-label="Search pharmacy or place"
        />

        {value && results.length === 0 && (
          <div className="search-no-results">No pharmacy found</div>
        )}

        {results.length > 0 && (
          <div className="search-results">
            {results.slice(0, MAX_RESULTS).map((pharmacy) => (
              <button
                key={pharmacy._id || pharmacy.id}
                className="search-result"
                onClick={() => handleSelect(pharmacy)}
              >
                <strong>{pharmacy.name}</strong>

                <span>{pharmacy.address}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <Link
        to="/add-pharmacy"
        className="add-pharmacy"
        aria-label="Add pharmacy"
        title="Add pharmacy"
      >
        +
      </Link>
    </div>
  );
}

export default MapTopBar;
