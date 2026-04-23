# Local HTTPS

TimeSmith runs locally at `https://timesmith.test` by serving HTTPS from Vite on port `5173` and forwarding port `443` to it with a small local TCP forwarder.

## 1. Add a hosts entry

Add this line to `/etc/hosts`:

```text
127.0.0.1 timesmith.test
```

## 2. Trust the local certificate

Run:

```bash
security add-trusted-cert -d -r trustRoot -k ~/Library/Keychains/login.keychain-db certs/timesmith.test.pem
```

## 3. Start the app

In this project:

```bash
npm run dev
```

## 4. Start the HTTPS forwarder

In this project:

```bash
npm run dev:https-proxy
```

## 5. Open the app

Use:

```text
https://timesmith.test
```

## Notes

- The Vite dev server runs on `https://127.0.0.1:5173`.
- The API server stays on `http://localhost:3001`.
- The local TCP forwarder binds `443` and passes traffic through to Vite on `5173`.
- The trusted cert and key live in `certs/`.
