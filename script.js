// script.js

document.addEventListener('DOMContentLoaded', function() {
    
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
    
    map.addControl(new maplibregl.NavigationControl());

    // This variable will hold our city data once fetched, making it accessible to all functions.
    let allCitiesData = [];

    // ==========================================================
    //  THE CENTRAL FUNCTION TO LOAD AND DISPLAY A CITY
    // ==========================================================
// In script.js, find and replace the whole loadCity function

function loadCity(cityId) {
    // --- Define Styles and Labels for Clusters ---
    const clusterInfo = {
        0: { letter: 'A', color: '#1a9641' }, // Dark Green
        1: { letter: 'B', color: '#a6d96a' }, // Light Green/Yellow
        3: { letter: 'C', color: '#fdae61' }, // Orange (Cluster 3 is C)
        2: { letter: 'D', color: '#d7191c' }, // Red
    };
    const defaultStyle = { color: '#cccccc', width: 2 };

    // ==========================================================
    //  NEW: Highway Classification Mapping
    // ==========================================================
    const highwayNames = {
        'residential': 'Residential',
        'tertiary': 'Tertiary',
        'secondary': 'Secondary',
        'unclassified': 'Unclassified',
        'primary': 'Primary',
        'living_street': 'Living Street',
        'trunk': 'Trunk'
    };
    // ==========================================================

    // --- Prepare Data-Driven Styling Expression for Color ---
    const lineColorExpression = ['match', ['get', 'cluster']];
    for (const [clusterId, style] of Object.entries(clusterInfo)) {
        lineColorExpression.push(parseInt(clusterId), style.color);
    }
    lineColorExpression.push(defaultStyle.color);

    // --- Main Logic ---
    if (!cityId) {
        if (map.getLayer('segments-layer')) map.removeLayer('segments-layer');
        if (map.getSource('segments-source')) map.removeSource('segments-source');
        return;
    }

    const selectedCity = allCitiesData.find(c => c.id === cityId);
    if (!selectedCity) return;

    map.flyTo({
        center: [selectedCity.centroid_lon, selectedCity.centroid_lat],
        zoom: 12
    });

    if (map.getLayer('segments-layer')) map.removeLayer('segments-layer');
    if (map.getSource('segments-source')) map.removeSource('segments-source');
    
    const pmtilesUrl = `./data/pmtiles_by_city/${cityId}.pmtiles`;
    console.log("Loading PMTiles for:", cityId);

    map.addSource('segments-source', {
        type: 'vector',
        url: `pmtiles://${pmtilesUrl}`,
        attribution: 'Street data © OpenStreetMap contributors'
    });

    map.addLayer({
        'id': 'segments-layer',
        'type': 'line',
        'source': 'segments-source',
        'source-layer': 'segments',
        'paint': {
            'line-color': lineColorExpression,
            'line-width': 3.5,
            'line-opacity': 0.9
        }
    });

    const segmentPopup = new maplibregl.Popup({
        closeButton: false,
        className: 'segment-popup'
    });

    map.on('mousemove', 'segments-layer', (e) => {
        map.getCanvas().style.cursor = 'pointer';
        const feature = e.features[0];
        const properties = feature.properties;
        
        // --- MODIFIED: Map both cluster and highway to their display names ---
        const clusterNumber = properties.cluster;
        const clusterDisplay = clusterInfo[clusterNumber] 
            ? `${clusterInfo[clusterNumber].letter}` 
            : `${clusterNumber}`;
        
        const highwayType = properties.highway;
        const highwayDisplay = highwayNames[highwayType] || highwayType || 'N/A'; // Use mapping, or original, or N/A

        const popupContent = `
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
        
        segmentPopup.setLngLat(e.lngLat).setHTML(popupContent).addTo(map);
    });

    map.on('mouseleave', 'segments-layer', () => {
        map.getCanvas().style.cursor = '';
        segmentPopup.remove();
    });
}

    // ==========================================================
    //  Map 'load' event - This is where the setup starts
    // ==========================================================
    map.on('load', function() {
        console.log("Map style loaded. Fetching city data...");
        const citySelector = document.getElementById('city-selector');

        fetch('./data/city_overview.json')
            .then(response => response.json())
            .then(cities => {
                allCitiesData = cities; // Store the data for global use
                cities.sort((a, b) => a.name.localeCompare(b.name));
                
                // Populate the dropdown
                cities.forEach(city => {
                    const option = document.createElement('option');
                    option.value = city.id;
                    option.textContent = city.name;
                    citySelector.appendChild(option);
                });

                // Create and add the GeoJSON source for city markers
                map.addSource('city-markers', {
                    type: 'geojson',
                    data: {
                        type: 'FeatureCollection',
                        features: cities.map(city => ({
                            type: 'Feature',
                            geometry: { type: 'Point', coordinates: [city.centroid_lon, city.centroid_lat] },
                            properties: { id: city.id, name: city.name }
                        }))
                    }
                });

                // Add the layer to display the markers
                map.addLayer({
                    id: 'city-markers-layer',
                    type: 'circle',
                    source: 'city-markers',
                    paint: {
                        'circle-radius': 6,
                        'circle-color': '#E45A25',
                        'circle-stroke-color': 'white',
                        'circle-stroke-width': 2
                    }
                });
            })
            .catch(error => console.error('Error loading city_overview.json:', error));

        // --- Event Listeners ---

        // Dropdown listener
        citySelector.addEventListener('change', function() {
            loadCity(this.value);
        });

        // Marker click listener
        map.on('click', 'city-markers-layer', (e) => {
            const cityId = e.features[0].properties.id;
            loadCity(cityId);
            citySelector.value = cityId; // Sync dropdown
        });

        // Hover popup for city markers
        const cityPopup = new maplibregl.Popup({
            closeButton: false,
            closeOnClick: false,
            className: 'city-hover-popup'
        });

        map.on('mouseenter', 'city-markers-layer', (e) => {
            map.getCanvas().style.cursor = 'pointer';
            const coordinates = e.features[0].geometry.coordinates.slice();
            const cityName = e.features[0].properties.name;
            cityPopup.setLngLat(coordinates).setText(cityName).addTo(map);
        });

        map.on('mouseleave', 'city-markers-layer', () => {
            map.getCanvas().style.cursor = '';
            cityPopup.remove();
        });
    });

    map.on('error', (e) => console.error("A map error occurred:", e));
});