import subprocess
import platform
import sys
import json

def get_ghostscript_command(custom_path=None):
    if custom_path and custom_path.strip():
        return custom_path.strip()
    system = platform.system()
    if system == 'Windows':
        commands = ['gswin64c', 'gswin32c', 'gs']
    else:
        commands = ['gs']
    
    for cmd in commands:
        try:
            subprocess.run([cmd, '--version'], capture_output=True, check=True)
            return cmd
        except (subprocess.CalledProcessError, FileNotFoundError):
            continue
    return None

def compress_pdf(gs_executable, level, input_file, output_file):
    command = [
        gs_executable,
        "-sDEVICE=pdfwrite",
        "-dCompatibilityLevel=1.4",
        f"-dPDFSETTINGS={level}",
        "-dEmbedAllFonts=true",
        "-dSubsetFonts=false",
        "-dNOPAUSE",
        "-dQUIET",
        "-dBATCH",
        f"-sOutputFile={output_file}",
        str(input_file)
    ]
    try:
        subprocess.run(command, check=True, capture_output=True, text=True)
        return True
    except Exception as e:
        err_msg = str(e)
        if hasattr(e, 'stderr') and e.stderr:
            err_msg += f" | stderr: {e.stderr}"
        print(json.dumps({"info": f"[WARNING]: Ghostscript error on {input_file.name}: {err_msg}"}))
        sys.stdout.flush()
        return False
