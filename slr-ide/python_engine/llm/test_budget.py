import unittest
from unittest.mock import patch
import os
import sys

# Add scrapers folder to python path to run tests
SCRAPER_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(SCRAPER_DIR)

from llm.budget import get_pdf_tokens, estimate_cost, check_budget_limit

class TestBudgetEstimator(unittest.TestCase):
    
    @patch('llm.budget.get_pdf_page_count')
    @patch('os.path.exists')
    def test_pdf_token_calculations(self, mock_exists, mock_page_count):
        mock_exists.return_value = True
        mock_page_count.return_value = 10
        
        # Gemini multiplier is 258
        gemini_tokens = get_pdf_tokens("gemini-1.5-flash", "dummy.pdf")
        self.assertEqual(gemini_tokens, 2580)
        
        # Claude multiplier is 1600
        claude_tokens = get_pdf_tokens("claude-3-5-sonnet-latest", "dummy.pdf")
        self.assertEqual(claude_tokens, 16000)
        
        # OpenAI fallback is 800
        openai_tokens = get_pdf_tokens("gpt-4o", "dummy.pdf")
        self.assertEqual(openai_tokens, 8000)

    @patch('llm.budget.get_pdf_tokens')
    @patch('llm.budget.get_model_pricing')
    def test_estimate_cost(self, mock_pricing, mock_pdf_tokens):
        # Mock pricing: input = $0.10/1M, output = $0.40/1M, discount = 0.5
        mock_pricing.return_value = {
            "input_token_price": 0.10,
            "output_token_price": 0.40,
            "thinking_token_price": 0.40,
            "batch_discount": 0.5
        }
        mock_pdf_tokens.return_value = 4000
        
        # Prompt length is 400 chars -> 100 estimated tokens
        prompt = "x" * 400 
        
        # Standard mode
        result = estimate_cost("dummy-model", prompt, "dummy.pdf", batch_mode=False, max_output_tokens=1000)
        
        # input tokens = 100 (text) + 4000 (pdf) = 4100
        self.assertEqual(result["estimated_input_tokens"], 4100)
        self.assertEqual(result["estimated_output_tokens"], 1000)
        
        # cost = (4100/1M * 0.10) + (1000/1M * 0.40) = 0.00041 + 0.0004 = 0.00081
        self.assertAlmostEqual(result["estimated_cost"], 0.00081, places=7)
        
        # Batch mode (50% discount)
        result_batch = estimate_cost("dummy-model", prompt, "dummy.pdf", batch_mode=True, max_output_tokens=1000)
        self.assertAlmostEqual(result_batch["estimated_cost"], 0.000405, places=7)

    @patch('llm.budget.execute_read_one')
    def test_check_budget_limit(self, mock_read_one):
        # Case 1: Limit is 0.0 (unlimited)
        mock_read_one.return_value = {"project_budget_limit": 0.0, "project_current_spend": 5.0}
        ok, msg = check_budget_limit("proj-1", 10.0)
        self.assertTrue(ok)
        self.assertEqual(msg, "Within budget")
        
        # Case 2: Limit is 10.0, spend is 5.0, est is 3.0 -> OK
        mock_read_one.return_value = {"project_budget_limit": 10.0, "project_current_spend": 5.0}
        ok, msg = check_budget_limit("proj-1", 3.0)
        self.assertTrue(ok)
        self.assertEqual(msg, "Within budget")
        
        # Case 3: Limit is 10.0, spend is 5.0, est is 6.0 -> Exceeded
        ok, msg = check_budget_limit("proj-1", 6.0)
        self.assertFalse(ok)
        self.assertIn("Cost limit exceeded", msg)

if __name__ == '__main__':
    unittest.main()
