import { exec } from 'child_process';
import { promisify } from 'util';
import { tmpdir } from 'os';
import { join } from 'path';
import fs from 'fs';

const execPromise = promisify(exec);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body;

  if (!url || (!url.includes('youtube.com') && !url.includes('youtu.be'))) {
    return res.status(400).json({ error: 'Invalid YouTube URL' });
  }

  try {
    const filename = `yt-${Date.now()}.mp4`;
    const filepath = join(tmpdir(), filename);

    await execPromise(`yt-dlp -o "${filepath}" "${url}"`);

    const stat = fs.statSync(filepath);
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', 'attachment; filename="video.mp4"');
    res.setHeader('Content-Length', stat.size);

    const stream = fs.createReadStream(filepath);
    stream.pipe(res);

    stream.on('close', () => fs.unlinkSync(filepath));
  } catch (error) {
    console.error('yt-dlp error:', error);
    return res.status(500).json({ error: 'yt-dlp failed to download the video' });
  }
}
