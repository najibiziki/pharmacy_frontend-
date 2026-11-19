import { useEffect } from "react";
import { useMap, Marker, Circle } from "react-leaflet";
import L from "leaflet";
import { MapPin, LocateFixed } from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import useUserLocation from "../../hooks/useUserLocation";
import "./LocationButton.css";

const locationIcon = L.divIcon({
  className: "user-location-marker",
  html: renderToStaticMarkup(
    <MapPin
      size={40}
      color="#dc2626"
      fill="#dc2626"
      strokeWidth={2}
      style={{
        filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.35))",
      }}
    />,
  ),
  iconSize: [40, 40],
  iconAnchor: [20, 38],
});

function LocationButton() {
  const map = useMap();
  const { location, loading, error, detectLocation } = useUserLocation();

  useEffect(() => {
    if (location) {
      map.flyTo([location.latitude, location.longitude], 16);
    }
  }, [location, map]);

  return (
    <>
      {location && (
        <>
          <Circle
            center={[location.latitude, location.longitude]}
            radius={location.accuracy || 30}
            pathOptions={{
              color: "#dc2626",
              fillColor: "#ef4444",
              fillOpacity: 0.1,
              weight: 1,
            }}
          />

          <Marker
            position={[location.latitude, location.longitude]}
            icon={locationIcon}
            title="Your location"
            zIndexOffset={1000}
          />
        </>
      )}

      <div className="location-control">
        <button
          type="button"
          onClick={detectLocation}
          disabled={loading}
          aria-label="Find my location"
          title="Find my location"
        >
          {loading ? "…" : <LocateFixed size={22} strokeWidth={2.4} />}
        </button>

        {error && <p className="location-error">{error}</p>}
      </div>
    </>
  );
}

export default LocationButton;
