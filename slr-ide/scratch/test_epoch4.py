import os
import sys
import json
import time
from datetime import datetime

# Resolve paths relative to scratch directory
SCRAPER_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scrapers")
sys.path.append(SCRAPER_DIR)

from llm.database import execute_write, execute_read, execute_read_one, DB_PATH

def run_batch_test():
    print(f"Target Database: {DB_PATH}")
    
    # 1. Clean up database
    execute_write("DELETE FROM reviewer_decisions WHERE reviewer_name = 'gemini-1.5-flash'")
    execute_write("DELETE FROM papers WHERE Project_ID = 'test-proj'")
    execute_write("DELETE FROM llm_jobs WHERE project_id = 'test-proj'")
    execute_write("DELETE FROM llm_batch_jobs")
    execute_write("DELETE FROM projects WHERE id = 'test-proj'")
    
    # Create test project
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
            10.0,
            0.0,
            json.dumps({
                "provider": "gemini",
                "model_id": "gemini-1.5-flash",
                "prompt_template_id": "default-screen",
                "concurrency_limit": 2,
                "batch_queue_size": 10,
                "temperature": 0.0
            }),
            datetime.utcnow().isoformat()
        )
    )
    
    # Insert 3 papers
    for i in range(1, 4):
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
        
    print("Database configured with 3 papers.")
    
    # 2. Run main.py in batch mode
    from llm.main import main
    sys.argv = [
        'main.py',
        '--project-id', 'test-proj',
        '--job-id', 'test-job-epoch4',
        '--mode', 'batch'
    ]
    
    print("Triggering batch submission...")
    try:
        main()
    except SystemExit as e:
        assert e.code == 0 or e.code is None, f"Expected clean exit code, got {e.code}"
    
    # Verify it updated parent job to PROCESSING_BATCH
    job = execute_read_one("SELECT status FROM llm_jobs WHERE id = 'test-job-epoch4'")
    print(f"Parent Job Status after submission: {job['status']}")
    assert job["status"] == 'PROCESSING_BATCH'
    
    # Verify batch job record exists in llm_batch_jobs
    batch = execute_read_one("SELECT status, cloud_batch_id FROM llm_batch_jobs WHERE job_id = 'test-job-epoch4'")
    print(f"Batch Job status in SQLite: {batch['status']}, Cloud ID: {batch['cloud_batch_id']}")
    assert batch["status"] == 'PROCESSING'
    
    # 3. Wait for simulated batch background thread to finish (10 seconds)
    print("Waiting 12 seconds for simulated background batch execution to complete...")
    time.sleep(12)
    
    # 4. Check results
    job_after = execute_read_one("SELECT status FROM llm_jobs WHERE id = 'test-job-epoch4'")
    print(f"Job Status in SQLite after completion: {job_after['status']}")
    assert job_after["status"] == 'COMPLETED'
    
    batch_after = execute_read_one("SELECT status FROM llm_batch_jobs WHERE job_id = 'test-job-epoch4'")
    print(f"Batch Job status after completion: {batch_after['status']}")
    assert batch_after["status"] == 'SUCCESS'
    
    # Verify papers are marked COMPLETED
    papers = execute_read("SELECT Paper_ID, Status FROM papers WHERE Project_ID = 'test-proj'")
    for p in papers:
        print(f"Paper {p['Paper_ID']} Status: {p['Status']}")
        assert p["Status"] == 'COMPLETED'
        
    # Verify reviewer decisions are written
    decisions = execute_read("SELECT paper_id, decision FROM reviewer_decisions WHERE project_id = 'test-proj'")
    print(f"Total decisions written: {len(decisions)}")
    assert len(decisions) == 3
    
    print("\n>>> Epoch 4 Integration Test: SUCCESS!")

if __name__ == '__main__':
    run_batch_test()
