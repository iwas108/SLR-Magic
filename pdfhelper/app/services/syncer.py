import subprocess
import logging

from app.repository import db

logger = logging.getLogger(__name__)

def run_syncer(is_cancelled=None):
    source_folders = db.get_config("SYNCER_SOURCE_FOLDERS")
    remote_gdrive = db.get_config("SYNCER_REMOTE_GDRIVE")
    dest_backup = db.get_config("SYNCER_DEST_BACKUP")

    logger.info("Starting rclone sync process...")
    success_count = 0
    total_count = len(source_folders)

    for folder in source_folders:
        if is_cancelled and is_cancelled():
            logger.info("Sync cancelled by user.")
            break

        logger.info(f"Syncing folder: {folder}")
        try:
            # Execute rclone sync command
            cmd = [
                "rclone", "sync", folder,
                f"{remote_gdrive}:{dest_backup}/{folder}",
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
