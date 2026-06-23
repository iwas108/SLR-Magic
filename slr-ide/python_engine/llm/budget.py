import os
from pypdf import PdfReader
from .database import execute_read_one, execute_write

def get_pdf_page_count(pdf_path):
    """Reads PDF and returns page count. Returns 0 if reading fails."""
    try:
        if not pdf_path or not os.path.exists(pdf_path):
            return 0
        reader = PdfReader(pdf_path)
        return len(reader.pages)
    except Exception:
        return 0

def get_pdf_tokens(model_id, pdf_path):
    """Calculates multimodal tokens for PDF pages depending on the model."""
    if not pdf_path or not os.path.exists(pdf_path):
        return 0
    pages = get_pdf_page_count(pdf_path)
    model_lower = model_id.lower()
    if "gemini" in model_lower:
        return pages * 258
    elif "claude" in model_lower or "anthropic" in model_lower:
        return pages * 1600
    else:
        # Default fallback for OpenAI or other models (e.g. 800 tokens/page)
        return pages * 800

def get_model_pricing(model_id):
    """Retrieves pricing for a specific model from DB or returns a sensible fallback."""
    pricing = execute_read_one("SELECT * FROM llm_pricing WHERE model_id = ?", (model_id,))
    if not pricing:
        model_lower = model_id.lower()
        if "flash" in model_lower or "mini" in model_lower:
            return {
                "input_token_price": 0.075,   # $0.075 per 1M tokens
                "output_token_price": 0.30,   # $0.30 per 1M tokens
                "thinking_token_price": 0.30,
                "batch_discount": 0.5
            }
        else:
            return {
                "input_token_price": 3.0,     # $3.00 per 1M tokens
                "output_token_price": 15.0,    # $15.00 per 1M tokens
                "thinking_token_price": 15.0,
                "batch_discount": 0.5
            }
    return dict(pricing)

def estimate_cost(model_id, prompt_text, pdf_path=None, batch_mode=False, max_output_tokens=1000):
    """Estimates the token usage and cost for a given prompt and optional PDF."""
    pricing = get_model_pricing(model_id)
    
    # Text tokens estimation (conservative: 1 token per 4 characters)
    text_input_tokens = len(prompt_text) // 4
    
    # PDF tokens estimation
    pdf_input_tokens = get_pdf_tokens(model_id, pdf_path)
    
    total_input_tokens = text_input_tokens + pdf_input_tokens
    
    # Estimated cost calculations (prices are per 1M tokens)
    input_rate = pricing["input_token_price"]
    output_rate = pricing["output_token_price"]
    
    # Apply batch discount if batch mode is selected
    if batch_mode:
        discount = pricing.get("batch_discount", 0.5)
        input_rate *= discount
        output_rate *= discount
        
    input_cost = (total_input_tokens / 1_000_000.0) * input_rate
    output_cost = (max_output_tokens / 1_000_000.0) * output_rate
    
    estimated_cost = input_cost + output_cost
    
    return {
        "estimated_input_tokens": total_input_tokens,
        "estimated_output_tokens": max_output_tokens,
        "estimated_cost": estimated_cost
    }

def check_budget_limit(project_id, estimated_cost):
    """Checks if the project has enough remaining budget for the estimated cost."""
    project = execute_read_one(
        "SELECT project_budget_limit, project_current_spend FROM projects WHERE id = ?",
        (project_id,)
    )
    if not project:
        return True, "Project not found"
        
    limit = project.get('project_budget_limit') or 0.0
    current = project.get('project_current_spend') or 0.0
    
    if limit > 0.0 and (current + estimated_cost) > limit:
        return False, f"Cost limit exceeded. Spend: ${current:.4f}, Est. Cost: ${estimated_cost:.4f}, Limit: ${limit:.4f}"
        
    return True, "Within budget"

def update_project_spend(project_id, actual_cost):
    """Atomically adds actual_cost to the project's current spend."""
    execute_write(
        "UPDATE projects SET project_current_spend = project_current_spend + ? WHERE id = ?",
        (actual_cost, project_id)
    )
