import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./useAuth";
import api from "../services/api";

const CACHE_TTL = import.meta.env.DEV ? 10 * 1000 : 5 * 60 * 1000;
const pharmacyCache = new Map();

const FALLBACK = { lat: 31.6295, lng: -7.9811 }; // Marrakech center

// /mine returns a raw pharmacy doc — reshape it to the same shape the
// map endpoint uses, so markers and popups work with both
function normalizeMinePharmacy(p) {
  const type = p.scheduleType || "normal";
  return {
    id: `osm-${p.osmType}-${p.osmId}`,
    _id: p._id ? String(p._id) : undefined,
    name: p.name,
    address: p.address,
    latitude: p.location?.coordinates?.[1] ?? null,
    longitude: p.location?.coordinates?.[0] ?? null,
    source: p.source,
    openingHours: p.openingHours,
    isOpenNow: p.isOpenNow,
    scheduleType: type,
    weekdayOpen: p.weekdayOpen || null,
    weekdayClose: p.weekdayClose || null,
    weekdayOpen2: p.weekdayOpen2 || null,
    weekdayClose2: p.weekdayClose2 || null,
    displayHours:
      type === "garde"
        ? "20:00–08:00"
        : type === "dayGarde"
          ? "08:30–20:00"
          : `MON–FRI: ${p.weekdayOpen || "08:30"}–${p.weekdayClose || "19:30"}`,
    isClaimed: p.isClaimed === true,
    claimStatus: p.claimStatus || null,
    phone: p.phone || null,
    owner: p.owner || null,
  };
}

function useOsmPharmacies() {
  const { user, restoring } = useAuth();
  const [fetchedPharmacies, setFetchedPharmacies] = useState([]);
  const [myPharmacy, setMyPharmacy] = useState(null);
  const [showAll, setShowAll] = useState(false); // owner default: mine only
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const userId = user?._id || user?.id || null;
  const hasUser = !!user;

  // ── MY pharmacy — fetched with the token, so it survives refresh ──
  useEffect(() => {
    let active = true;

    if (!hasUser) {
      setMyPharmacy(null);
      return;
    }

    api
      .get("/pharmacies/mine")
      .then((response) => {
        if (!active) return;
        const pharmacy = response.data?.pharmacy;
        setMyPharmacy(pharmacy ? normalizeMinePharmacy(pharmacy) : null);
      })
      .catch(() => {
        if (active) setMyPharmacy(null);
      });

    return () => {
      active = false;
    };
  }, [hasUser]);

  const controllerRef = useRef(null);

  // ── nearby pharmacies (visitors & clients; also used by the owner toggle) ──
  useEffect(() => {
    if (restoring) return;

    let active = true;

    async function fetchPharmacies(lat, lng, fallbackUsed = false) {
      const key = `${lat.toFixed(4)},${lng.toFixed(4)}|${userId || "guest"}`;
      const cached = pharmacyCache.get(key);

      if (cached && Date.now() - cached.time < CACHE_TTL) {
        if (active) {
          setFetchedPharmacies(cached.data);
          if (fallbackUsed)
            setNotice(
              "We couldn't use your location — showing pharmacies in Marrakech.",
            );
        }
        setLoading(false);
        return;
      }

      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;

      let chained = false;

      try {
        const response = await api.get("/pharmacies/osm", {
          params: { lat, lng },
          signal: controller.signal,
        });

        const result = response.data;
        if (!result || !result.success || !Array.isArray(result.pharmacies))
          throw new Error("Invalid pharmacy data");

        if (!fallbackUsed && result.pharmacies.length === 0) {
          chained = true;
          fetchPharmacies(FALLBACK.lat, FALLBACK.lng, true);
          return;
        }

        if (active) {
          pharmacyCache.set(key, { data: result.pharmacies, time: Date.now() });
          setFetchedPharmacies(result.pharmacies);
          setError(null);
          if (fallbackUsed)
            setNotice(
              "We couldn't use your location — showing pharmacies in Marrakech.",
            );
        }
      } catch (err) {
        const aborted =
          err?.name === "AbortError" || err?.code === "ERR_CANCELED";
        if (!aborted && active)
          setError(err?.message || "Something went wrong");
      } finally {
        if (active && !chained && controllerRef.current === controller) {
          controllerRef.current = null;
          setLoading(false);
        }
      }
    }

    if (!navigator.geolocation) {
      fetchPharmacies(FALLBACK.lat, FALLBACK.lng, true);
    } else {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (!active) return;
          fetchPharmacies(position.coords.latitude, position.coords.longitude);
        },
        () => {
          if (!active) return;
          fetchPharmacies(FALLBACK.lat, FALLBACK.lng, true);
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
      );
    }

    return () => {
      active = false;
      controllerRef.current?.abort();
    };
  }, [userId, hasUser, restoring]);

  // ── owners: mine only by default, or mine + nearby when toggled ──
  const pharmacies = useMemo(() => {
    if (!myPharmacy) return fetchedPharmacies;

    if (myPharmacy.latitude == null || myPharmacy.longitude == null) {
      return fetchedPharmacies;
    }

    if (!showAll) return [myPharmacy];

    // mine + nearby, without a duplicate of mine
    const others = fetchedPharmacies.filter(
      (p) =>
        !p._id || !myPharmacy._id || String(p._id) !== String(myPharmacy._id),
    );
    return [myPharmacy, ...others];
  }, [fetchedPharmacies, myPharmacy, showAll]);

  return {
    pharmacies,
    myPharmacy,
    showAll,
    setShowAll,
    loading,
    error,
    notice,
  };
}

export default useOsmPharmacies;
