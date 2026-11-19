import { memo } from "react";
import { Marker } from "react-leaflet";
import L from "leaflet";
import { Cross } from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import "./PharmacyMarker.css";
import PharmacyPopup from "./PharmacyPopup";

// One icon, built once, shared by every marker
const ICON = L.divIcon({
  className: "pharmacy-marker-icon",
  html: renderToStaticMarkup(
    <div className="pharmacy-marker">
      <div className="pharmacy-marker-center">
        <Cross size={11} color="#16a34a" strokeWidth={3} />
      </div>
    </div>,
  ),
  iconSize: [30, 30],
  iconAnchor: [17, 34],
  popupAnchor: [0, -36],
});

function PharmacyMarker({ pharmacy }) {
  // skip markers without coordinates — avoids a Leaflet crash
  if (pharmacy.latitude == null || pharmacy.longitude == null) return null;

  return (
    <Marker
      position={[pharmacy.latitude, pharmacy.longitude]}
      title={pharmacy.name}
      icon={ICON}
    >
      <PharmacyPopup pharmacy={pharmacy} />
    </Marker>
  );
}

export default memo(PharmacyMarker);
