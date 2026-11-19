import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import "./Register.css";

export default function Register() {
  const navigate = useNavigate();
  const location = useLocation();
  const { register } = useAuth();

  const searchParams = new URLSearchParams(location.search);
  const redirect = searchParams.get("redirect");

  const pharmacyIdFromRedirect = redirect?.match(
    /^\/claim-pharmacy\/([a-f\d]{24})$/i,
  )?.[1];

  const pharmacyId =
    searchParams.get("pharmacyId") ||
    location.state?.pharmacyId ||
    pharmacyIdFromRedirect ||
    null;

  const destination =
    redirect?.startsWith("/") && !redirect.startsWith("//")
      ? redirect
      : pharmacyId
        ? `/claim-pharmacy/${pharmacyId}`
        : "/";

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
    if (error) setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const name = formData.name.trim();
    const email = formData.email.trim().toLowerCase();
    const { password, confirmPassword } = formData;

    if (!name || !email || !password || !confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }
    if (name.length > 100) {
      setError("Your name must not exceed 100 characters.");
      return;
    }
    if (password.length < 8 || password.length > 72) {
      setError("Password must be between 8 and 72 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await register({
        name,
        email,
        password,
        ...(pharmacyId ? { pharmacyId } : {}),
      });

      navigate(destination, { replace: true });
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Registration failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  const loginUrl =
    destination === "/"
      ? "/login"
      : `/login?redirect=${encodeURIComponent(destination)}`;

  return (
    <main className="register-page">
      <section className="register-card">
        <Link to="/" className="register-brand">
          <span className="register-brand-icon" aria-hidden="true">
            +
          </span>
          <span>Pharmacy Finder</span>
        </Link>

        <header className="register-heading">
          <h1>Create your account</h1>
          <p>
            {pharmacyId
              ? "Create your account to continue claiming this pharmacy."
              : "Join Pharmacy Finder to get started."}
          </p>
        </header>

        {error && (
          <div className="register-error" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="register-form-group">
            <label htmlFor="name">Full name</label>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              placeholder="Enter your full name"
              value={formData.name}
              onChange={handleChange}
              maxLength={100}
              required
              disabled={loading}
            />
          </div>

          <div className="register-form-group">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={handleChange}
              maxLength={254}
              required
              disabled={loading}
            />
          </div>

          <div className="register-form-group">
            <label htmlFor="password">Password</label>
            <div className="register-password-field">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={formData.password}
                onChange={handleChange}
                minLength={8}
                maxLength={72}
                required
                disabled={loading}
              />
              <button
                type="button"
                className="register-password-toggle"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                disabled={loading}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div className="register-form-group">
            <label htmlFor="confirmPassword">Confirm password</label>
            <div className="register-password-field">
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Enter your password again"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                disabled={loading}
              />
              <button
                type="button"
                className="register-password-toggle"
                onClick={() => setShowConfirmPassword((value) => !value)}
                aria-label={
                  showConfirmPassword ? "Hide password" : "Show password"
                }
                disabled={loading}
              >
                {showConfirmPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <button type="submit" className="register-submit" disabled={loading}>
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="register-footer">
          Already have an account? <Link to={loginUrl}>Sign in</Link>
        </p>
        <p className="register-note">
          By creating an account, you agree to use the service responsibly.
        </p>
      </section>
    </main>
  );
}
