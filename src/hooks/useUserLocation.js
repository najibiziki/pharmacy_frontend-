import { useEffect, useRef, useState } from "react";

const GOOD_ENOUGH = 30; // meters — stop refining once this accurate
const MAX_WAIT = 20000; // stop refining after 20s
const BAD_FIX = 2000; // meters — warn when fix is worse than this

export default function useUserLocation() {
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const watchIdRef = useRef(null);

  function stop() {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }

  // cancel the watch if the map unmounts
  useEffect(() => stop, []);

  function detectLocation() {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser.");
      return;
    }

    stop(); // cancel any previous watch
    setLoading(true);
    setError("");
    setLocation(null);

    const startedAt = Date.now();

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;

        // show the fix right away, keep refining behind the scenes
        setLocation({ latitude, longitude, accuracy });

        if (accuracy <= GOOD_ENOUGH || Date.now() - startedAt > MAX_WAIT) {
          stop();
          setLoading(false);
          if (accuracy > BAD_FIX) {
            setError(
              `Location is imprecise (±${Math.round(accuracy)}m) — your PC has no GPS. Try on your phone.`,
            );
          }
        }
      },
      (err) => {
        stop();
        const messages = {
          1: "Permission denied — allow location access in your browser.",
          2: "Position unavailable — try again outside or near a window.",
          3: "Timed out — try again.",
        };
        setError(messages[err.code] || "Could not detect your location.");
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 0,
      },
    );
  }

  return { location, loading, error, detectLocation };
}
