document.addEventListener('DOMContentLoaded', function () {

    // --- GLOBAL CONFIGURATION AND STATE ---
    const clusterInfo = {
        'A': { id: 0, color: '#1a9641', description: 'A: Complex Signed and Moderately Signaled Nodes' },
        'B': { id: 1, color: '#a6d96a', description: 'B: Signalized Secondary Corridors' },
        'C': { id: 3, color: '#fdae61', description: 'C: Residential with Pedestrian Awareness' },
        'D': { id: 2, color: '#d7191c', description: 'D: Minimal Road Infrastructure, Baseline Residential' }
    };
    const highwayNames = {
        'residential': 'Residential', 'tertiary': 'Tertiary', 'secondary': 'Secondary',
        'unclassified': 'Unclassified', 'primary': 'Primary', 'living_street': 'Living Street',
        'trunk': 'Trunk', 'motorway': 'Motorway'
    };
    let visibleClusters = { 'A': true, 'B': true, 'C': true, 'D': true };
    let allCitiesData = [];
    let allCityStats = {};
    let hoveredSegmentId = null;
    let currentCityId = null;

    // --- INITIALIZE MAP AND PROTOCOL ---
    let protocol = new pmtiles.Protocol();
    maplibregl.addProtocol("pmtiles", protocol.tile);
    const map = new maplibregl.Map({
        container: 'map',
        style: 'https://tiles.openfreemap.org/styles/positron',
        center: [0, 20],
        zoom: 1
    });
    map.addControl(new maplibregl.NavigationControl(), 'top-left');

    // =====================================================================
    //  HELPER AND UI FUNCTIONS
    // =====================================================================

    function updateMapFilter() {
        if (!map.getLayer('segments-layer')) return;
        const activeClusterIDs = Object.entries(visibleClusters)
            .filter(([, isVisible]) => isVisible)
            .map(([letter]) => clusterInfo[letter].id);
        map.setFilter('segments-layer', ['in', ['get', 'cluster'], ['literal', activeClusterIDs]]);
    }

    function showGlobalMetrics() {
        const metricsPanel = document.getElementById('metrics-panel');
        const panelContent = metricsPanel.querySelector('.panel-content');
        const clusterColors = { A: '#1a9641', B: '#a6d96a', C: '#fdae61', D: '#d7191c' };
        const globalStats = { A: 1.4, B: 5.2, C: 6.0, D: 87.4 };
        let barChartHTML = '';
        Object.entries(globalStats).forEach(([clusterLetter, percent]) => {
            barChartHTML += `
                <div class="bar-chart-item">
                    <div class="label-line">
                        <span class="label">Cluster ${clusterLetter}</span>
                        <span class="value">${percent.toFixed(2)}%</span>
                    </div>
                    <div class="bar-track">
                        <div class="bar-fill" style="width: ${percent}%; background-color: ${clusterColors[clusterLetter]};"></div>
                    </div>
                </div>
            `;
        });
        document.getElementById('metrics-panel-title').textContent = 'Global Overview';
        panelContent.innerHTML = `
            <div class="global-stats">
                <div class="stat-item">
                    <div class="stat-value">${allCitiesData.length}</div>
                    <div class="stat-label">Cities Analyzed</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">6</div>
                    <div class="stat-label">Continents Represented</div>
                </div>
            </div>
            <div class="metric-group" style="margin-top: 15px;">
                <h5>OVERALL CLUSTER DISTRIBUTION</h5>
                <div id="bar-chart-container">${barChartHTML}</div>
            </div>
            <p style="margin-top: 30px; color: #aaa; text-align: center;">Select a city to view its detailed metrics.</p>
        `;
        metricsPanel.classList.add('visible');
    }

    function updateCityMetrics(cityId) {
        const metricsPanel = document.getElementById('metrics-panel');
        const panelContent = metricsPanel.querySelector('.panel-content');
        const cityInfo = allCitiesData.find(c => c.id === cityId);
        const cityStats = allCityStats[cityId];
        if (!cityInfo || !cityStats) return;
        document.getElementById('metrics-panel-title').textContent = cityInfo.name;
        let barChartHTML = '';
        Object.keys(clusterInfo).forEach(clusterLetter => {
            const percent = parseFloat(cityStats[clusterLetter]) || 0;
            const color = clusterInfo[clusterLetter].color;
            barChartHTML += `
                <div class="bar-chart-item">
                    <div class="label-line">
                        <span class="label">Cluster ${clusterLetter}</span>
                        <span class="value">${percent.toFixed(2)}%</span>
                    </div>
                    <div class="bar-track"><div class="bar-fill" style="width: ${percent}%; background-color: ${color};"></div></div>
                </div>
            `;
        });
        panelContent.innerHTML = `
            <div class="metric-group">
                <h5>CLUSTER DISTRIBUTION</h5>
                <div id="bar-chart-container">${barChartHTML}</div>
            </div>
            <div class="metric-group">
                <h5>CITY INCOME LEVEL</h5>
                <p id="income-level-value">${cityStats['Income Level'] || 'N/A'}</p>
            </div>
        `;
        metricsPanel.classList.add('visible');
    }

    function loadCity(cityId) {
        currentCityId = cityId;

        if (map.getSource('segments-source')) {
            map.removeLayer('segments-layer');
            map.removeSource('segments-source');
        }

        if (!cityId) {
            showGlobalMetrics();
            return;
        }

        const cityInfo = allCitiesData.find(c => c.id === cityId);
        if (!cityInfo) return;

        updateCityMetrics(cityId);
        map.flyTo({ center: [cityInfo.centroid_lon, cityInfo.centroid_lat], zoom: 12 });

        const pmtilesUrl = `./data/pmtiles_by_city/${cityId}.pmtiles`;
        map.addSource('segments-source', {
            type: 'vector',
            url: `pmtiles://${pmtilesUrl}`,
            promoteId: 'unique_edge_id' // Uses the ID from your data
        });

        const lineColorExpression = ['match', ['get', 'cluster'],
            0, clusterInfo.A.color, 1, clusterInfo.B.color, 3, clusterInfo.C.color, 2, clusterInfo.D.color, '#cccccc'
        ];

        map.addLayer({
            id: 'segments-layer',
            type: 'line',
            source: 'segments-source',
            'source-layer': 'segments',
            paint: {
                'line-color': lineColorExpression,
                'line-width': ['case', ['boolean', ['feature-state', 'hover'], false], 6, 3.5], // Hover effect
                'line-opacity': 0.9
            }
        });
        updateMapFilter();

        const segmentPopup = new maplibregl.Popup({ closeButton: true, className: 'segment-popup' });
        const clusterInfoMap = { 0: 'A', 1: 'B', 3: 'C', 2: 'D' };
        
        function createPopupContent(properties) {
            const clusterDisplay = clusterInfoMap[properties.cluster] || properties.cluster;
            const highwayDisplay = highwayNames[properties.highway] || properties.highway || 'N/A';
            return `<div style="font-weight: bold; margin-bottom: 5px;">Segment Details</div><table class="popup-table"><tr><td><strong>Cluster:</strong></td><td>${clusterDisplay}</td></tr><tr><td><strong>Road Classification:</strong></td><td>${highwayDisplay}</td></tr><tr><td><strong>Lanes:</strong></td><td>${properties.lanes || 'N/A'}</td></tr><tr><td><strong>Speed Limit:</strong></td><td>${properties.maxspeed || 'N/A'}</td></tr><tr><td><strong>Special Lane:</strong></td><td>${properties.HasSpecialLane ? 'Yes' : 'No'}</td></tr><tr><td><strong>Traffic Lights:</strong></td><td>${properties.highway_traffic_signals_count}</td></tr><tr><td><strong>Traffic Signs:</strong></td><td>${properties.traffic_sign_count}</td></tr><tr><td><strong>Crossings:</strong></td><td>${properties.TotalCrossingCount}</td></tr></table>`;
        }

        map.on('mousemove', 'segments-layer', (e) => {
            if ('ontouchstart' in window || e.features.length === 0) return;
            map.getCanvas().style.cursor = 'pointer';
            if (hoveredSegmentId !== null) {
                map.setFeatureState({ source: 'segments-source', sourceLayer: 'segments', id: hoveredSegmentId }, { hover: false });
            }
            hoveredSegmentId = e.features[0].id;
            map.setFeatureState({ source: 'segments-source', sourceLayer: 'segments', id: hoveredSegmentId }, { hover: true });
            segmentPopup.setLngLat(e.lngLat).setHTML(createPopupContent(e.features[0].properties)).addTo(map);
        });

        map.on('mouseleave', 'segments-layer', () => {
            if ('ontouchstart' in window) return;
            map.getCanvas().style.cursor = '';
            if (hoveredSegmentId !== null) {
                map.setFeatureState({ source: 'segments-source', sourceLayer: 'segments', id: hoveredSegmentId }, { hover: false });
            }
            hoveredSegmentId = null;
            segmentPopup.remove();
        });

        map.on('click', 'segments-layer', (e) => {
            if (e.features.length > 0) {
                segmentPopup.setLngLat(e.lngLat).setHTML(createPopupContent(e.features[0].properties)).addTo(map);
            }
        });
    }

    // =====================================================================
    //  MAIN MAP LOAD AND UI SETUP
    // =====================================================================
    map.on('load', function() {
        console.log("Map ready. Initializing UI.");
        
        // Get references to ALL interactive UI elements
        const citySelectorBtn = document.getElementById('city-selector-button');
        const citySelectorLabel = document.getElementById('city-selector-label');
        const cityDropdownList = document.getElementById('city-dropdown-list');
        const metricsPanel = document.getElementById('metrics-panel');
        const metricsToggle = document.getElementById('metrics-toggle');
        const metricsCloseBtn = document.getElementById('metrics-close-btn');
        const aboutToggle = document.getElementById('about-toggle');
        const aboutOverlay = document.getElementById('about-overlay');
        const aboutCloseBtn = document.getElementById('about-close-btn');
        const legendContainer = document.getElementById('legend-items');
        const legendInfoIcon = document.getElementById('legend-info-icon');
        const legendInfoOverlay = document.getElementById('legend-info-overlay');
        const legendInfoCloseBtn = document.getElementById('legend-info-close-btn');
        const legendInfoTextDiv = document.getElementById('legend-info-text');

        Object.entries(clusterInfo).forEach(([letter, info]) => {
            const item = document.createElement('div');
            item.className = 'legend-item';
            item.dataset.clusterLetter = letter;
            item.innerHTML = `<span class="legend-key" style="background-color: ${info.color};"></span>${info.description}`;
            item.addEventListener('click', () => {
                visibleClusters[letter] = !visibleClusters[letter];
                item.classList.toggle('inactive');
                updateMapFilter();
            });
            legendContainer.appendChild(item);
        });

        legendInfoIcon.addEventListener('click', () => {
            const infoHTML = `
                <p><strong>Cluster A:</strong> High density of traffic signs and some traffic lights/crossings. Represents complex intersections requiring sophisticated perception from a CAV.</p>
                <p><strong>Cluster B:</strong> Secondary roads defined by a consistent presence of traffic lights. These are key arterial routes providing clear, manageable rules for a CAV.</p>
                <p><strong>Cluster C:</strong> Primarily residential areas with a notable number of marked pedestrian crossings but few traffic lights, cueing a CAV to be aware of Vulnerable Road Users (VRUs).</p>
                <p><strong>Cluster D:</strong> The vast majority of the network, with minimal infrastructure. A CAV must rely almost entirely on its own sensors for navigation and safety.</p>
            `;
            legendInfoTextDiv.innerHTML = infoHTML;
            legendInfoOverlay.classList.remove('hidden');
        });
        
        // NEW: Add listeners to close the legend info modal
        legendInfoCloseBtn.addEventListener('click', () => {
            legendInfoOverlay.classList.add('hidden');
        });
        legendInfoOverlay.addEventListener('click', (e) => {
            if (e.target === legendInfoOverlay) {
                legendInfoOverlay.classList.add('hidden');
            }
        });

        Promise.all([
            fetch('./data/city_overview.json').then(res => res.json()),
            fetch('./data/city_statistics.json').then(res => res.json())
        ]).then(([cities, stats]) => {
            // FIX: Sort the cities array by name BEFORE assigning it
            allCitiesData = cities.sort((a, b) => a.name.localeCompare(b.name));
            allCityStats = stats;
            console.log("Loaded and sorted city data.");
            
            // Populate the dropdown from the now-sorted array
            allCitiesData.forEach(city => {
                const item = document.createElement('a');
                item.className = 'dropdown-item';
                item.textContent = city.name;
                item.dataset.cityId = city.id;
                cityDropdownList.appendChild(item);
            });
            
            // Add a 'dominant_cluster' property to each city for marker coloring
            allCitiesData.forEach(city => {
                const cityStat = stats[city.id] || {};
                let maxPercent = -1, dominant = 'D';
                Object.keys(clusterInfo).forEach(c => {
                    if ((cityStat[c] || 0) > maxPercent) {
                        maxPercent = cityStat[c];
                        dominant = c;
                    }
                });
                city.dominant_cluster = dominant;
            });

            const cityPointsGeoJSON = { type: 'FeatureCollection', features: allCitiesData.map(c => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [c.centroid_lon, c.centroid_lat] }, properties: { id: c.id, name: c.name, dominant_cluster: c.dominant_cluster } })) };
            map.addSource('city-markers', { type: 'geojson', data: cityPointsGeoJSON });
            map.addLayer({
                id: 'city-markers-layer',
                type: 'circle',
                source: 'city-markers',
                paint: {
                    'circle-radius': 6,
                    'circle-color': ['match', ['get', 'dominant_cluster'], 'A', clusterInfo.A.color, 'B', clusterInfo.B.color, 'C', clusterInfo.C.color, 'D', clusterInfo.D.color, '#999999'],
                    'circle-stroke-color': 'white',
                    'circle-stroke-width': 2
                }
            });

        }).catch(error => console.error('Error loading initial data:', error));

        // --- Attach all event listeners ---
        citySelectorBtn.addEventListener('click', () => { cityDropdownList.classList.toggle('hidden'); });
        
        cityDropdownList.addEventListener('click', (e) => {
            if (e.target.matches('.dropdown-item')) {
                loadCity(e.target.dataset.cityId);
                citySelectorLabel.textContent = e.target.textContent;
                cityDropdownList.classList.add('hidden');
            }
        });

        window.addEventListener('click', (e) => {
            if (!e.target.closest('.city-selector-container')) {
                cityDropdownList.classList.add('hidden');
            }
        });
        
        map.on('click', 'city-markers-layer', (e) => { 
            loadCity(e.features[0].properties.id);
            citySelectorLabel.textContent = e.features[0].properties.name; 
        });
        
        metricsToggle.addEventListener('click', () => {
            if (metricsPanel.classList.contains('visible')) {
                metricsPanel.classList.remove('visible');
            } else {
                currentCityId ? updateCityMetrics(currentCityId) : showGlobalMetrics();
            }
        });
        metricsCloseBtn.addEventListener('click', () => { metricsPanel.classList.remove('visible'); });
        
        aboutToggle.addEventListener('click', () => { aboutOverlay.classList.remove('hidden'); });
        aboutCloseBtn.addEventListener('click', () => { aboutOverlay.classList.add('hidden'); });
        aboutOverlay.addEventListener('click', (e) => { if (e.target === aboutOverlay) aboutOverlay.classList.add('hidden'); });

        const cityPopup = new maplibregl.Popup({ closeButton: false, className: 'city-hover-popup' });
        map.on('mouseenter', 'city-markers-layer', (e) => { map.getCanvas().style.cursor = 'pointer'; cityPopup.setLngLat(e.features[0].geometry.coordinates.slice()).setText(e.features[0].properties.name).addTo(map); });
        map.on('mouseleave', 'city-markers-layer', () => { map.getCanvas().style.cursor = ''; cityPopup.remove(); });

        if (!localStorage.getItem('hasVisitedCAVMap')) {
            aboutOverlay.classList.remove('hidden');
            localStorage.setItem('hasVisitedCAVMap', 'true');
        }
    });

    map.on('error', (e) => console.error("A map error occurred:", e));
});