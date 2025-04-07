const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;
const youtubeDl = require('youtube-dl-exec');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';

const downloadsDir = path.resolve(__dirname, 'downloads');
if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir);

app.use(express.json());
app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    credentials: true,
    exposedHeaders: ['Content-Disposition'],
  })
);

let clients = {};

app.get('/api/progress/:id', (req, res) => {
  const id = req.params.id;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  clients[id] = res;

  req.on('close', () => {
    delete clients[id];
  });
});


app.post('/api/download', async (req, res) => {
  const { url, type, format, id } = req.body;

  if (!url || !type || !format || !id) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  const fileName = `video-${id}.${format}`;
  const filePath = path.join(downloadsDir, fileName);
  process.env.FFPROBE_PATH = ffprobePath;

  const args = {
    o: filePath,
    ffmpegLocation: ffmpegPath,
    noPlaylist: true,
    newline: true,
  };

  if (type === 'audioonly') {
    //TODO for future use, if addin more formats
    // if (!['mp3', 'm4a', 'wav', 'opus', 'flac'].includes(format)) {
    //   return res.status(400).json({ error: `Unsupported audio format: ${format}` });
    // }
    args.extractAudio = true;
    args.audioFormat = format;
  } else if (type === 'videoonly') {
    args.format = 'bestvideo[ext=mp4]/bestvideo';
  } else {
    args.format = 'bestvideo[ext=mp4][height<=720]+bestaudio[ext=m4a]/best[ext=mp4]';
  }

  try {
    const info = await youtubeDl(url, { dumpSingleJson: true });
    const safeTitle = info.title.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
    const finalFileName = `${safeTitle}.${format}`;
    res.setHeader('Content-Disposition', `attachment; filename="${finalFileName}"`);
    res.setHeader('Content-Type', 'application/octet-stream');

    const subprocess = youtubeDl.exec(url, args);

    subprocess.stdout.on('data', (data) => {
      const line = data.toString();
      const match = line.match(/\[download\]\s+(\d{1,3}\.\d)%/);
      if (match && clients[id]) {
        const progress = parseFloat(match[1]);
        clients[id].write(`data: ${JSON.stringify({ progress })}\n\n`);
        if (progress >= 100) {
          clients[id].end();
          delete clients[id];
        }
      }
    });

    // subprocess.stderr.on('data', () => { }); 

    subprocess.on('close', () => {
      if (!fs.existsSync(filePath)) {
        return res.status(500).json({ error: 'Download failed or file not created' });
      }
      setTimeout(() => {
        const stream = fs.createReadStream(filePath);
        stream.pipe(res);
        stream.on('end', () => fs.unlink(filePath, () => { }));
      }, 500);
    });
  } catch (error) {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.status(500).json({ error: 'Download failed' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
