const path = require('path');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;

process.env.FFPROBE_PATH = ffprobePath;

const buildYtArgs = ({ type, format, filePath }) => {
  const args = {
    o: filePath,
    ffmpegLocation: ffmpegPath,
    noPlaylist: true,
    newline: true,
    cookies: path.join(__dirname, '..', 'cookies.txt'),
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...',
    referer: 'https://www.youtube.com/',
  };

  if (type === 'audioonly') {
    args.extractAudio = true;
    args.audioFormat = format;
    args.format = 'bestaudio[filesize<150M]';
  } else if (type === 'videoonly') {
    args.format = 'bestvideo[ext=mp4][height<=720][filesize<300M]';
  } else {
    args.format = 'bestvideo[ext=mp4][height<=720][filesize<300M]+bestaudio[ext=m4a][filesize<50M]/best[ext=mp4][height<=720][filesize<300M]';
  }

  args.matchFilter = 'duration < 3600';
  console.log('Arguments set');
  return args;
};

module.exports = { buildYtArgs };
