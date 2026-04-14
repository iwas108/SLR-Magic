import re

with open('llm-proxy/middleman/templates/index.html', 'r') as f:
    content = f.read()

# 1. Move Prev and Next buttons to modal-footer
# Remove from header
content = re.sub(
    r'<div class="ms-3">\s*<button type="button" class="btn btn-sm btn-outline-light me-1" id="btnPrevDetail".*?</button>\s*</div>',
    '',
    content,
    flags=re.DOTALL
)

# Insert into footer
footer_search = '<div class="modal-footer">\n                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>\n                </div>'
footer_replace = '''<div class="modal-footer d-flex justify-content-between">
                    <div>
                        <button type="button" class="btn btn-outline-secondary me-1" id="btnPrevDetail" onclick="showPrevDetail()">
                            <i class="bi bi-chevron-left"></i> Prev
                        </button>
                        <button type="button" class="btn btn-outline-secondary" id="btnNextDetail" onclick="showNextDetail()">
                            Next <i class="bi bi-chevron-right"></i>
                        </button>
                    </div>
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                </div>'''

content = content.replace(footer_search, footer_replace)

with open('llm-proxy/middleman/templates/index.html', 'w') as f:
    f.write(content)
