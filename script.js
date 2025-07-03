// script.js

// Make sure the DOM is loaded before we do anything
document.addEventListener('DOMContentLoaded', function() {
    
    // 1. Initialize PMTiles protocol
    // This MUST be done before the map is initialized.
    let protocol = new pmtiles.Protocol();
    maplibregl.addProtocol("pmtiles", protocol.tile);

    // 2. Initialize the Map
    const map = new maplibregl.Map({
        container: 'map', // The ID of your map div
        // The style from OpenFreeMap
        style: 'https://tiles.openfreemap.org/styles/bright', 
        center: [0, 20], // Start centered on Europe/Africa
        zoom: 1 
    });
    
    // Add basic map controls
    map.addControl(new maplibregl.NavigationControl());

    // --- THIS IS THE CRUCIAL FIX ---
    // Wait for the map's style to finish loading before trying to add data
    map.on('load', function() {
        console.log("Map style has loaded. Now setting up city data.");

        const citySelector = document.getElementById('city-selector');

        // 3. Populate the City Selector Dropdown
        fetch('./data/city_overview.json')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok: ' + response.statusText);
                }
                return response.json();
            })
            .then(cities => {
                console.log("Loaded city_overview.json successfully.");
                cities.sort((a, b) => a.name.localeCompare(b.name));
                
                cities.forEach(city => {
                    const option = document.createElement('option');
                    option.value = city.id;
                    option.textContent = city.name;
                    citySelector.appendChild(option);
                    
                    // Add a marker to the map for each city
                    new maplibregl.Marker({ color: '#E45A25' })
                        .setLngLat([city.centroid_lon, city.centroid_lat])
                        .setPopup(new maplibregl.Popup({ offset: 25 }).setText(city.name))
                        .addTo(map);
                });
            })
            .catch(error => {
                console.error('Error fetching or parsing city_overview.json:', error);
                alert('Could not load city data. Please check the console for errors.');
            });

        // 4. Handle City Selection
        citySelector.addEventListener('change', function() {
            const cityId = this.value;
            
            // Remove old layer and source if they exist from a previous selection
            if (map.getLayer('segments-layer')) {
                map.removeLayer('segments-layer');
            }
            if (map.getSource('segments-source')) {
                map.removeSource('segments-source');
            }
            
            if (!cityId) return; // Do nothing if "-- Select a City --" is chosen

            // Find the selected city's data to zoom to its center
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
            
            // Construct the full URL for the PMTiles file
            const pmtilesUrl = `${window.location.href.substring(0, window.location.href.lastIndexOf('/'))}/data/pmtiles_by_city/${cityId}.pmtiles`;
            console.log("Attempting to load PMTiles from:", pmtilesUrl);

            // Add the new PMTiles source
            map.addSource('segments-source', {
                type: 'vector',
                url: `pmtiles://${pmtilesUrl}`,
                attribution: 'Street data © OpenStreetMap contributors'
            });

            // Add the layer to display the segments
            map.addLayer({
                'id': 'segments-layer',
                'type': 'line',
                'source': 'segments-source',
                'source-layer': 'segments', // This MUST match the name from Tippecanoe (-l flag)
                'paint': {
                    'line-color': '#00BFFF', // A bright blue color
                    'line-width': 2.5,
                    'line-opacity': 0.8
                }
            });
        });

    }); // End of map.on('load', ...)

    map.on('error', (e) => {
        console.error("A map error occurred:", e);
    });

}); // End of DOMContentLoaded