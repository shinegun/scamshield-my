# 1. Cloud Run for the pipeline, Supabase for data, Cloudflare Pages for the frontend

- Status: Accepted
- Date: 2026-10-12

## Context

The only hard rule is "build a working prototype on Google Cloud". The original plan used eleven Google services, including Pub/Sub, Cloud SQL, BigQuery and Looker Studio. We have six days and two people. Aqil knows Cloudflare and Supabase well and has not used Google Cloud.

## Decision

- One Cloud Run service runs the whole call pipeline: audio WebSocket, speech-to-text, scoring, actions.
- Supabase holds call sessions, risk history and transfer holds, and feeds the fraud dashboard over realtime.
- Cloudflare Pages hosts the web frontend.
- Google provides the AI: speech-to-text and Gemini.

## Alternatives considered

- **Workers and Durable Objects for the core, a thin Cloud Run bridge for speech-to-text.** Uses Aqil's skills most, but adds a cross-cloud hop on every chunk and two deploy targets.
- **Everything on Cloudflare, Google only through API calls.** Nothing would be hosted on Google Cloud, which is the riskiest reading of the one rule that can disqualify us.

## Consequences

- Call state lives in memory in one Cloud Run instance. Fine for a demo; it needs one always-on instance and would not survive scaling out.
- Pub/Sub, Cloud SQL, BigQuery and Looker Studio are dropped. The dashboard reads Supabase directly.
- Aqil has to create the Google Cloud project and install `gcloud` before anything deploys.
