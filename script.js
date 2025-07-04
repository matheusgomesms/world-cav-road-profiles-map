document.addEventListener('DOMContentLoaded', function () {

    // --- GLOBAL CONFIGURATION AND STATE ---

    const clusterInfo = {
        'A': { id: 0, color: '#1a9641', description: 'Complex Signed and Moderately Signaled Nodes' },
        'B': { id: 1, color: '#a6d96a', description: 'Signalized Secondary Corridors' },
        'C': { id: 3, color: '#fdae61', description: 'Residential with Pedestrian Awareness' },
        'D': { id: 2, color: '#d7191c', description: 'Minimal Road Infrastructure, Baseline Residential' }
    };

    const highwayNames = {
        'residential': 'Residential', 'tertiary': 'Tertiary', 'secondary': 'Secondary',
        'unclassified': 'Unclassified', 'primary': 'Primary', 'living_street': 'Living Street',
        'trunk': 'Trunk', 'motorway': 'Motorway'
    };
    
    // This object will track which clusters are currently visible on the map.
    let visibleClusters = { 'A': true, 'B': true, 'C': true, 'D': true };
    
    // Global variables to hold our fetched data
    let allCitiesData = [];
    let allCityStats = {};

    // 1. Initialize PMTiles protocol
    let protocol = new pmtiles.Protocol();
    maplibregl.addProtocol("pmtiles", protocol.tile);

    // 2. Initialize the Map
    const map = new maplibregl.Map({
        container: 'map',
        style: 'https://tiles.openfreemap.org/styles/positron',
        center: [0, 20],
        zoom: 1
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-left');

    // =====================================================================
    //  HELPER FUNCTIONS
    // =====================================================================

    /**
     * Updates the map's filter based on the `visibleClusters` state object.
     */
    function updateMapFilter() {
        // Do nothing if the segments layer doesn't exist yet
        if (!map.getLayer('segments-layer')) {
            return;
        }

        const activeClusterIDs = Object.entries(visibleClusters)
            .filter(([letter, isVisible]) => isVisible)
            .map(([letter, isVisible]) => clusterInfo[letter].id);

        // Create a MapLibre filter expression.
        // If the array is empty, it will match nothing.
        const filter = ['in', ['get', 'cluster'], ['literal', activeClusterIDs]];
        
        map.setFilter('segments-layer', filter);
    }

    /**
     * The main function to load and display all data for a selected city.
     * @param {string} cityId - The slug ID of the city to load.
     */
    function loadCity(cityId) {
        const metricsPanel = document.getElementById('metrics-panel');

        if (!cityId) {
            if (map.getLayer('segments-layer')) map.removeLayer('segments-layer');
            if (map.getSource('segments-source')) map.removeSource('segments-source');
            metricsPanel.classList.remove('visible');
            return;
        }

        const cityInfo = allCitiesData.find(c => c.id === cityId);
        const cityStats = allCityStats[cityId];
        if (!cityInfo || !cityStats) return;

        // --- Update and Show Metrics Panel ---
        document.getElementById('metrics-city-name').textContent = cityInfo.name;
        document.getElementById('income-level-value').textContent = cityStats['Income Level'] || 'N/A';

        const barContainer = document.getElementById('bar-chart-container');
        barContainer.innerHTML = '';
        Object.keys(clusterInfo).forEach(clusterLetter => {
            const percent = parseFloat(cityStats[clusterLetter]) || 0;
            const itemDiv = document.createElement('div');
            itemDiv.className = 'bar-chart-item';
            itemDiv.innerHTML = `
                <div class="label-line">
                    <span class="label">Cluster ${clusterLetter}</span>
                    <span class="value">${percent.toFixed(2)}%</span>
                </div>
                <div class="bar-track">
                    <div class="bar-fill" style="width: ${percent}%; background-color: ${clusterInfo[clusterLetter].color};"></div>
                </div>
            `;
            barContainer.appendChild(itemDiv);
        });

        metricsPanel.classList.add('visible');

        // --- Load Map Layers ---
        map.flyTo({ center: [cityInfo.centroid_lon, cityInfo.centroid_lat], zoom: 12 });

        if (map.getSource('segments-source')) {
            map.removeLayer('segments-layer');
            map.removeSource('segments-source');
        }
        
        const pmtilesUrl = `./data/pmtiles_by_city/${cityId}.pmtiles`;
        map.addSource('segments-source', {
            type: 'vector',
            url: `pmtiles://${pmtilesUrl}`
        });

        const lineColorExpression = ['match', ['get', 'cluster']];
        Object.values(clusterInfo).forEach(info => {
            lineColorExpression.push(info.id, info.color);
        });
        lineColorExpression.push('#cccccc'); // Default color

        map.addLayer({
            'id': 'segments-layer', 'type': 'line', 'source': 'segments-source', 'source-layer': 'segments',
            'paint': { 'line-color': lineColorExpression, 'line-width': 3.5, 'line-opacity': 0.9 }
        });
        
        // Apply the current visibility filter to the new layer
        updateMapFilter();

        // --- Segment Popup and Event Listener Logic ---
        const segmentPopup = new maplibregl.Popup({ closeButton: true, className: 'segment-popup' });

        function createPopupContent(properties) {
            const clusterDisplay = Object.keys(clusterInfo).find(key => clusterInfo[key].id === properties.cluster) || properties.cluster;
            const highwayDisplay = highwayNames[properties.highway] || properties.highway || 'N/A';
            return `<div style="font-weight: bold; margin-bottom: 5px;">Segment Details</div><table class="popup-table"><tr><td><strong>Cluster:</strong></td><td>${clusterDisplay}</td></tr><tr><td><strong>Road Classification:</strong></td><td>${highwayDisplay}</td></tr><tr><td><strong>Number of Lanes:</strong></td><td>${properties.lanes || 'N/A'}</td></tr><tr><td><strong>Speed Limit:</strong></td><td>${properties.maxspeed || 'N/A'}</td></tr><tr><td><strong>Special Lane:</strong></td><td>${properties.HasSpecialLane ? 'Yes' : 'No'}</td></tr><tr><td><strong>Traffic Lights:</strong></td><td>${properties.highway_traffic_signals_count}</td></tr><tr><td><strong>Traffic Signs:</strong></td><td>${properties.traffic_sign_count}</td></tr><tr><td><strong>Crossings:</strong></td><td>${properties.TotalCrossingCount}</td></tr></table>`;
        }

        map.on('mousemove', 'segments-layer', (e) => { if ('ontouchstart' in window) return; map.getCanvas().style.cursor = 'pointer'; segmentPopup.setLngLat(e.lngLat).setHTML(createPopupContent(e.features[0].properties)).addTo(map); });
        map.on('mouseleave', 'segments-layer', () => { if ('ontouchstart' in window) return; map.getCanvas().style.cursor = ''; segmentPopup.remove(); });
        map.on('click', 'segments-layer', (e) => { segmentPopup.setLngLat(e.lngLat).setHTML(createPopupContent(e.features[0].properties)).addTo(map); });
    }

    // =====================================================================
    //  MAIN MAP LOAD AND UI SETUP
    // =====================================================================
    map.on('load', function() {
        console.log("Map ready. Initializing UI and data layers.");

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

        // Dynamically build the legend and attach listeners
        for (const [letter, info] of Object.entries(clusterInfo)) {
            const item = document.createElement('div');
            item.className = 'legend-item';
            item.dataset.clusterLetter = letter;
            item.innerHTML = `<span class="legend-key" style="background-color: ${info.color};"></span> ${letter}: ${info.description}`;
            
            item.addEventListener('click', () => {
                visibleClusters[letter] = !visibleClusters[letter];
                item.classList.toggle('inactive', !visibleClusters[letter]);
                updateMapFilter();
            });
            legendContainer.appendChild(item);
        }

        // Fetch data files
        Promise.all([
            fetch('./data/city_overview.json').then(res => res.json()),
            fetch('./data/city_statistics.json').then(res => res.json())
        ]).then(([cities, stats]) => {
            allCitiesData = cities;
            allCityStats = stats;
            
            cities.sort((a, b) => a.name.localeCompare(b.name)).forEach(city => {
                const item = document.createElement('a');
                item.className = 'dropdown-item';
                item.textContent = city.name;
                item.dataset.cityId = city.id;
                cityDropdownList.appendChild(item);
            });

            const cityPointsGeoJSON = { type: 'FeatureCollection', features: cities.map(c => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [c.centroid_lon, c.centroid_lat] }, properties: { id: c.id, name: c.name } })) };
            map.addSource('city-markers', { type: 'geojson', data: cityPointsGeoJSON });
            map.addLayer({ id: 'city-markers-layer', type: 'circle', source: 'city-markers', paint: { 'circle-radius': 6, 'circle-color': '#E45A25', 'circle-stroke-color': 'white', 'circle-stroke-width': 2 } });
        }).catch(error => console.error('Error loading initial data:', error));

        // --- Attach all event listeners ---
        citySelectorBtn.addEventListener('click', () => cityDropdownList.classList.toggle('hidden'));
        cityDropdownList.addEventListener('click', (e) => {
            if (e.target.matches('.dropdown-item')) {
                const cityId = e.target.dataset.cityId;
                const cityName = e.target.textContent;
                citySelectorLabel.textContent = cityName;
                cityDropdownList.classList.add('hidden');
                loadCity(cityId);
            }
        });
        window.addEventListener('click', (e) => { if (!e.target.closest('.city-selector-container')) cityDropdownList.classList.add('hidden'); });
        map.on('click', 'city-markers-layer', (e) => { const {id, name} = e.features[0].properties; citySelectorLabel.textContent = name; loadCity(id); });
        metricsToggle.addEventListener('click', () => { metricsPanel.classList.toggle('visible'); });
        metricsCloseBtn.addEventListener('click', () => { metricsPanel.classList.remove('visible'); });
        aboutToggle.addEventListener('click', () => { aboutOverlay.classList.remove('hidden'); });
        aboutCloseBtn.addEventListener('click', () => { aboutOverlay.classList.add('hidden'); });
        aboutOverlay.addEventListener('click', (e) => { if (e.target === aboutOverlay) aboutOverlay.classList.add('hidden'); });

        // City Marker Popups
        const cityPopup = new maplibregl.Popup({ closeButton: false, className: 'city-hover-popup' });
        map.on('mouseenter', 'city-markers-layer', (e) => { map.getCanvas().style.cursor = 'pointer'; cityPopup.setLngLat(e.features[0].geometry.coordinates.slice()).setText(e.features[0].properties.name).addTo(map); });
        map.on('mouseleave', 'city-markers-layer', () => { map.getCanvas().style.cursor = ''; cityPopup.remove(); });
    });

    map.on('error', (e) => console.error("A map error occurred:", e));
});