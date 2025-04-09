const fs = require('fs');
const path = require('path');

const corsLogPath = path.join(__dirname, '..', 'logs', 'cors-blocked.log');
if (!fs.existsSync(path.dirname(corsLogPath))) {
  fs.mkdirSync(path.dirname(corsLogPath));
}
if (!fs.existsSync(corsLogPath)) {
  fs.writeFileSync(corsLogPath, '', { flag: 'w' });
}

function logCorsBlock(origin, reason = 'unknown') {
  const msg = `[${new Date().toISOString()}] ❌ CORS BLOCK - ${origin || 'No Origin'} | Reason: ${reason}\n`;

  fs.appendFile(corsLogPath, msg, (err) => {
    if (err) console.error('❌ Failed to write CORS log:', err);
  });
}

module.exports = logCorsBlock;
