# React Vite OIDC Starter

Production-oriented React and Vite authentication starter for Tuurio ID using OpenID Connect Authorization Code with PKCE.

[![Verify template](https://github.com/Tuurio/react-vite-oidc-starter/actions/workflows/verify.yml/badge.svg)](https://github.com/Tuurio/react-vite-oidc-starter/actions/workflows/verify.yml)

> Generated from [`Tuurio/auth_samples/auth_samples_react`](https://github.com/Tuurio/auth_samples/tree/main/auth_samples_react). Submit implementation fixes upstream so they are not replaced by the next synchronized release.

## What you get

- Standards-based OpenID Connect authentication with framework-native integration.
- Exact redirect and post-logout redirect handling.
- Protected-route and logout examples.
- A reviewed, pinned Tuurio provisioning workflow.

## Quickstart

1. Create a repository with **Use this template** or clone this repository.
2. Follow the framework-specific prerequisites below.
3. Review and run this pinned provisioning command:

```bash
npx manage-tuurio-id@1.1.6 init --framework react --project-dir . --auth browser --yes --output json --campaign github_react_vite --no-open --no-wait
```

4. Approve the exact command, then complete the secure browser handoff yourself.
5. Run the build and verify one real sign-in and sign-out.

Never paste credentials, client secrets, authorization codes, tokens, session cookies, or environment-file contents into an agent chat. Browser and native applications are public clients and must not contain a client secret.

## Runtime and verification

- Runtime: Node.js 20+
- Package manager: npm
- Verification: `npm ci && npm run lint && npm run build`

## Security model

This starter uses OpenID Connect Authorization Code flow. Browser and native clients use PKCE S256 and contain no client secret. Redirect and post-logout redirect URIs must match exactly. Identity comes from the established OIDC integration or an authenticated UserInfo request; decoded JWT payloads are never treated as validation. Keep generated local environment files ignored and never commit tokens or credentials.

## Framework instructions

# Tuurio Auth React Demo

A React + Vite demo that signs in with OAuth 2.0 / OpenID Connect, then displays token contents and a logout button.

## Integration guide

- Detailed integration guide: [React example page](https://id.tuurio.com/public/developers/examples/react)
- General developer docs: [Tuurio ID developers](https://id.tuurio.com/public/developers)

## Setup

1. Install dependencies:

```bash
npm install
```

2. Provision a tenant-specific public client through the human-approved browser handoff:

```bash
npx manage-tuurio-id@1.1.6 init --framework react --project-dir . --auth browser --yes --output json --campaign github_react_vite --no-open --no-wait
```

3. Start the development server after the CLI writes the ignored local configuration:

```bash
npm run dev
```

Open `http://localhost:5173`.

## Required client URLs

Configure your Tuurio client with these redirect URLs (matching your `.env` values):

```text
Redirect URI: http://localhost:5173/auth/callback
Post-logout Redirect URI: http://localhost:5173/logout/callback
```

The demo also accepts `/callback` for compatibility.

## `.env` keys

```env
VITE_TUURIO_ISSUER=https://your-tenant.id.tuurio.com
VITE_TUURIO_CLIENT_ID=replace-with-your-public-client-id
VITE_TUURIO_REDIRECT_URI=http://localhost:5173/auth/callback
VITE_TUURIO_POST_LOGOUT_REDIRECT_URI=http://localhost:5173/logout/callback
VITE_TUURIO_SCOPE=openid profile email
```

Notes:
- This is a public SPA client. Do not use or commit confidential client secrets.
- Keep redirect URIs and post-logout URIs exact.


## License

Licensed under the Apache License, Version 2.0. See [`LICENSE`](./LICENSE).
