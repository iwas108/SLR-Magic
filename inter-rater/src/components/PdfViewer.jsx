import React, { useState, useEffect } from 'react';

const convertBase64ToBlobUrl = (base64) => {
  try {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'application/pdf' });
    return URL.createObjectURL(blob);
  } catch (e) {
    console.error('Failed to convert base64 to blob:', e);
    return null;
  }
};

const PdfViewer = ({ url, base64 }) => {
  const [tier, setTier] = useState(1); // 1: Native iframe, 2: Google Docs viewer, 3: Error fallback
  const [loading, setLoading] = useState(true);
  const [blobUrl, setBlobUrl] = useState(null);

  useEffect(() => {
    if (!base64) {
      setBlobUrl(null);
      setTier(1);
      setLoading(true);
      return;
    }

    setLoading(true);
    const urlString = convertBase64ToBlobUrl(base64);
    setBlobUrl(urlString);
    setLoading(false);

    return () => {
      if (urlString) {
        URL.revokeObjectURL(urlString);
      }
    };
  }, [base64]);

  useEffect(() => {
    if (base64) return; // Skip fallbacks for base64 PDFs

    if (tier === 3) {
      setLoading(false);
      return;
    }

    setLoading(true);
    // Timeout for loading indicator and fallback cascade
    const duration = tier === 1 ? 8000 : 10000;
    const timer = setTimeout(() => {
      if (loading) {
        handleFallback();
      }
    }, duration);

    return () => clearTimeout(timer);
  }, [tier, url, loading, base64]);

  const handleLoad = () => {
    setLoading(false);
  };

  const handleFallback = () => {
    if (tier < 3) {
      setTier(prev => prev + 1);
    } else {
      setLoading(false);
    }
  };

  if (!url && !base64) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-900 border border-dashed border-gray-200 dark:border-gray-800 rounded-xl h-full min-h-[400px]">
        <p className="text-sm text-gray-500 dark:text-gray-400">No PDF content or link available for this paper.</p>
      </div>
    );
  }

  // Generate URLs based on tier (if not using base64)
  const getEmbedUrl = () => {
    if (base64) {
      return blobUrl || '';
    }
    if (tier === 1) {
      return url;
    }
    if (tier === 2) {
      return `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;
    }
    return '';
  };

  return (
    <div className="flex flex-col h-full min-h-[500px] bg-white dark:bg-gray-900 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 relative">
      <div className="flex-1 relative bg-gray-100 dark:bg-gray-950">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100/80 dark:bg-gray-950/80 z-10">
            <svg className="animate-spin h-8 w-8 text-blue-600 dark:text-blue-400 mb-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Loading PDF {base64 ? 'from Embedded Offline Source' : `via ${tier === 1 ? 'Direct Link' : 'Google Viewer Proxy'}`}...
            </p>
          </div>
        )}

        {(base64 || tier <= 2) ? (
          getEmbedUrl() ? (
            <iframe
              src={getEmbedUrl()}
              className="w-full h-full border-none"
              onLoad={handleLoad}
              onError={handleFallback}
              title="PDF Reader Frame"
            />
          ) : null
        ) : (
          <div className="flex flex-col items-center justify-center p-8 text-center h-full min-h-[350px] bg-white dark:bg-gray-900">
            <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-955/40 flex items-center justify-center mb-3 border border-rose-100 dark:border-rose-900/40">
              <svg className="w-6 h-6 text-rose-600 dark:text-rose-450" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200">Unable to load embedded PDF</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm">
              The PDF could not be loaded directly or via proxy. This is common if the server prevents cross-origin embedding.
            </p>
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md transition-colors text-xs flex items-center gap-1.5"
              >
                <span>Open PDF in new tab</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PdfViewer;
