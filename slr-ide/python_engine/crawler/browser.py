import undetected_chromedriver as uc
import platform
import subprocess
import os
import glob
import time
import sys
import json
from python_engine.crawler.navigator import Navigator

def get_chrome_version():
    system = platform.system()
    try:
        if system == 'Windows':
            import winreg
            key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, r'Software\Google\Chrome\BLBeacon')
            version, _ = winreg.QueryValueEx(key, 'version')
            return int(version.split('.')[0])
        elif system == 'Darwin':
            process = subprocess.run(['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '--version'], capture_output=True, text=True, check=True)
            return int(process.stdout.strip().split()[-1].split('.')[0])
        elif system == 'Linux':
            commands = ['google-chrome --version', 'google-chrome-stable --version', 'chromium-browser --version', 'chromium --version']
            for cmd in commands:
                try:
                    process = subprocess.run(cmd.split(), capture_output=True, text=True, check=True)
                    return int(process.stdout.strip().split()[-1].split('.')[0])
                except:
                    continue
    except:
        pass
    return None

class BrowserHandler:
    def __init__(self, download_dir, config):
        self.download_dir = download_dir
        self.config = config
        self.driver = None
        self.navigator = None

    def start_browser(self):
        options = uc.ChromeOptions()
        prefs = {
            "download.default_directory": self.download_dir,
            "download.prompt_for_download": False,
            "download.directory_upgrade": True,
            "plugins.always_open_pdf_externally": True
        }
        options.add_experimental_option("prefs", prefs)

        version = get_chrome_version()
        try:
            if version:
                self.driver = uc.Chrome(options=options, version_main=version, user_data_dir=self.config.chrome_profile_dir)
            else:
                self.driver = uc.Chrome(options=options, user_data_dir=self.config.chrome_profile_dir)
        except Exception as e:
            print(json.dumps({"event": "error", "message": f"Failed to start Chrome browser: {str(e)}"}))
            sys.exit(1)
            
        self.navigator = Navigator(self)

    def stop_browser(self):
        if self.driver:
            try:
                self.driver.quit()
            except:
                pass

    def is_alive(self):
        if not self.driver: return False
        try:
            _ = self.driver.current_url
            return True
        except:
            return False

    def clear_download_folder(self):
        if os.path.exists(self.download_dir):
            for f in glob.glob(os.path.join(self.download_dir, "*")):
                try:
                    os.remove(f)
                except:
                    pass

    def wait_for_download(self, timeout=45):
        start_time = time.time()
        while time.time() - start_time < timeout:
            try:
                files = glob.glob(os.path.join(self.download_dir, "*"))
                valid_files = [f for f in files if not f.endswith('.crdownload') and not f.endswith('.tmp')]
                if valid_files:
                    return max(valid_files, key=os.path.getctime)
            except:
                pass
            time.sleep(1)
        return None

    def cleanup_tabs(self, main_handle):
        try:
            if not self.driver or not main_handle:
                return
            handles = self.driver.window_handles
            if len(handles) > 1:
                print(json.dumps({"event": "log", "message": f"Cleaning up {len(handles) - 1} extra tabs..."}))
                sys.stdout.flush()
                for h in handles:
                    if h != main_handle:
                        try:
                            self.driver.switch_to.window(h)
                            self.driver.close()
                        except:
                            pass
                self.driver.switch_to.window(main_handle)
        except Exception as e:
            print(json.dumps({"event": "log", "message": f"Warning during tab cleanup: {str(e)}"}))
            sys.stdout.flush()

    def check_download_occurred(self):
        try:
            files = glob.glob(os.path.join(self.download_dir, "*"))
            valid_files = [f for f in files if not f.endswith('.crdownload') and not f.endswith('.tmp')]
            return len(valid_files) > 0
        except:
            return False

    def wait_for_immediate_download(self, max_wait=4.0):
        start = time.time()
        while time.time() - start < max_wait:
            if self.check_download_occurred():
                return True
            time.sleep(0.5)
        return False

    def attempt_download(self, doi):
        if not self.driver:
            return None

        main_handle = None
        try:
            main_handle = self.driver.current_window_handle
        except:
            pass

        if doi.startswith('http://') or doi.startswith('https://'):
            target_url = doi
        else:
            target_url = f"{self.config.proxy_base_url}{doi}"

        try:
            self.driver.get(target_url)
            time.sleep(5)

            current_url = self.driver.current_url.lower()

            pdf_url = self.navigator.cascade_find_pdf(current_url)

            result_file = None
            if pdf_url == "ALREADY_DOWNLOADED":
                result_file = self.wait_for_download()
            elif pdf_url:
                self.driver.get(pdf_url)
                result_file = self.wait_for_download()

            self.cleanup_tabs(main_handle)
            return result_file

        except Exception as e:
            print(json.dumps({"event": "error", "message": f"Browser navigation error for {doi}: {str(e)}"}))
            self.cleanup_tabs(main_handle)
            return None
