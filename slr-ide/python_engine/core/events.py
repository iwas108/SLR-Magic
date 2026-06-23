import time
import json
import sys

last_print_time = 0.0

def throttle_print(event_data, throttle_interval=0.3):
    global last_print_time
    now = time.time()
    event_type = event_data.get('event')
    
    # Critical events that must always be printed immediately
    is_critical = event_type in ('match', 'complete', 'error', 'step_start', 'step_complete', 'log', 'paper_success', 'paper_error') or 'info' in event_data
    
    # Boundary progress updates
    is_boundary = False
    if event_type == 'progress' or event_type == 'indexing':
        is_boundary = (event_data.get('current') == 1 or event_data.get('current') == event_data.get('total'))
        
    if is_critical or is_boundary or (now - last_print_time >= throttle_interval):
        print(json.dumps(event_data))
        sys.stdout.flush()
        last_print_time = now

def print_json(data):
    print(json.dumps(data))
    sys.stdout.flush()
