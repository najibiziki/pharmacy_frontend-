import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ShieldCheck,
  MapPin,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import api from "../../services/api";
import "./ClaimPharmacy.css";

export default function ClaimPharmacy() {
  const { pharmacyId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [pharmacy, setPharmacy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({
    fullName: "",
    personalPhone: "",
    licenseNumber: "",
  });
  const [files, setFiles] = useState({ license: null, storefront: null });
  const [submit, setSubmit] = useState({
    busy: false,
    done: false,
    reference: null,
    error: null,
  });

  useEffect(() => {
    if (!user) {
      navigate(
        `/register?pharmacyId=${pharmacyId}&redirect=${encodeURIComponent(
          `/claim-pharmacy/${pharmacyId}`,
        )}`,
        { replace: true },
      );
    }
  }, [user, pharmacyId, navigate]);

  // after successful submit: show confirmation 3s, then back to the map
  useEffect(() => {
    if (!submit.done) return;
    const timer = setTimeout(() => navigate("/", { replace: true }), 3000);
    return () => clearTimeout(timer);
  }, [submit.done, navigate]);

  useEffect(() => {
    let active = true;
    api
      .get(`/pharmacies/${pharmacyId}`)
      .then(({ data }) => {
        if (!active) return;
        if (!data.success)
          throw new Error(data.message || "Pharmacy not found.");
        setPharmacy(data.pharmacy);
      })
      .catch((err) => {
        if (active)
          setError(err.response?.data?.message || "Pharmacy not found.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [pharmacyId]);

  const setF = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const valid =
    form.fullName.trim().length >= 3 &&
    form.personalPhone.replace(/\D/g, "").length >= 9 &&
    form.licenseNumber.trim().length >= 3 &&
    files.license &&
    files.storefront;

  async function submitClaim() {
    setSubmit((s) => ({ ...s, busy: true, error: null }));
    try {
      const fd = new FormData();
      fd.append("fullName", form.fullName.trim());
      fd.append("personalPhone", form.personalPhone.replace(/\D/g, ""));
      fd.append("licenseNumber", form.licenseNumber.trim());
      fd.append("verificationMethod", "documents");
      fd.append("license", files.license);
      fd.append("storefront", files.storefront);

      const { data } = await api.post(`/pharmacies/${pharmacyId}/claims`, fd);
      if (!data.success) throw new Error(data.message || "Submission failed.");

      setSubmit({
        busy: false,
        done: true,
        reference: data.claim?.reference || null,
        error: null,
      });
    } catch (err) {
      setSubmit((s) => ({
        ...s,
        busy: false,
        error: err.response?.data?.message || "Submission failed. Try again.",
      }));
    }
  }

  if (!user || loading)
    return (
      <div className="cl-page cl-center">
        <Loader2 className="cl-spin" size={28} />
      </div>
    );

  if (submit.done)
    return (
      <div className="cl-page cl-center">
        <CheckCircle2 size={44} color="#16a34a" />
        <h2>Claim submitted!</h2>
        <p className="cl-sub">
          We'll verify your documents and call you on {form.personalPhone} if
          needed.
          {submit.reference ? ` Reference: #${submit.reference}` : ""}
        </p>
        <p className="cl-sub">Taking you back to the map…</p>
        <button
          className="cl-btn"
          onClick={() => navigate("/", { replace: true })}
        >
          Back to map now
        </button>
      </div>
    );

  if (error && !pharmacy)
    return (
      <div className="cl-page cl-center">
        <AlertTriangle size={30} color="#dc2626" />
        <p>{error}</p>
        <button className="cl-btn" onClick={() => navigate("/")}>
          Back to map
        </button>
      </div>
    );

  if (pharmacy?.isClaimed)
    return (
      <div className="cl-page cl-center">
        <ShieldCheck size={36} color="#16a34a" />
        <h2>Already claimed</h2>
        <button className="cl-btn" onClick={() => navigate("/")}>
          Back to map
        </button>
      </div>
    );

  return (
    <div className="cl-page">
      <div className="cl-card">
        <div className="cl-confirm">
          <ShieldCheck size={22} />
          <div>
            <span>YOU ARE CLAIMING</span>
            <h1>{pharmacy?.name}</h1>
            {pharmacy?.address && (
              <p>
                <MapPin size={12} /> {pharmacy.address}
              </p>
            )}
          </div>
        </div>

        {error && <div className="cl-alert">{error}</div>}

        <label>Full name</label>
        <input
          value={form.fullName}
          onChange={(e) => setF("fullName", e.target.value)}
          placeholder="Youssef El Amrani"
        />

        <label>Your mobile</label>
        <input
          value={form.personalPhone}
          onChange={(e) => setF("personalPhone", e.target.value)}
          placeholder="06 12 34 56 78"
          inputMode="tel"
        />

        <label>
          Autorisation d'exercice n° <small>(on your license)</small>
        </label>
        <input
          value={form.licenseNumber}
          onChange={(e) => setF("licenseNumber", e.target.value)}
          placeholder="Ex: 123/45/678"
        />

        <label>
          License photo <small>— Autorisation d'exercice</small>
        </label>
        <input
          type="file"
          accept="image/*,.pdf"
          onChange={(e) =>
            setFiles((f) => ({ ...f, license: e.target.files[0] }))
          }
        />

        <label>Storefront photo</label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) =>
            setFiles((f) => ({ ...f, storefront: e.target.files[0] }))
          }
        />

        <button
          className="cl-btn cl-primary"
          disabled={!valid || submit.busy}
          onClick={submitClaim}
        >
          {submit.busy ? (
            <Loader2 className="cl-spin" size={16} />
          ) : (
            <ShieldCheck size={16} />
          )}{" "}
          Submit claim
        </button>

        {submit.error && <div className="cl-alert">{submit.error}</div>}
      </div>
    </div>
  );
}
