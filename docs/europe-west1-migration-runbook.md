# Europe West 1 Migration Runbook

Migration window opened on **2026-08-31 Europe/Istanbul**. The next verified match is **Fenerbahçe–Beşiktaş on 2026-09-05 at 20:00 Europe/Istanbul**. US rollback resources must remain available until the match has finished and an additional three-hour observation window has passed.

This runbook moves the stateless Firebase Cloud Functions and their second-generation scheduled functions from `us-central1` to `europe-west1`. The existing Realtime Database already runs in `europe-west1` and must not be recreated, imported, cleared, or otherwise moved.

## Safety rules

- Do not start or continue a cutover inside the `T-90 minutes` to match-finish-plus-three-hours processing window.
- Never run the US and Europe versions of the same scheduler at the same time.
- Never redirect the orphan `checkMatchNotificationsV2` job to the active notification service.
- Do not delete US functions or jobs during cutover. Keep them paused and deployable for rollback through the first real match.
- Do not change the RTDB URL, Firebase project ID, Auth, FCM, database rules, user data, notification preferences, or poll data.
- Stop immediately if tests fail, the selected Firebase project is wrong, secrets are unavailable, Europe returns 5xx, a scheduler invocation fails, or duplicate notification activity appears.
- Use the Google Cloud Console only for Scheduler pause/resume operations. Do not edit job URIs or OIDC settings manually.

## Migration contract

- Frontend: GitHub Pages
- RTDB: `europe-west1`, unchanged
- HTTP API during observation: `api` in both `us-central1` and `europe-west1`
- Primary frontend origin after cutover: `https://europe-west1-fb-hub-ed9de.cloudfunctions.net`
- US scheduler exports retained for rollback:
  - `dailyDataRefresh`
  - `reconcileTopicSync`
  - `updateLiveMatch`
  - `checkMatchNotifications`
- Europe scheduler exports:
  - `dailyDataRefreshEurope`
  - `reconcileTopicSyncEurope`
  - `updateLiveMatchEurope`
  - `checkMatchNotificationsEurope`
- Orphan job to pause: `firebase-schedule-checkMatchNotificationsV2-us-central1`

## Phase 1 — Preflight

- [ ] Use Firebase CLI `15.28.1` with Node 22 and verify `fb-hub-ed9de` is the current project. Never use `firebase login:list --json`.
- [ ] Activate JDK 21 or newer for the RTDB emulator.
- [ ] Confirm the Git working tree and review every pending change.
- [ ] Run lint, typecheck, tests, RTDB rules tests, production build, and `git diff --check`.
- [ ] Create a permission-restricted, read-only RTDB export outside the repository and record its SHA-256 digest. Do not import it during this migration.
- [ ] Record `firebase functions:list`, public API health, `cache/nextMatch`, and `ops/health`.
- [ ] Confirm the next match remains outside the live-processing window.

## Phase 2 — Remove orphan 404 noise

- [ ] In Cloud Scheduler, pause only `firebase-schedule-checkMatchNotificationsV2-us-central1`.
- [ ] Wait at least ten minutes.
- [ ] Confirm no new V2 404 entries appear.
- [ ] Confirm `ops/health/notificationScheduler` continues to advance through the active non-V2 US job.
- [ ] Leave the orphan job paused; do not delete it during the observation window.

Rollback: resume the orphan only if evidence unexpectedly proves it is required. Never point it at the non-V2 service.

## Phase 3 — Deploy and validate the Europe HTTP API

- [ ] Deploy only `functions:api`. Its temporary multi-region declaration keeps the US URL available and creates the same `/api` endpoint in Europe.
- [ ] Verify Europe `/health`, `/next-match`, `/next-3-matches`, `/squad`, and cached image endpoints.
- [ ] Verify allowed CORS, expected unauthenticated 401/403 responses, Firebase Auth, admin claims, Secret Manager bindings, and RTDB reads.
- [ ] Compare US and Europe response payloads, latency, and Cloud Run errors.
- [ ] Do not continue if Europe returns different application data or any unexpected 5xx response.

