// @ts-nocheck
/**
 * =============================================================================
 * UNTIL EVERY CAGE IS EMPTY - MAP APPLICATION SCRIPT
 * =============================================================================
 * * This script powers the interactive map for the "Until Every Cage is Empty" project.
 * It handles:
 * - Initializing the Leaflet map and its controls.
 * - Fetching multiple datasets from the backend API.
 * - Creating and managing different map layers for each data type.
 * - Applying user filters (by state and data type).
 * - Dynamically generating detailed popups for each map marker.
 * - Updating the browser URL to allow for shareable map views.
 * * Main Dependencies: Leaflet.js, Leaflet.markercluster
 */

// =============================================================================
//  1. MAP INITIALIZATION & CONFIGURATION
// =============================================================================

// Define the absolute geographical boundaries of the map to prevent scrolling too far.
const southWest = L.latLng(-90, -180);
const northEast = L.latLng(90, 180);
const worldBounds = L.latLngBounds(southWest, northEast);

// Create the main Leaflet map instance, centered on the continental US.
const map = L.map('map', {
    maxBounds: worldBounds,
    maxBoundsViscosity: 0.1 // Makes the map "bounce back" at the edges.
}).setView([38.438847, -99.579560], 4).setMinZoom(2).setZoom(4);

// Define the base map tile layers (the map imagery itself).
const streetMap = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
});
const satelliteMap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
    attribution: 'Tiles &copy; Esri'
});

// Add the default street map layer to the map on initial load.
streetMap.addTo(map);

// Create the layer control to allow switching between Street and Satellite views.
const baseMaps = {
    "Street View": streetMap,
    "Satellite View": satelliteMap
};
L.control.layers(baseMaps, null, { collapsed: false }).addTo(map);


// =============================================================================
//  2. CUSTOM LEAFLET CONTROLS
// =============================================================================

/**
 * Custom Fullscreen Control for Leaflet.
 * This provides a simple fullscreen button that works across different browsers
 * and includes a fallback for browsers that don't support the Fullscreen API.
 */
L.Control.CustomFullscreen = L.Control.extend({
    options: {
        position: 'topleft',
        enterText: 'Fullscreen',
        exitText: 'Exit'
    },
    onAdd: function (map) {
        const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom-fullscreen');
        this.link = L.DomUtil.create('a', '', container);
        this.link.href = '#';
        this.link.innerHTML = this.options.enterText;
        this._map = map;
        // Add event listeners for various browser implementations of fullscreen change.
        L.DomEvent.on(document, 'fullscreenchange', this._onFullscreenChange, this);
        L.DomEvent.on(document, 'webkitfullscreenchange', this._onFullscreenChange, this);
        L.DomEvent.on(document, 'mozfullscreenchange', this._onFullscreenChange, this);
        L.DomEvent.on(document, 'msfullscreenchange', this._onFullscreenChange, this);
        L.DomEvent.on(container, 'click', L.DomEvent.stop);
        L.DomEvent.on(container, 'click', this._toggleFullscreen, this);
        return container;
    },
    onRemove: function (map) {
        // Clean up event listeners when the control is removed.
        L.DomEvent.off(document, 'fullscreenchange', this._onFullscreenChange, this);
        L.DomEvent.off(document, 'webkitfullscreenchange', this._onFullscreenChange, this);
        L.DomEvent.off(document, 'mozfullscreenchange', this._onFullscreenChange, this);
        L.DomEvent.off(document, 'msfullscreenchange', this._onFullscreenChange, this);
    },
    _toggleFullscreen: function () {
        const container = this._map.getContainer();
        if (L.DomUtil.hasClass(container, 'map-pseudo-fullscreen')) {
            // Exit pseudo-fullscreen
            L.DomUtil.removeClass(container, 'map-pseudo-fullscreen');
            this.link.innerHTML = this.options.enterText;
            this._map.invalidateSize();
            return;
        }
        // Check for native fullscreen support
        const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
        if (fullscreenElement) {
            // Exit native fullscreen
            const exitMethod = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
            if (exitMethod) {
                exitMethod.call(document);
            }
        } else {
            // Enter native fullscreen, with a fallback to pseudo-fullscreen
            const requestMethod = container.requestFullscreen || container.webkitRequestFullscreen || container.mozRequestFullScreen || container.msRequestFullscreen;
            if (requestMethod) {
                requestMethod.call(container);
            } else {
                L.DomUtil.addClass(container, 'map-pseudo-fullscreen');
                this.link.innerHTML = this.options.exitText;
                this._map.invalidateSize();
            }
        }
    },
    _onFullscreenChange: function () {
        const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
        if (fullscreenElement === this._map.getContainer()) {
            this.link.innerHTML = this.options.exitText;
        } else {
            L.DomUtil.removeClass(this._map.getContainer(), 'map-pseudo-fullscreen');
            this.link.innerHTML = this.options.enterText;
        }
    }
});
map.addControl(new L.Control.CustomFullscreen());


