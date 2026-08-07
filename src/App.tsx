import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Route, Routes, useNavigate } from "react-router-dom";
import type { User } from "oidc-client-ts";
import { useAuth } from "./AuthProvider";
import { authManager, runtimeAuthConfig } from "./auth";
import "./App.css";

const DISCOVERY_URL = `${runtimeAuthConfig.authority}/.well-known/openid-configuration`;

function App() {
  return (
    <Routes>
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/logout/callback" element={<LogoutCallback />} />
      <Route path="/callback" element={<AuthCallback />} />
      <Route path="/" element={<Home />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function Home() {
  const { user, profile, loading, error, login, logout } = useAuth();

  return (
    <Shell
      status={
        loading
          ? { label: "Checking session", tone: "neutral" }
          : user
            ? { label: "Authenticated", tone: "good" }
            : { label: "Signed out", tone: "neutral" }
      }
    >
      {loading ? (
        <Card>
          <LoadingState title="Loading session" subtitle="Verifying tokens and session state." />
        </Card>
      ) : user ? (
        <TokenView user={user} profile={profile} onLogout={logout} />
      ) : (
        <LoginView onLogin={login} error={error} />
      )}
    </Shell>
  );
}

function AuthCallback() {
  const navigate = useNavigate();
  const { handleCallback } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;
    handleCallback()
      .then(() => {
        navigate("/", { replace: true });
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Login failed.");
      });
  }, [handleCallback, navigate]);

  return (
    <Shell status={{ label: "Finalizing login", tone: "neutral" }}>
      <Card className="card-hero">
        {error ? (
          <div className="stack">
            <div className="card-header">
              <span className="badge badge-error">
                <Icon name="x-circle" size={14} /> Authentication error
              </span>
              <h2 className="card-title">We couldn&apos;t finish signing you in.</h2>
              <p className="muted">{error}</p>
            </div>
            <div className="button-row">
              <button className="button ghost" onClick={() => navigate("/", { replace: true })}>
                Back to login
                <span className="btn-arrow">&rarr;</span>
              </button>
            </div>
          </div>
        ) : (
          <LoadingState title="Completing sign-in" subtitle="Processing the authorization response." />
        )}
      </Card>
    </Shell>
  );
}

function LogoutCallback() {
  useEffect(() => {
    authManager.removeUser().catch(() => undefined);
  }, []);

  return (
    <Shell status={{ label: "Signed out", tone: "neutral" }}>
      <Card className="card-hero">
        <div className="card-header">
          <span className="badge badge-neutral">Session ended</span>
          <h2 className="card-title">Successfully signed out</h2>
          <p className="muted">
            Local browser state cleared. The identity provider has redirected back to the
            configured post-logout route.
          </p>
        </div>
        <div className="button-row">
          <a className="button primary" href="/login" onClick={(event) => {
            event.preventDefault();
            void authManager.signinRedirect();
          }}>
            Sign in again
            <span className="btn-arrow">&rarr;</span>
          </a>
          <span className="helper">Redirects to the identity provider.</span>
        </div>
      </Card>

      <Card>
        <SectionHeader
          icon="server"
          title="Session state"
          description="Browser-stored user state has been removed before rendering this page."
        />
        <div className="stack">
          <div>
            <span className="eyebrow">Post-logout URI</span>
            <p className="muted">{runtimeAuthConfig.postLogoutRedirectUri}</p>
          </div>
        </div>
      </Card>
    </Shell>
  );
}

function LoginView({ onLogin, error }: { onLogin: () => Promise<void>; error: string | null }) {
  return (
    <div className="stack">
      <Card className="card-hero">
        <div className="card-header">
          <span className="eyebrow">OAuth 2.0 + OpenID Connect</span>
          <h2 className="card-title">Sign in to continue</h2>
          <p className="muted">
            Authenticate with the authorization code flow and PKCE. Tokens are exchanged in the
            browser and stored in session storage for this demo.
          </p>
        </div>
        <div className="button-row">
          <button className="button primary" onClick={onLogin}>
            Continue with Tuurio ID
            <span className="btn-arrow">&rarr;</span>
          </button>
          <span className="helper">Redirects to {runtimeAuthConfig.authorityHost}</span>
        </div>
        {error ? <div className="alert alert-error">{error}</div> : null}
      </Card>

      <div className="feature-grid">
        <FeatureCard
          icon="shield"
          title="PKCE by default"
          body="Proof Key for Code Exchange prevents authorization code interception attacks."
        />
        <FeatureCard
          icon="clock"
          title="Short-lived tokens"
          body="Access tokens expire quickly, scoped to openid profile email."
        />
        <FeatureCard
          icon="server"
          title="Session aware"
          body="Token state stays in session storage and can be cleared with logout."
        />
      </div>
    </div>
  );
}

function TokenView({
  user,
  profile,
  onLogout,
}: {
  user: User;
  profile: Record<string, unknown> | null;
  onLogout: () => Promise<void>;
}) {
  const accessTokenInfo = useMemo(() => decodeJwt(user.access_token), [user.access_token]);
  const idToken = user.id_token ?? "";
  const idTokenInfo = useMemo(() => decodeJwt(idToken), [idToken]);
  const scopeLabel = user.scope || "openid profile email";

  const timingParts: string[] = [];
  if (typeof accessTokenInfo?.iat === "number") {
    timingParts.push(`Issued ${new Date(accessTokenInfo.iat * 1000).toLocaleString()}`);
  }
  if (user.expires_at) {
    timingParts.push(`Expires ${new Date(user.expires_at * 1000).toLocaleString()}`);
  }

  return (
    <div className="stack">
      <Card className="card-hero">
        <div className="card-header">
          <span className="badge badge-success">
            <Icon name="check-circle" size={14} /> Authenticated
          </span>
          <h2 className="card-title">Session active</h2>
          <p className="muted">
            <code>{scopeLabel}</code>
            {timingParts.length ? <>{" · "}{timingParts.join(" · ")}</> : null}
          </p>
        </div>
        <div className="button-row">
          <button className="button ghost" onClick={onLogout}>
            Log out and end session
          </button>
          <span className="helper">Clears local state and redirects through the identity provider.</span>
        </div>
      </Card>

      <Card>
        <SectionHeader
          icon="user"
          title="User profile"
          description="Claims returned by the UserInfo endpoint."
        />
        <pre className="code-block">{profile ? JSON.stringify(profile, null, 2) : "No profile data."}</pre>
      </Card>

      <TokenPanel
        icon="key"
        title="Access-token claims"
        decoded={accessTokenInfo}
        description="Non-secret claim metadata from the validated session. The raw token is never rendered."
      />
      <TokenPanel
        icon="id-card"
        title="ID-token claims"
        decoded={idTokenInfo}
        description="Validated identity claims. The raw token is never rendered."
      />

      <Card>
        <SectionHeader
          icon="globe"
          title="Provider discovery"
          description="OIDC metadata used to resolve endpoints and session management URLs."
        />
        <div className="stack">
          <div>
            <span className="eyebrow">Authority</span>
            <p>
              <a className="link" href={runtimeAuthConfig.authority} target="_blank" rel="noreferrer">
                {runtimeAuthConfig.authority}
              </a>
            </p>
          </div>
          <div>
            <span className="eyebrow">Discovery document</span>
            <p>
              <a className="link" href={DISCOVERY_URL} target="_blank" rel="noreferrer">
                {DISCOVERY_URL}
              </a>
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function TokenPanel({
  icon,
  title,
  decoded,
  description,
}: {
  icon: IconName;
  title: string;
  decoded: Record<string, unknown> | null;
  description: string;
}) {
  return (
    <Card>
      <SectionHeader icon={icon} title={title} description={description} />
      <span className="eyebrow">Decoded claims</span>
      <pre className="code-block">
        {decoded ? JSON.stringify(decoded, null, 2) : "Not a JWT or unable to decode."}
      </pre>
    </Card>
  );
}

function Shell({
  children,
  status,
}: {
  children: ReactNode;
  status: { label: string; tone: "good" | "neutral" };
}) {
  return (
    <div className="app">
      <aside className="side-panel">
        <div className="brand">
          <div className="logo-mark">tu</div>
          <div>
            <p className="brand-name">Tuurio Auth Studio</p>
            <p className="brand-subtitle">OIDC playground for OAuth 2.0</p>
          </div>
        </div>
        <div className="side-card">
          <h1>Design for<br />secure sign in.</h1>
          <p className="muted">
            A minimal React client that authenticates with OpenID Connect, keeps raw tokens
            out of the UI, and supports logout redirects.
          </p>
          <div className="status-row">
            <span className={`status status-${status.tone}`}>{status.label}</span>
            <span className="muted">{runtimeAuthConfig.authorityHost}</span>
          </div>
        </div>
        <div className="side-list">
          <SideListItem icon="code" label="Architecture" value="Auth code + PKCE" />
          <SideListItem icon="server" label="Storage" value="Session storage" />
          <SideListItem icon="layers" label="Scope" value="openid profile email" />
        </div>
      </aside>
      <main className="main-panel">{children}</main>
    </div>
  );
}

function SideListItem({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <div className="side-list-item">
      <span className="side-list-icon">
        <Icon name={icon} size={16} />
      </span>
      <div>
        <span className="side-list-label">{label}</span>
        <span className="side-list-value">{value}</span>
      </div>
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  description,
}: {
  icon: IconName;
  title: string;
  description: string;
}) {
  return (
    <div className="section-header">
      <div className="section-icon">
        <Icon name={icon} size={18} />
      </div>
      <div>
        <h3 className="section-title">{title}</h3>
        <p className="muted">{description}</p>
      </div>
    </div>
  );
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`.trim()}>{children}</section>;
}

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: IconName;
  title: string;
  body: string;
}) {
  return (
    <div className="feature-card">
      <div className="feature-icon">
        <Icon name={icon} size={18} />
      </div>
      <h3>{title}</h3>
      <p className="muted">{body}</p>
    </div>
  );
}

function LoadingState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="loading">
      <div className="spinner" />
      <div>
        <h2 className="card-title">{title}</h2>
        <p className="muted">{subtitle}</p>
      </div>
    </div>
  );
}

function NotFound() {
  const navigate = useNavigate();
  return (
    <Shell status={{ label: "Route not found", tone: "neutral" }}>
      <Card className="card-hero">
        <div className="card-header">
          <span className="badge badge-error">
            <Icon name="x-circle" size={14} /> 404
          </span>
          <h2 className="card-title">Route not found</h2>
          <p className="muted">This path doesn&apos;t match any known endpoint.</p>
        </div>
        <div className="button-row">
          <button className="button ghost" onClick={() => navigate("/", { replace: true })}>
            Go home
            <span className="btn-arrow">&rarr;</span>
          </button>
        </div>
      </Card>
    </Shell>
  );
}

type IconName =
  | "shield"
  | "clock"
  | "user"
  | "key"
  | "id-card"
  | "globe"
  | "code"
  | "server"
  | "layers"
  | "check-circle"
  | "x-circle";

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const path = {
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </>
    ),
    user: (
      <>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </>
    ),
    key: (
      <path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4" />
    ),
    "id-card": (
      <>
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <line x1="2" y1="10" x2="22" y2="10" />
      </>
    ),
    globe: (
      <>
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </>
    ),
    code: (
      <>
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </>
    ),
    server: (
      <>
        <rect x="2" y="2" width="20" height="8" rx="2" />
        <rect x="2" y="14" width="20" height="8" rx="2" />
        <line x1="6" y1="6" x2="6.01" y2="6" />
        <line x1="6" y1="18" x2="6.01" y2="18" />
      </>
    ),
    layers: (
      <>
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
      </>
    ),
    "check-circle": (
      <>
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </>
    ),
    "x-circle": (
      <>
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </>
    ),
  }[name];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {path}
    </svg>
  );
}

function decodeJwt(token: string): Record<string, unknown> | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;

  try {
    const payload = decodeBase64Url(parts[1]);
    return JSON.parse(payload) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function decodeBase64Url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = padded.length % 4;
  const base64 = padLength ? padded.padEnd(padded.length + (4 - padLength), "=") : padded;
  return atob(base64);
}

export default App;
