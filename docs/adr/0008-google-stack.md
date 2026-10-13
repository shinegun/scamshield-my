# 8. Everything runs on Google Cloud and Firebase except the Jev scorer

- Status: Accepted
- Date: 2026-10-13, revised 2026-10-14
- Supersedes: [ADR 1](0001-hosting-split.md)

## Context

Our track is "BFSI: Intelligent Risk, Fraud & Financial Experiences". ADR 1 kept only Cloud Run and Gemini, and put data on Supabase and the frontend on Cloudflare Pages. With Jev as the primary scorer (ADR 2), that left three visible non-Google parts in a Google AI hackathon entry. We want Jev to be the one deliberate exception.

The submission rules settle which Google products matter: the brief description must say how we use "Firebase, Firestore, Cloud Run and Gemini", and the submission is expected to include all of them. The first version of this ADR chose BigQuery from the track page's looser list of suggestions; the rules outrank that list.

The rules also say judges open the deployed prototype themselves, with no retries if it is down.

## Decision

- One Cloud Run service runs the call pipeline.
- Firebase Hosting serves the web app.
- Firestore holds call sessions, risk history and transfer holds. The fraud dashboard reads it through realtime listeners.
- Gemini is called through Vertex AI using the Cloud Run service account, not an API key. This covers the fallback scorer, the warning text and the spoken warning.
- Speech-to-text is Chirp 3 (ADR 4).
- Pub/Sub is stretch: publish transfer-hold events through it if we are ahead.

## Alternatives considered

- **Keep ADR 1 (Supabase and Cloudflare Pages).** Fastest for Aqil, who knows both, but uses none of the data and hosting products the rules name.
- **BigQuery for data, dashboard fed from the pipeline WebSocket.** The first version of this ADR. Dropped because the rules name Firestore, and because the dashboard would go blank on a Cloud Run restart.
- **Cloud SQL or AlloyDB.** Suggested by the track page, but no realtime feed and more connection setup.
- **Document AI, Vertex AI Search.** No place in a phone-call product.

## Consequences

- Live call state still sits in memory in one Cloud Run instance, but everything the dashboard shows is in Firestore, so it survives a restart.
- The pipeline writes to Firestore with the Admin SDK; the web app reads with the client SDK. Firestore security rules must let the public demo read without letting it write.
- Supabase and Cloudflare are out. Firestore is close to the Supabase shape Aqil knows.
- The Google Cloud project, with billing, Vertex AI and Firebase enabled, blocks the scorer as well as the deploy.
- Local development needs `gcloud auth application-default login` instead of an API key in `.env`.
