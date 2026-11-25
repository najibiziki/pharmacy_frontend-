import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./useAuth";
import api from "../services/api";

const CACHE_TTL = import.meta.env.DEV ? 10 * 1000 : 5 * 60 * 1000;
const pharmacyCache = new Map();

const FALLBACK = { lat: 31.6295, lng: -7.9811 }; // Marrakech center

// owners see distances for the 10 nearest pharmacies only
const MAX_OWNER_DISTANCES = 10;

// straight-line distance in meters (Haversine)
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
  // the position we actually used for the visitor fetch (null = no real fix)
  const [userCenter, setUserCenter] = useState(null);

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

  // ── nearby pharmacies around the USER's position (visitors & clients) ──
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
      setUserCenter(null);
      fetchPharmacies(FALLBACK.lat, FALLBACK.lng, true);
    } else {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (!active) return;
          setUserCenter({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          fetchPharmacies(position.coords.latitude, position.coords.longitude);
        },
        () => {
          if (!active) return;
          setUserCenter(null);
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

  // ── owners: when "show all" is ON, load pharmacies around MY pharmacy ──
  useEffect(() => {
    if (!showAll) return;
    if (!myPharmacy) return;
    const { latitude, longitude } = myPharmacy;
    if (latitude == null || longitude == null) return;

    let active = true;

    async function fetchAroundMyPharmacy() {
      const key = `${latitude.toFixed(4)},${longitude.toFixed(4)}|${
        userId || "guest"
      }`;
      const cached = pharmacyCache.get(key);
      if (cached && Date.now() - cached.time < CACHE_TTL) {
        if (active) setFetchedPharmacies(cached.data);
        return;
      }

      const controller = new AbortController();

      setLoading(true);
      try {
        const response = await api.get("/pharmacies/osm", {
          params: { lat: latitude, lng: longitude },
          signal: controller.signal,
        });

        const result = response.data;
        if (!result || !result.success || !Array.isArray(result.pharmacies))
          throw new Error("Invalid pharmacy data");

        pharmacyCache.set(key, { data: result.pharmacies, time: Date.now() });
        if (active) {
          setFetchedPharmacies(result.pharmacies);
          setError(null);
        }
      } catch (err) {
        const aborted =
          err?.name === "AbortError" || err?.code === "ERR_CANCELED";
        if (!aborted && active)
          setError(err?.message || "Something went wrong");
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchAroundMyPharmacy();

    return () => {
      active = false;
    };
  }, [
    showAll,
    myPharmacy?._id,
    myPharmacy?.latitude,
    myPharmacy?.longitude,
    userId,
  ]);

  // ── attach distances + owner ordering ──
  const pharmacies = useMemo(() => {
    // visitor / client: distance from MY position
    if (!myPharmacy) {
      if (!userCenter) return fetchedPharmacies;
      return fetchedPharmacies.map((p) => ({
        ...p,
        distanceM:
          p.latitude != null && p.longitude != null
            ? Math.round(
                distanceMeters(
                  userCenter.lat,
                  userCenter.lng,
                  p.latitude,
                  p.longitude,
                ),
              )
            : null,
      }));
    }

    if (myPharmacy.latitude == null || myPharmacy.longitude == null) {
      return fetchedPharmacies;
    }

    if (!showAll) return [myPharmacy];

    // mine + nearby, without a duplicate of mine and without
    // pharmacies that have no coordinates (they can't be placed)
    const others = fetchedPharmacies.filter(
      (p) =>
        (!p._id ||
          !myPharmacy._id ||
          String(p._id) !== String(myPharmacy._id)) &&
        p.latitude != null &&
        p.longitude != null,
    );

    // nearest to MY pharmacy first
    others.sort(
      (a, b) =>
        distanceMeters(
          myPharmacy.latitude,
          myPharmacy.longitude,
          a.latitude,
          a.longitude,
        ) -
        distanceMeters(
          myPharmacy.latitude,
          myPharmacy.longitude,
          b.latitude,
          b.longitude,
        ),
    );

    // owner: distance from MY pharmacy — only for the 10 nearest
    const withDistance = others.map((p, i) => ({
      ...p,
      distanceM:
        i < MAX_OWNER_DISTANCES
          ? Math.round(
              distanceMeters(
                myPharmacy.latitude,
                myPharmacy.longitude,
                p.latitude,
                p.longitude,
              ),
            )
          : null,
    }));

    return [myPharmacy, ...withDistance];
  }, [fetchedPharmacies, myPharmacy, showAll, userCenter]);

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
