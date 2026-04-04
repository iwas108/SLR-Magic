import subprocess
import logging

logger = logging.getLogger(__name__)

class SyncerConfig:
    SOURCE_FOLDERS = ["compressed"]
    REMOTE_GDRIVE = "gdrive"
    DEST_BACKUP = "00 PHD Research/My First SLR/PDFs"

def run_syncer():
    logger.info("Starting rclone sync process...")
    success_count = 0
    total_count = len(SyncerConfig.SOURCE_FOLDERS)

    for folder in SyncerConfig.SOURCE_FOLDERS:
        logger.info(f"Syncing folder: {folder}")
        try:
            # Execute rclone sync command
            cmd = [
                "rclone", "sync", folder,
                f"{SyncerConfig.REMOTE_GDRIVE}:{SyncerConfig.DEST_BACKUP}/{folder}",
                "-L", "--progress", "--create-empty-src-dirs"
            ]

            result = subprocess.run(cmd, check=True, capture_output=True, text=True)
            logger.info(f"SUCCESS: Sync for {folder} completed.")
            success_count += 1
        except subprocess.CalledProcessError as e:
            logger.error(f"FAILED: Error syncing {folder}. Details: {e.stderr}")
        except FileNotFoundError:
            msg = "rclone command not found. Please make sure rclone is installed and in PATH."
            logger.error(msg)
            return {"status": "error", "message": msg}

    logger.info("Sync process completed.")
    if success_count == total_count:
        return {"status": "success", "message": f"Successfully synced {success_count}/{total_count} folders."}
    else:
        return {"status": "warning", "message": f"Synced {success_count}/{total_count} folders with some errors."}
