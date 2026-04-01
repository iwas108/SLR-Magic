import re

with open('ollama-middleman/middleman/templates/index.html', 'r') as f:
    content = f.read()

# Modify the logic that creates new elements for thinking
old_element_creation = """                        if (state.isCurrentlyThinking !== data.in_thinking) {
                            state.currentStreamElement = document.createElement('div');
                            state.currentStreamElement.className = data.in_thinking ? 'stream-thinking' : 'stream-final';
                            state.container.appendChild(state.currentStreamElement);
                            state.streamBuffer = "";
                            state.isCurrentlyThinking = data.in_thinking;
                        }"""

new_element_creation = """                        if (state.isCurrentlyThinking !== data.in_thinking) {
                            if (data.in_thinking) {
                                const details = document.createElement('details');
                                details.className = 'stream-thinking-details mb-2';
                                const summary = document.createElement('summary');
                                summary.className = 'text-secondary user-select-none';
                                summary.style.cursor = 'pointer';
                                summary.innerHTML = '<i class="bi bi-lightbulb"></i> Reasoning Trace (Thinking)';
                                details.appendChild(summary);

                                const contentDiv = document.createElement('div');
                                contentDiv.className = 'stream-thinking thinking-box mt-2';
                                details.appendChild(contentDiv);

                                state.container.appendChild(details);
                                state.currentStreamElement = contentDiv;
                            } else {
                                state.currentStreamElement = document.createElement('div');
                                state.currentStreamElement.className = 'stream-final mt-2';
                                state.container.appendChild(state.currentStreamElement);
                            }
                            state.streamBuffer = "";
                            state.isCurrentlyThinking = data.in_thinking;
                        }"""

content = content.replace(old_element_creation, new_element_creation)

with open('ollama-middleman/middleman/templates/index.html', 'w') as f:
    f.write(content)
