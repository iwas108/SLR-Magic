import os
import sys
from datetime import datetime, timedelta
from pypdf import PdfReader
from llm.database import execute_read, execute_read_one, execute_write

def get_pdf_page_count(pdf_path):
    """Reads PDF and returns page count. Returns 0 if reading fails."""
    try:
        if not pdf_path or not os.path.exists(pdf_path):
            return 0
        reader = PdfReader(pdf_path)
        return len(reader.pages)
    except Exception:
        return 0

def get_pdf_tokens(pdf_path):
    """Calculates multimodal tokens for PDF pages. For Gemini, it's 258 tokens per page."""
    if not pdf_path or not os.path.exists(pdf_path):
        return 0
    pages = get_pdf_page_count(pdf_path)
    return pages * 258

def resolve_model_prices(model_id: str) -> tuple:
    """Resolves standard pricing for a given model ID based on the official Gemini pricing tiers."""
    name_lower = model_id.lower()
    
    # Specific known model rates per 1M tokens
    pricing_matrix = {
        "gemini-3.1-flash-lite": (0.25, 1.50),
        "gemini-3-flash-preview": (0.50, 3.00),
        "gemini-3.1-pro-preview": (2.00, 12.00),
        "gemini-2.5-flash": (0.075, 0.30),
        "gemini-2.5-pro": (1.25, 5.00),
        "gemini-1.5-flash": (0.075, 0.30),
        "gemini-1.5-pro": (1.25, 5.00),
        "gemma": (0.00, 0.00)
    }
    
    for key, rates in pricing_matrix.items():
        if key in name_lower:
            return rates
            
    # Fallback based on model tiers
    if "gemma" in name_lower:
        return 0.00, 0.00
    is_pro = "pro" in name_lower or "ultra" in name_lower
    input_price = 1.25 if is_pro else 0.075
    output_price = 5.00 if is_pro else 0.30
    return input_price, output_price

def get_model_pricing(model_id: str) -> dict:
    """Retrieves pricing for a specific Gemini model from DB or returns a sensible fallback."""
    pricing = execute_read_one("SELECT * FROM llm_pricing WHERE model_id = ?", (model_id,))
    if not pricing:
        input_price, output_price = resolve_model_prices(model_id)
        return {
            "model_id": model_id,
            "provider": "gemini",
            "input_token_price": input_price,
            "output_token_price": output_price,
            "thinking_token_price": 0.0,
            "batch_discount": 0.5
        }
    return dict(pricing)

def refresh_pricing_from_api(client, model_id: str) -> dict:
    """Queries Gemini API models metadata and refreshes local SQLite cache database."""
    try:
        # Check if model exists via SDK
        model_info = client.client.models.get(model=model_id)
        
        # Determine rates based on model tier (since pricing tiers are fixed by Google but can vary)
        # Note: If API starts returning raw pricing data in the future, we can extract it here.
        # For now, we normalize standard known Gemini rates based on model tier info:
        input_price, output_price = resolve_model_prices(model_id)
        
        now = datetime.utcnow().isoformat()
        execute_write(
            """
            INSERT OR REPLACE INTO llm_pricing (model_id, provider, input_token_price, output_token_price, thinking_token_price, batch_discount, updated_at)
            VALUES (?, 'gemini', ?, ?, 0.0, 0.5, ?)
            """,
            (model_id, input_price, output_price, now)
        )
        
        return {
            "model_id": model_id,
            "provider": "gemini",
            "input_token_price": input_price,
            "output_token_price": output_price,
            "thinking_token_price": 0.0,
            "batch_discount": 0.5,
            "updated_at": now
        }
    except Exception as e:
        sys.stderr.write(f"Failed to refresh pricing from Gemini API: {e}\n")
        return get_model_pricing(model_id)

