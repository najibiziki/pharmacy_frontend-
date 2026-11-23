import { useCallback, useEffect } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import useOsmPharmacies from "../../hooks/useOsmPharmacies";
import PharmacyMarker from "./PharmacyMarker";
import LocationButton from "./LocationButton";
import LoginButton from "./LoginButton";
import LogoutButton from "./LogoutButton";
import MapTopBar from "./MapTopBar";
import OwnerToggle from "./OwnerToggle";
import MapNotices from "./MapNotices";
import "./Map.css";

// Same fallback as useOsmPharmacies — Marrakech
const FALLBACK_CENTER = [31.6295, -7.9811];
const FALLBACK_ZOOM = 13;

/** Flies to the user's own pharmacy whenever its coordinates change. */
function FocusMyPharmacy({ pharmacy }) {
  const map = useMap();

  useEffect(() => {
    if (!pharmacy || pharmacy.latitude == null || pharmacy.longitude == null)
      return;
    map.flyTo([pharmacy.latitude, pharmacy.longitude], 15, { duration: 1.2 });
  }, [map, pharmacy?.latitude, pharmacy?.longitude]);

  return null;
}

function MapContent({
  pharmacies,
  myPharmacy,
  notice,
  loading,
  error,
  showAll,
  onToggleShowAll,
}) {
  return (
    <>
      <MapTopBar pharmacies={pharmacies} />

      <MapNotices notice={notice} loading={loading} error={error} />

      {pharmacies.map((pharmacy) => (
        <PharmacyMarker key={pharmacy._id || pharmacy.id} pharmacy={pharmacy} />
      ))}

      {myPharmacy &&
        myPharmacy.latitude != null &&
        myPharmacy.longitude != null && (
          <OwnerToggle showAll={showAll} onToggle={onToggleShowAll} />
        )}

      {!myPharmacy && <LocationButton />}
      <LoginButton />
      <LogoutButton />
    </>
  );
}

function Map() {
  const {
    pharmacies,
    myPharmacy,
    showAll,
    setShowAll,
    notice,
    loading,
    error,
  } = useOsmPharmacies();

  const handleToggleShowAll = useCallback(() => {
    setShowAll((v) => !v);
  }, [setShowAll]);

  return (
    <MapContainer
      center={FALLBACK_CENTER}
      zoom={FALLBACK_ZOOM}
      zoomControl={false}
      className="map"
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <FocusMyPharmacy pharmacy={myPharmacy} />

      <MapContent
        pharmacies={pharmacies}
        myPharmacy={myPharmacy}
        notice={notice}
        loading={loading}
        error={error}
        showAll={showAll}
        onToggleShowAll={handleToggleShowAll}
      />
    </MapContainer>
  );
}

export default Map;
