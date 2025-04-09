const fs = require('fs');
const path = require('path');

const logPath = path.join(__dirname, '..', 'logs', 'download-activity.log');
if (!fs.existsSync(path.dirname(logPath))) {
  fs.mkdirSync(path.dirname(logPath));
}
if (!fs.existsSync(logPath)) {
  fs.writeFileSync(logPath, '', { flag: 'w' });
}

function logDownloadSuccess({ url, title, type, format, filePath, startTime }) {
  const timeTaken = Date.now() - startTime;
  let sizeMB = 'unknown';

  try {
    const stats = fs.statSync(filePath);
    sizeMB = (stats.size / 1024 / 1024).toFixed(2);
  } catch (e) {
    console.warn('⚠️ Could not get file size:', e.message);
  }

  const msg = `[${new Date().toISOString()}] ✅ SUCCESS - "${title}" | URL: ${url} | Format: ${type}.${format} | Size: ${sizeMB}MB | Time: ${timeTaken}ms\n`;

  fs.appendFile(logPath, msg, (err) => {
    if (err) console.error('❌ Failed to write success log:', err);
  });
}

module.exports = logDownloadSuccess;
