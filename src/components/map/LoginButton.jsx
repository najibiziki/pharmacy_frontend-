import { Link } from "react-router-dom";
import { LogIn } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import "./LoginButton.css";

export default function LoginButton() {
  const { user } = useAuth();

  if (user) return null;

  return (
    <Link to="/login" className="login-btn" aria-label="Login" title="Login">
      <LogIn size={20} strokeWidth={2.4} />
    </Link>
  );
}
