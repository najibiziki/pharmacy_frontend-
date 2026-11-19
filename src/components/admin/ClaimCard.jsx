import "./ClaimCard.css";
export default function ClaimCard({
  claim,
  showPharmacy = false,
  busy = false,
  onReview,
}) {
  const license = claim.documents?.license?.url;
  const storefront = claim.documents?.storefront?.url;
  const pending = claim.status === "pending";

  return (
    <article className="adm-card">
      <div className="adm-card-info">
        {showPharmacy ? (
          <>
            <h2>{claim.pharmacyId?.name || "Pharmacy"}</h2>
            <p className="adm-ref">{claim.reference}</p>
          </>
        ) : (
          <h2>
            {claim.reference}{" "}
            <span className={`adm-badge ${claim.status}`}>{claim.status}</span>
          </h2>
        )}
        <dl>
          <div>
            <dt>Claimant</dt>
            <dd>{claim.fullName}</dd>
          </div>
          <div>
            <dt>Phone</dt>
            <dd>{claim.personalPhone}</dd>
          </div>
          <div>
            <dt>License</dt>
            <dd>{claim.licenseNumber}</dd>
          </div>
          <div>
            <dt>Account</dt>
            <dd>
              {claim.userId?.name} · {claim.userId?.email}
            </dd>
          </div>
          <div>
            <dt>Submitted</dt>
            <dd>{new Date(claim.createdAt).toLocaleDateString()}</dd>
          </div>
        </dl>
      </div>

      {(license || storefront) && (
        <div className="adm-card-docs">
          {license && (
            <a href={license} target="_blank" rel="noreferrer">
              <img src={license} alt="License" />
            </a>
          )}
          {storefront && (
            <a href={storefront} target="_blank" rel="noreferrer">
              <img src={storefront} alt="Storefront" />
            </a>
          )}
        </div>
      )}

      {pending && onReview && (
        <div className="adm-card-actions">
          <button
            className="adm-approve"
            disabled={busy}
            onClick={() => onReview(claim._id, "approve")}
          >
            {busy ? "…" : "Approve"}
          </button>
          <button
            className="adm-reject"
            disabled={busy}
            onClick={() => onReview(claim._id, "reject")}
          >
            Reject
          </button>
        </div>
      )}
    </article>
  );
}
