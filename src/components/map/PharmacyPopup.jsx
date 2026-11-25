import { useEffect, useState } from "react";
import { Popup } from "react-leaflet";
import {
  MapPin,
  Navigation,
  Clock3,
  MessageCircle,
  ArrowUpRight,
  ShieldCheck,
  Phone,
  Cross,
  Pencil,
  Hourglass,
  CalendarCheck,
  Moon,
  Sun,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import api from "../../services/api";
import "./PharmacyPopup.css";

// garde hours — keep in sync with SCHEDULE_HOURS in models/Pharmacy.js
const SCHEDULE_HOURS = {
  garde: { open: "20:00", close: "08:00" }, // night duty, crosses midnight
  dayGarde: { open: "08:30", close: "20:00" }, // day duty
};

// 350 → "350 m", 1250 → "1.3 km" — pharmacy.distanceM comes from the hook
function formatDistance(meters) {
  if (meters == null || !Number.isFinite(meters)) return null;
  if (meters < 1000) return `${meters} m`;
  const km = meters / 1000;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

function timeToMinutes(value) {
  const match = String(value ?? "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function hasValidPair(openValue, closeValue) {
  return (
    timeToMinutes(openValue) !== null && timeToMinutes(closeValue) !== null
  );
}

// true/false — handles windows that cross midnight
function isWindowOpen(openValue, closeValue) {
  const open = timeToMinutes(openValue);
  const close = timeToMinutes(closeValue);
  if (open === null || close === null || open === close) return false;

  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();
  return open < close
    ? current >= open && current < close
    : current >= open || current < close;
}

// status for claimed pharmacies — follows the owner's schedule mode
function getScheduleStatus(pharmacy, scheduleTypeOverride) {
  const type = scheduleTypeOverride || pharmacy.scheduleType || "normal";

  if (type === "garde") {
    return isWindowOpen(SCHEDULE_HOURS.garde.open, SCHEDULE_HOURS.garde.close)
      ? "open"
      : "closed";
  }
  if (type === "dayGarde") {
    return isWindowOpen(
      SCHEDULE_HOURS.dayGarde.open,
      SCHEDULE_HOURS.dayGarde.close,
    )
      ? "open"
      : "closed";
  }

  // normal → MON–FRI only
  const day = new Date().getDay(); // 0 = Sunday … 6 = Saturday
  if (day < 1 || day > 5) return "closed";
  if (!hasValidPair(pharmacy.weekdayOpen, pharmacy.weekdayClose)) {
    return "unknown";
  }

  // morning window OR optional afternoon window
  const inMorning = isWindowOpen(pharmacy.weekdayOpen, pharmacy.weekdayClose);
  const inAfternoon =
    !!pharmacy.weekdayOpen2 &&
    !!pharmacy.weekdayClose2 &&
    isWindowOpen(pharmacy.weekdayOpen2, pharmacy.weekdayClose2);

  return inMorning || inAfternoon ? "open" : "closed";
}

// hours text shown in the popup — follows the mode automatically
function getScheduleDisplay(pharmacy, scheduleTypeOverride) {
  const type = scheduleTypeOverride || pharmacy.scheduleType || "normal";

  if (type === "garde") return "La garde: 20:00–08:00";
  if (type === "dayGarde") return "Day duty: 08:30–20:00";

  const morning = `${pharmacy.weekdayOpen || "08:30"}–${
    pharmacy.weekdayClose || "19:30"
  }`;

  // midday gap → "MON–FRI: 08:30–12:30 & 14:30–18:30"
  if (pharmacy.weekdayOpen2 && pharmacy.weekdayClose2) {
    return `MON–FRI: ${morning} & ${pharmacy.weekdayOpen2}–${pharmacy.weekdayClose2}`;
  }
  return `MON–FRI: ${morning}`;
}

// OSM string parser — kept for unclaimed pharmacies
function getPharmacyStatus(openingHours) {
  if (!openingHours) return "unknown";

  const now = new Date();
  let schedule = openingHours;

  if (typeof schedule === "object" && !Array.isArray(schedule)) {
    const days = [
      ["sunday", "sun"],
      ["monday", "mon"],
      ["tuesday", "tue"],
      ["wednesday", "wed"],
      ["thursday", "thu"],
      ["friday", "fri"],
      ["saturday", "sat"],
    ];

    const today = days[now.getDay()];
    const key = Object.keys(schedule).find((day) =>
      today.includes(day.toLowerCase()),
    );

    if (key) {
      schedule = schedule[key];
    } else if (!("open" in schedule) || !("close" in schedule)) {
      return "unknown";
    }
  }

  if (typeof schedule === "string") {
    if (/^\s*closed\s*$/i.test(schedule)) return "closed";

    const match = schedule.match(/(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})/);

    if (!match) return "unknown";
    schedule = { open: match[1], close: match[2] };
  }

  if (!schedule || typeof schedule !== "object" || Array.isArray(schedule)) {
    return "unknown";
  }

  const open = timeToMinutes(schedule.open);
  const close = timeToMinutes(schedule.close);

  if (open === null || close === null || open === close) return "unknown";

  const current = now.getHours() * 60 + now.getMinutes();
  const isOpen =
    open < close
      ? current >= open && current < close
      : current >= open || current < close;

  return isOpen ? "open" : "closed";
}

// "0611452536" → "212611452536" so wa.me links work for Moroccan numbers
function toWhatsappDigits(raw) {
  let digits = String(raw || "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = `212${digits.slice(1)}`;
  if (digits.length === 9) digits = `212${digits}`;
  return digits;
}

function PharmacyPopup({ pharmacy }) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const isClaimed = pharmacy.isClaimed === true;
  // a claim was submitted but the admin hasn't approved it yet
  const isPending = !isClaimed && pharmacy.claimStatus === "pending";

  const whatsappNumber = toWhatsappDigits(pharmacy.whatsapp || pharmacy.phone);
  const phoneNumber = String(pharmacy.phone || "").trim();
  const phoneLink = phoneNumber.replace(/[^\d+]/g, "");
  const address = String(pharmacy.address || "").trim();
  const openingHours = pharmacy.openingHours || pharmacy.opening_hours;

  const arabicName = pharmacy.nameAr || pharmacy.name_ar;
  const frenchName = pharmacy.nameFr || pharmacy.name_fr || pharmacy.name;
  const displayName = arabicName || frenchName || "Pharmacy";

  const distanceText = formatDistance(pharmacy.distanceM);

  // owner's schedule mode — switchable right here in the popup
  const [scheduleType, setScheduleType] = useState(
    pharmacy.scheduleType || "normal",
  );

  // keep the switch in sync when fresh map data arrives
  useEffect(() => {
    setScheduleType(pharmacy.scheduleType || "normal");
  }, [pharmacy._id, pharmacy.scheduleType]);

  // status + hours follow the SELECTED mode, so the owner sees them
  // change the instant they tap a duty button (Open/Closed badge included)
  const status = isClaimed
    ? getScheduleStatus(pharmacy, scheduleType)
    : getPharmacyStatus(openingHours);

  let hoursDisplay = null;
  if (isClaimed) {
    hoursDisplay = getScheduleDisplay(pharmacy, scheduleType);
  } else if (typeof openingHours === "string") {
    hoursDisplay = openingHours;
  } else if (openingHours) {
    hoursDisplay = "Schedule available";
  }

  async function changeScheduleType(next) {
    if (!pharmacy._id || next === scheduleType) return;
    const previous = scheduleType;
    setScheduleType(next); // switch instantly — hours + badge follow
    try {
      await api.patch(`/pharmacies/${pharmacy._id}`, { scheduleType: next });
    } catch (err) {
      setScheduleType(previous); // save failed — flip back
      alert(err.response?.data?.message || "Could not save.");
    }
  }

  // only the pharmacist who owns this pharmacy can see "Edit"
  const ownerId = pharmacy.owner?._id || pharmacy.owner;
  const userId = user?._id || user?.id;
  const isOwner =
    isClaimed && !!userId && !!ownerId && String(userId) === String(ownerId);

  function handleClaim() {
    const pharmacyId = pharmacy._id;

    if (!pharmacyId) {
      console.error("Cannot claim pharmacy: MongoDB _id is missing.", pharmacy);
      return;
    }

    const claimPath = `/claim-pharmacy/${pharmacyId}`;

    if (!user) {
      // login first — "Create account" is a link inside the login page
      navigate(
        `/login?pharmacyId=${encodeURIComponent(pharmacyId)}&redirect=${encodeURIComponent(claimPath)}`,
      );
    } else {
      navigate(claimPath);
    }
  }

  return (
    <Popup
      className="pharmacy-popup"
      closeButton={false}
      minWidth={220}
      maxWidth={280}
      autoPan
    >
      <article
        className="pharmacy-card"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="pharmacy-card-header">
          <div className="pharmacy-card-brand-icon" aria-hidden="true">
            <Cross size={20} strokeWidth={2.5} />
          </div>

          <div className="pharmacy-card-title">
            <span className="pharmacy-card-eyebrow">PHARMACY</span>
            <h3
              lang={arabicName ? "ar" : "fr"}
              dir={arabicName ? "rtl" : "ltr"}
            >
              {displayName}
            </h3>
            {arabicName && frenchName && (
              <p className="pharmacy-card-subtitle" lang="fr" dir="ltr">
                {frenchName}
              </p>
            )}
          </div>

          {isClaimed && (
            <span
              className="pharmacy-card-verified"
              title="Claimed pharmacy"
              aria-label="Claimed pharmacy"
            >
              <ShieldCheck size={19} />
            </span>
          )}
        </header>

        <div className="pharmacy-card-status-row">
          <span className={`pharmacy-card-status status-${status}`}>
            <span className="pharmacy-card-status-dot" />
            {status === "open"
              ? "Open now"
              : status === "closed"
                ? "Closed now"
                : "Hours unknown"}
          </span>
          {isClaimed && (
            <span className="pharmacy-card-listing-label">
              <ShieldCheck size={12} />
              Claimed
            </span>
          )}
          {isPending && (
            <span className="pharmacy-card-listing-label is-pending">
              <Hourglass size={12} />
              Under review
            </span>
          )}
        </div>

        <div className="pharmacy-card-info">
          <div className="pharmacy-card-detail pharmacy-card-address">
            <span className="pharmacy-card-detail-icon">
              <MapPin size={16} />
            </span>
            <div className="pharmacy-card-detail-content">
              <span className="pharmacy-card-detail-label">ADDRESS</span>
              <span className="pharmacy-card-detail-value">
                {address || "Address unavailable"}
              </span>
            </div>
          </div>

          {distanceText && (
            <div className="pharmacy-card-detail">
              <span className="pharmacy-card-detail-icon">
                <Navigation size={16} />
              </span>
              <div className="pharmacy-card-detail-content">
                <span className="pharmacy-card-detail-label">DISTANCE</span>
                <span className="pharmacy-card-detail-value">
                  {distanceText}
                </span>
              </div>
            </div>
          )}

          {hoursDisplay && (
            <div className="pharmacy-card-detail">
              <span className="pharmacy-card-detail-icon">
                <Clock3 size={16} />
              </span>
              <div className="pharmacy-card-detail-content">
                <span className="pharmacy-card-detail-label">
                  {isClaimed ? "WORK HOURS" : "OPENING HOURS"}
                </span>
                <span className="pharmacy-card-detail-value">
                  {hoursDisplay}
                </span>
              </div>
            </div>
          )}

          {phoneNumber && (
            <div className="pharmacy-card-detail">
              <span className="pharmacy-card-detail-icon">
                <Phone size={16} />
              </span>
              <div className="pharmacy-card-detail-content">
                <span className="pharmacy-card-detail-label">PHONE</span>
                <a
                  className="pharmacy-card-phone"
                  href={`tel:${phoneLink}`}
                  onClick={(event) => event.stopPropagation()}
                >
                  {phoneNumber}
                </a>
              </div>
            </div>
          )}
        </div>

        {isPending && (
          <div className="pharmacy-card-action claim-pending" role="status">
            <Hourglass size={17} />
            <span>Claim under review</span>
          </div>
        )}

        {!isPending && !isClaimed && pharmacy._id && (
          <button
            type="button"
            className="pharmacy-card-action claim-action"
            onClick={(event) => {
              event.stopPropagation();
              handleClaim();
            }}
          >
            <ShieldCheck size={17} />
            <span>Claim this pharmacy</span>
            <ArrowUpRight size={16} />
          </button>
        )}

        {isClaimed && whatsappNumber && (
          <a
            className="pharmacy-card-action whatsapp-action"
            href={`https://wa.me/${whatsappNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
          >
            <MessageCircle size={17} />
            <span>Chat on WhatsApp</span>
            <ArrowUpRight size={16} />
          </a>
        )}

        {isOwner && (
          <div className="pharmacy-card-owner-box">
            <span className="pharmacy-card-owner-title">
              WORK SCHEDULE — TAP TO SWITCH
            </span>
            <div className="pharmacy-schedule-row">
              <button
                type="button"
                className={
                  "pharmacy-duty-btn" + (scheduleType === "normal" ? " on" : "")
                }
                title="Normal — MON–FRI, my own hours"
                aria-label="Normal schedule"
                onClick={(event) => {
                  event.stopPropagation();
                  changeScheduleType("normal");
                }}
              >
                <CalendarCheck size={18} />
              </button>
              <button
                type="button"
                className={
                  "pharmacy-duty-btn" + (scheduleType === "garde" ? " on" : "")
                }
                title="La garde — night duty 20:00–08:00"
                aria-label="La garde night duty"
                onClick={(event) => {
                  event.stopPropagation();
                  changeScheduleType("garde");
                }}
              >
                <Moon size={18} />
              </button>
              <button
                type="button"
                className={
                  "pharmacy-duty-btn" +
                  (scheduleType === "dayGarde" ? " on" : "")
                }
                title="Day duty — 08:30–20:00"
                aria-label="Day duty"
                onClick={(event) => {
                  event.stopPropagation();
                  changeScheduleType("dayGarde");
                }}
              >
                <Sun size={18} />
              </button>
            </div>
          </div>
        )}

        {isOwner && (
          <button
            type="button"
            className="pharmacy-card-action edit-action"
            onClick={(event) => {
              event.stopPropagation();
              navigate("/pharmacy/dashboard");
            }}
          >
            <Pencil size={17} />
            <span>Edit my pharmacy</span>
          </button>
        )}

        {isClaimed && (
          <div className="pharmacy-card-footer">
            <ShieldCheck size={13} />
            <span>Pharmacy listing claimed</span>
          </div>
        )}
      </article>
    </Popup>
  );
}

export default PharmacyPopup;
