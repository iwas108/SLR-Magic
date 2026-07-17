import os
import subprocess
import sys
import shutil
import json
import platform
import sqlite3
from pathlib import Path

from python_engine.core.config import PROJECT_DIR, DB_PATH, RAW_DIR, REPO_DIR, MANIFEST_FILE
from python_engine.core.events import throttle_print
from python_engine.pdf.compressor import get_ghostscript_command, compress_pdf

def load_manifest(manifest_path):
    if manifest_path.exists():
        try:
            with open(manifest_path, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return {}
    return {}

def save_manifest(manifest_path, data):
    try:
        manifest_path.parent.mkdir(parents=True, exist_ok=True)
        with open(manifest_path, 'w') as f:
            json.dump(data, f, indent=4)
    except IOError as e:
        print(json.dumps({"info": f"[WARNING]: Could not save manifest file: {e}"}))

def main():
    # 1. Setup environment
    if not RAW_DIR.exists():
        RAW_DIR.mkdir(parents=True, exist_ok=True)
    if not REPO_DIR.exists():
        REPO_DIR.mkdir(parents=True, exist_ok=True)

    # Load configuration from SQLite
    enabled = False
    level = "/ebook"
    custom_gs_path = None
    
    active_proj_id = 'default-project'
    folder_name = 'default_project'
    papers = []
    
    if DB_PATH.exists():
        try:
            conn = sqlite3.connect(str(DB_PATH), timeout=30.0)
            conn.execute("PRAGMA journal_mode=WAL")
            cursor = conn.cursor()
            cursor.execute("SELECT key, value FROM configs WHERE key IN ('PDF_COMPRESSION_ENABLED', 'PDF_COMPRESSION_LEVEL', 'GHOSTSCRIPT_PATH', 'ACTIVE_PROJECT_ID')")
            rows = cursor.fetchall()
            configs = {r[0]: r[1] for r in rows}
            
            enabled = configs.get('PDF_COMPRESSION_ENABLED', 'false').lower() == 'true'
            level = configs.get('PDF_COMPRESSION_LEVEL', '/ebook')
            custom_gs_path = configs.get('GHOSTSCRIPT_PATH', '')
            active_proj_id = configs.get('ACTIVE_PROJECT_ID', 'default-project')
            
            cursor.execute("SELECT folder_name FROM projects WHERE id = ?", (active_proj_id,))
            proj_row = cursor.fetchone()
            if proj_row:
                folder_name = proj_row[0]
                
            force_update = '--force-update' in sys.argv
            status_in = "('MATCHED', 'DOWNLOADED', 'SYNCED')" if force_update else "('MATCHED', 'DOWNLOADED')"
            
            cursor.execute(f"SELECT Paper_ID, Local_PDF_Path FROM papers WHERE Project_ID = ? AND Local_PDF_Status IN {status_in} AND (is_duplicate IS NULL OR is_duplicate = 0)", (active_proj_id,))
            papers = cursor.fetchall()
            conn.close()
        except Exception as e:
            print(json.dumps({"info": f"[WARNING]: Database query failed: {e}. Falling back to default settings."}))
            sys.stdout.flush()
    else:
        print(json.dumps({"info": "[WARNING]: Database not found. Falling back to default settings."}))
        sys.stdout.flush()

    # Re-evaluate OUTPUT and MANIFEST based on project folder name
    project_output_dir = PROJECT_DIR / 'pdf_library' / 'repo' / folder_name
    project_output_dir.mkdir(parents=True, exist_ok=True)
    project_manifest_file = PROJECT_DIR / 'db' / f'compression_manifest_{folder_name}.json'

    # Get GS command if enabled
    gs_command = None
    if enabled:
        gs_command = get_ghostscript_command(custom_gs_path)
        if not gs_command:
            print(json.dumps({
                "info": "[WARNING]: Ghostscript executable not found in PATH or config. Falling back to copy original file (no compression)."
            }))
            sys.stdout.flush()
            enabled = False # disable compression, fallback to copy

    manifest = load_manifest(project_manifest_file)
    
    # Filter only papers that have a valid local PDF file path on disk
    valid_papers = []
    for paper_id, local_path in papers:
        if local_path:
            full_input_path = PROJECT_DIR / local_path.replace('/', os.sep)
            if full_input_path.exists():
                valid_papers.append((paper_id, full_input_path))

    print(json.dumps({"event": "start", "total": len(valid_papers)}))
    sys.stdout.flush()
    
    if not valid_papers:
        print(json.dumps({"event": "complete", "processed": 0, "skipped": 0}))
        sys.stdout.flush()
        return

    processed_count = 0
    skipped_count = 0
    saved_space = 0
    current_filenames = []

    for idx, (paper_id, pdf) in enumerate(valid_papers):
        manifest_key = f"{paper_id}.pdf"
        current_filenames.append(manifest_key)
        output_path = project_output_dir / manifest_key

        try:
            current_mtime = pdf.stat().st_mtime
            current_size = pdf.stat().st_size
        except OSError:
            skipped_count += 1
            continue

        needs_processing = False
        reason = ""

        if manifest_key not in manifest:
            needs_processing = True
            reason = "New file"
        elif manifest[manifest_key].get("mtime") != current_mtime:
            needs_processing = True
            reason = "Source modified"
        elif not output_path.exists():
            needs_processing = True
            reason = "Output missing"

        # If settings changed (e.g. compression toggle), manifest might be present but uncompressed
        is_already_compressed = manifest.get(manifest_key, {}).get("compressed", False)
        if needs_processing == False and enabled and not is_already_compressed:
            needs_processing = True
            reason = "Compression enabled"

        if needs_processing:
            success = False
            ratio = 0.0
            new_size = current_size
            is_compressed = False

            if enabled and gs_command:
                # Run ghostscript compression
                success = compress_pdf(gs_command, level, pdf, output_path)
                if success and output_path.exists():
                    from python_engine.pdf.validator import validate_compressed_pdf
                    is_valid, err_msg = validate_compressed_pdf(str(output_path))
                    if is_valid:
                        new_size = output_path.stat().st_size
                        ratio = (1 - (new_size / current_size)) * 100
                        saved_space += (current_size - new_size)
                        is_compressed = True
                        success = True
                    else:
                        print(json.dumps({
                            "info": f"[WARNING]: Compressed PDF validation failed for {paper_id}: {err_msg}. Falling back to copy original file."
                        }))
                        sys.stdout.flush()
                        success = False
                else:
                    success = False
            
            # Fallback to direct copy if disabled OR compression failed
            if not success:
                try:
                    shutil.copy2(pdf, output_path)
                    new_size = current_size
                    ratio = 0.0
                    is_compressed = False
                    success = True
                except Exception as e:
                    print(json.dumps({"info": f"[ERROR]: Failed to copy file {pdf.name}: {e}"}))
                    sys.stdout.flush()
                    success = False

            if success:
                manifest[manifest_key] = {
                    "mtime": current_mtime,
                    "original_size": current_size,
                    "compressed_size": new_size,
                    "compressed": is_compressed
                }
                processed_count += 1
                
                print(json.dumps({
                    "event": "progress",
                    "current": idx + 1,
                    "total": len(valid_papers),
                    "paper_id": paper_id,
                    "original_size": current_size,
                    "new_size": new_size,
                    "ratio": round(ratio, 1),
                    "skipped": False
                }))
                sys.stdout.flush()
            else:
                skipped_count += 1
        else:
            skipped_count += 1
            # Still output progress so UI progress bar updates
            print(json.dumps({
                "event": "progress",
                "current": idx + 1,
                "total": len(valid_papers),
                "paper_id": paper_id,
                "original_size": current_size,
                "new_size": output_path.stat().st_size if output_path.exists() else current_size,
                "ratio": 0.0,
                "skipped": True
            }))
            sys.stdout.flush()

    # Cleanup orphaned database keys
    for recorded_file in list(manifest.keys()):
        if recorded_file not in current_filenames:
            del manifest[recorded_file]

    save_manifest(project_manifest_file, manifest)

    print(json.dumps({
        "event": "complete",
        "processed": processed_count,
        "skipped": skipped_count,
        "saved_space_mb": round(saved_space / (1024 * 1024), 2)
    }))
    sys.stdout.flush()

if __name__ == '__main__':
    main()
