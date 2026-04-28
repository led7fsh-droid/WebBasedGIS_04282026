//NOTE: My code was a lot more simple before but I wanted to shorten it some which didn't really 
// work but then CoPilot changed a lot of my coding style in order to do that. 
// I don't know if I like it but it is what it is. I also added a lot of comments 
// to make it easier to understand for other people who might look at it in the future, 
// and to make it easier for me to remember what I did when I inevitably forget in a few months.


// Set up the Leaflet map centered on Vermont at zoom level 7
const map = L.map('map').setView([43.85, -72.45], 7);

// Add a terrain basemap using Stadia/Stamen tiles
L.tileLayer('https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}{r}.{ext}', {
    minZoom: 0,
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://www.stamen.com/" target="_blank">Stamen Design</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    ext: 'png'
}).addTo(map);

// Move the zoom buttons to the top-left corner so they don't overlap other controls
map.zoomControl.setPosition('topleft');

// Grab the sidebar element and save its default HTML so we can reset it later
const sidebarElement = document.getElementById('sidebar');
const defaultSidebarHTML = sidebarElement
    ? sidebarElement.innerHTML
    : '<h2>Welcome</h2><p>Click an access point or a district to see details here.</p>';

// Full list of fish species we track in this dataset
const FISH_LIST = [
    'YellowPerch',
    'NorthernPike',
    'LargeMouthBass',
    'SmallMouthBass',
    'Walleye',
    'Largemouth',
    'Smallmouth',
    'Crappie',
    'Bluegill',
    'BrookTrout',
    'RainbowTrout',
    'BrownTrout',
    'ChanneICatfish',
    'Muskie',
    'Pickerel',
    'CommonCarp',
    'Sunfish',
    'Perch'
];

// Dropbox URLs for each ramp type icon image
const imageLinks = {
    concrete: 'https://dl.dropboxusercontent.com/scl/fi/1hbeqal34yz4y2kkb84ra/concrete.png?rlkey=6fc7jroppeumctqifycurapg8&st=m97q2em2&dl=1',
    concretePlank: 'https://dl.dropboxusercontent.com/scl/fi/6yjlrimqhmmzqbe05cen1/concrete_plank.png?rlkey=p3ijnvi9lax1ts9agr0drgfey&st=pwb4spyg&dl=1',
    gravel: 'https://dl.dropboxusercontent.com/scl/fi/d26rhb1h7ktbn1dbmvucs/gravel.png?rlkey=60fkmqt6dg3v6vnhjr6g9adhv&st=6tpawzso&dl=1',
    steps: 'https://dl.dropboxusercontent.com/scl/fi/huj3hh5zdsyuhzzmqcbbn/steps.png?rlkey=kjl44ee1qa4idxzskxj1bmpfl&st=o2mhpgyw&dl=1',
    none: 'https://dl.dropboxusercontent.com/scl/fi/shwis6f647hbw9sr6c5gs/none.png?rlkey=pivuuskwl0wsmqje26au6s567&st=e9ou050u&dl=1'
};

// Central state object — holds all loaded GeoJSON data and UI state in one place
const appState = {
    data: {
        districts: null,
        lakes: null,
        streams: null,
        ramps: null
    },
    ui: {
        markers: null,
        markersByName: {},
        selectedDistrict: null
    }
};

// Custom Leaflet icons for each ramp surface type
const rampIcons = {
    Concrete: L.divIcon({
        html: `<img src="${imageLinks.concrete}" class="concrete" />`,
        className: 'ramp-icon',
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        popupAnchor: [0, -36]
    }),
    'Concrete Plank': L.divIcon({
        html: `<img src="${imageLinks.concretePlank}" class="concrete-plank" />`,
        className: 'ramp-icon',
        iconSize: [49, 29],
        iconAnchor: [24, 29],
        popupAnchor: [0, -29]
    }),
    Gravel: L.divIcon({
        html: `<img src="${imageLinks.gravel}" class="gravel" />`,
        className: 'ramp-icon',
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        popupAnchor: [0, -36]
    }),
    Steps: L.divIcon({
        html: `<img src="${imageLinks.steps}" class="steps" />`,
        className: 'ramp-icon',
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        popupAnchor: [0, -36]
    }),
    None: L.divIcon({
        html: `<img src="${imageLinks.none}" class="none" />`,
        className: 'ramp-icon',
        iconSize: [29, 29],
        iconAnchor: [14, 29],
        popupAnchor: [0, -29]
    }),
    Default: L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41]
    })
};

// Shared base style for all district polygons (just the dashed border)
const districtBaseStyle = {
    dashArray: '5, 5'
};

