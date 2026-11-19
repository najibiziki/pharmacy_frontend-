import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import "./PharmacyDetails.css";
import ClaimCard from "../../components/admin/ClaimCard";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

function getAuthHeaders() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function AdminPharmacyDetails() {
  const { id } = useParams();
  const [pharmacy, setPharmacy] = useState(null);
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/admin/pharmacies/${id}`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load.");
      setPharmacy(data.pharmacy);
      setClaims(data.claims || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

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
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  if (loading)
    return (
      <main className="adm-page">
        <div className="adm-loading">Loading…</div>
      </main>
    );

  if (!pharmacy)
    return (
      <main className="adm-page">
        <div className="adm-empty">{error || "Pharmacy not found."}</div>
      </main>
    );

  return (
    <main className="adm-page">
      <Link to="/admin/pharmacies" className="adm-back">
        ← All pharmacies
      </Link>

      <header className="adm-detail-head">
        <h1>{pharmacy.name || "Unnamed pharmacy"}</h1>
        {pharmacy.isClaimed ? (
          <span className="adm-badge claimed">claimed</span>
        ) : (
          <span className="adm-badge unclaimed">unclaimed</span>
        )}
      </header>

      <section className="adm-card" style={{ marginBottom: 24 }}>
        <div className="adm-card-info">
          <dl>
            <div>
              <dt>Phone</dt>
              <dd>{pharmacy.phone || "—"}</dd>
            </div>
            <div>
              <dt>Opening hours</dt>
              <dd>{pharmacy.opening_hours || "—"}</dd>
            </div>
          </dl>
        </div>
      </section>

      <h2 className="adm-sub">Claims</h2>

      {error && <div className="adm-error">{error}</div>}

      {claims.length === 0 ? (
        <div className="adm-empty">No claims for this pharmacy.</div>
      ) : (
        <div className="adm-list">
          {claims.map((claim) => (
            <ClaimCard
              key={claim._id}
              claim={claim}
              busy={busyId === claim._id}
              onReview={review}
            />
          ))}
        </div>
      )}
    </main>
  );
}
