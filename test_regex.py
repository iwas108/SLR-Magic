import re

def optimistic_repair_json(text: str) -> str:
    # A more robust regex that ignores escaped quotes inside the content
    # It matches keys and values
    pattern = re.compile(r'("\w+"\s*:\s*")(.*?)("\s*(?:,|}|]))', re.DOTALL)

    def replacer(match):
        start = match.group(1)
        content = match.group(2)
        end = match.group(3)

        # We want to escape unescaped double quotes.
        # Simple way: unescape all, then escape all
        content = content.replace('\\"', '"').replace('"', '\\"')
        # Escape newlines
        content = content.replace('\n', '\\n').replace('\r', '')
        return start + content + end

    return pattern.sub(replacer, text)

print(optimistic_repair_json('{"reasoning": "He said "hello" today."}'))
