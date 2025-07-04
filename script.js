document.addEventListener('DOMContentLoaded', function () {

    // 1. Initialize PMTiles protocol for MapLibre
    let protocol = new pmtiles.Protocol();
    maplibregl.addProtocol("pmtiles", protocol.tile);

    // 2. Initialize the Map
    const map = new maplibregl.Map({
        container: 'map',
        style: 'https://tiles.openfreemap.org/styles/positron',
        center: [0, 20],
        zoom: 1
    });

    // Add zoom and compass controls
    map.addControl(new maplibregl.NavigationControl(), 'top-left');

    // Global variables to hold our fetched data
    let allCitiesData = [];
    let allCityStats = {};

    // =====================================================================
    //  THE CENTRAL FUNCTION TO LOAD AND DISPLAY A CITY'S DATA
    // =====================================================================
    function loadCity(cityId) {
        const metricsPanel = document.getElementById('metrics-panel');
        const clusterColors = { A: '#1a9641', B: '#a6d96a', C: '#fdae61', D: '#d7191c' };
        
        // Data mapping objects
        const highwayNames = {
            'residential': 'Residential', 'tertiary': 'Tertiary', 'secondary': 'Secondary',
            'unclassified': 'Unclassified', 'primary': 'Primary', 'living_street': 'Living Street', 
            'trunk': 'Trunk', 'motorway': 'Motorway' // Motorway added
        };
        const clusterInfo = { 
            0: { letter: 'A' }, 1: { letter: 'B' }, 3: { letter: 'C' }, 2: { letter: 'D' }
        };

        // --- Main Logic ---
        if (!cityId) {
            if (map.getLayer('segments-layer')) map.removeLayer('segments-layer');
            if (map.getSource('segments-source')) map.removeSource('segments-source');
            metricsPanel.classList.remove('visible');
            return;
        }

        const cityInfo = allCitiesData.find(c => c.id === cityId);
        const cityStats = allCityStats[cityId];
        if (!cityInfo || !cityStats) {
            console.error(`Data not found for city: ${cityId}`);
            return;
        }

        // --- Update and Show Metrics Panel ---
        document.getElementById('metrics-city-name').textContent = cityInfo.name;
        document.getElementById('income-level-value').textContent = cityStats['Income Level'] || 'N/A';

        const barContainer = document.getElementById('bar-chart-container');
        barContainer.innerHTML = '';
        ['A', 'B', 'C', 'D'].forEach(cluster => {
            const percent = parseFloat(cityStats[cluster]) || 0;
            const itemDiv = document.createElement('div');
            itemDiv.className = 'bar-chart-item';
            itemDiv.innerHTML = `
                <div class="label-line">
                    <span class="label">Cluster ${cluster}</span>
                    <span class="value">${percent.toFixed(2)}%</span>
                </div>
                <div class="bar-track">
                    <div class="bar-fill" style="width: ${percent}%; background-color: ${clusterColors[cluster]};"></div>
                </div>
            `;
            barContainer.appendChild(itemDiv);
        });

        metricsPanel.classList.add('visible');

        // --- Load Map Layers ---
        map.flyTo({ center: [cityInfo.centroid_lon, cityInfo.centroid_lat], zoom: 12 });

        if (map.getLayer('segments-layer')) map.removeLayer('segments-layer');
        if (map.getSource('segments-source')) map.removeSource('segments-source');
        
        const pmtilesUrl = `./data/pmtiles_by_city/${cityId}.pmtiles`;
        map.addSource('segments-source', { 
            type: 'vector', 
            url: `pmtiles://${pmtilesUrl}`,
            attribution: 'Street data © OpenStreetMap contributors'
        });
        
        const lineColorExpression = ['match', ['get', 'cluster'],
            0, clusterColors.A, 1, clusterColors.B, 3, clusterColors.C, 2, clusterColors.D, '#cccccc'
        ];
        
        map.addLayer({
            'id': 'segments-layer', 'type': 'line', 'source': 'segments-source', 'source-layer': 'segments',
            'paint': { 'line-color': lineColorExpression, 'line-width': 3.5, 'line-opacity': 0.9 }
        });

        // --- Segment Popup and Event Listener Logic ---
        const segmentPopup = new maplibregl.Popup({ closeButton: true, className: 'segment-popup' });

        function createPopupContent(properties) {
            const clusterDisplay = clusterInfo[properties.cluster] ? `${clusterInfo[properties.cluster].letter}` : `${properties.cluster}`;
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

        // Get references to all interactive UI elements
        const citySelectorBtn = document.getElementById('city-selector-button');
        const citySelectorLabel = document.getElementById('city-selector-label');
        const cityDropdownList = document.getElementById('city-dropdown-list');
        const metricsPanel = document.getElementById('metrics-panel');
        const metricsToggle = document.getElementById('metrics-toggle');
        const metricsCloseBtn = document.getElementById('metrics-close-btn');
        const aboutToggle = document.getElementById('about-toggle');
        const aboutOverlay = document.getElementById('about-overlay');
        const aboutCloseBtn = document.getElementById('about-close-btn');

        // Fetch both JSON files concurrently
        Promise.all([
            fetch('./data/city_overview.json').then(res => res.json()),
            fetch('./data/city_statistics.json').then(res => res.json())
        ]).then(([cities, stats]) => {
            allCitiesData = cities;
            allCityStats = stats;
            console.log("Loaded city overview and statistics.");
            
            cities.sort((a, b) => a.name.localeCompare(b.name));
            
            cities.forEach(city => {
                const item = document.createElement('a');
                item.className = 'dropdown-item';
                item.textContent = city.name;
                item.dataset.cityId = city.id;
                item.dataset.cityName = city.name;
                cityDropdownList.appendChild(item);
            });
            
            const cityPointsGeoJSON = {
                type: 'FeatureCollection',
                features: cities.map(c => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [c.centroid_lon, c.centroid_lat] }, properties: { id: c.id, name: c.name } }))
            };
            map.addSource('city-markers', { type: 'geojson', data: cityPointsGeoJSON });
            map.addLayer({ id: 'city-markers-layer', type: 'circle', source: 'city-markers', paint: { 'circle-radius': 6, 'circle-color': '#E45A25', 'circle-stroke-color': 'white', 'circle-stroke-width': 2 } });
        
        }).catch(error => console.error('Error loading initial data:', error));

        // --- Attach all event listeners ---
        citySelectorBtn.addEventListener('click', () => { cityDropdownList.classList.toggle('hidden'); });
        cityDropdownList.addEventListener('click', (e) => {
            if (e.target.matches('.dropdown-item')) {
                const cityId = e.target.dataset.cityId;
                const cityName = e.target.dataset.cityName;
                citySelectorLabel.textContent = cityName;
                cityDropdownList.classList.add('hidden');
                loadCity(cityId);
            }
        });
        window.addEventListener('click', (e) => { if (!document.querySelector('.city-selector-container').contains(e.target)) { cityDropdownList.classList.add('hidden'); } });

        map.on('click', 'city-markers-layer', (e) => { 
            const cityId = e.features[0].properties.id;
            const cityName = e.features[0].properties.name;
            citySelectorLabel.textContent = cityName;
            loadCity(cityId); 
        });
        
        metricsToggle.addEventListener('click', () => { metricsPanel.classList.toggle('visible'); });
        metricsCloseBtn.addEventListener('click', () => { metricsPanel.classList.remove('visible'); });
        
        aboutToggle.addEventListener('click', () => { aboutOverlay.classList.remove('hidden'); });
        aboutCloseBtn.addEventListener('click', () => { aboutOverlay.classList.add('hidden'); });
        aboutOverlay.addEventListener('click', (e) => { if (e.target === aboutOverlay) aboutOverlay.classList.add('hidden'); });

        const cityPopup = new maplibregl.Popup({ closeButton: false, className: 'city-hover-popup' });
        map.on('mouseenter', 'city-markers-layer', (e) => { map.getCanvas().style.cursor = 'pointer'; cityPopup.setLngLat(e.features[0].geometry.coordinates.slice()).setText(e.features[0].properties.name).addTo(map); });
        map.on('mouseleave', 'city-markers-layer', () => { map.getCanvas().style.cursor = ''; cityPopup.remove(); });
    });

    map.on('error', (e) => console.error("A map error occurred:", e));
});