// =============================================================================
//  3. ICONS AND LAYER GROUPS
// =============================================================================

// Defines the visual icons used for each type of map marker.
const slaughterhouseIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});
const processingIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});
const labIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});
const inspectionReportIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

// --- Application State Management ---
// Global arrays to hold the master data fetched from the API.
let allLocations = [];
let allLabLocations = [];
let allInspectionReports = [];
let isInitialDataLoading = true; // Flag to prevent URL updates during initial load.

// --- Layer Groups ---
// For each data type, we need two types of layers:
// 1. A MarkerClusterGroup for the "All States" view to handle performance with many markers.
// 2. A regular FeatureLayer for the single-state view where clustering is not needed.
const slaughterhouseClusterLayer = L.markerClusterGroup({ chunkedLoading: true, maxClusterRadius: 75, disableClusteringAtZoom: 10 });
const processingClusterLayer = L.markerClusterGroup({ chunkedLoading: true, maxClusterRadius: 75, disableClusteringAtZoom: 10 });
const labClusterLayer = L.markerClusterGroup({ chunkedLoading: true, maxClusterRadius: 75, disableClusteringAtZoom: 10 });
const inspectionReportClusterLayer = L.markerClusterGroup({ chunkedLoading: true, maxClusterRadius: 75, disableClusteringAtZoom: 10 });

const slaughterhouseFeatureLayer = L.layerGroup();
const processingFeatureLayer = L.layerGroup();
const labFeatureLayer = L.layerGroup();
const inspectionReportFeatureLayer = L.layerGroup();


// --- DOM Element References ---
// Caching these references improves performance by avoiding repeated DOM lookups.
const slaughterhouseCheckbox = document.getElementById('slaughterhousesCheckbox');
const meatProcessingCheckbox = document.getElementById('meatProcessingPlantsCheckbox');
const testingLabsCheckbox = document.getElementById('testingLabsCheckbox');
const inspectionReportsCheckbox = document.getElementById('inspectionReportsCheckbox');
const stateSelector = document.getElementById('state-selector');
const shareViewBtn = document.getElementById('share-view-btn');

// =============================================================================
//  4. CORE APPLICATION LOGIC
// =============================================================================

/**
 * Updates the browser's URL with the current map state (center, zoom, filters).
 * This allows for shareable links.
 */
function updateUrlWithCurrentState() {
    if (isInitialDataLoading) {
        return; 
    }
    const center = map.getCenter();
    const zoom = map.getZoom();
    const lat = center.lat.toFixed(5);
    const lng = center.lng.toFixed(5);
    const selectedState = stateSelector.value;

    let activeLayers = [];
    if (slaughterhouseCheckbox.checked) activeLayers.push('slaughter');
    if (meatProcessingCheckbox.checked) activeLayers.push('processing');
    if (testingLabsCheckbox.checked) activeLayers.push('labs');
    if (inspectionReportsCheckbox.checked) activeLayers.push('inspections');


    const params = new URLSearchParams();
    params.set('lat', lat);
    params.set('lng', lng);
    params.set('zoom', zoom);
    params.set('state', selectedState);
    if (activeLayers.length > 0) {
        params.set('layers', activeLayers.join(','));
    }

    const newUrl = `${window.location.pathname}?${params.toString()}`;
    history.pushState({}, '', newUrl);
}

/**
 * Main filtering function. Clears all layers, filters the master data arrays
 * based on the selected state, and re-plots the visible markers.
 * @param {boolean} shouldUpdateView - If true, the map will pan/zoom to fit the new markers.
 */
