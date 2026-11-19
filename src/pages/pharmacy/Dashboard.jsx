import { useEffect, useState } from "react";
import api from "../../services/api";
import { Cross } from "lucide-react";
import "./Dashboard.css";

const EMPTY = {
  name: "",
  address: "",
  openingHours: "",
  phone: "",
  scheduleType: "normal",
  weekdayOpen: "08:30",
  weekdayClose: "19:30",
  weekdayOpen2: "",
  weekdayClose2: "",
};

const SCHEDULE_OPTIONS = [
  { value: "normal", label: "Normal — MON–FRI, my own hours" },
  { value: "garde", label: "La garde — night duty 20:00–08:00" },
  { value: "dayGarde", label: "Day duty — 08:30–20:00" },
];

export default function Dashboard() {
  const [pharmacyId, setPharmacyId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api
      .get("/pharmacies/mine")
      .then(({ data }) => {
        if (!active) return;
        if (!data.pharmacy) throw new Error("none");
        const p = data.pharmacy;
        setPharmacyId(p._id);
        setForm({
          name: p.name || "",
          address: p.address || "",
          openingHours: p.openingHours || "",
          phone: p.phone || "",
          scheduleType: p.scheduleType || "normal",
          weekdayOpen: p.weekdayOpen || "08:30",
          weekdayClose: p.weekdayClose || "19:30",
          weekdayOpen2: p.weekdayOpen2 || "",
          weekdayClose2: p.weekdayClose2 || "",
        });
      })
      .catch(() => {
        if (!active) return;
        setError("No pharmacy linked to your account yet.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await api.patch(`/pharmacies/${pharmacyId}`, form);
      setMessage("Saved ✓");
    } catch (err) {
      setError(err.response?.data?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p style={{ padding: 40 }}>Loading…</p>;

  if (!pharmacyId)
    return (
      <div style={{ padding: 40 }}>
        <p className="dash-error">{error}</p>
        <p className="dash-subtitle">
          Once the admin approves your claim, your pharmacy will appear here.
        </p>
      </div>
    );

  return (
    <div className="dash-page">
      <header className="dash-header">
        <div className="dash-header-icon">
          <Cross size={24} strokeWidth={2.5} />
        </div>
        <div>
          <h1 className="dash-title">{form.name || "My Pharmacy"}</h1>
          <p className="dash-subtitle">Update your pharmacy information</p>
        </div>
      </header>

      <form onSubmit={handleSubmit}>
        <div className="dash-body">
          {error && <p className="dash-error">{error}</p>}
          {message && <p className="dash-message">{message}</p>}

          <p className="dash-section">GENERAL INFO</p>

          <div className="dash-field">
            <label className="dash-label">Pharmacy name</label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Pharmacy name"
              className="dash-input"
              required
            />
          </div>

          <div className="dash-field">
            <label className="dash-label">Address</label>
            <input
              name="address"
              value={form.address}
              onChange={handleChange}
              placeholder="Street, city"
              className="dash-input"
            />
          </div>

          <p className="dash-section">HOURS &amp; CONTACT</p>

          <div className="dash-field">
            <label className="dash-label">Opening hours (OSM reference)</label>
            <input
              name="openingHours"
              value={form.openingHours}
              onChange={handleChange}
              placeholder="Mo-Sa 09:00-19:00"
              className="dash-input"
            />
          </div>

          <div className="dash-field">
            <label className="dash-label">Phone</label>
            <input
              name="phone"
              value={form.phone}
              onChange={handleChange}
              placeholder="06 12 34 56 78"
              className="dash-input"
            />
          </div>

          <p className="dash-section">WORK SCHEDULE</p>

          {SCHEDULE_OPTIONS.map((opt) => (
            <div
              key={opt.value}
              className={
                "dash-switch-row" +
                (form.scheduleType === opt.value ? " on" : "")
              }
            >
              <span>{opt.label}</span>
              <label className="dash-switch">
                <input
                  type="radio"
                  name="scheduleType"
                  value={opt.value}
                  checked={form.scheduleType === opt.value}
                  onChange={handleChange}
                />
                <span className="dash-slider" />
              </label>
            </div>
          ))}

          {form.scheduleType === "normal" && (
            <>
              <div className="dash-field">
                <label className="dash-label">Morning (MON–FRI)</label>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="time"
                    name="weekdayOpen"
                    value={form.weekdayOpen}
                    onChange={handleChange}
                    className="dash-input"
                  />
                  <span>→</span>
                  <input
                    type="time"
                    name="weekdayClose"
                    value={form.weekdayClose}
                    onChange={handleChange}
                    className="dash-input"
                  />
                </div>
              </div>

              <div className="dash-field">
                <label className="dash-label">
                  Afternoon (optional — leave empty for no midday gap)
                </label>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="time"
                    name="weekdayOpen2"
                    value={form.weekdayOpen2}
                    onChange={handleChange}
                    className="dash-input"
                  />
                  <span>→</span>
                  <input
                    type="time"
                    name="weekdayClose2"
                    value={form.weekdayClose2}
                    onChange={handleChange}
                    className="dash-input"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <div className="dash-footer">
          <button type="submit" disabled={saving} className="dash-button">
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
