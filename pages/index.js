'use client';
import { useState } from 'react';

export default function Home() {
  const [url, setUrl] = useState('');
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (!url) return alert('Please enter a YouTube video URL');

    setDownloading(true);
    try {
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) throw new Error('Download failed');

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = 'video.mp4';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      alert(err.message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-900 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-gray-800 p-6 rounded-2xl shadow-lg">
        <h1 className="text-2xl font-bold mb-4 text-center text-white">🎥 YouTube Video Downloader</h1>
        <input
          type="text"
          placeholder="Paste YouTube video URL"
          className="w-full p-3 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition duration-200 disabled:opacity-50"
        >
          {downloading ? 'Downloading...' : 'Download Video'}
        </button>
        <p className="text-sm text-gray-400 mt-4 text-center">
          Enter a valid YouTube URL. The video will be downloaded as <strong>.mp4</strong>.
        </p>
      </div>
    </main>
  );
}