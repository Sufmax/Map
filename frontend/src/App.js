import { useState, useCallback, useEffect } from "react";
import "./App.css";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import { Search, Navigation, Layers, MapPin, Info, Globe } from "lucide-react";
import L from "leaflet";

// Import Leaflet CSS
import "leaflet/dist/leaflet.css";

// Fix for default markers in React Leaflet
const DefaultIcon = L.icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Translations
const translations = {
  fr: {
    appTitle: "Globe Interactif",
    appSubtitle: "Explorez le monde avec des cartes satellites et des données géographiques en temps réel",
    searchPlaceholder: "Rechercher un lieu...",
    searchButton: "Rechercher",
    searching: "Recherche...",
    streetView: "Vue Carte",
    satelliteView: "Vue Satellite",
    terrainView: "Vue Terrain",
    locationInfo: "Informations de localisation",
    latitude: "Latitude",
    longitude: "Longitude",
    place: "Lieu",
    markers: "Marqueurs",
    zoom: "Zoom",
    view: "Vue",
    locationNotFound: "Lieu non trouvé. Essayez avec un autre terme de recherche.",
    searchError: "Erreur lors de la recherche. Veuillez réessayer.",
    clickMarker: "Clic: ",
    searchMarker: "Recherche: ",
    mapData: "Données cartographiques",
    contributors: "contributors",
    satelliteImages: "Images satellite"
  },
  en: {
    appTitle: "Interactive Globe",
    appSubtitle: "Explore the world with satellite maps and real-time geographic data",
    searchPlaceholder: "Search for a location...",
    searchButton: "Search",
    searching: "Searching...",
    streetView: "Street View",
    satelliteView: "Satellite View", 
    terrainView: "Terrain View",
    locationInfo: "Location Information",
    latitude: "Latitude",
    longitude: "Longitude",
    place: "Place",
    markers: "Markers",
    zoom: "Zoom",
    view: "View",
    locationNotFound: "Location not found. Try with another search term.",
    searchError: "Search error. Please try again.",
    clickMarker: "Click: ",
    searchMarker: "Search: ",
    mapData: "Map data",
    contributors: "contributors",
    satelliteImages: "Satellite images"
  }
};

// Component to handle map events
function MapEventHandler({ onLocationClick }) {
  useMapEvents({
    click: (e) => {
      const { lat, lng } = e.latlng;
      onLocationClick({ lat, lng });
    },
  });
  return null;
}

// Component to handle location search
const SearchBox = ({ onSearch }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    
    setIsLoading(true);
    try {
      // Using Nominatim API (free OpenStreetMap geocoding)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchTerm)}&limit=1`
      );
      const data = await response.json();
      
      if (data && data.length > 0) {
        const result = data[0];
        onSearch({
          lat: parseFloat(result.lat),
          lng: parseFloat(result.lon),
          name: result.display_name
        });
      } else {
        alert("Lieu non trouvé. Essayez avec un autre terme de recherche.");
      }
    } catch (error) {
      console.error("Erreur lors de la recherche:", error);
      alert("Erreur lors de la recherche. Veuillez réessayer.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="search-container">
      <form onSubmit={handleSearch} className="search-form">
        <div className="search-input-wrapper">
          <Search className="search-icon" size={20} />
          <input
            type="text"
            placeholder="Rechercher un lieu..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
            disabled={isLoading}
          />
        </div>
        <button 
          type="submit" 
          className="search-button"
          disabled={isLoading || !searchTerm.trim()}
        >
          {isLoading ? "Recherche..." : "Rechercher"}
        </button>
      </form>
    </div>
  );
};

