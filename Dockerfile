# =============================================================================
# Stage 1 — deps
# Install ALL npm dependencies (including devDependencies) so the build stage
# has the NestJS CLI and TypeScript compiler available.
# =============================================================================
FROM node:22-alpine AS deps
WORKDIR /app

COPY package*.json ./
RUN npm ci

# =============================================================================
# Stage 2 — builder
# Compile TypeScript → dist/.  nest-cli.json deleteOutDir cleans first.
# We copy the full source here (not in deps) so a source change doesn't bust
# the npm-install layer cache.
# =============================================================================
FROM deps AS builder
COPY . .
RUN npm run build

# =============================================================================
# Stage 3 — prod-deps
# Re-run npm ci without devDependencies.  Keeping this as a separate stage
# means the final image never touches build tooling, and this layer is cached
# independently of source changes.
# =============================================================================
FROM node:22-alpine AS prod-deps
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

# =============================================================================
# Stage 4 — final
# Lean production image: only compiled JS + production node_modules.
# Runs as a non-root user (nestjs / nodejs) for defense-in-depth.
# =============================================================================
FROM node:22-alpine AS final
WORKDIR /app

# Non-root user — matches common convention used by the Next.js / Vercel images
RUN addgroup --system --gid 1001 nodejs \
    && adduser  --system --uid 1001 --ingroup nodejs nestjs

# Copy artifacts from earlier stages with correct ownership in one step
# (avoids a separate chown layer that doubles the layer size)
COPY --from=prod-deps --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder   --chown=nestjs:nodejs /app/dist         ./dist
COPY --chown=nestjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh

# Strip Windows CRLF line endings (safe no-op on files already in LF format)
RUN sed -i 's/\r//' docker-entrypoint.sh && chmod +x docker-entrypoint.sh

USER nestjs

EXPOSE 5000

ENTRYPOINT ["./docker-entrypoint.sh"]
