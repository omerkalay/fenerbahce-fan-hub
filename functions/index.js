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
const { dailyDataRefreshEurope } = require('./schedulers/dailyRefresh');
const { updateLiveMatchEurope } = require('./schedulers/liveMatch');
const { checkMatchNotificationsEurope } = require('./schedulers/notifications');
const { reconcileTopicSyncEurope } = require('./schedulers/topicSync');

exports.api = api;
exports.dailyDataRefreshEurope = dailyDataRefreshEurope;
exports.updateLiveMatchEurope = updateLiveMatchEurope;
exports.checkMatchNotificationsEurope = checkMatchNotificationsEurope;
exports.reconcileTopicSyncEurope = reconcileTopicSyncEurope;