// Component for map controls
const MapControls = ({ currentView, onLayerChange, onCenterMap }) => {
  const [showLayers, setShowLayers] = useState(false);

  const mapLayers = [
    { id: 'street', name: 'Vue Carte', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' },
    { id: 'satellite', name: 'Vue Satellite', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' },
    { id: 'terrain', name: 'Vue Terrain', url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png' }
  ];

  return (
    <div className="map-controls">
      <div className="control-group">
        <button 
          className="control-button"
          onClick={() => setShowLayers(!showLayers)}
          title="Changer de couche"
        >
          <Layers size={20} />
        </button>
        
        {showLayers && (
          <div className="layers-menu">
            {mapLayers.map(layer => (
              <button
                key={layer.id}
                className={`layer-option ${currentView === layer.id ? 'active' : ''}`}
                onClick={() => {
                  onLayerChange(layer);
                  setShowLayers(false);
                }}
              >
                {layer.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <button 
        className="control-button"
        onClick={onCenterMap}
        title="Centrer la carte"
      >
        <Navigation size={20} />
      </button>
    </div>
  );
};

// Info panel component
const InfoPanel = ({ selectedLocation, clickedLocation }) => {
  if (!selectedLocation && !clickedLocation) return null;

  const location = selectedLocation || clickedLocation;
  
  return (
    <div className="info-panel">
      <div className="info-header">
        <Info size={18} />
        <h3>Informations de localisation</h3>
      </div>
      <div className="info-content">
        <p><strong>Latitude:</strong> {location.lat.toFixed(6)}</p>
        <p><strong>Longitude:</strong> {location.lng.toFixed(6)}</p>
        {location.name && <p><strong>Lieu:</strong> {location.name}</p>}
      </div>
    </div>
  );
};

function App() {
  const [mapCenter, setMapCenter] = useState([46.603354, 1.888334]); // France center
  const [mapZoom, setMapZoom] = useState(6);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [clickedLocation, setClickedLocation] = useState(null);
  const [currentLayer, setCurrentLayer] = useState({
    id: 'street',
    name: 'Vue Carte',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
  });
  const [markers, setMarkers] = useState([]);

  const handleSearch = useCallback((location) => {
    setMapCenter([location.lat, location.lng]);
    setMapZoom(12);
    setSelectedLocation(location);
    
    // Add marker for searched location
    const newMarker = {
      id: Date.now(),
      position: [location.lat, location.lng],
      name: location.name || `Recherche: ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`
    };
    setMarkers(prev => [newMarker, ...prev.slice(0, 4)]); // Keep max 5 markers
  }, []);

  const handleLocationClick = useCallback((location) => {
    setClickedLocation(location);
    
    // Add marker for clicked location
    const newMarker = {
      id: Date.now(),
      position: [location.lat, location.lng],
      name: `Clic: ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`
    };
    setMarkers(prev => [newMarker, ...prev.slice(0, 4)]); // Keep max 5 markers
  }, []);

  const handleLayerChange = useCallback((layer) => {
    setCurrentLayer(layer);
  }, []);

  const handleCenterMap = useCallback(() => {
    setMapCenter([46.603354, 1.888334]);
    setMapZoom(6);
    setSelectedLocation(null);
    setClickedLocation(null);
  }, []);

  return (
    <div className="App">
      <div className="app-header">
        <div className="header-content">
          <div className="logo-section">
            <MapPin className="logo-icon" size={32} />
            <h1 className="app-title">Globe Interactif</h1>
          </div>
          <p className="app-subtitle">Explorez le monde avec des cartes satellites et des données géographiques en temps réel</p>
        </div>
      </div>

      <div className="main-content">
        <div className="map-section">
          <SearchBox onSearch={handleSearch} />
          
          <div className="map-wrapper">
            <MapContainer
              center={mapCenter}
              zoom={mapZoom}
              className="leaflet-map"
              zoomControl={true}
              scrollWheelZoom={true}
              doubleClickZoom={true}
              dragging={true}
            >
              <TileLayer
                url={currentLayer.url}
                attribution={currentLayer.id === 'satellite' 
                  ? '&copy; <a href="https://www.esri.com/">Esri</a>' 
                  : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                }
                maxZoom={18}
              />
              
              <MapEventHandler onLocationClick={handleLocationClick} />
              
              {markers.map((marker) => (
                <Marker key={marker.id} position={marker.position}>
                  <Popup>
                    <div className="popup-content">
                      <strong>{marker.name}</strong><br />
                      Lat: {marker.position[0].toFixed(6)}<br />
                      Lng: {marker.position[1].toFixed(6)}
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
            
            <MapControls 
              currentView={currentLayer.id}
              onLayerChange={handleLayerChange}
              onCenterMap={handleCenterMap}
            />
          </div>
        </div>

        <InfoPanel 
          selectedLocation={selectedLocation} 
          clickedLocation={clickedLocation}
        />
      </div>

      <footer className="app-footer">
        <div className="footer-content">
          <p>Données cartographiques © OpenStreetMap contributors | Images satellite © Esri</p>
          <div className="footer-stats">
            <span>Marqueurs: {markers.length}</span>
            <span>Zoom: {mapZoom}</span>
            <span>Vue: {currentLayer.name}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;