import { UserManager, WebStorageStateStore } from "oidc-client-ts";

const DEFAULT_AUTHORITY = "https://configuration-required.invalid";
const DEFAULT_CLIENT_ID = "configuration-required";
const DEFAULT_SCOPE = "openid profile email";
const DEFAULT_REDIRECT_PATH = "/auth/callback";

type RuntimeAuthConfig = {
  authority: string;
  authorityHost: string;
  clientId: string;
  scope: string;
  redirectUri: string;
  postLogoutRedirectUri: string;
};

export const runtimeAuthConfig = resolveRuntimeAuthConfig();
export const authConfigurationError =
  runtimeAuthConfig.authority === DEFAULT_AUTHORITY || runtimeAuthConfig.clientId === DEFAULT_CLIENT_ID
    ? "Tuurio ID is not configured. Run the pinned manage-tuurio-id command from the README first."
    : null;

type DiscoveryDocument = {
  userinfo_endpoint?: string;
  end_session_endpoint?: string;
};

let discoveryDocument: DiscoveryDocument | null = null;
let userInfoEndpoint: string | null = null;
let endSessionEndpoint: string | null = null;

async function getUserInfoEndpoint() {
  if (userInfoEndpoint) return userInfoEndpoint;
  const data = await getDiscoveryDocument();
  if (!data.userinfo_endpoint) {
    throw new Error("UserInfo endpoint not available.");
  }
  userInfoEndpoint = data.userinfo_endpoint;
  return userInfoEndpoint;
}

async function getEndSessionEndpoint() {
  if (endSessionEndpoint) return endSessionEndpoint;
  const data = await getDiscoveryDocument();
  if (!data.end_session_endpoint) {
    throw new Error("End-session endpoint not available.");
  }
  endSessionEndpoint = data.end_session_endpoint;
  return endSessionEndpoint;
}

async function getDiscoveryDocument() {
  if (discoveryDocument) {
    return discoveryDocument;
  }
  const response = await fetch(`${runtimeAuthConfig.authority}/.well-known/openid-configuration`);
  if (!response.ok) {
    throw new Error("Failed to load discovery document.");
  }
  const data = (await response.json()) as DiscoveryDocument;
  discoveryDocument = data;
  return data;
}

export const authManager = new UserManager({
  authority: runtimeAuthConfig.authority,
  client_id: runtimeAuthConfig.clientId,
  redirect_uri: runtimeAuthConfig.redirectUri,
  post_logout_redirect_uri: runtimeAuthConfig.postLogoutRedirectUri,
  response_type: "code",
  scope: runtimeAuthConfig.scope,
  userStore: new WebStorageStateStore({ store: window.sessionStorage }),
});

export const login = () => {
  if (authConfigurationError) throw new Error(authConfigurationError);
  return authManager.signinRedirect();
};
export async function logout() {
  const currentUser = await authManager.getUser().catch(() => null);
  await authManager.removeUser().catch(() => undefined);
  const logoutEndpoint = await getEndSessionEndpoint();
  if (typeof window === "undefined") {
    throw new Error("Logout redirect requires a browser environment.");
  }
  const params = new URLSearchParams({
    client_id: runtimeAuthConfig.clientId,
    post_logout_redirect_uri: runtimeAuthConfig.postLogoutRedirectUri,
    state: createLogoutState(),
  });
  if (currentUser?.id_token) {
    params.set("id_token_hint", currentUser.id_token);
  }
  window.location.assign(`${logoutEndpoint}?${params.toString()}`);
}
export const handleCallback = () => authManager.signinRedirectCallback();

export async function fetchUserInfo(accessToken: string) {
  const endpoint = await getUserInfoEndpoint();
  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) {
    throw new Error("Failed to load user profile.");
  }
  return (await response.json()) as Record<string, unknown>;
}

function buildRuntimeAppUrl(path: string) {
  const origin =
    typeof window !== "undefined" && window.location.origin
      ? window.location.origin
      : "http://localhost:5173";
  const url = new URL(path, origin);
  return url.toString();
}

function resolveRuntimeAuthConfig(): RuntimeAuthConfig {
  const authority =
    normalizeAuthority(import.meta.env.VITE_TUURIO_ISSUER) ||
    DEFAULT_AUTHORITY;
  const clientId =
    normalizeClientId(import.meta.env.VITE_TUURIO_CLIENT_ID) ||
    DEFAULT_CLIENT_ID;
  const scope =
    normalizeScope(import.meta.env.VITE_TUURIO_SCOPE) ||
    DEFAULT_SCOPE;
  const redirectUri =
    normalizeUrl(import.meta.env.VITE_TUURIO_REDIRECT_URI) ||
    buildRuntimeAppUrl(DEFAULT_REDIRECT_PATH);
  const postLogoutRedirectUri =
    normalizeUrl(import.meta.env.VITE_TUURIO_POST_LOGOUT_REDIRECT_URI) ||
    buildRuntimeAppUrl("/logout/callback");

  return {
    authority,
    authorityHost: new URL(authority).host,
    clientId,
    scope,
    redirectUri,
    postLogoutRedirectUri,
  };
}

function normalizeAuthority(value: string | null) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }

  parsed.pathname = "/";
  parsed.search = "";
  parsed.hash = "";
  parsed.username = "";
  parsed.password = "";
  return parsed.toString().replace(/\/$/, "");
}

function normalizeUrl(value: string | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function normalizeClientId(value: string | null) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return null;
  }
  if (raw.length > 120) {
    return null;
  }
  if (!/^[A-Za-z0-9._-]+$/.test(raw)) {
    return null;
  }
  return raw;
}

function normalizeScope(value: string | null) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return null;
  }
  const normalized = raw
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && /^[A-Za-z0-9._:-]+$/.test(part))
    .join(" ");
  return normalized || null;
}

function createLogoutState() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}`;
}
