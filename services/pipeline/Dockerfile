# The call pipeline for Cloud Run. Build from the repo root, because the
# pipeline consumes packages/shared as TypeScript source from the workspace:
#
#   docker build -f services/pipeline/Dockerfile -t pipeline .

FROM node:22-slim
WORKDIR /app
RUN corepack enable

# Install first, from the manifests only, so code changes reuse this layer.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY services/pipeline/package.json services/pipeline/
RUN pnpm install --frozen-lockfile --filter @scamshield/pipeline...

COPY packages/shared packages/shared
COPY services/pipeline services/pipeline

WORKDIR /app/services/pipeline
ENV NODE_ENV=production PORT=8080
EXPOSE 8080
# tsx runs the TypeScript directly; there is no build step in this repo.
CMD ["./node_modules/.bin/tsx", "src/index.ts"]
