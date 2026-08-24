/**
 * Firebase Cloud Functions - Fenerbahçe Fan Hub Backend
 *
 * Module structure:
 *   config.js             - Firebase initialization, constants and helpers
 *   services/espn.js      - ESPN parsing and data access
 *   services/sofascore.js - SofaScore API access
 *   handlers/api.js       - HTTP endpoint routing
 *   schedulers/           - Scheduled tasks
 */

const { api } = require('./handlers/api');
const { dailyDataRefresh } = require('./schedulers/dailyRefresh');
const { updateLiveMatch } = require('./schedulers/liveMatch');
const { checkMatchNotifications } = require('./schedulers/notifications');
const { reconcileTopicSync } = require('./schedulers/topicSync');
const { onStartingXIPushRequested } = require('./triggers/startingXI');

exports.api = api;
exports.dailyDataRefresh = dailyDataRefresh;
exports.updateLiveMatch = updateLiveMatch;
exports.checkMatchNotifications = checkMatchNotifications;
exports.reconcileTopicSync = reconcileTopicSync;
exports.onStartingXIPushRequested = onStartingXIPushRequested;