// Default district style — gray fill, semi-transparent
const defaultDistrictStyle = {
    ...districtBaseStyle,
    fillColor: '#808080',
    fillOpacity: 0.3,
    color: '#333333',
    weight: 2,
    opacity: 0.5
};

// Highlighted style for when a district is clicked — golden/orange outline
const highlightedDistrictStyle = {
    ...districtBaseStyle,
    fillColor: '#FFD700',
    fillOpacity: 0.6,
    color: '#FFA500',
    weight: 3,
    opacity: 1
};

// Filter the FISH_LIST down to only species marked 'Yes', then add spaces to the names (e.g. BrownTrout -> Brown Trout)
function formatFishSpecies(properties) {
    return FISH_LIST
        .filter(species => properties[species] === 'Yes')
        .map(species => species.replace(/([A-Z])/g, ' $1').trim());
}

// Use Turf to find which fisheries district a ramp point falls inside
function findDistrictForFeature(feature) {
    const districts = appState.data.districts;
    if (!districts) {
        return null;
    }

    return districts.features.find(district => {
        try {
            return turf.booleanPointInPolygon(feature, district);
        } catch (error) {
            return false;
        }
    }) || null;
}

// Check if a ramp is inside a special lake regulation area or near a regulated stream,
// then build an alert HTML block to show in the sidebar if so
function buildRegulationHTML(feature) {
    const { lakes, streams } = appState.data;
    const lakeRegulationsURL = 'https://www.eregulations.com/vermont/fishing/index-of-lakes-ponds';
    const streamRegulationsURL = 'https://www.eregulations.com/vermont/fishing/index-of-rivers-streams';

    const isInLakeRegulation = Boolean(lakes) && lakes.features.some(lake => {
        try {
            return turf.booleanPointInPolygon(feature, lake);
        } catch (error) {
            return false;
        }
    });

    const isNearStreamRegulation = Boolean(streams) && streams.features.some(stream => {
        try {
            return turf.pointToLineDistance(feature, stream, { units: 'miles' }) <= 0.1;
        } catch (error) {
            return false;
        }
    });

    if (!isInLakeRegulation && !isNearStreamRegulation) {
        return '';
    }

    const titleAndMessage = isInLakeRegulation && isNearStreamRegulation
        ? '<strong>Special Rules Apply</strong><br />This ramp appears to intersect both lake and stream regulation areas.'
        : isInLakeRegulation
            ? '<strong>Special Lake Rules Apply</strong><br />This ramp is within a regulated lake or pond area.'
            : '<strong>Special Stream Rules Apply</strong><br />This ramp is close to a regulated river or stream.';

    const buttons = [
        isInLakeRegulation
            ? `<a class="sidebar-alert-button" href="${lakeRegulationsURL}" target="_blank" rel="noopener noreferrer">View Vermont Lake Regulations</a>`
            : '',
        isNearStreamRegulation
            ? `<a class="sidebar-alert-button" href="${streamRegulationsURL}" target="_blank" rel="noopener noreferrer">View Vermont Stream Regulations</a>`
            : ''
    ].join('');

    return `
        <div class="sidebar-alert">
            ${titleAndMessage}
            <div class="regulation-buttons">${buttons}</div>
        </div>
    `;
}

// Fill the sidebar with info about a clicked ramp — location, specs, fish species, and biologist contact
function populateRampSidebar(feature, districtFeature, regulationHTML) {
    if (!sidebarElement) {
        return;
    }

    const rampType = feature.properties.RampType || 'Unknown';
    const parkingCapacity = feature.properties.Parking || feature.properties.ParkingCapacity || feature.properties['Parking Capacity'] || 'Unknown';
    const universalAccess = feature.properties.UniversalAccess || feature.properties['UniversalAccess'] || feature.properties.Universal_Access || 'Unknown';
    const town = feature.properties.Town || 'Unknown';
    const county = feature.properties.County || feature.properties.COUNTY || 'Unknown';
    const fishSpecies = formatFishSpecies(feature.properties);
    const biologistName = districtFeature
        ? `${districtFeature.properties.FirstName || ''} ${districtFeature.properties.LastName || ''}`.trim() || 'Unknown'
        : 'Unknown';
    const biologistEmail = districtFeature ? (districtFeature.properties.Email || 'Unknown') : 'Unknown';

    const fishSpeciesHtml = fishSpecies.length
        ? `<ul>${fishSpecies.map(species => `<li>${species}</li>`).join('')}</ul>`
        : '<p>None listed</p>';

    sidebarElement.innerHTML = `
        <h2>${feature.properties.WaterBody || 'Unknown'}</h2>
        <div class="sidebar-section sidebar-basic">
            <p><strong>Town:</strong> ${town}</p>
            <p><strong>County:</strong> ${county}</p>
        </div>
        ${regulationHTML}
        <div class="sidebar-section"><h3>Ramp Specs</h3>
            <p><strong>Ramp Type:</strong> ${rampType}</p>
            <p><strong>Parking Capacity:</strong> ${parkingCapacity}</p>
            <p><strong>Universal Access:</strong> ${universalAccess}</p>
        </div>
        <div class="sidebar-section"><h3>Fish Species</h3>
            ${fishSpeciesHtml}
        </div>
        <div class="sidebar-section"><h3>Management</h3>
            <p><strong>District Biologist:</strong> ${biologistName}</p>
            <p><strong>Email:</strong> <a href="mailto:${biologistEmail}">${biologistEmail}</a></p>
        </div>
    `;
}

