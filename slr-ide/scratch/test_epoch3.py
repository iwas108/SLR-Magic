import os
import sys
import json
import time
from datetime import datetime
from unittest.mock import patch

# Resolve paths relative to scratch directory
SCRAPER_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scrapers")
sys.path.append(SCRAPER_DIR)

from llm.database import execute_write, execute_read, execute_read_one, DB_PATH
from llm.providers.gemini import GeminiAdapter

def mock_screen_paper(self, system_instruction, user_prompt, pdf_path=None):
    # Simulated response costing $0.001 per paper call
    return {
        "decision": "INCLUDE" if "Mock Paper Title" in user_prompt else "EXCLUDE",
        "exclusion_trigger": None,
        "rationale": "The paper meets the inclusion criteria.",
        "input_tokens": 10000,
        "output_tokens": 833,
        "thinking_tokens": 0,
        "cost": 0.001
    }

def run_integration_test():
    print(f"Target Database: {DB_PATH}")
    
    # 1. Clean up and set up mock database structures
    execute_write("DELETE FROM reviewer_decisions WHERE reviewer_name = 'gemini-1.5-flash'")
    execute_write("DELETE FROM papers WHERE Project_ID = 'test-proj'")
    execute_write("DELETE FROM llm_jobs WHERE project_id = 'test-proj'")
    execute_write("DELETE FROM projects WHERE id = 'test-proj'")
    
    # Create test project with a tight budget of $0.0025
    execute_write(
        """
        INSERT INTO projects (id, name, folder_name, objective, questions, exclusion_criteria, project_budget_limit, project_current_spend, llm_config, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            'test-proj',
            'Test Project',
            'test_project',
            'To test queue handler integration.',
            'RQ1: Does the queue run parallel?',
            'None.',
            0.0025, # Limit is $0.0025 (Exceeded at paper 3 since each costs $0.001)
            0.0000, # Current spend
            json.dumps({
                "provider": "gemini",
                "model_id": "gemini-1.5-flash",
                "prompt_template_id": "default-screen",
                "concurrency_limit": 2, # Process 2 concurrent workers
                "batch_queue_size": 10,
                "temperature": 0.0
            }),
            datetime.utcnow().isoformat()
        )
    )
    
    # Insert 4 mock papers
    for i in range(1, 5):
        execute_write(
            """
            INSERT INTO papers (Paper_ID, Import_Date, Import_Source, Title, Abstract, Status, Project_ID, calibration_pool)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                f"test-paper-{i}",
                datetime.utcnow().isoformat(),
                "test-import",
                f"Mock Paper Title {i}",
                f"This is mock abstract number {i} for testing queue handler.",
                "PENDING",
                "test-proj",
                "pool_a"
            )
        )
        
    print("Database configured with 4 pending papers and $0.0025 budget limit.")
    
    # 2. Patch screen_paper and run main orchestrator
    with patch.object(GeminiAdapter, 'screen_paper', mock_screen_paper):
        from llm.main import main
        
        # Override sys.argv to mock execution parameters
        sys.argv = [
            'main.py',
            '--project-id', 'test-proj',
            '--job-id', 'test-job-epoch3',
            '--mode', 'standard'
        ]
        
        # Capture pause event and simulate resume via stdin
        readline_calls = []
        def mock_readline():
            print("\n>>> Integration Test Mock Stdin: Pause detected! Waiting 2 seconds then resuming...")
            time.sleep(2)
            # Simulate user increasing the budget limit in the database before resuming
            execute_write("UPDATE projects SET project_budget_limit = 10.0 WHERE id = 'test-proj'")
            readline_calls.append(True)
            return "\n"
            
        with patch('sys.stdin.readline', mock_readline):
            main()
            
    # 3. Assert correct pipeline results
    print("\n--- Running Assertions ---")
    
    # Validate spend accumulation
    proj = execute_read_one("SELECT project_current_spend FROM projects WHERE id = 'test-proj'")
    spend = proj["project_current_spend"]
    print(f"Actual Spend in SQLite: ${spend:.4f}")
    assert abs(spend - 0.004) < 1e-6, f"Expected spend of $0.004, got ${spend}"
    
    # Validate paper status updates
    papers = execute_read("SELECT Paper_ID, Status FROM papers WHERE Project_ID = 'test-proj'")
    for p in papers:
        print(f"Paper {p['Paper_ID']} Status: {p['Status']}")
        assert p["Status"] == 'COMPLETED', f"Expected paper status COMPLETED, got {p['Status']}"
        
    # Validate reviewer decisions table writes
    decisions = execute_read("SELECT paper_id, decision, rationale FROM reviewer_decisions WHERE project_id = 'test-proj'")
    print(f"Total reviewer decisions written: {len(decisions)}")
    assert len(decisions) == 4, f"Expected 4 decisions, got {len(decisions)}"
    
    # Validate job progress writes
    job = execute_read_one("SELECT status, total_papers, processed_papers FROM llm_jobs WHERE id = 'test-job-epoch3'")
    print(f"Job Status in SQLite: {job['status']}")
    assert job["status"] == 'COMPLETED', f"Expected job COMPLETED, got {job['status']}"
    assert job["total_papers"] == 4
    assert job["processed_papers"] == 4
    
    assert len(readline_calls) == 1, "Expected budget pause to trigger exactly once"
    
    print("\n>>> Epoch 3 Integration Test: SUCCESS!")

if __name__ == '__main__':
    run_integration_test()
