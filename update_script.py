import re

with open("llm-proxy/middleman/service.py", "r") as f:
    content = f.read()

# Update the route check to allow gemma
old_if_gemini = 'if model_name.startswith("gemini"):'
new_if_gemini = 'if model_name.lower().startswith("gemini") or model_name.lower().startswith("gemma"):'
content = content.replace(old_if_gemini, new_if_gemini)

with open("llm-proxy/middleman/service.py", "w") as f:
    f.write(content)
