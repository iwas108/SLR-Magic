import os
import subprocess
import sys
import shutil
import json
import platform
from pathlib import Path

# ================= CONFIGURATION =================
# The folder to save compressed files
OUTPUT_FOLDER_NAME = "compressed"

# Database file to track changes
DB_FILE = "compression_manifest.json"

# Compression Quality Settings
# /screen   = low resolution, lowest file size (72 dpi) - Aggressive
# /ebook    = medium resolution, good file size (150 dpi) - Recommended
# /printer  = high resolution, larger file size (300 dpi)
COMPRESSION_LEVEL = "/ebook" 
# =================================================

def get_ghostscript_command():
    """
    Auto-detects the Ghostscript executable name based on the OS
    and available PATH entries.
    """
    # Common Ghostscript executable names
    # 'gs' is standard for Linux/macOS
    # 'gswin64c' / 'gswin32c' are standard for Windows Command Line
    possible_commands = ["gs", "gswin64c", "gswin32c"]
    
    for cmd in possible_commands:
        if shutil.which(cmd):
            return cmd
    return None

def load_manifest(db_path):
    """Loads the processing history from JSON."""
    if db_path.exists():
        try:
            with open(db_path, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return {}
    return {}

def save_manifest(db_path, data):
    """Saves the processing history to JSON."""
    try:
        with open(db_path, 'w') as f:
            json.dump(data, f, indent=4)
    except IOError as e:
        print(f"⚠️ Warning: Could not save manifest file: {e}")

def compress_pdf(gs_command, input_file, output_file):
    """
    Compresses a single PDF using Ghostscript.
    """
    try:
        command = [
            gs_command,
            "-sDEVICE=pdfwrite",
            "-dCompatibilityLevel=1.4",
            f"-dPDFSETTINGS={COMPRESSION_LEVEL}",
            "-dNOPAUSE",
            "-dQUIET",
            "-dBATCH",
            f"-sOutputFile={str(output_file)}",
            str(input_file)
        ]

        subprocess.run(command, check=True)
        return True
    except subprocess.CalledProcessError as e:
        print(f"   ⚠️ Ghostscript error on {input_file.name}: {e}")
        return False
    except Exception as e:
        print(f"   ⚠️ Unexpected error: {e}")
        return False

def main():
    # 1. Setup environment
    cwd = Path.cwd()
    output_dir = cwd / OUTPUT_FOLDER_NAME
    db_path = cwd / DB_FILE
    
    print(f"--- PDF Compressor Tool (Incremental) ---")
    print(f"OS: {platform.system()} | Working Directory: {cwd}")
    
    # Auto-detect GS
    gs_command = get_ghostscript_command()
    if not gs_command:
        print("❌ Error: Ghostscript not found in system PATH.")
        print("   - Linux: Run 'sudo apt install ghostscript'")
        print("   - Windows: Install from https://ghostscript.com/releases/gsdnld.html")
        sys.exit(1)
    else:
        print(f"Using Ghostscript executable: '{gs_command}'")

    # 2. Create output directory
    if not output_dir.exists():
        output_dir.mkdir()
        print(f"Created output folder: {output_dir}")

    # 3. Load Database & Scan Files
    manifest = load_manifest(db_path)
    pdf_files = list(cwd.glob("*.pdf"))
    
    if not pdf_files:
        print("No .pdf files found in the current directory.")
        return

    print("-" * 50)
    print(f"Found {len(pdf_files)} PDF source files.")
    
    # 4. Process files
    processed_count = 0
    skipped_count = 0
    saved_space = 0
    
    # List to keep track of current files for DB cleanup
    current_filenames = []

    for pdf in pdf_files:
        current_filenames.append(pdf.name)
        output_path = output_dir / pdf.name
        
        # Get current file stats
        try:
            current_mtime = pdf.stat().st_mtime
            current_size = pdf.stat().st_size
        except OSError:
            print(f"⚠️ Error reading file stats: {pdf.name}")
            continue

        # CHECK: Do we need to process this file?
        # Condition 1: Not in DB (New file)
        # Condition 2: Modified time changed (Updated file)
        # Condition 3: Output file was deleted manually
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
            print(f"Processing ({reason}): {pdf.name}...", end=" ", flush=True)
            
            if compress_pdf(gs_command, pdf, output_path):
                # Verify output creation and calculate stats
                if output_path.exists():
                    new_size = output_path.stat().st_size
                    ratio = (1 - (new_size / current_size)) * 100
                    saved_space += (current_size - new_size)
                    
                    # Update Manifest
                    manifest[pdf.name] = {
                        "mtime": current_mtime,
                        "original_size": current_size,
                        "compressed_size": new_size
                    }
                    print(f"Done! (-{ratio:.1f}%)")
                    processed_count += 1
                else:
                    print("Failed (Output not created).")
            else:
                print("Failed.")
        else:
            skipped_count += 1
            # print(f"Skipping: {pdf.name} (Up to date)") # Uncomment to see skipped files

    # 5. Database Cleanup (Remove files that no longer exist in source)
    # Convert keys to list to avoid runtime error during deletion
    for recorded_file in list(manifest.keys()):
        if recorded_file not in current_filenames:
            del manifest[recorded_file]
            # Optional: Decide if you want to delete the orphan file in output folder too
            # orphan_output = output_dir / recorded_file
            # if orphan_output.exists(): orphan_output.unlink()

    # Save updated manifest
    save_manifest(db_path, manifest)

    # 6. Summary
    print("-" * 50)
    print(f"Summary:")
    print(f"   Processed : {processed_count}")
    print(f"   Skipped   : {skipped_count}")
    if processed_count > 0:
        print(f"   Space Saved (Run): {saved_space / (1024*1024):.2f} MB")
    print(f"   Manifest saved to: {DB_FILE}")
    # input("Press Enter to exit...")

if __name__ == "__main__":
    main()