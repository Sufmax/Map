import { useState, useCallback, useEffect, useRef } from "react";
import "./App.css";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from "react-leaflet";
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

// Component to handle map center and zoom changes
function MapController({ center, zoom }) {
  const map = useMap();
  
  useEffect(() => {
    if (center && zoom) {
      map.setView(center, zoom, { animate: true, duration: 1 });
    }
  }, [map, center, zoom]);
  
  return null;
}

// Language selector component (now removed as it's in map controls)
// const LanguageSelector = ({ currentLanguage, onLanguageChange }) => {
//   return (
//     <div className="language-selector">
//       <Globe size={18} />
//       <select 
//         value={currentLanguage} 
//         onChange={(e) => onLanguageChange(e.target.value)}
//         className="language-select"
//       >
//         <option value="fr">Français</option>
//         <option value="en">English</option>
//       </select>
//     </div>
//   );
// };

// Component to handle location search
const SearchBox = ({ onSearch, language }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const t = translations[language];

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    
    setIsLoading(true);
    try {
      // Using Nominatim API (free OpenStreetMap geocoding)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchTerm)}&limit=1&accept-language=${language}`
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
        alert(t.locationNotFound);
      }
    } catch (error) {
      console.error("Erreur lors de la recherche:", error);
      alert(t.searchError);
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
            placeholder={t.searchPlaceholder}
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
          {isLoading ? t.searching : t.searchButton}
        </button>
      </form>
    </div>
  );
};

