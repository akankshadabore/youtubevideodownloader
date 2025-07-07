// server.js
import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const app = express();
const execPromise = promisify(exec);
const PORT = process.env.PORT || 4000;

const ytDlpPath = '/opt/homebrew/bin/yt-dlp'; // Replace with output of `which yt-dlp`

app.use(cors());
app.use(express.json());

app.post('/download', async (req, res) => {
  const { url, quality = '720p', audioOnly = false } = req.body;

  if (!url || (!url.includes('youtube.com') && !url.includes('youtu.be'))) {
    return res.status(400).json({ error: 'Invalid YouTube URL' });
  }

  try {
    const { stdout: titleRaw } = await execPromise(`${ytDlpPath} --get-title "${url}"`);
    const title = titleRaw.trim().replace(/[<>:"/\\|?*]+/g, '');
    let filename = audioOnly ? `${title}.mp3` : `${title}.mp4`;
    const finalPath = join(tmpdir(), filename);

    if (audioOnly) {
      const audioPath = finalPath.replace('.mp3', '.%(ext)s');
      const cmd = `${ytDlpPath} -f bestaudio --extract-audio --audio-format mp3 -o "${audioPath}" "${url}"`;
      await execPromise(cmd);
    } else {
      let formatSelector;
      switch (quality) {
        case '144p': formatSelector = 'bestvideo[height<=144]+bestaudio/best[height<=144]'; break;
        case '240p': formatSelector = 'bestvideo[height<=240]+bestaudio/best[height<=240]'; break;
        case '360p': formatSelector = 'bestvideo[height<=360]+bestaudio/best[height<=360]'; break;
        case '480p': formatSelector = 'bestvideo[height<=480]+bestaudio/best[height<=480]'; break;
        case '720p': formatSelector = 'bestvideo[height<=720]+bestaudio/best[height<=720]'; break;
        case '1080p': formatSelector = 'bestvideo[height<=1080]+bestaudio/best[height<=1080]'; break;
        default: formatSelector = 'bestvideo[height<=720]+bestaudio/best[height<=720]';
      }

      const rawOutPath = join(tmpdir(), `${title}.%(ext)s`);
      const ytCmd = `${ytDlpPath} -f "${formatSelector}" -o "${rawOutPath}" "${url}"`;
      await execPromise(ytCmd);

      const allFiles = fs.readdirSync(tmpdir());
      const rawFileName = allFiles.find(name => name.startsWith(title) && !name.endsWith('.mp4'));
      const rawFilePath = join(tmpdir(), rawFileName);

      const ffmpegCmd = `ffmpeg -i "${rawFilePath}" -c:v libx264 -c:a aac -strict experimental "${finalPath}" -y`;
      await execPromise(ffmpegCmd);

      if (fs.existsSync(rawFilePath)) {
        fs.unlinkSync(rawFilePath);
      }
    }

    if (!fs.existsSync(finalPath)) {
      return res.status(500).json({ error: 'File not created. Please try again.' });
    }

    const stat = fs.statSync(finalPath);
    const contentType = audioOnly ? 'audio/mpeg' : 'video/mp4';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', stat.size);

    const stream = fs.createReadStream(finalPath);
    stream.pipe(res);
    stream.on('close', () => fs.unlinkSync(finalPath));
  } catch (err) {
    console.error('❌ Download error:', err);
    res.status(500).json({ error: 'Download failed', details: err.message });
  }
});

app.get('/', (req, res) => {
  res.send('🎬 YouTube Downloader API is running!');
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