function applyFilters(shouldUpdateView = false) {
    const selectedState = stateSelector.value;
    const isAllStatesView = selectedState === 'all';

    // --- 1. Clear all layers to ensure a clean slate ---
    slaughterhouseClusterLayer.clearLayers();
    processingClusterLayer.clearLayers();
    labClusterLayer.clearLayers();
    inspectionReportClusterLayer.clearLayers();
    slaughterhouseFeatureLayer.clearLayers();
    processingFeatureLayer.clearLayers();
    labFeatureLayer.clearLayers();
    inspectionReportFeatureLayer.clearLayers();
    
    map.removeLayer(slaughterhouseClusterLayer);
    map.removeLayer(processingClusterLayer);
    map.removeLayer(labClusterLayer);
    map.removeLayer(inspectionReportClusterLayer);
    map.removeLayer(slaughterhouseFeatureLayer);
    map.removeLayer(processingFeatureLayer);
    map.removeLayer(labFeatureLayer);
    map.removeLayer(inspectionReportFeatureLayer);

    const markerBounds = []; // Used to calculate the bounds for auto-zoom.

    // --- 2. Filter and plot USDA Slaughter/Processing Locations ---
    allLocations.filter(location => isAllStatesView || location.state === selectedState).forEach(location => {
        if (!location.latitude || !location.longitude) return;
        if (!isAllStatesView) markerBounds.push([location.latitude, location.longitude]);

        const isSlaughterhouse = location.slaughter && location.slaughter.toLowerCase() === 'yes';
        const markerIcon = isSlaughterhouse ? slaughterhouseIcon : processingIcon;
        const marker = L.marker([location.latitude, location.longitude], { icon: markerIcon });
        
        // Build the detailed popup content for this marker.
        const popupContent = buildUsdaPopup(location, isSlaughterhouse);
        marker.bindPopup(popupContent);

        // Add the marker to the appropriate layer (clustered or single).
        if (isSlaughterhouse) {
            isAllStatesView ? slaughterhouseClusterLayer.addLayer(marker) : slaughterhouseFeatureLayer.addLayer(marker);
        } else {
            isAllStatesView ? processingClusterLayer.addLayer(marker) : processingFeatureLayer.addLayer(marker);
        }
    });

    // --- 3. Filter and plot APHIS Lab Locations ---
    allLabLocations.filter(lab => isAllStatesView || getStateFromCityStateZip(lab['City-State-Zip']) === selectedState).forEach(lab => {
        if (lab.latitude && lab.longitude) {
            if (!isAllStatesView) markerBounds.push([lab.latitude, lab.longitude]);
            const marker = L.marker([lab.latitude, lab.longitude], { icon: labIcon });
            const popupContent = buildLabPopup(lab);
            marker.bindPopup(popupContent);
            isAllStatesView ? labClusterLayer.addLayer(marker) : labFeatureLayer.addLayer(marker);
        }
    });

    // --- 4. Filter and plot other APHIS Registrants (Breeders, Dealers, etc.) ---
    allInspectionReports.filter(report => isAllStatesView || report['State'] === selectedState).forEach(report => {
        const lat = report['Geocodio Latitude'];
        const lng = report['Geocodio Longitude'];
        if (lat && lng) {
            if (!isAllStatesView) markerBounds.push([lat, lng]);
            const marker = L.marker([parseFloat(lat), parseFloat(lng)], { icon: inspectionReportIcon });
            const popupContent = buildInspectionReportPopup(report);
            marker.bindPopup(popupContent);
            isAllStatesView ? inspectionReportClusterLayer.addLayer(marker) : inspectionReportFeatureLayer.addLayer(marker);
        }
    });

    // --- 5. Add the correct layers back to the map based on filters ---
    if (isAllStatesView) {
        if (slaughterhouseCheckbox.checked) map.addLayer(slaughterhouseClusterLayer);
        if (meatProcessingCheckbox.checked) map.addLayer(processingClusterLayer);
        if (testingLabsCheckbox.checked) map.addLayer(labClusterLayer);
        if (inspectionReportsCheckbox.checked) map.addLayer(inspectionReportClusterLayer);
    } else {
        if (slaughterhouseCheckbox.checked) map.addLayer(slaughterhouseFeatureLayer);
        if (meatProcessingCheckbox.checked) map.addLayer(processingFeatureLayer);
        if (testingLabsCheckbox.checked) map.addLayer(labFeatureLayer);
        if (inspectionReportsCheckbox.checked) map.addLayer(inspectionReportFeatureLayer);
    }
    
    // --- 6. Pan and zoom the map if necessary ---
    if (shouldUpdateView) {
        if (!isAllStatesView && markerBounds.length > 0) {
            map.fitBounds(L.latLngBounds(markerBounds).pad(0.1));
        } else if (isAllStatesView) {
            map.setView([38.438847, -99.579560], 4);
        }
    }
    updateUrlWithCurrentState();
}

// =============================================================================
//  5. POPUP BUILDER HELPER FUNCTIONS
// =============================================================================

