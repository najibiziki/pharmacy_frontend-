import { MapPinned, MapPin } from "lucide-react";
import "./OwnerToggle.css";

function OwnerToggle({ showAll, onToggle }) {
  return (
    <button
      className={`owner-toggle ${showAll ? "owner-toggle--all" : ""}`}
      onClick={onToggle}
      title={showAll ? "Show only my pharmacy" : "Show all pharmacies"}
    >
      {showAll ? <MapPin size={20} /> : <MapPinned size={20} />}
    </button>
  );
}

export default OwnerToggle;
