// script.js

document.addEventListener('DOMContentLoaded', function() {
    
    // 1. Initialize PMTiles protocol
    let protocol = new pmtiles.Protocol();
    maplibregl.addProtocol("pmtiles", protocol.tile);

    // 2. Initialize the Map
    const map = new maplibregl.Map({
        container: 'map',
        style: 'https://tiles.openfreemap.org/styles/positron', 
        center: [0, 20], // Start centered on Europe/Africa
        zoom: 1
    });
    
    map.addControl(new maplibregl.NavigationControl(), 'top-left');

    // Global variables to hold our fetched data
    let allCitiesData = [];
    let allCityStats = {};

    // ==========================================================
    //  THE CENTRAL FUNCTION TO LOAD AND DISPLAY A CITY
    // ==========================================================
    // In script.js, replace the whole loadCity function

function loadCity(cityId) {
    const metricsPanel = document.getElementById('metrics-panel');
    const clusterColors = { A: '#1a9641', B: '#a6d96a', C: '#fdae61', D: '#d7191c' };

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

    // Update Bar Charts
    const barContainer = document.getElementById('bar-chart-container');
    barContainer.innerHTML = ''; // Clear previous content
    
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
    map.addSource('segments-source', { type: 'vector', url: `pmtiles://${pmtilesUrl}` });
    
    const lineColorExpression = ['match', ['get', 'cluster'], 0, clusterColors.A, 1, clusterColors.B, 3, clusterColors.C, 2, clusterColors.D, '#cccccc'];
    
    map.addLayer({
        'id': 'segments-layer', 'type': 'line', 'source': 'segments-source', 'source-layer': 'segments',
        'paint': { 'line-color': lineColorExpression, 'line-width': 3.5, 'line-opacity': 0.9 }
    });

    // --- Segment Popup and Event Listener Logic ---
    const segmentPopup = new maplibregl.Popup({ closeButton: true, className: 'segment-popup' });
    const clusterInfo = { 0: { letter: 'A' }, 1: { letter: 'B' }, 3: { letter: 'C' }, 2: { letter: 'D' } };
    const highwayNames = { 'residential': 'Residential', 'tertiary': 'Tertiary', 'secondary': 'Secondary', 'unclassified': 'Unclassified', 'primary': 'Primary', 'living_street': 'Living Street', 'trunk': 'Trunk' };

    function createPopupContent(properties) {
        const clusterNumber = properties.cluster;
        const clusterDisplay = clusterInfo[clusterNumber] ? `${clusterInfo[clusterNumber].letter}` : `${clusterNumber}`;
        const highwayType = properties.highway;
        const highwayDisplay = highwayNames[highwayType] || highwayType || 'N/A';
        
        return `
            <div style="font-weight: bold; margin-bottom: 5px;">Segment Details</div>
            <table class="popup-table">
                <tr><td><strong>Cluster:</strong></td><td>${clusterDisplay}</td></tr>
                <tr><td><strong>Road Classification:</strong></td><td>${highwayDisplay}</td></tr>
                <tr><td><strong>Number of Lanes:</strong></td><td>${properties.lanes || 'N/A'}</td></tr>
                <tr><td><strong>Speed Limit:</strong></td><td>${properties.maxspeed || 'N/A'}</td></tr>
                <tr><td><strong>Special Lane Presence:</strong></td><td>${properties.HasSpecialLane ? 'Yes' : 'No'}</td></tr>
                <tr><td><strong>Traffic Lights:</strong></td><td>${properties.highway_traffic_signals_count}</td></tr>
                <tr><td><strong>Traffic Signs:</strong></td><td>${properties.traffic_sign_count}</td></tr>
                <tr><td><strong>Crossings:</strong></td><td>${properties.TotalCrossingCount}</td></tr>
            </table>
        `;
    }

    map.on('mousemove', 'segments-layer', (e) => {
        if ('ontouchstart' in window) return;
        map.getCanvas().style.cursor = 'pointer';
        segmentPopup.setLngLat(e.lngLat).setHTML(createPopupContent(e.features[0].properties)).addTo(map);
    });

    map.on('mouseleave', 'segments-layer', () => {
        if ('ontouchstart' in window) return;
        map.getCanvas().style.cursor = '';
        segmentPopup.remove();
    });

    map.on('click', 'segments-layer', (e) => {
        segmentPopup.setLngLat(e.lngLat).setHTML(createPopupContent(e.features[0].properties)).addTo(map);
    });
}

    map.on('load', function() {
        console.log("Map ready. Fetching initial data...");
        
        Promise.all([
            fetch('./data/city_overview.json').then(res => res.json()),
            fetch('./data/city_statistics.json').then(res => res.json())
        ]).then(([cities, stats]) => {
            allCitiesData = cities;
            allCityStats = stats;
            
            const citySelector = document.getElementById('city-selector');
            cities.sort((a, b) => a.name.localeCompare(b.name)).forEach(city => {
                const option = document.createElement('option');
                option.value = city.id;
                option.textContent = city.name;
                citySelector.appendChild(option);
            });
            map.addSource('city-markers', { type: 'geojson', data: { type: 'FeatureCollection', features: cities.map(c => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [c.centroid_lon, c.centroid_lat] }, properties: { id: c.id, name: c.name } })) } });
            map.addLayer({ id: 'city-markers-layer', type: 'circle', source: 'city-markers', paint: { 'circle-radius': 6, 'circle-color': '#E45A25', 'circle-stroke-color': 'white', 'circle-stroke-width': 2 } });
        }).catch(error => console.error('Error loading initial data:', error));

        const citySelector = document.getElementById('city-selector');
        const metricsPanel = document.getElementById('metrics-panel');
        const metricsToggle = document.getElementById('metrics-toggle');
        const metricsCloseBtn = document.getElementById('metrics-close-btn');

        citySelector.addEventListener('change', function() { loadCity(this.value); });
        map.on('click', 'city-markers-layer', (e) => { const id = e.features[0].properties.id; citySelector.value = id; loadCity(id); });
        
        metricsToggle.addEventListener('click', () => { metricsPanel.classList.toggle('visible'); });
        metricsCloseBtn.addEventListener('click', () => { metricsPanel.classList.remove('visible'); });

        const cityPopup = new maplibregl.Popup({ closeButton: false, className: 'city-hover-popup' });
        map.on('mouseenter', 'city-markers-layer', (e) => { map.getCanvas().style.cursor = 'pointer'; cityPopup.setLngLat(e.features[0].geometry.coordinates.slice()).setText(e.features[0].properties.name).addTo(map); });
        map.on('mouseleave', 'city-markers-layer', () => { map.getCanvas().style.cursor = ''; cityPopup.remove(); });
    });

    map.on('error', (e) => console.error("A map error occurred:", e));
});