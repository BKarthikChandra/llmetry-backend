LLMetry Backend

A multi-provider LLM gateway built with NestJS and PostgreSQL. Users register their own API keys for supported LLM providers, configure models, and interact through a unified chat interface. All inference calls are logged for analytics regardless of outcome.


Tech Stack

NestJS, PostgreSQL, TypeORM, Passport JWT, bcrypt, AES-256-GCM


Modules

Auth handles login, registration, and password reset at /auth.

User handles provider and model management at /user.

Chat handles messaging, history, and deletion at /chat.

Analytics handles inference log dashboards at /analytics.


Features

Authentication with JWT-based login and sign-up. Tokens expire in 7 days.

Provider Management to register API keys per provider. Keys are validated at registration time and stored encrypted with AES-256-GCM.

Model Management to list and add models per provider using a 3-level cache: in-memory, database, then live API call.

Chat Interface with multi-session support, rolling summarization after 20 messages, and full inference logging on every request.

Analytics Dashboard with filters for provider, model, date range, and timezone covering request totals, token usage, latency, throughput, and error logs.


API Routes

Auth

POST /auth/users registers a new user.

POST /auth/login returns a JWT token.

GET /auth/me returns the current user profile.

PATCH /auth/reset-password changes the password. Blocked for the demo account.


User

GET /user/providers lists all available providers.

GET /user/providers/registered lists the user's registered providers.

POST /user/providers/:id/register registers a provider with an API key.

GET /user/providers/:id/models lists configured models for a provider.

POST /user/providers/:id/models adds a model to a provider.

GET /user/chats lists the user's chats with title and last activity.


Chat

POST /chat/:modelId/send sends a message and creates a new chat if no chatId is provided.

GET /chat/:chatId/messages fetches all messages in a chat.

DELETE /chat/:chatId soft-deletes a chat.


Analytics

All endpoints require JWT and accept optional filters: providerId, providerModelId, from, to, and timezone. The from and to values use ISO 8601 format. The timezone value uses an IANA timezone such as Asia/Kolkata and defaults to UTC.

Inference log timestamps are stored in UTC. Analytics APIs convert UTC timestamps into the requested timezone before applying date range filters, hourly or daily bucketing, and timestamped reporting.

GET /analytics/overview returns aggregate totals for requests, tokens, average latency, and error count.

GET /analytics/comparison returns metrics grouped by provider or model.

GET /analytics/latency returns average latency bucketed by hour or day in the requested timezone.

GET /analytics/throughput returns request volume bucketed by hour or day in the requested timezone.

GET /analytics/errors returns error counts by provider and the 20 most recent errors.


Security

API keys are encrypted at rest using AES-256-GCM.

Passwords are hashed with bcrypt using 10 salt rounds.

JWT secret is sourced from environment variables and never hardcoded.

Input validation uses a global ValidationPipe that strips and rejects unknown fields.

CORS is restricted to the FRONTEND_URL environment variable.

Ownership is enforced per resource so users cannot access each other's data.

Login returns identical error messages for unknown email and wrong password to prevent user enumeration.


Running Locally

Prerequisites: Node.js 18 or higher and PostgreSQL.

Install dependencies with npm install, then start the dev server with npm run start:dev.

Run migrations with npm run migration:run before starting for the first time.

Swagger UI is available at /api when the server is running.


Running With Docker

Prerequisites: Docker and Docker Compose.

Run docker-compose up to start both PostgreSQL and the backend together.

The server will be available at http://localhost:5000.


Environment Variables

DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_NAME, and DB_SSL are required for the database connection.

JWT_SECRET should be a 64-character hex string for signing tokens.

ENCRYPTION_KEY should be a 64-character hex string for encrypting API keys.

FRONTEND_URL should be the deployed frontend URL for CORS configuration.

PORT defaults to 5000.
