import re
import json

bad_json = """{
  "decision": "Exclude",
  "exclusion_code": "EC4_PureCS",
  "reasoning": "The abstract says "applied to actual dyeing shops". This is bad."
}"""

def repair_json(text: str) -> str:
    # Regex to match string values in an object
    # Matches "key": "VALUE" followed by , or }
    pattern = re.compile(r'("\w+"\s*:\s*")(.*?)("\s*(?:,|}|]))', re.DOTALL)

    def replacer(match):
        start = match.group(1)
        content = match.group(2)
        end = match.group(3)
        # Fix quotes and newlines
        content = content.replace('\\"', '"').replace('"', '\\"')
        content = content.replace('\n', '\\n')
        return start + content + end

    # We need to run it repeatedly in case of consecutive matches? No, sub replaces all non-overlapping.
    repaired = pattern.sub(replacer, text)
    return repaired

print("Original:")
print(bad_json)
print("\nRepaired:")
rep = repair_json(bad_json)
print(rep)
try:
    json.loads(rep)
    print("VALID!")
except Exception as e:
    print("FAILED:", e)
