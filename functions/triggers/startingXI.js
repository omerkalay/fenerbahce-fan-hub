const { onValueWritten } = require("firebase-functions/v2/database");
const { admin, db } = require('../config');

/**
 * Starting XI Push Trigger
 *
 * Runs when admin/startingXI/push/requested changes from false/null to true.
 * This legacy compatibility trigger validates and deduplicates the payload
 * before sending a single data-only message to the all_fans topic.
 */
const onStartingXIPushRequested = onValueWritten(
    { ref: "admin/startingXI/push/requested", instance: "fb-hub-ed9de-default-rtdb", region: "europe-west1" },
    async (event) => {
        const before = event.data.before.val();
        const after = event.data.after.val();

        // Run only on a false/null to true transition.
        if (after !== true || before === true) {
            return;
        }

        const pushRef = db.ref('admin/startingXI/push');

        try {
            // 1. Read the legacy Starting XI node.
            const snapshot = await db.ref('admin/startingXI').once('value');
            const xiData = snapshot.val();

            if (!xiData) {
                await pushRef.update({
                    requested: false,
                    lastError: 'admin/startingXI node is empty or missing'
                });
                return;
            }

            // 2. Require a valid publishedAt timestamp.
            const { publishedAt, starters } = xiData;

            if (typeof publishedAt !== 'number' || !Number.isFinite(publishedAt) || publishedAt <= 0) {
                await pushRef.update({
                    requested: false,
                    lastError: 'publishedAt must be a valid positive number (timestamp)'
                });
                return;
            }

            // 3. Require exactly 11 normalized starters.
            const starterList = normalizeStarters(starters);

            if (!starterList || starterList.length !== 11) {
                const count = starterList ? starterList.length : 0;
                await pushRef.update({
                    requested: false,
                    lastError: `starters must have exactly 11 players, found ${count}`
                });
                return;
            }

            // 4. Deduplicate by publishedAt.
            const pushData = xiData.push || {};
            if (pushData.sentForPublishedAt === publishedAt) {
                console.log(`Starting XI push already sent for publishedAt=${publishedAt}, skipping.`);
                await pushRef.update({
                    requested: false
                });
                return;
            }

            // 5. Send a data-only message to the fixed all_fans topic.
            const message = {
                topic: 'all_fans',
                data: {
                    title: 'İlk 11 Açıklandı!!',
                    body: "Fenerbahçe'nin ilk 11'i belli oldu",
                    url: 'https://omerkalay.com/fenerbahce-fan-hub/',
                    type: 'startingXI'
                }
            };

            await admin.messaging().send(message);
            console.log(`Starting XI push sent to all_fans for publishedAt=${publishedAt}`);

            // 6. Persist the accepted state.
            await pushRef.update({
                requested: false,
                sentAt: Date.now(),
                sentForPublishedAt: publishedAt,
                lastError: null
            });

        } catch (error) {
            console.error('Starting XI push failed:', error);

            // 7. Persist a retryable legacy error state.
            await pushRef.update({
                requested: false,
                lastError: error.message || 'unknown error'
            }).catch(updateErr => {
                console.error('Failed to write lastError:', updateErr);
            });
        }
    }
);

const VALID_GROUPS = ['GK', 'DEF', 'MID', 'FWD'];

/**
 * Validate and normalize one legacy player entry.
 */
function normalizePlayer(value) {
    if (!value || typeof value !== 'object') return null;

    const name = typeof value.name === 'string' ? value.name.trim() : '';
    const number = typeof value.number === 'number' ? value.number : Number(value.number);
    const group = typeof value.group === 'string' ? value.group.trim().toUpperCase() : '';

    if (!name || !Number.isFinite(number) || !VALID_GROUPS.includes(group)) {
        return null;
    }

    return { name, number, group };
}

/**
 * Normalize a legacy starters object or array and drop invalid entries.
 */
function normalizeStarters(starters) {
    if (!starters) return null;

    const entries = Array.isArray(starters)
        ? starters
        : (typeof starters === 'object' ? Object.values(starters) : []);

    const valid = entries.map(normalizePlayer).filter(Boolean);
    return valid.length > 0 ? valid : null;
}

module.exports = { onStartingXIPushRequested };
