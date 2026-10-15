#!/usr/bin/env bash
# Builds the pipeline image with Cloud Build and deploys it to Cloud Run.
# Run from the repo root:
#
#   services/pipeline/deploy.sh
#
# ENV_FILE points at a different .env if needed.
#
# Safe to re-run: the one-time setup (registry, service account, secret) is
# skipped when it already exists. The Jev key is read from .env and goes only
# to Secret Manager.
set -euo pipefail

PROJECT=scamshield-my-511604
REGION=asia-southeast1
SERVICE=pipeline
REPO=scamshield
SA=scamshield-pipeline@${PROJECT}.iam.gserviceaccount.com
SECRET=typesafe-api-key
IMAGE=${REGION}-docker.pkg.dev/${PROJECT}/${REPO}/${SERVICE}:$(git rev-parse --short HEAD)$(git diff --quiet HEAD -- services packages || echo -dirty)

gcloud config set project "$PROJECT" >/dev/null

# --- One-time setup -----------------------------------------------------------
if ! gcloud artifacts repositories describe "$REPO" --location "$REGION" >/dev/null 2>&1; then
  gcloud artifacts repositories create "$REPO" --location "$REGION" --repository-format docker \
    --description "ScamShield images"
fi

if ! gcloud iam service-accounts describe "$SA" >/dev/null 2>&1; then
  gcloud iam service-accounts create scamshield-pipeline --display-name "ScamShield pipeline (Cloud Run)"
fi
# Gemini on Vertex AI (ADR 8), Firestore writes (#13), and Cloud Text-to-Speech
# for the spoken warning (#23), which bills this project via x-goog-user-project.
for role in roles/aiplatform.user roles/datastore.user roles/serviceusage.serviceUsageConsumer; do
  gcloud projects add-iam-policy-binding "$PROJECT" --member "serviceAccount:$SA" --role "$role" \
    --condition None >/dev/null
done

if ! gcloud secrets describe "$SECRET" >/dev/null 2>&1; then
  key=$(grep -E '^TYPESAFE_API_KEY=' "${ENV_FILE:-.env}" | cut -d= -f2-)
  [ -n "$key" ] || { echo "TYPESAFE_API_KEY missing from ${ENV_FILE:-.env}" >&2; exit 1; }
  printf %s "$key" | gcloud secrets create "$SECRET" --replication-policy automatic --data-file=-
fi
gcloud secrets add-iam-policy-binding "$SECRET" --member "serviceAccount:$SA" \
  --role roles/secretmanager.secretAccessor >/dev/null

# --- Build and deploy ---------------------------------------------------------
gcloud builds submit . --config services/pipeline/cloudbuild.yaml --substitutions "_IMAGE=$IMAGE"

# One instance, always on: call state lives in memory (ADR 8), and a judge
# should never meet a cold start (#16). WebSocket calls can run up to an hour.
gcloud run deploy "$SERVICE" \
  --image "$IMAGE" \
  --region "$REGION" \
  --service-account "$SA" \
  --allow-unauthenticated \
  --min-instances 1 --max-instances 1 \
  --timeout 3600 \
  --session-affinity \
  --cpu 1 --memory 512Mi \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=$PROJECT,GEMINI_LOCATION=$REGION" \
  --set-secrets "TYPESAFE_API_KEY=$SECRET:latest"

URL=$(gcloud run services describe "$SERVICE" --region "$REGION" --format 'value(status.url)')
echo "Pipeline: $URL  (WebSocket: ${URL/https:/wss:}/call)"
