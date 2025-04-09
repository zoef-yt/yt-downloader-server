const fs = require('fs');
const path = require('path');

const logPath = path.join(__dirname, '..', 'logs', 'download-activity.log');
if (!fs.existsSync(path.dirname(logPath))) {
  fs.mkdirSync(path.dirname(logPath));
}
if (!fs.existsSync(logPath)) {
  fs.writeFileSync(logPath, '', { flag: 'w' });
}

function logDownloadFailure({ url, type, format, errorMessage }) {
  const msg = `[${new Date().toISOString()}] ❌ FAIL - URL: ${url} | Format: ${type}.${format} | Error: ${errorMessage}\n`;

  fs.appendFile(logPath, msg, (err) => {
    if (err) console.error('❌ Failed to write failure log:', err);
  });
}

module.exports = logDownloadFailure;
