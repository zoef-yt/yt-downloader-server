const fs = require('fs');
const path = require('path');
const youtubeDl = require('youtube-dl-exec');

const { clients } = require('../progressManager');
const { logDownloadSuccess, logDownloadFailure } = require('../logger');
const { buildYtArgs } = require('../utils/youtubeArgs');


const downloadsDir = path.resolve(__dirname, '..', 'downloads');
if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir);

const handleDownload = async (req, res) => {
  const { url, type, format, id } = req.body;
  if (!url || !type || !format || !id) {
    logDownloadFailure({ url, type, format, errorMessage: 'Missing required parametes' });
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  const startTime = Date.now();

  console.log('Request received to download:', { url, id });

  const fileName = `video-${id}.${format}`;
  const filePath = path.join(downloadsDir, fileName);
  const args = buildYtArgs({ type, format, filePath });

  try {
    const info = await youtubeDl(url, {
      cookies: args.cookies,
      userAgent: args.userAgent,
      referer: args.referer,
      dumpSingleJson: true,
    });

    const title = info.title;
    const safeTitle = info.title.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
    const finalFileName = `${safeTitle}.${format}`;

    res.setHeader('Content-Disposition', `attachment; filename="${finalFileName}"`);
    res.setHeader('Content-Type', 'application/octet-stream');

    console.log('Video title:', finalFileName);

    const subprocess = youtubeDl.exec(url, args);

    subprocess.stdout.on('data', (data) => {
      const line = data.toString();
      const match = line.match(/\[download\]\s+(\d{1,3}\.\d)%/);
      if (match && clients[id]) {
        const progress = parseFloat(match[1]);
        clients[id].write(`data: ${JSON.stringify({ progress })}\n\n`);
        if (progress >= 100) {
          clients[id].write(`data: ${JSON.stringify({ progress: 100, status: 'processing' })}\n\n`);
        }
      }
    });

    subprocess.stderr.on('data', (data) => {
      logDownloadFailure({ url, type, format, errorMessage: data.toString() });
      console.error(`yt-dlp stderr: ${data.toString()}`);
    });

    subprocess.on('close', () => {
      if (!fs.existsSync(filePath)) {
        console.error('❌ File not created:', filePath);
        logDownloadFailure({ url, type, format, errorMessage: `Download failed for ${title}` });
        return res.status(500).json({ error: 'Download failed or file not created' });
      }

      if (clients[id]) {
        clients[id].write(`data: ${JSON.stringify({ status: 'sending file' })}\n\n`);
        clients[id].end();
        delete clients[id];
      }

      setTimeout(() => {
        const stream = fs.createReadStream(filePath);
        logDownloadSuccess({ url, title, type, format, filePath, startTime });
        console.log('Stream created');
        stream.pipe(res);
        stream.on('end', () => fs.unlink(filePath, () => { }));
      }, 500);
    });
    subprocess.on('error', (err) => {
      console.error('❌ Subprocess failed:', err);
      logDownloadFailure({ url, type, format, errorMessage: 'Subprocess failed to start' });
      if (clients[id]) {
        clients[id].write(`data: ${JSON.stringify({ error: 'Internal server error during processing' })}\n\n`);
        clients[id].end();
        delete clients[id];
      }
      res.status(500).json({ error: 'Failed to start download process' });
    });
  } catch (error) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    let errorMessage = 'Download failed';
    const stderr = error?.stderr || error?.message || '';
    if (typeof stderr === 'string') {
      if (stderr.includes('Video unavailable')) errorMessage = 'Video is unavailable or private.';
      else if (stderr.includes('age restricted')) errorMessage = 'This video is age-restricted.';
      else if (stderr.includes('Unsupported URL')) errorMessage = 'Unsupported URL provided.';
      else {
        const matched = stderr.split('\n').find((line) => line.toLowerCase().includes('error:'));
        if (matched) errorMessage = matched.replace(/^ERROR:\s*/i, '');
      }
    }
    logDownloadFailure({ url, type, format, errorMessage });
    console.log('🔎 Final errorMessage:', errorMessage);
    res.status(500).json({ error: errorMessage });
  }
};

module.exports = { handleDownload };
