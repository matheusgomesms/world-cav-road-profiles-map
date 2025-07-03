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

    // This variable will be populated with city data once fetched
    let allCitiesData = [];

    // --- The complete and corrected function to load a city's data ---
    function loadCity(cityId) {
        const clusterInfo = {
            0: { letter: 'A', color: '#1a9641' },
            1: { letter: 'B', color: '#a6d96a' },
            3: { letter: 'C', color: '#fdae61' },
            2: { letter: 'D', color: '#d7191c' },
        };
        const highwayNames = {
            'residential': 'Residential',
            'tertiary': 'Tertiary',
            'secondary': 'Secondary',
            'unclassified': 'Unclassified',
            'primary': 'Primary',
            'living_street': 'Living Street',
            'trunk': 'Trunk'
        };
        const defaultStyle = { color: '#cccccc' };

        const lineColorExpression = ['match', ['get', 'cluster']];
        for (const [clusterId, style] of Object.entries(clusterInfo)) {
            lineColorExpression.push(parseInt(clusterId), style.color);
        }
        lineColorExpression.push(defaultStyle.color);

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
                'line-width': 3.5, // Your requested width
                'line-opacity': 0.9
            }
        });

        const segmentPopup = new maplibregl.Popup({
            closeButton: true, className: 'segment-popup'
        });

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
            const content = createPopupContent(e.features[0].properties);
            segmentPopup.setLngLat(e.lngLat).setHTML(content).addTo(map);
        });

        map.on('mouseleave', 'segments-layer', () => {
            if ('ontouchstart' in window) return;
            map.getCanvas().style.cursor = '';
            segmentPopup.remove();
        });

        map.on('click', 'segments-layer', (e) => {
            const content = createPopupContent(e.features[0].properties);
            segmentPopup.setLngLat(e.lngLat).setHTML(content).addTo(map);
        });
    }

    map.on('load', function() {
        console.log("Map style loaded. Initializing UI and data layers.");
        const citySelector = document.getElementById('city-selector');

        fetch('./data/city_overview.json')
            .then(response => response.json())
            .then(cities => {
                allCitiesData = cities; // Store data for use by other functions
                
                cities.sort((a, b) => a.name.localeCompare(b.name));
                
                // Populate dropdown
                cities.forEach(city => {
                    const option = document.createElement('option');
                    option.value = city.id;
                    option.textContent = city.name;
                    citySelector.appendChild(option);
                });

                // Add GeoJSON source for city markers
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

                // Add layer to display markers
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

        // Attach event listeners
        citySelector.addEventListener('change', function() {
            loadCity(this.value);
        });

        map.on('click', 'city-markers-layer', (e) => {
            const cityId = e.features[0].properties.id;
            loadCity(cityId);
            citySelector.value = cityId;
        });

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