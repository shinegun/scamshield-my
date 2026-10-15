#!/usr/bin/env bash
# Switches the Cloud Run pipeline between cost modes. From the repo root:
#
#   services/pipeline/power.sh status   # what it is now
#   services/pipeline/power.sh on       # public, one warm instance (judging, recording)
#   services/pipeline/power.sh idle     # public, scales to zero; first call waits for a cold start
#   services/pipeline/power.sh off      # scales to zero and refuses the public; nothing can run up cost
#
# Calls cost Jev and Gemini usage in any mode that accepts them; the caps
# (#18) bound that. deploy.sh always leaves the service "on".
set -euo pipefail

PROJECT=scamshield-my-511604
REGION=asia-southeast1
SERVICE=pipeline
where=(--project "$PROJECT" --region "$REGION")
public=(--member allUsers --role roles/run.invoker)

make_public() {
  gcloud run services add-iam-policy-binding "$SERVICE" "${where[@]}" "${public[@]}" >/dev/null
}
make_private() {
  # Fails harmlessly when the service is already private.
  gcloud run services remove-iam-policy-binding "$SERVICE" "${where[@]}" "${public[@]}" >/dev/null 2>&1 || true
}
min_instances() {
  gcloud run services update "$SERVICE" "${where[@]}" --min-instances "$1" --quiet >/dev/null
}

status() {
  local min policy
  # Empty when no minimum is set, which means zero.
  min=$(gcloud run services describe "$SERVICE" "${where[@]}" \
    --format 'value(spec.template.metadata.annotations."autoscaling.knative.dev/minScale")')
  policy=$(gcloud run services get-iam-policy "$SERVICE" "${where[@]}" --format json)
  if grep -q allUsers <<<"$policy"; then
    if [ "${min:-0}" -ge 1 ]; then echo "on: public, ${min} warm instance(s)"; else echo "idle: public, scales to zero"; fi
  else
    echo "off: not public, min instances ${min:-0}"
  fi
}

case "${1:-status}" in
  on) make_public; min_instances 1 ;;
  idle) make_public; min_instances 0 ;;
  off) min_instances 0; make_private ;;
  status) ;;
  *) echo "usage: $0 on|idle|off|status" >&2; exit 2 ;;
esac
status
