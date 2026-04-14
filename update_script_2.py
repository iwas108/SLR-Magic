import re

with open('llm-proxy/middleman/templates/index.html', 'r') as f:
    content = f.read()

# Add Copy Button to "View Full Prompt String" section
prompt_section_search = '''// Raw Prompt
                    const details = document.createElement('details');
                    const summary = document.createElement('summary');
                    summary.textContent = 'View Full Prompt String';
                    summary.className = "text-muted small";
                    summary.style.cursor = "pointer";
                    details.appendChild(summary);

                    const pre = document.createElement('pre');'''

prompt_section_replace = '''// Raw Prompt
                    const details = document.createElement('details');
                    const summary = document.createElement('summary');

                    const summaryContainer = document.createElement('div');
                    summaryContainer.className = "d-flex justify-content-between align-items-center mt-2";

                    const summaryText = document.createElement('span');
                    summaryText.textContent = 'View Full Prompt String';
                    summaryText.className = "text-muted small";
                    summaryText.style.cursor = "pointer";

                    const copyBtn = document.createElement('button');
                    copyBtn.className = "btn btn-sm btn-outline-secondary";
                    copyBtn.innerHTML = '<i class="bi bi-clipboard"></i> Copy';
                    copyBtn.onclick = function(e) {
                        e.preventDefault();
                        navigator.clipboard.writeText(userContent).then(() => {
                            copyBtn.innerHTML = '<i class="bi bi-check2"></i> Copied!';
                            setTimeout(() => { copyBtn.innerHTML = '<i class="bi bi-clipboard"></i> Copy'; }, 2000);
                        }).catch(err => {
                            console.error("Failed to copy text: ", err);
                        });
                    };

                    summaryContainer.appendChild(summaryText);
                    summaryContainer.appendChild(copyBtn);
                    summary.appendChild(summaryContainer);

                    details.appendChild(summary);

                    const pre = document.createElement('pre');'''

content = content.replace(prompt_section_search, prompt_section_replace)

with open('llm-proxy/middleman/templates/index.html', 'w') as f:
    f.write(content)
