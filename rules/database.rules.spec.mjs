import { after, before, beforeEach, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from '@firebase/rules-unit-testing';
import { get, ref, set } from 'firebase/database';

const projectId = 'demo-fb-hub-rules';
let testEnvironment;

before(async () => {
  const rules = await readFile(new URL('../database.rules.json', import.meta.url), 'utf8');
  testEnvironment = await initializeTestEnvironment({
    projectId,
    database: { rules }
  });
});

beforeEach(async () => {
  await testEnvironment.clearDatabase();
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const database = context.database();
    await set(ref(database), {
      cache: {
        nextMatch: { id: 'match-1' },
        matchLineups: {
          '401888314': { matchId: '401888314', lineups: { home: {}, away: {} } }
        }
      },
      admin: {
        playerStatus: { player1: { status: 'injured' } },
        startingXI: { publishedAt: 123, starters: [] }
      },
      match_polls: {
        'match-1': {
          votes: { home: 2, draw: 1, away: 0 },
          users: { 'uid-a': { vote: 'home' }, 'uid-b': { vote: 'draw' } }
        }
      },
      notifications: {
        'uid-a': { fcmToken: 'token-a' },
        'uid-b': { fcmToken: 'token-b' }
      },
      ops: {
        adminSettings: { lineups: { autoPublishLineups: false, autoPushLineups: false } },
        adminDrafts: { 'uid-admin': { '401888314': { formation: '4-2-3-1' } } }
      },
      users: {
        'uid-a': { displayName: 'A' },
        'uid-b': { displayName: 'B' }
      }
    });
  });
});

after(async () => {
  await testEnvironment?.cleanup();
});

test('public sports cache and published player statuses are readable but not writable', async () => {
  const database = testEnvironment.unauthenticatedContext().database();
  const userDatabase = testEnvironment.authenticatedContext('uid-a').database();
  const adminDatabase = testEnvironment.authenticatedContext('uid-admin', { admin: true }).database();
  await assertSucceeds(get(ref(database, 'cache/nextMatch')));
  await assertSucceeds(get(ref(database, 'cache/matchLineups/401888314')));
  await assertSucceeds(get(ref(database, 'admin/playerStatus')));
  await assertFails(set(ref(database, 'cache/nextMatch'), { id: 'attacker' }));
  await assertFails(set(ref(database, 'admin/playerStatus/player1'), { status: 'fit' }));
  await assertFails(set(ref(userDatabase, 'admin/playerStatus/player1'), { status: 'fit' }));
  await assertFails(set(ref(adminDatabase, 'admin/playerStatus/player1'), { status: 'fit' }));
});

test('legacy Starting XI path is closed to public, user and admin clients', async () => {
  const publicDatabase = testEnvironment.unauthenticatedContext().database();
  const userDatabase = testEnvironment.authenticatedContext('uid-a').database();
  const adminDatabase = testEnvironment.authenticatedContext('uid-admin', { admin: true }).database();

  await assertFails(get(ref(publicDatabase, 'admin/startingXI')));
  await assertFails(get(ref(userDatabase, 'admin/startingXI')));
  await assertFails(get(ref(adminDatabase, 'admin/startingXI')));
  await assertFails(set(ref(publicDatabase, 'admin/startingXI/publishedAt'), 999));
  await assertFails(set(ref(userDatabase, 'admin/startingXI/publishedAt'), 999));
  await assertFails(set(ref(adminDatabase, 'admin/startingXI/publishedAt'), 999));
});

test('private operations state is inaccessible even to a client with an admin claim', async () => {
  const publicDatabase = testEnvironment.unauthenticatedContext().database();
  const adminClientDatabase = testEnvironment.authenticatedContext('uid-admin', { admin: true }).database();

  await assertFails(get(ref(publicDatabase, 'ops/adminSettings')));
  await assertFails(get(ref(adminClientDatabase, 'ops/adminSettings')));
  await assertFails(set(ref(adminClientDatabase, 'ops/adminSettings/lineups/autoPushLineups'), true));
  await assertFails(set(ref(adminClientDatabase, 'cache/matchLineups/401888314'), { attacker: true }));
  await assertFails(get(ref(adminClientDatabase, 'ops/playerStatus')));
  await assertFails(set(ref(adminClientDatabase, 'ops/playerStatus/drafts/uid-admin'), { attacker: true }));
});

test('poll totals are public while individual votes are owner-only and server-written', async () => {
  const publicDatabase = testEnvironment.unauthenticatedContext().database();
  const ownerDatabase = testEnvironment.authenticatedContext('uid-a').database();
  const otherDatabase = testEnvironment.authenticatedContext('uid-b').database();

  await assertSucceeds(get(ref(publicDatabase, 'match_polls/match-1/votes')));
  await assertFails(get(ref(publicDatabase, 'match_polls/match-1/users/uid-a')));
  await assertSucceeds(get(ref(ownerDatabase, 'match_polls/match-1/users/uid-a')));
  await assertFails(get(ref(otherDatabase, 'match_polls/match-1/users/uid-a')));
  await assertFails(set(ref(ownerDatabase, 'match_polls/match-1/users/uid-a'), { vote: 'away' }));
});

test('notification records are readable only by their owner and never client-writable', async () => {
  const ownerDatabase = testEnvironment.authenticatedContext('uid-a').database();
  const otherDatabase = testEnvironment.authenticatedContext('uid-b').database();
  const publicDatabase = testEnvironment.unauthenticatedContext().database();

  const ownSnapshot = await assertSucceeds(get(ref(ownerDatabase, 'notifications/uid-a')));
  assert.equal(ownSnapshot.val().fcmToken, 'token-a');
  await assertFails(get(ref(otherDatabase, 'notifications/uid-a')));
  await assertFails(get(ref(publicDatabase, 'notifications/uid-a')));
  await assertFails(set(ref(ownerDatabase, 'notifications/uid-a/fcmToken'), 'replacement'));
});

test('user profiles remain isolated by authenticated uid', async () => {
  const ownerDatabase = testEnvironment.authenticatedContext('uid-a').database();
  const otherDatabase = testEnvironment.authenticatedContext('uid-b').database();

  await assertSucceeds(get(ref(ownerDatabase, 'users/uid-a')));
  await assertSucceeds(set(ref(ownerDatabase, 'users/uid-a/displayName'), 'Updated'));
  await assertFails(get(ref(otherDatabase, 'users/uid-a')));
  await assertFails(set(ref(otherDatabase, 'users/uid-a/displayName'), 'Attacker'));
});
