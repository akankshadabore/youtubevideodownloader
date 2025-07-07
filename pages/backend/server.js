import express from 'express';
import cors from 'cors';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { tmpdir } from 'os';
import { join } from 'path';

const app = express();
const execPromise = promisify(exec);

app.use(cors());
app.use(express.json());

app.post('/api/download', async (req, res) => {
  const { url, quality = '720p', audioOnly = false } = req.body;

  if (!url || (!url.includes('youtube.com') && !url.includes('youtu.be'))) {
    return res.status(400).json({ error: 'Invalid YouTube URL' });
  }

  try {
    const { stdout: rawTitle } = await execPromise(`yt-dlp --get-title "${url}"`);
    const title = rawTitle.trim().replace(/[<>:"/\\|?*]+/g, '');
    const filename = audioOnly ? `${title}.mp3` : `${title}.mp4`;
    const finalPath = join(tmpdir(), filename);

    if (audioOnly) {
      const audioPath = finalPath.replace('.mp3', '.%(ext)s');
      const cmd = `yt-dlp -f bestaudio --extract-audio --audio-format mp3 -o "${audioPath}" "${url}"`;
      await execPromise(cmd);
    } else {
      const selectors = {
        '144p': 'bestvideo[height<=144]+bestaudio',
        '240p': 'bestvideo[height<=240]+bestaudio',
        '360p': 'bestvideo[height<=360]+bestaudio',
        '480p': 'bestvideo[height<=480]+bestaudio',
        '720p': 'bestvideo[height<=720]+bestaudio',
        '1080p': 'bestvideo[height<=1080]+bestaudio',
      };
      const selector = selectors[quality] || selectors['720p'];
      const rawOut = join(tmpdir(), `${title}.%(ext)s`);
      await execPromise(`yt-dlp -f "${selector}" -o "${rawOut}" "${url}"`);

      const files = fs.readdirSync(tmpdir());
      const rawFile = files.find(f => f.startsWith(title) && !f.endsWith('.mp4'));
      const rawPath = join(tmpdir(), rawFile);

      const ffmpegCmd = `ffmpeg -i "${rawPath}" -c:v libx264 -c:a aac "${finalPath}" -y`;
      await execPromise(ffmpegCmd);

      fs.existsSync(rawPath) && fs.unlinkSync(rawPath);
    }

    if (!fs.existsSync(finalPath)) {
      return res.status(500).json({ error: 'File not created' });
    }

    const stat = fs.statSync(finalPath);
    res.setHeader('Content-Type', audioOnly ? 'audio/mpeg' : 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', stat.size);

    fs.createReadStream(finalPath)
      .pipe(res)
      .on('close', () => fs.unlinkSync(finalPath));
  } catch (err) {
    console.error('❌ Download error:', err);
    res.status(500).json({ error: 'Download failed', details: err.message });
  }
});

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`🚀 yt-backend running on port ${port}`));
