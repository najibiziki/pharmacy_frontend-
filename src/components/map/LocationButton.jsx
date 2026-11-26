import { useEffect, useRef, useState } from "react";
import { useMap, useMapEvents, Circle, Marker } from "react-leaflet";
import L from "leaflet";
import { LocateFixed } from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import "./LocationButton.css";

const LS_VIEW_KEY = "pharmacy:lastView"; // camera center + zoom
const LS_FIX_KEY = "pharmacy:lastFix"; // last real GPS fix (the hook reads this too)

const BAD_FIX = 2000; // m — don't follow/center on fixes worse than this
const MAX_FIX_AGE = 6 * 60 * 60 * 1000; // ignore saved positions older than 6h
const PAN_THRESHOLD = 25; // m — minimum movement before re-panning

const MSG_LOCATION_OFF = "Location is off — allow it in your phone settings";

function readJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed.lat !== "number" ||
      typeof parsed.lng !== "number"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage blocked (private mode) — ignore */
  }
}

function distanceMeters(lat1, lng1, lat2, lng2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// pulsing blue dot — Google Maps style
const DOT_ICON = L.divIcon({
  className: "live-dot-icon",
  html: renderToStaticMarkup(
    <div className="live-dot">
      <span className="live-dot-pulse" />
    </div>,
  ),
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function LocationButton({ onMessage }) {
  const map = useMap();
  const [fix, setFix] = useState(null); // {lat, lng, accuracy}
  const [following, setFollowing] = useState(false);
  const [locating, setLocating] = useState(true);
  // bump to restart GPS tracking (after permission granted / button tap)
  const [attempt, setAttempt] = useState(0);

  const followRef = useRef(false);
  const lastPanRef = useRef(null);
  const lastMessageRef = useRef(null);

  useEffect(() => {
    followRef.current = following;
  }, [following]);

  // report through the GLOBAL channel (Map.jsx → MapNotices) —
  // never render our own notification. null clears the current one.
  function report(message) {
    if (message === lastMessageRef.current) return;
    lastMessageRef.current = message;
    onMessage?.(message);
  }

  // restore last camera view instantly — fixes "gone after refresh"
  useEffect(() => {
    const saved = readJSON(LS_VIEW_KEY);
    if (saved && Date.now() - (saved.t || 0) < MAX_FIX_AGE) {
      map.setView([saved.lat, saved.lng], saved.zoom || 15);
    }
    // show the blue dot from the last known fix right away, no waiting
    const savedFix = readJSON(LS_FIX_KEY);
    if (savedFix && Date.now() - (savedFix.t || 0) < MAX_FIX_AGE) {
      setFix({
        lat: savedFix.lat,
        lng: savedFix.lng,
        accuracy: savedFix.accuracy,
      });
    }
  }, [map]);

  // permission probe — one pill when location is refused, and the
  // moment the user enables location we clear it and start tracking
  useEffect(() => {
    if (!navigator.permissions?.query) return undefined;

    let status = null;

    navigator.permissions
      .query({ name: "geolocation" })
      .then((s) => {
        status = s;
        if (s.state === "denied") {
          setLocating(false);
          report(MSG_LOCATION_OFF);
        }
        s.onchange = () => {
          if (s.state === "granted") {
            report(null); // clear the pill
            setAttempt((a) => a + 1); // restart GPS → tracking starts
          }
        };
      })
      .catch(() => {
        /* Permissions API not supported — the watch errors handle it */
      });

    return () => {
      if (status) status.onchange = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // user grabbed the map → stop following (Google Maps behavior)
  useMapEvents({
    dragstart() {
      setFollowing(false);
    },
    moveend() {
      const center = map.getCenter();
      writeJSON(LS_VIEW_KEY, {
        lat: center.lat,
        lng: center.lng,
        zoom: map.getZoom(),
        t: Date.now(),
      });
    },
  });

  // live GPS — restarts whenever `attempt` changes
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocating(false);
      report("Your browser doesn't support geolocation");
      return;
    }

    let firstFix = true;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const next = { lat: latitude, lng: longitude, accuracy };
        setFix(next);
        writeJSON(LS_FIX_KEY, { ...next, t: Date.now() });
        // the pharmacy hook listens for this to refetch when you move
        window.dispatchEvent(
          new CustomEvent("live-fix", {
            detail: { lat: latitude, lng: longitude },
          }),
        );
        setLocating(false);
        report(null); // any location complaint is now resolved

        if (firstFix) {
          firstFix = false;
          setFollowing(true);
          lastPanRef.current = { lat: latitude, lng: longitude };
          map.flyTo([latitude, longitude], 16, { duration: 1.2 });
          return;
        }

        if (followRef.current && (accuracy ?? 0) <= BAD_FIX) {
          const last = lastPanRef.current;
          if (
            !last ||
            distanceMeters(last.lat, last.lng, latitude, longitude) >
              PAN_THRESHOLD
          ) {
            lastPanRef.current = { lat: latitude, lng: longitude };
            map.panTo([latitude, longitude], { animate: true, duration: 0.8 });
          }
        }
      },
      (err) => {
        setLocating(false);
        // PERMISSION_DENIED (code 1) → the single message for this problem.
        // Codes 2/3 (signal lost / timeout) stay silent — no spam.
        if (err?.code === 1) {
          report(MSG_LOCATION_OFF);
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 2000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [map, attempt]);

  function handleLocateClick() {
    setFollowing(true);
    // retry GPS — if permission is undecided this pops the native dialog
    setAttempt((a) => a + 1);
    if (fix) {
      lastPanRef.current = { lat: fix.lat, lng: fix.lng };
      map.flyTo([fix.lat, fix.lng], Math.max(map.getZoom(), 16), {
        duration: 1.0,
      });
    }
  }

  return (
    <>
      {fix && (fix.accuracy ?? 0) <= BAD_FIX && (
        <>
          <Circle
            center={[fix.lat, fix.lng]}
            radius={fix.accuracy}
            interactive={false}
            pathOptions={{
              color: "#1d4ed8",
              weight: 1,
              fillColor: "#1d4ed8",
              fillOpacity: 0.12,
            }}
          />
          <Marker
            position={[fix.lat, fix.lng]}
            icon={DOT_ICON}
            interactive={false}
            zIndexOffset={1000}
          />
        </>
      )}

      <div className="location-control">
        <button
          type="button"
          onClick={handleLocateClick}
          disabled={locating}
          aria-label="Find my location"
          title="Find my location"
        >
          {locating ? "…" : <LocateFixed size={22} strokeWidth={2.4} />}
        </button>
      </div>
    </>
  );
}

export default LocationButton;
