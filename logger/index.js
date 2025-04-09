const logDownloadSuccess = require('./downloadSuccessLogger');
const logDownloadFailure = require('./downloadFailureLogger');
const logCorsBlock = require('./corsLogger');

module.exports = {
  logDownloadSuccess,
  logDownloadFailure,
  logCorsBlock,
};
