/**
 * Firebase Cloud Functions - Fenerbahçe Fan Hub Backend
 *
 * Modüler yapı:
 *   config.js           - Firebase init, sabitler, yardımcılar
 *   services/espn.js     - ESPN veri çekme ve parse
 *   services/sofascore.js - SofaScore API çağrıları
 *   handlers/api.js      - HTTP endpoint'leri
 *   schedulers/          - Zamanlanmış görevler
 */

const { api } = require('./handlers/api');
const { dailyDataRefresh } = require('./schedulers/dailyRefresh');
const { updateLiveMatch } = require('./schedulers/liveMatch');
const { checkMatchNotifications } = require('./schedulers/notifications');
const { reconcileTopicSync } = require('./schedulers/topicSync');

exports.api = api;
exports.dailyDataRefresh = dailyDataRefresh;
exports.updateLiveMatch = updateLiveMatch;
exports.checkMatchNotifications = checkMatchNotifications;
exports.reconcileTopicSync = reconcileTopicSync;