// Fill the sidebar with a summary when a district polygon is clicked
function populateDistrictSidebar(feature, rampCounts, streamMiles) {
    if (!sidebarElement) {
        return;
    }

    const districtName = feature.properties.ABNAME || feature.properties.BOUNDARY || 'District';
    const biologistName = `${feature.properties.FirstName || ''} ${feature.properties.LastName || ''}`.trim() || 'Unknown';
    const biologistEmail = feature.properties.Email || 'Unknown';

    const totalAccessPoints = Object.values(rampCounts).reduce((sum, count) => sum + count, 0);
    const rampSummary = Object.entries(rampCounts)
        .map(([type, count]) => `<p>${type} Ramps: ${count}</p>`)
        .join('');

    sidebarElement.innerHTML = `
        <h2>Location Report</h2>
        <div class="sidebar-section"><h3>District Details</h3>
            <p><strong>District:</strong> ${districtName}</p>
        </div>
        <div class="sidebar-section"><h3>Ramp Summary</h3>
            <p><strong>Total Access Points:</strong> ${totalAccessPoints}</p>
            ${rampSummary}
        </div>
        <div class="sidebar-section"><h3>Management</h3>
            <p><strong>District Biologist:</strong> ${biologistName}</p>
            <p><strong>Email:</strong> <a href="mailto:${biologistEmail}">${biologistEmail}</a></p>
            <p><strong>Special Regulation Streams:</strong> ${streamMiles} miles</p>
        </div>
    `;
}

// Put a district polygon back to its default gray style after it's been deselected
function resetDistrictStyle(layer) {
    if (layer) {
        layer.setStyle(defaultDistrictStyle);
    }
}

// Reset sidebar text and deselect any highlighted district
function resetMap() {
    if (sidebarElement) {
        sidebarElement.innerHTML = defaultSidebarHTML;
    }

    if (appState.ui.selectedDistrict) {
        resetDistrictStyle(appState.ui.selectedDistrict);
    }

    appState.ui.selectedDistrict = null;
}

// Clear whatever text the user typed in the search box
function clearSearchInput() {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.value = '';
    }
}

// Look up the typed water body name and fly the map to it, then clear the input
function handleSearch(input) {
    const query = input.value.toLowerCase().trim();
    const marker = query ? appState.ui.markersByName[query] : null;

    if (marker) {
        map.setView(marker.getLatLng(), 15);
        marker.fire('click');
        clearSearchInput();
        return;
    }

    clearSearchInput();
    alert('Water body not found');
}

// Count how many ramps of each type fall inside a given district polygon using Turf
function countRampsByType(district) {
    try {
        const ramps = appState.data.ramps?.features || [];
        const rampCollection = turf.featureCollection(ramps);
        const rampsInDistrict = turf.pointsWithinPolygon(rampCollection, district);

        return rampsInDistrict.features.reduce((counts, ramp) => {
            const rampType = ramp.properties?.RampType || 'Unknown';
            counts[rampType] = (counts[rampType] || 0) + 1;
            return counts;
        }, {});
    } catch (error) {
        return {};
    }
}

// Add up the total miles of special-regulation streams that cross through a district
function calculateStreamMiles(district) {
    const streams = appState.data.streams?.features || [];

    const totalMiles = streams
        .filter(stream => {
            try {
                return turf.booleanIntersects(stream, district);
            } catch (error) {
                return false;
            }
        })
        .reduce((sum, stream) => {
            try {
                return sum + turf.length(stream, { units: 'miles' });
            } catch (error) {
                return sum;
            }
        }, 0);

    return totalMiles.toFixed(2);
}