Rollback: keep the frontend on the US origin. The US API remains deployed.

## Phase 4 — Frontend cutover

- [ ] Set the source fallback and GitHub Pages `VITE_BACKEND_ORIGIN` to the verified Europe host.
- [ ] Publish the reviewed `main` commit only after the Europe API passes acceptance.
- [ ] Wait for the CI quality gate and GitHub Pages deployment.
- [ ] Verify dashboard, fixtures, polls, notification preferences, authentication, administration, player images, and PWA update behavior.
- [ ] Confirm production browser requests use the Europe host.
- [ ] Keep the US API available for older cached PWA/frontend versions and rollback.

Rollback: restore the US backend origin and republish the frontend. No database restore is required.

## Phase 5 — Scheduler cutover

Migrate one scheduler at a time. For every scheduler, pause the US job first, deploy only the Europe function, verify its region and first safe invocations, and only then continue. If deployment or verification fails, pause Europe and resume US immediately.

Order:

1. [ ] `dailyDataRefreshEurope`
   - Do not manually invoke the full refresh.
   - Verify its schedule and target during cutover.
   - Final acceptance occurs after the next 06:00 Istanbul run; if it fails, resume US and run the recovered job manually from the Console.
2. [ ] `reconcileTopicSyncEurope`
   - Observe at least two five-minute cycles.
   - Confirm no unexpected pending or cleanup queue growth.
3. [ ] `updateLiveMatchEurope`
   - Outside the live window the handler returns early and does not advance RTDB health.
   - Use Cloud Scheduler execution status and Cloud Run request logs to verify 2xx invocations.
4. [ ] `checkMatchNotificationsEurope`
   - Migrate last.
   - Observe at least three one-minute cycles and confirm `ops/health/notificationScheduler` advances.
   - Confirm the US notification job is paused before the Europe job is allowed to run.

## Phase 6 — Acceptance and freeze

- [ ] Europe API returns 200 and reads the existing Europe RTDB data.
- [ ] Europe Scheduler jobs target `europe-west1` and show successful execution where an immediate no-op run is expected.
- [ ] Daily refresh is marked pending until its next scheduled full run.
- [ ] No new V2 404 logs, duplicate notification activity, Cloud Run 5xx, OIDC 401/403, Secret Manager, FCM, or RTDB permission errors appear.
- [ ] Record Europe and US function/job states for rollback.
- [ ] Freeze Functions and Scheduler changes for the observation window.

## Observation through the first match

- Confirm the next Europe daily refresh after 06:00 Istanbul.
- Monitor API errors, Scheduler results, FCM failures, RTDB usage, topic sync queues, and health records daily.
- On 2026-09-05 monitor the 09:00 daily notification, the configured pre-match windows beginning at 17:00, lineup/live processing from 18:30, the 20:00 match, and final cache persistence.
- Keep all US rollback functions deployed and their jobs paused until the match has finished plus three hours.

## Final cleanup

Only after the first-match acceptance window:

1. Change the `api` declaration to `europe-west1` only and remove the US scheduler exports from source.
2. Run the complete local quality gate again.
3. Deploy the final Europe functions and verify them.
4. Delete only the explicitly inventoried US functions with `--region us-central1`.
5. Delete the paused orphan V2 Scheduler job from the Cloud Console.
6. Review and remove only unreferenced US build images; never delete an Artifact Registry repository in bulk.
7. Confirm `firebase functions:list` and Cloud Scheduler show only intended Europe production resources.
8. Remove the temporary RTDB export after the rollback window closes.

## Final success criteria

- The existing RTDB remains unchanged in `europe-west1`.
- All production Cloud Functions and active Scheduler jobs run in `europe-west1`.
- The production frontend calls the Europe API.
- Auth, FCM, user preferences, polls, cache data, admin data, and operational state continue without reset.
- No `us-central1` runtime remains after the first-match rollback window and explicit cleanup.
