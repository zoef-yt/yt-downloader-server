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
  console.log('Client connected for progress:', id);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  clients[id] = res;

  req.on('close', () => {
    console.log('Client disconnected:', id);
    delete clients[id];
  });
});


app.post('/api/download', async (req, res) => {
  const { url, type, format, id } = req.body;
  console.log('Request received to download:', { url, id });
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
    cookies: path.join(__dirname, 'cookies.txt'),
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    referer: 'https://www.youtube.com/',
  };

  if (type === 'audioonly') {
    args.extractAudio = true;
    args.audioFormat = format;
  } else if (type === 'videoonly') {
    args.format = 'bestvideo[ext=mp4]/bestvideo';
  } else {
    args.format = 'bestvideo[ext=mp4][height<=720]+bestaudio[ext=m4a]/best[ext=mp4]';
  }
  console.log('Arguments set')
  try {
    console.log('Starting download');
    const info = await youtubeDl(url, {
      cookies: path.join(__dirname, 'cookies.txt'),
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      referer: 'https://www.youtube.com/',
      dumpSingleJson: true,
    });
    const safeTitle = info.title.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
    const finalFileName = `${safeTitle}.${format}`;
    res.setHeader('Content-Disposition', `attachment; filename="${finalFileName}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    console.log('Video title:', finalFileName);

    const subprocess = youtubeDl.exec(url, args);
    subprocess.stdout.on('data', (data) => {
      console.log('Subprocess output:', data.toString());

      const line = data.toString();
      const match = line.match(/\[download\]\s+(\d{1,3}\.\d)%/);
      if (match && clients[id]) {
        const progress = parseFloat(match[1]);
        console.log('Progress:', progress);
        clients[id].write(`data: ${JSON.stringify({ progress })}\n\n`);
        if (progress >= 100) {
          clients[id].write(`data: ${JSON.stringify({ progress: 100, status: 'processing' })}\n\n`);
          console.log('Download completed');
        }
      }
    });

    subprocess.on('close', () => {
      if (!fs.existsSync(filePath)) {
        return res.status(500).json({ error: 'Download failed or file not created' });
      }
      if (clients[id]) {
        clients[id].write(`data: ${JSON.stringify({ status: 'sending file' })}\n\n`);
        clients[id].end();
        delete clients[id];
      }
      console.log('Download completed');
      setTimeout(() => {
        const stream = fs.createReadStream(filePath);
        console.log('Stream created');
        stream.pipe(res);
        stream.on('end', () => fs.unlink(filePath, () => { }));
      }, 500);
    });
    subprocess.on('error', (err) => {
      console.error('❌ Subprocess failed to start:', err);
      if (clients[id]) {
        clients[id].write(`data: ${JSON.stringify({ error: 'Internal server error during processing' })}\n\n`);
        clients[id].end();
        delete clients[id];
      }
      res.status(500).json({ error: 'Failed to start download process' });
    });
  } catch (error) {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    console.error('❌ Error during download:', error);
    let errorMessage = 'Download failed';
    if (error && typeof error === 'object') {
      const stderr = error.stderr || error.message || '';
      if (typeof stderr === 'string') {
        if (stderr.includes('Video unavailable')) {
          errorMessage = 'The video is unavailable or private.';
        } else if (stderr.includes('age restricted')) {
          errorMessage = 'This video is age-restricted and cannot be downloaded.';
        } else if (stderr.includes('Unsupported URL')) {
          errorMessage = 'The provided URL is not supported.';
        } else {
          const matched = stderr
            .split('\n')
            .find((line) => line.toLowerCase().includes('error:'));
          if (matched) {
            errorMessage = matched.replace(/^ERROR:\s*/i, '');
          }
        }
      }
    }
    console.log('🔎 Final errorMessage:', errorMessage);
    res.status(500).json({ error: errorMessage });
  }
});
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection:', reason);
});
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', time: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