// Re-render the ramp markers on the map based on the selected seasonal filter
function updateRamps(filter) {
    const ramps = appState.data.ramps;
    const markerGroup = appState.ui.markers;
    if (!ramps || !markerGroup) {
        return;
    }

    markerGroup.clearLayers();
    appState.ui.markersByName = {};

    // Keep only the ramps that match the selected season filter
    const filteredFeatures = ramps.features.filter(feature => {
        if (filter === 'summer') {
            const shore = feature.properties.Shorefishing || '';
            return shore.includes('Year') || shore.includes('Summer');
        }

        if (filter === 'winter') {
            return feature.properties.WinterPlowing === 'Yes';
        }

        return true;
    });

    // Build a Leaflet marker for each filtered ramp and wire up its click event
    const markerRecords = filteredFeatures
        .map(feature => {
            const coordinates = feature.geometry?.coordinates;
            if (!coordinates || coordinates.length < 2) {
                return null;
            }

            const ramp = feature.properties.RampType;
            const marker = L.marker([coordinates[1], coordinates[0]], {
                icon: rampIcons[ramp] || rampIcons.Default
            });

            marker.bindTooltip(feature.properties.WaterBody || 'Unknown', {
                className: 'tiny-tooltip',
                direction: 'top',
                offset: [0, -25]
            });

            marker.on('click', () => {
                const districtFeature = findDistrictForFeature(feature);
                const regulationHTML = buildRegulationHTML(feature);
                populateRampSidebar(feature, districtFeature, regulationHTML);
            });

            return {
                key: (feature.properties.WaterBody || 'Unknown').toLowerCase(),
                marker
            };
        })
        .filter(Boolean);

    // Add each marker to the cluster group and register it in the name lookup index
    markerRecords.reduce((acc, { key, marker }) => {
        acc[key] = marker;
        markerGroup.addLayer(marker);
        return acc;
    }, appState.ui.markersByName);
}

// Search bar in the bottom-right corner — lets users look up a water body by name
const searchControl = L.control({ position: 'bottomright' });
searchControl.onAdd = function onAddSearchControl() {
    const div = L.DomUtil.create('div', 'search-control');
    div.innerHTML = `
        <div class="search-row">
            <input type="text" class="search-input" id="search-input" placeholder="Search water body..." />
            <button class="search-btn" id="search-btn" type="button">Search</button>
            <button class="search-btn search-reset-btn" id="search-reset-btn" type="button">Reset</button>
        </div>
    `;
    L.DomEvent.disableClickPropagation(div);

    const button = div.querySelector('#search-btn');
    const input = div.querySelector('#search-input');
    const resetButton = div.querySelector('#search-reset-btn');

    if (button && input) {
        button.addEventListener('click', () => {
            handleSearch(input);
        });

        input.addEventListener('keydown', event => {
            if (event.key === 'Enter') {
                event.preventDefault();
                handleSearch(input);
            }
        });
    }

    if (resetButton) {
        resetButton.addEventListener('click', () => {
            clearSearchInput();
            resetMap();
        });
    }

    return div;
};
searchControl.addTo(map);

// Seasonal filter dropdown in the bottom-left — filters markers by summer or winter access
const filterControl = L.control({ position: 'bottomleft' });
filterControl.onAdd = function onAddFilterControl() {
    const div = L.DomUtil.create('div', 'filter-control');
    div.innerHTML = `
        <label class="control-label" for="season-filter">Seasonal Filter:</label>
        <select class="select-dropdown" id="season-filter">
            <option value="all">All Seasons</option>
            <option value="summer">Summer (Active)</option>
            <option value="winter">Winter (Plowed Only)</option>
        </select>
    `;
    L.DomEvent.disableClickPropagation(div);

    const select = div.querySelector('#season-filter');
    if (select) {
        select.addEventListener('change', event => {
            updateRamps(event.target.value);
        });
    }

    return div;
};

// Legend in the top-left explaining ramp types and special feature layers
const legend = L.control({ position: 'topleft' });
legend.onAdd = function onAddLegendControl() {
    const div = L.DomUtil.create('div', 'legend');
    div.className = 'legend-control';
    div.innerHTML = `
        <h4 class="legend-title">Legend</h4>
        <h5 class="legend-subtitle">Ramp Type</h5>
        <div class="legend-item"><img src="${imageLinks.concrete}" /> Concrete</div>
        <div class="legend-item"><img src="${imageLinks.concretePlank}" class="concrete-plank" /> Concrete Plank</div>
        <div class="legend-item"><img src="${imageLinks.gravel}" /> Gravel</div>
        <div class="legend-item"><img src="${imageLinks.steps}" /> Steps</div>
        <div class="legend-item"><img src="${imageLinks.none}" /> None</div>
        <h5 class="legend-subtitle">Special Features</h5>
        <div class="legend-item"><span class="special-stream"></span> Special Streams</div>
        <div class="legend-item"><span class="special-lake"></span> Special Lakes</div>
    `;
    return div;
};

