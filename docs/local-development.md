# Local Development

This setup runs the frontend on `localhost:9001`, points UserService calls to a local
UserService on `localhost:8082`, and leaves all other APIs on the configured remote API ingress.

## 1. Create `.env`

Copy the sample file:

```bash
cp .env.example .env
```

For the ORISO dev environment, use these key values:

```env
PORT=9001
WDS_SOCKET_PORT=9001
BROWSER=none
FAST_REFRESH=true

REACT_APP_API_URL=https://api.oriso-dev.site
REACT_APP_DEV_REMOTE_API_URL=https://api.oriso-dev.site

# Local UserService. Remove/comment this line to use the broad API instead.
REACT_APP_USER_SERVICE_ORIGIN=http://localhost:8082

# Optional service-specific overrides. Keep commented unless that service is local too.
# REACT_APP_TENANT_SERVICE_ORIGIN=https://api.oriso-dev.site
# REACT_APP_AGENCY_SERVICE_ORIGIN=https://api.oriso-dev.site
# REACT_APP_CONSULTING_TYPE_SERVICE_ORIGIN=https://api.oriso-dev.site

REACT_APP_KEYCLOAK_ORIGIN=https://api.oriso-dev.site
REACT_APP_KEYCLOAK_REALM=online-beratung

REACT_APP_MATRIX_HOMESERVER_URL=https://matrix.oriso-dev.site
REACT_APP_ELEMENT_CALL_BASE_URL=https://call.oriso-dev.site
REACT_APP_LIVEKIT_WS_URL=wss://livekit.oriso-dev.site

REACT_APP_COOKIE_DOMAIN=
REACT_APP_HOSTNAMES_WITHOUT_COOKIE_DOMAIN=localhost,127.0.0.1
REACT_APP_USE_HTTPS=false
REACT_APP_DISABLE_LIVE_WEBSOCKET=1
REACT_APP_DISABLE_ERROR_BOUNDARY=1
REACT_APP_COOKIES_ALLOWEDLIST=devProxy
CSRF_WHITELIST_HEADER_FOR_LOCAL_DEVELOPMENT=X-WHITELIST-HEADER
```

## 2. Install dependencies

```bash
npm ci --legacy-peer-deps
```

## 3. Run

```bash
npm run dev
```

Open:

```text
http://localhost:9001
```

## Routing Behavior

- `REACT_APP_USER_SERVICE_ORIGIN=http://localhost:8082` sends UserService, Matrix token,
  message, and session calls to the local UserService.
- If `REACT_APP_USER_SERVICE_ORIGIN` is absent, those calls fall back to `REACT_APP_API_URL`.
- Keep the other service-specific origins commented unless you are also running those services
  locally.
