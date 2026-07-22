import os
from python_engine.core.config import PROJECT_DIR

class ScraperConfig:
    def __init__(self, conn):
        cursor = conn.cursor()
        cursor.execute("SELECT key, value FROM configs")
        rows = cursor.fetchall()
        configs = {r[0]: r[1] for r in rows}

        self.proxy_base_url = configs.get('SCRAPER_PROXY_BASE_URL', 'https://ezproxy.library.domain.com/login?url=https://doi.org/')
        self.delay_seconds = float(configs.get('SCRAPER_DELAY_SECONDS', 20))
        self.jitter_seconds = float(configs.get('SCRAPER_JITTER_SECONDS', 5))
        self.headed_mode = configs.get('SCRAPER_HEADED_MODE', 'false').lower() == 'true'
        self.chrome_profile_dir = configs.get('SCRAPER_CHROME_PROFILE_DIR', os.path.join(PROJECT_DIR, 'chrome_profile'))
        
        if not os.path.isabs(self.chrome_profile_dir):
            self.chrome_profile_dir = os.path.abspath(os.path.join(PROJECT_DIR, self.chrome_profile_dir))
