import sys
import io

try:
    from pypdf import PdfReader
    has_pypdf = True
except ImportError:
    has_pypdf = False

try:
    import fitz
    import pytesseract
    from PIL import Image
    has_ocr_libs = True
except ImportError:
    has_ocr_libs = False

def extract_pdf_text_first_page(file_path, ocr_enabled=False, tesseract_path="tesseract"):
    text = ""
    if has_pypdf:
        try:
            reader = PdfReader(file_path)
            if len(reader.pages) > 0:
                text = reader.pages[0].extract_text() or ""
        except Exception as e:
            print(f"Error reading PDF via pypdf {file_path}: {e}", file=sys.stderr)

    if not text.strip() and ocr_enabled and has_ocr_libs:
        try:
            if tesseract_path and tesseract_path != "tesseract":
                pytesseract.pytesseract.tesseract_cmd = tesseract_path
            
            doc = fitz.open(file_path)
            if len(doc) > 0:
                page = doc.load_page(0)
                pix = page.get_pixmap()
                img_data = pix.tobytes("png")
                img = Image.open(io.BytesIO(img_data))
                
                text = pytesseract.image_to_string(img) or ""
            doc.close()
        except Exception as e:
            print(f"Error reading PDF via fitz/tesseract {file_path}: {e}", file=sys.stderr)
    
    return text.strip()
