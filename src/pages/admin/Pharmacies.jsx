import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Pharmacies.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

function getAuthHeaders() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function AdminPharmacies() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [pharmacies, setPharmacies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(
          `${API_URL}/api/admin/pharmacies?search=${encodeURIComponent(
            search,
          )}&status=${status}`,
          { headers: getAuthHeaders() },
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to load.");
        setPharmacies(data.pharmacies || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [search, status]);

  return (
    <main className="adm-page">
      <header className="adm-head">
        <h1>Pharmacies</h1>
        <input
          className="adm-search"
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </header>

      <div className="adm-tabs" style={{ marginBottom: 20 }}>
        {["all", "pending", "claimed", "unclaimed"].map((s) => (
          <button
            key={s}
            className={`adm-tab ${status === s ? "active" : ""}`}
            onClick={() => setStatus(s)}
          >
            {s}
          </button>
        ))}
      </div>

      {error && <div className="adm-error">{error}</div>}

      {loading ? (
        <div className="adm-loading">Loading…</div>
      ) : pharmacies.length === 0 ? (
        <div className="adm-empty">No pharmacies found.</div>
      ) : (
        <div className="adm-rows">
          {pharmacies.map((p) => (
            <button
              key={p._id}
              className="adm-row"
              onClick={() => navigate(`/admin/pharmacies/${p._id}`)}
            >
              <span className="adm-row-name">
                {p.name || "Unnamed pharmacy"}
              </span>
              {p.pendingClaim ? (
                <span className="adm-badge pending">
                  new claim · {p.pendingClaim.reference}
                </span>
              ) : p.isClaimed ? (
                <span className="adm-badge claimed">claimed</span>
              ) : (
                <span className="adm-badge unclaimed">unclaimed</span>
              )}
            </button>
          ))}
        </div>
      )}
    </main>
  );
}
