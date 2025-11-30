import { useState } from 'react';

export default function Home() {
  const [url, setUrl] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [quality, setQuality] = useState('720p');
  const [audioOnly, setAudioOnly] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [message, setMessage] = useState({ type: '', text: '' });

  const qualityOptions = [
    { value: '144p', label: '144p' },
    { value: '240p', label: '240p' },
    { value: '360p', label: '360p' },
    { value: '480p', label: '480p' },
    { value: '720p', label: '720p HD' },
    { value: '1080p', label: '1080p Full HD' },
  ];

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  const handleDownload = async () => {
    if (!url || (!url.includes('youtube.com') && !url.includes('youtu.be'))) {
      showMessage('error', 'Please enter a valid YouTube URL');
      return;
    }
    setDownloading(true);
    setDownloadProgress(0);
    
    try {
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, quality, audioOnly })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.details || errorData.error || `Server error: ${res.status}`);
      }

      const contentLength = res.headers.get('Content-Length');
      const disposition = res.headers.get('Content-Disposition');
      const contentType = res.headers.get('Content-Type');
      if (!contentLength || contentLength === '0') {
        throw new Error('Downloaded file is empty. Please try again.');
      }

      let filename = 'download';
      if (disposition) {
        const filenameMatch = disposition.match(/filename="(.+?)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      if (filename === 'download') {
        filename = audioOnly ? 'audio.mp3' : 'video.mp4';
      }

      const reader = res.body.getReader();
      const chunks = [];
      let receivedLength = 0;
      const total = parseInt(contentLength);

      const progressInterval = setInterval(() => {
        if (total > 0) {
          const progress = Math.min(Math.round((receivedLength / total) * 100), 100);
          setDownloadProgress(progress);
        }
      }, 100);

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          receivedLength += value.length;
        }
      } finally {
        clearInterval(progressInterval);
      }

      if (receivedLength !== total) {
        console.warn(`Expected ${total} bytes but received ${receivedLength} bytes`);
      }

      const mimeType = contentType || (audioOnly ? 'audio/mpeg' : 'video/mp4');
      const blob = new Blob(chunks, { type: mimeType });

      if (blob.size === 0) {
        throw new Error('Downloaded file is empty. Please try again.');
      }

      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        try {
          document.body.removeChild(a);
          window.URL.revokeObjectURL(blobUrl);
        } catch (cleanupError) {
          console.warn('Cleanup error:', cleanupError);
        }
      }, 100);

      setDownloadProgress(100);
      
      showMessage('success', audioOnly 
        ? `Audio downloaded successfully! 🎵 (${(blob.size / 1024 / 1024).toFixed(1)}MB)` 
        : `Video downloaded successfully! 🎬 (${(blob.size / 1024 / 1024).toFixed(1)}MB)`
      );

    } catch (err) {
      console.error('Download error:', err);
      let errorMessage = 'Download failed. Please try again.';
      if (err.name === 'AbortError') {
        errorMessage = 'Download timeout. Please try with lower quality.';
      } else if (err.message.includes('network') || err.message.includes('NetworkError')) {
        errorMessage = 'Network error. Please check your connection.';
      } else if (err.message.includes('empty')) {
        errorMessage = 'Downloaded file is empty. Video may be unavailable.';
      } else if (err.message.includes('not available')) {
        errorMessage = 'Video not available or private.';
      } else if (err.message.includes('format')) {
        errorMessage = 'Requested quality not available. Try lower quality.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      showMessage('error', errorMessage);
    } finally {
      setDownloading(false);
      setTimeout(() => {
        setDownloadProgress(0);
      }, 2000);
    }
  };

  return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-4">
      {message.text && (
        <div className={`fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
          message.type === 'success' ? 'bg-green-600' : 'bg-red-600'
        }`}>
          <div className="flex items-center gap-2">
            <span>{message.type === 'success' ? '✅' : '❌'}</span>
            <span>{message.text}</span>
          </div>
        </div>
      )}
      <div className="w-full max-w-md bg-gray-800 p-6 rounded-2xl shadow-lg">
        <h1 className="text-2xl font-bold mb-6 text-center">YouTube Video Downloader</h1>
        <input
          type="text"
          placeholder="Paste YouTube video URL here..."
          className="w-full p-3 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4 transition-all"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={downloading}
        />
        <div className="mb-4">
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={audioOnly}
              onChange={(e) => setAudioOnly(e.target.checked)}
              className="sr-only"
              disabled={downloading}
            />
            <div className={`relative w-11 h-6 rounded-full transition-colors ${
              audioOnly ? 'bg-blue-600' : 'bg-gray-600'
            } ${downloading ? 'opacity-50' : ''}`}>
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                audioOnly ? 'translate-x-5' : 'translate-x-0'
              }`}></div>
            </div>
            <span className="ml-3 text-sm font-medium">
              🎵 Audio Only ({audioOnly ? 'ON' : 'OFF'})  
            </span>
          </label>
        </div>
        {!audioOnly && (
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">📽️ Video Quality</label>
            <select
              value={quality}
              onChange={(e) => setQuality(e.target.value)}
              className="w-full p-3 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={downloading}
            >
              {qualityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}
        {downloading && (
          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-400 mb-1">
              <span>
                {downloadProgress === 0 ? 'Initializing...' : 
                 downloadProgress < 100 ? 'Downloading...' : 
                 'Completing...'}
              </span>
              <span>{downloadProgress}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${downloadProgress}%` }}
              ></div>
            </div>
          </div>
        )}
        <button
          onClick={handleDownload}
          disabled={downloading || !url}
          className={`w-full font-semibold py-3 rounded-lg transition duration-200 flex items-center justify-center ${
            downloading || !url
              ? 'bg-gray-600 cursor-not-allowed opacity-50'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {downloading ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              {downloadProgress === 0 ? 'Processing...' : 
               downloadProgress < 100 ? `Downloading... ${downloadProgress}%` : 
               'Finishing...'}
            </>
          ) : (
            <>
              {audioOnly ? '🎵 Download Audio' : '🎬 Download Video'}
            </>
          )}
        </button>
        <p className="text-sm text-gray-400 mt-4 text-center">
          Enter a valid YouTube URL. {audioOnly ? 'Audio will be downloaded as MP3.' : `Video will be downloaded as MP4 in ${quality} quality.`}
        </p>
      </div>
    </main>
  );
}

