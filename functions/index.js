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
const { dailyDataRefresh, dailyDataRefreshEurope } = require('./schedulers/dailyRefresh');
const { updateLiveMatch, updateLiveMatchEurope } = require('./schedulers/liveMatch');
const { checkMatchNotifications, checkMatchNotificationsEurope } = require('./schedulers/notifications');
const { reconcileTopicSync, reconcileTopicSyncEurope } = require('./schedulers/topicSync');

exports.api = api;
exports.dailyDataRefresh = dailyDataRefresh;
exports.updateLiveMatch = updateLiveMatch;
exports.checkMatchNotifications = checkMatchNotifications;
exports.reconcileTopicSync = reconcileTopicSync;
exports.dailyDataRefreshEurope = dailyDataRefreshEurope;
exports.updateLiveMatchEurope = updateLiveMatchEurope;
exports.checkMatchNotificationsEurope = checkMatchNotificationsEurope;
exports.reconcileTopicSyncEurope = reconcileTopicSyncEurope;
