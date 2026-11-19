# DrapeAI API (local foundation)

This API is a local development foundation for the Android preview. It provides account/session primitives, owner-scoped wardrobe records, private local image storage, database migrations, deterministic wardrobe-grounded recommendations, saved looks, trip records, and an optional AI garment-recognition endpoint. Image bytes remain private to the API process except when a user explicitly consents to sending a selected image to the configured AI provider. Local filesystem storage must be replaced by a managed private object-storage adapter before deployment.

## Run locally

1. Copy `.env.example` to `.env` and replace `JWT_SECRET` with a random value of at least 32 characters. Add `POSTGRES_PASSWORD` with a local-only password.
2. Start the local database with `docker compose -f compose.yaml up -d postgres`.
3. From the project root, run `npm install` to install the mobile and API workspaces.
4. Run `npm run migrate`, then `npm run dev`.
5. Check `GET http://localhost:4000/health`.

The first implementation runs a single API process and stores uploads in `server/private-uploads`. Never expose that directory or mount it as a static route. Use TLS, a production secret manager, a managed PostgreSQL instance, rate-limit storage, and a private managed image store before deploying.

## Optional AI recognition

`POST /v1/ai/garment-recognition` accepts one authenticated JPEG, PNG, or WebP image (up to the configured upload limit) and returns suggested metadata only. It requires the `x-drapeai-ai-consent: true` header, enforces a 20-request-per-hour limit, validates the image signature, and validates the model response before returning it. The client must show every suggestion for user review; it must not auto-save model output.

The endpoint is disabled until `OPENROUTER_API_KEY` is set in the untracked `server/.env` file. Do not put that key in the mobile app, source code, an APK, or chat. The configured default is `openrouter/free`, which selects an available free model and is subject to OpenRouter's changing free-model availability and rate limits. No API call is made when the key is blank.

## Security notes

- Passwords are hashed with bcrypt; access tokens expire after 15 minutes and refresh tokens rotate and are stored only as SHA-256 hashes.
- API queries derive `user_id` from the verified access token. Client-supplied ownership is ignored.
- Uploads are capped at 10 MiB and validated by file signature for JPEG, PNG, or WebP. Original file names are discarded. Files are served only through an authenticated owner check.
- AI provider keys remain server-only. Recognition requests time out, are rate-limited, and return a safe unavailable response if the provider is not configured or fails. Image bytes and provider payloads are not written to application logs.
- AI recommendations in this foundation are deterministic category combinations from eligible garments. The response says it is a fallback and does not verify dress code or weather.
- Email verification, password recovery, Google OAuth, mobile API/auth integration, request analytics, retention reconciliation, and production object storage remain future work.
