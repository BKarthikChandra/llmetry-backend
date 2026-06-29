LLMetry Backend

A NestJS REST API that acts as a unified gateway for multiple LLM providers. Users bring their own API keys, configure models, and send chat messages through a single interface. All inference calls are logged for analytics regardless of outcome.


API documentation via Swagger is available at /api when the server is running.

Architecture: https://github.com/BKarthikChandra/llmetry-backend/blob/main/architecture/architecture.md


How It Works

Users register an API key for any supported LLM provider. The backend validates the key by calling the provider's model-listing API, encrypts it with AES-256-GCM, and stores it. Users then add specific models from that provider and start chatting.

Each chat request resolves the model, decrypts the user's API key, builds a context window from the conversation history, and forwards the messages to the provider. Token counts and latency are recorded in an immutable inference log after every call, successful or failed, which powers the analytics dashboards.

Long conversations are handled through rolling summarization. Once the message count exceeds the 20-message sliding window, the oldest messages are summarized by the same LLM and stored alongside the chat. The summary is injected as context on future requests so conversation continuity is preserved without unbounded token growth.


Tech Stack

NestJS, TypeScript, PostgreSQL, TypeORM, Passport JWT, bcrypt, AES-256-GCM


Supported Providers

OpenAI, Anthropic Claude, Google Gemini, DeepSeek


Features

Authentication with JWT-based login, registration, and password reset.

Provider Management to register API keys per provider with live validation against the provider's API.

Model Management to configure specific models per provider, validated against the provider's model catalog.

Chat with multi-session support, conversation history, rolling summarization for long chats, and SSE streaming for real-time token-by-token responses.

Analytics with per-user inference logs covering token usage, latency, error rates, throughput, and provider comparisons. Analytics date filters and hourly or daily buckets accept an IANA timezone such as Asia/Kolkata, while stored inference timestamps remain UTC.


Frontend

Repository: https://github.com/BKarthikChandra/llmetry-frontend

The frontend is a React and Vite and TypeScript dashboard covering provider and model management, a multi-session chat interface with markdown rendering, and analytics dashboards with date-range and provider filters.

Tech stack: React 19, Vite, TypeScript, React Router v7, Axios, Recharts, CSS Modules.

To run the frontend locally, clone the frontend repository, install dependencies with npm install, set VITE_API_BASE_URL to your backend URL, and start the dev server with npm run dev. The app runs on http://localhost:5173.


Running Locally

Prerequisites: Node.js 18 or higher and a running PostgreSQL instance.

Install dependencies with npm install.

Copy .env.example to .env and fill in the required values shown in the Environment Variables section below.

Run database migrations with npm run migration:run.

Start the development server with npm run start:dev.

The API will be available at http://localhost:5000 and Swagger UI at http://localhost:5000/api.


Running With Docker

Prerequisites: Docker and Docker Compose.

The docker-compose.yml starts both PostgreSQL and the backend together.

Run docker-compose up to start everything. Migrations run automatically on startup.

The API will be available at http://localhost:5000.


Environment Variables

DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_NAME, and DB_SSL are required for the database connection.

JWT_SECRET should be a 64-character hex string for signing tokens.

ENCRYPTION_KEY should be a 64-character hex string for encrypting stored API keys.

FRONTEND_URL should be set to your frontend URL for CORS. Defaults to http://localhost:5173.

PORT defaults to 5000.
