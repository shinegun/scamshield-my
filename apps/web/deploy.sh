#!/usr/bin/env bash
# Builds the web app against the deployed pipeline and publishes it on
# Firebase Hosting. Run from the repo root:
#
#   apps/web/deploy.sh
#
# Needs `firebase login` and `gcloud auth login` (see "Set up your machine").
set -euo pipefail

PROJECT=scamshield-my-511604
REGION=asia-southeast1

# The pipeline URL is baked in at build time; read the live one from Cloud Run.
url=$(gcloud run services describe pipeline --project "$PROJECT" --region "$REGION" --format 'value(status.url)')
export VITE_PIPELINE_URL="${url/https:/wss:}/call"
echo "Building against $VITE_PIPELINE_URL"

pnpm --filter @scamshield/web build
firebase deploy --only hosting --project "$PROJECT"
