import re
with open("llm-proxy/middleman/service.py", "r") as f:
    text = f.read()

# Let's inspect the bug. "API key not valid. Please pass a valid API key."
# Wait, the error is 400 Bad Request... Wait... The user log said:
# [2026-04-15 21:51:49] INFO    | HTTP Request: POST https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:streamGenerateContent?alt=sse&key=AIzaSyAooO2_f66s_fOacbyxeVUKoxAH9W8UcEA "HTTP/1.1 400 Bad Request"

# The issue is that the key is appended as ?alt=sse&key=... but for generateContent it's ?key=...
# Wait! In _fetch_gemini we appended `key=...` directly.
# And we changed it to:
# `url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:streamGenerateContent?alt=sse&key={api_key}"`
# This format should be valid: `?alt=sse&key=API_KEY`.
# Let's check Google API documentation.
# The URL should probably be `?key={api_key}&alt=sse` instead of `?alt=sse&key={api_key}` just in case. But standard query parameters don't care about order.
# Wait, look at the error the user got before!
# Oh, the user is saying that the REASONING TRACE is empty when streamGenerateContent is enabled, but when DISABLED it successfully generates!
# That means streamGenerateContent *succeeds* but the parsing is wrong!
# NO, the user ALSO sent another log showing 400 Bad Request.
# Ah, I see:
# "Now I got 400 bad request when using the streamGenerateContent"
# So the 400 bad request is new. Why?
# In my patch `_fetch_via_stream_gemini` I added `streamGenerateContent?alt=sse&key={api_key}`.
# Wait! What did I do in `patch_gemini_fetch.py`?
# I replaced `url = ...` with:
# ```
#         is_streaming_enabled = False
#         extra_config_str = self.extra_configs.get(endpoint_url, "")
#         if extra_config_str:
#             try:
#                 extra_conf = json.loads(extra_config_str)
#                 is_streaming_enabled = extra_conf.get("streamingMode", False)
#             except Exception as e:
#                 pass
#
#         if is_streaming_enabled:
#             url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:streamGenerateContent?alt=sse&key={api_key}"
#         else:
#             url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
# ```
# And previously the URL was:
# `url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:streamGenerateContent?alt=sse&key={api_key}"`

# Wait! If the user got a 400 error, perhaps `gemini-3-flash-preview` DOES NOT SUPPORT `streamGenerateContent` with `thinkingConfig` enabled in some specific way?
# Or maybe the `is_thought` logic is what caused it? No, `is_thought` logic only parses the response.
# Let's check the error I got in my test: `API_KEY_INVALID` - this is because I provided `API_KEY`.
# The user's log:
# `[2026-04-15 21:51:49] ERROR   | ❌ HTTP Error [6d89cba6] connecting to Ollama: Client error '400 Bad Request' for url 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:streamGenerateContent?alt=sse&key=xxx'`
# The problem is `400 Bad Request`.
