import { Link } from "@tanstack/react-router";

export function AuthRequired({ title, message }: { title: string; message: string }) {
  return (
    <div className="mobile-empty-state">
      <div className="mobile-card mobile-card-spaced">
        <span className="section-label">{title}</span>
        <strong>{message}</strong>
        <Link to="/auth" className="button button-primary">
          Sign in
        </Link>
      </div>
    </div>
  );
}