function buildUsdaPopup(location, isSlaughterhouse) {
    const address = location.street && location.street.trim() ? `${location.street.trim()}, ${location.city.trim()}, ${location.state.trim()} ${location.zip}` : 'Address not available';
    const locationTypeText = isSlaughterhouse ? "Slaughterhouse" : "Processing-Only Facility";

    let animals_processed_monthly_text = "N/A";
    if (location.processing_volume_category) {
        switch (location.processing_volume_category) {
            case "1.0": animals_processed_monthly_text = "Less than 10,000 pounds of products processed per month."; break;
            case "2.0": animals_processed_monthly_text = "10,000 to 100,000 pounds of products processed per month."; break;
            case "3.0": animals_processed_monthly_text = "100,000 to 1,000,000 pounds of products processed per month."; break;
            case "4.0": animals_processed_monthly_text = "1,000,000 to 10,000,000 pounds of products processed per month."; break;
            case "5.0": animals_processed_monthly_text = "Over 10,000,000 pounds of products processed per month."; break;
        }
    }

    let slaughterText = "";
    if (isSlaughterhouse) {
        let animals_slaughtered_yearly_text = "N/A";
        if (location.slaughter_volume_category) {
            switch (location.slaughter_volume_category) {
                case "1.0": animals_slaughtered_yearly_text = "Less than 1,000 animals killed per year."; break;
                case "2.0": animals_slaughtered_yearly_text = "1,000 to 10,000 animals killed per year."; break;
                case "3.0": animals_slaughtered_yearly_text = "10,000 to 100,000 animals killed per year."; break;
                case "4.0": animals_slaughtered_yearly_text = "100,000 to 10,000,000 animals killed per year."; break;
                case "5.0": animals_slaughtered_yearly_text = "Over 10,000,000 animals killed per year."; break;
            }
        }
        slaughterText = `<hr><p><strong>Types of Animals Killed:</strong> ${location.animals_slaughtered || 'N/A'}</p><p><strong>Yearly Slaughter Count:</strong> ${animals_slaughtered_yearly_text}</p>`;
    }

    let otherNamesText = location.dbas ? `<p><strong>Doing Business As:</strong> ${location.dbas}</p>` : "";

    return `
        <div class="info-popup">
            <h3>${location.establishment_name || 'Unknown Name'}</h3>
            <p1><strong>${locationTypeText}</strong></p1><br>
            <p1>(${location.latitude}, ${location.longitude})</p1>
            <hr>
            <p><strong>Address:</strong> ${address}</p>
            <p><strong>Establishment ID:</strong> ${location.establishment_id}</p>
            <p><strong>Phone:</strong> ${location.phone || 'N/A'}</p>
            ${otherNamesText}
            <hr>
            <p><strong>Products Processed:</strong> ${location.animals_processed || 'N/A'}</p>
            <p><strong>Product Volume:</strong> ${animals_processed_monthly_text}</p>
            ${slaughterText}
        </div>`;
}

function buildLabPopup(lab) {
    return `
        <div class="info-popup">
            <h3>${lab['Account Name'] || 'Unknown Name'}</h3>
            <p1><strong>${lab['Registration Type'] || 'N/A'}</strong></p1><br>
            <p1>(${lab.latitude},${lab.longitude})</p1>
            <hr>
            <p><strong>Address:</strong> ${lab['Address Line 1']} ${lab['Address Line 2']} ${lab['City-State-Zip'] || 'N/A'}</p>
            <p><strong>Certificate Number:</strong> ${lab['Certificate Number'] || 'N/A'}</p>
            <p><strong>Animals Tested On:</strong> ${lab['Animals Tested On'] || 'N/A'}</p>
        </div>`;
}

function buildInspectionReportPopup(report) {
    let classText = "N/A";
    if (report['License Type'] === "Class A - Breeder") classText = "Breeder";
    else if (report['License Type'] === "Class B - Dealer") classText = "Dealer";
    else if (report['License Type'] === "Class C - Exhibitor") classText = "Exhibitor";
    
    return `
        <div class="info-popup inspection-popup">
            <h3>${report['Account Name'] || 'Unknown Name'}</h3>
            <p1><strong>${classText}</strong></p1><br>
            <p1>(${report['Geocodio Latitude']}, ${report['Geocodio Longitude']})</p1>
            <hr>
            <p><strong>Address:</strong> ${report['Address Line 1'] || ''}, ${report['City-State-Zip'] || 'N/A'}</p>
            <p><strong>Certificate Number:</strong> ${report['Certificate Number'] || 'N/A'}</p>
        </div>`;
}


// =============================================================================
//  6. EVENT LISTENERS & UTILITY FUNCTIONS
// =============================================================================

