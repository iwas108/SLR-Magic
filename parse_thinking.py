import json

lines = [
    '{"message": {"content": "<think> "}}',
    '{"message": {"content": "Thinking about it. "}}',
    '{"message": {"content": "</think> "}}',
    '{"message": {"content": "The answer is 42."}}',
]

in_thinking = False
for line in lines:
    chunk = json.loads(line)
    msg = chunk.get("message", {})
    thinking_piece = msg.get("thinking", "")
    content_piece = msg.get("content", "")

    if not thinking_piece and content_piece:
        if "<think>" in content_piece and not in_thinking:
            in_thinking = True
        if "</think>" in content_piece and in_thinking:
            in_thinking = False

    if thinking_piece:
        print(f"thinking_piece: {thinking_piece}")

    if content_piece:
        if in_thinking and not thinking_piece and "</think>" not in content_piece:
            print(f"EMBEDDED THINKING: {content_piece}")
        else:
            print(f"REGULAR CONTENT: {content_piece}")
