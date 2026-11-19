import { useEffect, useState } from "react";
import "./ClaimsAdmin.css";
import ClaimCard from "../../components/admin/ClaimCard";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

function getAuthHeaders() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function ClaimsAdmin() {
  const [status, setStatus] = useState("pending");
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(
          `${API_URL}/api/admin/claims?status=${status}`,
          {
            headers: getAuthHeaders(),
          },
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to load claims.");
        if (!cancelled) setClaims(data.claims || []);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);

  async function review(claimId, action) {
    setBusyId(claimId);
    setError("");
    try {
      const res = await fetch(
        `${API_URL}/api/admin/claims/${claimId}/${action}`,
        {
          method: "PATCH",
          headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Action failed.");
      setClaims((prev) => prev.filter((c) => c._id !== claimId));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="adm-page">
      <header className="adm-head">
        <h1>Claims review</h1>
        <div className="adm-tabs">
          {["pending", "approved", "rejected"].map((s) => (
            <button
              key={s}
              className={`adm-tab ${status === s ? "active" : ""}`}
              onClick={() => setStatus(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </header>

      {error && <div className="adm-error">{error}</div>}

      {loading ? (
        <div className="adm-loading">Loading…</div>
      ) : claims.length === 0 ? (
        <div className="adm-empty">No {status} claims.</div>
      ) : (
        <div className="adm-list">
          {claims.map((claim) => (
            <ClaimCard
              key={claim._id}
              claim={claim}
              showPharmacy
              busy={busyId === claim._id}
              onReview={review}
            />
          ))}
        </div>
      )}
    </main>
  );
}
