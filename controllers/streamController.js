const { clients } = require('../progressManager');

function handleProgressStream(req, res) {
  const id = req.params.id;
  console.log('Client connected for progress:', id);

  res.setHeader('Content-Encoding', 'identity');
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  clients[id] = res;

  req.on('close', () => {
    console.log('Client disconnected:', id);
    delete clients[id];
  });
}

module.exports = { handleProgressStream };
