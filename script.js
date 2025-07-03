// script.js

document.addEventListener('DOMContentLoaded', function() {
    
    // 1. Initialize PMTiles protocol
    let protocol = new pmtiles.Protocol();
    maplibregl.addProtocol("pmtiles", protocol.tile);

    // 2. Initialize the Map
    const map = new maplibregl.Map({
        container: 'map',
        style: 'https://tiles.openfreemap.org/styles/bright', 
        center: [0, 20],
        zoom: 1
    });
    
    map.addControl(new maplibregl.NavigationControl());

    // Reusable function to load city data
    function loadCity(cityId) {
        if (!cityId) return;

        // Fetch the full city data to get its center coordinates for the zoom
        fetch('./data/city_overview.json')
            .then(res => res.json())
            .then(cities => {
                const selectedCity = cities.find(c => c.id === cityId);
                if (selectedCity) {
                    map.flyTo({
                        center: [selectedCity.centroid_lon, selectedCity.centroid_lat],
                        zoom: 12,
                        speed: 1.5
                    });
                }
            });

        // Remove old layer and source if they exist
        if (map.getLayer('segments-layer')) map.removeLayer('segments-layer');
        if (map.getSource('segments-source')) map.removeSource('segments-source');
        
        const pmtilesUrl = `./data/pmtiles_by_city/${cityId}.pmtiles`;
        console.log("Loading PMTiles for:", cityId);

        // Add the new city's PMTiles source and layer
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
                'line-color': '#00BFFF',
                'line-width': 2.5,
                'line-opacity': 0.8
            }
        });
    }

    // Main execution block when the map is ready
map.on('load', function() {
    console.log("Map style has loaded. Now setting up city data.");

    const citySelector = document.getElementById('city-selector');
    let allCitiesData = []; // To store city data for later use

    // Reusable function to load a city's data
    function loadCity(cityId) {
        if (!cityId) {
            if (map.getLayer('segments-layer')) map.removeLayer('segments-layer');
            if (map.getSource('segments-source')) map.removeSource('segments-source');
            return;
        }

        const selectedCity = allCitiesData.find(c => c.id === cityId);
        if (!selectedCity) {
            console.error("Could not find city data for id:", cityId);
            return;
        }

        // Fly to the city's location
        map.flyTo({
            center: [selectedCity.centroid_lon, selectedCity.centroid_lat],
            zoom: 12,
            speed: 1.5
        });

        // Remove old layer and source first
        if (map.getLayer('segments-layer')) map.removeLayer('segments-layer');
        if (map.getSource('segments-source')) map.removeSource('segments-source');
        
        const pmtilesUrl = `./data/pmtiles_by_city/${cityId}.pmtiles`;
        console.log("Loading PMTiles for:", cityId);

        // Add the new city's PMTiles source and layer
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
                'line-color': '#00BFFF',
                'line-width': 2.5,
                'line-opacity': 0.8
            }
        });
    }

    // --- Fetch city data and set up all interactive elements ---
    fetch('./data/city_overview.json')
        .then(response => response.json())
        .then(cities => {
            allCitiesData = cities; // Store the data
            console.log("Loaded city_overview.json successfully.");
            
            cities.sort((a, b) => a.name.localeCompare(b.name));
            
            // Populate the dropdown
            cities.forEach(city => {
                const option = document.createElement('option');
                option.value = city.id;
                option.textContent = city.name;
                citySelector.appendChild(option);
            });

            // Create a GeoJSON source from our city data
            const cityPoints = {
                type: 'FeatureCollection',
                features: cities.map(city => ({
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [city.centroid_lon, city.centroid_lat]
                    },
                    properties: {
                        id: city.id,
                        name: city.name
                    }
                }))
            };

            // Add the GeoJSON source and layer for the city markers
            map.addSource('city-markers', {
                type: 'geojson',
                data: cityPoints
            });

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
        .catch(error => console.error('Error fetching or parsing city_overview.json:', error));

    // --- Setup all event listeners ---

    // Dropdown listener
    citySelector.addEventListener('change', function() {
        loadCity(this.value);
    });

    // Marker click listener
    map.on('click', 'city-markers-layer', (e) => {
        const cityId = e.features[0].properties.id;
        loadCity(cityId);
        citySelector.value = cityId;
    });
    
    // --- HOVER POPUP LOGIC ---
    const popup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        className: 'city-hover-popup'
    });

    map.on('mouseenter', 'city-markers-layer', (e) => {
        map.getCanvas().style.cursor = 'pointer';

        const coordinates = e.features[0].geometry.coordinates.slice();
        const cityName = e.features[0].properties.name;

        while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
            coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
        }
        
        popup.setLngLat(coordinates)
             .setText(cityName)
             .addTo(map);
    });

    map.on('mouseleave', 'city-markers-layer', () => {
        map.getCanvas().style.cursor = '';
        popup.remove();
    });

});

    map.on('error', (e) => console.error("A map error occurred:", e));
});