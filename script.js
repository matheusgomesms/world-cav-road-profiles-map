// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    
    // 1. Initialize PMTiles protocol
    let protocol = new pmtiles.Protocol();
    maplibregl.addProtocol("pmtiles", protocol.tile);

    // 2. Initialize the Map
    const map = new maplibregl.Map({
        container: 'map', // container ID
        // Using the Positron style from OpenFreeMap
        style: 'https://openfreemap.org/styles/positron.json', 
        center: [0, 20], // starting position [lng, lat]
        zoom: 1 // starting zoom
    });

    // 3. Populate the City Selector and add city markers
    const citySelector = document.getElementById('city-selector');
    
    // Fetch your city overview data
    fetch('./data/city_overview.json')
        .then(response => response.json())
        .then(cities => {
            // Sort cities alphabetically for the dropdown
            cities.sort((a, b) => a.name.localeCompare(b.name));
            
            cities.forEach(city => {
                // Add city to the dropdown
                const option = document.createElement('option');
                option.value = city.id;
                option.textContent = city.name;
                citySelector.appendChild(option);

                // Add a marker to the map for each city
                new maplibregl.Marker({ color: '#E45A25' })
                    .setLngLat([city.centroid_lon, city.centroid_lat])
                    .setPopup(new maplibregl.Popup().setText(city.name))
                    .addTo(map);
            });
        });

    // 4. Handle City Selection
    citySelector.addEventListener('change', function() {
        const cityId = this.value;
        if (!cityId) return;

        // --- Remove old layer and source if they exist ---
        if (map.getLayer('segments-layer')) {
            map.removeLayer('segments-layer');
        }
        if (map.getSource('segments-source')) {
            map.removeSource('segments-source');
        }
        // ---------------------------------------------

        // Find the selected city's data to zoom to its center
        fetch('./data/city_overview.json')
            .then(res => res.json())
            .then(cities => {
                const selectedCity = cities.find(c => c.id === cityId);
                if (selectedCity) {
                    map.flyTo({
                        center: [selectedCity.centroid_lon, selectedCity.centroid_lat],
                        zoom: 12
                    });
                }
            });
        
        // --- Add the new city's PMTiles source and layer ---
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
            'source-layer': 'segments', // This must match the name from Tippecanoe
            'paint': {
                'line-color': '#00BFFF', // A bright blue color
                'line-width': 2.5
            }
        });
        // ----------------------------------------------------
    });

});