import { exec } from 'child_process';
import { promisify } from 'util';
import { tmpdir } from 'os';
import { join } from 'path';
import fs from 'fs';

const execPromise = promisify(exec);

 async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url, quality = '720p', audioOnly = false } = req.body;

  if (!url || (!url.includes('youtube.com') && !url.includes('youtu.be'))) {
    return res.status(400).json({ error: 'Invalid YouTube URL' });
  }

  try {
    // 🧾 Clean video title for filename
    const { stdout: titleRaw } = await execPromise(`yt-dlp --get-title "${url}"`);
    const title = titleRaw.trim().replace(/[<>:"/\\|?*]+/g, '');
    
    let filename = audioOnly ? `${title}.mp3` : `${title}.mp4`;
    const finalPath = join(tmpdir(), filename);

    if (audioOnly) {
      const audioPath = finalPath.replace('.mp3', '.%(ext)s');
      const cmd = `yt-dlp -f bestaudio --extract-audio --audio-format mp3 -o "${audioPath}" "${url}"`;
      await execPromise(cmd);
    } else {
      // 🧬 Define format selector
      let formatSelector;
      switch (quality) {
        case '144p':
          formatSelector = 'bestvideo[height<=144]+bestaudio/best[height<=144]';
          break;
        case '240p':
          formatSelector = 'bestvideo[height<=240]+bestaudio/best[height<=240]';
          break;
        case '360p':
          formatSelector = 'bestvideo[height<=360]+bestaudio/best[height<=360]';
          break;
        case '480p':
          formatSelector = 'bestvideo[height<=480]+bestaudio/best[height<=480]';
          break;
        case '720p':
          formatSelector = 'bestvideo[height<=720]+bestaudio/best[height<=720]';
          break;
        case '1080p':
          formatSelector = 'bestvideo[height<=1080]+bestaudio/best[height<=1080]';
          break;
        default:
          formatSelector = 'bestvideo[height<=720]+bestaudio/best[height<=720]';
      }

      // 🧩 Step 1: Download raw format
      const rawOutPath = join(tmpdir(), `${title}.%(ext)s`);
      const ytCmd = `yt-dlp -f "${formatSelector}" -o "${rawOutPath}" "${url}"`;
      await execPromise(ytCmd);

      // 🔍 Find downloaded file name
      const allFiles = fs.readdirSync(tmpdir());
      const rawFileName = allFiles.find(name => name.startsWith(title) && !name.endsWith('.mp4'));
      const rawFilePath = join(tmpdir(), rawFileName);

      // 🎞 Step 2: Convert using ffmpeg to proper MP4
      const ffmpegCmd = `ffmpeg -i "${rawFilePath}" -c:v libx264 -c:a aac -strict experimental "${finalPath}" -y`;
      await execPromise(ffmpegCmd);

      // 🧹 Step 3: Delete raw file
      if (fs.existsSync(rawFilePath)) {
        fs.unlinkSync(rawFilePath);
      }
    }

    // ✅ Send final file
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
    stream.on('close', () => fs.unlinkSync(finalPath)); // cleanup
  } catch (error) {
    console.error('❌ Download error:', error);
    return res.status(500).json({
      error: 'Download failed',
      details: error.message,
    });
  }
}

export default handler