// Show default sidebar content and clear search on initial load
resetMap();
clearSearchInput();

// If the user clicks empty map space (not a feature), reset everything
map.on('click', event => {
    const clickedInteractiveLayer = event.originalEvent
        && event.originalEvent.target
        && event.originalEvent.target.closest('.leaflet-interactive, .leaflet-marker-icon, .marker-cluster');

    if (!clickedInteractiveLayer && event.target === map) {
        resetMap();
        clearSearchInput();
    }
});

// Load and draw the Vermont state border outline from Dropbox
fetch('https://dl.dropboxusercontent.com/scl/fi/o2ps9u7xmkjxiciot8rjk/VT_border.json?rlkey=rqmixt2uij4h0a8pv3zqwrzmw&st=2yn84uvy&dl=0')
    .then(response => response.json())
    .then(borderData => {
        L.geoJSON(borderData, {
            style: {
                color: '#2c3e50',
                weight: 3,
                interactive: false
            }
        }).addTo(map).bringToBack();
    });

// All four main data sources — districts, lakes, streams, and ramps — paired with their keys
const dataSources = [
    ['districts', 'https://dl.dropboxusercontent.com/scl/fi/tvppuqysiyg4gqowou6rq/districts.geojson?rlkey=6p6zbjqdft2lx1vqwuizojgw1&st=1sl9l0o8&dl=0'],
    ['lakes', 'https://dl.dropboxusercontent.com/scl/fi/a4tyusp3f8cjq6aq8von2/special_lakes.geojson?rlkey=aoc1n1my4uwjr4u8pfqmfeccf&st=35f9u9e5&dl=0'],
    ['streams', 'https://dl.dropboxusercontent.com/scl/fi/wwh03gbgkpez4eag7p21k/special_streams.geojson?rlkey=vpa58air10yijj0oecj1ga7ul&st=0le2bjl4&dl=0'],
    ['ramps', 'https://dl.dropboxusercontent.com/scl/fi/g0wv4qraoeetvxotxb7ab/ramps.geojson?rlkey=wpr3jw3d7zqbhy00pqbefwkjv&st=l05uos7m&dl=0']
];

// Fetch all four datasets at once, then build all the map layers once they're ready
Promise.all(dataSources.map(([, url]) => fetch(url).then(response => response.json())))
    .then(results => {
        // Store each result in appState.data using the key from dataSources
        results.reduce((_, data, index) => {
            const key = dataSources[index][0];
            appState.data[key] = data;
            return null;
        }, null);

        const { districts, lakes, streams } = appState.data;

        // Draw clickable district polygons — clicking one highlights it and shows stats in the sidebar
        L.geoJSON(districts, {
            style: defaultDistrictStyle,
            onEachFeature(feature, layer) {
                layer.on('click', event => {
                    L.DomEvent.stopPropagation(event);

                    if (appState.ui.selectedDistrict) {
                        resetDistrictStyle(appState.ui.selectedDistrict);
                    }

                    layer.setStyle(highlightedDistrictStyle);
                    appState.ui.selectedDistrict = layer;

                    const rampCounts = countRampsByType(feature);
                    const streamMiles = calculateStreamMiles(feature);
                    const districtName = feature.properties.ABNAME || feature.properties.BOUNDARY || 'District';

                    layer.bindTooltip(districtName, {
                        className: 'tiny-tooltip',
                        direction: 'center'
                    });
                    layer.openTooltip(event.latlng);

                    populateDistrictSidebar(feature, rampCounts, streamMiles);
                });
            }
        }).addTo(map);

        // Draw special regulation lake polygons in green
        L.geoJSON(lakes, {
            style: {
                fillColor: '#00FF00',
                fillOpacity: 0.5,
                color: '#008000',
                weight: 2
            }
        }).addTo(map);

        // Draw special regulation stream lines in cyan
        L.geoJSON(streams, {
            style: {
                color: '#00FFFF',
                weight: 3,
                opacity: 1
            }
        }).addTo(map);

        // Set up the marker cluster group, populate all ramps, then add the cluster layer to the map
        appState.ui.markers = L.markerClusterGroup();
        updateRamps('all');
        map.addLayer(appState.ui.markers);
    })
    .catch(error => console.error('Error loading GeoJSON:', error));

// Add legend and filter controls to the map after everything else is set up
legend.addTo(map);
filterControl.addTo(map);