def sync_all_models_from_api(client) -> list:
    """Queries the Gemini API for all available models, filters for active Gemini models, and updates local SQLite pricing cache."""
    try:
        models = client.client.models.list()
        now = datetime.utcnow().isoformat()
        
        synced_models = []
        to_insert = []
        
        for model in models:
            model_name = model.name
            if model_name.startswith("models/"):
                model_name = model_name[len("models/"):]
                
            name_lower = model_name.lower()
            if "gemini" not in name_lower and "gemma" not in name_lower:
                continue
            
            # Exclude experimental, tuning, embedding, and text-embedding models
            if any(x in name_lower for x in ["-tuning", "-tuned", "embed", "bidi", "vision-", "experimental"]):
                continue
                
            # Exclude gemini-1.5-flash as it is discontinued
            if "gemini-1.5-flash" in name_lower:
                continue
                
            input_price, output_price = resolve_model_prices(model_name)
            
            to_insert.append((model_name, input_price, output_price, now))
            synced_models.append({
                "model_id": model_name,
                "provider": "gemini",
                "input_token_price": input_price,
                "output_token_price": output_price,
                "thinking_token_price": 0.0,
                "batch_discount": 0.5,
                "updated_at": now
            })
            
        if to_insert:
            # Insert new models or update their updatedAt, but do not overwrite input_token_price/output_token_price if they already exist
            # For each model, we check if it already exists:
            # - If it exists, we do nothing to input_token_price and output_token_price, but we can update updated_at if we want.
            # - If it does not exist, we insert it.
            for item in to_insert:
                model_name, input_price, output_price, now_time = item
                existing = execute_read_one("SELECT model_id FROM llm_pricing WHERE model_id = ?", (model_name,))
                if not existing:
                    execute_write(
                        """
                        INSERT INTO llm_pricing (model_id, provider, input_token_price, output_token_price, thinking_token_price, batch_discount, updated_at)
                        VALUES (?, 'gemini', ?, ?, 0.0, 0.5, ?)
                        """,
                        (model_name, input_price, output_price, now_time)
                    )
        
        # Also clean up models that are no longer returned by the API? 
        # Wait, the user request says: "when the user click reload models, the data will be updated (only the model list), but do not reset the pricing because it is manually inputted by user."
        # If a model exists in DB but is no longer returned by list, should we delete it? 
        # Usually it is safer to delete obsolete models so the list matches the API, but if the user manually configured it, they might want to keep it or we might delete it. Let's do:
        # Delete models from llm_pricing that are NOT in the synced_models list, to ensure the data is synced.
        # But wait! If we delete, we might lose their manually inputted prices if they want to keep it?
        # "only the model list" suggests aligning the model list with the API (adding new ones, removing obsolete ones), but keeping pricing for ones that remain.
        # Let's delete obsolete ones to keep the list clean:
        all_db_models = [row["model_id"] for row in execute_read("SELECT model_id FROM llm_pricing", ())]
        active_model_ids = {m["model_id"] for m in synced_models}
        for db_model in all_db_models:
            if db_model not in active_model_ids:
                execute_write("DELETE FROM llm_pricing WHERE model_id = ?", (db_model,))

        # Now, return the final current state of llm_pricing from DB so the UI gets the correct actual values (manually edited + newly synced)
        final_pricing = []
        rows = execute_read("SELECT * FROM llm_pricing", ())
        for r in rows:
            final_pricing.append(dict(r))
        return final_pricing
    except Exception as e:
        sys.stderr.write(f"Failed to sync models from Gemini API: {e}\n")
        raise e

def estimate_cost(model_id, prompt_text, pdf_path=None, speed_mode='FLEX', max_output_tokens=1000):
    """Estimates the token usage and cost for a given prompt and optional PDF."""
    pricing = get_model_pricing(model_id)
    
    # Text tokens estimation (conservative: 1 token per 4 characters)
    text_input_tokens = len(prompt_text) // 4
    
    # PDF tokens estimation
    pdf_input_tokens = get_pdf_tokens(pdf_path)
    total_input_tokens = text_input_tokens + pdf_input_tokens
    
    # Estimated cost calculations (prices are per 1M tokens)
    input_rate = pricing["input_token_price"]
    output_rate = pricing["output_token_price"]
    
    # Apply 50% Flex discount if speed_mode is FLEX
    if speed_mode == 'FLEX':
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
