# Europe West 1 Migration Runbook

Planned active cutover: **2026-08-31, 10:00-12:30 Europe/Istanbul**

This is not a six-hour continuous coding session. The active work is split into two short blocks with a brief verification pause; the 24-72 hour period is passive monitoring only. If a stop condition occurs, roll back and continue in a later session instead of extending the cutover.

This runbook moves the stateless Firebase Cloud Functions and their second-generation scheduled functions from `us-central1` to `europe-west1`. The existing Realtime Database already runs in `europe-west1` and must not be recreated, imported, cleared, or otherwise moved.

## Safety rules

- Do not start if a Fenerbahçe match is within the `T-90 minutes` to `final + 3 hours` live-processing window.
- Do not run the US and Europe notification schedulers at the same time.
- Do not redirect the orphan `checkMatchNotificationsV2` job to the active service.
- Do not delete US functions or jobs on cutover day. Keep them available for rollback for at least 24-72 hours.
- Do not change the RTDB URL, Firebase project ID, Auth, FCM, database rules, or user data.
- Stop immediately if tests fail, secrets are unavailable, a Europe endpoint returns 5xx, or a scheduler health timestamp stops advancing.

## Current architecture

- Frontend: GitHub Pages
- RTDB: `europe-west1`
- HTTP API: `us-central1`
- Schedulers: `us-central1`
  - `dailyDataRefresh` at 03:00 UTC / 06:00 Istanbul
  - `updateLiveMatch` every minute
  - `checkMatchNotifications` every minute
  - `reconcileTopicSync` every five minutes
- Orphan job: `firebase-schedule-checkMatchNotificationsV2-us-central1`

## 10:00-10:20 — Preflight

- [ ] Renew the Firebase CLI session and verify that the intended production account and project are active.
- [ ] Use Firebase CLI 15.28.1 with Node 22.
- [ ] Activate JDK 21 or newer for the RTDB emulator. The current default is Corretto 17, although Homebrew OpenJDK 23 is already installed.
- [ ] Confirm the working tree and review every pending change.
- [ ] Run lint, typecheck, tests, RTDB rules tests, and production build.
- [ ] Export a read-only RTDB backup and record its timestamp. Do not import it.
- [ ] Record the current public API health response and `cache/lastUpdate`.
- [ ] Record the latest values under `ops/health` for all schedulers.
- [ ] Confirm the active non-V2 Scheduler job has recent successful executions.
- [ ] Confirm the next match is outside the live-processing window.

## 10:20-10:35 — Remove the current 404 noise

- [ ] Pause only `firebase-schedule-checkMatchNotificationsV2-us-central1`.
- [ ] Wait at least ten minutes.
- [ ] Confirm no new V2 404 entries are generated.
- [ ] Confirm `ops/health/notificationScheduler` continues to advance through the active non-V2 job.
- [ ] Leave the orphan job paused; do not delete it on cutover day.

Rollback: resume the V2 job only if the evidence unexpectedly shows it is required. Do not point it at the non-V2 service.

## 10:35-11:10 — Prepare and validate the Europe HTTP API

- [ ] Add explicit `europe-west1` region configuration using a new temporary production function name.
- [ ] Keep the current US API deployed and unchanged.
- [ ] Deploy only the new Europe HTTP API.
- [ ] Test `/health` and other read-only cache endpoints first.
- [ ] Verify CORS, Firebase Auth, admin claims, Secret Manager bindings, RTDB reads, and expected 401/403 behavior.
- [ ] Run controlled write-path checks using non-destructive test records where available.
- [ ] Compare response latency and Cloud Run error rates between US and Europe.

Rollback: stop using the Europe URL. The US API remains the production endpoint.

## 11:10-11:35 — Frontend API cutover

- [ ] Update `VITE_BACKEND_ORIGIN` and the source fallback to the verified Europe API.
- [ ] Build and verify the frontend.
- [ ] Deploy the backward-compatible backend first, then publish the frontend.
- [ ] Verify dashboard, fixture cache, poll, notification preferences, authentication, and administration flows.
- [ ] Keep the US API available for older cached PWA/frontend versions.

Rollback: restore the US backend origin and redeploy the frontend. No database restore is required.

## 11:35-12:15 — Scheduler cutover

Migrate one scheduler at a time. For each scheduler: pause the US job, deploy the new Europe function/job, observe its first successful run, verify the corresponding RTDB health record, and only then continue.

Order:

1. [ ] `dailyDataRefresh` — verify deployment and configuration; do not manually invoke the full daily refresh unless necessary.
2. [ ] `reconcileTopicSync` — verify a successful run and no unexpected queue growth.
3. [ ] `updateLiveMatch` — verify health without entering live-match processing outside its match window.
4. [ ] `checkMatchNotifications` — migrate last and ensure there is never an overlap with the US notification scheduler.

Per-scheduler rollback:

1. Pause the Europe Scheduler job.
2. Resume the corresponding US Scheduler job.
3. Confirm the US health timestamp advances.
4. Investigate without deleting either function.

## 12:15-12:30 — Acceptance and freeze

- [ ] Public API returns 200 and reads the existing Europe RTDB data.
- [ ] Europe schedulers show successful execution.
- [ ] All `ops/health` timestamps are current.
- [ ] No new V2 404 logs appear.
- [ ] No duplicate notification or lineup publication is observed.
- [ ] No Cloud Run 5xx, OIDC 401/403, Secret Manager, FCM, or RTDB permission errors appear.
- [ ] Record Europe and US function/job states for rollback.
- [ ] Freeze infrastructure changes for the remainder of the day.

## 24-72 hours after cutover

- Monitor Cloud Run errors, Scheduler results, API latency, FCM failures, RTDB usage, and all scheduler health records.
- Keep US jobs paused and US functions deployed during the observation window.
- Delete the orphan V2 job only after the observation window.
- Remove US scheduler functions one at a time after Europe has remained healthy.
- Remove or convert the US HTTP API only after cached clients no longer depend on it.
- Keep explicit region settings in source so future deploys cannot silently fall back to `us-central1`.

## Final success criteria

- The existing RTDB remains unchanged in `europe-west1`.
- All production Cloud Functions and active Scheduler jobs run in `europe-west1`.
- Auth, FCM, user preferences, polls, cache data, admin data, and operational state continue without reset.
- The US deployment remains a tested rollback path until the observation period is complete.
