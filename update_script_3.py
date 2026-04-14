import re

with open('llm-proxy/middleman/templates/index.html', 'r') as f:
    content = f.read()

# Update updateEndpointDropdown
dropdown_search = '''function updateEndpointDropdown() {
            const select = document.getElementById('activeEndpointSelect');
            const currentValue = select.value;

            select.innerHTML = '';

            const streamIds = Object.keys(activeEndpoints);
            if (streamIds.length === 0) {
                const option = document.createElement('option');
                option.value = "";
                option.textContent = "-- No active streams --";
                select.appendChild(option);
                updateDisplayForSelectedEndpoint();
                return;
            }

            const seenEndpoints = new Set();

            streamIds.forEach(id => {
                const data = activeEndpoints[id];
                if (!seenEndpoints.has(data.endpointUrl)) {
                    seenEndpoints.add(data.endpointUrl);
                    const displayUrl = endpointLabelsMap[data.endpointUrl] || data.endpointUrl;
                    const option = document.createElement('option');
                    option.value = id;
                    option.textContent = displayUrl;
                    select.appendChild(option);
                }
            });

            let foundCurrent = false;
            for (let i = 0; i < select.options.length; i++) {
                if (select.options[i].value === currentValue) {
                    foundCurrent = true;
                    break;
                }
            }

            if (foundCurrent) {
                select.value = currentValue;
            } else {
                select.value = select.options[0].value;
            }

            updateDisplayForSelectedEndpoint();
        }'''

dropdown_replace = '''function updateEndpointDropdown() {
            const select = document.getElementById('activeEndpointSelect');
            const currentValue = select.value;

            select.innerHTML = '';

            // Generate list of all available endpoints
            // We use endpointLabelsMap keys which are populated from queue_stats (local endpoints)
            const availableEndpoints = Object.keys(endpointLabelsMap);

            // Add Gemini API if it's configured
            if (window.currentGeminiApiKey) {
                if (!availableEndpoints.includes('Gemini API')) {
                    availableEndpoints.push('Gemini API');
                }
            }

            if (availableEndpoints.length === 0) {
                const option = document.createElement('option');
                option.value = "";
                option.textContent = "-- No endpoints configured --";
                select.appendChild(option);
                updateDisplayForSelectedEndpoint();
                return;
            }

            availableEndpoints.forEach(url => {
                const displayUrl = endpointLabelsMap[url] || url;
                const option = document.createElement('option');
                option.value = url;
                option.textContent = displayUrl;
                select.appendChild(option);
            });

            let foundCurrent = false;
            for (let i = 0; i < select.options.length; i++) {
                if (select.options[i].value === currentValue) {
                    foundCurrent = true;
                    break;
                }
            }

            if (foundCurrent) {
                select.value = currentValue;
            } else {
                select.value = select.options[0].value;
            }

            updateDisplayForSelectedEndpoint();
        }'''

content = content.replace(dropdown_search, dropdown_replace)

display_search = '''function updateDisplayForSelectedEndpoint() {
            const select = document.getElementById('activeEndpointSelect');
            const selectedStreamId = select.value;
            const inProgressCard = document.getElementById('in-progress-card');
            const inProgressTitle = document.getElementById('in-progress-title');
            const inProgressAbstract = document.getElementById('in-progress-abstract');
            const liveStreamBox = document.getElementById('live-stream-box');

            liveStreamBox.innerHTML = '';

            if (!selectedStreamId || !activeEndpoints[selectedStreamId]) {
                inProgressCard.style.display = 'none';
                liveStreamBox.textContent = "Select an active stream to view...";
                return;
            }

            const endpointData = activeEndpoints[selectedStreamId];

            // Update Card
            inProgressTitle.textContent = endpointData.title || "Unknown Paper";
            if (endpointData.abstract) {
                inProgressAbstract.textContent = endpointData.abstract;
                inProgressAbstract.style.display = 'block';
            } else {
                inProgressAbstract.style.display = 'none';
            }
            inProgressCard.style.display = 'block';

            // Show stream for this endpoint
            if (streamState[selectedStreamId]) {
                liveStreamBox.appendChild(streamState[selectedStreamId].container);
            }
        }'''

display_replace = '''function updateDisplayForSelectedEndpoint() {
            const select = document.getElementById('activeEndpointSelect');
            const selectedEndpointUrl = select.value; // Now this is an endpointUrl
            const inProgressCard = document.getElementById('in-progress-card');
            const inProgressTitle = document.getElementById('in-progress-title');
            const inProgressAbstract = document.getElementById('in-progress-abstract');
            const liveStreamBox = document.getElementById('live-stream-box');

            liveStreamBox.innerHTML = '';

            if (!selectedEndpointUrl) {
                inProgressCard.style.display = 'none';
                liveStreamBox.textContent = "Select an endpoint to view...";
                return;
            }

            // Find an active stream for this endpoint
            let activeStreamId = null;
            let endpointData = null;
            for (const [streamId, data] of Object.entries(activeEndpoints)) {
                if (data.endpointUrl === selectedEndpointUrl) {
                    activeStreamId = streamId;
                    endpointData = data;
                    break;
                }
            }

            if (activeStreamId && endpointData) {
                // Update Card
                inProgressTitle.textContent = endpointData.title || "Unknown Paper";
                if (endpointData.abstract) {
                    inProgressAbstract.textContent = endpointData.abstract;
                    inProgressAbstract.style.display = 'block';
                } else {
                    inProgressAbstract.style.display = 'none';
                }
                inProgressCard.style.display = 'block';

                // Show stream for this endpoint
                if (streamState[activeStreamId]) {
                    liveStreamBox.appendChild(streamState[activeStreamId].container);
                }
            } else {
                inProgressCard.style.display = 'none';
                liveStreamBox.innerHTML = '<div class="text-muted fst-italic">Waiting for stream to start on this endpoint...</div>';
            }
        }'''

content = content.replace(display_search, display_replace)

with open('llm-proxy/middleman/templates/index.html', 'w') as f:
    f.write(content)