// Component for map controls
const MapControls = ({ currentView, onLayerChange, onCenterMap, language, onLanguageChange }) => {
  const [showLayers, setShowLayers] = useState(false);
  const [showLanguages, setShowLanguages] = useState(false);
  const t = translations[language];

  const mapLayers = [
    { 
      id: 'street', 
      name: t.streetView, 
      url: `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png?lang=${language}`
    },
    { 
      id: 'satellite', 
      name: t.satelliteView, 
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' 
    },
    { 
      id: 'terrain', 
      name: t.terrainView, 
      url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png' 
    }
  ];

  const languages = [
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'en', name: 'English', flag: '🇬🇧' }
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

      <div className="control-group">
        <button 
          className="control-button"
          onClick={() => setShowLanguages(!showLanguages)}
          title="Changer la langue"
        >
          <Globe size={20} />
        </button>
        
        {showLanguages && (
          <div className="layers-menu">
            {languages.map(lang => (
              <button
                key={lang.code}
                className={`layer-option ${language === lang.code ? 'active' : ''}`}
                onClick={() => {
                  onLanguageChange(lang.code);
                  setShowLanguages(false);
                }}
              >
                <span className="language-flag">{lang.flag}</span>
                {lang.name}
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
const InfoPanel = ({ selectedLocation, clickedLocation, language }) => {
  if (!selectedLocation && !clickedLocation) return null;

  const location = selectedLocation || clickedLocation;
  const t = translations[language];
  
  return (
    <div className="info-panel">
      <div className="info-header">
        <Info size={18} />
        <h3>{t.locationInfo}</h3>
      </div>
      <div className="info-content">
        <p><strong>{t.latitude}:</strong> {location.lat.toFixed(6)}</p>
        <p><strong>{t.longitude}:</strong> {location.lng.toFixed(6)}</p>
        {location.name && <p><strong>{t.place}:</strong> {location.name}</p>}
      </div>
    </div>
  );
};

function App() {
  const [language, setLanguage] = useState('fr');
  const [mapCenter, setMapCenter] = useState([46.603354, 1.888334]); // France center
  const [mapZoom, setMapZoom] = useState(6);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [clickedLocation, setClickedLocation] = useState(null);
  const [currentLayer, setCurrentLayer] = useState({
    id: 'street',
    name: 'Vue Carte',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png?lang=fr'
  });
  const [searchMarkers, setSearchMarkers] = useState([]);
  const [clickMarker, setClickMarker] = useState(null); // Only one click marker at a time
  const [key, setKey] = useState(0); // Force re-render of map when language changes

  const t = translations[language];

  const handleLanguageChange = useCallback((newLanguage) => {
    setLanguage(newLanguage);
    
    // Update current layer URL and name for the new language, but preserve the URL pattern
    setCurrentLayer(prev => ({
      ...prev,
      name: translations[newLanguage][prev.id === 'street' ? 'streetView' : prev.id === 'satellite' ? 'satelliteView' : 'terrainView'],
      url: prev.id === 'street' 
        ? `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png?lang=${newLanguage}`
        : prev.url
    }));
    
    // Don't force map re-render to preserve current position
  }, []);

  const handleSearch = useCallback((location) => {
    // First, center and zoom the map to the location
    setMapCenter([location.lat, location.lng]);
    setMapZoom(14); // Higher zoom level for better view
    setSelectedLocation(location);
    
    // Add marker for searched location - keep multiple search markers
    const newMarker = {
      id: Date.now(),
      position: [location.lat, location.lng],
      name: location.name || `${t.searchMarker}${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`
    };
    setSearchMarkers(prev => [newMarker, ...prev.slice(0, 4)]); // Keep max 5 search markers
    
    // Force map to update center and zoom
    setTimeout(() => {
      setMapCenter([location.lat, location.lng]);
      setMapZoom(14);
    }, 100);
  }, [t]);

  const handleLocationClick = useCallback((location) => {
    setClickedLocation(location);
    
    // Replace any existing click marker with new one
    const newMarker = {
      id: Date.now(),
      position: [location.lat, location.lng],
      name: `${t.clickMarker}${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`
    };
    setClickMarker(newMarker); // Only one click marker at a time
  }, [t]);

  const handleLayerChange = useCallback((layer) => {
    setCurrentLayer(layer);
  }, []);

  const handleCenterMap = useCallback(() => {
    setMapCenter([46.603354, 1.888334]);
    setMapZoom(6);
    setSelectedLocation(null);
    setClickedLocation(null);
  }, []);

  // Combine all markers for display
  const allMarkers = [
    ...searchMarkers,
    ...(clickMarker ? [clickMarker] : [])
  ];

  return (
    <div className="App">
      <div className="app-header">
        <div className="header-content">
          <div className="header-top">
            <div className="logo-section">
              <MapPin className="logo-icon" size={32} />
              <h1 className="app-title">{t.appTitle}</h1>
            </div>
          </div>
          <p className="app-subtitle">{t.appSubtitle}</p>
        </div>
      </div>

      <div className="main-content">
        <div className="map-section">
          <SearchBox onSearch={handleSearch} language={language} />
          
          <div className="map-wrapper">
            <MapContainer
              key={key} // Force re-render when language changes
              center={mapCenter}
              zoom={mapZoom}
              className="leaflet-map"
              zoomControl={true}
              scrollWheelZoom={true}
              doubleClickZoom={true}
              dragging={true}
            >
              <TileLayer
                key={`${currentLayer.id}-${language}`} // Force re-render of tiles
                url={currentLayer.url}
                attribution={currentLayer.id === 'satellite' 
                  ? `&copy; <a href="https://www.esri.com/">Esri</a>` 
                  : language === 'fr' && currentLayer.id === 'street'
                    ? `&copy; <a href="https://www.openstreetmap.fr/">OpenStreetMap France</a> ${t.contributors}`
                    : `&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> ${t.contributors}`
                }
                maxZoom={18}
              />
              
              <MapEventHandler onLocationClick={handleLocationClick} />
              <MapController center={mapCenter} zoom={mapZoom} />
              
              {allMarkers.map((marker) => (
                <Marker key={marker.id} position={marker.position}>
                  <Popup>
                    <div className="popup-content">
                      <strong>{marker.name}</strong><br />
                      {t.latitude}: {marker.position[0].toFixed(6)}<br />
                      {t.longitude}: {marker.position[1].toFixed(6)}
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
            
            <MapControls 
              currentView={currentLayer.id}
              onLayerChange={handleLayerChange}
              onCenterMap={handleCenterMap}
              language={language}
            />
          </div>
        </div>

        <InfoPanel 
          selectedLocation={selectedLocation} 
          clickedLocation={clickedLocation}
          language={language}
        />
      </div>

      <footer className="app-footer">
        <div className="footer-content">
          <p>{t.mapData} © OpenStreetMap {t.contributors} | {t.satelliteImages} © Esri</p>
          <div className="footer-stats">
            <span>{t.markers}: {allMarkers.length}</span>
            <span>{t.zoom}: {mapZoom}</span>
            <span>{t.view}: {currentLayer.name}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;