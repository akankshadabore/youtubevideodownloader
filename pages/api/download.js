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
    const { stdout: titleRaw } = await execPromise(`yt-dlp --get-title "${url}"`);
    const title = titleRaw.trim().replace(/[<>:"/\\|?*]+/g, '');
    let filename = audioOnly ? `${title}.mp3` : `${title}.mp4`;
    const finalPath = join(tmpdir(), filename);

    if (audioOnly) {
      const audioPath = finalPath.replace('.mp3', '.%(ext)s');
      const cmd = `yt-dlp -f bestaudio --extract-audio --audio-format mp3 -o "${audioPath}" "${url}"`;
      const { stdout, stderr } = await execPromise(cmd);
      console.log('yt-dlp audio stdout:', stdout);
      console.log('yt-dlp audio stderr:', stderr);
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
      const ytCmd = `yt-dlp -f "${formatSelector}" -o "${rawOutPath}" "${url}"`;
      const { stdout, stderr } = await execPromise(ytCmd);
      console.log('yt-dlp video stdout:', stdout);
      console.log('yt-dlp video stderr:', stderr);

      const allFiles = fs.readdirSync(tmpdir());
      const possible = allFiles.filter(name => name.startsWith(title));
      console.log('Possible files after yt-dlp:', possible);

      let rawFileName = possible.find(name => !name.endsWith('.mp4'));
      if (!rawFileName && possible.includes(`${title}.mp4`)) {
        rawFileName = `${title}.mp4`;
      }

      if (!rawFileName) {
        throw new Error('Raw video file not found after download. yt-dlp may have failed.');
      }

      const rawFilePath = join(tmpdir(), rawFileName);

      // Only convert if not already mp4
      if (!rawFileName.endsWith('.mp4')) {
        const ffmpegCmd = `ffmpeg -i "${rawFilePath}" -c:v libx264 -c:a aac -strict experimental "${finalPath}" -y`;
        const { stdout: ffstdout, stderr: ffstderr } = await execPromise(ffmpegCmd);
        console.log('ffmpeg stdout:', ffstdout);
        console.log('ffmpeg stderr:', ffstderr);
        // Cleanup
        if (fs.existsSync(rawFilePath)) fs.unlinkSync(rawFilePath);
      } else if (!fs.existsSync(finalPath) && fs.existsSync(rawFilePath)) {
        // If already mp4, move to finalPath
        fs.renameSync(rawFilePath, finalPath);
      }
    }

    if (!fs.existsSync(finalPath)) {
      throw new Error('File not created. Please try again.');
    }

    const stat = fs.statSync(finalPath);
    const contentType = audioOnly ? 'audio/mpeg' : 'video/mp4';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', stat.size);

    const stream = fs.createReadStream(finalPath);
    stream.pipe(res);
    stream.on('close', () => fs.unlinkSync(finalPath));
  } catch (error) {
    console.error('❌ Download error:', error);
    return res.status(500).json({
      error: 'Download failed',
      details: error.message,
    });
  }
}

export default handler;
