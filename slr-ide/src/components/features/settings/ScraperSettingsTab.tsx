import React from 'react';

interface ScraperSettingsTabProps {
  configs: Record<string, string>;
  handleChange: (key: string, value: string) => void;
}

export default function ScraperSettingsTab({
  configs,
  handleChange
}: ScraperSettingsTabProps) {
  return (
    <div className="space-y-4 text-xs animate-in fade-in duration-200">
      <div className="space-y-1.5">
        <label className="block text-xs font-semibold text-muted-foreground">EzProxy Base Login URL</label>
        <input
          type="text"
          className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary font-mono text-[11px]"
          value={configs.SCRAPER_PROXY_BASE_URL || ''}
          onChange={(e) => handleChange('SCRAPER_PROXY_BASE_URL', e.target.value)}
          placeholder="https://ezproxy.library.domain.com/login?url=https://doi.org/"
        />
        <p className="text-[10px] text-muted-foreground">The proxy redirection URL used to bypass publisher paywalls during automated scraping.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-muted-foreground">Scraper Base Delay (Seconds)</label>
          <input
            type="number"
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary font-mono text-[11px]"
            value={configs.SCRAPER_DELAY_SECONDS || '20'}
            onChange={(e) => handleChange('SCRAPER_DELAY_SECONDS', e.target.value)}
            min="1"
          />
          <p className="text-[10px] text-muted-foreground">Delay duration applied after each download to respect rate limits.</p>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-muted-foreground">Scraper Random Jitter (Seconds)</label>
          <input
            type="number"
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary font-mono text-[11px]"
            value={configs.SCRAPER_JITTER_SECONDS || '5'}
            onChange={(e) => handleChange('SCRAPER_JITTER_SECONDS', e.target.value)}
            min="0"
          />
          <p className="text-[10px] text-muted-foreground">Adds a random value between 0 and this number to the delay to mimic human behavior.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-muted-foreground">Fuzzy Title Match Threshold (%)</label>
          <input
            type="number"
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary font-mono text-[11px]"
            value={configs.FUZZY_MATCH_THRESHOLD || '90'}
            onChange={(e) => handleChange('FUZZY_MATCH_THRESHOLD', e.target.value)}
            min="1"
            max="100"
          />
          <p className="text-[10px] text-muted-foreground">Required percentage similarity for fuzzy matching cached file names to paper titles.</p>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-muted-foreground">Minimum PDF File Size (KB)</label>
          <input
            type="number"
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary font-mono text-[11px]"
            value={configs.PDF_VERIFY_MIN_SIZE_KB || '55'}
            onChange={(e) => handleChange('PDF_VERIFY_MIN_SIZE_KB', e.target.value)}
            min="1"
          />
          <p className="text-[10px] text-muted-foreground">Files below this size are flagged as NEEDS_REVIEW during verification. Default: 55 KB.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-muted-foreground">Chrome Browser Visibility</label>
          <div className="flex items-center h-10">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={configs.SCRAPER_HEADED_MODE === 'true'}
                onChange={(e) => handleChange('SCRAPER_HEADED_MODE', String(e.target.checked))}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
              <span className="ml-3 text-xs font-semibold text-foreground">
                {configs.SCRAPER_HEADED_MODE === 'true' ? 'Headed Mode (Visible window)' : 'Headless Mode (Background)'}
              </span>
            </label>
          </div>
          <p className="text-[10px] text-muted-foreground">Headed mode is recommended if manual login or captcha solving is required.</p>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-muted-foreground">Chrome User Profile Location</label>
          <input
            type="text"
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary font-mono text-[11px]"
            value={configs.SCRAPER_CHROME_PROFILE_DIR || ''}
            onChange={(e) => handleChange('SCRAPER_CHROME_PROFILE_DIR', e.target.value)}
            placeholder="./chrome_profile"
          />
          <p className="text-[10px] text-muted-foreground">Location to store cookies and persistent Chrome sessions.</p>
        </div>
      </div>

      <div className="border-t border-border my-2 pt-2">
        <h4 className="text-xs font-bold text-foreground mb-3">Tesseract OCR (Scanned PDFs fallback)</h4>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-muted-foreground">Enable Tesseract OCR</label>
            <div className="flex items-center h-10">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={configs.OCR_ENABLED === 'true'}
                  onChange={(e) => handleChange('OCR_ENABLED', String(e.target.checked))}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                <span className="ml-3 text-xs font-semibold text-foreground">
                  {configs.OCR_ENABLED === 'true' ? 'Enabled' : 'Disabled'}
                </span>
              </label>
            </div>
            <p className="text-[10px] text-muted-foreground">Perform OCR scan on first page if standard PDF text extraction returns empty.</p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-muted-foreground">Tesseract Executable Path</label>
            <input
              type="text"
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary font-mono text-[11px]"
              value={configs.TESSERACT_PATH || 'tesseract'}
              onChange={(e) => handleChange('TESSERACT_PATH', e.target.value)}
              placeholder="e.g., C:\Program Files\Tesseract-OCR\tesseract.exe"
            />
            <p className="text-[10px] text-muted-foreground">Specify path if tesseract is not on system path. Default is &apos;tesseract&apos;.</p>
          </div>
        </div>
      </div>

      <div className="border-t border-border my-2 pt-2">
        <h4 className="text-xs font-bold text-foreground mb-3">PDF Compression & Quality Settings</h4>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-muted-foreground">Enable PDF Compression</label>
            <div className="flex items-center h-10">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={configs.PDF_COMPRESSION_ENABLED === 'true'}
                  onChange={(e) => handleChange('PDF_COMPRESSION_ENABLED', String(e.target.checked))}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                <span className="ml-3 text-xs font-semibold text-foreground">
                  {configs.PDF_COMPRESSION_ENABLED === 'true' ? 'Enabled' : 'Disabled'}
                </span>
              </label>
            </div>
            <p className="text-[10px] text-muted-foreground">Compress PDFs incrementally before syncing to cloud storage.</p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-muted-foreground">Compression Level</label>
            <select
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary font-semibold text-[11px]"
              value={configs.PDF_COMPRESSION_LEVEL || '/ebook'}
              onChange={(e) => handleChange('PDF_COMPRESSION_LEVEL', e.target.value)}
            >
              <option value="/screen">Screen (72 DPI, Aggressive, Low Size)</option>
              <option value="/ebook">Ebook (150 DPI, Recommended, Balanced)</option>
              <option value="/printer">Printer (300 DPI, High Quality, Large Size)</option>
            </select>
            <p className="text-[10px] text-muted-foreground">Quality profile settings mapped to Ghostscript options.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-3">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-muted-foreground">Embed All Fonts</label>
            <div className="flex items-center h-10">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={configs.PDF_COMPRESSION_EMBED_ALL_FONTS !== 'false'}
                  onChange={(e) => handleChange('PDF_COMPRESSION_EMBED_ALL_FONTS', String(e.target.checked))}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                <span className="ml-3 text-xs font-semibold text-foreground">
                  {configs.PDF_COMPRESSION_EMBED_ALL_FONTS !== 'false' ? 'Enabled' : 'Disabled'}
                </span>
              </label>
            </div>
            <p className="text-[10px] text-muted-foreground">Force embedding of all fonts inside the compressed PDF files.</p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-muted-foreground">Subset Embedded Fonts</label>
            <div className="flex items-center h-10">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={configs.PDF_COMPRESSION_SUBSET_FONTS !== 'false'}
                  onChange={(e) => handleChange('PDF_COMPRESSION_SUBSET_FONTS', String(e.target.checked))}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                <span className="ml-3 text-xs font-semibold text-foreground">
                  {configs.PDF_COMPRESSION_SUBSET_FONTS !== 'false' ? 'Enabled' : 'Disabled'}
                </span>
              </label>
            </div>
            <p className="text-[10px] text-muted-foreground">Subset embedded fonts to reduce size. May cause exploded text or text corruption on some systems if disabled.</p>
          </div>
        </div>

        <div className="space-y-1.5 mt-3">
          <label className="block text-xs font-semibold text-muted-foreground">Ghostscript Executable Path (Optional)</label>
          <input
            type="text"
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary font-mono text-[11px]"
            value={configs.GHOSTSCRIPT_PATH || ''}
            onChange={(e) => handleChange('GHOSTSCRIPT_PATH', e.target.value)}
            placeholder="Auto-detect (e.g. gs, gswin64c, gswin32c)"
          />
          <p className="text-[10px] text-muted-foreground">Leave empty to auto-detect Ghostscript binaries using system environment PATH.</p>
        </div>
      </div>
    </div>
  );
}
