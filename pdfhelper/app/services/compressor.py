import os
import subprocess
import shutil
import json
import platform
from pathlib import Path
import logging

from app.repository import db

logger = logging.getLogger(__name__)

def get_ghostscript_command():
    possible_commands = ["gs", "gswin64c", "gswin32c"]
    for cmd in possible_commands:
        if shutil.which(cmd):
            return cmd
    return None

def compress_pdf(gs_command, input_file, output_file, compression_level):
    try:
        command = [
            gs_command,
            "-sDEVICE=pdfwrite",
            "-dCompatibilityLevel=1.4",
            f"-dPDFSETTINGS={compression_level}",
            "-dNOPAUSE",
            "-dQUIET",
            "-dBATCH",
            f"-sOutputFile={str(output_file)}",
            str(input_file)
        ]

        subprocess.run(command, check=True)
        return True
    except subprocess.CalledProcessError as e:
        logger.warning(f"Ghostscript error on {input_file.name}: {e}")
        return False
    except Exception as e:
        logger.warning(f"Unexpected error: {e}")
        return False

def run_compressor(is_cancelled=None):
    input_folder = db.get_config("COMPRESSOR_INPUT_FOLDER_NAME")
    output_folder = db.get_config("COMPRESSOR_OUTPUT_FOLDER_NAME")
    compression_level = db.get_config("COMPRESSOR_COMPRESSION_LEVEL")

    cwd = Path.cwd()
    input_dir = cwd / input_folder
    output_dir = cwd / output_folder

    logger.info("Starting PDF Compressor...")

    gs_command = get_ghostscript_command()
    if not gs_command:
        msg = "Ghostscript not found in system PATH."
        logger.error(msg)
        return {"status": "error", "message": msg}

    if not output_dir.exists():
        output_dir.mkdir()
        logger.info(f"Created output folder: {output_dir}")

    manifest = db.get_compression_manifest()
    pdf_files = list(input_dir.glob("*.pdf"))

    if not pdf_files:
        msg = f"No .pdf files found in the {input_dir} directory."
        logger.info(msg)
        return {"status": "success", "message": msg, "processed": 0}

    processed_count = 0
    skipped_count = 0
    saved_space = 0
    current_filenames = []

    for pdf in pdf_files:
        if is_cancelled and is_cancelled():
            logger.info("Compression cancelled by user.")
            break

        current_filenames.append(pdf.name)
        output_path = output_dir / pdf.name

        try:
            current_mtime = pdf.stat().st_mtime
            current_size = pdf.stat().st_size
        except OSError:
            logger.warning(f"Error reading file stats: {pdf.name}")
            continue

        needs_processing = False
        reason = ""

        if pdf.name not in manifest:
            needs_processing = True
            reason = "New file"
        elif manifest[pdf.name].get("mtime") != current_mtime:
            needs_processing = True
            reason = "Source modified"
        elif not output_path.exists():
            needs_processing = True
            reason = "Output missing"

        if needs_processing:
            logger.info(f"Processing ({reason}): {pdf.name}...")

            if compress_pdf(gs_command, pdf, output_path, compression_level):
                if output_path.exists():
                    new_size = output_path.stat().st_size
                    ratio = (1 - (new_size / current_size)) * 100
                    saved_space += (current_size - new_size)

                    db.update_compression_manifest(pdf.name, current_mtime, current_size, new_size)
                    logger.info(f"Done! (-{ratio:.1f}%)")
                    processed_count += 1
                else:
                    logger.warning("Failed (Output not created).")
            else:
                logger.warning("Failed.")
        else:
            skipped_count += 1

    for recorded_file in list(manifest.keys()):
        if recorded_file not in current_filenames:
            db.remove_from_compression_manifest(recorded_file)

    logger.info(f"Compression Summary: Processed: {processed_count}, Skipped: {skipped_count}, Saved Space: {saved_space / (1024*1024):.2f} MB")

    return {
        "status": "success",
        "message": "Compression completed.",
        "processed": processed_count,
        "skipped": skipped_count,
        "saved_mb": round(saved_space / (1024*1024), 2)
    }
