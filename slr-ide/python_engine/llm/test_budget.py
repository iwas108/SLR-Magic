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
        
        # Gemini multiplier is 258 per page (10 pages * 258 = 2580 tokens)
        gemini_tokens = get_pdf_tokens("dummy.pdf")
        self.assertEqual(gemini_tokens, 2580)

    @patch('llm.budget.get_pdf_tokens')
    @patch('llm.budget.get_model_pricing')
    def test_estimate_cost(self, mock_pricing, mock_pdf_tokens):
        # Mock pricing: input = $0.10/1M, output = $0.40/1M, discount = 0.0
        mock_pricing.return_value = {
            "input_token_price": 0.10,
            "output_token_price": 0.40,
            "thinking_token_price": 0.0,
            "batch_discount": 0.0
        }
        mock_pdf_tokens.return_value = 4000
        
        # Prompt length is 400 chars -> 100 estimated tokens
        prompt = "x" * 400 
        
        # Standard mode (no discount / 0 discount)
        result = estimate_cost("dummy-model", prompt, "dummy.pdf", speed_mode='STANDARD', max_output_tokens=1000, discount=0.0, tax_rate=0.0)
        
        # input tokens = 100 (text) + 4000 (pdf) = 4100
        self.assertEqual(result["estimated_input_tokens"], 4100)
        self.assertEqual(result["estimated_output_tokens"], 1000)
        
        # cost = (4100/1M * 0.10) + (1000/1M * 0.40) = 0.00041 + 0.0004 = 0.00081
        self.assertAlmostEqual(result["estimated_cost"], 0.00081, places=7)
        
        # Flex mode (50% discount passed explicitly)
        result_flex = estimate_cost("dummy-model", prompt, "dummy.pdf", speed_mode='FLEX', max_output_tokens=1000, discount=0.5, tax_rate=0.0)
        self.assertAlmostEqual(result_flex["estimated_cost"], 0.000405, places=7)

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