// Attach event listeners to all filter controls.
slaughterhouseCheckbox.addEventListener('change', () => applyFilters(false));
meatProcessingCheckbox.addEventListener('change', () => applyFilters(false));
testingLabsCheckbox.addEventListener('change', () => applyFilters(false));
inspectionReportsCheckbox.addEventListener('change', () => applyFilters(false));
stateSelector.addEventListener('change', () => applyFilters(true)); // Re-zoom map on state change
map.on('moveend', updateUrlWithCurrentState); // Update URL when map is panned/zoomed

/**
 * Extracts a two-letter state code from a "City, ST" string.
 * @param {string} cityStateZip - The combined location string.
 * @returns {string|null} The state code or null if not found.
 */
function getStateFromCityStateZip(cityStateZip) {
    if (!cityStateZip || typeof cityStateZip !== 'string') return null;
    const match = cityStateZip.match(/, ([A-Z]{2})/);
    return match ? match[1] : null;
}

// Logic for the "Share View" button to copy the current URL.
shareViewBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
        const originalText = shareViewBtn.textContent;
        shareViewBtn.textContent = 'Link Copied!';
        shareViewBtn.classList.add('copied');
        setTimeout(() => {
            shareViewBtn.textContent = originalText;
            shareViewBtn.classList.remove('copied');
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy URL: ', err);
        alert('Could not copy link. Please copy the URL from your address bar.');
    });
});


// =============================================================================
//  7. APPLICATION INITIALIZATION
// =============================================================================

/**
 * Main entry point for the application. Fetches all data, sets up controls,
 * and renders the initial map view.
 */
async function initializeApp() {
    const loader = document.getElementById('loader-overlay'); 
    try {
        if(loader) loader.style.display = 'flex';

        // Fetch all data sources in parallel for faster loading.
        const [usdaResponse, aphisResponse, inspectionsResponse] = await Promise.all([
            fetch('https://untileverycage-ikbq.shuttle.app/api/locations'),
            fetch('https://untileverycage-ikbq.shuttle.app/api/aphis-reports'),
            fetch('https://untileverycage-ikbq.shuttle.app/api/inspection-reports')
        ]);

        if (!usdaResponse.ok) throw new Error(`USDA data request failed: ${usdaResponse.status}`);
        if (!aphisResponse.ok) throw new Error(`APHIS data request failed: ${aphisResponse.status}`);
        if (!inspectionsResponse.ok) throw new Error(`Inspections data request failed: ${inspectionsResponse.status}`);

        allLocations = await usdaResponse.json();
        allLabLocations = await aphisResponse.json();
        allInspectionReports = await inspectionsResponse.json();
        
        // --- Dynamically populate the state filter dropdown ---
        const allStateValues = [
            ...allLocations.map(loc => loc.state),
            ...allLabLocations.map(lab => getStateFromCityStateZip(lab['City-State-Zip'])),
            ...allInspectionReports.map(report => report['State'])
        ];
        const uniqueStates = [...new Set(allStateValues.filter(state => state != null))];
        uniqueStates.sort();
        stateSelector.innerHTML = '<option value="all">All States</option>';
        uniqueStates.forEach(state => {
            const option = document.createElement('option');
            option.value = state;
            option.textContent = state;
            stateSelector.appendChild(option);
        });

        // --- Check for URL parameters to restore a shared view ---
        const urlParams = new URLSearchParams(window.location.search);
        const stateParam = urlParams.get('state');
        const layersParam = urlParams.get('layers');
        const latParam = urlParams.get('lat');
        const lngParam = urlParams.get('lng');
        const zoomParam = urlParams.get('zoom');
        let shouldUpdateViewOnLoad = true;

        if (layersParam) {
            const visibleLayers = layersParam.split(',');
            slaughterhouseCheckbox.checked = visibleLayers.includes('slaughter');
            meatProcessingCheckbox.checked = visibleLayers.includes('processing');
            testingLabsCheckbox.checked = visibleLayers.includes('labs');
            inspectionReportsCheckbox.checked = visibleLayers.includes('inspections');
        }
        if (stateParam) {
            stateSelector.value = stateParam;
        }
        if (latParam && lngParam && zoomParam) {
            map.setView([parseFloat(latParam), parseFloat(lngParam)], parseInt(zoomParam));
            shouldUpdateViewOnLoad = false; // Don't reset view if we have coordinates.
        }

        // Apply the initial filters based on default state or URL params.
        applyFilters(shouldUpdateViewOnLoad);

    } catch (error) {
        console.error('Failed to fetch initial data:', error);
        alert(`There was a critical error fetching data from the server: ${error.message}`);
    } finally {
        if(loader) loader.style.display = 'none';
        isInitialDataLoading = false;
        updateUrlWithCurrentState();
    }
}

initializeApp();