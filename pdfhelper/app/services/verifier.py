import os
import fitz  # PyMuPDF
import pandas as pd
from thefuzz import fuzz
import logging

logger = logging.getLogger(__name__)

# --- CONFIGURATION ---
class VerifierConfig:
    INPUT_CSV = "database.csv"
    PDF_FOLDER = "Downloaded_PDFs"
    OUTPUT_CSV = "verified_results.csv"
    MATCH_THRESHOLD = 85

def verify_pdf(file_path, target_title):
    """
    Returns: (Match_Score, Page_Count, Status_Message)
    """
    try:
        doc = fitz.open(file_path)
        num_pages = doc.page_count
        
        # Extract text from Page 1 (limit to first 3000 chars)
        page_text = doc[0].get_text().lower()[:3000]
        doc.close()
        
        # Clean target title
        target_title = str(target_title).lower().strip()
        
        if not target_title or target_title == "nan":
            return 0, num_pages, "Skipped (No Title in CSV)"

        # Fuzzy Match
        score = fuzz.partial_ratio(target_title, page_text)
        return score, num_pages, "OK"

    except Exception as e:
        logger.error(f"Error reading PDF {file_path}: {e}")
        return 0, 0, "Error Reading PDF"

def run_verifier():
    # 1. Load Data
    if not os.path.exists(VerifierConfig.INPUT_CSV):
        msg = f"Error: {VerifierConfig.INPUT_CSV} not found."
        logger.error(msg)
        return {"status": "error", "message": msg}

    # Force Paper_ID to string to avoid errors
    df = pd.read_csv(VerifierConfig.INPUT_CSV, dtype={'Paper_ID': str})
    
    # Clean column names
    df.columns = [c.strip() for c in df.columns]

    if "Paper_ID" not in df.columns or "Title" not in df.columns:
        msg = f"Error: CSV must have 'Paper_ID' and 'Title' columns."
        logger.error(msg)
        return {"status": "error", "message": msg}

    logger.info(f"Processing {len(df)} papers...")
    results = []

    # 2. Process Files
    for index, row in df.iterrows():
        
        # Handle Filename (auto-add .pdf if missing)
        paper_id_raw = str(row['Paper_ID']).strip()
        filename = paper_id_raw if paper_id_raw.lower().endswith(".pdf") else f"{paper_id_raw}.pdf"
        file_path = os.path.join(VerifierConfig.PDF_FOLDER, filename)
        target_title = row['Title']

        # Default Values
        page_count = 0
        score = 0
        status = "Missing File"

        # Check File & Verify
        if os.path.exists(file_path):
            score, page_count, msg = verify_pdf(file_path, target_title)
            
            if msg == "OK":
                if score >= VerifierConfig.MATCH_THRESHOLD:
                    status = "Confirmed"
                elif score >= 50:
                    status = "Low Confidence"
                else:
                    status = "Mismatch"
            else:
                status = msg # e.g. "Error Reading PDF"
        
        # 3. Build Result Row (ONLY these 4 columns)
        results.append({
            "Paper_ID": paper_id_raw,
            "Page_Count": page_count,
            "Match_Score": score,
            "Verification_Status": status
        })

    # 4. Save Output
    output_df = pd.DataFrame(results)
    
    # Sort by Score (ascending) so Mismatches appear at the top
    output_df = output_df.sort_values(by="Match_Score", ascending=True)

    output_df.to_csv(VerifierConfig.OUTPUT_CSV, index=False)
    
    logger.info(f"Done! Saved small CSV to: {VerifierConfig.OUTPUT_CSV}")
    summary = output_df["Verification_Status"].value_counts().to_dict()
    return {"status": "success", "message": f"Verified {len(df)} papers.", "summary": summary}
