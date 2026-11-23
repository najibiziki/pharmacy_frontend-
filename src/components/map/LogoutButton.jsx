import { LogOut } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import "./LogoutButton.css";

export default function LogoutButton() {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <button
      type="button"
      className="logout-btn"
      aria-label="Logout"
      title="Logout"
      onClick={() => logout()}
    >
      <LogOut size={20} strokeWidth={2.4} />
    </button>
  );
}
