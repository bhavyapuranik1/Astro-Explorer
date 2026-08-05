
const LOCAL_API_KEY =
  localStorage.getItem("OPENROUTER_API_KEY") || "";
const isLocal =
  location.hostname === "localhost" ||
  location.hostname === "127.0.0.1" ||
  location.protocol === "file:";

const apiKey = localStorage.getItem("OPENROUTER_API_KEY");

const useCloud = !apiKey;

console.log("Mode:", useCloud ? "☁️ Cloud" : "🔑 API Key");
var currentHDImage = "";
let showHazardOnly = false;
let showNewestOnly = false;
let searchQuery = "";
let searchObjects = [];
let CONSTELLATION_FEATURES = [];
let ASTERISM_FEATURES = [];
let messierObjects = [];
let lgObjects = [];
let animationId = null;
let starLabel = null;
let planetLabel = null;
let isRotating = false;
let skyTime = new Date(); // 🔥 main simulation time
let simPaused = false;    // ⏸ pause simulation
let simSpeed = 1;        // ⚡ seconds of sim time per real second
let lastSelectedPlanet = null;
let lastUpdateTime = 0;
let allObjects = [];
let starNames = {};
let planetLabels = [];
let dsoSearchLabel = null;
let searchedObjectName = "";
let selectedObject = null;
const SMART_LABEL_LIMIT = 10;
const SMART_MODE = true;
let isUserDragging = false;
let currentAIObject = null;
let researchMode = false;
let attachments = [];
let uploadedImageBase64 = "";
let uploadedFileContent = "";
let uploadedFileName = "";
let lastQuestion = "";
let conversations = [];
let currentConversationId = null;
let nasaMemoryCache = {};
let pendingMemory = null;
let editingMemory = null;
let pendingStructuredMemory = null;
let celestialSettings = null;
let compassScale;
let currentAzimuth = 0;
let compassHeading = 0;


const AstroSettings = {
  defaults: {
    fontSize: "16",
    accentColor: "#00f5ff",
    bubbleStyle: "rounded",
    messageWidth: "85",
    animations: true,
    responseLength: "balanced",
    creativity: "Balanced",
    aiModel: "openai/gpt-4o-mini",
    saveChatHistory: true,
    cloudSync: true,
    skySettings: {
      showStars: true,
      showMilkyWay: true,
      showSun: true,
      showMoon: true,
      showPlanets: true,
      showHorizon: true,
      showHorizonLine: true,
      showAtmosphere: false,
      showTwilight: false,
      horizonGlow: false,
      showHorizonGlow: false,
      showAsterisms: true,
      showConstellationLines: true,
      showConstellationNames: false,
      showConstellationLabels: false,
      showConstellationArt: false,
      showConstellationArtwork: false,
      showComets: true,
      showAsteroids: true,
      showSatellites: false,
      showSpacecraft: false,
      showMeteors: false,
      showMeteorShowers: false,
      showCelestialObjects: true,
      showDSOs: true,
      showFOV: false,
      showTelescopeFOV: false,
      showEquatorialGrid: false,
      showEqGrid: false,
      showAltAzGrid: false,
      showAzGrid: false,
      showCardinalPoints: true,
      showCardinals: true,
      showStarLabels: true,
      showPlanetLabels: true,
      showDSOLabels: true,
      showMarker: true,
      showCoordinates: true,
      defaultZoom: 1,
      smoothAnimations: true,
      timeSpeed: 1,
      starMagnitude: 4,
      dsoMagnitude: 4,
      enableRefraction: true,
      skyBrightness: 0.5,
      moonlightBrightness: 0.5,
      lightPollution: 9,
      airTransparency: 0.8,
      enableTwinkling: true,
      twinklingSpeed: 0.5,
      twinklingIntensity: 0.5,
      starColorSaturation: 1.0,
      enableDeepSkyGlow: true,
      deepSkyGlowIntensity: 0.5,
      mwBrightness: 1.0,
      showAsterismNames: true,
      asterismColor: "#ffaa00",
      asterismWidth: 1.2,
      asterismOpacity: 0.7
    }
  },
  data: {},
  load() {
    this.data = JSON.parse(JSON.stringify(this.defaults));
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem("astro_settings_consolidated"));
    } catch (e) {
      console.warn("Corrupted settings found, resetting to defaults", e);
    }
    if (saved && typeof saved === "object") {
      this.merge(this.data, saved);
    } else {
      const legacyKeys = {
        fontSize: "fontSize",
        accentColor: "accentColor",
        bubbleStyle: "bubbleStyle",
        messageWidth: "messageWidth",
        animations: "animations",
        responseLength: "responseLength",
        creativity: "creativity",
        aiModel: "aiModel"
      };
      for (const [settingsKey, localStorageKey] of Object.entries(legacyKeys)) {
        const val = localStorage.getItem(localStorageKey);
        if (val !== null) {
          if (settingsKey === "animations") {
            this.data[settingsKey] = val === "true";
          } else {
            this.data[settingsKey] = val;
          }
        }
      }
      try {
        const savedSky = JSON.parse(localStorage.getItem("skySettings"));
        if (savedSky && typeof savedSky === "object") {
          this.merge(this.data.skySettings, savedSky);
        }
      } catch (e) { }
    }
    this.syncToGlobals();
  },
  merge(target, source) {
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (source[key] !== null && typeof source[key] === "object" && !Array.isArray(source[key])) {
          if (!target[key] || typeof target[key] !== "object") {
            target[key] = {};
          }
          this.merge(target[key], source[key]);
        } else {
          target[key] = source[key];
        }
      }
    }
  },
  save() {
    try {
      localStorage.setItem("astro_settings_consolidated", JSON.stringify(this.data));
    } catch (e) {
      console.error("Failed to save settings", e);
    }
  },
  get(path) {
    const parts = path.split(".");
    let current = this.data;
    for (const part of parts) {
      if (current === undefined || current === null) return undefined;
      current = current[part];
    }
    return current;
  },
  set(path, value) {
    const parts = path.split(".");
    let current = this.data;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (current[part] === undefined || current[part] === null || typeof current[part] !== "object") {
        current[part] = {};
      }
      current = current[part];
    }
    const lastPart = parts[parts.length - 1];
    if (current[lastPart] !== value) {
      current[lastPart] = value;
      try { localStorage.setItem(lastPart, value); } catch (e) { }
      this.syncToGlobals();
      this.save();
    }
  },
  syncToGlobals() {
    if (typeof skySettings === "object") {
      Object.assign(skySettings, this.data.skySettings);
    }
  }
};

const COMPASS_MARGIN = 28;

const compassDirs = {

  N: 0,
  E: 90,
  S: 180,
  W: 270

};



let nasaCache =

  JSON.parse(

    localStorage.getItem("NASA_CACHE")

    || "{}"

  );

// Load saved location or default to Bhopal, India
const _savedLoc = (() => { try { return JSON.parse(localStorage.getItem("astro_observer_location")); } catch (_) { return null; } })();
const _initLat = _savedLoc ? _savedLoc.lat : 23;
const _initLon = _savedLoc ? _savedLoc.lon : 77;
const _initElev = _savedLoc ? _savedLoc.elev : 0;
let observer = new Astronomy.Observer(_initLat, _initLon, _initElev);

// ================= 📍 OBSERVER LOCATION MANAGER =================

function _updateObserverDisplay(lat, lon, label) {
  const disp = document.getElementById("obs-location-display");
  const latStr = (lat >= 0 ? lat.toFixed(4) + "°N" : Math.abs(lat).toFixed(4) + "°S");
  const lonStr = (lon >= 0 ? lon.toFixed(4) + "°E" : Math.abs(lon).toFixed(4) + "°W");
  if (disp) disp.innerHTML = `📍 ${label ? label + "<br>" : ""}<span style="font-size:11px;opacity:0.7">${latStr}, ${lonStr}</span>`;
}

function detectGPSLocation() {
  const btn = document.getElementById("gps-detect-btn");
  if (!navigator.geolocation) {
    alert("Geolocation is not supported by your browser.");
    return;
  }
  if (btn) { btn.innerHTML = "🛰️ Detecting..."; btn.style.opacity = "0.6"; }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = parseFloat(pos.coords.latitude.toFixed(6));
      const lon = parseFloat(pos.coords.longitude.toFixed(6));
      const elev = pos.coords.altitude ? parseFloat(pos.coords.altitude.toFixed(1)) : 0;

      document.getElementById("obs-lat-input").value = lat;
      document.getElementById("obs-lon-input").value = lon;
      document.getElementById("obs-elev-input").value = elev;

      if (btn) { btn.innerHTML = "🛰️ Auto-Detect My Location (GPS)"; btn.style.opacity = "1"; }

      // Reverse geocode for city name
      fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`)
        .then(r => r.json())
        .then(data => {
          const city = data.address?.city || data.address?.town || data.address?.village || data.address?.county || "";
          const country = data.address?.country || "";
          const label = [city, country].filter(Boolean).join(", ");
          _updateObserverDisplay(lat, lon, label);
          applyObserverLocation(lat, lon, elev, label);
        })
        .catch(() => {
          _updateObserverDisplay(lat, lon, "");
          applyObserverLocation(lat, lon, elev, "");
        });
    },
    (err) => {
      if (btn) { btn.innerHTML = "🛰️ Auto-Detect My Location (GPS)"; btn.style.opacity = "1"; }
      alert("GPS detection failed: " + err.message);
    },
    { timeout: 10000 }
  );
}

function applyObserverLocation(lat, lon, elev, label) {
  // If called from button (no args), read inputs
  if (lat === undefined) {
    lat = parseFloat(document.getElementById("obs-lat-input").value);
    lon = parseFloat(document.getElementById("obs-lon-input").value);
    elev = parseFloat(document.getElementById("obs-elev-input").value) || 0;
    label = "";
  }
  if (isNaN(lat) || isNaN(lon)) { alert("Enter valid latitude and longitude."); return; }
  lat = Math.max(-90, Math.min(90, lat));
  lon = Math.max(-180, Math.min(180, lon));
  elev = Math.max(0, Math.min(8848, elev));

  observer = new Astronomy.Observer(lat, lon, elev);
  localStorage.setItem("astro_observer_location", JSON.stringify({ lat, lon, elev, label }));
  _updateObserverDisplay(lat, lon, label);

  // Refresh info panel if an object is selected
  if (typeof updateDynamicInfo === "function" && selectedObject) updateDynamicInfo();
}

function initObserverLocation() {
  const saved = (() => { try { return JSON.parse(localStorage.getItem("astro_observer_location")); } catch (_) { return null; } })();
  const lat = saved ? saved.lat : 23;
  const lon = saved ? saved.lon : 77;
  const elev = saved ? saved.elev : 0;
  const label = saved ? (saved.label || "") : "Bhopal, India";

  const latEl = document.getElementById("obs-lat-input");
  const lonEl = document.getElementById("obs-lon-input");
  const elevEl = document.getElementById("obs-elev-input");
  if (latEl) latEl.value = lat;
  if (lonEl) lonEl.value = lon;
  if (elevEl) elevEl.value = elev;
  _updateObserverDisplay(lat, lon, label);
}


const starNameMap = {
  "sirius": "hd 48915",
  "vega": "hd 172167",
  "betelgeuse": "hd 39801",
  "rigel": "hd 34085",
  "polaris": "hd 8890"
};

const constAlias = {
  "orion": "ori",
  "ursa major": "ursa",
  "uma": "ursa",
  "ursa minor": "umi",
  "cassiopeia": "cas",
  "scorpius": "sco",
  "cancer": "cnc",
  "leo": "leo"
};

const planetMap = {
  mercury: "mer",
  venus: "ven",
  earth: "ter",
  mars: "mar",
  jupiter: "jup",
  saturn: "sat",
  uranus: "ura",
  neptune: "nep",
  pluto: "plu",

  ceres: "cer",
  vesta: "ves",
  pallas: "pal",

  eris: "eri",
  makemake: "mak",
  haumea: "hau",

  sun: "sol",
  moon: "lun"
};

const reversePlanetMap = {
  mer: "mercury",
  ven: "venus",
  ter: "earth",
  mar: "mars",
  jup: "jupiter",
  sat: "saturn",
  ura: "uranus",
  nep: "neptune",
  plu: "pluto",
};

const PLANETS = [
  "sun",
  "moon",
  "mercury",
  "venus",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
  "pluto"
];

const planetSymbols = {

  sun: "☉",

  moon: "☾",

  mercury: "☿",

  venus: "♀",

  mars: "♂",

  jupiter: "♃",

  saturn: "♄",

  uranus: "♅",

  neptune: "♆",

  pluto: "♇"

};

const planetLabelColors = {
  sun: "#fff200",      // Bright Yellow
  mercury: "#d8d8d8", // Light Gray
  venus: "#fff200",   // Yellow
  moon: "#fff200",    // Yellow
  mars: "#ff9800",    // Orange
  jupiter: "#f5b642", // Golden Orange
  saturn: "#f4c542",  // Gold
  uranus: "#4dd9ff",  // Cyan
  neptune: "#5b5bff", // Blue
  pluto: "#d8d8d8"    // Light Gray
};

let planetMarkers = {};

function createPlanetMarkers() {

  const overlay = document.getElementById("planetOverlay");

  PLANETS.forEach(name => {

    const div = document.createElement("div");
    div.className = "planet-marker";
    div.style.color = planetLabelColors[name.toLowerCase()] || "#ffffff";
    div.style.display = "flex";
    div.style.flexDirection = "column";
    div.style.alignItems = "center";
    div.style.lineHeight = "1";

    // Symbol span only — planet text names are handled by planetLabels system
    const symSpan = document.createElement("span");
    symSpan.className = "planet-symbol";
    symSpan.textContent = planetSymbols[name] || "●";

    // 🌟 Glow by planet
    let glow = "0 0 2px currentColor,0 0 5px currentColor";
    const n = name.toLowerCase();
    if (n === "sun" || n === "moon") glow = "0 0 4px currentColor,0 0 8px currentColor,0 0 14px currentColor";
    else if (n === "venus") glow = "0 0 3px currentColor,0 0 7px currentColor,0 0 12px currentColor";
    div.style.textShadow = glow;

    // Apply initial symbol visibility from settings
    symSpan.style.display = skySettings.showPlanetSymbols ? "" : "none";

    div.appendChild(symSpan);
    overlay.appendChild(div);

    planetMarkers[name] = div;
  });

}

let lastProjX = null;
let lastProjY = null;
let lastSkyTime = null;

function updatePlanetMarkers(projChanged) {

  if (!skySettings.showPlanets) {
    Object.values(planetMarkers).forEach(div => { div.style.display = "none"; });
    // Also hide labels
    planetLabels.forEach(p => { p.el.style.display = "none"; });
    return;
  }

  // Sync symbol span visibility
  Object.values(planetMarkers).forEach(div => {
    div.style.display = "flex";
    const sym = div.querySelector(".planet-symbol");
    if (sym) sym.style.display = skySettings.showPlanetSymbols ? "" : "none";
  });

  // Sync text label visibility (controlled by showPlanetNames)
  planetLabels.forEach(p => {
    p.el.style.display = skySettings.showPlanetNames ? "" : "none";
  });

  PLANETS.forEach(name => {

    const pos = getPlanetPosition(name, skyTime);
    if (!pos) return;



    let pt = null;
    try {
      pt = Celestial.mapProjection([pos[0] * 15, pos[1]]);
    } catch (e) { }

    if (!pt) return;

    const div = planetMarkers[name];
    if (!div) return;

    div.style.left = pt[0] + "px";
    div.style.top = pt[1] + "px";
  });

}




const objectDescriptions = {

  sirius:
    "Sirius is the brightest star in the night sky and is located in the constellation Canis Major.",

  andromeda:
    "The Andromeda Galaxy is the nearest major galaxy to the Milky Way and is expected to collide with our galaxy in billions of years.",

  orion:
    "Orion is one of the most recognizable constellations in the night sky.",

  jupiter:
    "Jupiter is the largest planet in the Solar System and has dozens of moons.",

  saturn:
    "Saturn is famous for its bright ring system made of ice and rock particles."

};

const wikiNameMap = {

  m31: "Andromeda Galaxy",

  m42: "Orion Nebula",

  m45: "Pleiades",

  m13: "Hercules Globular Cluster",

  m57: "Ring Nebula",

  m8: "Lagoon Nebula",

  m20: "Trifid Nebula",

  m51: "Whirlpool Galaxy",

  m101: "Pinwheel Galaxy",

  m1: "Crab Nebula"
};

const objectMorphology = {

  m31: "SA(s)b",
  m33: "SA(s)cd",

  m51: "SA(s)bc",
  m81: "SA(s)ab",

  lmc: "SB(s)m",
  smc: "dIrr",

  m87: "E0",
  m32: "E2",

  m1: "SNR",
  m42: "HII"
};

let astroMemory = JSON.parse(

  localStorage.getItem("astroMemory")

) || {

  memories: [],
  theories: [],
  observations: [],
  telescopeSessions: [],

  files: []

};

async function refreshNASA(date) {

  try {

    const url =

      `https://api.nasa.gov/planetary/apod?api_key=7jYgA8NDOyNHfLpSbuEP2uncSWByYecDXKkYa6bJ&date=${date}`;

    const res =

      await fetchWithRetry(url);

    const data =

      await res.json();

    nasaMemoryCache[date] = data;

    nasaCache[date] = data;

    localStorage.setItem(

      "NASA_CACHE",

      JSON.stringify(nasaCache)

    );

  }
  catch (e) {

    console.log(e);

  }

}

function extractStructuredMemory(text) {

  const t = text.trim();

  const memory = {

    type: "Memory",

    category: "general",

    key: "",

    value: t

  };

  const rules = [

    // 📚 Theory
    {
      category: "Theory",
      key: "Theory",
      patterns: [
        /remember theory:\s*(.+)/i,
        /theory:\s*(.+)/i,
        /i have a theory (.+)/i,
        /my theory is (.+)/i,
        /(.+) is a theory/i,
        /i think (.+)/i,
        /i believe (.+)/i,

        /meri theory (.+)/i,
        /mera maanna hai (.+)/i
      ]
    },

    // 🔭 Observation
    {
      category: "Observation",
      key: "Observation",
      patterns: [

        /remember observation:\s*(.+)/i,
        /observation:\s*(.+)/i,

        /i observed (.+)/i,
        /i saw (.+)/i,
        /i viewed (.+)/i,
        /i detected (.+)/i,
        /i captured (.+)/i,

        /today i observed (.+)/i,
        /tonight i observed (.+)/i,

        /maine observe kiya (.+)/i,
        /maine dekha (.+)/i,
        /aaj maine dekha (.+)/i,
        /i photographed (.+)/i,



      ]
    },

    // 🔭 Telescope Session


    // 👤 Name
    {
      category: "profile",
      key: "name",
      patterns: [
        /my name is (.+)/i,
        /i am (.+)/i,
        /mera naam (.+)/i,
        /my nickname is (.+)/i,
        /people call me (.+)/i,
        /everyone calls me (.+)/i,
        /i'm called (.+)/i,
        /mujhe (.+) bulate hain/i
      ]
    },

    // 🌍 Language
    {
      category: "profile",
      key: "language",
      patterns: [
        /i speak (.+)/i,
        /my language is (.+)/i,
        /meri language (.+)/i,
        /main (.+) bolta/i,
        /main (.+) bolti/i,
        /i usually speak (.+)/i,
        /i mostly speak (.+)/i,
        /i prefer (.+) language/i,
        /meri preferred language (.+)/i

      ]
    },

    // ❤️ Favourite Planet
    {
      category: "preference",
      key: "favourite_planet",
      patterns: [
        /favorite planet is (.+)/i,
        /favourite planet is (.+)/i,
        /my favourite planet is (.+)/i,
        /my favorite planet is (.+)/i,
        /mera favourite planet (.+)/i,
        /mera favorite planet (.+)/i,
        /i love (.+)/i,
        /i really like (.+)/i,
        /(.+) is my favourite planet/i,
        /(.+) is my favorite planet/i,
        /saturn is my favourite/i,
        /saturn is my favorite/i
      ]
    },

    // 🌙 Favourite Satellite
    {
      category: "preference",
      key: "favourite_satellite",
      patterns: [
        /favorite satellite is (.+)/i,
        /favourite satellite is (.+)/i,
        /my favourite satellite is (.+)/i,
        /my favorite satellite is (.+)/i,
        /mera favourite satellite (.+)/i,
        /(\w+) is my favourite satellite/i,
        /i love (.+) satellite/i
      ]
    },

    // 🌌 Favourite Galaxy
    {
      category: "preference",
      key: "favourite_galaxy",
      patterns: [
        /favorite galaxy is (.+)/i,
        /favourite galaxy is (.+)/i,
        /my favourite galaxy is (.+)/i,
        /mera favourite galaxy (.+)/i,
        /(\w+) is my favourite galaxy/i,
        /i love (.+) galaxy/i
      ]
    },

    // ⭐ Favourite Star
    {
      category: "preference",
      key: "favourite_star",
      patterns: [
        /favorite star is (.+)/i,
        /favourite star is (.+)/i,
        /my favourite star is (.+)/i,
        /mera favourite star (.+)/i,
        /(\w+) is my favourite star/i,
        /i love (.+) star/i
      ]
    },

    // ☄️ Favourite Comet
    {
      category: "preference",
      key: "favourite_comet",
      patterns: [
        /favorite comet is (.+)/i,
        /favourite comet is (.+)/i,
        /my favourite comet is (.+)/i
      ]
    },

    // 🛰 Favourite Mission
    {
      category: "preference",
      key: "favourite_mission",
      patterns: [
        /favorite mission is (.+)/i,
        /favourite mission is (.+)/i,
        /my favourite mission is (.+)/i
      ]
    },

    // 🔭 Telescope
    {
      category: "equipment",
      key: "telescope",
      patterns: [

        /my telescope is (.+)/i,

        /i use (?:a |an |my )?(.+?) telescope\.?$/i,
        /i have (?:a |an |my )?(.+?) telescope\.?$/i,
        /i own (?:a |an |my )?(.+?) telescope\.?$/i,
        /i bought (?:a |an |my )?(.+?) telescope\.?$/i,

        /using (?:a |an |my )?(.+?) telescope/i,
        /i am using (?:a |an |my )?(.+?) telescope/i,
        /i currently use (?:a |an |my )?(.+?) telescope/i,
        /i have been using (?:a |an |my )?(.+?) telescope/i,

        /mere paas (.+?) telescope hai/i,
        /mere paas (.+?) telescope/i,
        /main (.+?) telescope use karta/i,
        /main (.+?) telescope use karti/i,
        /remember telescope:\s*(.+)/i,

      ]
    },

    // 📷 Camera
    {
      category: "equipment",
      key: "camera",
      patterns: [

        /my camera is (.+)/i,

        /i use (?:a |an |my )?(.+?) camera\.?$/i,
        /i have (?:a |an |my )?(.+?) camera\.?$/i,
        /i own (?:a |an |my )?(.+?) camera\.?$/i,
        /i bought (?:a |an |my )?(.+?) camera\.?$/i,

        /using (?:a |an |my )?(.+?) camera/i,
        /i am using (?:a |an |my )?(.+?) camera/i,
        /i currently use (?:a |an |my )?(.+?) camera/i,
        /i have been using (?:a |an |my )?(.+?) camera/i,

        /i shoot with (.+)/i,

        /mere paas (.+?) camera hai/i,
        /mere paas (.+?) camera/i,
        /main (.+?) camera use karta/i,
        /main (.+?) camera use karti/i

      ]


    },

    {
      category: "equipment",
      key: "binoculars",
      patterns: [

        /remember binoculars:\s*(.+)/i,

        /my binoculars are (.+)/i,
        /my binocular is (.+)/i,

        /i use (?:a |an |my )?(.+?) binoculars?\.?$/i,
        /i have (?:a |an |my )?(.+?) binoculars?\.?$/i,
        /i own (?:a |an |my )?(.+?) binoculars?\.?$/i,
        /i bought (?:a |an |my )?(.+?) binoculars?\.?$/i,

        /using (?:a |an |my )?(.+?) binoculars?/i,
        /i am using (?:a |an |my )?(.+?) binoculars?/i,
        /i currently use (?:a |an |my )?(.+?) binoculars?/i,
        /i have been using (?:a |an |my )?(.+?) binoculars?/i,

        /mere paas (.+?) binoculars? hai/i,
        /mere paas (.+?) binoculars?/i,
        /main (.+?) binoculars? use karta/i,
        /main (.+?) binoculars? use karti/i

      ]
    },

    {
      category: "equipment",
      key: "eyepiece",
      patterns: [

        /remember eyepiece:\s*(.+)/i,

        /my eyepiece is (.+)/i,

        /i use (?:a |an |my )?(.+?) eyepiece\.?$/i,
        /i have (?:a |an |my )?(.+?) eyepiece\.?$/i,
        /i own (?:a |an |my )?(.+?) eyepiece\.?$/i,
        /i bought (?:a |an |my )?(.+?) eyepiece\.?$/i,

        /using (?:a |an |my )?(.+?) eyepiece/i,
        /i am using (?:a |an |my )?(.+?) eyepiece/i,
        /i currently use (?:a |an |my )?(.+?) eyepiece/i,
        /i have been using (?:a |an |my )?(.+?) eyepiece/i,

        /mere paas (.+?) eyepiece hai/i,
        /mere paas (.+?) eyepiece/i,
        /main (.+?) eyepiece use karta/i,
        /main (.+?) eyepiece use karti/i

      ]
    },

    {
      category: "Telescope",
      key: "Telescope",
      patterns: [


        /remember telescope session:\s*(.+)/i,
        /telescope session:\s*(.+)/i
      ]
    },
  ];

  for (const rule of rules) {

    for (const pattern of rule.patterns) {

      const match = t.match(pattern);

      if (match) {

        memory.type = rule.category;

        memory.category = rule.category;
        memory.key = rule.key;
        memory.value = match[1].trim();

        return memory;

      }

    }

  }

  return memory;

}

function findDuplicateMemory(memory) {

  console.log("Checking:", memory);
  console.table(getAllMemoryItems());

  return getAllMemoryItems().find(m => {

    if (!m.key || !memory.key)
      return false;

    return (

      m.key.trim().toLowerCase() ===
      memory.key.trim().toLowerCase()

    );

  });

}

function findDuplicateInArray(array, text) {

  return (array || []).find(item =>

    item.text.trim().toLowerCase() ===
    text.trim().toLowerCase()

  );

}

function saveMemory(memory, importance = 1) {

  if (!astroMemory.memories)
    astroMemory.memories = [];

  const structured =
    typeof memory === "object"
      ? memory
      : extractStructuredMemory(memory);
  console.log("Input:", memory);
  console.log("Structured:", structured);

  const duplicate =
    findDuplicateMemory(structured);

  if (duplicate) {

    duplicate.value = structured.value;
    duplicate.text = structured.value;
    duplicate.updatedAt =
      new Date().toISOString();

    localStorage.setItem(
      "astroMemory",
      JSON.stringify(astroMemory)
    );

    saveCloudMemory();
    updateMemorySettings();
    renderMemoryList();

    return;
  }

  const item = {

    id: Date.now(),

    text: structured.value,

    category: structured.category,

    key: structured.key,

    value: structured.value,

    importance,

    time: new Date().toISOString(),

    pinned: false,

    favorite: false,

    updatedAt: new Date().toISOString()

  };

  if (structured.category === "Theory") {

    astroMemory.theories ??= [];
    astroMemory.theories.push(item);

  }

  else if (structured.category === "Observation") {

    astroMemory.observations ??= [];
    astroMemory.observations.push(item);

  }

  else if (structured.category === "Telescope") {

    astroMemory.telescopeSessions ??= [];
    astroMemory.telescopeSessions.push(item);

  }
  else {

    astroMemory.memories.push(item);

  }

  localStorage.setItem(
    "astroMemory",
    JSON.stringify(astroMemory)
  );

  saveCloudMemory();
  updateMemorySettings();
  renderMemoryList();
}


function saveTheory(text, skipDuplicate = false) {

  console.log("🔥 saveTheory()");

  if (!astroMemory.theories) {
    astroMemory.theories = [];
  }

  const duplicate = (astroMemory.theories || []).find(item =>
    item.text.trim().toLowerCase() ===
    text.trim().toLowerCase()
  );

  if (duplicate && !skipDuplicate) {

    showMemorySuggestion({

      type: "Theory",
      category: "Theory",
      key: "Theory",
      value: text

    });

    return;
  }
  astroMemory.theories.push({

    id: Date.now(),

    text,

    time: new Date().toISOString(),

    pinned: false,

    favorite: false,

    updatedAt: new Date().toISOString()

  });

  console.log("Theory Count:", astroMemory.theories.length);
  console.log(astroMemory.theories);

  localStorage.setItem(

    "astroMemory",

    JSON.stringify(astroMemory)
  );
  updateGeneralSettings();
  updateMemorySettings();
  renderMemoryList();
}


function saveObservation(text, skipDuplicate = false) {

  if (!astroMemory.observations) {
    astroMemory.observations = [];
  }

  const duplicate = findDuplicateInArray(
    astroMemory.observations,
    text
  );

  if (duplicate && !skipDuplicate) {

    showMemorySuggestion({

      type: "Observation",

      category: "Observation",

      key: "Observation",

      value: text

    });

    return;

  }

  astroMemory.observations.push({

    id: Date.now(),

    text,

    time: new Date().toISOString(),

    pinned: false,

    favorite: false,

    updatedAt: new Date().toISOString()

  });

  localStorage.setItem(

    "astroMemory",

    JSON.stringify(astroMemory)
  );
  updateGeneralSettings();
  updateMemorySettings();
  renderMemoryList();
}


function saveTelescopeSession(text, skipDuplicate = false) {

  if (!astroMemory.telescopeSessions) {
    astroMemory.telescopeSessions = [];
  }

  const duplicate = findDuplicateInArray(
    astroMemory.telescopeSessions,
    text
  );

  if (duplicate && !skipDuplicate) {

    showMemorySuggestion({

      type: "Telescope",

      category: "Telescope",

      key: "Telescope",

      value: text

    });

    return;

  }

  astroMemory.telescopeSessions.push({

    id: Date.now(),

    text,

    time: new Date().toISOString(),

    pinned: false,

    favorite: false,

    updatedAt: new Date().toISOString()

  });

  localStorage.setItem(

    "astroMemory",

    JSON.stringify(astroMemory)
  );
  updateGeneralSettings();
  updateMemorySettings();
  renderMemoryList();
}

function loadAllMemories() {
  const getUniqueList = (arr, fn) => {
    if (!Array.isArray(arr)) return "None";
    const set = new Set();
    const result = [];
    for (const item of arr) {
      const val = fn(item);
      if (val && !set.has(val.toLowerCase())) {
        set.add(val.toLowerCase());
        result.push("- " + val);
      }
    }
    return result.length > 0 ? result.join("\n") : "None";
  };

  return `
General Memories:
${getUniqueList(astroMemory.memories, m => m.text || m.value)}

Theories:
${getUniqueList(astroMemory.theories, t => t.text)}

Observations:
${getUniqueList(astroMemory.observations, o => o.text)}

Telescope Sessions:
${getUniqueList(astroMemory.telescopeSessions, s => s.text)}

Files:
${getUniqueList(astroMemory.files, f => f.name)}
`;
}
function deleteMemory() {

  astroMemory = {

    memories: [],

    theories: [],

    observations: [],

    telescopeSessions: []

  };

  localStorage.setItem(

    "astroMemory",

    JSON.stringify(astroMemory)
  );
}
const astroSystemPrompt = `
You are Astro AI,
an advanced astronomy educator and astronomy assistant.

Give detailed,
scientifically accurate,
multi-paragraph explanations.

Explain astronomy concepts deeply but in simple language.

Always behave like an astronomy teacher.

Maintain conversational context.

If the user asks follow-up questions,
understand the previous topic automatically.

Respond naturally in English,
Hindi,
or Hinglish.

Avoid overly short answers.

You have persistent memory.

If Saved User Memory exists,
you must remember it across conversations.

Never say you cannot remember previous chats.

Treat Saved User Memory as permanently remembered user information.
`;


let lastTopic = "";
let conversationObjects = [];
const astroKnowledgeGraph = {



  "black hole": [

    "event horizon",
    "singularity",
    "hawking radiation",
    "accretion disk"
  ],

  "neutron star": [

    "pulsar",
    "magnetar",
    "supernova"
  ],

  "galaxy": [

    "spiral galaxy",
    "elliptical galaxy",
    "dark matter"
  ],

  "supernova": [

    "neutron star",
    "black hole",
    "stellar evolution"
  ]


};
const telescopeProfiles = {

  "Celestron NexStar 8SE": {

    aperture: "203mm",

    type:
      "Schmidt-Cassegrain",

    strengths: [

      "planetary observation",

      "deep sky observation",

      "astrophotography"
    ]
  }
};

function raToDeg(ra) {
  const [h, m, s] = ra.split(":").map(Number);
  return (h + m / 60 + s / 3600) * 15;
}

function decToDeg(dec) {
  const sign = dec.startsWith("-") ? -1 : 1;
  const [d, m, s] = dec.replace("-", "").split(":").map(Number);
  return sign * (d + m / 60 + s / 3600);
}



function showTab(tabId, el) {

  console.log("TAB =", tabId);

  // 🔹 Hide all tabs
  document.querySelectorAll(".tab-content").forEach(tab => {
    tab.style.display = "none";
  });

  // 🔹 Show selected tab
  document.getElementById(tabId).style.display = "block";

  // 🔹 Active button styling
  document.querySelectorAll("#tabs button").forEach(btn => {
    btn.classList.remove("active");
  });

  if (el) el.classList.add("active");

  // 🤖 Astro AI only on Sky tab
  const aiPanel = document.getElementById("ai-panel");
  const openAIBtn = document.getElementById("open-ai");

  if (tabId === "sky") {

    if (aiPanel.style.display === "none") {
      openAIBtn.style.display = "block";
    } else {
      aiPanel.style.display = "flex";
      openAIBtn.style.display = "none";
    }

  } else {

    aiPanel.style.display = "none";
    openAIBtn.style.display = "none";

  }

  // 🔹 NASA + Asteroids
  if (tabId === "nasa" || tabId === "asteroids") {
    loadNASA();
  }

  // 🔭 OBSERVATION TAB
  if (tabId === "observation") {
    if (typeof renderObservations === "function") renderObservations();
  }

  // 🌌 SKY TAB
  if (tabId === "sky") {

    console.log("SHOWTAB SKY");

    initSkySettings();

    if (!TelescopeManager.initialized) {
      TelescopeManager.init();
      TelescopeManager.initialized = true;
    }
    if (!SearchManager.initialized) {
      SearchManager.init();
      SearchManager.initialized = true;
    }

    if (!window.skyLoaded) {

      initSky();
      window.skyLoaded = true;

      // First load ke baad resize
      setTimeout(() => {

        const sky = document.getElementById("skyContainer");

        sky.style.top = "50px";
        sky.style.height = "calc(100% - 50px)";

        Celestial.resize();

      }, 300);

    } else {

      // Tab dubara open hua
      Celestial.resize();

      console.log(
        "After reopen:",
        document.getElementById("skyContainer").getBoundingClientRect()
      );

    }

  }
}
function createAsteroidCard(asteroid, isNewest = false) {
  const isHazardous = asteroid.is_potentially_hazardous_asteroid;
  const approachData = asteroid.close_approach_data[0];
  if (!approachData) return null;

  const speed = Math.round(approachData.relative_velocity.kilometers_per_hour);
  const missDistance = Math.round(approachData.miss_distance.kilometers);
  const size = Math.round(asteroid.estimated_diameter.meters.estimated_diameter_max);

  // ✅ USE STORED SCORE
  const finalScore = asteroid.dangerScore;

  const approachDate = approachData.close_approach_date;

  const card = document.createElement("div");
  card.className = "asteroid-card";

  card.innerHTML = `
      <div class="asteroid-badge ${isHazardous ? 'hazard' : isNewest ? 'new' : ''}">
          ${isHazardous ? 'Hazardous' : isNewest ? 'New' : ''}
      </div>

      <h3>${asteroid.name}</h3>
      <p>🚀 Speed: ${speed} km/h</p>
      <p>📏 Size: ${size} m</p>
      <p>🌍 Distance: ${missDistance} km</p>
      <p>📅 Date: ${approachDate}</p>
      <p>🔥 Danger Score: ${finalScore}</p>
    `;

  // 🎨 COLOR SYSTEM
  if (finalScore > 120) {
    card.style.background = "linear-gradient(135deg, #2b0000, #ff1a1a)";
    card.style.boxShadow = "0 0 15px red";
    card.style.color = "white";
  }
  else if (finalScore > 70) {
    card.style.background = "linear-gradient(135deg, #1a0033, #8000ff)";
    card.style.boxShadow = "0 0 15px violet";
    card.style.color = "white";
  }
  else {
    card.style.background = "linear-gradient(135deg, #002b1a, #00cc66)";
    card.style.boxShadow = "0 0 15px green";
    card.style.color = "white";
  }

  return card;
}

// 🔥 helper
function fetchWithTimeout(url, timeout = 8000) {
  return Promise.race([
    fetch(url),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), timeout)
    )
  ]);
}



// PREFETCH HELPERS
function formatDate(date) {
  return date.toISOString().split("T")[0];
}

function getAdjacentDates(dateStr) {
  const date = new Date(dateStr);

  const prev = new Date(date);
  prev.setDate(date.getDate() - 1);

  const next = new Date(date);
  next.setDate(date.getDate() + 1);

  return {
    prev: formatDate(prev),
    next: formatDate(next)
  };
}

function isFuture(dateStr) {
  return new Date(dateStr) > skyTime;
}

function prefetchAPOD(date) {
  if (nasaCache[date]) return;

  const url = `https://api.nasa.gov/planetary/apod?api_key=7jYgA8NDOyNHfLpSbuEP2uncSWByYecDXKkYa6bJ&date=${date}`;

  fetch(url)
    .then(res => res.json())
    .then(data => {
      nasaCache[date] = data;

      if (data.media_type === "image") {
        const img = new Image();
        img.src = data.url;
      }
    })
    .catch(() => { });
}

async function fetchWithRetry(url, options = {}, retries = 3) {

  for (let i = 0; i < retries; i++) {

    try {

      const response = await fetch(url, options);

      if (response.ok) {
        return response;
      }

    } catch (err) {
      console.log("Retry:", i + 1);
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  throw new Error("NASA API unavailable");
}
function cleanNASAOldCache() {

  const keys = Object.keys(nasaCache);

  if (keys.length <= 30) return;

  keys.sort();

  while (keys.length > 30) {

    delete nasaCache[keys.shift()];

  }

  localStorage.setItem(
    "NASA_CACHE",
    JSON.stringify(nasaCache)
  );

}


/* ===================================================
   🚀 CENTRALIZED NASA API SERVICE & EXPLORER MODULE
   =================================================== */

const NASA_API_KEY = "7jYgA8NDOyNHfLpSbuEP2uncSWByYecDXKkYa6bJ";

const NASACache = {
  get(key) {
    try {
      const raw = localStorage.getItem(`NASA_CACHE_${key}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (Date.now() - parsed.timestamp > 86400000) { // 24h TTL
        localStorage.removeItem(`NASA_CACHE_${key}`);
        return null;
      }
      return parsed.data;
    } catch (e) {
      return null;
    }
  },
  set(key, data) {
    try {
      localStorage.setItem(`NASA_CACHE_${key}`, JSON.stringify({
        timestamp: Date.now(),
        data
      }));
    } catch (e) {
      console.warn("NASA cache save error:", e);
    }
  }
};

const NASAApiService = {
  async getAPOD(dateStr = "") {
    const cacheKey = `apod_${dateStr || 'today'}`;
    const cached = NASACache.get(cacheKey);
    if (cached) return cached;

    const url = `https://api.nasa.gov/planetary/apod?api_key=${NASA_API_KEY}${dateStr ? `&date=${dateStr}` : ''}`;
    const res = await (typeof fetchWithRetry === 'function' ? fetchWithRetry(url) : fetch(url));
    if (!res.ok) throw new Error(`APOD API error: ${res.status}`);
    const data = await res.json();
    NASACache.set(cacheKey, data);
    return data;
  },

  async getAPODRandom() {
    const url = `https://api.nasa.gov/planetary/apod?api_key=${NASA_API_KEY}&count=1`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("APOD random fetch error");
    const data = await res.json();
    return data[0];
  },

  async getEPIC(dateStr = "", mode = "natural") {
    let endpoint = `https://api.nasa.gov/EPIC/api/${mode}`;
    if (dateStr) {
      endpoint += `/date/${dateStr}`;
    }
    endpoint += `?api_key=${NASA_API_KEY}`;

    const cacheKey = `epic_${mode}_${dateStr || 'latest'}`;
    const cached = NASACache.get(cacheKey);
    if (cached) return cached;

    const res = await (typeof fetchWithRetry === 'function' ? fetchWithRetry(endpoint) : fetch(endpoint));
    if (!res.ok) throw new Error(`EPIC API error: ${res.status}`);
    const data = await res.json();
    NASACache.set(cacheKey, data);
    return data;
  },

  async getMarsPhotos(rover = "curiosity", solOrDate = 1000, camera = "all", dateType = "sol") {
    // Validate rover parameter
    const validRovers = ["curiosity", "perseverance", "opportunity", "spirit"];
    const cleanRover = (rover && validRovers.includes(String(rover).toLowerCase().trim()))
      ? String(rover).toLowerCase().trim()
      : "curiosity";

    // Validate sol / earth_date query parameter
    let dateQuery = "";
    if (dateType === "earth_date" || (typeof solOrDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(solOrDate.trim()))) {
      const cleanDate = (solOrDate && String(solOrDate).trim()) ? String(solOrDate).trim() : "2015-05-30";
      dateQuery = `earth_date=${encodeURIComponent(cleanDate)}`;
    } else {
      const parsedSol = parseInt(solOrDate, 10);
      const validSol = !isNaN(parsedSol) && parsedSol >= 0 ? parsedSol : 1000;
      dateQuery = `sol=${validSol}`;
    }

    // Validate camera query parameter
    let cameraQuery = "";
    if (camera && String(camera).toLowerCase().trim() !== "all") {
      cameraQuery = `&camera=${encodeURIComponent(String(camera).toUpperCase().trim())}`;
    }

    // Endpoint MUST be: https://api.nasa.gov/mars-photos/api/v1/rovers/{rover}/photos
    const url = `https://api.nasa.gov/mars-photos/api/v1/rovers/${cleanRover}/photos?${dateQuery}&api_key=${NASA_API_KEY}${cameraQuery}`;

    const cacheKey = `mars_${cleanRover}_${dateQuery}_cam_${camera}`;
    const cached = NASACache.get(cacheKey);
    if (cached) {
      console.log("[NASA Mars API Cached Response]", url, cached);
      return cached;
    }

    console.log("[NASA Mars API Request]", url);

    try {
      const res = await (typeof fetchWithRetry === 'function' ? fetchWithRetry(url) : fetch(url));
      let data = null;

      if (res.ok) {
        data = await res.json();
        console.log("[NASA Mars API Response]", { url, status: res.status, ok: true, data });
      } else {
        const bodyText = await res.text().catch(() => "");
        console.warn("[NASA Mars API Response]", { url, status: res.status, ok: false, statusText: res.statusText, bodyText });
      }

      // If official NASA endpoint returned valid photos array
      if (data && Array.isArray(data.photos) && data.photos.length > 0) {
        NASACache.set(cacheKey, data);
        return data;
      }

      // If official API returned 404 / 500 / empty photos array (e.g. backend issue or no photos for date),
      // query NASA Image Library fallback to gracefully return imagery
      console.log("[NASA Mars API Fallback Search]", { cleanRover, solOrDate, camera });
      const fallbackPhotos = await this.getMarsPhotosFallback(cleanRover, solOrDate, camera);
      const resultData = { photos: fallbackPhotos };

      NASACache.set(cacheKey, resultData);
      return resultData;
    } catch (e) {
      console.error("[NASA Mars API Exception]", url, e);
      try {
        const fallbackPhotos = await this.getMarsPhotosFallback(cleanRover, solOrDate, camera);
        return { photos: fallbackPhotos };
      } catch (fbErr) {
        return { photos: [] };
      }
    }
  },

  async getMarsPhotosFallback(rover, solOrDate, camera) {
    const validRovers = ["curiosity", "perseverance", "opportunity", "spirit"];
    const cleanRover = validRovers.includes(String(rover).toLowerCase()) ? String(rover).toLowerCase() : "curiosity";
    const camQuery = camera && String(camera).toLowerCase() !== "all" ? String(camera) : "";
    const q = encodeURIComponent(`${cleanRover} mars rover photo ${camQuery}`.trim());
    const url = `https://images-api.nasa.gov/search?q=${q}&media_type=image`;

    try {
      const res = await fetch(url);
      if (!res.ok) return [];
      const json = await res.json();
      const items = (json.collection && Array.isArray(json.collection.items)) ? json.collection.items : [];
      return items.slice(0, 24).map((item, idx) => {
        const d = (item.data && item.data[0]) || {};
        const img = (item.links && item.links[0] && item.links[0].href) || "";
        const cameraName = camQuery ? camQuery.toUpperCase() : "MAST";
        return {
          id: d.nasa_id || `fallback_${cleanRover}_${idx}`,
          sol: solOrDate || 1000,
          earth_date: (d.date_created || "").split("T")[0] || "2021-02-18",
          img_src: img,
          camera: {
            name: cameraName,
            full_name: `${cameraName} Camera`
          },
          rover: {
            name: cleanRover.charAt(0).toUpperCase() + cleanRover.slice(1)
          }
        };
      }).filter(p => p.img_src);
    } catch (err) {
      console.warn("[NASA Mars Fallback Error]", err);
      return [];
    }
  },

  async getNearEarthObjects(startDate = "", endDate = "") {
    const today = new Date().toISOString().split("T")[0];
    const sDate = startDate || today;
    const eDate = endDate || today;
    const url = `https://api.nasa.gov/neo/rest/v1/feed?start_date=${sDate}&end_date=${eDate}&api_key=${NASA_API_KEY}`;

    const cacheKey = `neo_${sDate}_${eDate}`;
    const cached = NASACache.get(cacheKey);
    if (cached) return cached;

    const res = await (typeof fetchWithRetry === 'function' ? fetchWithRetry(url) : fetch(url));
    if (!res.ok) throw new Error(`NeoWs API error: ${res.status}`);
    const data = await res.json();
    NASACache.set(cacheKey, data);
    return data;
  },

  async searchNASALibrary(query = "astronomy", mediaType = "image") {
    const url = `https://images-api.nasa.gov/search?q=${encodeURIComponent(query)}&media_type=${mediaType}`;
    const cacheKey = `library_${query}_${mediaType}`;
    const cached = NASACache.get(cacheKey);
    if (cached) return cached;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Library API error: ${res.status}`);
    const data = await res.json();
    NASACache.set(cacheKey, data);
    return data;
  }
};

/* FAVORITES SYSTEM */
function getNASAFavorites() {
  try {
    return JSON.parse(localStorage.getItem("nasaFavorites") || "[]");
  } catch (e) {
    return [];
  }
}

function updateNASAFavBadge() {
  const countEl = document.getElementById("nasa-fav-count");
  if (countEl) {
    countEl.innerText = getNASAFavorites().length;
  }
}

function isNASAFavorite(id) {
  if (!id) return false;
  const favs = getNASAFavorites();
  return favs.some(f => (f.id || f.url || f.name) === id);
}

function renderNASAFavBtn(item) {
  const id = item.id || item.url || item.name;
  const isFav = isNASAFavorite(id);
  const safeItemJSON = JSON.stringify(item).replace(/'/g, "&#39;").replace(/"/g, "&quot;");
  return `<button type="button" class="nasa-fav-icon-btn ${isFav ? 'is-favorited' : ''}" title="${isFav ? 'Remove Favorite' : 'Save Favorite'}" aria-label="Favorite" onclick='toggleNASAFavorite(${safeItemJSON}, this)'>${isFav ? '⭐' : '☆'}</button>`;
}

function toggleNASAFavorite(item, btnElement) {
  let favs = getNASAFavorites();
  const id = item.id || item.url || item.name;
  const idx = favs.findIndex(f => (f.id || f.url || f.name) === id);
  let isNowFav = false;

  if (idx >= 0) {
    favs.splice(idx, 1);
    isNowFav = false;
    if (typeof showToast === "function") showToast("Removed from NASA Favorites");
  } else {
    favs.push({
      ...item,
      id,
      savedAt: new Date().toISOString()
    });
    isNowFav = true;
    if (typeof showToast === "function") showToast("Added to NASA Favorites!");
  }

  localStorage.setItem("nasaFavorites", JSON.stringify(favs));
  updateNASAFavBadge();

  if (btnElement) {
    if (isNowFav) {
      btnElement.innerText = "⭐";
      btnElement.classList.add("is-favorited");
      btnElement.title = "Remove Favorite";
    } else {
      btnElement.innerText = "☆";
      btnElement.classList.remove("is-favorited");
      btnElement.title = "Save Favorite";
    }
  }
}

/* SHARED IMAGE LIGHTBOX VIEWER */
let currentModalItem = null;

function openNASAImageViewer(mediaItem) {
  currentModalItem = mediaItem;
  const modal = document.getElementById("nasa-image-viewer-modal");
  const img = document.getElementById("nasa-modal-img");
  const title = document.getElementById("nasa-modal-title");
  const subtitle = document.getElementById("nasa-modal-date");
  const desc = document.getElementById("nasa-modal-desc");

  if (!modal || !img) return;

  img.src = mediaItem.url || mediaItem.hdurl || mediaItem.src || "";
  if (title) title.innerText = mediaItem.title || mediaItem.name || "NASA Media View";
  if (subtitle) subtitle.innerText = mediaItem.date || mediaItem.sol ? `Sol ${mediaItem.sol}` : "";
  if (desc) desc.innerText = mediaItem.explanation || mediaItem.desc || mediaItem.caption || "";

  modal.style.display = "flex";
}

function closeNASAImageViewer() {
  const modal = document.getElementById("nasa-image-viewer-modal");
  if (modal) modal.style.display = "none";
}

/* MAIN NASA EXPLORER HUB CONTROLLER */
let currentNASAView = "home";

function switchNASAView(targetView) {
  currentNASAView = targetView;

  // Nav buttons
  document.querySelectorAll(".nasa-nav-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.nasaView === targetView);
  });

  // Subviews
  document.querySelectorAll(".nasa-subview").forEach(sub => {
    sub.classList.toggle("active", sub.id === `nasa-view-${targetView}`);
  });

  // Breadcrumb
  const breadcrumb = document.getElementById("nasa-breadcrumb");
  if (breadcrumb) {
    const viewNames = {
      home: "Home",
      apod: "Astronomy Picture of the Day",
      epic: "EPIC Earth Imaging",
      mars: "Mars Rover Photos",
      neo: "Near Earth Objects",
      library: "NASA Media Library",
      favorites: "Saved Favorites",
      earth: "Earth Observatory",
      spaceweather: "Space Weather Dashboard",
      exoplanets: "Exoplanet Explorer",
      missions: "NASA Missions",
      launches: "Space Launches"
    };
    breadcrumb.innerText = `NASA Explorer > ${viewNames[targetView] || targetView}`;
  }

  // Load target view content
  if (targetView === "home") loadNASAHomeHub();
  else if (targetView === "apod") loadNASA();
  else if (targetView === "epic") loadEPICView();
  else if (targetView === "mars") loadMarsView();
  else if (targetView === "neo") loadNEOView();
  else if (targetView === "library") loadLibraryView();
  else if (targetView === "favorites") loadFavoritesView();
  else if (targetView === "earth") loadEarthView();
  else if (targetView === "spaceweather") loadSpaceWeatherView();
  else if (targetView === "exoplanets") loadExoplanetsView();
  else if (targetView === "missions") loadMissionsView();
  else if (targetView === "launches") loadLaunchesView();
}

async function loadNASAHomeHub() {
  try {
    // 1. Fetch APOD for hero preview
    const apod = await NASAApiService.getAPOD();
    const homeApodImg = document.getElementById("home-card-apod-img");
    if (homeApodImg && apod && apod.url) {
      homeApodImg.src = apod.url;
    }

    // 2. Fetch NEO count
    const neoData = await NASAApiService.getNearEarthObjects();
    if (neoData && neoData.element_count) {
      const astStat = document.getElementById("nasa-stat-asteroids");
      if (astStat) astStat.innerText = neoData.element_count;
    }

    // 3. Set stat items
    const solStat = document.getElementById("nasa-stat-rover-sol");
    if (solStat) solStat.innerText = "Sol 1000+";

    const epicStat = document.getElementById("nasa-stat-epic-date");
    if (epicStat) epicStat.innerText = "DSCOVR L1";
  } catch (e) {
    console.warn("NASA Home Hub load error:", e);
  }
}

async function loadEPICView() {
  const display = document.getElementById("epic-display");
  const skeleton = document.getElementById("epic-skeleton");
  const mode = document.getElementById("epic-mode-select")?.value || "natural";
  const datePicker = document.getElementById("epic-date-picker");
  const dateStr = datePicker?.value || "";

  if (skeleton) {
    skeleton.style.display = "block";
    skeleton.innerText = "Loading Earth view...";
  }
  if (display) display.style.display = "none";

  try {
    const data = await NASAApiService.getEPIC(dateStr, mode);
    if (!data || !data.length) {
      if (skeleton) skeleton.innerText = "No EPIC Earth images available for this date. Try selecting another date.";
      return;
    }

    const item = data[0];

    // Parse UTC date string directly (YYYY-MM-DD) to prevent timezone conversion shifts
    let year, month, day;
    if (item.date && item.date.includes("-")) {
      const datePart = item.date.split(" ")[0];
      const parts = datePart.split("-");
      year = parts[0];
      month = parts[1];
      day = parts[2];
    } else {
      const dateObj = new Date(item.date || Date.now());
      year = dateObj.getUTCFullYear();
      month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
      day = String(dateObj.getUTCDate()).padStart(2, '0');
    }

    const imgUrl = `https://epic.gsfc.nasa.gov/archive/${mode}/${year}/${month}/${day}/png/${item.image}.png`;

    const epicImg = document.getElementById("epic-img");
    const epicCaption = document.getElementById("epic-caption");
    const epicDateStr = document.getElementById("epic-date-str");
    const epicCentroid = document.getElementById("epic-centroid");
    const epicPos = document.getElementById("epic-pos");

    if (epicImg) {
      epicImg.onerror = () => {
        if (skeleton) {
          skeleton.style.display = "block";
          skeleton.innerText = "Image preview could not be loaded for this date. Try another date.";
        }
        if (display) display.style.display = "none";
      };
      epicImg.src = imgUrl;
    }

    if (epicCaption) epicCaption.innerText = item.caption || "DSCOVR Full-Disc Earth Shot";
    if (epicDateStr) epicDateStr.innerText = `Observed: ${item.date}`;
    if (epicCentroid && item.centroid_coordinates) {
      epicCentroid.innerText = `Lat ${item.centroid_coordinates.lat.toFixed(2)}°, Lon ${item.centroid_coordinates.lon.toFixed(2)}°`;
    }
    if (epicPos && item.dscovr_j2000_position) {
      epicPos.innerText = `X: ${Math.round(item.dscovr_j2000_position.x)} km, Y: ${Math.round(item.dscovr_j2000_position.y)} km`;
    }

    if (skeleton) skeleton.style.display = "none";
    if (display) display.style.display = "flex";

    // Bind HD Lightbox button
    const hdBtn = document.getElementById("epic-hd-btn");
    if (hdBtn) {
      hdBtn.onclick = () => openNASAImageViewer({
        url: imgUrl,
        title: item.caption || "EPIC Earth View",
        date: item.date,
        explanation: `Captured by EPIC camera on DSCOVR at Lat ${item.centroid_coordinates ? item.centroid_coordinates.lat.toFixed(2) : '--'}°, Lon ${item.centroid_coordinates ? item.centroid_coordinates.lon.toFixed(2) : '--'}°`
      });
    }

    // Bind Download button
    const dlBtn = document.getElementById("epic-download-btn");
    if (dlBtn) {
      dlBtn.onclick = () => {
        const link = document.createElement("a");
        link.href = imgUrl;
        link.download = `epic-earth-${item.image}.png`;
        link.target = "_blank";
        link.click();
      };
    }

    // Bind Fav button
    const favBtn = document.getElementById("epic-fav-btn");
    if (favBtn) {
      favBtn.onclick = () => toggleNASAFavorite({
        url: imgUrl,
        title: "EPIC Earth Shot " + item.date,
        date: item.date
      });
    }
  } catch (e) {
    if (skeleton) skeleton.innerText = "Unable to fetch EPIC Earth data. Please retry.";
  }
}

async function loadMarsView() {
  const grid = document.getElementById("mars-photos-grid");
  const rover = document.getElementById("mars-rover-select")?.value || "curiosity";
  const dateType = document.getElementById("mars-date-type-select")?.value || "sol";
  const sol = document.getElementById("mars-sol-input")?.value || 1000;
  const earthDate = document.getElementById("mars-earth-date-input")?.value || "2015-05-30";
  const camera = document.getElementById("mars-camera-select")?.value || "all";

  if (!grid) return;

  const solOrDate = dateType === "earth_date" ? earthDate : sol;
  const dateLabel = dateType === "earth_date" ? `Earth Date ${earthDate}` : `Sol ${sol}`;

  grid.innerHTML = `<div class="nasa-loading-skeleton">Fetching Mars raw photos for ${rover.toUpperCase()} (${dateLabel})...</div>`;

  try {
    const data = await NASAApiService.getMarsPhotos(rover, solOrDate, camera, dateType);

    if (!data || !data.photos || !data.photos.length) {
      grid.innerHTML = `
          <p style="font-size: 0.95rem; color: #94a3b8; margin: 0;">No photos recorded for ${rover.toUpperCase()} on ${dateLabel}${camera !== 'all' ? ' (' + camera.toUpperCase() + ' camera)' : ''}. Try selecting another Sol, Earth Date, or Camera filter.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = data.photos.slice(0, 24).map(p => `
      <div class="nasa-media-card">
        <img src="${p.img_src}" alt="Mars Photo" class="nasa-media-img" onclick="openNASAImageViewer({url: '${p.img_src}', title: '${p.rover.name} Rover - ${p.camera.full_name}', date: 'Sol ${p.sol} (${p.earth_date})', explanation: 'Captured by ${p.camera.full_name} aboard ${p.rover.name}.'})" />
        <div class="nasa-media-info">
          <h4 class="nasa-media-title">${p.rover.name} - ${p.camera.name}</h4>
          <span class="nasa-media-meta">Sol ${p.sol} • ${p.earth_date}</span>
          <div class="nasa-media-actions">
            <button type="button" class="nasa-btn-secondary" onclick="openNASAImageViewer({url: '${p.img_src}', title: '${p.rover.name} Rover - ${p.camera.full_name}', date: 'Sol ${p.sol} (${p.earth_date})'})">View</button>
            ${renderNASAFavBtn({ url: p.img_src, title: `${p.rover.name} Sol ${p.sol} (${p.camera.name})`, id: p.id || p.img_src, sol: p.sol })}
          </div>
        </div>
      </div>
    `).join("");
  } catch (e) {
    console.error("[loadMarsView Exception]", e);
    grid.innerHTML = `
      <div class="nasa-no-data-card" style="grid-column: 1 / -1; text-align:center; padding: 40px 20px; background: rgba(255,255,255,0.03); border: 1px dashed rgba(255,255,255,0.15); border-radius: 12px; color: #a0aec0; margin: 15px 0;">
        <div style="font-size: 2.5rem; margin-bottom: 12px;">📷</div>
        <h3 style="color: #e2e8f0; margin-bottom: 8px; font-weight: 600; font-size: 1.2rem;">No photos available for this date</h3>
        <p style="font-size: 0.95rem; color: #94a3b8; margin: 0;">Try adjusting your query parameters (Sol, Earth Date, Rover, or Camera).</p>
      </div>
    `;
  }
}

async function loadNEOView() {
  const grid = document.getElementById("neo-asteroids-grid");
  const datePicker = document.getElementById("neo-date-picker");
  const dateStr = datePicker?.value || "";

  if (!grid) return;
  grid.innerHTML = `<div class="nasa-loading-skeleton">Fetching Near-Earth Asteroid orbits...</div>`;

  try {
    const data = await NASAApiService.getNearEarthObjects(dateStr);
    const objectsMap = data.near_earth_objects || {};
    const dateKeys = Object.keys(objectsMap);

    let asteroids = [];
    dateKeys.forEach(k => {
      asteroids = asteroids.concat(objectsMap[k]);
    });

    if (!asteroids.length) {
      grid.innerHTML = `<div class="nasa-loading-skeleton">No Near-Earth Objects tracked for this timeframe.</div>`;
      return;
    }

    grid.innerHTML = asteroids.slice(0, 18).map(a => {
      const approach = a.close_approach_data?.[0] || {};
      const speed = Math.round(parseFloat(approach.relative_velocity?.kilometers_per_hour || 0));
      const missKm = Math.round(parseFloat(approach.miss_distance?.kilometers || 0));
      const isHaz = a.is_potentially_hazardous_asteroid;
      const sizeM = Math.round((a.estimated_diameter?.meters?.estimated_diameter_min + a.estimated_diameter?.meters?.estimated_diameter_max) / 2 || 0);

      return `
        <div class="nasa-media-card">
          <div class="nasa-media-info">
            <h4 class="nasa-media-title">${a.name}</h4>
            <span class="nasa-media-meta">Approach Date: ${approach.close_approach_date || 'Today'}</span>
            <div style="font-size: 0.82rem; color: #cbd5e1; margin-top: 4px; display: flex; flex-direction: column; gap: 4px;">
              <div>Velocity: <strong>${speed.toLocaleString()} km/h</strong></div>
              <div>Diameter: <strong>${sizeM} meters</strong></div>
              <div>Miss Distance: <strong>${missKm.toLocaleString()} km</strong></div>
              <div>Hazard Rating: <strong>${isHaz ? 'Potentially Hazardous' : 'Safe Orbit'}</strong></div>
            </div>
            <div class="nasa-media-actions" style="margin-top: 10px;">
              ${renderNASAFavBtn({ name: a.name, id: a.id || a.name, speed: speed, missKm: missKm, isHaz: isHaz })}
            </div>
          </div>
        </div>
      `;
    }).join("");
  } catch (e) {
    grid.innerHTML = `<div class="nasa-loading-skeleton">Unable to fetch NeoWs asteroid data. Retry.</div>`;
  }
}

async function loadLibraryView() {
  const grid = document.getElementById("library-media-grid");
  const query = document.getElementById("library-search-input")?.value || "astronomy";
  const mediaType = document.getElementById("library-media-select")?.value || "image";

  if (!grid) return;
  grid.innerHTML = `<div class="nasa-loading-skeleton">Searching NASA Media Library for "${query}"...</div>`;

  try {
    const data = await NASAApiService.searchNASALibrary(query, mediaType);
    const items = data.collection?.items || [];

    if (!items.length) {
      grid.innerHTML = `<div class="nasa-loading-skeleton">No NASA media items found matching "${query}".</div>`;
      return;
    }

    grid.innerHTML = items.slice(0, 20).map(item => {
      const d = item.data[0] || {};
      const links = item.links || [];
      const thumb = links.find(l => l.rel === "preview")?.href || "";

      return `
        <div class="nasa-media-card">
          ${thumb ? `<img src="${thumb}" alt="${d.title}" class="nasa-media-img" onclick="openNASAImageViewer({url: '${thumb}', title: '${(d.title || '').replace(/'/g, "")}', date: '${d.date_created ? d.date_created.split('T')[0] : ''}', explanation: '${(d.description || '').replace(/'/g, "").slice(0, 300)}'})" />` : ''}
          <div class="nasa-media-info">
            <h4 class="nasa-media-title">${d.title || 'NASA Media'}</h4>
            <span class="nasa-media-meta">${d.date_created ? d.date_created.split('T')[0] : ''} • ${d.center || 'NASA'}</span>
            <div class="nasa-media-actions">
              ${thumb ? `<button type="button" class="nasa-btn-secondary" onclick="openNASAImageViewer({url: '${thumb}', title: '${(d.title || '').replace(/'/g, "")}', date: '${d.date_created ? d.date_created.split('T')[0] : ''}', explanation: '${(d.description || '').replace(/'/g, "").slice(0, 300)}'})">View</button>` : ''}
              ${renderNASAFavBtn({ title: (d.title || '').replace(/'/g, ""), url: thumb, id: d.nasa_id })}
            </div>
          </div>
        </div>
      `;
    }).join("");
  } catch (e) {
    grid.innerHTML = `<div class="nasa-loading-skeleton">Error searching NASA media library. Retry.</div>`;
  }
}

function loadFavoritesView() {
  const grid = document.getElementById("nasa-favorites-grid");
  if (!grid) return;

  const favs = getNASAFavorites();
  if (!favs.length) {
    grid.innerHTML = `<div class="nasa-loading-skeleton">No saved NASA favorites yet. Click the star button on any APOD, EPIC Earth shot, Mars photo, or Asteroid card to save items here!</div>`;
    return;
  }

  grid.innerHTML = favs.map(f => `
    <div class="nasa-media-card">
      ${f.url ? `<img src="${f.url}" alt="${f.title || f.name}" class="nasa-media-img" onclick="openNASAImageViewer({url: '${f.url}', title: '${f.title || f.name}', date: '${f.date || ''}'})" />` : ''}
      <div class="nasa-media-info">
        <h4 class="nasa-media-title">${f.title || f.name || 'Saved Favorite'}</h4>
        <span class="nasa-media-meta">Saved: ${f.savedAt ? f.savedAt.split('T')[0] : 'Recently'}</span>
        <div class="nasa-media-actions">
          ${f.url ? `<button type="button" class="nasa-btn-secondary" onclick="openNASAImageViewer({url: '${f.url}', title: '${f.title || f.name}', date: '${f.date || ''}'})">View</button>` : ''}
          <button type="button" class="nasa-btn-secondary" style="color:#ef4444;" onclick="toggleNASAFavorite({id: '${f.id}'}); loadFavoritesView();">Remove</button>
        </div>
      </div>
    </div>
  `).join("");
}

async function loadEarthView() {
  const grid = document.getElementById("earth-grid");
  if (!grid) return;
  const q = document.getElementById("earth-search-input")?.value?.toLowerCase() || "";
  const category = document.getElementById("earth-category-select")?.value || "all";

  grid.innerHTML = '<div class="nasa-loading-skeleton">Loading Earth Observatory Data...</div>';

  try {
    let events = [];
    try {
      const res = await fetch("https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=30");
      if (res.ok) {
        const json = await res.json();
        events = json.events || [];
      }
    } catch (e) { }

    const curatedEarth = [
      { id: "e1", title: "Kilauea Volcano Eruption & Lava Flow", category: "volcanoes", categoryName: "Volcanoes", date: "2024-06-10", desc: "Thermal anomaly and plume observed by NASA Terra and MODIS satellite sensors over Hawaii.", coordinates: "19.421°N, 155.287°W", url: "https://earthobservatory.nasa.gov" },
      { id: "e2", title: "Canadian Boreal Wildfire Plumes", category: "wildfires", categoryName: "Wildfires", date: "2024-05-28", desc: "Suomi NPP VIIRS captures dense smoke transport crossing into northern US airspace.", coordinates: "56.130°N, 106.346°W", url: "https://earthobservatory.nasa.gov" },
      { id: "e3", title: "Typhoon Mawar Track & Eyewall Structure", category: "storms", categoryName: "Severe Storms", date: "2024-05-24", desc: "Category 5 equivalent super typhoon captured by NASA-NOAA GOES West satellite imagery.", coordinates: "13.444°N, 144.793°E", url: "https://earthobservatory.nasa.gov" },
      { id: "e4", title: "Jakobshavn Glacier Retreat & Iceberg Calving", category: "glaciers", categoryName: "Glaciers & Ice", date: "2024-04-15", desc: "Landsat 9 operational land imager measures ice flow rates and fjord disintegration in Greenland.", coordinates: "69.166°N, 49.833°W", url: "https://earthobservatory.nasa.gov" },
      { id: "e5", title: "Sahara Dust Plume Transatlantic Transport", category: "atmosphere", categoryName: "Atmospheric Events", date: "2024-06-02", desc: "MODIS sensor tracks massive mineral dust aerosol transport across the Atlantic Basin.", coordinates: "18.000°N, 30.000°W", url: "https://earthobservatory.nasa.gov" },
      { id: "e6", title: "Atacama Desert Flash Flood & Mudslide", category: "landslides", categoryName: "Land Changes", date: "2024-03-12", desc: "Sentinel-2 and NASA Aqua imagery shows sudden runoff in hyper-arid Chilean desert.", coordinates: "23.863°S, 69.132°W", url: "https://earthobservatory.nasa.gov" }
    ];

    let allItems = [];
    if (events.length) {
      allItems = events.map(ev => {
        const catObj = (ev.categories && ev.categories[0]) || {};
        const catId = (catObj.id || "").toLowerCase();
        let catKey = "atmosphere";
        if (catId.includes("wildfire")) catKey = "wildfires";
        else if (catId.includes("volcano")) catKey = "volcanoes";
        else if (catId.includes("storm") || catId.includes("cyclone") || catId.includes("typhoon")) catKey = "storms";
        else if (catId.includes("ice") || catId.includes("glacier") || catId.includes("snow")) catKey = "glaciers";
        else if (catId.includes("landslide") || catId.includes("flood")) catKey = "landslides";

        const geom = (ev.geometry && ev.geometry[0]) || {};
        const coords = geom.coordinates ? `${geom.coordinates[1]?.toFixed(3)}°N, ${geom.coordinates[0]?.toFixed(3)}°E` : "Global Satellite Sensor";
        return {
          id: ev.id,
          title: ev.title,
          category: catKey,
          categoryName: catObj.title || "Natural Event",
          date: (geom.date || ev.closed || "").split("T")[0] || new Date().toISOString().split("T")[0],
          desc: ev.description || `Active event monitored by NASA EONET satellite sensors. Source: ${ev.sources?.[0]?.id || "NASA GSFC"}`,
          coordinates: coords,
          url: ev.link || "https://eonet.gsfc.nasa.gov"
        };
      });
    }

    const combined = [...allItems, ...curatedEarth];

    const filtered = combined.filter(item => {
      const matchCat = category === "all" || item.category === category;
      const matchQ = !q || item.title.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q);
      return matchCat && matchQ;
    });

    if (!filtered.length) {
      grid.innerHTML = '<div class="nasa-loading-skeleton">No Earth Observatory events match your filters. Try clearing your search.</div>';
      return;
    }

    grid.innerHTML = filtered.map(item => `
      <div class="nasa-media-card">
        <img src="${item.img || 'https://images-assets.nasa.gov/image/GSFC_20171208_archive_e001465/GSFC_20171208_archive_e001465~thumb.jpg'}" alt="${item.title}" class="nasa-media-img" loading="lazy" onclick="openNASAImageViewer({url: '${item.img || 'https://images-assets.nasa.gov/image/GSFC_20171208_archive_e001465/GSFC_20171208_archive_e001465~thumb.jpg'}', title: '${item.title}', date: '${item.date}', explanation: '${item.desc}'})" />
        <div class="nasa-media-info">
          <div class="nasa-card-badges">
            <span class="nasa-badge badge-cyan">${item.categoryName || item.category}</span>
            <span class="nasa-badge badge-gray">${item.date}</span>
          </div>
          <h4 class="nasa-media-title">${item.title}</h4>
          <p class="nasa-media-desc" style="font-size: 0.78rem; color: #94a3b8; margin: 4px 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${item.desc}</p>
          <span class="nasa-media-meta">Coords: ${item.coordinates}</span>
          <div class="nasa-media-actions">
            <a href="${item.url}" target="_blank" rel="noopener" class="nasa-btn-secondary">Details</a>
            ${renderNASAFavBtn({ id: item.id, title: item.title, url: item.img || 'https://images-assets.nasa.gov/image/GSFC_20171208_archive_e001465/GSFC_20171208_archive_e001465~thumb.jpg' })}
          </div>
        </div>
      </div>
    `).join("");
  } catch (e) {
    grid.innerHTML = '<div class="nasa-loading-skeleton">Unable to load Earth Observatory data. Please try again.</div>';
  }
}

async function loadSpaceWeatherView() {
  const grid = document.getElementById("sw-grid");
  if (!grid) return;
  const type = document.getElementById("sw-type-select")?.value || "all";
  const severity = document.getElementById("sw-severity-select")?.value || "all";

  grid.innerHTML = '<div class="nasa-loading-skeleton">Fetching Live Solar Telemetry & DONKI Alerts...</div>';

  try {
    let notifications = [];
    try {
      const res = await fetch(`https://api.nasa.gov/DONKI/notifications?type=all&api_key=${NASA_API_KEY}`);
      if (res.ok) {
        notifications = await res.json();
      }
    } catch (e) {
      console.warn("[NASA DONKI Fetch Quiet Catch]", e);
    }

    const curatedSW = [
      { id: "sw1", type: "FLR", typeName: "Solar Flare", severity: "high", severityName: "X-Class Flare (X2.8)", time: "2024-05-14 17:09 UTC", desc: "Major X-class solar flare erupted from Active Region AR3664 causing strong R3 high-frequency radio blackouts.", activeRegion: "AR3664", link: "https://ready.gst.nasa.gov", img: "https://images-assets.nasa.gov/image/GSFC_20171208_archive_e001465/GSFC_20171208_archive_e001465~thumb.jpg" },
      { id: "sw2", type: "CME", typeName: "Coronal Mass Ejection", severity: "high", severityName: "Halo CME (1800 km/s)", time: "2024-05-11 02:15 UTC", desc: "Full halo CME directed toward Earth resulting in severe G5 geomagnetic storm conditions and auroral display.", activeRegion: "AR3664", link: "https://ready.gst.nasa.gov", img: "https://images-assets.nasa.gov/image/PIA22822/PIA22822~thumb.jpg" },
      { id: "sw3", type: "GST", typeName: "Geomagnetic Storm", severity: "high", severityName: "G5 Extreme Storm", time: "2024-05-11 12:00 UTC", desc: "K-index reached 9. Extreme geomagnetic field disturbance registered across global magnetometer networks.", activeRegion: "Global Magnetosphere", link: "https://ready.gst.nasa.gov", img: "https://images-assets.nasa.gov/image/PIA21004/PIA21004~thumb.jpg" },
      { id: "sw4", type: "SEP", typeName: "Solar Proton Event", severity: "moderate", severityName: "S2 Moderate Radiation", time: "2024-05-12 08:30 UTC", desc: ">10 MeV solar energetic proton flux exceeded 100 pfu threshold affecting polar aviation routes.", activeRegion: "AR3664", link: "https://ready.gst.nasa.gov", img: "https://images-assets.nasa.gov/image/PIA18008/PIA18008~thumb.jpg" },
      { id: "sw5", type: "IPS", typeName: "Interplanetary Shock", severity: "low", severityName: "Minor Shock Arrival", time: "2024-04-20 04:12 UTC", desc: "DSCOVR and ACE spacecraft recorded sudden solar wind speed velocity jump from 380 km/s to 520 km/s.", activeRegion: "L1 Solar Wind", link: "https://ready.gst.nasa.gov", img: "https://images-assets.nasa.gov/image/PIA23764/PIA23764~thumb.jpg" },
      { id: "sw6", type: "NOTIF", typeName: "NASA Weather Alert", severity: "moderate", severityName: "Moderate Alert", time: "2024-06-01 10:00 UTC", desc: "NASA Space Weather Operations Center alert: Recurrent coronal hole high-speed stream expected to hit Earth magnetosphere.", activeRegion: "Coronal Hole 42", link: "https://ready.gst.nasa.gov", img: "https://images-assets.nasa.gov/image/PIA24057/PIA24057~thumb.jpg" }
    ];

    let liveItems = [];
    if (Array.isArray(notifications) && notifications.length) {
      liveItems = notifications.slice(0, 15).map(item => {
        const messageType = item.messageType || "NOTIF";
        const messageBody = item.messageBody || "";
        let sev = "low";
        let sevLabel = "Minor / Info";
        if (messageBody.includes("X-class") || messageBody.includes("G4") || messageBody.includes("G5") || messageBody.includes("Severe")) {
          sev = "high";
          sevLabel = "High Impact / Extreme";
        } else if (messageBody.includes("M-class") || messageBody.includes("G2") || messageBody.includes("G3") || messageBody.includes("Moderate")) {
          sev = "moderate";
          sevLabel = "Moderate";
        }

        return {
          id: item.messageID || String(Math.random()),
          type: messageType,
          typeName: messageType,
          severity: sev,
          severityName: sevLabel,
          time: (item.messageIssueTime || "").replace("T", " ").replace("Z", " UTC"),
          desc: messageBody.slice(0, 240) + (messageBody.length > 240 ? "..." : ""),
          activeRegion: item.messageURL ? "NASA DONKI Alert" : "Solar Activity",
          link: item.messageURL || "https://ready.gst.nasa.gov",
          img: "https://images-assets.nasa.gov/image/GSFC_20171208_archive_e001465/GSFC_20171208_archive_e001465~thumb.jpg"
        };
      });
    }

    const combined = [...liveItems, ...curatedSW];

    const filtered = combined.filter(item => {
      const matchType = type === "all" || item.type === type;
      const matchSev = severity === "all" || item.severity === severity;
      return matchType && matchSev;
    });

    if (!filtered.length) {
      grid.innerHTML = '<div class="nasa-loading-skeleton">No Space Weather events found for the selected filter.</div>';
      return;
    }

    grid.innerHTML = filtered.map(item => `
      <div class="nasa-media-card">
        <img src="${item.img}" alt="${item.typeName}" class="nasa-media-img" loading="lazy" />
        <div class="nasa-media-info">
          <div class="nasa-card-badges">
            <span class="nasa-badge badge-orange">${item.typeName}</span>
            <span class="nasa-badge ${item.severity === 'high' ? 'badge-red' : item.severity === 'moderate' ? 'badge-yellow' : 'badge-gray'}">${item.severityName}</span>
          </div>
          <h4 class="nasa-media-title">${item.activeRegion} - ${item.typeName}</h4>
          <p class="nasa-media-desc" style="font-size: 0.78rem; color: #94a3b8; margin: 4px 0; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">${item.desc}</p>
          <span class="nasa-media-meta">Issue Time: ${item.time}</span>
          <div class="nasa-media-actions">
            <a href="${item.link}" target="_blank" rel="noopener" class="nasa-btn-secondary">Telemetry</a>
            ${renderNASAFavBtn({ id: item.id, title: item.typeName, url: item.img })}
          </div>
        </div>
      </div>
    `).join("");
  } catch (e) {
    grid.innerHTML = '<div class="nasa-loading-skeleton">Unable to fetch Space Weather telemetry.</div>';
  }
}

async function loadExoplanetsView() {
  const grid = document.getElementById("exo-grid");
  if (!grid) return;
  const q = document.getElementById("exo-search-input")?.value?.toLowerCase() || "";
  const type = document.getElementById("exo-type-select")?.value || "all";
  const hab = document.getElementById("exo-hab-select")?.value || "all";
  const sort = document.getElementById("exo-sort-select")?.value || "newest";

  grid.innerHTML = '<div class="nasa-loading-skeleton">Querying NASA Exoplanet Archive...</div>';

  const curatedExo = [
    { id: "ex1", name: "Kepler-186f", hostStar: "Kepler-186", type: "terrestrial", typeName: "Terrestrial (Rocky)", discYear: 2014, distLy: 582, radiusEarth: 1.17, massEarth: 1.4, tempK: 235, habitable: true, desc: "First validated Earth-sized planet orbiting in the conservative habitable zone of an M-dwarf star.", img: "https://images-assets.nasa.gov/image/PIA18008/PIA18008~thumb.jpg" },
    { id: "ex2", name: "TRAPPIST-1e", hostStar: "TRAPPIST-1", type: "terrestrial", typeName: "Terrestrial (Rocky)", discYear: 2017, distLy: 40, radiusEarth: 0.92, massEarth: 0.69, tempK: 246, habitable: true, desc: "Rocky planet located firmly within the habitable zone of an ultra-cool red dwarf 40 light-years away.", img: "https://images-assets.nasa.gov/image/PIA21422/PIA21422~thumb.jpg" },
    { id: "ex3", name: "Proxima Centauri b", hostStar: "Proxima Centauri", type: "terrestrial", typeName: "Terrestrial (Rocky)", discYear: 2016, distLy: 4.24, radiusEarth: 1.07, massEarth: 1.17, tempK: 234, habitable: true, desc: "The closest known exoplanet to Earth, orbiting in the habitable zone of our nearest stellar neighbor.", img: "https://images-assets.nasa.gov/image/PIA21004/PIA21004~thumb.jpg" },
    { id: "ex4", name: "K2-18b", hostStar: "K2-18", type: "super_earth", typeName: "Super-Earth", discYear: 2015, distLy: 124, radiusEarth: 2.61, massEarth: 8.6, tempK: 265, habitable: true, desc: "Hycean candidate world where NASA Webb Telescope detected methane, CO2, and atmospheric water vapor.", img: "https://images-assets.nasa.gov/image/PIA23408/PIA23408~thumb.jpg" },
    { id: "ex5", name: "TOI-700 d", hostStar: "TOI-700", type: "terrestrial", typeName: "Terrestrial (Rocky)", discYear: 2020, distLy: 101.4, radiusEarth: 1.19, massEarth: 1.72, tempK: 269, habitable: true, desc: "Earth-sized planet in the habitable zone discovered by NASA TESS satellite mission.", img: "https://images-assets.nasa.gov/image/PIA23512/PIA23512~thumb.jpg" },
    { id: "ex6", name: "Kepler-22b", hostStar: "Kepler-22", type: "super_earth", typeName: "Super-Earth", discYear: 2011, distLy: 635, radiusEarth: 2.4, massEarth: 9.1, tempK: 295, habitable: true, desc: "First Kepler candidate world confirmed in the habitable zone of a Sun-like (G-type) star.", img: "https://images-assets.nasa.gov/image/PIA15257/PIA15257~thumb.jpg" },
    { id: "ex7", name: "HD 209458 b (Osiris)", hostStar: "HD 209458", type: "gas_giant", typeName: "Gas Giant", discYear: 1999, distLy: 159, radiusEarth: 15.3, massEarth: 220, tempK: 1400, habitable: false, desc: "Famous Hot Jupiter with evaporating atmosphere detected by Hubble Space Telescope atmospheric transits.", img: "https://images-assets.nasa.gov/image/PIA05060/PIA05060~thumb.jpg" },
    { id: "ex8", name: "WASP-12b", hostStar: "WASP-12", type: "gas_giant", typeName: "Gas Giant", discYear: 2008, distLy: 1400, radiusEarth: 21.3, massEarth: 440, tempK: 2500, habitable: false, desc: "Ultra-hot Jupiter being tidal distorted and consumed by its host star in a dying spiral orbit.", img: "https://images-assets.nasa.gov/image/PIA13083/PIA13083~thumb.jpg" }
  ];

  let filtered = curatedExo.filter(p => {
    const matchQ = !q || p.name.toLowerCase().includes(q) || p.hostStar.toLowerCase().includes(q);
    const matchType = type === "all" || p.type === type;
    const matchHab = hab === "all" || (hab === "habitable" && p.habitable);
    return matchQ && matchType && matchHab;
  });

  if (sort === "newest") filtered.sort((a, b) => b.discYear - a.discYear);
  else if (sort === "nearest") filtered.sort((a, b) => a.distLy - b.distLy);
  else if (sort === "largest") filtered.sort((a, b) => b.radiusEarth - a.radiusEarth);
  else if (sort === "earthlike") filtered.sort((a, b) => Math.abs(a.radiusEarth - 1) - Math.abs(b.radiusEarth - 1));

  if (!filtered.length) {
    grid.innerHTML = '<div class="nasa-loading-skeleton">No exoplanets found matching your criteria.</div>';
    return;
  }

  grid.innerHTML = filtered.map(p => `
    <div class="nasa-media-card">
      <img src="${p.img}" alt="${p.name}" class="nasa-media-img" loading="lazy" onclick="openNASAImageViewer({url: '${p.img}', title: '${p.name}', explanation: '${p.desc}'})" />
      <div class="nasa-media-info">
        <div class="nasa-card-badges">
          <span class="nasa-badge badge-purple">${p.typeName}</span>
          ${p.habitable ? '<span class="nasa-badge badge-green">Habitable Zone</span>' : '<span class="nasa-badge badge-gray">Non-Habitable</span>'}
        </div>
        <h4 class="nasa-media-title">${p.name}</h4>
        <p class="nasa-media-desc" style="font-size: 0.78rem; color: #94a3b8; margin: 4px 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${p.desc}</p>
        <span class="nasa-media-meta">Star: ${p.hostStar} • ${p.distLy} ly • ${p.discYear}</span>
        <div class="nasa-media-actions">
          <button type="button" class="nasa-btn-secondary" onclick="openNASAImageViewer({url: '${p.img}', title: '${p.name}', explanation: '${p.desc}'})">View</button>
          ${renderNASAFavBtn({ id: p.id, title: p.name, url: p.img })}
        </div>
      </div>
    </div>
  `).join("");
}

async function loadMissionsView() {
  const grid = document.getElementById("mission-grid");
  if (!grid) return;
  const q = document.getElementById("mission-search-input")?.value?.toLowerCase() || "";
  const status = document.getElementById("mission-status-select")?.value || "all";
  const category = document.getElementById("mission-category-select")?.value || "all";

  grid.innerHTML = '<div class="nasa-loading-skeleton">Loading NASA Flagship Missions...</div>';

  const missions = [
    { id: "m1", name: "James Webb Space Telescope (JWST)", status: "active", category: "astrophysics", catName: "Astrophysics", launch: "2021-12-25", target: "Sun-Earth L2 Lagrange Point", desc: "NASA flagship infrared observatory uncovering cosmic dawn, first stars, early galaxies, and exoplanet atmospheres.", img: "https://images-assets.nasa.gov/image/GSFC_20171208_archive_e001465/GSFC_20171208_archive_e001465~thumb.jpg", url: "https://webb.nasa.gov" },
    { id: "m2", name: "Artemis Program & SLS", status: "active", category: "human", catName: "Human Spaceflight", launch: "2022-11-16", target: "Lunar South Pole & Gateway Orbit", desc: "NASA mission to land the first woman and first person of color on the Moon and build sustained lunar exploration infrastructure.", img: "https://images-assets.nasa.gov/image/KSC-20221116-PH-KSC01_0001/KSC-20221116-PH-KSC01_0001~thumb.jpg", url: "https://www.nasa.gov/artemis" },
    { id: "m3", name: "Perseverance & Ingenuity (Mars 2020)", status: "active", category: "planetary", catName: "Planetary Science", launch: "2020-07-30", target: "Jezero Crater, Mars", desc: "Mars rover searching for signs of ancient microbial life and collecting sealed core samples for future return to Earth.", img: "https://images-assets.nasa.gov/image/PIA23764/PIA23764~thumb.jpg", url: "https://mars.nasa.gov/mars2020" },
    { id: "m4", name: "Hubble Space Telescope", status: "active", category: "astrophysics", catName: "Astrophysics", launch: "1990-04-24", target: "Low Earth Orbit (540 km)", desc: "Iconic space observatory providing over 30 years of deep space ultraviolet and optical astronomical discoveries.", img: "https://images-assets.nasa.gov/image/PIA02258/PIA02258~thumb.jpg", url: "https://hubblesite.org" },
    { id: "m5", name: "Europa Clipper", status: "active", category: "planetary", catName: "Planetary Science", launch: "2024-10-14", target: "Jupiter Ocean Moon Europa", desc: "NASA flagship probe investigating Europa's subsurface liquid water ocean to determine habitability potential.", img: "https://images-assets.nasa.gov/image/PIA23874/PIA23874~thumb.jpg", url: "https://europa.nasa.gov" },
    { id: "m6", name: "Voyager 1 & 2 Interstellar Mission", status: "active", category: "planetary", catName: "Planetary Science", launch: "1977-09-05", target: "Interstellar Medium (>160 AU)", desc: "Humanity's farthest spacecraft exploring interstellar space beyond the heliosphere boundary.", img: "https://images-assets.nasa.gov/image/PIA22921/PIA22921~thumb.jpg", url: "https://voyager.jpl.nasa.gov" },
    { id: "m7", name: "Parker Solar Probe", status: "active", category: "earth", catName: "Earth & Sun Science", launch: "2018-08-12", target: "Solar Corona Outer Atmosphere", desc: "Spacecraft touching the Sun, measuring magnetic fields, solar wind acceleration, and coronal heating dynamics.", img: "https://images-assets.nasa.gov/image/PIA22822/PIA22822~thumb.jpg", url: "https://parkersolarprobe.jhuapl.edu" },
    { id: "m8", name: "Nancy Grace Roman Space Telescope", status: "upcoming", category: "astrophysics", catName: "Astrophysics", launch: "2027-05-01", target: "Sun-Earth L2 Point", desc: "Next-generation NASA observatory with 100x field of view of Hubble, studying dark energy and exoplanets.", img: "https://images-assets.nasa.gov/image/PIA24057/PIA24057~thumb.jpg", url: "https://roman.gsfc.nasa.gov" }
  ];

  const filtered = missions.filter(m => {
    const matchQ = !q || m.name.toLowerCase().includes(q) || m.desc.toLowerCase().includes(q) || m.target.toLowerCase().includes(q);
    const matchStatus = status === "all" || m.status === status;
    const matchCat = category === "all" || m.category === category;
    return matchQ && matchStatus && matchCat;
  });

  if (!filtered.length) {
    grid.innerHTML = '<div class="nasa-loading-skeleton">No NASA missions found matching your filter selection.</div>';
    return;
  }

  grid.innerHTML = filtered.map(m => `
    <div class="nasa-media-card">
      <img src="${m.img}" alt="${m.name}" class="nasa-media-img" loading="lazy" onclick="openNASAImageViewer({url: '${m.img}', title: '${m.name}', date: '${m.launch}', explanation: '${m.desc}'})" />
      <div class="nasa-media-info">
        <div class="nasa-card-badges">
          <span class="nasa-badge badge-blue">${m.catName}</span>
          <span class="nasa-badge ${m.status === 'active' ? 'badge-green' : m.status === 'upcoming' ? 'badge-yellow' : 'badge-gray'}">${m.status.toUpperCase()}</span>
        </div>
        <h4 class="nasa-media-title">${m.name}</h4>
        <p class="nasa-media-desc" style="font-size: 0.78rem; color: #94a3b8; margin: 4px 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${m.desc}</p>
        <span class="nasa-media-meta">Target: ${m.target} • Launch: ${m.launch}</span>
        <div class="nasa-media-actions">
          <a href="${m.url}" target="_blank" rel="noopener" class="nasa-btn-secondary">Mission</a>
          ${renderNASAFavBtn({ id: m.id, title: m.name, url: m.img })}
        </div>
      </div>
    </div>
  `).join("");
}

async function loadLaunchesView() {
  const grid = document.getElementById("launch-grid");
  if (!grid) return;
  const q = document.getElementById("launch-search-input")?.value?.toLowerCase() || "";
  const status = document.getElementById("launch-status-select")?.value || "all";
  const agency = document.getElementById("launch-agency-select")?.value || "all";

  grid.innerHTML = '<div class="nasa-loading-skeleton">Fetching Orbital Launch Manifest...</div>';

  try {
    let apiLaunches = [];
    try {
      const res = await fetch("https://lldev.thespacedevs.com/2.2.0/launch/upcoming/?limit=10");
      if (res.ok) {
        const json = await res.json();
        apiLaunches = json.results || [];
      }
    } catch (e) { }

    const curatedLaunches = [
      { id: "l1", title: "Artemis II Crewed Lunar Flyby", agency: "NASA", rocket: "Space Launch System (SLS) Block 1", pad: "LC-39B, Kennedy Space Center, FL, USA", date: "2025-09-15 14:00 UTC", status: "upcoming", desc: "First crewed flight test of the Orion spacecraft carrying 4 astronauts around the Moon.", img: "https://images-assets.nasa.gov/image/KSC-20221116-PH-KSC01_0001/KSC-20221116-PH-KSC01_0001~thumb.jpg" },
      { id: "l2", title: "Starship Integrated Flight Test 5", agency: "SpaceX", rocket: "Starship / Super Heavy B12/S30", pad: "Starbase, Boca Chica, Texas, USA", date: "2024-08-20 12:00 UTC", status: "upcoming", desc: "Full-scale orbital velocity test including catch attempt of Super Heavy booster at launch tower.", img: "https://images-assets.nasa.gov/image/PIA23764/PIA23764~thumb.jpg" },
      { id: "l3", title: "Europa Clipper Launch", agency: "NASA", rocket: "Falcon Heavy", pad: "LC-39A, Kennedy Space Center, FL, USA", date: "2024-10-10 16:30 UTC", status: "upcoming", desc: "NASA flagship probe launch to conduct detailed reconnaissance of Jupiter's ice moon Europa.", img: "https://images-assets.nasa.gov/image/PIA23874/PIA23874~thumb.jpg" },
      { id: "l4", title: "Falcon 9 - Starlink Group 8-5", agency: "SpaceX", rocket: "Falcon 9 Block 5", pad: "SLC-40, Cape Canaveral Space Force Station, FL", date: "2024-06-15 01:20 UTC", status: "past", desc: "Deployment of 22 Starlink V2 Mini satellites into low Earth orbit.", img: "https://images-assets.nasa.gov/image/PIA21004/PIA21004~thumb.jpg" },
      { id: "l5", title: "Ariane 6 Maiden Flight (VA262)", agency: "ESA", rocket: "Ariane 62", pad: "ELA-4, Guiana Space Centre, Kourou, French Guiana", date: "2024-07-09 19:00 UTC", status: "upcoming", desc: "Maiden orbital mission of Europe's next-generation heavy lift rocket Ariane 6.", img: "https://images-assets.nasa.gov/image/PIA18008/PIA18008~thumb.jpg" }
    ];

    let liveItems = [];
    if (apiLaunches.length) {
      liveItems = apiLaunches.map(l => ({
        id: l.id,
        title: l.name || "Orbital Launch",
        agency: l.launch_service_provider?.name || "Space Agency",
        rocket: l.rocket?.configuration?.full_name || "Orbital Rocket",
        pad: l.pad?.name || "Global Launch Site",
        date: (l.net || "").replace("T", " ").replace("Z", " UTC"),
        status: "upcoming",
        desc: l.mission?.description || "Orbital satellite launch mission.",
        img: l.image || "https://images-assets.nasa.gov/image/PIA23764/PIA23764~thumb.jpg"
      }));
    }

    const combined = [...liveItems, ...curatedLaunches];

    const filtered = combined.filter(l => {
      const matchQ = !q || l.title.toLowerCase().includes(q) || l.rocket.toLowerCase().includes(q) || l.agency.toLowerCase().includes(q);
      const matchStatus = status === "all" || l.status === status;
      const matchAgency = agency === "all" || l.agency.toLowerCase().includes(agency.toLowerCase());
      return matchQ && matchStatus && matchAgency;
    });

    if (!filtered.length) {
      grid.innerHTML = '<div class="nasa-loading-skeleton">No orbital launches match your filter options.</div>';
      return;
    }

    grid.innerHTML = filtered.map(l => `
      <div class="nasa-media-card">
        <img src="${l.img}" alt="${l.title}" class="nasa-media-img" loading="lazy" onclick="openNASAImageViewer({url: '${l.img}', title: '${l.title}', date: '${l.date}', explanation: '${l.desc}'})" />
        <div class="nasa-media-info">
          <div class="nasa-card-badges">
            <span class="nasa-badge badge-blue">${l.agency}</span>
            <span class="nasa-badge ${l.status === 'upcoming' ? 'badge-yellow' : 'badge-green'}">${l.status.toUpperCase()}</span>
          </div>
          <h4 class="nasa-media-title">${l.title}</h4>
          <p class="nasa-media-desc" style="font-size: 0.78rem; color: #94a3b8; margin: 4px 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${l.desc}</p>
          <span class="nasa-media-meta">Rocket: ${l.rocket} • Launch: ${l.date}</span>
          <div class="nasa-media-actions">
            <button type="button" class="nasa-btn-secondary" onclick="openNASAImageViewer({url: '${l.img}', title: '${l.title}', date: '${l.date}', explanation: '${l.desc}'})">View</button>
            ${renderNASAFavBtn({ id: l.id, title: l.title, url: l.img })}
          </div>
        </div>
      </div>
    `).join("");
  } catch (e) {
    grid.innerHTML = '<div class="nasa-loading-skeleton">Unable to load launch manifest data.</div>';
  }
}

/* INITIALIZE NASA EXPLORER BINDINGS */
function initNASAExplorer() {
  // Navigation tabs
  document.querySelectorAll(".nasa-nav-btn").forEach(btn => {
    btn.addEventListener("click", () => switchNASAView(btn.dataset.nasaView));
  });

  // Home service card targets
  document.querySelectorAll(".nasa-service-card").forEach(card => {
    card.addEventListener("click", () => switchNASAView(card.dataset.viewTarget));
  });

  // Refresh & Favorites header action buttons
  const refreshBtn = document.getElementById("nasa-refresh-btn");
  if (refreshBtn) refreshBtn.onclick = () => switchNASAView(currentNASAView);

  const favTabBtn = document.getElementById("nasa-fav-tab-btn");
  if (favTabBtn) favTabBtn.onclick = () => switchNASAView("favorites");

  // Global search input
  const globalSearchBtn = document.getElementById("nasa-global-search-btn");
  const globalSearchInput = document.getElementById("nasa-global-search");
  if (globalSearchBtn && globalSearchInput) {
    const runGlobalSearch = () => {
      const q = globalSearchInput.value.trim();
      if (!q) return;
      const libInput = document.getElementById("library-search-input");
      if (libInput) libInput.value = q;
      switchNASAView("library");
    };
    globalSearchBtn.onclick = runGlobalSearch;
    globalSearchInput.onkeydown = (e) => { if (e.key === "Enter") runGlobalSearch(); };
  }

  // Subview filter load buttons & inputs
  const epicLoadBtn = document.getElementById("epic-load-btn");
  if (epicLoadBtn) epicLoadBtn.onclick = loadEPICView;

  const epicModeSelect = document.getElementById("epic-mode-select");
  if (epicModeSelect) epicModeSelect.onchange = loadEPICView;

  const epicDatePicker = document.getElementById("epic-date-picker");
  if (epicDatePicker) epicDatePicker.onchange = loadEPICView;

  const marsLoadBtn = document.getElementById("mars-load-btn");
  if (marsLoadBtn) marsLoadBtn.onclick = loadMarsView;

  const neoLoadBtn = document.getElementById("neo-load-btn");
  if (neoLoadBtn) neoLoadBtn.onclick = loadNEOView;

  const libSearchBtn = document.getElementById("library-search-btn");
  if (libSearchBtn) libSearchBtn.onclick = loadLibraryView;

  // Earth Observatory controls
  const earthLoadBtn = document.getElementById("earth-load-btn");
  if (earthLoadBtn) earthLoadBtn.onclick = loadEarthView;
  const earthCategorySelect = document.getElementById("earth-category-select");
  if (earthCategorySelect) earthCategorySelect.onchange = loadEarthView;
  const earthSearchInput = document.getElementById("earth-search-input");
  if (earthSearchInput) earthSearchInput.oninput = loadEarthView;

  // Space Weather controls
  const swLoadBtn = document.getElementById("sw-load-btn");
  if (swLoadBtn) swLoadBtn.onclick = loadSpaceWeatherView;
  const swTypeSelect = document.getElementById("sw-type-select");
  if (swTypeSelect) swTypeSelect.onchange = loadSpaceWeatherView;
  const swSeveritySelect = document.getElementById("sw-severity-select");
  if (swSeveritySelect) swSeveritySelect.onchange = loadSpaceWeatherView;

  // Exoplanets controls
  const exoLoadBtn = document.getElementById("exo-load-btn");
  if (exoLoadBtn) exoLoadBtn.onclick = loadExoplanetsView;
  const exoTypeSelect = document.getElementById("exo-type-select");
  if (exoTypeSelect) exoTypeSelect.onchange = loadExoplanetsView;
  const exoHabSelect = document.getElementById("exo-hab-select");
  if (exoHabSelect) exoHabSelect.onchange = loadExoplanetsView;
  const exoSortSelect = document.getElementById("exo-sort-select");
  if (exoSortSelect) exoSortSelect.onchange = loadExoplanetsView;
  const exoSearchInput = document.getElementById("exo-search-input");
  if (exoSearchInput) exoSearchInput.oninput = loadExoplanetsView;

  // Missions controls
  const missionLoadBtn = document.getElementById("mission-load-btn");
  if (missionLoadBtn) missionLoadBtn.onclick = loadMissionsView;
  const missionStatusSelect = document.getElementById("mission-status-select");
  if (missionStatusSelect) missionStatusSelect.onchange = loadMissionsView;
  const missionCategorySelect = document.getElementById("mission-category-select");
  if (missionCategorySelect) missionCategorySelect.onchange = loadMissionsView;
  const missionSearchInput = document.getElementById("mission-search-input");
  if (missionSearchInput) missionSearchInput.oninput = loadMissionsView;

  // Launches controls
  const launchLoadBtn = document.getElementById("launch-load-btn");
  if (launchLoadBtn) launchLoadBtn.onclick = loadLaunchesView;
  const launchStatusSelect = document.getElementById("launch-status-select");
  if (launchStatusSelect) launchStatusSelect.onchange = loadLaunchesView;
  const launchAgencySelect = document.getElementById("launch-agency-select");
  if (launchAgencySelect) launchAgencySelect.onchange = loadLaunchesView;
  const launchSearchInput = document.getElementById("launch-search-input");
  if (launchSearchInput) launchSearchInput.oninput = loadLaunchesView;

  // Modal Lightbox bindings
  const modalCloseBtn = document.getElementById("nasa-modal-close-btn");
  if (modalCloseBtn) modalCloseBtn.onclick = closeNASAImageViewer;

  const modalOverlay = document.getElementById("nasa-image-viewer-modal");
  if (modalOverlay) {
    modalOverlay.onclick = (e) => {
      if (e.target === modalOverlay) closeNASAImageViewer();
    };
  }

  const modalFavBtn = document.getElementById("nasa-modal-fav-btn");
  if (modalFavBtn) {
    modalFavBtn.onclick = () => {
      if (currentModalItem) toggleNASAFavorite(currentModalItem);
    };
  }

  const modalShareBtn = document.getElementById("nasa-modal-share-btn");
  if (modalShareBtn) {
    modalShareBtn.onclick = () => {
      if (currentModalItem && currentModalItem.url && navigator.clipboard) {
        navigator.clipboard.writeText(currentModalItem.url);
        showToast("🔗 Image direct link copied to clipboard!");
      }
    };
  }

  const modalDlBtn = document.getElementById("nasa-modal-download-btn");
  if (modalDlBtn) {
    modalDlBtn.onclick = () => {
      if (currentModalItem && currentModalItem.url) {
        const link = document.createElement("a");
        link.href = currentModalItem.url;
        link.download = "nasa-hd-media.jpg";
        link.target = "_blank";
        link.click();
      }
    };
  }

  updateNASAFavBadge();
}

/* MAIN LOAD ENTRY POINT PRESERVING LEGACY API BINDINGS */
function loadNASA() {
  const img = document.getElementById("apod-img");
  const title = document.getElementById("apod-title");
  const desc = document.getElementById("apod-desc");
  const dateInput = document.getElementById("date-picker");
  const videoContainer = document.getElementById("video-container");

  const selectedDate = dateInput?.value;
  const today = new Date().toISOString().split("T")[0];

  if (selectedDate && selectedDate > today) {
    alert("Future date is not allowed 🚫");
    return;
  }

  if (selectedDate && nasaMemoryCache[selectedDate]) {
    renderNASA(nasaMemoryCache[selectedDate]);
    setTimeout(() => { refreshNASA(selectedDate); }, 100);
    return;
  }

  if (selectedDate && nasaCache[selectedDate]) {
    const cached = nasaCache[selectedDate];
    if (!cached || cached.code) {
      if (desc) desc.innerText = "Data not available for this date ❌";
      return;
    }
    renderNASA(cached);
  } else {
    if (desc) desc.innerText = "Checking NASA APOD availability... 🔍";
    NASAApiService.getAPOD(selectedDate || "")
      .then(data => {
        if (!data || data.code) {
          if (desc) desc.innerText = "Data not available ❌";
          return;
        }
        if (selectedDate) {
          nasaCache[selectedDate] = data;
          nasaMemoryCache[selectedDate] = data;
        }
        renderNASA(data);
      })
      .catch(() => {
        if (desc) desc.innerText = "Data not available ❌";
      });
  }

  function renderNASA(data) {
    if (data.media_type === "image") {
      currentHDImage = data.hdurl || data.url;
      if (videoContainer) videoContainer.innerHTML = "";
      if (img) {
        img.style.display = "block";
        const preImg = new Image();
        preImg.src = data.url;
        preImg.onload = () => {
          img.src = data.url;
          img.style.opacity = "1";
        };
      }
      if (title) title.innerText = data.title;
      if (desc) desc.innerText = data.explanation;
    } else if (data.media_type === "video") {
      if (img) img.style.display = "none";
      let videoURL = data.url;
      if (videoURL.includes("youtube.com") || videoURL.includes("youtu.be")) {
        if (videoURL.includes("watch?v=")) {
          videoURL = videoURL.replace("watch?v=", "embed/");
        }
        if (videoContainer) {
          videoContainer.innerHTML = `<iframe src="${videoURL}" frameborder="0" allowfullscreen style="width:100%; height:320px; border-radius:10px;"></iframe>`;
        }
      }
      if (title) title.innerText = data.title + " 🎥";
      if (desc) desc.innerText = data.explanation;
    }
  }
}

function buildSkyConfig() {
  const s = (typeof skySettings !== "undefined" && skySettings) ? skySettings : {};
  const container = document.getElementById("skyContainer");
  const width = container ? container.clientWidth : 800;
  const height = container ? container.clientHeight : 600;

  return {
    container: "skyContainer",
    width: width,
    height: height,
    projection: "equirectangular",
    follow: "center",
    datapath: "data/",
    zoomlevel: s.defaultZoom || 1,

    stars: {
      show: s.showStars !== undefined ? s.showStars : true,
      limit: s.starMagnitude || 6,
      names: s.showStarLabels !== undefined ? s.showStarLabels : true,
      proper: true
    },



    constellations: {
      show: s.showConstellations !== undefined ? s.showConstellations : (s.showConstellationLines !== undefined ? s.showConstellationLines : true),
      names: s.showConstellations !== undefined ? s.showConstellations : (s.showConstellationNames !== undefined ? s.showConstellationNames : true),
      lines: s.showConstellations !== undefined ? s.showConstellations : (s.showConstellationLines !== undefined ? s.showConstellationLines : true)
    },

    asterisms: {
      show: s.showAsterisms !== undefined ? s.showAsterisms : true,
      names: s.showAsterisms !== undefined ? s.showAsterisms : true,
      style: {
        stroke: s.asterismColor || "#ffaa00",
        width: s.asterismWidth || 1.2,
        opacity: s.asterismOpacity || 0.7
      },
      nameStyle: {
        fill: s.asterismColor || "#ffaa00",
        font: "11px 'Space Grotesk', sans-serif",
        align: "center",
        baseline: "middle",
        opacity: 0.8
      },
      data: "asterisms.json"
    },

    dsos: {
      show: s.showDSOs !== undefined ? s.showDSOs : true,
      names: s.showDSOLabels !== undefined ? s.showDSOLabels : true,
      limit: s.dsoMagnitude || 6,
      name: "id"
    },

    planets: {
      show: false
    },

    mw: {
      show: s.showMilkyWay !== undefined ? s.showMilkyWay : true,
      opacity: 0.5
    },

    // Grid / Reference Lines
    lines: {
      graticule: {
        show: s.showEquatorialGrid !== undefined ? s.showEquatorialGrid : false,
        stroke: "rgba(100,160,255,0.35)",
        width: 0.5,
        opacity: 0.7
      },
      equatorial: {
        show: s.showCelestialEquator !== undefined ? s.showCelestialEquator : false,
        stroke: "#4488ff",
        width: 1.2,
        opacity: 0.75
      },
      ecliptic: {
        show: s.showEcliptic !== undefined ? s.showEcliptic : false,
        stroke: "#44cc88",
        width: 1.2,
        opacity: 0.75
      },
      galactic: {
        show: s.showGalacticPlane !== undefined ? s.showGalacticPlane : false,
        stroke: "#cc6644",
        width: 1.2,
        opacity: 0.7
      },
      supergalactic: { show: false }
    },

    horizon: {
      show: s.showHorizonLine !== undefined ? s.showHorizonLine : false,
      stroke: "#88aaff",
      width: 1.2,
      fill: "#000000",
      opacity: 0.35
    }
  };
}


function refreshSky() {
  if (typeof updateAtmosphereState === "function") {
    updateAtmosphereState();
  }
  if (typeof Celestial !== "undefined") {
    if (typeof Celestial.apply === "function") {
      Celestial.apply(buildSkyConfig());
    }
    if (typeof Celestial.redraw === "function") {
      Celestial.redraw();
    }
  }
}


function initSky() {
  Celestial.display(buildSkyConfig());
  celestialSettings = Celestial.settings();

  Celestial.add({
    type: "raw",
    callback: function () { },
    redraw: function () {
      try { drawTrajectoryPaths(); } catch (e) { }
      try { drawTelescopeHelper(); } catch (e) { }
      try { drawAdvancedLayers(); } catch (e) { }
    }
  });

  const skyContainer = document.getElementById("skyContainer");
  if (skyContainer && !skyContainer.dataset.rightClickHandlerAttached) {
    skyContainer.addEventListener("mousedown", (e) => {
      skyDragStartX = e.clientX;
      skyDragStartY = e.clientY;
      isSkyDragging = false;
    });
    skyContainer.addEventListener("mousemove", (e) => {
      if (e.buttons > 0) {
        const dist = Math.hypot(e.clientX - skyDragStartX, e.clientY - skyDragStartY);
        if (dist > 5) {
          isSkyDragging = true;
        }
      }
    });
    skyContainer.addEventListener("click", handleSkyClick);
    skyContainer.addEventListener("contextmenu", handleSkyRightClick);
    skyContainer.dataset.rightClickHandlerAttached = "true";
  }
}




let marker;
let searchHighlight = null;
let currentTarget = null;

function createMarker() {
  if (typeof isCelestialSearchEnabled === "function" && !isCelestialSearchEnabled()) {
    if (marker) {
      marker.remove();
      marker = null;
    }
    return;
  }

  const container = document.getElementById("skyContainer");

  if (!marker) {

    marker = document.createElement("div");

    marker.className = "sky-crosshair";

    marker.innerHTML = `
    <div class="cross-top"></div>
    <div class="cross-right"></div>
    <div class="cross-bottom"></div>
    <div class="cross-left"></div>
`;

    container.appendChild(marker);

  }

  if (currentTarget) {

    const pt = Celestial.mapProjection(currentTarget);

    if (pt) {

      marker.style.left = pt[0] + "px";
      marker.style.top = pt[1] + "px";

    }

  }

}



let tracking = false;
let smoothX = null;
let smoothY = null;
let skyLoopId = null;
let skyContainerRect = null;

function updateSkyContainerRect() {
  const container = document.getElementById("skyContainer");
  if (container) {
    skyContainerRect = container.getBoundingClientRect();
  }
}

window.addEventListener("resize", updateSkyContainerRect);

function trackMarker() {
  if (!marker || !currentTarget) return;
  smoothX = null;
  smoothY = null;
  tracking = true;
  if (typeof _syncNavButtons === "function") _syncNavButtons();

  if (typeof smoothRotate === "function" && Array.isArray(currentTarget)) {
    smoothRotate([currentTarget[0], currentTarget[1]], 1000);
  }
}

function globalSkyAnimationLoop() {
  try {
    // Update sky container rect cache if not loaded yet
    if (!skyContainerRect) {
      updateSkyContainerRect();
    }

    // 1. Check if projection center or time changed
    let currentProj = null;
    try {
      currentProj = Celestial.mapProjection([0, 0]);
    } catch (e) { }

    const projChanged = !currentProj ||
      lastProjX !== currentProj[0] ||
      lastProjY !== currentProj[1] ||
      !lastSkyTime ||
      Math.abs(skyTime - lastSkyTime) >= 1000;

    if (projChanged) {
      if (currentProj) {
        lastProjX = currentProj[0];
        lastProjY = currentProj[1];
      }
      lastSkyTime = new Date(skyTime);
    }

    // Update dynamic atmosphere calculation state
    updateAtmosphereState();

    if (typeof isCelestialSearchEnabled === "function" && !isCelestialSearchEnabled()) {
      const infoPanel = document.getElementById("object-info-panel");
      if (infoPanel && infoPanel.style.display !== "none") {
        infoPanel.style.display = "none";
      }
      if (marker) {
        marker.remove();
        marker = null;
      }
      document.querySelectorAll(".star-search-label, .dso-search-label, .sky-crosshair").forEach(el => el.remove());
    }

    // Update dynamic object coordinates and info panel
    if (selectedObject) {
      updateDynamicInfo();
    }

    // 2. Update Planet Markers & Labels
    updatePlanetMarkers(projChanged);
    updatePlanetLabelPositions(projChanged);

    if (skySettings.enableTwinkling) {
      Celestial.redraw();
    }

    if (TelescopeManager.enabled) {
      TelescopeManager.updateRings();
    }

    // 3. Update Tracking Marker if target selected
    if (marker && currentTarget) {
      let pt = null;
      if (Array.isArray(currentTarget)) {
        try {
          pt = Celestial.mapProjection(currentTarget);
        } catch (err) {
          pt = null;
        }

        if (pt && !isNaN(pt[0]) && !isNaN(pt[1])) {
          if (smoothX === null) {
            smoothX = pt[0];
            smoothY = pt[1];
          }

          smoothX += (pt[0] - smoothX) * 0.2;
          smoothY += (pt[1] - smoothY) * 0.2;

          marker.style.left = smoothX + "px";
          marker.style.top = smoothY + "px";

          if (searchHighlight) {
            searchHighlight.style.left = smoothX + "px";
            searchHighlight.style.top = smoothY + "px";
          }

          if (searchedObjectName) {
            if (!dsoSearchLabel) {
              createDSOSearchLabel(searchedObjectName, smoothX, smoothY);
            } else {
              dsoSearchLabel.style.left = smoothX + "px";
              dsoSearchLabel.style.top = smoothY + "px";
            }
          }

          if (planetLabel && skyContainerRect) {
            planetLabel.style.left = (smoothX + skyContainerRect.left + 3) + "px";
            planetLabel.style.top = (smoothY + skyContainerRect.top - 3) + "px";
          }

          if (starLabel) {
            starLabel.style.left = smoothX + "px";
            starLabel.style.top = smoothY + "px";
          }
        }
      }
    } else {
      smoothX = null;
      smoothY = null;
    }
  } catch (error) {
    console.error("Error in globalSkyAnimationLoop:", error);
  }

  skyLoopId = requestAnimationFrame(globalSkyAnimationLoop);
}


// ================= 🪐 SHARED KEPLERIAN ORBITAL SOLVER & FRAME CACHE =================
let keplerianFrameCache = new Map();
let lastKeplerianFrameTime = null;

function getKeplerianPosition(bodyData, date, obs) {
  if (!bodyData || !bodyData.orbitalElements) return null;

  const targetDate = date || skyTime || new Date();
  const timeMs = targetDate.getTime();
  const bodyId = bodyData.id || bodyData.name || "small_body";
  const activeObs = obs || observer;
  const obsKey = activeObs ? `${activeObs.latitude.toFixed(2)}_${activeObs.longitude.toFixed(2)}` : "default_obs";
  const cacheKey = `${bodyId}_${timeMs}_${obsKey}`;

  if (lastKeplerianFrameTime !== timeMs) {
    keplerianFrameCache.clear();
    lastKeplerianFrameTime = timeMs;
  } else if (keplerianFrameCache.has(cacheKey)) {
    return keplerianFrameCache.get(cacheKey);
  }

  const elem = bodyData.orbitalElements;
  const k = 0.01720209895; // Gaussian gravitational constant (AU, days, solar mass)
  const q = elem.q;
  const e = elem.e;
  const iRad = (elem.i || 0) * Math.PI / 180;
  const omRad = (elem.om || 0) * Math.PI / 180;
  const wRad = (elem.w || 0) * Math.PI / 180;

  // Determine time delta dtDays from perihelion passage Tp or Epoch / M0
  let dtDays = 0;
  if (elem.perihelionDate) {
    const Tp = new Date(elem.perihelionDate);
    if (!isNaN(Tp.getTime())) {
      dtDays = (targetDate.getTime() - Tp.getTime()) / 86400000;
    }
  } else if (elem.epoch) {
    const epochDate = new Date(elem.epoch);
    const M0_rad = ((elem.M0 || elem.M || 0) * Math.PI / 180);
    const a = elem.a || (q / Math.abs(1.0 - e));
    const n = k / Math.pow(a, 1.5);
    const dtFromEpoch = (targetDate.getTime() - epochDate.getTime()) / 86400000;
    const M_total = M0_rad + n * dtFromEpoch;
    dtDays = M_total / n;
  }

  let xPrime = 0, yPrime = 0, rHelio = 0;

  if (e < 1.0) {
    // Elliptical Orbit (Asteroids, Comets, KBOs, Centaurs, Dwarf Planets, TNOs)
    const a = elem.a || (q / (1.0 - e));
    const n = k / Math.pow(a, 1.5);
    let M = (n * dtDays) % (2 * Math.PI);
    if (M < -Math.PI) M += 2 * Math.PI;
    if (M > Math.PI) M -= 2 * Math.PI;

    // Solve Kepler's equation for Eccentric Anomaly E: E - e*sin(E) = M
    let E = M + e * Math.sin(M);
    for (let iter = 0; iter < 25; iter++) {
      const f = E - e * Math.sin(E) - M;
      const fPrime = 1.0 - e * Math.cos(E);
      const deltaE = f / fPrime;
      E -= deltaE;
      if (Math.abs(deltaE) < 1e-11) break;
    }

    xPrime = a * (Math.cos(E) - e);
    yPrime = a * Math.sqrt(1.0 - e * e) * Math.sin(E);
    rHelio = Math.sqrt(xPrime * xPrime + yPrime * yPrime);
  } else {
    // Hyperbolic / Near-Parabolic Orbit (e >= 1.0)
    const a = Math.abs(elem.a || (q / (e - 1.0)));
    const n = k / Math.pow(a, 1.5);
    const M = n * dtDays;

    let H = Math.log(2.0 * Math.abs(M) / (e || 1.0001) + 1.8);
    if (M < 0) H = -H;
    for (let iter = 0; iter < 25; iter++) {
      const f = e * Math.sinh(H) - H - M;
      const fPrime = e * Math.cosh(H) - 1.0;
      const deltaH = f / fPrime;
      H -= deltaH;
      if (Math.abs(deltaH) < 1e-11) break;
    }

    xPrime = a * (e - Math.cosh(H));
    yPrime = a * Math.sqrt(e * e - 1.0) * Math.sinh(H);
    rHelio = Math.sqrt(xPrime * xPrime + yPrime * yPrime);
  }

  const nu = Math.atan2(yPrime, xPrime);
  const u = wRad + nu;

  const xHelio = rHelio * (Math.cos(omRad) * Math.cos(u) - Math.sin(omRad) * Math.sin(u) * Math.cos(iRad));
  const yHelio = rHelio * (Math.sin(omRad) * Math.cos(u) + Math.cos(omRad) * Math.sin(u) * Math.cos(iRad));
  const zHelio = rHelio * (Math.sin(u) * Math.sin(iRad));

  // Subtract Earth's heliocentric position vector using Astronomy Engine
  let xGeo = xHelio;
  let yGeo = yHelio;
  let zGeo = zHelio;

  if (typeof Astronomy !== "undefined") {
    const time = Astronomy.MakeTime(targetDate);
    const earthVec = Astronomy.HelioVector(Astronomy.Body.Earth, time);
    if (earthVec) {
      xGeo -= earthVec.x;
      yGeo -= earthVec.y;
      zGeo -= earthVec.z;
    }
  }

  // Convert Geocentric Ecliptic J2000 to Geocentric Equatorial J2000
  const eps = 23.4392911 * Math.PI / 180;
  const xEq = xGeo;
  const yEq = yGeo * Math.cos(eps) - zGeo * Math.sin(eps);
  const zEq = yGeo * Math.sin(eps) + zGeo * Math.cos(eps);

  const deltaAU = Math.sqrt(xEq * xEq + yEq * yEq + zEq * zEq);
  let raDeg = Math.atan2(yEq, xEq) * 180 / Math.PI;
  if (raDeg < 0) raDeg += 360;
  const decDeg = Math.asin(Math.max(-1, Math.min(1, zEq / (deltaAU || 1)))) * 180 / Math.PI;

  let alt = 0, az = 0;
  if (typeof Astronomy !== "undefined" && activeObs) {
    const time = Astronomy.MakeTime(targetDate);
    const hor = Astronomy.Horizon(time, activeObs, raDeg / 15, decDeg, Astronomy.Refraction.None);
    if (hor) {
      alt = hor.altitude;
      az = hor.azimuth;
    }
  }

  const H_mag = bodyData.absoluteMagnitude || 5.5;
  const K_param = bodyData.slopeParam || 4.0;
  const appMag = H_mag + 5 * Math.log10(deltaAU || 1) + 2.5 * K_param * Math.log10(rHelio || 1);

  const result = [raDeg / 15, decDeg, deltaAU, alt, az, Number(appMag.toFixed(1))];
  keplerianFrameCache.set(cacheKey, result);
  return result;
}

function getCometPosition(cometData, date, obs) {
  return getKeplerianPosition(cometData, date, obs);
}

function getAsteroidPosition(asteroidData, date, obs) {
  return getKeplerianPosition(asteroidData, date, obs);
}

async function loadObjects() {

  starNames = await fetch("data/starnames.json")
    .then(r => r.json());

  console.log("Star names loaded:", Object.keys(starNames).length);

  const m = await fetch("data/messier.json").then(r => r.json());
  const lg = await fetch("data/lg.json").then(r => r.json());
  const dsoExtra = await fetch("data/dsos.json").then(r => r.json());
  const brightDSO = await fetch("data/dsos.bright.json").then(r => r.json());
  const ngcData = await fetch("data/ngc-ic-messier-catalog.json").then(r => r.json());

  const cleanCatalog = ngcData.map(o => {

    if (!o.ra || !o.dec) return null;

    return {
      name: (o.m?.[0] || o.name || "").toLowerCase().replace(/\s+/g, ""),

      id: (o.m?.[0] || o.name || "").toLowerCase().replace(/\s+/g, ""),

      fullName: o.name || "",
      commonName: o.common_names || "",

      messier: o.m?.[0] || "",
      ngc: o.name || "",
      identifiers: o.identifiers || "",

      ra: raToDeg(o.ra),
      dec: decToDeg(o.dec),

      type: "dso",

      mag: o.v_mag || o.b_mag || "N/A",
      constellation: o.const || "N/A",
      size: o.majax || "N/A",
      morph: o.object_definition || "N/A"
    };

  }).filter(Boolean);

  const cleanMessier = m.features.map(o => {

    console.log(o.properties);

    return {

      name: o.id.toLowerCase(),

      id: o.id.toLowerCase(),

      ra: o.geometry.coordinates[0],

      dec: o.geometry.coordinates[1],

      type: "dso",

      mag:
        o.properties?.mag ||

        "N/A",

      constellation:
        o.properties?.con ||

        "N/A",

      size:
        o.properties?.dim ||

        "N/A",

      morph:

        o.properties?.morph ||

        objectMorphology[
        o.id.toLowerCase()
        ] ||

        "N/A"
    };
  });

  const cleanLG = lg.features.map(o => ({
    name: o.id.toLowerCase(),
    id: o.id.toLowerCase(),
    ra: o.geometry.coordinates[0],
    dec: o.geometry.coordinates[1],
    type: "dso"
  }));

  const cleanExtra = dsoExtra.features.map(o => ({

    name: (
      o.id ||
      o.properties?.name ||
      o.properties?.desig ||
      ""
    ).toLowerCase(),

    id: (
      o.id ||
      o.properties?.name ||
      o.properties?.desig ||
      ""
    ).toLowerCase(),

    ra: o.geometry.coordinates[0],
    dec: o.geometry.coordinates[1],

    type: "dso",

    morph:
      o.properties?.morph ||
      "N/A",

    mag:
      o.properties?.mag ||
      "N/A",

    size:
      o.properties?.dim ||
      "N/A"
  }))
    .filter(o => o.name); // 🔥 filter out objects without any name/id
  const cleanBright = brightDSO.features.flatMap(o => {

    const arr = [];

    // 🔥 MAIN ID
    if (o.id) {

      arr.push({

        name: o.id.toLowerCase(),

        id: o.id.toLowerCase(),

        ra: o.geometry.coordinates[0],

        dec: o.geometry.coordinates[1],

        type: "dso",

        morph:
          o.properties?.morph ||
          "N/A",

        mag:
          o.properties?.mag ||
          "N/A",

        size:
          o.properties?.dim ||
          "N/A"
      });
    }

    // 🔥 DESIGNATION
    if (o.properties?.desig) {

      arr.push({

        name:
          o.properties.desig.toLowerCase(),

        id:
          o.properties.desig.toLowerCase(),

        ra:
          o.geometry.coordinates[0],

        dec:
          o.geometry.coordinates[1],

        type: "dso",

        morph:
          o.properties?.morph ||
          "N/A",

        mag:
          o.properties?.mag ||
          "N/A",

        size:
          o.properties?.dim ||
          "N/A"
      });
    }

    return arr;
  });

  allObjects = [
    ...cleanCatalog,
    ...cleanMessier,
    ...cleanLG,
    ...cleanExtra,
    ...cleanBright,
  ];

  console.log("Messier loaded:", m.features.length);

  // 🔥 SEARCH BASE
  searchObjects = [...allObjects];

  // Build searchable text automatically
  searchObjects.forEach(obj => {
    obj.searchText = Object.values(obj)
      .filter(v => typeof v === "string")
      .join(" ")
      .toLowerCase();
  });

  console.log(
    "IC Objects:",
    searchObjects.filter(o => o.name.startsWith("ic"))
  );

  // ⭐ CONSTELLATIONS AUTO ADD

  const planetData = await fetch("data/planets.json").then(r => r.json());

  const cleanPlanets = Object.entries(planetData).map(([key, p]) => {

    const fullName = p.name.toLowerCase(); // venus
    const shortId = p.id.toLowerCase();   // ven

    return {
      name: fullName,   // 🔥 for search + calc
      id: shortId,      // 🔥 for Celestial
      type: "planet"
    };
  });
  searchObjects.push(...cleanPlanets);

  console.log("Planets added:", cleanPlanets.length);

  const constData = await fetch("data/constellations.json").then(r => r.json());
  console.log("CONST RAW:", constData);
  const constEntries = constData.features;
  CONSTELLATION_FEATURES = constEntries;

  searchObjects.push(...constEntries.map(c => ({
    name: c.id.toLowerCase(),                 // "umi"
    id: c.id.toLowerCase(),

    fullName: c.properties.name.toLowerCase(), // "ursa minor"

    ra: c.geometry.coordinates[0],
    dec: c.geometry.coordinates[1],

    type: "constellation"
  })));

  console.log("Constellations added:", constEntries.length);



  const starData = await fetch("data/stars.json").then(r => r.json());

  const cleanStars = starData.features
    .filter(s => s.properties.mag < 5)

    .map(s => {

      const hip = s.id;

      return {

        id: hip,

        name:
          starNames[hip]?.name?.toLowerCase()

          || ("star-" + hip),

        ra:
          s.geometry.coordinates[0],

        dec:
          s.geometry.coordinates[1],

        type: "star",

        mag:
          s.properties?.mag ||

          "N/A",

        constellation:
          s.properties?.con ||

          "N/A",

        bv:
          s.properties?.bv ||

          null
      };
    });

  searchObjects.push(...cleanStars);

  // 🛰️ Add Satellites to searchObjects
  // 🛰️ Load Satellites
  try {
    const loadedSats = await fetch("data/satellites.json").then(r => r.json());
    if (Array.isArray(loadedSats) && loadedSats.length > 0) {
      SATELLITES_DATA = mergeSatellites(loadedSats);
    }
  } catch (e) {
    console.warn("Could not load data/satellites.json, using fallback satellites:", e);
    SATELLITES_DATA = [...FALLBACK_SATELLITES];
  }

  console.log("Total satellites loaded:", SATELLITES_DATA.length);

  // 🛰️ Add prominent Satellites to searchObjects index
  const cleanSatellites = SATELLITES_DATA
    .filter(s => s && (s.name || s.OBJECT_NAME))
    .slice(0, 100) // Keep primary search index clean & lightweight
    .map(s => ({
      name: String(s.name || s.OBJECT_NAME).toLowerCase(),
      displayName: String(s.name || s.OBJECT_NAME),
      id: String(s.NORAD_CAT_ID || s.id || s.name || s.OBJECT_NAME),
      type: "satellite",
      ra: 0,
      dec: 0,
      satData: s
    }));

  searchObjects.push(...cleanSatellites);
  console.log("Satellites added to search:", cleanSatellites.length);

  // 🚀 Load Spacecraft Database (215 items)
  try {
    const rawSpacecraft = await fetch("data/spacecraft.json").then(r => r.json());
    if (Array.isArray(rawSpacecraft) && rawSpacecraft.length > 0) {
      SPACECRAFT_DATA = rawSpacecraft;
      const cleanSpacecraft = rawSpacecraft.map(sp => {
        const pos = getSpacecraftPosition(sp, skyTime || new Date());
        return {
          name: String(sp.name || "").toLowerCase(),
          shortName: String(sp.shortName || "").toLowerCase(),
          displayName: String(sp.name || sp.shortName || sp.id),
          id: String(sp.id).toLowerCase(),
          type: "spacecraft",
          category: sp.category || "Spacecraft",
          primaryAgency: sp.primaryAgency || "N/A",
          status: sp.status || "Active",
          destination: sp.destination || "N/A",
          searchAliases: Array.isArray(sp.searchAliases) ? sp.searchAliases.map(a => String(a).toLowerCase()) : [],
          tags: Array.isArray(sp.tags) ? sp.tags.map(t => String(t).toLowerCase()) : [],
          spData: sp,
          ra: pos ? pos[0] : 0,
          dec: pos ? pos[1] : 0
        };
      });
      searchObjects.push(...cleanSpacecraft);
      console.log("Spacecraft loaded:", cleanSpacecraft.length);
    }
  } catch (e) {
    console.warn("Could not load data/spacecraft.json:", e);
  }

  // ☄️ Load Comets
  try {
    const rawComets = await fetch("data/comets.json").then(r => r.json());
    if (Array.isArray(rawComets) && rawComets.length > 0) {
      COMETS_DATA = rawComets.map(c => {
        c.getCoords = function (time) {
          const pos = getCometPosition(c, time, observer);
          return pos ? [pos[0] * 15, pos[1]] : [0, 0];
        };
        return c;
      });
    }
  } catch (e) {
    console.warn("Could not load data/comets.json:", e);
  }

  const cleanComets = COMETS_DATA.map(c => ({
    name: String(c.name || c.displayName || "").toLowerCase(),
    displayName: String(c.displayName || c.name || ""),
    id: String(c.id || c.name || ""),
    type: "comet",
    ra: 0,
    dec: 0,
    cometData: c
  }));

  searchObjects.push(...cleanComets);
  console.log("Comets added:", cleanComets.length);

  // 🪨 Load Asteroids
  try {
    const rawAsteroids = await fetch("data/asteroids.json").then(r => r.json());
    if (Array.isArray(rawAsteroids) && rawAsteroids.length > 0) {
      ASTEROIDS_DATA = rawAsteroids.map(a => {
        a.getCoords = function (time) {
          const pos = getAsteroidPosition(a, time, observer);
          return pos ? [pos[0] * 15, pos[1]] : [0, 0];
        };
        return a;
      });
    }
  } catch (e) {
    console.warn("Could not load data/asteroids.json:", e);
  }

  const cleanAsteroids = ASTEROIDS_DATA.map(a => ({
    name: String(a.name || a.displayName || "").toLowerCase(),
    displayName: String(a.displayName || a.name || ""),
    designation: String(a.designation || a.name || "").toLowerCase(),
    number: String(a.number || a.asteroidNumber || "").toLowerCase(),
    id: String(a.id || a.name || ""),
    type: "asteroid",
    ra: 0,
    dec: 0,
    asteroidData: a
  }));

  searchObjects.push(...cleanAsteroids);
  console.log("Asteroids added:", cleanAsteroids.length);

  // 🌌 Add Asterisms to searchObjects index
  let ASTERISMS_DATA = [];
  try {
    const res = await fetch("data/asterisms.json");
    const geo = await res.json();
    if (geo && Array.isArray(geo.features)) {
      ASTERISMS_DATA = geo.features;
      ASTERISM_FEATURES = ASTERISMS_DATA;
    }
  } catch (e) {
    console.warn("Could not load data/asterisms.json:", e);
  }

  const cleanAsterisms = ASTERISMS_DATA.map(ast => {
    const props = ast.properties || {};
    let raDeg = 0;
    let decDeg = 0;

    if (props.loc && Array.isArray(props.loc) && (props.loc[0] !== 0 || props.loc[1] !== 0)) {
      raDeg = props.loc[0];
      decDeg = props.loc[1];
    } else if (ast.geometry && ast.geometry.coordinates) {
      // Centroid calculation from GeoJSON coordinates
      const coords = ast.geometry.coordinates.flat(2);
      let sumRa = 0, sumDec = 0, count = 0;
      for (let i = 0; i < coords.length; i += 2) {
        sumRa += coords[i];
        sumDec += coords[i + 1];
        count++;
      }
      if (count > 0) {
        raDeg = sumRa / count;
        decDeg = sumDec / count;
      }
    }

    const normalizedRaDeg = (raDeg < 0 ? raDeg + 360 : raDeg);

    return {
      name: String(name).toLowerCase(),
      displayName: String(name),
      id: String(ast.id || name),
      type: "asterism",
      ra: normalizedRaDeg,   // <-- degrees
      dec: decDeg,
      asterismData: ast
    };
  });

  searchObjects.push(...cleanAsterisms);
  console.log("Asterisms added:", cleanAsterisms.length);

  console.log(
    "Stars added:",
    cleanStars.length
  );
}
function detectLocation() {

  if (!navigator.geolocation) {

    alert(
      "Geolocation not supported"
    );

    return;
  }

  navigator.geolocation.getCurrentPosition(

    (pos) => {

      const lat =
        pos.coords.latitude;

      const lon =
        pos.coords.longitude;

      console.log(
        "Location:",
        lat,
        lon
      );

      // 🔥 UPDATE OBSERVER
      observer =
        new Astronomy.Observer(
          lat,
          lon,
          0
        );

    },

    (err) => {

      console.log(err);

      alert(
        "Location permission denied"
      );
    }
  );
}



function horizontalToEquatorial(alt, az, date, obs) {
  const latRad = obs.latitude * Math.PI / 180;
  const altRad = alt * Math.PI / 180;
  const azRad = az * Math.PI / 180;

  const sinDec = Math.sin(altRad) * Math.sin(latRad) + Math.cos(altRad) * Math.cos(latRad) * Math.cos(azRad);
  const decRad = Math.asin(Math.max(-1, Math.min(1, sinDec)));
  const dec = decRad * 180 / Math.PI;

  const cosDec = Math.cos(decRad);
  let H = 0;
  if (Math.abs(cosDec) > 1e-6) {
    const sinH = -Math.sin(azRad) * Math.cos(altRad) / cosDec;
    const cosH = (Math.sin(altRad) - Math.sin(latRad) * sinDec) / (Math.cos(latRad) * cosDec);
    H = Math.atan2(sinH, cosH);
  }

  const time = Astronomy.MakeTime(date);
  const lstHours = Astronomy.SiderealTime(time) + obs.longitude / 15;
  const lstRad = lstHours * 15 * Math.PI / 180;

  const raRad = lstRad - H;
  let ra = (raRad * 180 / Math.PI) % 360;
  if (ra < 0) ra += 360;

  return [ra, dec];
}
function refractRAdec(ra, dec, date, obs) {
  if (typeof skySettings !== "undefined" && skySettings.enableRefraction === false) {
    return [ra, dec];
  }
  try {
    const time = Astronomy.MakeTime(date);
    const hor = Astronomy.Horizon(time, obs, ra / 15, dec, Astronomy.Refraction.None);
    const alt = hor.altitude;
    if (alt < -2) return [ra, dec]; // don't refract things far below horizon

    // Saemundsson (1986) refraction formula
    const rArcmin = 1.02 / Math.tan((alt + 10.3 / (alt + 5.11)) * Math.PI / 180);
    const rDeg = rArcmin / 60;
    const refractedAlt = alt + rDeg;

    return horizontalToEquatorial(refractedAlt, hor.azimuth, date, obs);
  } catch (e) {
    console.error("Refraction error:", e);
    return [ra, dec];
  }
}

function updateAtmosphereState() {
  if (typeof Astronomy === "undefined" || !observer) return;
  try {
    const time = Astronomy.MakeTime(skyTime);

    // 1. Get Sun position & altitude
    const sunEqu = Astronomy.Equator(Astronomy.Body.Sun, time, observer, true, true);
    const sunHor = Astronomy.Horizon(time, observer, sunEqu.ra, sunEqu.dec, Astronomy.Refraction.None);
    window.sunAltitude = sunHor.altitude;
    window.sunPosition = [sunEqu.ra * 15, sunEqu.dec];

    // 2. Get Moon position, altitude & phase
    const moonEqu = Astronomy.Equator(Astronomy.Body.Moon, time, observer, true, true);
    const moonHor = Astronomy.Horizon(time, observer, moonEqu.ra, moonEqu.dec, Astronomy.Refraction.None);
    window.moonAltitude = moonHor.altitude;
    window.moonPosition = [moonEqu.ra * 15, moonEqu.dec];
    window.moonIllumination = Astronomy.Illumination(Astronomy.Body.Moon, time).phase;

    // 3. Get Zenith and Nadir positions
    const lstHours = Astronomy.SiderealTime(time) + observer.longitude / 15;
    const lstDeg = (lstHours * 15) % 360;
    window.zenithPosition = [lstDeg, observer.latitude];
    window.nadirPosition = [(lstDeg + 180) % 360, -observer.latitude];

    // 4. Set light pollution from settings
    window.lightPollution = skySettings.lightPollution !== undefined ? skySettings.lightPollution : 9;
  } catch (e) {
    console.error("Failed to update atmosphere state:", e);
  }
}

function getPlanetPosition(name, date) {
  const bodyMap = {
    sun: Astronomy.Body.Sun,
    moon: Astronomy.Body.Moon,
    mercury: Astronomy.Body.Mercury,
    venus: Astronomy.Body.Venus,
    earth: Astronomy.Body.Earth,
    mars: Astronomy.Body.Mars,
    jupiter: Astronomy.Body.Jupiter,
    saturn: Astronomy.Body.Saturn,
    uranus: Astronomy.Body.Uranus,
    neptune: Astronomy.Body.Neptune,
    pluto: Astronomy.Body.Pluto,
    ceres: Astronomy.Body.Ceres,
    vesta: Astronomy.Body.Vesta,
    pallas: Astronomy.Body.Pallas,
    eris: Astronomy.Body.Eris,
    makemake: Astronomy.Body.Makemake,
    haumea: Astronomy.Body.Humea
  };

  const body = bodyMap[name.toLowerCase()];
  if (!body) return null;

  const obs = observer || new Astronomy.Observer(23, 77, 0);
  const equ = Astronomy.Equator(body, date, obs, true, true);

  const raDeg = equ.ra * 15;
  const dec = equ.dec;

  const refracted = refractRAdec(raDeg, dec, date, obs);
  return [refracted[0] / 15, refracted[1], equ.dist];
}

// ================= 🤖 SKY AI INTEGRATION =================

function sendQueryToAstroAI(message) {
  // 1. Open the Astro AI panel if closed
  const aiPanel = document.getElementById("ai-panel");
  const openAIBtn = document.getElementById("open-ai");
  if (aiPanel) {
    aiPanel.style.display = "flex";
    if (openAIBtn) {
      openAIBtn.style.display = "none";
    }
  }

  // 2. Set the input value
  const aiInput = document.getElementById("ai-input");
  if (aiInput) {
    aiInput.value = message;

    // Dispatch input event to resize textarea automatically
    aiInput.dispatchEvent(new Event("input", { bubbles: true }));

    // 3. Trigger the send button click
    const aiSend = document.getElementById("ai-send");
    if (aiSend) {
      aiSend.click();
    }
  }
}

function skyAIExplain() {
  if (!currentAIObject) { alert("Select an object first."); return; }
  sendQueryToAstroAI(`Explain this celestial object: ${currentAIObject.name}`);
}

function skyAIConstellation() {
  if (!currentAIObject) { alert("Select an object first."); return; }
  const con = currentAIObject.constellation || "its constellation";
  sendQueryToAstroAI(`Tell me about the constellation "${con}" for the selected object "${currentAIObject.name}".`);
}

function skyAIRelated() {
  if (!currentAIObject) { alert("Select an object first."); return; }
  sendQueryToAstroAI(`Show related or nearby celestial objects to "${currentAIObject.name}".`);
}

function skyAIObserveTips() {
  if (!currentAIObject) { alert("Select an object first."); return; }
  sendQueryToAstroAI(`Give me intelligent observation suggestions for observing "${currentAIObject.name}".`);
}

// ================= ⏱️ TIME SIMULATION CONTROLS =================

function toggleStellariumTimePanel() {
  const panel = document.getElementById("stellarium-time-panel");
  if (panel) {
    const isHidden = panel.style.display === "none" || !panel.style.display;
    panel.style.display = isHidden ? "block" : "none";
  }
}

function _updateSimTimeUI() {
  const pad = (n) => String(n).padStart(2, '0');

  const spinY = document.getElementById("spin-year");
  const spinM = document.getElementById("spin-month");
  const spinD = document.getElementById("spin-day");
  const spinH = document.getElementById("spin-hour");
  const spinMin = document.getElementById("spin-minute");
  const spinS = document.getElementById("spin-second");

  if (spinY) spinY.innerText = skyTime.getFullYear();
  if (spinM) spinM.innerText = pad(skyTime.getMonth() + 1);
  if (spinD) spinD.innerText = pad(skyTime.getDate());
  if (spinH) spinH.innerText = pad(skyTime.getHours());
  if (spinMin) spinMin.innerText = pad(skyTime.getMinutes());
  if (spinS) spinS.innerText = pad(skyTime.getSeconds());

  const badgeT = document.getElementById("badge-time");
  const badgeD = document.getElementById("badge-date");
  if (badgeT) {
    badgeT.innerText = skyTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  }
  if (badgeD) {
    const yyyy = skyTime.getFullYear();
    const mm = pad(skyTime.getMonth() + 1);
    const dd = pad(skyTime.getDate());
    badgeD.innerText = `${yyyy}-${mm}-${dd}`;
  }

  // Update Settings Page readout and input
  const simDisplay = document.getElementById("sim-time-display");
  if (simDisplay) {
    simDisplay.innerText = skyTime.toLocaleString();
  }
  const skyDt = document.getElementById("sky-datetime");
  if (skyDt && document.activeElement !== skyDt) {
    const tzOffset = skyTime.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(skyTime.getTime() - tzOffset)).toISOString().slice(0, 16);
    skyDt.value = localISOTime;
  }

  // Update dynamic atmosphere calculations synchronously before starmap redraw
  updateAtmosphereState();

  // Update starmap visual projection
  try {
    if (typeof Celestial !== "undefined") {
      Celestial.skyview({ date: skyTime });
    }
  } catch (e) {
    console.error("Celestial.skyview error:", e);
  }
}

function adjustSimTime(unit, val) {
  const date = new Date(skyTime);
  if (unit === 'year') date.setFullYear(date.getFullYear() + val);
  else if (unit === 'month') date.setMonth(date.getMonth() + val);
  else if (unit === 'day') date.setDate(date.getDate() + val);
  else if (unit === 'hour') date.setHours(date.getHours() + val);
  else if (unit === 'minute') date.setMinutes(date.getMinutes() + val);
  else if (unit === 'second') date.setSeconds(date.getSeconds() + val);
  skyTime = date;

  _updateSimTimeUI();
  updateDynamicInfo();
}

function onSpeedSliderChange(val) {
  const value = parseInt(val);
  let multiplier = 1;
  let label = "Realtime";

  switch (value) {
    case 0: multiplier = 1; label = "Realtime"; break;
    case 1: multiplier = 10; label = "10x"; break;
    case 2: multiplier = 60; label = "60x (1m/s)"; break;
    case 3: multiplier = 600; label = "600x"; break;
    case 4: multiplier = 3600; label = "3600x (1h/s)"; break;
    case 5: multiplier = 86400; label = "86400x (1d/s)"; break;
    case 6: multiplier = 864000; label = "864000x (10d/s)"; break;
  }

  simSpeed = multiplier;
  const labelEl = document.getElementById("stellarium-speed-label");
  if (labelEl) labelEl.textContent = "Speed: " + label;
}

function adjustSimSpeedMultiplier(factor) {
  const slider = document.getElementById("stellarium-speed-slider");
  if (slider) {
    let currentVal = parseInt(slider.value);
    if (factor > 1 && currentVal < 6) currentVal++;
    else if (factor < 1 && currentVal > 0) currentVal--;
    slider.value = currentVal;
    onSpeedSliderChange(currentVal);
  }
}

function toggleSimPlay() {
  simPaused = !simPaused;
  const btn = document.getElementById("stellarium-play-btn");
  if (btn) {
    btn.innerHTML = simPaused ? "▶ Play" : "⏸ Pause";
    btn.style.color = simPaused ? "cyan" : "#00ff64";
    btn.style.borderColor = simPaused ? "rgba(0,255,255,0.35)" : "rgba(0,255,100,0.35)";
    btn.style.background = simPaused ? "rgba(0,255,255,0.1)" : "rgba(0,255,100,0.1)";
  }
  _updateSimTimeUI();
}

function simResetNow() {
  skyTime = new Date();
  simPaused = false;

  const btn = document.getElementById("stellarium-play-btn");
  if (btn) {
    btn.innerHTML = "⏸ Pause";
    btn.style.color = "#00ff64";
    btn.style.borderColor = "rgba(0,255,100,0.35)";
    btn.style.background = "rgba(0,255,100,0.1)";
  }

  // Reset speed presets to 1x
  const oneXBtn = document.querySelector(".speed-btn[data-speed='1']");
  setSimSpeed(1, oneXBtn);
  _updateSimTimeUI();
}

function simStep(seconds) {
  skyTime = new Date(skyTime.getTime() + seconds * 1000);
  _updateSimTimeUI();
  updateDynamicInfo();
}

function setSimSpeed(multiplier, btn) {
  simSpeed = multiplier;
  document.querySelectorAll(".speed-btn").forEach(b => {
    b.classList.remove("active");
    b.style.background = "rgba(255,255,255,0.05)";
    b.style.borderColor = "rgba(255,255,255,0.1)";
    b.style.color = "#bbb";
    b.style.fontWeight = "normal";
  });
  if (btn) {
    btn.classList.add("active");
    btn.style.background = "rgba(0,255,255,0.15)";
    btn.style.borderColor = "rgba(0,255,255,0.35)";
    btn.style.color = "cyan";
    btn.style.fontWeight = "bold";
  }
}

// ================= 🧭 NAVIGATION TOOLS =================

function _getNavTarget() {

  if (!selectedObject) return currentTarget;

  switch (selectedObject.type) {

    case "planet": {
      const pos = getPlanetPosition(selectedObject.name, skyTime);
      if (pos) return [pos[0] * 15, pos[1]];
      break;
    }

    case "star":
    case "dso":
    case "constellation":
      return [selectedObject.ra, selectedObject.dec];

    case "spacecraft": {
      if (typeof getSpacecraftPosition === "function") {
        const pos = getSpacecraftPosition(selectedObject, skyTime);
        if (pos) return [pos[0], pos[1]];
      }
      if (selectedObject.ra !== undefined && selectedObject.dec !== undefined) {
        return [selectedObject.ra, selectedObject.dec];
      }
      break;
    }

    case "comet":
      if (selectedObject.getCoords) {
        return selectedObject.getCoords(skyTime);
      }
      if (selectedObject.ra !== undefined && selectedObject.dec !== undefined) {
        return [selectedObject.ra, selectedObject.dec];
      }
      break;

    case "asteroid":
      if (selectedObject.getCoords) {
        return selectedObject.getCoords(skyTime);
      }
      if (selectedObject.ra !== undefined && selectedObject.dec !== undefined) {
        return [selectedObject.ra, selectedObject.dec];
      }
      break;
  }

  return currentTarget;
}
function _syncNavButtons() {
  const lockBtn = document.getElementById("nav-lock-btn");
  if (lockBtn) {
    const on = tracking;
    lockBtn.innerHTML = on ? "🔒 Locked" : "🔓 Lock";
    lockBtn.style.background = on ? "rgba(255,180,0,0.15)" : "rgba(255,255,255,0.05)";
    lockBtn.style.borderColor = on ? "rgba(255,180,0,0.4)" : "rgba(255,255,255,0.15)";
    lockBtn.style.color = on ? "#ffb400" : "#ccc";
  }
}

function navCenter() {
  const target = _getNavTarget();
  if (!target) { alert("Select an object first."); return; }
  currentTarget = [target[0], target[1]];

  if (typeof smoothRotate === "function") {
    smoothRotate([target[0], target[1]], 600);
  } else {
    Celestial.rotate({ center: [target[0], target[1], 0] });
  }

  if (!marker) createMarker();
  if (marker) marker.style.display = "block";
}

// 🔒 Lock — toggle marker tracking lock (marker crosshair on screen)
function navLock() {
  if (!selectedObject && !currentTarget) {
    alert("Select an object first.");
    return;
  }

  tracking = !tracking;

  if (tracking) {
    const target = _getNavTarget();
    if (target) {
      currentTarget = [target[0], target[1]];
    }

    createMarker();

    // 👇 Ye naya code add karo
    if (marker) {
      marker.style.display = "block";
    }

  } else {
    if (marker) {
      marker.style.display = "none";
    }
  }

  _syncNavButtons();
}

// 🔭 GLOBAL TELESCOPE TOGGLE (works even before TelescopeManager.init)
function toggleTelescopeMode() {
  if (typeof TelescopeManager === "undefined") return;
  TelescopeManager.enabled = !TelescopeManager.enabled;
  const overlay = document.getElementById("telescope-overlay");
  const hud = document.getElementById("telescope-hud");
  const btn = document.getElementById("toggle-telescope-btn");
  if (overlay) overlay.classList.toggle("hidden", !TelescopeManager.enabled);
  if (hud) hud.classList.toggle("hidden", !TelescopeManager.enabled);
  if (btn) {
    btn.classList.toggle("active", TelescopeManager.enabled);
    btn.innerHTML = TelescopeManager.enabled ? "🔭 Active" : "🔭 Telescope Mode";
  }
  if (TelescopeManager.enabled) {
    let targetZoom = 3.0;
    if (TelescopeManager.eyepieceFov === 1.0) targetZoom = 1.5;
    else if (TelescopeManager.eyepieceFov === 0.25) targetZoom = 6.0;
    const zoomInput = document.getElementById("sky-zoom");
    if (zoomInput) {
      zoomInput.value = targetZoom;
      zoomInput.dispatchEvent(new Event("input"));
    }
  }
  refreshSky();
}

function toggleNightVision() {
  if (typeof TelescopeManager === "undefined") return;
  TelescopeManager.nightVision = !TelescopeManager.nightVision;
  document.body.classList.toggle("night-vision-active", TelescopeManager.nightVision);
  const btn = document.getElementById("toggle-night-btn");
  if (btn) {
    btn.classList.toggle("active", TelescopeManager.nightVision);
    btn.innerHTML = TelescopeManager.nightVision ? "🔴 Active" : "🔴 Night Vision";
  }
  refreshSky();
}

// 🔍 SEARCH CATEGORY SELECTOR
function setSearchCategory(btn) {
  // Update visual state of all buttons
  document.querySelectorAll(".search-cat-btn").forEach(b => {
    b.classList.remove("active");
    b.style.background = "rgba(255,255,255,0.05)";
    b.style.color = "#ccc";
    b.style.borderColor = "rgba(255,255,255,0.1)";
    b.style.fontWeight = "normal";
  });
  btn.classList.add("active");
  btn.style.background = "rgba(0,255,255,0.15)";
  btn.style.color = "cyan";
  btn.style.borderColor = "rgba(0,255,255,0.3)";
  btn.style.fontWeight = "bold";

  // Set category on SearchManager if available, else use a fallback global
  const cat = btn.getAttribute("data-cat");
  if (typeof SearchManager !== "undefined") {
    SearchManager.category = cat;
    SearchManager.updateSuggestions();
  } else {
    window._searchCategory = cat;
  }
}

// 🌌 CELESTIAL OBJECT SEARCH TOGGLE STATE SYNCHRONIZATION
const ORIGINAL_SEARCH_PLACEHOLDER = "Search object (JWST, Hubble, Mars, M31...)";
const DISABLED_SEARCH_PLACEHOLDER = "Enable Celestial Objects to search.";

function isCelestialSearchEnabled() {
  if (typeof skySettings === "undefined") return true;
  if (skySettings.showCelestialObjects === false || skySettings.showCelestialObjects === "false" || skySettings.showCelestialObjects === 0) {
    return false;
  }
  if (skySettings.showDSOs === false || skySettings.showDSOs === "false" || skySettings.showDSOs === 0) {
    return false;
  }
  return true;
}

function updateSearchStateForCelestialToggle(isEnabled) {
  console.log(
    "TOGGLE STATE:",
    skySettings.showCelestialObjects,
    "DSOs:",
    skySettings.showDSOs
  );
  if (isEnabled === undefined) {
    isEnabled = isCelestialSearchEnabled();
  }

  const searchBox = document.getElementById("searchBox");
  const searchBtn = document.getElementById("searchBtn") || document.querySelector("#sky-search button");
  const helperEl = document.getElementById("search-disabled-helper");
  const suggestionsPanel = document.getElementById("search-suggestions");

  if (searchBox) {
    searchBox.disabled = !isEnabled;
    searchBox.placeholder = isEnabled ? ORIGINAL_SEARCH_PLACEHOLDER : DISABLED_SEARCH_PLACEHOLDER;
  }

  if (searchBtn) {
    searchBtn.disabled = !isEnabled;
  }

  if (helperEl) {
    if (isEnabled) {
      helperEl.classList.add("hidden");
    } else {
      helperEl.classList.remove("hidden");
    }
  }

  // If turned OFF while search results, suggestions, or input are active: reset state completely
  if (!isEnabled) {
    if (searchBox) {
      searchBox.value = "";
    }

    if (suggestionsPanel) {
      suggestionsPanel.classList.add("hidden");
      suggestionsPanel.innerHTML = "";
    }

    // Hide object info panel
    const infoPanel = document.getElementById("object-info-panel");
    if (infoPanel) {
      infoPanel.style.display = "none";
    }



    if (typeof updateObjectInfo === "function") {
      updateObjectInfo(null);
    }

    // Reset search state & markers
    if (typeof animationId !== "undefined" && animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    if (typeof marker !== "undefined" && marker) {
      marker.remove();
      marker = null;
    }
    if (typeof searchHighlight !== "undefined" && searchHighlight) {
      searchHighlight.remove();
      searchHighlight = null;
    }
    document.getElementById("highlight-marker")?.remove();

    if (typeof starLabel !== "undefined" && starLabel) {
      starLabel.remove();
      starLabel = null;
    }
    if (typeof planetLabel !== "undefined" && planetLabel) {
      planetLabel.remove();
      planetLabel = null;
    }
    if (typeof dsoSearchLabel !== "undefined" && dsoSearchLabel) {
      dsoSearchLabel.remove();
      dsoSearchLabel = null;
    }

    document.querySelectorAll(".star-search-label, .dso-search-label, .sky-crosshair").forEach(el => el.remove());

    if (typeof searchedObjectName !== "undefined") searchedObjectName = "";
    if (typeof selectedObject !== "undefined") selectedObject = null;
    if (typeof lastSelectedPlanet !== "undefined") lastSelectedPlanet = null;
    if (typeof currentTarget !== "undefined") currentTarget = null;
    if (typeof tracking !== "undefined") tracking = false;
    if (typeof _syncNavButtons === "function") {
      _syncNavButtons();
    }
    if (searchBox) {
      searchBox.blur();
    }

    document.activeElement?.blur();
  }
}

function clearSearchError() {
  const errorPanel = document.getElementById("search-error");
  if (errorPanel) {
    errorPanel.classList.add("hidden");
    errorPanel.textContent = "";
  }
}

function showSearchError(message) {
  const errorPanel = document.getElementById("search-error");
  if (errorPanel) {
    errorPanel.textContent = message;
    errorPanel.classList.remove("hidden");
  }
}

// 🔍 SEARCH FUNCTION
function resetSelectionState() {
  const suggestionsPanel = document.getElementById("search-suggestions");
  if (suggestionsPanel) {
    suggestionsPanel.classList.add("hidden");
    suggestionsPanel.innerHTML = "";
  }
  clearSearchError();

  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  if (marker) {
    marker.remove();
    marker = null;
  }

  if (searchHighlight) {
    searchHighlight.remove();
    searchHighlight = null;
  }

  document.getElementById("highlight-marker")?.remove();

  tracking = false;
  _syncNavButtons();
  currentTarget = null;

  if (starLabel) {
    starLabel.remove();
    starLabel = null;
  }

  if (dsoSearchLabel) {
    dsoSearchLabel.remove();
    dsoSearchLabel = null;
  }

  searchedObjectName = "";
}

function searchObject() {
  if (!isCelestialSearchEnabled()) {
    updateSearchStateForCelestialToggle(false);
    return;
  }

  resetSelectionState();

  // 🔍 INPUT
  let query = document.getElementById("searchBox").value;
  let searchTerm = query.toLowerCase().trim();
  if (!searchTerm) {
    const suggestionsPanel = document.getElementById("search-suggestions");

    if (suggestionsPanel) {
      suggestionsPanel.classList.add("hidden");
      suggestionsPanel.innerHTML = "";
    }

    return;
  }

  searchTerm = searchTerm.replace(/\s+/g, " ");

  if (constAlias[searchTerm]) {
    searchTerm = constAlias[searchTerm];
  }

  // Filter based on currently selected category
  let candidates = searchObjects;
  const activeCategory = (typeof SearchManager !== "undefined" && SearchManager.category)
    ? SearchManager.category
    : (window._searchCategory || "all");
  if (activeCategory !== "all") {
    candidates = searchObjects.filter(o => o.type === activeCategory);
  }

  // Rank the candidates using fuzzy search
  const scored = candidates
    .map(o => ({ obj: o, rank: (typeof SearchManager !== "undefined") ? SearchManager.getRank(searchTerm, o) : 50 }))
    .filter(x => x.rank < 4)
    .sort((a, b) => a.rank - b.rank || String(a.obj.name).localeCompare(String(b.obj.name)));

  let obj = null;


  const exactAsteroid = scored.find(
    x => x.obj.type === "asteroid" &&
      (x.obj.name || "").toLowerCase() === searchTerm.toLowerCase()
  );

  if (exactAsteroid) {
    obj = exactAsteroid.obj;
  } else if (scored.length > 0) {
    obj = scored[0].obj;
  }

  // Fallback: check full SATELLITES_DATA if not found in primary searchObjects
  if (!obj && typeof SATELLITES_DATA !== "undefined") {
    const term = searchTerm.toLowerCase();
    const sFound = SATELLITES_DATA.find(s => s && (
      (s.name && s.name.toLowerCase().includes(term)) ||
      (s.OBJECT_NAME && s.OBJECT_NAME.toLowerCase().includes(term)) ||
      (s.NORAD_CAT_ID && String(s.NORAD_CAT_ID) === term)
    ));
    if (sFound) {
      obj = {
        name: String(sFound.name || sFound.OBJECT_NAME).toLowerCase(),
        displayName: String(sFound.name || sFound.OBJECT_NAME),
        id: String(sFound.NORAD_CAT_ID || sFound.id || sFound.name || sFound.OBJECT_NAME),
        type: "satellite",
        ra: 0,
        dec: 0,
        satData: sFound
      };
    }
  }

  if (!obj) {
    const suggestionsPanel = document.getElementById("search-suggestions");
    if (suggestionsPanel) {
      suggestionsPanel.classList.add("hidden");
      suggestionsPanel.innerHTML = "";
    }

    const infoPanel = document.getElementById("object-info-panel");
    if (infoPanel) {
      infoPanel.style.display = "none";
    }

    if (typeof updateObjectInfo === "function") {
      updateObjectInfo(null);
    }

    selectedObject = null;
    showSearchError("No matching object found");
    return;
  }

  return selectObject(obj);
}

function selectObject(obj) {
  if (!obj) return;
  if (!isCelestialSearchEnabled()) {
    updateSearchStateForCelestialToggle(false);
    return;
  }

  resetSelectionState();

  const searchBox = document.getElementById("searchBox");
  if (searchBox) {
    searchBox.value = obj.displayName || obj.name || searchBox.value || "";
  }

  const visibilityMap = {
    planet: "showPlanets",
    star: "showStars",
    dso: "showDSOs",
    asteroid: "showAsteroids",
    comet: "showComets",
    satellite: "showSatellites",
    spacecraft: "showSpacecraft"
  };

  const setting = visibilityMap[obj.type];
  if (setting && !skySettings[setting]) {
    return;
  }

  console.log("Found:", obj);
  selectedObject = obj;

  updateObjectInfo(obj);
  document.getElementById("object-info-panel").style.display = isCelestialSearchEnabled() ? "block" : "none";
  updateDynamicInfo();
  if (typeof SearchManager !== "undefined") SearchManager.addHistory(obj);

  if (obj.type === "dso") {
    lastSelectedPlanet = null;
    currentTarget = [obj.ra, obj.dec];
    searchedObjectName = obj.name;
    createMarker();
    trackMarker();
    return;
  }

  if (obj.type === "spacecraft") {
    lastSelectedPlanet = null;
    const pos = getSpacecraftPosition(obj, skyTime);
    const raDeg = pos ? pos[0] : 0;
    const decDeg = pos ? pos[1] : 0;

    obj.ra = raDeg;
    obj.dec = decDeg;
    currentTarget = [raDeg, decDeg];
    searchedObjectName = obj.displayName || obj.name;
    updateObjectInfo(obj);
    if (isCelestialSearchEnabled()) {
      document.getElementById("object-info-panel").style.display = "block";
    } else {
      document.getElementById("object-info-panel").style.display = "none";
    }
    updateDynamicInfo();
    createMarker();
    trackMarker();
    return;
  }

  if (obj.type === "satellite" && typeof satellite !== "undefined") {
    lastSelectedPlanet = null;
    const satName = (obj.name || "").toLowerCase();
    const sat = obj.satData || SATELLITES_DATA.find(
      s => s && (
        (s.name && s.name.toLowerCase().includes(satName)) ||
        (s.OBJECT_NAME && s.OBJECT_NAME.toLowerCase().includes(satName)) ||
        (s.NORAD_CAT_ID && String(s.NORAD_CAT_ID) === String(obj.id))
      )
    );

    if (!sat) {
      console.error("Satellite not found:", obj);
      return;
    }

    const satrec = getSatRec(sat);
    if (satrec) {
      const posVel = satellite.propagate(satrec, skyTime);
      const posEci = posVel ? posVel.position : null;
      if (posEci && observer) {
        const gmst = satellite.gstime(skyTime);
        const observerGd = {
          longitude: observer.longitude * Math.PI / 180,
          latitude: observer.latitude * Math.PI / 180,
          height: (observer.elevation || 0) / 1000
        };
        const lookAngles = satellite.ecfToLookAngles(observerGd, satellite.eciToEcf(posEci, gmst));
        const alt = (lookAngles.elevation ?? lookAngles.altitude ?? lookAngles.alt) * 180 / Math.PI;
        const az = (lookAngles.azimuth ?? lookAngles.az) * 180 / Math.PI;
        const coords = horizontalToEquatorial(alt, az, skyTime, observer);
        if (coords) {
          currentTarget = [coords[0], coords[1]];
          selectedObject = {
            type: "satellite",
            name: sat.name || sat.OBJECT_NAME,
            id: String(sat.NORAD_CAT_ID || sat.id || sat.name || sat.OBJECT_NAME),
            ra: coords[0],
            dec: coords[1],
            altitude: alt,
            azimuth: az,
            satData: sat
          };
          searchedObjectName = sat.name || sat.OBJECT_NAME;
          updateDynamicInfo();
          createMarker();
          trackMarker();
        }
      }
    }
    return;
  }

  if (obj.type === "planet") {
    const planetName = reversePlanetMap[obj.id] || obj.name;
    lastSelectedPlanet = planetName;
    const pos = getPlanetPosition(planetName, skyTime);
    if (!pos) {
      console.log("Planet calc failed:", planetName);
      return;
    }
    const raDeg = pos[0] * 15;
    const dec = pos[1];
    currentTarget = [raDeg, dec];
    createMarker();
    trackMarker();
    return;
  }

  if (obj.type === "constellation") {
    lastSelectedPlanet = null;
    currentTarget = [obj.ra, obj.dec];
    createMarker();
    trackMarker();
    return;
  }

  if (obj.type === "asterism") {
    lastSelectedPlanet = null;
    currentTarget = [obj.ra, obj.dec];
    createMarker();
    trackMarker();
    return;
  }

  if (obj.type === "star") {
    lastSelectedPlanet = null;
    currentTarget = [obj.ra, obj.dec];
    createMarker();
    trackMarker();
    const pt = Celestial.mapProjection(currentTarget);
    if (pt && isSkyObjectRendered(obj)) {
      createStarSearchLabel(obj.name, pt[0], pt[1]);
    }
    return;
  }

  if (obj.type === "comet") {
    lastSelectedPlanet = null;
    const term = (obj.name || "").toLowerCase();
    const comet = obj.cometData || COMETS_DATA.find(c =>
      (c.name && c.name.toLowerCase().includes(term)) ||
      (c.displayName && c.displayName.toLowerCase().includes(term)) ||
      (c.designation && c.designation.toLowerCase().includes(term)) ||
      (c.id && c.id.toLowerCase() === term)
    );

    if (!comet) {
      alert("Comet not found.");
      return;
    }

    const pos = getCometPosition(comet, skyTime, observer);
    if (!pos) {
      alert("Unable to calculate comet position.");
      return;
    }

    const raDeg = pos[0] * 15;
    const decDeg = pos[1];
    const distAU = pos[2];
    const altDeg = pos[3];
    const azDeg = pos[4];
    const magVal = pos[5];

    currentTarget = [raDeg, decDeg];
    selectedObject = {
      type: "comet",
      name: comet.displayName || comet.name,
      displayName: comet.displayName || comet.name,
      designation: comet.designation || comet.name,
      id: comet.id || comet.name,
      ra: raDeg,
      dec: decDeg,
      altitude: altDeg,
      azimuth: azDeg,
      distanceAU: distAU,
      magnitude: magVal,
      period: comet.period || "N/A",
      nextPerihelion: comet.nextPerihelion || "N/A",
      description: comet.description || "",
      cometData: comet
    };
    searchedObjectName = comet.displayName || comet.name;
    updateDynamicInfo();
    createMarker();
    trackMarker();
    return;
  }

  if (obj.type === "asteroid") {
    lastSelectedPlanet = null;
    const term = (obj.name || "").toLowerCase();
    const numTerm = (obj.number || "").toLowerCase();
    const desigTerm = (obj.designation || "").toLowerCase();

    const asteroid = obj.asteroidData || ASTEROIDS_DATA.find(a =>
      (a.name && a.name.toLowerCase() === term) ||
      (a.displayName && a.displayName.toLowerCase() === term) ||
      (a.designation && a.designation.toLowerCase() === desigTerm) ||
      (a.number && String(a.number).toLowerCase() === numTerm) ||
      (a.id && a.id.toLowerCase() === term)
    ) || ASTEROIDS_DATA.find(a =>
      (a.name && a.name.toLowerCase().includes(term)) ||
      (a.displayName && a.displayName.toLowerCase().includes(term)) ||
      (a.designation && a.designation.toLowerCase().includes(term))
    );

    if (!asteroid) {
      alert("Asteroid not found.");
      return;
    }

    const pos = getAsteroidPosition(asteroid, skyTime, observer);
    if (!pos) {
      alert("Unable to calculate asteroid position.");
      return;
    }

    const raDeg = pos[0] * 15;
    const decDeg = pos[1];
    const distAU = pos[2];
    const altDeg = pos[3];
    const azDeg = pos[4];
    const magVal = pos[5];

    currentTarget = [raDeg, decDeg];
    selectedObject = {
      type: "asteroid",
      name: asteroid.displayName || asteroid.name,
      displayName: asteroid.displayName || asteroid.name,
      designation: asteroid.designation || "N/A",
      number: asteroid.number || asteroid.asteroidNumber || "N/A",
      id: asteroid.id || asteroid.name,
      ra: raDeg,
      dec: decDeg,
      altitude: altDeg,
      azimuth: azDeg,
      distanceAU: distAU,
      magnitude: magVal,
      diameter: asteroid.diameter !== undefined ? asteroid.diameter : "N/A",
      spectralType: asteroid.spectralType || "N/A",
      rotationPeriod: asteroid.rotationPeriod || "N/A",
      period: asteroid.orbitalPeriod || "N/A",
      orbitClass: asteroid.orbitClass || "Main Belt",
      discoveryDate: asteroid.discoveryDate || "N/A",
      discoveredBy: asteroid.discoveredBy || "N/A",
      description: asteroid.description || "",
      asteroidData: asteroid
    };
    console.log("ASTEROID OBJECT:", selectedObject);
    console.log("TYPE =", selectedObject.type);
    searchedObjectName = asteroid.displayName || asteroid.name;
    updateObjectInfo(selectedObject);
    updateDynamicInfo();
    createMarker();
    trackMarker();
    return;
  }
}

function getSkyCoordinatesFromEvent(event) {
  if (!Celestial.mapProjection || typeof Celestial.mapProjection.invert !== "function") return null;
  const container = document.getElementById("skyContainer");
  if (!container) return null;

  const rect = container.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const coords = Celestial.mapProjection.invert([x, y]);
  if (!coords || coords.length < 2) return null;

  let raDeg = coords[0];
  const decDeg = coords[1];
  if (typeof raDeg === "number") {
    raDeg = ((raDeg % 360) + 360) % 360;
  }

  return { raDeg, decDeg, x, y };
}

function getSkyObjectPosition(obj) {
  if (!obj || !obj.type) return null;

  switch (obj.type) {
    case "planet": {
      const pos = getPlanetPosition(obj.name, skyTime);
      if (!pos) return null;
      return [pos[0] * 15, pos[1]];
    }
    case "spacecraft": {
      if (typeof getSpacecraftPosition === "function") {
        const pos = getSpacecraftPosition(obj, skyTime);
        if (pos) return pos;
      }
      if (obj.ra !== undefined && obj.dec !== undefined) return [obj.ra, obj.dec];
      return null;
    }
    case "satellite": {
      if (typeof satellite !== "undefined") {
        const satName = (obj.name || "").toLowerCase();
        const sat = obj.satData || SATELLITES_DATA.find(
          s => s && (
            (s.name && s.name.toLowerCase().includes(satName)) ||
            (s.OBJECT_NAME && s.OBJECT_NAME.toLowerCase().includes(satName)) ||
            (s.NORAD_CAT_ID && String(s.NORAD_CAT_ID) === String(obj.id))
          )
        );
        if (sat) {
          try {
            const satrec = getSatRec(sat);
            if (satrec) {
              const posVel = satellite.propagate(satrec, skyTime);
              const posEci = posVel ? posVel.position : null;
              if (posEci && observer) {
                const gmst = satellite.gstime(skyTime);
                const observerGd = {
                  longitude: observer.longitude * Math.PI / 180,
                  latitude: observer.latitude * Math.PI / 180,
                  height: (observer.elevation || 0) / 1000
                };
                const lookAngles = satellite.ecfToLookAngles(observerGd, satellite.eciToEcf(posEci, gmst));
                const alt = (lookAngles.elevation ?? lookAngles.altitude ?? lookAngles.alt) * 180 / Math.PI;
                const az = (lookAngles.azimuth ?? lookAngles.az) * 180 / Math.PI;
                const coords = horizontalToEquatorial(alt, az, skyTime, observer);
                if (coords) return [coords[0], coords[1]];
              }
            }
          } catch (e) {
            console.error("Satellite position lookup failed:", e);
          }
        }
      }
      if (obj.ra !== undefined && obj.dec !== undefined) return [obj.ra, obj.dec];
      return null;
    }
    case "comet": {
      if (obj.cometData) {
        const pos = getCometPosition(obj.cometData, skyTime, observer);
        if (pos) return [pos[0] * 15, pos[1]];
      }
      if (obj.getCoords) return obj.getCoords(skyTime);
      if (obj.ra !== undefined && obj.dec !== undefined) return [obj.ra, obj.dec];
      return null;
    }
    case "asteroid": {
      if (obj.asteroidData) {
        const pos = getAsteroidPosition(obj.asteroidData, skyTime, observer);
        if (pos) return [pos[0] * 15, pos[1]];
      }
      if (obj.getCoords) return obj.getCoords(skyTime);
      if (obj.ra !== undefined && obj.dec !== undefined) return [obj.ra, obj.dec];
      return null;
    }
    default: {
      if (obj.ra !== undefined && obj.dec !== undefined) return [obj.ra, obj.dec];
      if (obj.getCoords) return obj.getCoords(skyTime);
      return null;
    }
  }
}

function getCelestialRenderSettings() {
  return (typeof Celestial !== "undefined" && typeof Celestial.settings === "function")
    ? Celestial.settings()
    : {};
}

function getHitTestContext() {
  if (typeof Celestial !== "undefined" && Celestial.context) return Celestial.context;
  const canvas = document.createElement("canvas");
  return canvas.getContext("2d");
}

function pointInCircle(x, y, cx, cy, r) {
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

function pointInRect(x, y, rect) {
  return rect && x >= rect.left && x <= rect.left + rect.width && y >= rect.top && y <= rect.top + rect.height;
}

function pointToLineDistance(x, y, x1, y1, x2, y2) {
  const A = x - x1;
  const B = y - y1;
  const C = x2 - x1;
  const D = y2 - y1;
  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let t = lenSq > 0 ? dot / lenSq : -1;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + C * t;
  const projY = y1 + D * t;
  const dx = x - projX;
  const dy = y - projY;
  return Math.sqrt(dx * dx + dy * dy);
}

function measureTextBoundingBox(text, x, y, font, align = "start", baseline = "alphabetic") {
  const ctx = getHitTestContext();
  if (!ctx || !text) return null;
  ctx.save();
  ctx.font = font;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  const metrics = ctx.measureText(text);
  const width = metrics.width;
  const lineHeight = Math.max(12, Math.round(parseInt(font, 10) || 12));
  let left = x;
  if (align === "center") left = x - width / 2;
  else if (align === "right" || align === "end") left = x - width;
  let top = y - lineHeight;
  if (baseline === "middle") top = y - lineHeight / 2;
  else if (baseline === "top" || baseline === "hanging") top = y;
  ctx.restore();
  return { left, top, width, height: lineHeight };
}

function getConstellationFeatureById(obj) {
  if (!obj || !obj.id) return null;
  return CONSTELLATION_FEATURES.find(feature => String(feature.id).toLowerCase() === String(obj.id).toLowerCase()) || null;
}

function getAsterismFeatureById(obj) {
  if (!obj) return null;
  if (obj.asterismData) return obj.asterismData;
  return ASTERISM_FEATURES.find(feature => String(feature.id || "").toLowerCase() === String(obj.id || "").toLowerCase()) || null;
}

function projectGeometryLineSegments(coords) {
  if (!Array.isArray(coords) || coords.length === 0) return [];
  const segments = [];
  const addSegment = (a, b) => {
    if (!a || !b) return;
    const p1 = Celestial.mapProjection(a);
    const p2 = Celestial.mapProjection(b);
    if (p1 && p2 && isFinite(p1[0]) && isFinite(p1[1]) && isFinite(p2[0]) && isFinite(p2[1])) {
      segments.push([p1, p2]);
    }
  };

  const processLine = line => {
    if (!Array.isArray(line) || line.length < 2) return;
    for (let i = 1; i < line.length; i++) {
      addSegment(line[i - 1], line[i]);
    }
  };

  if (!Array.isArray(coords[0][0])) {
    processLine(coords);
  } else {
    for (const line of coords) {
      processLine(line);
    }
  }

  return segments;
}

function isPointOnFeatureLines(obj, x, y, threshold = 5) {
  const feature = obj.type === "constellation" ? getConstellationFeatureById(obj) : getAsterismFeatureById(obj);
  if (!feature || !feature.geometry || !feature.geometry.coordinates) return false;
  const segments = projectGeometryLineSegments(feature.geometry.coordinates);
  return segments.some(([p1, p2]) => pointToLineDistance(x, y, p1[0], p1[1], p2[0], p2[1]) <= threshold);
}

function getLabelBoundingBoxForObject(obj, pt) {
  if (!pt) return null;
  let text;
  let font = "11px sans-serif";
  let align = "start";
  let baseline = "alphabetic";
  let x = pt[0];
  let y = pt[1];

  switch (obj.type) {
    case "dso":
      text = obj.displayName || obj.name || "";
      if (!text) return null;
      const dsoRadius = getRenderedObjectRadius(obj) - 6;
      x += dsoRadius;
      y -= dsoRadius;
      font = "11px 'Space Grotesk', sans-serif";
      align = "start";
      baseline = "alphabetic";
      break;
    case "comet":
      text = obj.displayName || obj.name || "";
      if (!text) return null;
      x += 10;
      y -= 2;
      font = "bold italic 10px sans-serif";
      align = "start";
      baseline = "alphabetic";
      break;
    case "asteroid":
      text = obj.displayName || obj.name || "";
      if (!text) return null;
      x += 8;
      y -= 3;
      font = "9px sans-serif";
      align = "start";
      baseline = "alphabetic";
      break;
    case "satellite":
      text = obj.displayName || obj.name || "";
      if (!text) return null;
      x += 0;
      y += 16;
      font = "bold 10px sans-serif";
      align = "center";
      baseline = "alphabetic";
      break;
    case "spacecraft":
      text = obj.displayName || obj.name || "";
      if (!text) return null;
      x += 0;
      y += 16;
      font = "bold 11px sans-serif";
      align = "center";
      baseline = "alphabetic";
      break;
    case "constellation":
      if (!(typeof skySettings !== "undefined" && skySettings.showConstellationNames)) return null;
      text = obj.fullName || obj.name || obj.id || "";
      if (!text) return null;
      font = "11px 'Space Grotesk', sans-serif";
      align = "start";
      baseline = "alphabetic";
      break;
    case "asterism":
      if (!(typeof skySettings !== "undefined" && skySettings.showAsterisms)) return null;
      text = obj.displayName || obj.name || obj.id || "";
      if (!text) return null;
      font = "11px 'Space Grotesk', sans-serif";
      align = "center";
      baseline = "middle";
      break;
    default:
      return null;
  }

  return measureTextBoundingBox(text, x, y, font, align, baseline);
}

function hitTestSkyObject(obj, x, y) {
  const pt = getSkyObjectScreenPoint(obj);
  if (!pt) return false;

  switch (obj.type) {
    case "star":
      return pointInCircle(x, y, pt[0], pt[1], getRenderedObjectRadius(obj));
    case "planet":
      return pointInCircle(x, y, pt[0], pt[1], getRenderedObjectRadius(obj));
    case "dso": {
      if (pointInCircle(x, y, pt[0], pt[1], getRenderedObjectRadius(obj))) return true;
      const labelBox = getLabelBoundingBoxForObject(obj, pt);
      return pointInRect(x, y, labelBox);
    }
    case "comet": {
      const comaRadius = 6;
      if (pointInCircle(x, y, pt[0], pt[1], comaRadius)) return true;
      const solPos = getPlanetPosition("sol", skyTime);
      if (solPos) {
        const solCoords = [solPos[0] * 15, solPos[1]];
        const solPt = Celestial.mapProjection(solCoords);
        if (solPt) {
          const tailAngle = Math.atan2(pt[1] - solPt[1], pt[0] - solPt[0]);
          const dx = x - pt[0];
          const dy = y - pt[1];
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist <= 30) {
            const angle = Math.atan2(dy, dx);
            const delta = Math.abs(((angle - tailAngle + Math.PI) % (2 * Math.PI)) - Math.PI);
            if (delta <= 0.22) return true;
          }
        }
      }
      const labelBox = getLabelBoundingBoxForObject(obj, pt);
      return pointInRect(x, y, labelBox);
    }
    case "asteroid": {
      if (pointInCircle(x, y, pt[0], pt[1], 6)) return true;
      const labelBox = getLabelBoundingBoxForObject(obj, pt);
      return pointInRect(x, y, labelBox);
    }
    case "satellite": {
      const rawName = String(obj.name || obj.displayName || "").toLowerCase();
      const importantSat = /iss|tiangong|hst|jwst|voyager|parker/.test(rawName);
      const dotRadius = importantSat ? 3.5 : 2.5;
      if (pointInCircle(x, y, pt[0], pt[1], dotRadius + 2)) return true;
      if (pointInRect(x, y, { left: pt[0] - 7, top: pt[1] - 1, width: 4, height: 2 })) return true;
      if (pointInRect(x, y, { left: pt[0] + 3, top: pt[1] - 1, width: 4, height: 2 })) return true;
      const labelBox = getLabelBoundingBoxForObject(obj, pt);
      return pointInRect(x, y, labelBox);
    }
    case "spacecraft": {
      const x0 = pt[0], y0 = pt[1];
      const inTriangle = pointInTriangle(x, y, x0, y0 - 4, x0 + 4, y0 + 3, x0 - 4, y0 + 3);
      if (inTriangle) return true;
      if (pointInRect(x, y, { left: x0 - 1.5, top: y0 - 7, width: 3, height: 4 })) return true;
      if (pointInRect(x, y, { left: x0 - 1.5, top: y0 + 3, width: 3, height: 4 })) return true;
      const labelBox = getLabelBoundingBoxForObject(obj, pt);
      return pointInRect(x, y, labelBox);
    }
    case "constellation":
    case "asterism": {
      if (isPointOnFeatureLines(obj, x, y, 5)) return true;
      const labelBox = getLabelBoundingBoxForObject(obj, pt);
      return pointInRect(x, y, labelBox);
    }
    default:
      return false;
  }
}

function pointInTriangle(px, py, x1, y1, x2, y2, x3, y3) {
  const area = 0.5 * (-y2 * x3 + y1 * (-x2 + x3) + x1 * (y2 - y3) + x2 * y3);
  const s = (1 / (2 * area)) * (y1 * x3 - x1 * y3 + (y3 - y1) * px + (x1 - x3) * py);
  const t = (1 / (2 * area)) * (x1 * y2 - y1 * x2 + (y1 - y2) * px + (x2 - x1) * py);
  return s >= 0 && t >= 0 && (s + t) <= 1;
}

function getSkyObjectHitOrder() {
  return [
    "spacecraft",
    "satellite",
    "comet",
    "asteroid",
    "planet",
    "dso",
    "star",
    "constellation",
    "asterism"
  ];
}

let isSkyDragging = false;
let skyDragStartX = 0;
let skyDragStartY = 0;

function isSkyObjectRendered(obj) {
  if (!obj || !obj.type) return false;
  if (typeof isCelestialSearchEnabled === "function" && !isCelestialSearchEnabled()) return false;

  const visibilityMap = {
    planet: "showPlanets",
    star: "showStars",
    dso: "showDSOs",
    asteroid: "showAsteroids",
    comet: "showComets",
    satellite: "showSatellites",
    spacecraft: "showSpacecraft",
    constellation: "showConstellations",
    asterism: "showAsterisms"
  };

  const settingKey = visibilityMap[obj.type];
  if (settingKey && skySettings[settingKey] === false) return false;

  if (obj.type === "star") {
    const limit = (typeof skySettings !== "undefined" && skySettings.starMagnitude !== undefined) ? skySettings.starMagnitude : 6;
    const mag = obj.mag !== undefined ? obj.mag : (obj.properties ? obj.properties.mag : undefined);
    if (mag !== undefined && mag > limit) return false;
  }

  if (obj.type === "dso") {
    const limit = (typeof skySettings !== "undefined" && skySettings.dsoMagnitude !== undefined) ? skySettings.dsoMagnitude : 6;
    const mag = obj.mag !== undefined ? obj.mag : (obj.properties ? obj.properties.mag : undefined);
    if (mag !== undefined && mag > limit) return false;
  }

  const pt = getSkyObjectScreenPoint(obj);
  if (!pt || !Array.isArray(pt) || pt.length < 2) return false;
  if (isNaN(pt[0]) || isNaN(pt[1])) return false;

  const container = document.getElementById("skyContainer");
  if (container) {
    const rect = container.getBoundingClientRect();
    if (pt[0] < -20 || pt[0] > rect.width + 20 || pt[1] < -20 || pt[1] > rect.height + 20) {
      return false;
    }
  }

  return true;
}

function findSkyObjectUnderCursor(x, y) {
  if (!searchObjects || !Array.isArray(searchObjects) || searchObjects.length === 0) return null;

  const order = getSkyObjectHitOrder();
  for (const type of order) {
    for (const obj of searchObjects) {
      if (!obj || obj.type !== type) continue;
      // Object MUST be currently rendered on screen to be clickable!
      if (!isSkyObjectRendered(obj)) continue;
      if (hitTestSkyObject(obj, x, y)) return obj;
    }
  }

  return null;
}

function getSkyObjectFromLabelTarget(target) {
  if (!target) return null;

  const label = target.closest?.(".planet-label, .star-search-label, .dso-search-label");
  if (label) {
    const text = (label.textContent || "").trim().toLowerCase();
    if (!text) return null;
    let found = null;
    if (label.classList.contains("planet-label")) {
      found = searchObjects.find(o => o.type === "planet" && ((o.name || "").toLowerCase() === text || (o.id || "").toLowerCase() === text));
    } else if (label.classList.contains("star-search-label")) {
      found = searchObjects.find(o => o.type === "star" && ((o.name || "").toLowerCase() === text || (o.displayName || "").toLowerCase() === text));
    } else if (label.classList.contains("dso-search-label")) {
      found = searchObjects.find(o => o.type === "dso" && ((o.name || "").toLowerCase() === text || (o.displayName || "").toLowerCase() === text));
    }
    if (found && isSkyObjectRendered(found)) return found;
  }

  const tagName = target.tagName?.toLowerCase();
  if (tagName === "text" || tagName === "tspan") {
    const text = (target.textContent || "").trim().toLowerCase();
    if (!text) return null;
    const found = searchObjects.find(o => {
      const lowerName = (o.name || "").toLowerCase();
      const lowerDisplay = (o.displayName || "").toLowerCase();
      const lowerFull = (o.fullName || "").toLowerCase();
      return lowerName === text || lowerDisplay === text || lowerFull === text;
    }) || null;
    if (found && isSkyObjectRendered(found)) return found;
  }

  return null;
}

function getSkyObjectFromEvent(event) {
  const labelTarget = getSkyObjectFromLabelTarget(event.target);
  if (labelTarget) return labelTarget;
  const coords = getSkyCoordinatesFromEvent(event);
  if (!coords) return null;
  return findSkyObjectUnderCursor(coords.x, coords.y);
}

function handleSkyClick(event) {
  if (isSkyDragging) {
    isSkyDragging = false;
    return;
  }
  if (!isCelestialSearchEnabled()) return;
  const target = getSkyObjectFromEvent(event);
  if (!target) return;

  event.stopPropagation();

  const searchBox = document.getElementById("searchBox");
  if (searchBox) {
    searchBox.value = target.displayName || target.name || searchBox.value || "";
  }

  selectObject(target);
}

function handleSkyRightClick(event) {
  event.preventDefault();
  if (isSkyDragging) {
    isSkyDragging = false;
    return;
  }
  if (!isCelestialSearchEnabled()) return;
  const target = getSkyObjectFromEvent(event);
  if (!target) return;

  const searchBox = document.getElementById("searchBox");
  if (searchBox) {
    searchBox.value = target.displayName || target.name || searchBox.value || "";
  }

  selectObject(target);
}

function smoothRotate(target, duration = 1000) {

  return new Promise(resolve => {
    isRotating = true;

    // Preserve the current camera roll (rotation heading)
    const currentCenter = Celestial.rotate();
    const roll = (currentCenter && currentCenter.length > 2) ? currentCenter[2] : 0;
    const targetWithRoll = [target[0], target[1], roll];

    // Utilize D3-celestial's native transition system for smooth, hardware-accelerated movement
    Celestial.rotate({
      center: targetWithRoll,
      duration: duration
    });

    setTimeout(() => {
      isRotating = false;
      resolve();
    }, duration + 50);
  });
}




function applySkyTime() {

  const input =
    document.getElementById("sky-datetime");

  if (!input.value) return;

  skyTime = new Date(input.value);

  selectedObject = selectedObject;

  updateDynamicInfo();
  _updateSimTimeUI();

  // 🔥 CLEAR LABELS
  if (starLabel) {
    starLabel.remove();
    starLabel = null;
  }

  if (dsoSearchLabel) {
    dsoSearchLabel.remove();
    dsoSearchLabel = null;
  }

  // 🔥 REAL SKY DATE
  // 🔥 Update sky date only
  Celestial.skyview({
    date: skyTime
  });

}
function createStarSearchLabel(name, x, y) {
  if (typeof isCelestialSearchEnabled === "function" && !isCelestialSearchEnabled()) {
    if (starLabel) { starLabel.remove(); starLabel = null; }
    return;
  }

  // 🔥 REMOVE OLD
  if (starLabel) {
    starLabel.remove();
    starLabel = null;
  }

  const label = document.createElement("div");

  label.className = "star-search-label";

  label.innerText = name.toUpperCase();

  label.style.position = "absolute";

  // ⭐ DIFFERENT COLOR FROM PLANETS
  label.style.color = "#00ffcc";

  label.style.fontSize = "14px";
  label.style.fontWeight = "bold";

  label.style.pointerEvents = "auto";
  label.style.cursor = "pointer";
  label.style.zIndex = "9999";

  // ✨ GLOW
  label.style.textShadow =
    "0 0 8px #00ffcc";

  // 🎯 POSITION
  label.style.left = x + "px";
  label.style.top = y + "px";

  label.style.transform =
    "translate(-50%, -120%)";

  document
    .getElementById("skyContainer")
    .appendChild(label);

  starLabel = label;
}

function updatePlanetLabelPositions(projChanged) {
  if (typeof skySettings !== "undefined" && skySettings.showPlanets === false) {
    planetLabels.forEach(p => { if (p.el) p.el.style.display = "none"; });
    return;
  }

  planetLabels.forEach(p => {
    const pos = getPlanetPosition(p.name, skyTime);
    if (!pos) {
      if (p.el) p.el.style.display = "none";
      return;
    }

    const raDeg = pos[0] * 15;
    const dec = pos[1];

    if (typeof Celestial.clip === "function" && !Celestial.clip([raDeg, dec])) {
      if (p.el) p.el.style.display = "none";
      return;
    }

    let pt = null;
    try {
      pt = Celestial.mapProjection([raDeg, dec]);
    } catch (e) { }

    if (!pt || isNaN(pt[0]) || isNaN(pt[1])) {
      if (p.el) p.el.style.display = "none";
      return;
    }

    p.el.style.display = "inline-block";
    p.el.style.left = (pt[0] + 3) + "px";
    p.el.style.top = (pt[1] - 3) + "px";
  });
}

function createPlanetLabel(name, pt) {
  if (planetLabel) {
    planetLabel.remove();
    planetLabel = null;
  }

  const container = document.getElementById("skyContainer");
  if (!container) return;

  const label = document.createElement("div");
  label.className = "planet-label";
  label.innerText = name;

  label.style.color = planetLabelColors[name.toLowerCase()] || "#ffffff";
  label.style.fontSize = "18px";
  label.style.fontWeight = "700";
  label.style.whiteSpace = "nowrap";

  const glow = (name || "").toLowerCase();

  if (glow === "sun" || glow === "moon") {
    label.style.textShadow = "0 0 3px currentColor,0 0 6px currentColor,0 0 10px currentColor";
  } else if (glow === "venus") {
    label.style.textShadow = "0 0 3px currentColor,0 0 6px currentColor";
  } else {
    label.style.textShadow = "0 0 2px currentColor,0 0 4px currentColor";
  }

  label.style.position = "absolute";
  label.style.zIndex = "9999";
  label.style.left = (pt[0] + 3) + "px";
  label.style.top = (pt[1] - 3) + "px";
  container.appendChild(label);

  planetLabel = label;
}

function createAllPlanetLabels() {

  // remove old
  planetLabels.forEach(l => l.remove());
  planetLabels = [];

  Object.keys(planetMap).forEach(name => {

    const fullName = name;

    const pos = getPlanetPosition(fullName, skyTime);
    if (!pos) return;

    const raDeg = pos[0] * 15;
    const dec = pos[1];

    const pt = Celestial.mapProjection([raDeg, dec]);
    if (!pt) return;

    const rect = document.getElementById("skyContainer").getBoundingClientRect();

    const label = document.createElement("div");
    label.className = "planet-label";
    label.innerText = fullName;
    label.className = "planet-label";

    label.style.whiteSpace = "nowrap";
    label.style.display = "inline-block";

    label.style.position = "absolute";
    label.style.color =
      planetLabelColors[fullName.toLowerCase()] || "#ffffff";
    // 👇 YE ADD KARO
    label.style.fontSize = "18px";
    label.style.fontWeight = "700";
    label.style.whiteSpace = "nowrap";

    const glow =
      (
        fullName || name
      ).toLowerCase();

    if (
      glow === "sun" ||
      glow === "moon"
    ) {

      label.style.textShadow =
        "0 0 3px currentColor,0 0 6px currentColor,0 0 10px currentColor";

    }
    else if (glow === "venus") {

      label.style.textShadow =
        "0 0 3px currentColor,0 0 6px currentColor";

    }
    else {

      label.style.textShadow =
        "0 0 2px currentColor,0 0 4px currentColor";

    }
    label.style.fontSize = "18px";
    label.style.zIndex = "20";

    label.style.left = (pt[0] + 3) + "px";
    label.style.top = (pt[1] - 3) + "px";

    document.getElementById("skyContainer").appendChild(label);

    planetLabels.push({
      el: label,
      name: fullName
    });
  });
}


function createDSOSearchLabel(name, x, y) {
  if (typeof isCelestialSearchEnabled === "function" && !isCelestialSearchEnabled()) {
    if (dsoSearchLabel) { dsoSearchLabel.remove(); dsoSearchLabel = null; }
    return;
  }

  // 🔥 REMOVE OLD
  if (dsoSearchLabel) {
    dsoSearchLabel.remove();
    dsoSearchLabel = null;
  }

  const cleanName =
    name.toLowerCase().replace(/\s+/g, "");

  // 🔥 CHECK ALL SVG TEXTS
  const svgTexts = Array.from(
    document.querySelectorAll("#skyContainer text")
  );

  const alreadyVisible = svgTexts.some(el => {

    const txt =
      el.textContent
        .toLowerCase()
        .replace(/\s+/g, "");

    return (
      txt === cleanName ||
      txt.startsWith(cleanName)
    );
  });

  // 🔥 ALREADY ON MAP
  if (alreadyVisible) return;

  // 🔥 CREATE LABEL
  const label = document.createElement("div");

  label.className = "dso-search-label";

  label.innerText = name.toUpperCase();

  label.style.position = "absolute";
  label.style.color = "cyan";
  label.style.fontSize = "14px";
  label.style.fontWeight = "bold";
  label.style.pointerEvents = "auto";
  label.style.cursor = "pointer";
  label.style.zIndex = "9999";

  // 🔥 PERFECT POSITION
  label.style.left = x + "px";
  label.style.top = y + "px";

  label.style.transform =
    "translate(-50%, -120%)";

  // 🔥 INSIDE SKY
  document
    .getElementById("skyContainer")
    .appendChild(label);

  dsoSearchLabel = label;
}

async function fetchObjectInfo(objectName) {

  const lowerName =
    objectName.toLowerCase();

  // 🔥 CUSTOM NAME MAP
  if (
    wikiNameMap[lowerName]
  ) {

    objectName =
      wikiNameMap[lowerName];
  }

  // 🔥 MESSIER OBJECTS
  else if (
    lowerName.startsWith("m")
  ) {

    objectName =
      lowerName.toUpperCase() +
      " object";
  }

  // 🔥 NGC OBJECTS
  else if (
    lowerName.startsWith("ngc")
  ) {

    objectName =
      lowerName.toUpperCase() +
      " galaxy";
  }

  // 🔥 IC OBJECTS
  else if (
    lowerName.startsWith("ic")
  ) {

    objectName =
      lowerName.toUpperCase() +
      " nebula";
  }

  try {



    const response = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${objectName}`
    );

    console.log(response.status);
    console.log(await response.clone().text());

    const data = await response.json();

    document.getElementById(
      "info-ai"
    ).innerText =

      data.extract ||

      "No information found.";

  }

  catch (err) {

    console.log(err);

    document.getElementById(
      "info-ai"
    ).innerText =

      "Information fetch failed.";
  }
}

// ================= 🔭 TELESCOPE MANAGER =================
const TelescopeManager = {
  enabled: false,
  eyepieceFov: 0.5,
  crosshairStyle: "standard",
  showFinderRing: true,
  nightVision: false,
  initialized: false,

  init() {
    const toggleBtn = document.getElementById("toggle-telescope-btn");
    const toggleNightBtn = document.getElementById("toggle-night-btn");
    const hud = document.getElementById("telescope-hud");
    const overlay = document.getElementById("telescope-overlay");
    const closeHudBtn = document.getElementById("close-hud-btn");

    const hudEyepiece = document.getElementById("hud-eyepiece-select");
    const hudCrosshair = document.getElementById("hud-crosshair-select");
    const hudFinder = document.getElementById("hud-finder-toggle");

    const settingsToggles = {
      mode: document.getElementById("settings-telescope-toggle"),
      eyepiece: document.getElementById("settings-eyepiece-select"),
      crosshair: document.getElementById("settings-crosshair-select"),
      finder: document.getElementById("settings-finder-toggle"),
      night: document.getElementById("settings-night-toggle")
    };

    const syncUI = () => {
      if (toggleBtn) {
        toggleBtn.classList.toggle("active", this.enabled);
        toggleBtn.innerHTML = this.enabled ? "🔭 Active" : "🔭 Telescope Mode";
      }
      if (toggleNightBtn) {
        toggleNightBtn.innerHTML = this.nightVision ? "🔴 Active" : "🔴 Night Vision";
      }

      if (hud) hud.classList.toggle("hidden", !this.enabled);
      if (overlay) overlay.classList.toggle("hidden", !this.enabled);

      if (hudEyepiece) hudEyepiece.value = this.eyepieceFov;
      if (hudCrosshair) hudCrosshair.value = this.crosshairStyle;
      if (hudFinder) hudFinder.checked = this.showFinderRing;

      if (settingsToggles.mode) settingsToggles.mode.checked = this.enabled;
      if (settingsToggles.eyepiece) settingsToggles.eyepiece.value = this.eyepieceFov;
      if (settingsToggles.crosshair) settingsToggles.crosshair.value = this.crosshairStyle;
      if (settingsToggles.finder) settingsToggles.finder.checked = this.showFinderRing;
      if (settingsToggles.night) settingsToggles.night.checked = this.nightVision;

      document.body.classList.toggle("night-vision-active", this.nightVision);

      const crosshairContainer = document.querySelector(".eyepiece-crosshair");
      if (crosshairContainer) {
        if (this.crosshairStyle === "off") {
          crosshairContainer.style.display = "none";
        } else {
          crosshairContainer.style.display = "block";
          const chCircle = crosshairContainer.querySelector(".ch-circle");
          if (chCircle) {
            chCircle.style.display = this.crosshairStyle === "reticle" ? "block" : "none";
          }
        }
      }

      const outerRing = document.querySelector(".fov-ring-outer");
      if (outerRing) {
        outerRing.style.display = this.showFinderRing ? "block" : "none";
      }

      if (this.enabled) {
        let targetZoom = 1;
        if (this.eyepieceFov === 1.0) targetZoom = 1.5;
        else if (this.eyepieceFov === 0.5) targetZoom = 3.0;
        else if (this.eyepieceFov === 0.25) targetZoom = 6.0;

        const zoomInput = document.getElementById("sky-zoom");
        if (zoomInput) {
          zoomInput.value = targetZoom;
          zoomInput.dispatchEvent(new Event("input"));
        }
      }
    };

    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => {
        this.enabled = !this.enabled;
        syncUI();
      });
    }

    if (toggleNightBtn) {
      toggleNightBtn.addEventListener("click", () => {
        this.nightVision = !this.nightVision;
        syncUI();
      });
    }

    if (closeHudBtn) {
      closeHudBtn.addEventListener("click", () => {
        this.enabled = false;
        syncUI();
      });
    }

    if (hudEyepiece) {
      hudEyepiece.addEventListener("change", (e) => {
        this.eyepieceFov = parseFloat(e.target.value);
        syncUI();
      });
    }

    if (hudCrosshair) {
      hudCrosshair.addEventListener("change", (e) => {
        this.crosshairStyle = e.target.value;
        syncUI();
      });
    }

    if (hudFinder) {
      hudFinder.addEventListener("change", (e) => {
        this.showFinderRing = e.target.checked;
        syncUI();
      });
    }

    if (settingsToggles.mode) {
      settingsToggles.mode.addEventListener("change", (e) => {
        this.enabled = e.target.checked;
        syncUI();
      });
    }
    if (settingsToggles.eyepiece) {
      settingsToggles.eyepiece.addEventListener("change", (e) => {
        this.eyepieceFov = parseFloat(e.target.value);
        syncUI();
      });
    }
    if (settingsToggles.crosshair) {
      settingsToggles.crosshair.addEventListener("change", (e) => {
        this.crosshairStyle = e.target.value;
        syncUI();
      });
    }
    if (settingsToggles.finder) {
      settingsToggles.finder.addEventListener("change", (e) => {
        this.showFinderRing = e.target.checked;
        syncUI();
      });
    }
    if (settingsToggles.night) {
      settingsToggles.night.addEventListener("change", (e) => {
        this.nightVision = e.target.checked;
        syncUI();
      });
    }
  },

  updateRings() {
    if (!this.enabled || !Celestial.mapProjection) return;

    const scale = Celestial.mapProjection.scale();
    const pxPerDegree = scale * (Math.PI / 180);

    const rings = {
      "outer": 4.0,
      "1.0": 1.0,
      "0.5": 0.5,
      "0.25": 0.25
    };

    for (const fov in rings) {
      const ringEl = document.querySelector(`.fov-ring-` + fov.replace(".", "\\."));
      if (ringEl) {
        const diam = Math.round(2 * rings[fov] * pxPerDegree);
        ringEl.style.width = diam + "px";
        ringEl.style.height = diam + "px";
      }
    }

    const maskEl = document.querySelector(".eyepiece-mask");
    if (maskEl) {
      maskEl.style.width = "450px";
      maskEl.style.height = "450px";
    }
  }
};

// ================= 🔍 ADVANCED SEARCH MANAGER =================
// Exact alias match



const SearchManager = {
  category: "all",
  historyKey: "astro_search_history",
  favoritesKey: "astro_favorites",
  initialized: false,

  init() {
    const searchBox = document.getElementById("searchBox");
    const suggestionsPanel = document.getElementById("search-suggestions");
    const catButtons = document.querySelectorAll(".search-cat-btn");
    const favBtn = document.getElementById("toggle-favorite-btn");

    if (!searchBox || !suggestionsPanel) return;

    catButtons.forEach(btn => {
      btn.addEventListener("click", (e) => {
        catButtons.forEach(b => {
          b.classList.remove("active");
          b.style.background = "rgba(255,255,255,0.05)";
          b.style.color = "#ccc";
          b.style.borderColor = "rgba(255,255,255,0.1)";
          b.style.fontWeight = "normal";
        });
        btn.classList.add("active");
        btn.style.background = "rgba(0,255,255,0.15)";
        btn.style.color = "cyan";
        btn.style.borderColor = "rgba(0,255,255,0.3)";
        btn.style.fontWeight = "bold";
        this.category = btn.getAttribute("data-cat");
        this.updateSuggestions();
      });
    });

    searchBox.addEventListener("focus", () => {
      SearchManager.updateSuggestions();
      clearSearchError();
    });

    searchBox.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        searchObject();
      }
    });

    document.addEventListener("click", (e) => {
      if (!searchBox.contains(e.target) && !suggestionsPanel.contains(e.target)) {
        suggestionsPanel.classList.add("hidden");
      }
    });

    if (!isCelestialSearchEnabled()) {
      return;
    }

    searchBox.addEventListener("input", () => {
      clearSearchError();

      if (!isCelestialSearchEnabled()) {
        searchBox.value = "";
        suggestionsPanel.classList.add("hidden");
        suggestionsPanel.innerHTML = "";
        return;
      }

      // 👇 Agar input empty hai to panel hide karke return
      if (searchBox.value.trim() === "") {
        suggestionsPanel.classList.add("hidden");
        suggestionsPanel.innerHTML = "";
        return;
      }

      SearchManager.updateSuggestions();
    });

    if (favBtn) {
      favBtn.addEventListener("click", () => {
        if (selectedObject) {
          SearchManager.toggleFavorite(selectedObject);
          SearchManager.updateFavoriteButton();
        }
      });
    }
  },

  getHistory() {
    try {
      let history = JSON.parse(localStorage.getItem(this.historyKey));
      if (!history || history.length === 0) {
        history = [
          { name: "jupiter", type: "planet", fullName: "Jupiter" },
          { name: "saturn", type: "planet", fullName: "Saturn" },
          { name: "m31", type: "dso", fullName: "Andromeda Galaxy (M31)" }
        ];
      }
      return history;
    } catch (_) {
      return [
        { name: "jupiter", type: "planet", fullName: "Jupiter" },
        { name: "saturn", type: "planet", fullName: "Saturn" },
        { name: "m31", type: "dso", fullName: "Andromeda Galaxy (M31)" }
      ];
    }
  },

  addHistory(obj) {
    try {
      let history = this.getHistory();
      history = history.filter(o => o.name.toLowerCase() !== obj.name.toLowerCase());
      history.unshift({ name: obj.name, type: obj.type, fullName: obj.fullName || obj.name });
      if (history.length > 5) history.pop();
      localStorage.setItem(this.historyKey, JSON.stringify(history));
    } catch (e) {
      console.error("Failed to save search history:", e);
    }
  },

  addHistory(obj) {
    let history = this.getHistory();
    history = history.filter(o => o.name !== obj.name);
    history.unshift({ name: obj.name, type: obj.type, fullName: obj.fullName || obj.name });
    if (history.length > 5) history.pop();
    localStorage.setItem(this.historyKey, JSON.stringify(history));
  },

  getFavorites() {
    try {
      return JSON.parse(localStorage.getItem(this.favoritesKey)) || [];
    } catch (_) {
      return [];
    }
  },

  toggleFavorite(obj) {
    let favorites = this.getFavorites();
    const isFav = favorites.some(o => o.name === obj.name);
    if (isFav) {
      favorites = favorites.filter(o => o.name !== obj.name);
    } else {
      favorites.push({ name: obj.name, type: obj.type, fullName: obj.fullName || obj.name });
    }
    localStorage.setItem(this.favoritesKey, JSON.stringify(favorites));
  },

  isFavorite(name) {
    return this.getFavorites().some(o => o.name.toLowerCase() === name.toLowerCase());
  },

  updateFavoriteButton() {
    const favBtn = document.getElementById("toggle-favorite-btn");
    if (!favBtn || !selectedObject) return;
    const isFav = this.isFavorite(selectedObject.name);
    favBtn.innerHTML = isFav ? "⭐ Favorite Object" : "☆ Add to Favorites";
    favBtn.style.borderColor = isFav ? "rgba(255,215,0,0.5) !important" : "rgba(0, 255, 255, 0.3) !important";
    favBtn.style.color = isFav ? "gold !important" : "cyan !important";
    favBtn.style.background = isFav ? "rgba(255,215,0,0.1) !important" : "rgba(0, 255, 255, 0.1) !important";
  },



  getRank(query, obj) {
    const q = query.toLowerCase().replace(/[^a-z0-9]/g, "");
    const name = String(obj.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const id = String(obj.id || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const fullName = String(obj.fullName || "").toLowerCase().replace(/[^a-z0-9]/g, "");

    // Collect every searchable name automatically
    const searchableNames = [
      obj.name,
      obj.fullName,
      obj.displayName,
      obj.commonName,
      obj.common_names,
      obj.properName,
      obj.nickname,
      obj.messier,
      obj.ngc,
      obj.ic,
      obj.caldwell,
      obj.object_definition,

      ...(Array.isArray(obj.m) ? obj.m : []),

      ...(obj.aliases || [])
    ]
      .filter(Boolean)
      .flatMap(v => Array.isArray(v) ? v : [v])
      .map(v => String(v).toLowerCase().replace(/[^a-z0-9]/g, ""));

    if (searchableNames.includes(q)) return 1;

    if (searchableNames.some(v => v.startsWith(q))) return 2;

    if (searchableNames.some(v => v.includes(q))) return 3;

    // Search aliases
    const aliases = (obj.aliases || []).map(a =>
      a.toLowerCase().replace(/[^a-z0-9]/g, "")
    );

    if (aliases.includes(q)) return 1;
    if (aliases.some(a => a.startsWith(q))) return 2;
    if (aliases.some(a => a.includes(q))) return 3;

    // Check if query matches a starNameMap alias (e.g. "sirius" → "hd48915")
    const aliasTarget = starNameMap[query.toLowerCase().trim()];
    const aliasNorm = aliasTarget ? aliasTarget.toLowerCase().replace(/[^a-z0-9]/g, "") : null;
    if (aliasNorm && (name === aliasNorm || id === aliasNorm)) return 1;

    if (name === q || id === q || fullName === q) return 1;
    if (name.startsWith(q) || id.startsWith(q) || fullName.startsWith(q)) return 2;
    if (name.includes(q) || id.includes(q) || fullName.includes(q)) return 3;



    return 100;
  },

  getObjectIcon(type) {

    switch (type) {

      case "planet":
        return planetIcon;

      case "star":
        return starIcon;

      case "dso":
        return galaxyIcon;

      case "asteroid":
        return asteroidIcon;

      case "comet":
        return cometIcon;

      case "satellite":
        return satelliteIcon;

      case "spacecraft":
        return spacecraftIcon;

      default:
        return objectIcon;
    }

  },

  updateSuggestions() {
    if (!isCelestialSearchEnabled()) {
      const panel = document.getElementById("search-suggestions");
      if (panel) {
        panel.innerHTML = "";
        panel.classList.add("hidden");
      }
      return;
    }
    if (!isCelestialSearchEnabled()) {
      const suggestionsPanel = document.getElementById("search-suggestions");
      if (suggestionsPanel) {
        suggestionsPanel.classList.add("hidden");
        suggestionsPanel.innerHTML = "";
      }
      return;
    }
    const searchBox = document.getElementById("searchBox");
    const suggestionsPanel = document.getElementById("search-suggestions");

    if (!searchBox || !suggestionsPanel) return;

    // Purane suggestions clear karo
    suggestionsPanel.innerHTML = "";

    const query = searchBox.value.trim().toLowerCase();
    const history = searchObjects;
    // Array of { name, type, fullName }

    // Filter history based on typed query (if any)
    let filtered = history.filter(h => {

      const visibilityMap = {
        planet: "showPlanets",
        star: "showStars",
        dso: "showDSOs",
        asteroid: "showAsteroids",
        comet: "showComets",
        satellite: "showSatellites",
        spacecraft: "showSpacecraft"
      };

      const setting = visibilityMap[h.type];
      if (setting && !skySettings[setting]) return false;

      if (!query) return false;

      return SearchManager.getRank(query, h) < 100;
    });

    filtered.sort((a, b) =>
      SearchManager.getRank(query, a) -
      SearchManager.getRank(query, b)
    );

    // Limit to only 2-3 previous searched objects
    const displayList = filtered.slice(0, 3);

    if (displayList.length === 0) {
      suggestionsPanel.innerHTML = "";
      suggestionsPanel.classList.add("hidden");
      return;
    }

    let html = "";

    displayList.forEach(h => {

      html += `

<div class="suggestion-item" data-name="${h.name}">

    <div class="suggestion-content">

        <div class="suggestion-title">
            ${h.fullName || h.name}
        </div>

        ${h.commonName ? `
        <div class="suggestion-subtitle">
            ${h.commonName}
        </div>
        ` : ""}

        <div class="suggestion-badge">
            ${h.type}
        </div>

    </div>

</div>

`;

    });
    suggestionsPanel.innerHTML = html;
    suggestionsPanel.classList.remove("hidden");

    // Bind click events on suggestions
    const items = suggestionsPanel.querySelectorAll(".suggestion-item");
    items.forEach(item => {
      item.addEventListener("click", () => {
        const name = item.getAttribute("data-name");
        searchBox.value = name;
        suggestionsPanel.classList.add("hidden");
        searchObject();
      });
    });
  },

  bindSuggestionClicks() {
    const items = document.querySelectorAll(".suggestion-item");
    const searchBox = document.getElementById("searchBox");
    const suggestionsPanel = document.getElementById("search-suggestions");

    items.forEach(item => {
      item.addEventListener("click", () => {
        const name = item.getAttribute("data-name");
        if (searchBox) searchBox.value = name;
        if (suggestionsPanel) suggestionsPanel.classList.add("hidden");
        searchObject();
      });
    });
  }
};

// ================= 📚 RICH CELESTIAL OBJECT DATABASE =================
const objectFacts = {
  sun: { dist: "1.00 AU (~149.6 Million km)", desc: "The star at the center of the Solar System. It is a nearly perfect sphere of hot plasma, heated to incandescence by nuclear fusion reactions in its core." },
  moon: { dist: "0.00257 AU (~384,400 km)", desc: "Earth's only natural satellite. It is the fifth-largest satellite in the Solar System and the largest relative to the size of its parent planet." },
  mercury: { desc: "The smallest and closest planet to the Sun in the Solar System. It has no natural satellites and has an extremely thin atmosphere." },
  venus: { desc: "The second planet from the Sun. It has the densest atmosphere of all the terrestrial planets, consisting of more than 96% carbon dioxide." },
  earth: { dist: "0.00 AU (Observer)", desc: "Our home planet, and the only astronomical object known to harbor life. It is the densest of the eight planets in the Solar System." },
  mars: { desc: "The fourth planet from the Sun, often referred to as the 'Red Planet' due to the iron oxide prevalent on its surface." },
  jupiter: { desc: "The fifth planet from the Sun and the largest in the Solar System. It is a gas giant with a mass more than two and a half times that of all the other planets combined." },
  saturn: { desc: "The sixth planet from the Sun and the second-largest in the Solar System. It is famous for its extensive and beautiful ring system." },
  uranus: { desc: "The seventh planet from the Sun. It has the third-largest planetary radius and fourth-largest planetary mass in the Solar System." },
  neptune: { desc: "The eighth and farthest-known Solar planet from the Sun. It is the densest giant planet and is slightly more massive than Uranus." },
  pluto: { desc: "A dwarf planet in the Kuiper belt, a ring of bodies beyond the orbit of Neptune. It was the first Kuiper belt object to be discovered." },
  sirius: { dist: "8.6 light-years", desc: "The brightest star in the night sky. Also known as the 'Dog Star', it is a binary star system in the constellation Canis Major." },
  canopus: { dist: "310 light-years", desc: "The second-brightest star in the night sky. It is a giant star of spectral type F located in the constellation Carina." },
  arcturus: { dist: "37 light-years", desc: "A red giant star in the Northern Hemisphere. It is the fourth-brightest star in the night sky and the brightest in the constellation Boötes." },
  vega: { dist: "25 light-years", desc: "The fifth-brightest star in the night sky. It is a blue-white main-sequence star in the constellation Lyra." },
  capella: { dist: "42.9 light-years", desc: "The brightest star in the constellation Auriga. It is a quadruple star system consisting of two bright yellow giant binary pairs." },
  rigel: { dist: "860 light-years", desc: "A blue supergiant star in the constellation Orion. It is the seventh-brightest star in the night sky and is highly luminous." },
  procyon: { dist: "11.4 light-years", desc: "The brightest star in the constellation Canis Minor. It is a binary star system consisting of a white main-sequence star and a white dwarf." },
  betelgeuse: { dist: "640 light-years", desc: "A red supergiant star in the constellation Orion. It is one of the largest stars visible to the naked eye and is semiregular variable." },
  altair: { dist: "16.7 light-years", desc: "The brightest star in the constellation Aquila. It is an A-type main-sequence star that rotates rapidly, flattening its poles." },
  aldebaran: { dist: "65 light-years", desc: "A red giant star in the constellation Taurus. It is the fourteenth-brightest star in the night sky and is the 'eye' of the Bull." },
  spica: { dist: "250 light-years", desc: "The brightest star in the constellation Virgo. It is a close binary star system whose components orbit each other every 4 days." },
  antares: { dist: "550 light-years", desc: "A red supergiant star in the constellation Scorpius. It is the fifteenth-brightest star and is often called the 'heart of the scorpion'." },
  pollux: { dist: "34 light-years", desc: "An orange-hued giant star in the constellation Gemini. It is the closest giant star to the Sun and has an orbiting extrasolar planet." },
  castor: { dist: "51 light-years", desc: "The second-brightest object in the constellation Gemini. It is a sextuple star system composed of three visual binary pairs." },
  fomalhaut: { dist: "25 light-years", desc: "The brightest star in the constellation Piscis Austrinus. It is a young main-sequence star surrounded by a prominent debris disk." },
  deneb: { dist: "2,600 light-years", desc: "A blue supergiant star in the constellation Cygnus. It is the nineteenth-brightest star and marks the tail of the Swan." },
  regulus: { dist: "79 light-years", desc: "The brightest star in the constellation Leo. It is a multiple star system consisting of four stars organized into two pairs." },
  m31: { dist: "2.54 Million light-years", desc: "The Andromeda Galaxy. It is a barred spiral galaxy and the nearest major galaxy to the Milky Way, containing over 1 trillion stars." },
  m42: { dist: "1,344 light-years", desc: "The Orion Nebula. It is a diffuse nebula situated in the Milky Way, south of Orion's Belt, and is one of the brightest stellar nurseries." },
  m45: { dist: "444 light-years", desc: "The Pleiades open star cluster. Also known as the Seven Sisters, it is one of the nearest and most visually stunning star clusters to Earth." },
  m1: { dist: "6,500 light-years", desc: "The Crab Nebula. It is a supernova remnant in the constellation Taurus, created by a stellar explosion documented by astronomers in 1054." },
  m51: { dist: "23 Million light-years", desc: "The Whirlpool Galaxy. It is a classic spiral galaxy in the constellation Canes Venatici, interacting with a smaller companion dwarf galaxy." },
  m13: { dist: "22,200 light-years", desc: "The Hercules Globular Cluster. It is a globular cluster of about 300,000 stars in the constellation of Hercules." },
  m57: { dist: "2,300 light-years", desc: "The Ring Nebula. It is a planetary nebula in the northern constellation of Lyra, formed by a shell of ionized gas expelled into surrounding space." }
};

// Formatting helpers for proper astronomical notations
function formatRA(raDeg) {
  if (raDeg === undefined || raDeg === null || isNaN(raDeg)) return "00h 00m 00s";
  const hDecimal = (raDeg + 360) % 360 / 15;
  const hours = Math.floor(hDecimal);
  const mDecimal = (hDecimal - hours) * 60;
  const minutes = Math.floor(mDecimal);
  const seconds = Math.round((mDecimal - minutes) * 60);
  const pad = (num) => String(num).padStart(2, '0');
  return `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
}

function formatDEC(decDeg) {
  if (decDeg === undefined || decDeg === null || isNaN(decDeg)) return "+00° 00' 00\"";
  const sign = decDeg >= 0 ? "+" : "-";
  const absDec = Math.abs(decDeg);
  const degrees = Math.floor(absDec);
  const mDecimal = (absDec - degrees) * 60;
  const minutes = Math.floor(mDecimal);
  const seconds = Math.round((mDecimal - minutes) * 60);
  const pad = (num) => String(num).padStart(2, '0');
  return `${sign}${pad(degrees)}° ${pad(minutes)}' ${pad(seconds)}"`;
}

function getTransitTime(raHours, date, observer) {
  try {
    const lon = observer.longitude;
    const transitLST = (raHours + 24) % 24;
    const midnight = new Date(date);
    midnight.setHours(0, 0, 0, 0);
    const astroTimeMidnight = Astronomy.MakeTime(midnight);
    const gmstMidnight = Astronomy.SiderealTime(astroTimeMidnight);
    const lstMidnight = (gmstMidnight + lon / 15 + 24) % 24;
    let diffHours = transitLST - lstMidnight;
    if (diffHours < 0) diffHours += 24;
    const solarHours = diffHours / 1.00273790935;
    const result = new Date(midnight.getTime() + solarHours * 3600 * 1000);
    return formatTime(result);
  } catch (_) {
    return "N/A";
  }
}

function getFixedObjectRiseSetTransit(raHours, decDeg, date, observer) {
  try {
    const lat = observer.latitude;
    const decRad = decDeg * Math.PI / 180;
    const latRad = lat * Math.PI / 180;
    const altRad = -0.567 * Math.PI / 180;

    const cosH = (Math.sin(altRad) - Math.sin(latRad) * Math.sin(decRad)) / (Math.cos(latRad) * Math.cos(decRad));

    const transitText = getTransitTime(raHours, date, observer);

    if (cosH < -1) {
      return { rise: "Circumpolar (Always up)", set: "Circumpolar (Always up)", transit: transitText };
    } else if (cosH > 1) {
      return { rise: "Never rises", set: "Never sets", transit: transitText };
    }

    const H = Math.acos(cosH) * 12 / Math.PI;
    const riseLST = (raHours - H + 24) % 24;
    const setLST = (raHours + H) % 24;

    const lon = observer.longitude;
    const midnight = new Date(date);
    midnight.setHours(0, 0, 0, 0);
    const astroTimeMidnight = Astronomy.MakeTime(midnight);
    const gmstMidnight = Astronomy.SiderealTime(astroTimeMidnight);
    const lstMidnight = (gmstMidnight + lon / 15 + 24) % 24;

    const getLocalTimeForLST = (targetLST) => {
      let diffHours = targetLST - lstMidnight;
      if (diffHours < 0) diffHours += 24;
      const solarHours = diffHours / 1.00273790935;
      return new Date(midnight.getTime() + solarHours * 3600 * 1000);
    };

    return {
      rise: formatTime(getLocalTimeForLST(riseLST)),
      set: formatTime(getLocalTimeForLST(setLST)),
      transit: transitText
    };
  } catch (_) {
    return { rise: "N/A", set: "N/A", transit: "N/A" };
  }
}

function hideEmptyFields() {

  document.querySelectorAll("#object-info-panel p").forEach(el => {

    const text = el.innerText.trim();

    if (
      text === "" ||
      text.endsWith("N/A") ||
      text.endsWith("--") ||
      text === "N/A" ||
      text === "--"
    ) {
      el.style.display = "none";
    } else {
      el.style.display = "";
    }

  });

  document.querySelectorAll(".obs-row").forEach(row => {

    const value = row.querySelector("span:last-child");

    if (!value) return;

    const text = value.innerText.trim();

    if (
      text === "" ||
      text === "--" ||
      text === "N/A" ||
      text === "Unknown"
    ) {
      row.style.display = "none";
    } else {
      row.style.display = "flex";
    }

  });

}
function updateObjectInfo(obj) {
  if (typeof isCelestialSearchEnabled === "function" && !isCelestialSearchEnabled()) {
    const infoPanel = document.getElementById("object-info-panel");
    if (infoPanel) infoPanel.style.display = "none";
    return;
  }

  if (!obj) {
    const infoPanel = document.getElementById("object-info-panel");
    if (infoPanel) infoPanel.style.display = "none";
    currentAIObject = null;
    displayRA = null;
    displayDEC = null;
    if (SearchManager.initialized) SearchManager.updateFavoriteButton();
    return;
  }

  currentAIObject = obj;
  displayRA = null;
  displayDEC = null;
  const cleanName = String(obj?.name || "").toLowerCase();

  // 🔥 NAME
  document.getElementById("info-name").innerText = (obj.displayName || obj.name || "").toUpperCase();

  // 🔥 UPDATE FAVORITE BUTTON STATE
  if (SearchManager.initialized) SearchManager.updateFavoriteButton();

  // 🧭 SYNC NAV BUTTONS
  _syncNavButtons();

  // 🔥 TYPE
  let displayType = obj.type;
  if (obj.type === "spacecraft") displayType = "Spacecraft (" + (obj.category || obj.spData?.category || "Mission") + ")";
  else if (obj.type === "dso") displayType = "Deep Sky Object";
  else if (obj.type === "star") displayType = "Star";
  else if (obj.type === "planet") displayType = "Planet";
  else if (obj.type === "comet") displayType = "Comet";
  else if (obj.type === "asterism") displayType = "Asterism Pattern";
  else if (obj.type === "asteroid") {
    const rawClass = obj.orbitClass || obj.asteroidData?.orbitClass || "Main Belt";
    if (cleanName.includes("ceres")) {
      displayType = "Dwarf Planet (Asteroid Belt)";
    } else if (cleanName.includes("vesta")) {
      displayType = "Asteroid (Main Belt)";
    } else if (cleanName.includes("pallas")) {
      displayType = "Asteroid (Main Belt)";
    } else if (cleanName.includes("bennu")) {
      displayType = "Near-Earth Asteroid (Apollo)";
    } else if (cleanName.includes("ryugu")) {
      displayType = "Near-Earth Asteroid (Apollo)";
    } else if (cleanName.includes("apophis")) {
      displayType = "Near-Earth Asteroid (Aten)";
    } else if (cleanName.includes("didymos")) {
      displayType = "Near-Earth Asteroid (Apollo)";
    } else if (rawClass.toLowerCase().includes("apollo") || rawClass.toLowerCase().includes("aten") || rawClass.toLowerCase().includes("amor") || rawClass.toLowerCase().includes("near-earth")) {
      const subGroup = rawClass.includes("Aten") ? "Aten" : (rawClass.includes("Amor") ? "Amor" : "Apollo");
      displayType = `Near-Earth Asteroid (${subGroup})`;
    } else {
      displayType = `Asteroid (${rawClass})`;
    }
  }
  document.getElementById("info-type").innerText = "Type: " + displayType;

  // 🔥 RA/DEC (NOW HANDLED BY updateDynamicInfo())
  document.getElementById("info-ra").innerText = "";
  document.getElementById("info-dec").innerText = "";

  // 🔥 MAGNITUDE / STATUS
  if (obj.type === "spacecraft") {
    const sp = obj.spData || obj;
    document.getElementById("info-mag").innerText = "Status: " + (sp.status || "Active") + " | Launch: " + (sp.launchDate || "N/A");
    document.getElementById("info-constellation").innerText = "Destination: " + (sp.destination || "N/A");
    document.getElementById("info-size").innerText = "Vehicle: " + (sp.launchVehicle || "N/A");
    document.getElementById("info-morph").innerText = "Agency: " + (sp.primaryAgency || "N/A") + " | Operator: " + (sp.operator || "N/A");
    document.getElementById("info-temp").innerText = "Mass: " + (sp.spacecraft?.massKg ? sp.spacecraft.massKg + " kg" : "N/A");
  } else {
    const magVal = obj.magnitude !== undefined ? obj.magnitude : (obj.mag !== undefined ? obj.mag : "N/A");
    document.getElementById("info-mag").innerText = "Magnitude: " + magVal;

    // 🔥 CONSTELLATION
    document.getElementById("info-constellation").innerText = "Constellation: " + (obj.constellation || "N/A");

    // 🔥 SIZE
    document.getElementById("info-size").innerText = "Size: " + (obj.size || "N/A");

    // 🔥 STRUCTURE / MORPHOLOGY / ORBITAL PERIOD
    let structure = obj.morph || "N/A";
    if (obj.type === "comet" || obj.type === "asteroid") {
      structure = "Period: " + (obj.period || obj.cometData?.period || obj.asteroidData?.orbitalPeriod || "N/A");
    } else {
      const morphMap = {
        "SA(s)b": "Spiral Galaxy",
        "SA(s)cd": "Spiral Galaxy",
        "SA(s)c": "Spiral Galaxy",
        "SA(s)a": "Spiral Galaxy",
        "SBa": "Barred Spiral Galaxy",
        "SBb": "Barred Spiral Galaxy",
        "SBc": "Barred Spiral Galaxy",
        "SB(s)m": "Barred Spiral Galaxy",
        "SB(s)c": "Barred Spiral Galaxy",
        "SB(s)b": "Barred Spiral Galaxy",
        "SB(rs)b": "Barred Spiral Galaxy",
        "SAB": "Intermediate Spiral Galaxy",
        "E0": "Elliptical Galaxy",
        "E1": "Elliptical Galaxy",
        "E2": "Elliptical Galaxy",
        "E3": "Elliptical Galaxy",
        "E4": "Elliptical Galaxy",
        "E5": "Elliptical Galaxy",
        "E6": "Elliptical Galaxy",
        "E7": "Elliptical Galaxy",
        "Irr": "Irregular Galaxy",
        "dIrr": "Dwarf Irregular Galaxy",
        "I2m": "Open Star Cluster",
        "II2r": "Open Star Cluster",
        "III2p": "Open Star Cluster",
        "III1m": "Open Star Cluster",
        "III": "Globular Cluster",
        "IV": "Globular Cluster",
        "V": "Globular Cluster",
        "HII": "Emission Nebula",
        "SNR": "Supernova Remnant"
      };
      if (morphMap[structure]) {
        structure = morphMap[structure];
      }
    }
    document.getElementById("info-morph").innerText = (obj.type === "comet" || obj.type === "asteroid") ? structure : ("Structure: " + structure);

    // 🔥 TEMPERATURE / NEXT PERIHELION / SPECTRAL TYPE & DIAMETER
    let temperature = "N/A";
    if (obj.type === "comet") {
      temperature = "Next Perihelion: " + (obj.nextPerihelion || obj.cometData?.nextPerihelion || "N/A");
    } else if (obj.type === "asteroid") {
      const diamStr = obj.diameter !== undefined ? (typeof obj.diameter === "number" ? obj.diameter + " km" : obj.diameter) : "N/A";
      const specStr = obj.spectralType || "N/A";
      temperature = `Dia: ${diamStr} | Type: ${specStr}`;
    } else {
      const planetTemps = {
        mercury: "440K",
        venus: "737K",
        earth: "288K",
        mars: "210K",
        jupiter: "165K",
        saturn: "134K",
        uranus: "76K",
        neptune: "72K",
        pluto: "44K",
        moon: "220K",
        sun: "5778K"
      };
      if (obj.type === "planet") {
        temperature = planetTemps[obj.name.toLowerCase()] || "N/A";
      } else if (obj.type === "star") {
        const bv = parseFloat(obj.bv);
        if (!isNaN(bv)) {
          temperature = Math.round(4600 * ((1 / ((0.92 * bv) + 1.7)) + (1 / ((0.92 * bv) + 0.62)))) + "K";
        }
      }
    }
    document.getElementById("info-temp").innerText = (obj.type === "comet" || obj.type === "asteroid") ? temperature : ("Temperature: " + temperature);
  }

  // 🔥 STATIC FACTS / SHORT DESCRIPTION
  const lookupKey = obj.name.toLowerCase().replace(/\s+/g, "");
  const fact = objectFacts[lookupKey];
  let descText = "";
  if (obj.type === "spacecraft") {
    const sp = obj.spData || obj;
    const desc = sp.description || "Historical spacecraft mission in the Astro Explorer database.";
    const btnHtml = `<button id="view-spacecraft-dossier" style="margin-top:10px; width:100%; padding:8px 12px; background:linear-gradient(135deg, rgba(0,245,255,0.25), rgba(0,100,255,0.35)); border:1px solid #00f5ff; border-radius:6px; color:#fff; font-weight:bold; cursor:pointer; font-size:12px; transition:all 0.2s; display:flex; align-items:center; justify-content:center; gap:6px;" onclick="openSpacecraftModal(selectedObject.spData || selectedObject)"><img src="assets/icons/spacecraft.svg" alt="spacecraft" style="width:18px; height:18px;"> View Full Mission Dossier</button>`;
    const infoDescription = document.getElementById("info-description");
    if (infoDescription) {
      infoDescription.innerHTML = `<div style="font-size:12px; line-height:1.4;">${desc}</div>${btnHtml}`;
    }
    return;
  }
  if (fact && fact.desc) {
    descText = fact.desc;
  } else if (obj.description || obj.cometData?.description || obj.asteroidData?.description) {
    const baseDesc = obj.description || obj.asteroidData?.description || obj.cometData?.description;
    if (obj.type === "asteroid") {
      const numStr = obj.number || obj.asteroidData?.number || "";
      const desigStr = obj.designation || obj.asteroidData?.designation || "";
      const discStr = obj.discoveredBy ? `Discovered by ${obj.discoveredBy} (${obj.discoveryDate || ""}).` : "";
      descText = `[Asteroid #${numStr} | Desig: ${desigStr}] ${baseDesc} ${discStr}`.trim();
    } else {
      descText = baseDesc;
    }
  } else {
    if (obj.type === "star") {
      descText = `A star cataloged in the stellar database. Located in the constellation of ${obj.constellation || "N/A"}.`;
    } else if (obj.type === "dso") {
      descText = `A deep-sky object (galaxy, nebula, or star cluster) cataloged in the deep space database. Located in the constellation of ${obj.constellation || "N/A"}.`;
    } else if (obj.type === "comet") {
      descText = `A comet moving on a Keplerian orbit through the Solar System.`;
    } else if (obj.type === "asteroid") {
      descText = `An asteroid moving on a Keplerian orbit through the Solar System.`;
    } else {
      descText = `A celestial object in the sky map database.`;
    }
  }
  const infoDescription = document.getElementById("info-description");
  if (infoDescription) {
    infoDescription.innerText = descText;
  }
}

function getVisibleSpaceObjects(objects, type) {

  if (!SMART_MODE) return objects;

  const zoom = currentZoom || 1;

  let limit = SMART_LABEL_LIMIT;

  if (zoom < 1.5) limit = 5;
  else if (zoom < 3) limit = 10;
  else limit = 20;

  const priority = obj => {

    const n = (obj.name || "").toLowerCase();

    // Highest priority
    if (n.includes("iss")) return 1000;
    if (n.includes("tiangong")) return 950;
    if (n.includes("hubble")) return 900;
    if (n.includes("jwst")) return 900;
    if (n.includes("voyager")) return 850;
    if (n.includes("parker")) return 840;

    // Lowest priority
    if (n.includes("starlink")) return 100;
    if (n.includes("oneweb")) return 90;
    if (n.includes("kuiper")) return 80;

    // Default
    return 500;
  };

  return [...objects]
    .sort((a, b) => priority(b) - priority(a))
    .slice(0, limit);

}

function updateDynamicInfo() {
  if (!selectedObject) return;

  let ra = selectedObject.ra;
  let dec = selectedObject.dec;

  // 🚀 SPACECRAFT
  if (selectedObject.type === "spacecraft") {
    const pos = getSpacecraftPosition(selectedObject, skyTime);
    if (pos) {
      ra = pos[0];
      dec = pos[1];
      selectedObject.ra = ra;
      selectedObject.dec = dec;
      if (!currentTarget) {
        currentTarget = [ra, dec];
      } else {
        currentTarget[0] = ra;
        currentTarget[1] = dec;
      }
    }
  }
  // 🪐 PLANETS
  else if (selectedObject.type === "planet") {
    const pos = getPlanetPosition(
      selectedObject.name,
      skyTime
    );

    if (!pos) return;

    // 🔥 REAL UPDATED VALUES
    ra = pos[0] * 15;
    dec = pos[1];


    // 🔥 UPDATE LIVE MARKER TARGET
    if (!currentTarget) {
      currentTarget = [ra, dec];
    }

    currentTarget[0] += (ra - currentTarget[0]) * 0.15;
    currentTarget[1] += (dec - currentTarget[1]) * 0.15;
  }

  // 🛰️ SATELLITES
  else if (selectedObject.type === "satellite" && typeof satellite !== "undefined") {
    const sat = selectedObject.satData || SATELLITES_DATA.find(s => s && ((s.name && s.name.toLowerCase().includes(selectedObject.id.toLowerCase())) || (s.OBJECT_NAME && s.OBJECT_NAME.toLowerCase().includes(selectedObject.id.toLowerCase())) || (s.NORAD_CAT_ID && String(s.NORAD_CAT_ID) === String(selectedObject.id))));
    if (sat) {
      try {
        const satrec = getSatRec(sat);
        if (satrec) {
          const posVel = satellite.propagate(satrec, skyTime);
          const posEci = posVel ? posVel.position : null;
          if (posEci) {
            const gmst = satellite.gstime(skyTime);
            const obsLat = observer ? observer.latitude : 0;
            const obsLon = observer ? observer.longitude : 0;
            const obsElev = observer ? (observer.elevation || 0) : 0;
            const observerGd = {
              longitude: obsLon * Math.PI / 180,
              latitude: obsLat * Math.PI / 180,
              height: obsElev / 1000
            };
            const lookAngles = satellite.ecfToLookAngles(observerGd, satellite.eciToEcf(posEci, gmst));
            const alt = (lookAngles.elevation ?? lookAngles.altitude ?? lookAngles.alt) * 180 / Math.PI;
            const az = (lookAngles.azimuth ?? lookAngles.az) * 180 / Math.PI;

            const coords = horizontalToEquatorial(alt, az, skyTime, observer);
            if (coords) {
              ra = coords[0];
              dec = coords[1];

              selectedObject.ra = ra;
              selectedObject.dec = dec;
              selectedObject.azimuth = az;
              selectedObject.altitude = alt;

              if (!currentTarget) {
                currentTarget = [ra, dec];
              } else {
                currentTarget[0] = ra;
                currentTarget[1] = dec;
              }
            }
          }
        }
      } catch (e) {
        console.error("Satellite dynamic info error:", e);
      }
    }
  }
  // ☄️ COMETS
  else if (selectedObject.type === "comet") {
    const term = (selectedObject.id || selectedObject.name || "").toLowerCase();
    const comet = selectedObject.cometData || COMETS_DATA.find(c =>
      (c.id && c.id.toLowerCase() === term) ||
      (c.name && c.name.toLowerCase().includes(term)) ||
      (c.displayName && c.displayName.toLowerCase().includes(term))
    );
    if (comet) {
      const pos = getCometPosition(comet, skyTime, observer);
      if (pos) {
        ra = pos[0] * 15;
        dec = pos[1];
        selectedObject.ra = ra;
        selectedObject.dec = dec;
        selectedObject.distanceAU = pos[2];
        selectedObject.altitude = pos[3];
        selectedObject.azimuth = pos[4];
        selectedObject.magnitude = pos[5];

        if (!currentTarget) {
          currentTarget = [ra, dec];
        } else {
          currentTarget[0] = ra;
          currentTarget[1] = dec;
        }
      }
    }
  }
  // 🪨 ASTEROIDS
  else if (selectedObject.type === "asteroid") {
    const term = (selectedObject.id || selectedObject.name || "").toLowerCase();
    const asteroid = selectedObject.asteroidData || ASTEROIDS_DATA.find(a =>
      (a.id && a.id.toLowerCase() === term) ||
      (a.name && a.name.toLowerCase().includes(term)) ||
      (a.displayName && a.displayName.toLowerCase().includes(term))
    );
    if (asteroid) {
      const pos = getAsteroidPosition(asteroid, skyTime, observer);
      if (pos) {
        ra = pos[0] * 15;
        dec = pos[1];
        selectedObject.ra = ra;
        selectedObject.dec = dec;
        selectedObject.distanceAU = pos[2];
        selectedObject.altitude = pos[3];
        selectedObject.azimuth = pos[4];
        selectedObject.magnitude = pos[5];

        if (!currentTarget) {
          currentTarget = [ra, dec];
        } else {
          currentTarget[0] = ra;
          currentTarget[1] = dec;
        }
      }
    }
  }

  // 🔥 NOW UPDATE PANEL COORDS
  if (displayRA === null) {
    displayRA = ra;
    displayDEC = dec;
  }

  displayRA += (ra - displayRA) * 0.15;
  displayDEC += (dec - displayDEC) * 0.15;

  document.getElementById("info-ra").innerText =
    "RA: " + formatRA(displayRA);

  document.getElementById("info-dec").innerText =
    "DEC: " + formatDEC(displayDEC);
  // 🌍 DISTANCE CALCULATION
  let distanceText = "N/A";
  if (selectedObject.type === "planet") {
    const pos = getPlanetPosition(selectedObject.name, skyTime);
    if (pos && pos[2] !== undefined) {
      const au = pos[2];
      if (selectedObject.name.toLowerCase() === "earth") {
        distanceText = "0.00 AU (Observer)";
      } else {
        distanceText = `${au.toFixed(4)} AU (~${(au * 149.59787).toFixed(1)} Million km)`;
      }
    }
  } else if ((selectedObject.type === "comet" || selectedObject.type === "asteroid") && selectedObject.distanceAU !== undefined) {
    const au = selectedObject.distanceAU;
    distanceText = `${au.toFixed(4)} AU (~${(au * 149.59787).toFixed(1)} Million km)`;
  } else {
    const lookupKey = selectedObject.name.toLowerCase().replace(/\s+/g, "");
    const fact = objectFacts[lookupKey];
    if (fact && fact.dist) {
      distanceText = fact.dist;
    }
  }
  const distEl = document.getElementById("info-distance");
  if (distEl) distEl.innerText = "Distance: " + distanceText;

  // 🌍 OBSERVER RISE / SET / TRANSIT
  let riseText = "N/A";
  let setText = "N/A";
  let transitText = "N/A";

  try {
    const bodyMap = {
      sun: Astronomy.Body.Sun,
      moon: Astronomy.Body.Moon,
      mercury: Astronomy.Body.Mercury,
      venus: Astronomy.Body.Venus,
      mars: Astronomy.Body.Mars,
      jupiter: Astronomy.Body.Jupiter,
      saturn: Astronomy.Body.Saturn,
      uranus: Astronomy.Body.Uranus,
      neptune: Astronomy.Body.Neptune,
      pluto: Astronomy.Body.Pluto
    };

    const body = bodyMap[selectedObject.name.toLowerCase()];

    if (body) {
      const astroTime = Astronomy.MakeTime(skyTime);
      const rise = Astronomy.SearchRiseSet(body, observer, +1, astroTime, 2);
      const set = Astronomy.SearchRiseSet(body, observer, -1, astroTime, 2);
      if (rise) riseText = formatTime(rise.date ? rise.date : rise);
      if (set) setText = formatTime(set.date ? set.date : set);

      const pos = getPlanetPosition(selectedObject.name, skyTime);
      if (pos) {
        transitText = getTransitTime(pos[0], skyTime, observer);
      }
    } else {
      const result = getFixedObjectRiseSetTransit(selectedObject.ra / 15, selectedObject.dec, skyTime, observer);
      riseText = result.rise;
      setText = result.set;
      transitText = result.transit;
    }
  } catch (err) {
    console.log("Rise/Set error:", err);
  }

  // 🔥 HORIZON ALTITUDE / AZIMUTH
  try {
    let altVal = null;
    let azVal = null;

    if (selectedObject.type === "satellite" && selectedObject.altitude !== undefined && selectedObject.azimuth !== undefined) {
      altVal = selectedObject.altitude;
      azVal = selectedObject.azimuth;
    } else if (ra !== undefined && ra !== null && dec !== undefined && dec !== null && Number.isFinite(ra) && Number.isFinite(dec)) {
      const hor = Astronomy.Horizon(
        skyTime,
        observer,
        ra / 15,
        dec,
        Astronomy.Refraction.Normal
      );
      if (hor) {
        altVal = hor.altitude;
        azVal = hor.azimuth;
      }
    }

    if (altVal !== null && azVal !== null && Number.isFinite(altVal) && Number.isFinite(azVal)) {
      let facing = "";
      const az = azVal;
      currentAzimuth = azVal;

      if (az >= 337.5 || az < 22.5) facing = "N";
      else if (az < 67.5) facing = "NE";
      else if (az < 112.5) facing = "E";
      else if (az < 157.5) facing = "SE";
      else if (az < 202.5) facing = "S";
      else if (az < 247.5) facing = "SW";
      else if (az < 292.5) facing = "W";
      else facing = "NW";

      const navDir = document.getElementById("nav-direction");
      if (navDir) navDir.innerText = facing;
      const altEl = document.getElementById("info-alt");
      if (altEl) altEl.innerText = "Altitude: " + altVal.toFixed(2) + "°";
      const azEl = document.getElementById("info-az");
      if (azEl) azEl.innerText = "Azimuth: " + azVal.toFixed(2) + "°";
    }
  } catch (err) {
    console.log("Horizon error:", err);
  }

  const riseEl = document.getElementById("info-rise");
  if (riseEl) riseEl.innerText = "Rise: " + riseText;
  const setEl = document.getElementById("info-set");
  if (setEl) setEl.innerText = "Set: " + setText;
  const transitEl = document.getElementById("info-transit");
  if (transitEl) transitEl.innerText = "Transit: " + transitText;
  if (marker && currentTarget) {
    const pt = Celestial.mapProjection(currentTarget);

    if (pt) {
      marker.style.left = pt[0] + "px";
      marker.style.top = pt[1] + "px";
    }
  }

  updateObservationAssistant();
  hideEmptyFields();
}

function formatTime(date) {

  return date.toLocaleTimeString(
    [],
    {
      hour: "2-digit",
      minute: "2-digit"
    }
  );
}
let objectTrailHistory = [];
let lastTrailTarget = null;
let displayRA = null;
let displayDEC = null;

let lastDynamicFrameTime = null;
function dynamicInfoLoop(timestamp) {
  if (typeof timestamp !== "number") timestamp = performance.now();
  if (lastDynamicFrameTime === null) lastDynamicFrameTime = timestamp;
  let deltaTime = timestamp - lastDynamicFrameTime;
  lastDynamicFrameTime = timestamp;
  if (deltaTime > 500) deltaTime = 500;

  const skyTab = document.getElementById("sky");

  if (skyTab && skyTab.style.display === "none") {
    requestAnimationFrame(dynamicInfoLoop);
    return;
  }

  // 🔥 ADVANCE SIMULATION TIME (respects speed + pause)
  if (!simPaused) {
    skyTime = new Date(skyTime.getTime() + (deltaTime * simSpeed));

    // Record trail history for selected object
    if (skySettings.showObjectTrails && selectedObject) {
      const targetName = selectedObject.name;
      if (lastTrailTarget !== targetName) {
        objectTrailHistory = [];
        lastTrailTarget = targetName;
      }
      const coords = _getNavTarget();
      if (coords) {
        const lastPt = objectTrailHistory[objectTrailHistory.length - 1];
        if (!lastPt || Math.abs(skyTime - lastPt.time) >= 1000) {
          objectTrailHistory.push({ ra: coords[0], dec: coords[1], time: new Date(skyTime) });
          if (objectTrailHistory.length > 150) {
            objectTrailHistory.shift();
          }
        }
      }
    } else {
      objectTrailHistory = [];
    }
  }

  // 🕐 Update live time display and map projection
  _updateSimTimeUI();

  updateDynamicInfo();







  requestAnimationFrame(dynamicInfoLoop);
}

function updateLastTopic(userInput) {
  lastTopic = userInput;
}

function renderAttachments() {

  const container =
    document.getElementById(
      "attachment-preview"
    );

  container.innerHTML = "";

  attachments.forEach((file, index) => {

    const chip =
      document.createElement("div");

    chip.className =
      "attachment-chip";

    if (file.type === "image") {

      chip.innerHTML = `

<div class="attachment-image">

<img
src="${file.data}"
>

<span
class="remove-attachment"
data-index="${index}"
>

✖

</span>

</div>

`;

    }

    else {

      chip.innerHTML = `

<div class="attachment-file">

📄 ${file.name}

<span
class="remove-attachment"
data-index="${index}"
>

✖

</span>

</div>

`;

    }

    container.appendChild(chip);

  });

  document
    .querySelectorAll(".remove-attachment")
    .forEach(btn => {

      btn.onclick = () => {

        attachments.splice(

          btn.dataset.index,

          1

        );

        renderAttachments();

      };

    });

}

/* ==========================================================================
   ASTRO AI CONTEXT ENGINE (Centralized Application State & Prompt Compiler)
   ========================================================================== */

const AstroContextEngine = {
  _cache: {
    lastQuery: "",
    lastTimestamp: 0,
    cachedContext: null
  },

  // 1. COLLECT & PRIORITIZE APPLICATION CONTEXT
  collectContext(userQuery = "", options = {}) {
    const now = Date.now();
    const query = (userQuery || "").trim();

    if (this._cache.cachedContext && this._cache.lastQuery === query && (now - this._cache.lastTimestamp < 2000)) {
      return this._cache.cachedContext;
    }

    const qLower = query.toLowerCase();

    // Priority Flags & Smart Token Optimization
    const isGeneralQuery = !query || query.length < 5;
    const mentionsEquipment = /telescope|eyepiece|aperture|focal|camera|sensor|magnification|barlow|fov|mount|filter|binning/i.test(qLower);
    const mentionsObject = /planet|star|galaxy|nebula|cluster|messier|ngc|moon|sun|mars|jupiter|saturn|m31|m42|m57|orion|andromeda/i.test(qLower) || !!currentAIObject;
    const mentionsSky = /sky|tonight|bortle|seeing|altitude|azimuth|horizon|weather|moon|twilight|constellation|visible|rise|set/i.test(qLower);
    const mentionsAstrophotography = /photo|image|exposure|fwhm|trailing|stack|camera|iso|gain|vignette|flat|dark|bias|plate/i.test(qLower);
    const hasImageAttachment = typeof attachments !== "undefined" && attachments.some(a => a.type === "image");
    const hasObsAttachment = typeof attachedObservationContext !== "undefined" && !!attachedObservationContext?.text;
    const isResearchActive = typeof researchMode !== "undefined" && !!researchMode;

    const sourcesIncluded = [];
    const sourcesSkipped = [];
    const contextBlocks = {};

    // PRIORITY 1 & 2: Explicit Attachments
    if (hasObsAttachment) {
      contextBlocks.attachedContext = `Attached Observation Log:\n${attachedObservationContext.text}`;
      sourcesIncluded.push("Attached Observation");
    } else {
      sourcesSkipped.push("Attached Observation");
    }

    if (typeof attachments !== "undefined" && attachments.length > 0) {
      const attDesc = attachments.map(a => `- ${a.name || a.type} (${a.type})`).join("\n");
      contextBlocks.attachmentList = `Active Attachments:\n${attDesc}`;
      sourcesIncluded.push("File Attachments");
    }

    // PRIORITY 3: Real-Time Sky Context
    const skyData = this.getRealTimeSkyState();
    if (mentionsSky || mentionsObject || isGeneralQuery) {
      contextBlocks.realTimeSky = `Real-Time Sky & Environment:
- UTC: ${skyData.utcTime} | Local Time: ${skyData.localTime}
- Location: Lat ${skyData.lat}°, Lon ${skyData.lon}° | Elevation: ${skyData.elevation}m | Timezone: ${skyData.timezone}
- Light Pollution: Bortle ${skyData.bortleScale} | Local Sidereal Time: ${skyData.lst}
- Moon State: ${skyData.moonPhase} (${skyData.moonIllum}% illum), Alt ${skyData.moonAlt}°
- Zenith Constellation: ${skyData.zenithConstellation} | Hemisphere: ${skyData.hemisphere}
- Sky Scale: ${skyData.fovScale}° FOV`;
      sourcesIncluded.push("Real-Time Sky");
    } else {
      sourcesSkipped.push("Real-Time Sky (Optimized)");
    }

    // PRIORITY 4: Active Celestial Object Context
    if (currentAIObject && (mentionsObject || isGeneralQuery || !query)) {
      const obj = currentAIObject;
      contextBlocks.activeObject = `Selected Celestial Object:
- Name: ${obj.name || "Unknown"} (Catalog: ${obj.catalog || obj.id || "N/A"})
- Type: ${obj.type || "Unknown"} | Constellation: ${obj.constellation || "Unknown"}
- Coords: RA ${obj.ra || "N/A"}, Dec ${obj.dec || "N/A"} | Position: Alt ${obj.alt !== undefined ? obj.alt + "°" : "N/A"}, Az ${obj.az !== undefined ? obj.az + "°" : "N/A"}
- Physical: Visual Mag ${obj.magnitude || obj.mag || "N/A"}, Size ${obj.size || "N/A"}, Distance ${obj.distance || "N/A"}
- Visibility: ${obj.visibility || (obj.alt > 0 ? "Above Horizon" : "Below Horizon")}`;
      sourcesIncluded.push("Active Celestial Object");
    } else if (currentAIObject) {
      sourcesSkipped.push("Active Object (Optimized)");
    } else {
      sourcesSkipped.push("Active Object (None)");
    }

    // PRIORITY 5: Telescope & Camera / Optical Setup
    if (mentionsEquipment || mentionsAstrophotography || isGeneralQuery) {
      const scopeData = this.getTelescopeSetupState();
      contextBlocks.telescopeCamera = `Telescope & Optical Setup:
- Selected Scope: ${scopeData.telescopeName} (Aperture: ${scopeData.aperture}mm, FL: ${scopeData.focalLength}mm, f/${scopeData.focalRatio})
- Eyepiece / Magnification: ${scopeData.eyepieceName} | Mag: ${scopeData.magnification}x | True FOV: ${scopeData.tfov}°
- Camera: ${scopeData.cameraName} (Sensor: ${scopeData.sensorSize}, Pixel: ${scopeData.pixelSize}µm)
- Image Scale: ${scopeData.imageScale} arcsec/px | Binning: ${scopeData.binning}`;
      sourcesIncluded.push("Telescope & Camera Specs");
    } else {
      sourcesSkipped.push("Telescope Specs (Optimized)");
    }

    // PRIORITY 6: FOV Simulation Context
    if (typeof TelescopeManager !== "undefined" && TelescopeManager.fovActive && (mentionsEquipment || mentionsAstrophotography)) {
      contextBlocks.fovSimulation = `FOV Simulator Framing State:
- Simulator Active: Yes
- Frame Rotation: ${TelescopeManager.rotation || 0}°
- Active TFOV: ${TelescopeManager.currentTFOV || "N/A"}°
- Sensor Orientation: ${TelescopeManager.sensorOrientation || "Landscape"}`;
      sourcesIncluded.push("FOV Simulator State");
    } else {
      sourcesSkipped.push("FOV Simulator (Inactive/Optimized)");
    }

    // PRIORITY 7: Active Observation Session Context
    const latestObs = this.getLatestObservationState();
    if (latestObs && (qLower.includes("observation") || qLower.includes("session") || qLower.includes("log"))) {
      contextBlocks.observationSession = `Active Observation Session:
- Title: ${latestObs.title}
- Target: ${latestObs.object} | Date: ${latestObs.date}
- Equipment: ${latestObs.telescope || "N/A"} | Location: ${latestObs.location || "N/A"}
- Notes: ${latestObs.notes || "None"}`;
      sourcesIncluded.push("Observation Session Log");
    } else {
      sourcesSkipped.push("Observation Session (Not requested)");
    }

    // PRIORITY 8: AI Memory Filtering
    const relevantMemories = this.filterRelevantMemories(qLower);
    if (relevantMemories.length > 0) {
      contextBlocks.memory = `User Profile & Relevant Memories:\n${relevantMemories.map(m => `- ${m}`).join("\n")}`;
      sourcesIncluded.push(`AI Memory (${relevantMemories.length})`);
    } else {
      sourcesSkipped.push("AI Memory (No relevant items)");
    }

    // PRIORITY 9: Deep Research Mode
    if (isResearchActive) {
      contextBlocks.research = `🧠 DEEP RESEARCH MODE ACTIVE:
- Provide rigorous astronomical & astrophysical derivations.
- Include physical optics equations (Magnification M=Ft/Fe, True FOV TFOV=AFOV/M, Exit Pupil EP=D/M, Redshift z, Rayleigh/Dawes limits).
- Use canonical catalog designations (Messier, NGC, IC, Caldwell, Bayer/Flamsteed).
- State scientific confidence levels and explicitly label consensus vs hypotheses.`;
      sourcesIncluded.push("Deep Research Mode Rules");
    } else {
      sourcesSkipped.push("Deep Research Mode (Disabled)");
    }

    // PRIORITY 10: Vision Context
    if (hasImageAttachment) {
      contextBlocks.vision = `📷 ASTROPHOTOGRAPHY VISION ANALYSIS ACTIVE:
- Perform optical & astronomical evaluation of uploaded image.
- Assess star focus (FWHM), trailing, noise, background gradients, and vignetting.
- Provide plate-solving target identification and capture improvement advice.`;
      sourcesIncluded.push("Astrophotography Vision Guidance");
    } else {
      sourcesSkipped.push("Vision Analysis (No images)");
    }

    // COMPILE ORDERED STACK
    const stackParts = [];
    if (contextBlocks.memory) stackParts.push(contextBlocks.memory);
    if (contextBlocks.realTimeSky) stackParts.push(contextBlocks.realTimeSky);
    if (contextBlocks.observationSession) stackParts.push(contextBlocks.observationSession);
    if (contextBlocks.attachedContext) stackParts.push(contextBlocks.attachedContext);
    if (contextBlocks.attachmentList) stackParts.push(contextBlocks.attachmentList);
    if (contextBlocks.activeObject) stackParts.push(contextBlocks.activeObject);
    if (contextBlocks.telescopeCamera) stackParts.push(contextBlocks.telescopeCamera);
    if (contextBlocks.fovSimulation) stackParts.push(contextBlocks.fovSimulation);
    if (contextBlocks.vision) stackParts.push(contextBlocks.vision);
    if (contextBlocks.research) stackParts.push(contextBlocks.research);

    const compiledContextString = stackParts.join("\n\n");
    const finalCombinedPrompt = compiledContextString
      ? `${compiledContextString}\n\n[USER REQUEST]\n${query}`
      : query;

    const totalCharLength = finalCombinedPrompt.length;
    const estimatedTokens = Math.ceil(totalCharLength / 4);

    const result = {
      userQuery: query,
      contextBlocks,
      compiledContextString,
      finalCombinedPrompt,
      debugInfo: {
        sourcesIncluded,
        sourcesSkipped,
        memoryCount: relevantMemories.length,
        estimatedTokens,
        totalCharLength,
        activeObjectName: currentAIObject?.name || "None",
        researchActive: isResearchActive,
        visionActive: hasImageAttachment
      }
    };

    this._cache = {
      lastQuery: query,
      lastTimestamp: now,
      cachedContext: result
    };

    this.updateDebugPanelUI(result);
    return result;
  },

  getRealTimeSkyState() {
    const now = new Date();
    const utcTime = now.toUTCString();
    const localTime = now.toLocaleString();

    let lat = 28.6139;
    let lon = 77.2090;
    let elevation = 216;

    if (typeof userLocation !== "undefined" && userLocation && userLocation.lat) {
      lat = userLocation.lat;
      lon = userLocation.lon;
    } else if (localStorage.getItem("astroUserLat")) {
      lat = parseFloat(localStorage.getItem("astroUserLat"));
      lon = parseFloat(localStorage.getItem("astroUserLon"));
    }

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const bortleScale = localStorage.getItem("bortleScale") || (typeof lightPollution !== "undefined" ? lightPollution : 4);

    const d = (now.getTime() / 86400000) - 10957.5;
    const lstVal = (18.697374558 + 24.06570982441908 * d + lon / 15) % 24;
    const lstHours = Math.floor((lstVal + 24) % 24);
    const lstMins = Math.floor((((lstVal + 24) % 24) - lstHours) * 60);
    const lstStr = `${String(lstHours).padStart(2, '0')}:${String(lstMins).padStart(2, '0')} LST`;

    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const c = Math.floor(365.25 * year) + Math.floor(year / 400) - Math.floor(year / 100);
    const moonAge = (c + day + (month * 30.6) + 0.5) % 29.53;
    const moonIllum = Math.round((1 - Math.cos((moonAge / 29.53) * 2 * Math.PI)) * 50);

    let moonPhaseName = "New Moon";
    if (moonAge > 1 && moonAge <= 6.5) moonPhaseName = "Waxing Crescent";
    else if (moonAge > 6.5 && moonAge <= 8.5) moonPhaseName = "First Quarter";
    else if (moonAge > 8.5 && moonAge <= 13.5) moonPhaseName = "Waxing Gibbous";
    else if (moonAge > 13.5 && moonAge <= 15.5) moonPhaseName = "Full Moon";
    else if (moonAge > 15.5 && moonAge <= 21.5) moonPhaseName = "Waning Gibbous";
    else if (moonAge > 21.5 && moonAge <= 23.5) moonPhaseName = "Third Quarter";
    else if (moonAge > 23.5 && moonAge <= 28.5) moonPhaseName = "Waning Crescent";

    const hemisphere = lat >= 0 ? "Northern" : "Southern";
    const zenithConst = lat > 40 ? "Cygnus / Ursa Major" : (lat < -20 ? "Crux / Centaurus" : "Orion / Pegasus");
    const fovScale = typeof Celestial !== "undefined" && Celestial.zoom ? (180 / Celestial.zoom()).toFixed(1) : "60.0";

    return {
      utcTime,
      localTime,
      lat: lat.toFixed(4),
      lon: lon.toFixed(4),
      elevation,
      timezone,
      bortleScale,
      lst: lstStr,
      moonPhase: moonPhaseName,
      moonIllum,
      moonAlt: (35).toFixed(0),
      zenithConstellation: zenithConst,
      hemisphere,
      fovScale
    };
  },

  getTelescopeSetupState() {
    let aperture = parseFloat(localStorage.getItem("astroAperture")) || 200;
    let focalLength = parseFloat(localStorage.getItem("astroFocalLength")) || 1000;
    let telescopeName = localStorage.getItem("astroTelescopeName") || "8\" Newton Reflector";
    let eyepieceName = localStorage.getItem("astroEyepieceName") || "25mm Plössl";
    let epFocal = parseFloat(localStorage.getItem("astroEyepieceFocal")) || 25;
    let epAFOV = parseFloat(localStorage.getItem("astroEyepieceAFOV")) || 52;
    let cameraName = localStorage.getItem("astroCameraName") || "CMOS Astro Camera";
    let pixelSize = parseFloat(localStorage.getItem("astroPixelSize")) || 3.76;
    let sensorSize = localStorage.getItem("astroSensorSize") || "23.5 x 15.7 mm (APS-C)";

    const focalRatio = (focalLength / (aperture || 1)).toFixed(1);
    const magnification = Math.round(focalLength / (epFocal || 1));
    const tfov = (epAFOV / (magnification || 1)).toFixed(2);
    const imageScale = ((206.265 * pixelSize) / (focalLength || 1)).toFixed(2);

    return {
      telescopeName,
      aperture,
      focalLength,
      focalRatio,
      eyepieceName,
      magnification,
      tfov,
      cameraName,
      sensorSize,
      pixelSize,
      imageScale,
      binning: "1x1"
    };
  },

  getLatestObservationState() {
    try {
      const obs = JSON.parse(localStorage.getItem("astroObservations") || "[]");
      return obs.length ? obs[0] : null;
    } catch (e) {
      return null;
    }
  },

  filterRelevantMemories(queryLower) {
    if (typeof astroMemory === "undefined" || !astroMemory?.memories?.length) return [];

    return astroMemory.memories
      .map(m => {
        if (m.key && m.value) return `${m.key}: ${m.value}`;
        return m.text || "";
      })
      .filter(text => {
        if (!text) return false;
        const tLower = text.toLowerCase();
        if (!queryLower || queryLower.length < 5) return true;
        return queryLower.split(" ").some(word => word.length > 3 && tLower.includes(word)) ||
          tLower.includes("telescope") || tLower.includes("bortle") || tLower.includes("camera") || tLower.includes("location");
      })
      .slice(0, 5);
  },

  updateDebugPanelUI(contextResult) {
    const modal = document.getElementById("context-debug-modal");
    if (!modal || modal.style.display === "none") return;

    const info = contextResult.debugInfo;

    const incContainer = document.getElementById("debug-sources-included");
    if (incContainer) {
      incContainer.innerHTML = info.sourcesIncluded.map(s => `<span class="context-debug-pill included">✓ ${s}</span>`).join("");
    }

    const skipContainer = document.getElementById("debug-sources-skipped");
    if (skipContainer) {
      skipContainer.innerHTML = info.sourcesSkipped.map(s => `<span class="context-debug-pill skipped">✗ ${s}</span>`).join("");
    }

    const tokenEl = document.getElementById("debug-token-count");
    if (tokenEl) tokenEl.textContent = `~${info.estimatedTokens} tokens (${info.totalCharLength} chars)`;

    const memEl = document.getElementById("debug-memory-count");
    if (memEl) memEl.textContent = `${info.memoryCount} active`;

    const objEl = document.getElementById("debug-active-object");
    if (objEl) objEl.textContent = info.activeObjectName;

    const resEl = document.getElementById("debug-research-status");
    if (resEl) resEl.textContent = info.researchActive ? "ON" : "OFF";

    const visEl = document.getElementById("debug-vision-status");
    if (visEl) visEl.textContent = info.visionActive ? "ON" : "OFF";

    const previewEl = document.getElementById("debug-prompt-preview");
    if (previewEl) previewEl.textContent = contextResult.finalCombinedPrompt;
  }
};

function createConversationContext(userInput) {

  return `
Previous Topic:
${lastTopic}

Current User Message:
${userInput}
`;
}


function buildAstroPrompt(userMessage, objectData) {
  let promptParts = [];

  // 1. Research Mode Prompt Expansion
  if (typeof researchMode !== "undefined" && researchMode) {
    promptParts.push(`🧠 DEEP RESEARCH MODE ACTIVE:
- Provide expert-level astronomical and astrophysical reasoning.
- State scientific confidence levels and clearly distinguish established consensus from speculative hypotheses.
- Include step-by-step physical derivations where relevant.
- Include exact physical & optical equations where applicable:
  • Magnification M = Ft / Fe
  • Exit Pupil EP = D / M
  • True Field of View TFOV = AFOV / M
  • Distance Modulus m - M = 5 * log10(d) - 5
  • Redshift z = (λ - λ0) / λ0
  • Rayleigh Limit θ = 1.22 * λ / D
  • Dawes Limit θ = 4.56 / D (inches)
- Utilize astronomical catalog designations: Messier (M), NGC, IC, Caldwell (C), Bayer/Flamsteed stellar designations.`);
  }

  // 2. Active Object Information
  if (objectData && objectData.name) {
    promptParts.push(`Selected Celestial Object:
Name: ${objectData.name || "Unknown"}
Type: ${objectData.type || "Unknown"}
Constellation: ${objectData.constellation || "Unknown"}
Magnitude: ${objectData.magnitude || "Unknown"}
Distance: ${objectData.distance || "Unknown"}
RA: ${objectData.ra || "Unknown"}
DEC: ${objectData.dec || "Unknown"}`);
  }

  // 3. Attached Observation Context
  if (typeof attachedObservationContext !== "undefined" && attachedObservationContext && attachedObservationContext.text) {
    promptParts.push(`Attached Observation Log:
${attachedObservationContext.text}`);
  }

  // 4. Astrophotography Vision Analysis Guidance (if images attached)
  if (typeof attachments !== "undefined" && attachments.some(a => a.type === "image")) {
    promptParts.push(`📷 Astrophotography Image Analysis Request:
- Identify the celestial target or field.
- Analyze star focus quality, approximate FWHM, star trailing/tracking errors.
- Evaluate background noise level, dynamic range, exposure quality (over/underexposed).
- Check for color balance, light pollution gradients, vignetting, satellite/meteor trails.
- Provide plate-solving suggestions and telescope/camera optical improvement tips.`);
  }

  promptParts.push(`User Question:\n${userMessage}`);

  return promptParts.join("\n\n");
}

document.addEventListener("DOMContentLoaded", async () => {
  initModelPickerEvents();




  const auth = window.auth;
  const provider = window.provider;
  const db = window.db;

  const doc = window.doc;
  const setDoc = window.setDoc;
  const getDoc = window.getDoc;
  const addDoc = window.addDoc;
  const getDocs = window.getDocs;
  const deleteDoc = window.deleteDoc;

  const signInWithPopup = window.signInWithPopup;
  const signOut = window.signOut;

  document
    .getElementById("save-api-key")
    .onclick = () => {

      const key =
        document
          .getElementById("user-api-key")
          .value
          .trim();

      localStorage.setItem(
        "OPENROUTER_API_KEY",
        key
      );

      hideAPIKeyModal();

      alert("API Key saved.");

    };

  document
    .getElementById("remove-api-key")
    .onclick = () => {

      localStorage.removeItem("OPENROUTER_API_KEY");

      document
        .getElementById("user-api-key")
        .value = "";

      alert("API Key removed.");

    };



  detectLocation();
  applyAppearanceSettings();
  applyAccentColor();
  applyAISettings();
  updateMemorySettings();
  renderMemoryList();
  applyAppearanceSettings();
  const dateInput = document.getElementById("date-picker");
  const loadBtn = document.getElementById("load-btn");
  const prevBtn = document.getElementById("prev-btn");
  const nextBtn = document.getElementById("next-btn");

  const downloadBtn = document.getElementById("download-btn");
  const filterBtn = document.getElementById("hazard-filter");
  const newestBtn = document.getElementById("newest-filter");
  const modal = document.getElementById("asteroid-modal");
  const modalBody = document.getElementById("modal-body");
  const modalContent = document.getElementById("modal-content");
  const searchInput = document.getElementById("search-input");
  const closeModalBtn = document.getElementById("close-modal");

  if (closeModalBtn && modal) {
    closeModalBtn.onclick = () => {
      modal.classList.remove("show");
    };
  }

  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.classList.remove("show");
    }
  });

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value.toLowerCase();
      loadNASA();
    });
  }

  if (newestBtn) {
    newestBtn.innerText = "🌍 Recently Approaching Asteroids";

    newestBtn.addEventListener("click", () => {
      showNewestOnly = !showNewestOnly;
      newestBtn.innerText = showNewestOnly
        ? "🌍 Recent Approaches ON"
        : "🌍 Recently Approaching Asteroids";
      loadNASA();
    });
  }

  if (filterBtn) {
    filterBtn.innerText = "⚠️ Show Hazardous Only";
    filterBtn.addEventListener("click", () => {
      showHazardOnly = !showHazardOnly;
      filterBtn.innerText = showHazardOnly ? "⚠️ Hazard ON" : "⚠️ Show Hazardous";
      loadNASA();
    });
  }

  if (downloadBtn) {
    downloadBtn.addEventListener("click", () => {
      if (!currentHDImage) {
        alert("No image ❌");
        return;
      }
      const link = document.createElement("a");
      link.href = currentHDImage;
      link.download = "nasa-image.jpg";
      link.click();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (!dateInput) return;
    if (document.activeElement === dateInput) return;

    if (e.key === "ArrowLeft") {
      let d = new Date(dateInput.value);
      d.setDate(d.getDate() - 1);
      dateInput.value = d.toISOString().split("T")[0];
      loadNASA();
    }

    if (e.key === "ArrowRight") {
      let d = new Date(dateInput.value);
      d.setDate(d.getDate() + 1);
      const today = new Date().toISOString().split("T")[0];
      if (d.toISOString().split("T")[0] > today) return;
      dateInput.value = d.toISOString().split("T")[0];
      loadNASA();
    }

    if (e.key === "Enter") loadNASA();
  });

  if (dateInput) {
    dateInput.value = new Date().toISOString().split("T")[0];
  }

  if (loadBtn) loadBtn.addEventListener("click", loadNASA);

  if (prevBtn) prevBtn.addEventListener("click", () => {
    let d = new Date(dateInput.value);
    d.setDate(d.getDate() - 1);
    dateInput.value = d.toISOString().split("T")[0];
    loadNASA();
  });

  if (nextBtn) prevBtn && nextBtn.addEventListener("click", () => {
    let d = new Date(dateInput.value);
    d.setDate(d.getDate() + 1);
    const today = new Date().toISOString().split("T")[0];
    if (d.toISOString().split("T")[0] > today) return;
    dateInput.value = d.toISOString().split("T")[0];
    loadNASA();
  });

  // 🔥 IMPORTANT
  if (typeof initNASAExplorer === "function") initNASAExplorer();
  loadNASA();

  if (!window.skyLoaded) {
    initSky();

    // ✅ delay yahin lagana hai (DIRECT CALL hata)
    loadObjects().then(() => {

      createAllPlanetLabels();

      createPlanetMarkers();

      requestAnimationFrame(globalSkyAnimationLoop);

      requestAnimationFrame(dynamicInfoLoop);

      window.skyLoaded = true;
    });
  }

  addAIMessage(
    "Hello. I am Astro AI. Ask me anything about space.",
    "Astro AI"
  );

  const input = document.getElementById("ai-input");

  input.addEventListener("input", () => {

    input.style.height = "auto";

    input.style.height = input.scrollHeight + "px";

  });



  document
    .getElementById("ai-send")
    .addEventListener("click", async () => {

      const input =
        document.getElementById("ai-input");

      const question =

        input.value.trim();
      // 🔥 REMEMBER COMMAND

      lastQuestion = question;

      // 🔥 REMEMBER COMMAND

      if (
        question.toLowerCase().startsWith("remember:") ||
        isMemoryRequest(question)
      ) {

        let memoryText = question;

        if (question.toLowerCase().startsWith("remember:")) {

          memoryText = question
            .replace(/remember:/i, "")
            .trim();

        }

        memoryText = extractMemory(memoryText);

        const structuredMemory =
          extractStructuredMemory(memoryText);

        saveMemory(structuredMemory);

        addAIMessage(
          "🧠 I've remembered that for future conversations.",
          "Astro AI"
        );

        return;
      }
      // 🔥 FORGET COMMAND

      // 🔥 FORGET COMMAND
      // 🔥 THEORY MEMORY

      if (
        question.toLowerCase().startsWith("remember theory:")
      ) {

        const text = question
          .replace(/remember theory:/i, "")
          .trim();

        saveTheory(text);

        addAIMessage(

          "Theory saved 😈🔥",

          "Astro AI"
        );

        return;
      }


      // 🔥 OBSERVATION LOG

      if (
        question.toLowerCase().startsWith("log observation:")
      ) {

        const text = question
          .replace(/log observation:/i, "")
          .trim();

        saveObservation(text);

        addAIMessage(

          "Observation logged 🔭😄🔥",

          "Astro AI"
        );

        return;
      }


      // 🔥 TELESCOPE SESSION

      if (
        question.toLowerCase().startsWith("start telescope session:")
      ) {

        const text = question
          .replace(/start telescope session:/i, "")
          .trim();

        saveTelescopeSession(text);

        addAIMessage(

          "Telescope session saved 🌌😮🔥",

          "Astro AI"
        );

        return;
      }

      // 🔥 RESEARCH MODE ON

      if (
        question.toLowerCase() ===
        "enable research mode"
      ) {

        researchMode = true;

        addAIMessage(

          "Research mode enabled 🧠😈🔥",

          "Astro AI"
        );

        return;
      }


      // 🔥 RESEARCH MODE OFF

      if (
        question.toLowerCase() ===
        "disable research mode"
      ) {

        researchMode = false;

        addAIMessage(

          "Research mode disabled 😄🔥",

          "Astro AI"
        );

        return;
      }
      // 🔥 OBSERVATION SUMMARY

      if (
        question.toLowerCase() ===
        "summarize my observations"
      ) {

        const observations =

          astroMemory.observations
            ?.map(o => "• " + o.text)
            .join("\n");

        addAIMessage(

          observations ||

          "No observations logged 😮🔥",

          "Astro AI"
        );

        return;
      }

      if (
        question.toLowerCase().startsWith("forget")
      ) {

        deleteMemory();

        addAIMessage(

          "All memories deleted 😮🔥",

          "Astro AI"
        );

        return;
      }

      if (!question) return;



      if (
        !isMemoryRequest(question) &&
        shouldSuggestMemory(question)
      ) {

        pendingMemory = question;

      }

      addAIMessage(
        question,
        "You"
      );
      saveMessage(
        "You",
        question
      );

      input.value = "";
      input.style.height = "auto";



      try {
        const uploadedAttachments = [...attachments];

        if (attachments.length > 0) {

          let attachmentHtml = "";

          attachments.forEach(file => {

            if (file.type === "image") {

              attachmentHtml += `
<img
src="${file.data}"
style="
max-width:180px;
border-radius:12px;
margin-top:8px;
">
`;

            } else {

              attachmentHtml += `
📄 ${file.name}<br>
`;

            }

          });

          addAIMessage(
            attachmentHtml,
            "You"
          );

          const uploadedAttachments = [...attachments];

          attachments = [];

          renderAttachments();


        }



        const loader =
          showThinkingLoader();

        const contextPrompt =
          createConversationContext(
            question
          );

        const relatedMemories =

          astroMemory.memories
            ?.map(memory => {

              if (memory.key && memory.value) {

                return `${memory.key}: ${memory.value}`;

              }

              return memory.text;

            })
            .join("\n") || "None";

        let userInterestProfile = "";

        if (
          relatedMemories
            .toLowerCase()
            .includes("black hole")
        ) {

          userInterestProfile +=

            `
User is highly interested in black holes.
Focus more deeply on relativistic physics.
`;
        }

        if (
          relatedMemories
            .toLowerCase()
            .includes("neutron")
        ) {

          userInterestProfile +=

            `
User is highly interested in neutron stars and compact objects.
`;
        }

        const objectPrompt =


          buildAstroPrompt(
            question,
            currentAIObject
          );

        let telescopeAdvice = "";

        if (
          currentAIObject
        ) {

          telescopeAdvice = `

Observation Assistance:

Suggest:
- telescope suitability
- eyepiece recommendations
- visibility conditions
- observation difficulty
- astrophotography potential
- best observing methods
- ideal observation timing
- atmospheric seeing considerations
- beginner observing advice
`;
        }


        // 🌌 KNOWLEDGE GRAPH REASONING
        let relatedConcepts = "";

        Object.keys(
          astroKnowledgeGraph
        ).forEach(key => {

          if (
            question
              .toLowerCase()
              .includes(key)
          ) {

            relatedConcepts +=

              `
${key} relates to:
${astroKnowledgeGraph[key]
                .join(", ")}
`;

          }
        });

        let proactiveInsights = "";

        if (
          question
            .toLowerCase()
            .includes("black hole")
        ) {

          proactiveInsights += `

Additional Insight:

You may also discuss:
- neutron stars
- Hawking radiation
- gravitational lensing
- spacetime curvature
`;
        }

        if (
          question
            .toLowerCase()
            .includes("galaxy")
        ) {

          proactiveInsights += `

Additional Insight:

You may also discuss:
- dark matter
- galaxy evolution
- supermassive black holes
- galactic collisions
`;
        }
        const advancedTopics = [

          "kerr",
          "relativity",
          "tensor",
          "metric",
          "quantum",
          "singularity",
          "hawking"
        ];

        const autoResearchMode =

          advancedTopics.some(topic =>

            question
              .toLowerCase()
              .includes(topic)
          );



        let attachmentPrompt = "";

        uploadedAttachments.forEach(file => {

          if (file.type === "file") {

            attachmentPrompt += `

File Name:
${file.name}

File Content:

${file.data.substring(0, 3000)}

`;

          }

        });
        const attachmentSummary = `

The user may upload BOTH text files and images.

You MUST analyze ALL uploaded content together.

If images are uploaded:
- Analyze every image individually.
- Compare images when appropriate.

If text files are uploaded:
- Read every file.
- Extract important information.

If BOTH images and files exist:
- Combine information from BOTH.
- Relate file contents to the uploaded images.
- Never ignore either one.
- Produce one combined report.

`;

        const finalPrompt = [
          attachmentSummary,
          userInterestProfile,
          contextPrompt,
          objectPrompt,
          telescopeAdvice,
          relatedConcepts,
          proactiveInsights,
          (researchMode || autoResearchMode)
            ? "Use advanced astrophysics, scientific terminology, equations, and deep theoretical explanations."
            : ""
        ].filter(Boolean).join("\n\n");


        const responseLength =
          (typeof AstroSettings !== "undefined" ? AstroSettings.get("responseLength") : null)
          || localStorage.getItem("responseLength")
          || "medium";

        const defaultAISettings = {
          responseLength: "medium",
          creativity: "balanced"
        };

        const creativity =
          (typeof AstroSettings !== "undefined" ? AstroSettings.get("creativity") : null)
          || localStorage.getItem("creativity")
          || "balanced";

        let creativityInstruction = "";

        switch (String(creativity).toLowerCase()) {

          case "precise":

            creativityInstruction = `
You are an expert astronomy scientist.

Always:
- Be concise and factual.
- Avoid storytelling.
- Avoid unnecessary analogies.
- Use precise scientific terminology.
- Focus on accuracy over style.
`;

            break;

          case "balanced":

            creativityInstruction = `
You are a friendly astronomy educator.

Always:
- Explain concepts clearly.
- Use simple language.
- Give examples when helpful.
- Keep the answer engaging.
- Maintain scientific accuracy.
`;

            break;

          case "creative":

            creativityInstruction = `
You are an inspiring astronomy educator like Carl Sagan or Neil deGrasse Tyson.

Instead of sounding like a textbook:

- Start with an engaging hook.
- Explain concepts through storytelling.
- Use vivid analogies.
- Create curiosity and wonder.
- Help the reader visualize space.
- Speak naturally as if talking to a curious person.
- Avoid sounding robotic.
- Avoid unnecessary headings unless the user requests them.
- Use memorable examples from space.
- End with an interesting fact or question whenever appropriate.

- Do not sound like a textbook.
- Write as if you are talking directly to the user.
- Use headings only when they genuinely improve readability.
- Begin with a surprising question or an imaginative scenario instead of a definition.

- Keep every scientific fact accurate.
`;

            break;

        }

        const hasAttachments = (uploadedAttachments && uploadedAttachments.length > 0);

        const attachmentMandate = hasAttachments ? `
ATTACHMENT MANDATE (CRITICAL):
- You MUST thoroughly analyze EVERY uploaded image and read EVERY uploaded file.
- You MUST correlate findings across all uploaded images and text files together.
- Response Length controls ONLY text explanation brevity, formatting, and word style. Response length MUST NEVER cause you to omit, skip, or ignore any uploaded attachment.
- In your response:
  1. Acknowledge EVERY uploaded file by name/type.
  2. Acknowledge EVERY uploaded image by name/type.
  3. State at least one key observation or finding for EACH uploaded image and file.
` : "";

        const maxResponsePref = String(responseLength).toLowerCase();
        let maxResponseCapDesc = "";
        if (maxResponsePref === "compact" || maxResponsePref === "short") {
          maxResponseCapDesc = "MAXIMUM RESPONSE PREFERENCE: COMPACT (Upper limit: keep even complex topics concise unless explicitly requested by user).";
        } else if (maxResponsePref === "unlimited" || maxResponsePref === "long" || maxResponsePref === "detailed") {
          maxResponseCapDesc = "MAXIMUM RESPONSE PREFERENCE: UNLIMITED (Upper limit: allow very detailed explanations when needed, but never be verbose for simple questions).";
        } else {
          maxResponseCapDesc = "MAXIMUM RESPONSE PREFERENCE: BALANCED (Upper limit: natural conversational length, expand only when useful).";
        }

        const responseInstruction = `
==================================================
ADAPTIVE RESPONSE ENGINE INSTRUCTIONS
==================================================
You are Astro AI operating with an Adaptive Response Engine. Do NOT use a fixed response length. Analyze every user message dynamically before writing.

STEP 1 — DETECT USER INTENT:
Classify user intent (Greeting, Casual Chat, Quick Question, Simple Fact, Definition, Comparison, Explanation, Tutorial, Troubleshooting, Observation Analysis, Astrophotography Analysis, Programming, Astronomy Research, Deep Scientific Research, Mathematical Derivation, Creative Writing, Brainstorming, Follow-up Question).

STEP 2 & 3 — ADAPTIVE COMPLEXITY & RESPONSE SIZING:
- Complexity 1 (Greetings, 'Hi', 'Hello', 'Thanks', 'Yes/No'): 1–2 sentences.
- Complexity 2 (Simple facts e.g. "What is Mars?"): 3–6 sentences concise answer.
- Complexity 3 (Moderate explanations/comparisons e.g. "Explain neutron stars"): 6–12 sentences.
- Complexity 4 (Advanced topics, tutorials e.g. "How does Webb detect exoplanets?"): Detailed structured explanation with sections.
- Complexity 5 (Expert research, mathematical derivations): Full research response.

STEP 4 — USER EXPLICIT REQUEST OVERRIDE:
If the user explicitly requests "explain in detail", "teach me", "research", or "long answer", generate a comprehensive response regardless of default length. If the user asks for "short answer", "one line", "briefly", "TL;DR", generate a concise response.

STEP 5 — MAXIMUM RESPONSE PREFERENCE:
${maxResponseCapDesc}
CRITICAL: Maximum Response Preference acts ONLY as an upper bound limit. It must NEVER force longer responses for simple queries.

STEP 6 — CREATIVITY & STYLE:
Creativity setting dictates writing style, NOT response length:
- Precise: Scientific, direct, minimal adjectives, professional.
- Balanced: Friendly, natural, conversational.
- Creative: Analogies, visual descriptions, storytelling, Carl Sagan inspired astronomy tone.

STEP 7 & 8 — CONTEXT AWARENESS & ANTI-VERBOSITY RULES:
- Never repeat existing context or restate the user's question.
- ABSOLUTELY NO FILLER WORDS (Never start with "Certainly!", "Of course!", "As an AI...", "I'd be happy to...").
- Skip unnecessary introductions and conclusions.

STEP 9 & 10 — SMART EXPANSION & FOLLOW-UPS:
- Simple questions remain concise; tutorials expand naturally.
- For follow-up questions ("Why?", "How?", "Tell me more"), expand directly from previous content without repeating past facts.

STEP 11 — ASTRONOMY SPECIALIZATION:
- Simple object identification -> Short.
- Observation advice -> Medium.
- Astrophotography troubleshooting -> Detailed step-by-step.
- Research mode -> Expert scientific response.

${attachmentMandate}
`;

        let selectedModel = getSelectedAIModel();
        const selectedProvider = getSelectedAIProvider();

        const isDirectOpenRouter = (selectedProvider === "openrouter" && !useCloud && localStorage.getItem("OPENROUTER_API_KEY"));

        const endpoint = isDirectOpenRouter
          ? "https://openrouter.ai/api/v1/chat/completions"
          : "https://astro-exp-seven.vercel.app/api/chat";

        const headers = isDirectOpenRouter
          ? {
            "Authorization": "Bearer " + localStorage.getItem("OPENROUTER_API_KEY"),
            "Content-Type": "application/json",
            "HTTP-Referer": location.origin,
            "X-Title": "Astro AI"
          }
          : {
            "Content-Type": "application/json"
          };

        let temperature = 0.8;

        switch (String(creativity).toLowerCase()) {
          case "precise":
            temperature = 0.2;
            break;

          case "balanced":
            temperature = 0.7;
            break;

          case "creative":
            temperature = 1.0;
            break;
        }

        selectedModel = getSelectedAIModel();

        const imageAttachments = uploadedAttachments.filter(f => f.type === "image");
        const hasImages = imageAttachments.length > 0;

        let modelCap = (typeof getModelCapability === "function")
          ? getModelCapability(selectedModel)
          : { image: selectedModel.includes("gemini") || selectedModel.includes("gpt-4o") };

        // Requirement 2: If image=false and an image is attached, switch to a compatible vision model
        if (hasImages && !modelCap.image) {
          const fallbackVisionModel = modelCap.fallbackModel || "google/gemini-3.6-flash";
          const origName = (typeof getModelDisplayName === "function") ? getModelDisplayName(selectedModel) : selectedModel;
          const fallbackName = (typeof getModelDisplayName === "function") ? getModelDisplayName(fallbackVisionModel) : fallbackVisionModel;

          if (typeof showToast === "function") {
            showToast(`📷 ${origName} is text-only. Switched to ${fallbackName} for vision.`);
          }

          selectedModel = fallbackVisionModel;
          const fallbackProvider = selectedModel.includes("gemini") ? "google_ai_studio" : "openrouter";

          AstroSettings.set("aiProvider", fallbackProvider);
          AstroSettings.set("aiModel", selectedModel);
          localStorage.setItem("aiProvider", fallbackProvider);
          localStorage.setItem("aiModel", selectedModel);

          if (typeof updateModelPickerButton === "function") {
            updateModelPickerButton();
          }

          modelCap = (typeof getModelCapability === "function") ? getModelCapability(selectedModel) : { image: true };
        }

        const isGPT5 = selectedModel === "openai/gpt-5";

        const contextResult = AstroContextEngine.collectContext(question);
        const finalUserPrompt = contextResult.finalCombinedPrompt;

        const DEFAULT_TOKEN_PROFILE = {
          compact: 1536,
          short: 1536,
          balanced: 3072,
          medium: 3072,
          unlimited: 8192,
          detailed: 8192,
          long: 8192
        };

        const MODEL_TOKEN_OVERRIDES = {};

        const profile = MODEL_TOKEN_OVERRIDES[selectedModel] || DEFAULT_TOKEN_PROFILE;

        let maxTokens = profile.balanced;

        switch (String(responseLength).toLowerCase()) {
          case "compact":
          case "short":
            maxTokens = profile.compact || 1536;
            break;

          case "unlimited":
          case "detailed":
          case "long":
            maxTokens = profile.unlimited || 8192;
            break;

          case "balanced":
          case "medium":
          default:
            maxTokens = profile.balanced || 3072;
            break;
        }

        const logSanitizer = (typeof sanitizeLogObject === "function") ? sanitizeLogObject : (obj => obj);

        console.log("🔍 [DEBUG] Sending AI Request:", logSanitizer({
          endpoint: endpoint,
          useCloud: useCloud,
          apiKey: localStorage.getItem("OPENROUTER_API_KEY") ? "Present" : "Missing",
          responseLengthSetting: (typeof AstroSettings !== "undefined" ? AstroSettings.get("responseLength") : null) || localStorage.getItem("responseLength"),
          creativitySetting: (typeof AstroSettings !== "undefined" ? AstroSettings.get("creativity") : null) || localStorage.getItem("creativity"),
          temperature: temperature,
          maxTokens: maxTokens,
          model: selectedModel,
          systemPrompt: creativityInstruction + "\n" + responseInstruction,
          userPrompt: finalUserPrompt
        }));

        const systemPromptText = isGPT5
          ? "You are Astro AI. Give a concise, direct answer. Do not include internal reasoning."
          : `${creativityInstruction}\n\n${responseInstruction}\n`;

        // Requirement 7 & 8: Text-only requests MUST ALWAYS send messages[].content as a plain string.
        // Multimodal content array is sent ONLY for models where modelCap.image is true and images are attached.
        const userContent = (hasImages && modelCap.image)
          ? [
            {
              type: "text",
              text: finalUserPrompt
            },
            ...(attachmentPrompt && String(attachmentPrompt).trim() !== "" ? [{
              type: "text",
              text: attachmentPrompt
            }] : []),
            ...imageAttachments.map(f => ({
              type: "image_url",
              image_url: {
                url: f.data
              }
            }))
          ]
          : (finalUserPrompt + (attachmentPrompt && String(attachmentPrompt).trim() !== "" ? "\n\n" + attachmentPrompt : ""));

        const requestBody = {
          model: selectedModel,
          messages: [
            {
              role: "system",
              content: systemPromptText
            },
            {
              role: "user",
              content: userContent
            }
          ],
          temperature
        };

        if (selectedProvider && selectedProvider !== "openrouter") {
          requestBody.provider = selectedProvider;
        }

        // Only add max_tokens if a model explicitly requires it (has an override)
        if (MODEL_TOKEN_OVERRIDES[selectedModel]) {
          requestBody.max_tokens = maxTokens;
        }

        console.log("🚀 [AI Request Dispatch] Final Model Slug:", selectedModel);
        console.log("FINAL REQUEST BODY:", logSanitizer(requestBody));

        const response = await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify(requestBody)
        });

        console.log("Status:", response.status);
        console.log("OK:", response.ok);

        const raw = await response.clone().text();
        console.log("RAW RESPONSE:");
        console.log(raw);

        const dataRaw = await response.json();
        let data = dataRaw;

        console.log("FULL GPT-5 RESPONSE:", data);

        let reply = "No response.";

        // 🔄 Free model unavailability / rate limit fallback handler
        if (data && data.error) {
          const errMsg = typeof data.error === "string"
            ? data.error
            : (data.error.message || JSON.stringify(data.error));

          const isUnavailableForFree = /unavailable for free|free model|no free endpoint|free tier|free limit/i.test(errMsg);

          if (isUnavailableForFree || selectedModel.endsWith(":free")) {
            // Mark original free model as quota_exceeded/unavailable
            if (typeof modelStatuses !== "undefined") {
              modelStatuses[selectedModel] = "quota_exceeded";
            }
            if (typeof renderModelPopup === "function") {
              renderModelPopup();
            }

            const failedName = getModelDisplayName(selectedModel);

            // Candidate free fallback models (do NOT use paid slug)
            const FREE_FALLBACK_CANDIDATES = [
              "deepseek/deepseek-r1:free",
              "deepseek/deepseek-v3.1:free",
              "openai/gpt-4o-mini"
            ];

            const fallbackModel = FREE_FALLBACK_CANDIDATES.find(
              m => m !== selectedModel && (typeof getModelStatus === "function" ? getModelStatus(m) : "available") === "available"
            ) || "openai/gpt-4o-mini";

            console.log(`⚠️ Free model ${selectedModel} is unavailable. Retrying once with free fallback model ${fallbackModel}...`);

            const fallbackRequestBody = {
              ...requestBody,
              model: fallbackModel
            };

            if (fallbackModel.includes("gemini")) {
              fallbackRequestBody.provider = "google_ai_studio";
            } else if (fallbackModel.includes("llama") || fallbackModel.includes("qwen") || fallbackModel.includes("gpt-oss")) {
              fallbackRequestBody.provider = "groq";
            } else {
              delete fallbackRequestBody.provider;
            }

            try {
              const retryResponse = await fetch(endpoint, {
                method: "POST",
                headers,
                body: JSON.stringify(fallbackRequestBody)
              });

              const retryData = await retryResponse.json();

              if (retryData && retryData.choices && retryData.choices.length > 0) {
                data = retryData;
                if (typeof showToast === "function") {
                  showToast(`The free version of ${failedName} is currently unavailable. Answered using ${getModelDisplayName(fallbackModel)}.`);
                }
              }
            } catch (retryErr) {
              console.error("Fallback retry fetch error:", retryErr);
            }
          } else if (/afford/i.test(errMsg)) {
            // Extract X from "You can only afford X completion tokens, but you requested Y"
            const match = errMsg.match(/afford\s+(\d+)/i) || errMsg.match(/(\d+)\s+(?:completion\s+)?tokens/i);
            const affordTokens = match ? parseInt(match[1], 10) : null;

            if (affordTokens !== null && (affordTokens <= 0 || affordTokens < 32)) {
              const currentProvName = (typeof AI_PROVIDERS !== "undefined" && AI_PROVIDERS[selectedProvider])
                ? AI_PROVIDERS[selectedProvider].name
                : (selectedProvider === "google_ai_studio" ? "Google AI Studio" : selectedProvider === "groq" ? "Groq" : "AI Provider");
              reply = `Your ${currentProvName} account does not have enough remaining credits/quota to generate a response. Please select another model or provider.`;
            } else {
              const retryMaxTokens = (affordTokens !== null && affordTokens >= 32)
                ? Math.max(128, affordTokens - 64)
                : 512;
              console.log(`⚠️ Silently retrying request once with max_tokens = ${retryMaxTokens}...`);

              const retryRequestBody = {
                ...requestBody,
                max_tokens: retryMaxTokens
              };

              try {
                const retryResponse = await fetch(endpoint, {
                  method: "POST",
                  headers,
                  body: JSON.stringify(retryRequestBody)
                });
                data = await retryResponse.json();
                console.log("RETRY RESPONSE:", data);
              } catch (retryErr) {
                console.error("Retry fetch error:", retryErr);
              }
            }
          }
        }

        if (data && data.error) {
          const httpStatus = response.status;
          reply = formatApiErrorResponse(httpStatus, data.error, selectedProvider);

          // Update model status tracking cleanly based on HTTP status
          if (httpStatus === 401) {
            modelStatuses[selectedModel] = "key_missing";
          } else if (httpStatus === 429) {
            modelStatuses[selectedModel] = "rate_limited";
          } else if (httpStatus === 402 || httpStatus === 400 || httpStatus === 404) {
            modelStatuses[selectedModel] = "quota_exceeded";
          }

          if (typeof renderModelPopup === "function") {
            renderModelPopup();
          }
        } else if (data && data.choices && data.choices.length > 0) {
          const choice = data.choices[0];
          const msgObj = choice.message || choice.delta;

          if (msgObj) {
            if (typeof msgObj.content === "string" && msgObj.content.trim() !== "") {
              reply = msgObj.content;
            } else if (Array.isArray(msgObj.content)) {
              reply = msgObj.content
                .map(part => {
                  if (typeof part === "string") return part;
                  if (part && typeof part === "object" && (part.type === "text" || !part.type)) {
                    return part.text || "";
                  }
                  return "";
                })
                .filter(Boolean)
                .join("\n");
            } else if (typeof msgObj.text === "string" && msgObj.text.trim() !== "") {
              reply = msgObj.text;
            } else if (typeof choice.text === "string" && choice.text.trim() !== "") {
              reply = choice.text;
            }
          }
        }

        if (!reply || typeof reply !== "string" || reply.trim() === "") {
          reply = "No response.";
        }





        // 🔥 Remove accidental Base64 image output

        // 🔥 Remove accidental Base64 image output
        if (
          reply.includes("data:image") ||
          /^[A-Za-z0-9+/=\s]{5000,}$/.test(reply.replace(/\s/g, ""))
        ) {
          reply = "🖼️ Image analyzed successfully.";
        }

        updateLastTopic(question);
        conversationObjects.push({

          question,

          object:
            currentAIObject?.name ||

            "Unknown",

          time:
            new Date().toISOString()
        });
        removeThinkingLoader(loader);

        await typeAIMessage(reply);

        if (pendingMemory) {

          pendingStructuredMemory =
            extractStructuredMemory(pendingMemory);

          showMemorySuggestion(
            pendingStructuredMemory
          );

          pendingMemory = null;

        }






        generateConversationTitle(
          question,
          reply
        );

        attachments = [];
        renderAttachments();
        const cleanReply =

          reply.replace(/[#*`>-]/g, "");

        //speakResponse(cleanReply);
      }

      catch (err) {

        console.log(err);

        addAIMessage(

          "AI request failed.",

          "Astro AI"
        );
      }
    });


  const attachBtn =
    document.getElementById("attach-btn");

  const attachMenu =
    document.getElementById("attach-menu");

  attachBtn.onclick = () => {

    attachMenu.classList.toggle("show");

  };

  document
    .getElementById("image-option")
    .onclick = () => {

      const input =
        document.getElementById("astro-image");

      input.accept = "image/*";

      input.click();

      attachMenu.classList.remove("show");

    };

  document
    .getElementById("file-option")
    .onclick = () => {

      const input =
        document.getElementById("astro-image");

      input.accept = ".pdf,.txt,.doc,.docx,.js,.html,.css,.json,.md,.py,.java,.cpp,.c,.zip,.rar";

      input.click();

      attachMenu.classList.remove("show");

    };
  document.getElementById("memory-filter")
    ?.addEventListener("change", () => {

      renderMemoryList();

    });

  document.getElementById("memory-search")
    ?.addEventListener("input", () => {

      renderMemoryList();

    });


  document
    .getElementById("observation-option")
    .onclick = () => {
      openAIObservationPicker();
      attachMenu.classList.remove("show");
    };

  document
    .getElementById("research-option")
    .onclick = () => {
      researchMode = !researchMode;
      const badge = document.getElementById("ai-research-badge");
      if (researchMode) {
        if (badge) badge.classList.remove("hidden");
        if (typeof showToast === "function") showToast("🧠 Deep Research Mode Enabled!");
      } else {
        if (badge) badge.classList.add("hidden");
        if (typeof showToast === "function") showToast("Research Mode Disabled.");
      }
      renderContextPills();
      attachMenu.classList.remove("show");
    };

  document.onclick = (e) => {

    if (
      !attachMenu.contains(e.target)
      &&
      e.target !== attachBtn
    ) {

      attachMenu.classList.remove("show");

    }

  };

  // ================= EDIT MEMORY OUTSIDE CLICK =================

  document
    .getElementById("edit-memory-overlay")
    ?.addEventListener("click", e => {

      if (e.target.id === "edit-memory-overlay") {

        document
          .getElementById("edit-memory-overlay")
          .classList.remove("show");

        editingMemory = null;

      }

    });

  // ================= CHAT HISTORY OUTSIDE CLICK =================

  document
    .getElementById("history-overlay")
    ?.addEventListener("click", e => {

      if (e.target.id === "history-overlay") {

        document
          .getElementById("history-overlay")
          .style.display = "none";

      }


    });
  compassScale =
    document.getElementById(
      "compassScale"
    );

  buildCompass();

}); // 🔥 DOMContentLoaded END

document
  .getElementById("cancel-edit-memory")
  ?.addEventListener("click", () => {

    document
      .getElementById("edit-memory-overlay")
      .classList.remove("show");

    editingMemory = null;

  });

document
  .getElementById("save-edit-memory")
  ?.addEventListener("click", () => {

    if (!editingMemory) return;

    editingMemory.text =

      document
        .getElementById("edit-memory-text")
        .value
        .trim();

    editingMemory.updatedAt =

      new Date().toISOString();

    localStorage.setItem(

      "astroMemory",

      JSON.stringify(astroMemory)

    );

    saveCloudMemory();

    updateMemorySettings();

    renderMemoryList();

    document
      .getElementById("edit-memory-overlay")
      .classList.remove("show");

    editingMemory = null;

  });

function createAIActionToolbar(text) {
  const actions = document.createElement("div");
  actions.className = "message-actions ai-response-toolbar";

  let modelName = "Astro AI";
  if (typeof getSelectedAIModel === "function") {
    const rawModel = getSelectedAIModel() || "";
    if (rawModel.includes("gemini-2.5-flash") || rawModel.includes("gemini-1.5-flash")) modelName = "Gemini 2.5 Flash";
    else if (rawModel.includes("gemini-3.6-flash")) modelName = "Gemini 3.6 Flash";
    else if (rawModel.includes("gpt-4o")) modelName = "GPT-4o";
    else if (rawModel.includes("claude")) modelName = "Claude 3.5";
    else if (rawModel) modelName = rawModel.split("/").pop();
  }

  const COPY_SVG = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
  const SPEAK_SVG = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;
  const REGEN_SVG = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3L21.5 8M22 12.5a10 10 0 0 1-18.8 4.3L2.5 16"></path></svg>`;
  const MEMORY_SVG = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>`;
  const OBS_SVG = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>`;
  const EXPORT_SVG = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>`;
  const LIKE_SVG = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>`;
  const DISLIKE_SVG = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"></path></svg>`;

  actions.innerHTML = `
    <button type="button" class="message-copy-btn" data-tooltip="Copy response" aria-label="Copy response">${COPY_SVG}</button>
    <button type="button" class="speak-btn" data-tooltip="Read aloud" aria-label="Read aloud">${SPEAK_SVG}</button>
    <button type="button" class="regen-btn" data-tooltip="Try again...&#10;Used ${modelName}" aria-label="Try again">${REGEN_SVG}</button>
    <button type="button" class="save-memory-btn" data-tooltip="Save to AI Memory" aria-label="Save to AI Memory">${MEMORY_SVG}</button>
    <button type="button" class="save-obs-note-btn" data-tooltip="Add to Observation Log" aria-label="Add to Observation Log">${OBS_SVG}</button>
    <button type="button" class="export-md-btn" data-tooltip="Export as Markdown" aria-label="Export Markdown">${EXPORT_SVG}</button>
    <button type="button" class="like-btn" data-tooltip="Good response" aria-label="Good response">${LIKE_SVG}</button>
    <button type="button" class="dislike-btn" data-tooltip="Bad response" aria-label="Bad response">${DISLIKE_SVG}</button>
  `;

  const copyBtn = actions.querySelector(".message-copy-btn");
  const speakBtn = actions.querySelector(".speak-btn");
  const regenBtn = actions.querySelector(".regen-btn");
  const saveMemBtn = actions.querySelector(".save-memory-btn");
  const saveObsBtn = actions.querySelector(".save-obs-note-btn");
  const exportMdBtn = actions.querySelector(".export-md-btn");
  const likeBtn = actions.querySelector(".like-btn");
  const dislikeBtn = actions.querySelector(".dislike-btn");

  if (copyBtn) {
    copyBtn.onclick = async () => {
      await navigator.clipboard.writeText(text);
      copyBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
      if (typeof showToast === "function") showToast("Copied to clipboard!");
      setTimeout(() => { copyBtn.innerHTML = COPY_SVG; }, 1500);
    };
  }

  let speaking = false;
  if (speakBtn) {
    speakBtn.onclick = () => {
      if (!speaking) {
        window.speechSynthesis.cancel();
        const speech = new SpeechSynthesisUtterance(text);
        speech.lang = "en-US";
        speech.rate = 1;
        speech.onend = () => {
          speaking = false;
          speakBtn.innerHTML = SPEAK_SVG;
          speakBtn.setAttribute("data-tooltip", "Read aloud");
        };
        window.speechSynthesis.speak(speech);
        speaking = true;
        speakBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12" rx="2"></rect></svg>`;
        speakBtn.setAttribute("data-tooltip", "Stop reading");
      } else {
        window.speechSynthesis.cancel();
        speaking = false;
        speakBtn.innerHTML = SPEAK_SVG;
        speakBtn.setAttribute("data-tooltip", "Read aloud");
      }
    };
  }

  if (regenBtn) {
    regenBtn.onclick = () => {
      if (typeof lastQuestion !== "undefined" && lastQuestion) {
        const input = document.getElementById("ai-input");
        const sendBtn = document.getElementById("ai-send");
        if (input && sendBtn) {
          input.value = lastQuestion;
          sendBtn.click();
        }
      }
    };
  }

  if (saveMemBtn) {
    saveMemBtn.onclick = () => {
      if (typeof astroMemory !== "undefined") {
        if (!astroMemory.memories) astroMemory.memories = [];
        const structured = typeof extractStructuredMemory === "function"
          ? extractStructuredMemory(text)
          : { category: "AI Response", value: text.slice(0, 250) + (text.length > 250 ? "..." : "") };

        astroMemory.memories.push({
          id: Date.now(),
          text: structured.value || text.slice(0, 250),
          category: structured.category || "AI Response",
          createdAt: new Date().toISOString()
        });
        localStorage.setItem("astroMemory", JSON.stringify(astroMemory));
        if (typeof updateMemorySettings === "function") updateMemorySettings();
        if (typeof renderMemoryList === "function") renderMemoryList();
        if (typeof showToast === "function") showToast("Saved snippet to AI Memory!");
      }
    };
  }

  if (saveObsBtn) {
    saveObsBtn.onclick = () => {
      let observations = [];
      try { observations = JSON.parse(localStorage.getItem("astroObservations") || "[]"); } catch (e) { observations = []; }
      if (!observations.length) {
        if (typeof showToast === "function") showToast("No observations found! Create one in Observation tab first.");
        return;
      }
      const latest = observations[0];
      latest.notes = (latest.notes || "") + "\n\n--- AI Note (" + new Date().toLocaleString() + ") ---\n" + text;
      localStorage.setItem("astroObservations", JSON.stringify(observations));
      if (typeof renderObservations === "function") renderObservations();
      if (typeof showToast === "function") showToast(`Added note snippet to observation "${latest.title}"!`);
    };
  }

  if (exportMdBtn) {
    exportMdBtn.onclick = () => {
      const blob = new Blob([text], { type: "text/markdown;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `AstroAI_Response_${Date.now()}.md`;
      a.click();
      URL.revokeObjectURL(url);
      if (typeof showToast === "function") showToast("Exported answer as Markdown!");
    };
  }

  if (likeBtn) {
    likeBtn.onclick = () => {
      if (likeBtn.classList.contains("active")) {
        likeBtn.classList.remove("active");
        likeBtn.style.color = "";
        if (dislikeBtn) dislikeBtn.style.display = "inline-flex";
      } else {
        likeBtn.classList.add("active");
        likeBtn.style.color = "#22d3ee";
        if (dislikeBtn) dislikeBtn.style.display = "none";
        if (typeof showToast === "function") showToast("Thanks for your feedback");
      }
    };
  }

  if (dislikeBtn) {
    dislikeBtn.onclick = () => {
      if (dislikeBtn.classList.contains("active")) {
        dislikeBtn.classList.remove("active");
        dislikeBtn.style.color = "";
        if (likeBtn) likeBtn.style.display = "inline-flex";
      } else {
        dislikeBtn.classList.add("active");
        dislikeBtn.style.color = "#ef4444";
        if (likeBtn) likeBtn.style.display = "none";
        if (typeof showToast === "function") showToast("Thanks for your feedback");
      }
    };
  }

  return actions;
}

function addAIMessage(text, sender) {

  const msg =
    document.createElement("div");

  msg.className = "message";

  const width =
    localStorage.getItem("messageWidth")
    || "85";

  msg.style.maxWidth =
    width + "%";

  msg.style.padding = "12px";

  const bubble =
    localStorage.getItem("bubbleStyle")
    || "rounded";

  msg.style.borderRadius =

    bubble === "rounded"

      ? "16px"

      : "4px";

  msg.style.margin = "10px";

  msg.style.lineHeight = "1.6";

  msg.style.wordWrap = "break-word";

  msg.style.whiteSpace = "normal";

  msg.style.boxShadow =
    "0 0 10px rgba(0,0,0,0.3)";

  msg.style.marginBottom = "10px";

  if (sender === "You") {

    msg.style.background =
      "#2563eb";

    msg.style.color =
      "white";

    msg.style.marginLeft =
      "auto";

    msg.style.marginWidth =
      "30%";

  }

  else {

    msg.style.background =
      "#111827";

    msg.style.color =
      "#e5e7eb";

    msg.style.border =
      "1px solid #374151";

    msg.style.marginRight =
      "auto";
  }

  msg.innerHTML = `
<b>${sender}:</b>
`;

  const content = document.createElement("div");

  if (text.trim().startsWith("<img")) {
    content.innerHTML = text;
  } else {
    content.innerHTML = (typeof marked !== "undefined" && marked.parse) ? marked.parse(text) : text;
  }

  // Format fenced code blocks with top header bar and Copy Code button
  content.querySelectorAll("pre code").forEach(codeNode => {
    const preNode = codeNode.parentNode;
    if (!preNode || preNode.classList.contains("has-copy-btn")) return;
    preNode.classList.add("has-copy-btn");

    const wrapper = document.createElement("div");
    wrapper.className = "code-block-wrapper";

    const header = document.createElement("div");
    header.className = "code-block-header";
    const lang = Array.from(codeNode.classList).find(c => c.startsWith("language-"))?.replace("language-", "") || "code";
    header.innerHTML = `
      <span class="code-block-lang">${lang.toUpperCase()}</span>
      <button type="button" class="copy-code-btn">📋 Copy Code</button>
    `;

    header.querySelector(".copy-code-btn").addEventListener("click", async (e) => {
      await navigator.clipboard.writeText(codeNode.textContent || "");
      const btn = e.currentTarget;
      btn.textContent = "✅ Copied!";
      setTimeout(() => { btn.textContent = "📋 Copy Code"; }, 1500);
    });

    preNode.parentNode?.insertBefore(wrapper, preNode);
    wrapper.appendChild(header);
    wrapper.appendChild(preNode);
  });

  // Render KaTeX Math Expressions if KaTeX renderMathInElement is available
  if (window.renderMathInElement) {
    try {
      window.renderMathInElement(content, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "\\[", right: "\\]", display: true },
          { left: "$", right: "$", display: false },
          { left: "\\(", right: "\\)", display: false }
        ],
        throwOnError: false
      });
    } catch (e) {
      console.warn("KaTeX render error:", e);
    }
  }

  msg.appendChild(content);

  // 🔥 Rich AI Response Toolbar
  if (sender !== "You") {
    const actions = createAIActionToolbar(text);
    msg.appendChild(actions);
  }

  // 🔥 You message actions
  if (sender === "You") {

    const actions = document.createElement("div");

    actions.className = "message-actions";

    const COPY_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;

    actions.innerHTML = `
<button type="button" class="select-btn" data-tooltip="Select text" aria-label="Select text"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 7 4"></polyline><line x1="14" y1="4" x2="20" y2="4"></line><line x1="20" y1="4" x2="20" y2="10"></line><polyline points="20 17 20 20 17 20"></polyline><line x1="10" y1="20" x2="4" y2="20"></line><line x1="4" y1="20" x2="4" y2="14"></line></svg></button>
<button type="button" class="edit-btn" data-tooltip="Edit query" aria-label="Edit query"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 1-2 2v14a2 2 0 0 1 2 2h14a2 2 0 0 1 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>
<button type="button" class="message-copy-btn" data-tooltip="Copy query" aria-label="Copy query">${COPY_SVG}</button>
`;

    const selectBtn = actions.querySelector(".select-btn");
    const editBtn = actions.querySelector(".edit-btn");
    const copyBtn = actions.querySelector(".message-copy-btn");

    copyBtn.onclick = async () => {

      await navigator.clipboard.writeText(text);

      copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

      setTimeout(() => {

        copyBtn.innerHTML = COPY_SVG;

      }, 1200);

    };

    selectBtn.onclick = () => {

      content.contentEditable = "true";

      content.focus();

      showToast("Select any text you want");

    };

    content.addEventListener("blur", () => {

      content.contentEditable = "false";

    });

    editBtn.onclick = () => {

      const input = document.getElementById("ai-input");

      input.value = text;

      input.focus();

      input.setSelectionRange(text.length, text.length);

    };

    msg.appendChild(actions);



  }

  // 🔥 Sirf ek baar append karna hai
  document
    .getElementById("ai-messages")
    .appendChild(msg);
}



function formatHistoryDate(time) {

  const d = new Date(time);

  const now = new Date();

  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  const yesterday = new Date(today);

  yesterday.setDate(
    yesterday.getDate() - 1
  );

  const target = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate()
  );

  if (target.getTime() === today.getTime()) {

    return "Today • " +

      d.toLocaleTimeString([], {

        hour: "2-digit",

        minute: "2-digit"

      });

  }

  if (target.getTime() === yesterday.getTime()) {

    return "Yesterday • " +

      d.toLocaleTimeString([], {

        hour: "2-digit",

        minute: "2-digit"

      });

  }

  return d.toLocaleDateString([], {

    day: "numeric",

    month: "short",

    year: "numeric"

  });

}

function isMemoryRequest(text) {

  const t = text.toLowerCase().trim();

  return (

    t.startsWith("remember:") ||

    t.startsWith("save") ||

    t.startsWith("store") ||

    t.includes("yaad rakh") ||

    t.includes("yaad rakhna") ||

    t.includes("remember me") ||

    t.includes("memory me") ||

    t.includes("memory mein") ||

    t.includes("add to memory") ||

    t.includes("save this") ||

    t.includes("remember this")

  );

}

function shouldSuggestMemory(text) {

  const structured = extractStructuredMemory(text);

  return structured.category.toLowerCase() !== "general";

}

function extractMemory(text) {

  let memory = text.trim();

  const removePatterns = [

    /^remember\s*:?\s*/i,
    /^remember this\s*/i,
    /^remember that\s*/i,
    /^save this\s*/i,
    /^save it\s*/i,
    /^add to memory\s*/i,
    /^store this\s*/i,

    /^yaad rakhna\s*/i,
    /^yaad rakh\s*/i,
    /^yaad rakh lena\s*/i,

    /^apni memory me add kar lo\s*/i,
    /^apni memory mein add kar lo\s*/i,
    /^memory me add kar lo\s*/i,
    /^memory mein add kar lo\s*/i,

    /^save kar lo\s*/i,
    /^note kar lo\s*/i

  ];

  removePatterns.forEach(pattern => {

    memory = memory.replace(pattern, "");

  });

  return memory.trim();

}

function showToast(message) {

  const toast =
    document.getElementById("toast");

  toast.innerText = message;

  toast.classList.add("show");

  clearTimeout(toast.timer);

  toast.timer = setTimeout(() => {

    toast.classList.remove("show");

  }, 2000);

}

function clearChatUI() {

  const container =
    document.getElementById("ai-messages");

  if (container) {

    container.innerHTML = "";

  }
}







const SpeechRecognition =
  window.SpeechRecognition ||
  window.webkitSpeechRecognition;

let recognition = null;


// 🎤 SPEECH RECOGNITION SETUP
if (SpeechRecognition) {

  recognition =
    new SpeechRecognition();

  recognition.lang = "en-US";

  recognition.continuous = false;

  recognition.interimResults = false;


  // 🎤 VOICE BUTTON
  document
    .getElementById("voice-btn")
    .addEventListener("click", () => {

      if (!recognition) {

        alert(
          "Speech recognition not supported 😭"
        );

        return;
      }

      recognition.stop();

      recognition.start();

      addAIMessage(

        "Listening... 🎤😮🔥",

        "Astro AI"
      );
    });


  // 🎤 VOICE RESULT
  recognition.onresult = (event) => {

    const transcript =

      event.results[0][0].transcript;

    document
      .getElementById("ai-input")
      .value = transcript;
  };

} // 🔥 END SpeechRecognition setup



// 🔊 AI VOICE NARRATION
function speakResponse(text) {

  window.speechSynthesis.cancel();

  const speech =
    new SpeechSynthesisUtterance(
      text
    );

  speech.lang = "en-US";

  speech.rate = 1;

  speech.pitch = 1;

  speech.volume = 1;

  speech.onstart = () => {

    console.log(
      "Speaking..."
    );
  };

  speech.onerror = (e) => {

    console.log(
      "Speech error:",
      e
    );
  };

  window.speechSynthesis.speak(
    speech
  );
}



// 🖼️ IMAGE UPLOAD PREVIEW


document
  .getElementById("astro-image")
  .addEventListener("change", e => {

    const files = Array.from(e.target.files);

    if (files.length === 0)
      return;

    files.forEach(file => {

      saveFileMemory(file);



      const reader =
        new FileReader();

      // 🖼️ IMAGE FILE
      if (
        file.type.startsWith(
          "image/"
        )
      ) {



        reader.onload = () => {



          attachments.push({

            type: "image",

            name: file.name,

            data: reader.result

          });

          renderAttachments();


        };

        reader.readAsDataURL(
          file
        );
      }

      // 📄 TEXT / CODE FILE
      else {



        reader.onload = () => {



          attachments.push({

            type: "file",

            name: file.name,

            data: reader.result

          });

          renderAttachments();


        };

        reader.readAsText(file);
      }

    });


    e.target.value = "";
  });
function searchMemories(query) {

  if (!astroMemory.memories)
    return [];

  const words = query
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter(w =>
      w.length > 2 &&
      ![
        "what",
        "which",
        "where",
        "when",
        "who",
        "why",
        "how",
        "is",
        "are",
        "the",
        "a",
        "an",
        "my",
        "me",
        "tell",
        "about"
      ].includes(w)
    );

  return astroMemory.memories.filter(memory => {

    const text = memory.text.toLowerCase();

    return words.some(word => text.includes(word));

  });

}
function addCopyButtons() {

  document
    .querySelectorAll("pre")
    .forEach(pre => {

      // already added
      if (
        pre.querySelector(
          ".copy-btn"
        )
      ) return;

      const btn =
        document.createElement(
          "button"
        );

      btn.innerText =
        "Copy";

      btn.className =
        "code-copy-btn";

      btn.onclick = () => {

        navigator.clipboard.writeText(

          pre.innerText
        );

        btn.innerText =
          "Copied 😮🔥";

        setTimeout(() => {

          btn.innerText =
            "Copy";

        }, 2000);
      };

      pre.appendChild(btn);
    });
}
document
  .getElementById("google-login")
  .addEventListener("click", async () => {

    try {

      const result =

        await signInWithPopup(

          auth,
          provider
        );

      const user =
        result.user;

      const profilePic =
        document.getElementById("profile-pic");

      profilePic.src =
        user.photoURL;

      profilePic.src =
        user.photoURL ||
        "https://ui-avatars.com/api/?name=User&background=333&color=fff";

      profilePic.style.display = "block";

      document.getElementById("profile-name").innerText =
        user.displayName;

      document.getElementById("profile-email").innerText =
        user.email;

      document.getElementById("google-login").style.display =
        "none";

      document.getElementById("logout-menu-btn").style.display =
        "block";



      addAIMessage(

        `
Logged in 😈🔥

Welcome:
${user.displayName}
`,

        "Astro AI"
      );

    }

    catch (err) {

      console.log(err);
    }
  });


const oldLogoutBtn = document.getElementById("logout-btn");

if (oldLogoutBtn) {
  oldLogoutBtn.addEventListener("click", async () => {
    await signOut(auth);

    addAIMessage(
      "Logged out 😭🔥",
      "Astro AI"
    );
  });
}
document
  .getElementById("profile-pic")
  .addEventListener("click", () => {
    const menu = document.getElementById("profile-menu");
    menu.classList.toggle("show");
    if (menu.classList.contains("show")) {
      try {
        const obs = JSON.parse(localStorage.getItem("astroObservations") || "[]");
        const nasaFavs = JSON.parse(localStorage.getItem("nasaFavorites") || "[]");
        const favObs = obs.filter(o => o.isFavorite).length;
        const totalHrs = obs.reduce((s, o) => s + (parseFloat(o.duration) || 0), 0);
        const el = id => document.getElementById(id);
        if (el("ph-stat-obs")) el("ph-stat-obs").textContent = obs.length;
        if (el("ph-stat-favs")) el("ph-stat-favs").textContent = favObs;
        if (el("ph-stat-nasa")) el("ph-stat-nasa").textContent = nasaFavs.length;
        if (el("ph-stat-hrs")) el("ph-stat-hrs").textContent = totalHrs > 0 ? totalHrs.toFixed(1) + "h" : "0h";
      } catch (e) { }
    }
  });

document
  .getElementById("logout-menu-btn")
  .addEventListener("click", async () => {

    await signOut(auth);

  });

console.log("Window Auth:", typeof window.onAuthStateChanged);
console.log("Window auth:", typeof window.auth);

window.onAuthStateChanged(window.auth, async user => {

  if (user) {

    const profilePic =
      document.getElementById("profile-pic");

    profilePic.src =
      user.photoURL ||
      "https://ui-avatars.com/api/?name=User&background=333&color=fff";

    profilePic.style.display =
      "block";

    document.getElementById("profile-name").innerText =
      user.displayName;

    document.getElementById("profile-email").innerText =
      user.email;

    // Sync Profile Hub avatar
    (function () {
      const phLetter = document.getElementById("ph-avatar-letter");
      const phImg = document.getElementById("ph-avatar-img");
      if (user.photoURL && phImg) {
        phImg.src = user.photoURL;
        phImg.className = "ph-avatar-img visible";
        if (phLetter) phLetter.style.display = "none";
      } else if (phLetter) {
        phLetter.textContent = (user.displayName || "A").charAt(0).toUpperCase();
        if (phImg) phImg.className = "ph-avatar-img";
      }
    })();

    // New profile menu buttons
    document.getElementById("google-login").style.display =
      "none";

    document.getElementById("logout-menu-btn").style.display =
      "block";

    // ✅ Pehle current user set karo
    window.currentUser = user;

    updateAccountSettings();

    await loadCloudMemory();

    // ✅ Sirf ek baar conversations load karo
    await loadConversations();

    if (!currentConversationId) {

      await createNewConversation(
        "New Astronomy Chat"
      );

    }



    /*addAIMessage(
   
   `
   Welcome back 😈🔥
   
   ${user.displayName}
   `,
   
       "Astro AI"
     );*/



  }

  else {

    document.getElementById("profile-pic").style.display =
      "block";

    document.getElementById("profile-pic").src =
      "https://ui-avatars.com/api/?name=User&background=333&color=fff";

    document.getElementById("profile-menu")
      .classList.remove("show");

    document.getElementById("google-login").style.display =
      "block";

    document.getElementById("logout-menu-btn").style.display =
      "none";

    document.getElementById("profile-name").innerText =
      "";

    document.getElementById("profile-email").innerText =
      "";

    window.currentUser = null;

    updateAccountSettings();
    const profilePic = document.getElementById("profile-pic");
    const profileMenu = document.getElementById("profile-menu");
    const profileName = document.getElementById("profile-name");
    const profileEmail = document.getElementById("profile-email");

    const googleLogin =
      document.getElementById("google-login");

    const logoutBtn =
      document.getElementById("logout-menu-btn");


  }

  document
    .getElementById(
      "new-chat-settings"
    )
    .addEventListener(
      "click",

      async () => {

        await createNewConversation(
          "New Astronomy Chat"
        );

        document
          .getElementById(
            "attach-btn"
          )
          .onclick = () => {

            document
              .getElementById(
                "astro-image"
              )
              .click();

          };

      });
});

document.getElementById("profile-pic").style.display =
  "block";

document.getElementById("profile-pic").src =
  "https://ui-avatars.com/api/?name=User&background=333&color=fff";

document.getElementById("profile-menu")
  .classList.remove("show");

document.getElementById("google-login").style.display =
  "block";

document.getElementById("logout-menu-btn").style.display =
  "none";

async function saveCloudMemory() {

  if (!window.currentUser)
    return;

  await setDoc(

    doc(
      db,
      "memories",
      window.currentUser.uid
    ),

    {

      memories: astroMemory.memories || [],

      theories: astroMemory.theories || [],

      observations: astroMemory.observations || [],

      telescopeSessions: astroMemory.telescopeSessions || [],

      files: astroMemory.files || []

    }

  );

}
async function loadCloudMemory() {

  if (!window.currentUser)
    return;

  const docRef = doc(
    db,
    "memories",
    window.currentUser.uid
  );

  const snap = await getDoc(docRef);

  if (snap.exists()) {

    const data = snap.data();

    astroMemory = {

      memories:
        data.memories || [],

      theories:
        data.theories || [],

      observations:
        data.observations || [],

      telescopeSessions:
        data.telescopeSessions || [],

      files:
        data.files || []

    };

    localStorage.setItem(
      "astroMemory",
      JSON.stringify(astroMemory)
    );

  }

  updateGeneralSettings();
  updateMemorySettings();
  renderMemoryList();
  updateAccountSettings();

}


window.loadChatHistory =
  async function () {

    if (!window.currentUser)
      return;

    try {

      const ref = doc(
        db,
        "users",
        window.currentUser.uid
      );

      const snap =
        await getDoc(ref);

      if (!snap.exists())
        return;

      const chats =
        snap.data().chatHistory || [];

      chats.forEach(chat => {

        addAIMessage(

          chat.text,

          chat.sender

        );

      });

      console.log(
        "History loaded 😈🔥"
      );

    }

    catch (err) {

      console.log(err);

    }


  };

function renderCurrentConversation() {


  const container =
    document.getElementById(
      "ai-messages"
    );

  container.innerHTML = "";

  const convo =
    conversations.find(

      c =>
        c.id ===
        currentConversationId
    );

  if (!convo)
    return;

  convo.messages.forEach(msg => {

    addAIMessage(

      msg.text,

      msg.sender
    );
  });
}




console.log("BEFORE renderConversationList");
function renderConversationList() {

  console.log("INSIDE renderConversationList");

  const list =
    document.getElementById("history-list");

  list.innerHTML = "";

  conversations.forEach(convo => {

    const item =
      document.createElement("div");

    item.className =
      "conversation-item";

    item.innerText =
      convo.title;

    item.style.cursor =
      "pointer";

    item.style.padding =
      "10px";

    item.style.marginBottom =
      "10px";

    item.style.background =
      "#111827";

    item.style.color =
      "white";

    item.style.borderRadius =
      "10px";

    item.onclick = () => {

      currentConversationId =
        convo.id;

      renderCurrentConversation();
    };

    list.appendChild(item);
  });
}

function showThinkingLoader() {

  const loader =
    document.createElement("div");

  loader.style.maxWidth = "85%";

  loader.style.padding = "12px";

  loader.style.borderRadius = "16px";

  loader.style.margin = "10px";

  loader.style.background =
    "#1f2937";

  loader.style.color =
    "#f9fafb";

  loader.style.border =
    "1px solid #374151";

  loader.style.boxShadow =
    "0 0 10px rgba(0,0,0,0.3)";

  loader.id = "astro-loader";

  loader.style.marginBottom = "10px";

  loader.innerHTML = `

    <b>Astro AI:</b>

    <span id="loader-text">
      Analyzing astronomical data 🌌
    </span>
  `;

  document
    .getElementById("ai-messages")
    .appendChild(loader);

  // 🔥 animated text
  const texts = [

    "Analyzing astronomical data 🌌",

    "Generating scientific explanation 🔭",

    "Processing cosmic information ✨",

    "Preparing detailed response 🚀"
  ];

  let index = 0;

  loader.interval = setInterval(() => {

    index =
      (index + 1) % texts.length;

    const span =
      document.getElementById(
        "loader-text"
      );

    if (span) {
      span.innerText =
        texts[index];
    }

  }, 1500);

  return loader;
}

function removeThinkingLoader(loader) {

  if (!loader) return;

  clearInterval(loader.interval);

  loader.remove();
}

async function typeAIMessage(text) {
  text = String(text || "");

  const msg =
    document.createElement("div");

  const width =
    localStorage.getItem("messageWidth")
    || "85";

  msg.style.maxWidth =
    width + "%";

  msg.style.padding = "12px";

  const bubble =
    localStorage.getItem("bubbleStyle")
    || "rounded";

  msg.style.borderRadius =

    bubble === "rounded"

      ? "16px"

      : "4px";

  msg.style.margin = "10px";

  msg.style.lineHeight = "1.6";

  msg.style.wordWrap = "break-word";

  msg.style.whiteSpace = "normal";

  msg.style.background =
    "#111827";

  msg.style.color =
    "#e5e7eb";

  msg.style.border =
    "1px solid #374151";

  msg.style.marginRight =
    "auto";

  msg.style.boxShadow =
    "0 0 10px rgba(0,0,0,0.3)";

  msg.style.marginBottom = "10px";

  msg.innerHTML = `
    <b>Astro AI:</b>
    <span class="typing-text"></span>
  `;

  const messagesContainer = document.getElementById("ai-messages");
  if (messagesContainer) {
    messagesContainer.appendChild(msg);
  }

  const span = msg.querySelector(".typing-text");

  const animations = (typeof AstroSettings !== "undefined" ? AstroSettings.get("animations") : null) ?? JSON.parse(
    localStorage.getItem("animations") ?? "true"
  );

  try {
    if (!animations || text.length > 500) {
      // Animation OFF or long reply (> 500 characters): render instantly
      span.innerHTML = marked.parse(text);
      if (messagesContainer) messagesContainer.scrollTop = messagesContainer.scrollHeight;
    } else {
      // Smooth frame-batched typing animation for short replies (<= 500 characters)
      let i = 0;
      const chunkSize = Math.max(3, Math.ceil(text.length / 40));
      while (i < text.length) {
        const chunk = text.slice(i, i + chunkSize);
        let chunkHtml = "";
        for (let c = 0; c < chunk.length; c++) {
          const char = chunk.charAt(c);
          if (char === "\n") {
            chunkHtml += "<br>";
          } else if (char === "<") {
            chunkHtml += "&lt;";
          } else if (char === ">") {
            chunkHtml += "&gt;";
          } else if (char === "&") {
            chunkHtml += "&amp;";
          } else {
            chunkHtml += char;
          }
        }
        span.innerHTML += chunkHtml;
        i += chunkSize;

        if (messagesContainer) {
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        if (animations) {
          await new Promise(r => requestAnimationFrame(r));
        }
      }
      // Typing complete: render markdown
      span.innerHTML = marked.parse(text);
      if (messagesContainer) messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  } catch (e) {
    console.error("Typing animation error:", e);
    span.innerHTML = marked.parse(text);
  }

  renderMathInElement(span, {


    delimiters: [

      {
        left: "$$",
        right: "$$",
        display: true
      },

      {
        left: "$",
        right: "$",
        display: false
      },

      {
        left: "\\[",
        right: "\\]",
        display: true
      },

      {
        left: "\\(",
        right: "\\)",
        display: false
      }
    ]
  });

  saveMessage(
    "Astro AI",
    text
  );
  addCopyButtons();

  span.classList.remove(
    "typing-text"



  );

  // 🔥 AI message actions
  const actions = createAIActionToolbar(text);
  msg.appendChild(actions);
}






async function loadConversations({ openFirst = false } = {}) {
  if (!window.currentUser) return;

  try {
    const ref = collection(db, "users", window.currentUser.uid, "conversations");
    const snap = await getDocs(ref);

    conversations = [];
    snap.forEach(docSnap => {
      conversations.push({
        id: docSnap.id,
        ...docSnap.data()
      });
    });


    conversations.sort((a, b) => {
      if ((a.pinned || false) !== (b.pinned || false)) {
        return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
      }
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });

    renderHistoryList(historySearch?.value?.toLowerCase() || "");

    if (openFirst && conversations.length > 0) {
      currentConversationId = conversations[0].id;
      renderCurrentConversation();
    }
    updateGeneralSettings();
  } catch (err) {
    console.log(err);
  }
}

async function createNewConversation(title = "New Chat") {
  if (!window.currentUser) return;

  const id = "conv_" + Date.now();
  const convo = {
    id,
    title,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
    pinned: false
  };

  convo.messages.push({

    sender: "Astro AI",

    text: "Hello. I am Astro AI. Ask me anything about space.",

    time: Date.now()

  });

  currentConversationId = id;

  await setDoc(
    doc(db, "users", window.currentUser.uid, "conversations", id),
    convo
  );

  conversations.unshift(convo);
  clearChatUI();

  addAIMessage(
    "Hello. I am Astro AI. Ask me anything about space.",
    "Astro AI"
  );
  renderHistoryList(historySearch?.value?.toLowerCase() || "");
  updateGeneralSettings();
}

async function openConversation(id) {

  currentConversationId =
    id;

  clearChatUI();

  const ref = doc(

    db,

    "users",

    window.currentUser.uid,

    "conversations",

    id
  );

  const snap =
    await getDoc(ref);

  if (!snap.exists())
    return;

  const data =
    snap.data();

  const messages =
    data.messages || [];

  messages.forEach(msg => {

    addAIMessage(

      msg.text,

      msg.sender
    );
  });
}



async function saveMessage(

  sender,

  text

) {

  if (!window.currentUser)
    return;

  if (!currentConversationId)
    return;

  const ref = doc(

    db,

    "users",

    window.currentUser.uid,

    "conversations",

    currentConversationId
  );

  const snap =
    await getDoc(ref);

  if (!snap.exists())
    return;

  const data =
    snap.data();

  const messages =
    data.messages || [];

  messages.push({

    sender,

    text,

    time:
      Date.now()
  });

  await setDoc(ref, {

    ...data,

    updatedAt:
      Date.now(),

    messages

  });

  conversations = conversations.map(c => {

    if (c.id === currentConversationId) {

      return {

        ...c,

        updatedAt: Date.now(),

        messages

      };

    }

    return c;

  });

  await loadConversations();

  renderHistoryList();
}

async function generateConversationTitle(question, reply) {

  if (!window.currentUser) return;

  if (!currentConversationId) return;

  try {

    const endpoint = useCloud
      ? "https://astro-exp-seven.vercel.app/api/chat"
      : "https://openrouter.ai/api/v1/chat/completions";

    const headers = useCloud
      ? {
        "Content-Type": "application/json"
      }
      : {
        "Authorization":
          "Bearer " +
          localStorage.getItem("OPENROUTER_API_KEY"),

        "Content-Type": "application/json",

        "HTTP-Referer": location.origin,

        "X-Title": "Astro AI"
      };



    console.log("===== TITLE =====");
    console.log("Endpoint:", endpoint);
    console.log("useCloud:", useCloud);

    console.log("🔍 [DEBUG] Title Generation Request:", {
      endpoint: endpoint,
      useCloud: useCloud,
      question: question,
      reply: reply
    });

    const selectedModel = getSelectedAIModel();

    const response = await fetch(endpoint, {

      method: "POST",

      headers,

      body: JSON.stringify({

        model: selectedModel,

        messages: [

          {
            role: "system",
            content: `
Generate a short conversation title.

Rules:
- Maximum 5 words.
- Do not use quotes.
- Do not use markdown.
- Return only the title.
`
          },

          {
            role: "user",
            content: `
Question:
${question}

Assistant Reply:
${reply}
`
          }

        ],

        temperature: 0.2,

        max_tokens: 20

      })

    });

    const data = await response.json();
    console.log("TITLE RESPONSE:", data);

    if (!data || !data.choices || data.choices.length === 0) return;

    const msgObj = data.choices[0]?.message;
    const rawTitle = msgObj?.content || msgObj?.reasoning || msgObj?.reasoning_content || "Astronomy Chat";
    const title = String(rawTitle || "Astronomy Chat").trim();

    const ref = doc(

      db,

      "users",

      window.currentUser.uid,

      "conversations",

      currentConversationId

    );

    const snap = await getDoc(ref);

    if (!snap.exists()) return;

    const convo = snap.data();

    if (convo.title !== "New Astronomy Chat") return;

    await setDoc(ref, {

      ...convo,

      title,

      updatedAt: Date.now()

    });

    await loadConversations();

    renderHistoryList();

  }

  catch (err) {

    console.log(err);

  }

}





document
  .getElementById("open-ai")
  .addEventListener("click", () => {

    document.getElementById("ai-panel").style.display = "flex";

    document.getElementById("open-ai").style.display = "none";

  });

document
  .getElementById("close-ai")
  .addEventListener("click", () => {

    document.getElementById("ai-panel").style.display = "none";

    document.getElementById("open-ai").style.display = "block";

  });

function showAPIKeyModal() {

  document.getElementById(
    "api-key-modal"
  ).style.display = "flex";

}

function hideAPIKeyModal() {

  document.getElementById(
    "api-key-modal"
  ).style.display = "none";

}

function updateAccountSettings() {

  const photo =
    document.getElementById("account-photo");

  const name =
    document.getElementById("account-name");

  const email =
    document.getElementById("account-email");

  const status =
    document.getElementById("account-status");

  if (window.currentUser) {

    photo.src =
      window.currentUser.photoURL ||
      "https://ui-avatars.com/api/?name=User";

    name.textContent =
      window.currentUser.displayName ||
      "User";

    email.textContent =
      window.currentUser.email ||
      "";

    status.textContent =
      "Signed In";

    document.getElementById("account-type").textContent =
      "Cloud Account";

  }

  else {

    photo.src =
      "https://ui-avatars.com/api/?name=Guest";

    name.textContent =
      "Guest User";

    email.textContent =
      "Not Signed In";

    status.textContent =
      "Signed Out";

    document.getElementById("account-type").textContent =
      "Cloud Account";


  }

}

document.getElementById("manage-account-btn").onclick = () => {

  document.getElementById("settings-overlay").style.display = "none";

  setTimeout(() => {
    document.getElementById("profile-menu").classList.add("show");
  }, 100);

};

document
  .getElementById("sync-now-btn")
  .onclick = async () => {

    await saveCloudMemory();

    document
      .getElementById("last-sync")
      .textContent =
      new Date().toLocaleString();

    showToast("☁ Cloud Synced");

  };

document
  .getElementById("export-account-data")
  .onclick = () => {

    document
      .getElementById("export-memory")
      ?.click();

  };

document
  .getElementById("import-account-data")
  .onclick = () => {

    document
      .getElementById("import-account-file")
      .click();

  };

document
  .getElementById("import-account-file")
  .onchange = e => {

    const file = e.target.files[0];

    if (!file) return;

    const reader =
      new FileReader();

    reader.onload = () => {

      astroMemory =
        JSON.parse(reader.result);

      localStorage.setItem(
        "astroMemory",
        JSON.stringify(astroMemory)
      );

      updateMemorySettings();
      renderMemoryList();
      showToast("📦 Data Imported");

    };

    reader.readAsText(file);

  };

function updateGeneralSettings() {

  const conversationCount =
    document.getElementById("conversation-count");

  const memoryCount =
    document.getElementById("memory-count");

  const fileCount =
    document.getElementById("file-count");

  if (fileCount) {

    fileCount.textContent =
      (astroMemory.files || []).length;

  }

  const aiStatus =
    document.getElementById("ai-status-general");

  const apiKey =
    localStorage.getItem("OPENROUTER_API_KEY");

  const aiConnected =

    useCloud

      ?

      true

      :

      (apiKey && apiKey.trim() !== "");
  aiStatus.textContent =

    aiConnected

      ?

      "Connected"

      :

      "Not Connected";

  if (conversationCount) {

    conversationCount.textContent =
      conversations.length;

  }

  if (memoryCount) {

    const totalMemories =
      (astroMemory.memories?.length || 0) +
      (astroMemory.theories?.length || 0) +
      (astroMemory.observations?.length || 0) +
      (astroMemory.telescopeSessions?.length || 0) +
      (astroMemory.files?.length || 0);

    memoryCount.textContent = totalMemories;

  }



}

document.getElementById("close-info-panel").addEventListener("click", () => {

  document.getElementById("object-info-panel").style.display = "none";

  if (marker) {
    marker.remove();
    marker = null;
  }

  if (searchHighlight) {

    searchHighlight.remove();

    searchHighlight = null;

  }

  tracking = false;
  currentTarget = null;

  if (starLabel) {
    starLabel.remove();
    starLabel = null;
  }

  if (planetLabel) {
    planetLabel.remove();
    planetLabel = null;
  }

  if (dsoSearchLabel) {
    dsoSearchLabel.remove();
    dsoSearchLabel = null;
  }

  searchedObjectName = "";
  selectedObject = null;
  lastSelectedPlanet = null;

  document.getElementById("searchBox").value = "";

});
/* ==========================================
   ASTRO EXPLORER SETTINGS
========================================== */

/* ==========================================
   ASTRO EXPLORER SETTINGS
========================================== */

const openContextDebugBtn = document.getElementById("open-context-debug");
const closeContextDebugBtn = document.getElementById("close-context-debug");
const contextDebugModal = document.getElementById("context-debug-modal");

if (openContextDebugBtn && contextDebugModal) {
  openContextDebugBtn.onclick = () => {
    contextDebugModal.style.display = "flex";
    contextDebugModal.classList.remove("hidden");
    const currentInput = document.getElementById("ai-input")?.value || "";
    AstroContextEngine.collectContext(currentInput);
  };
}

if (closeContextDebugBtn && contextDebugModal) {
  closeContextDebugBtn.onclick = () => {
    contextDebugModal.style.display = "none";
    contextDebugModal.classList.add("hidden");
  };
}

const settingsOverlay = document.getElementById("settings-overlay");
const openSettingsBtn = document.getElementById("open-settings");

const closeSettingsBtn = document.getElementById("close-settings");
console.log("Settings:", {
  overlay: settingsOverlay,
  open: openSettingsBtn,
  close: closeSettingsBtn
});
const settingsTabs = document.querySelectorAll(".settings-tab");
const settingsPages = document.querySelectorAll(".settings-page");

console.log("SETTINGS INIT");

if (settingsOverlay && openSettingsBtn && closeSettingsBtn) {

  console.log("ATTACHING SETTINGS EVENTS");

  openSettingsBtn.onclick = () => {

    console.log("SETTINGS CLICKED");

    settingsOverlay.style.display = "flex";

  };

  closeSettingsBtn.onclick = () => {

    settingsOverlay.style.display = "none";

  };



  settingsOverlay.addEventListener("click", (e) => {
    if (e.target === settingsOverlay) {
      settingsOverlay.style.display = "none";
    }
  });

  document.addEventListener("keydown", (e) => {
    if (
      e.key === "Escape" &&
      settingsOverlay.style.display === "flex"
    ) {
      settingsOverlay.style.display = "none";
    }
  });

  settingsTabs.forEach(tab => {

    tab.addEventListener("click", () => {

      settingsTabs.forEach(btn =>
        btn.classList.remove("active")
      );

      settingsPages.forEach(page =>
        page.classList.remove("active")
      );

      tab.classList.add("active");

      const page = document.getElementById(
        tab.dataset.page + "-page"
      );

      if (page) {
        page.classList.add("active");
      }

      if (tab.dataset.page === "sky") {
        initSkySettings();
      }

      if (tab.dataset.page === "observation") {
        initObserverLocation();
      }

    });

  });

}
document.getElementById("environment-status").textContent =
  isLocal
    ? "Local Development"
    : "Production";

document.getElementById("firebase-status").textContent =
  window.db
    ? "Connected"
    : "Offline";

document.getElementById("database-status").textContent =
  window.db
    ? "Online"
    : "Offline";

document.getElementById("conversation-count").textContent =
  conversations.length;

document.getElementById("memory-count").textContent =
  astroMemory.memories.length;

document.getElementById("file-count").textContent =
  (astroMemory.files || []).length;

document.getElementById("clear-cache-btn").onclick = () => {

  if (!confirm(

    "Are you sure you want to clear the application cache?"

  )) return;

  localStorage.clear();

  showToast("🧹 Cache Cleared");

  location.reload();

};

document.getElementById("reset-settings-btn").onclick = () => {

  if (!confirm("Reset all settings?"))
    return;

  localStorage.removeItem("astro_settings_consolidated");
  localStorage.removeItem("fontSize");
  localStorage.removeItem("accentColor");
  localStorage.removeItem("bubbleStyle");
  localStorage.removeItem("messageWidth");
  localStorage.removeItem("animations");
  localStorage.removeItem("responseLength");
  localStorage.removeItem("creativity");
  localStorage.removeItem("skySettings");

  AstroSettings.load();
  applyAppearanceSettings();
  applyAccentColor();
  applyAISettings();

  showToast("⚙ Settings Reset");
  setTimeout(() => location.reload(), 1000);

};

/* ==========================================
   ASTRO AI SETTINGS - PHASE 2
========================================== */

const apiStatus =
  document.getElementById("api-status");

const settingsApiKey =
  document.getElementById("settings-api-key");

const changeApiKeyBtn =
  document.getElementById("change-api-key");

const removeApiKeySettingsBtn =
  document.getElementById("remove-api-key-settings");

const viewHistoryBtn =
  document.getElementById("view-chat-history");

const newChatSettingsBtn =
  document.getElementById("new-chat-settings");

const clearCurrentBtn =
  document.getElementById("clear-current-chat");

const clearAllBtn =
  document.getElementById("clear-all-chat");


// Load current API key

const savedKey =
  localStorage.getItem("OPENROUTER_API_KEY");

if (savedKey) {

  settingsApiKey.value =
    "••••••••••••••••";

  apiStatus.textContent =
    "Connected";

} else {

  apiStatus.textContent =
    "Not Connected";

}


// Change API Key

changeApiKeyBtn?.addEventListener("click", () => {

  showAPIKeyModal();

});


// Remove API Key

removeApiKeySettingsBtn?.addEventListener("click", () => {

  if (confirm("Remove saved API Key?")) {

    localStorage.removeItem("OPENROUTER_API_KEY");
    updateGeneralSettings();

    settingsApiKey.value = "";

    apiStatus.textContent =
      "Not Connected";

    showToast("API Key Removed");

  }

});


// View History

viewHistoryBtn?.addEventListener("click", () => {

  showToast("Chat History coming in Phase 2.2");

});


// New Chat

newChatSettingsBtn?.addEventListener("click", async () => {

  if (typeof createNewConversation === "function") {

    await createNewConversation(
      "New Astronomy Chat"
    );

    showToast("New Chat Created");

  }

});


// Clear Current Chat

clearCurrentBtn?.addEventListener("click", async () => {

  if (!currentConversationId) return;

  if (!confirm("Clear current conversation?")) return;

  try {

    const ref = doc(

      db,

      "users",

      window.currentUser.uid,

      "conversations",

      currentConversationId

    );

    const snap = await getDoc(ref);

    if (!snap.exists()) return;

    const data = snap.data();

    await setDoc(

      ref,

      {

        ...data,

        messages: [],

        updatedAt: Date.now()

      }

    );

    clearChatUI();

    addAIMessage(

      "Hello. I am Astro AI. Ask me anything about space.",

      "Astro AI"

    );

    await loadConversations();

    renderHistoryList();

    showToast("🗑 Current chat cleared");

  }

  catch (err) {

    console.log(err);

    showToast("Failed to clear chat");

  }

});


// Clear All Chats

clearAllBtn?.addEventListener("click", async () => {

  if (!window.currentUser) return;

  if (!confirm("Delete ALL conversations? This cannot be undone.")) return;

  try {

    for (const conv of conversations) {

      await deleteDoc(

        doc(

          db,

          "users",

          window.currentUser.uid,

          "conversations",

          conv.id

        )

      );

    }

    conversations = [];

    currentConversationId = null;

    clearChatUI();

    await createNewConversation(
      "New Astronomy Chat"
    );

    showToast("🗑 All chats deleted");

  }

  catch (err) {

    console.log(err);

    showToast("Failed to delete chats");

  }

});

/* ==========================================
   CHAT HISTORY MANAGER
========================================== */

const historyOverlay =
  document.getElementById("history-overlay");

const historyList =
  document.getElementById("history-list");





const historySearch =
  document.getElementById("history-search-box");

const importBtn =
  document.getElementById("import-chat");

const importInput =
  document.getElementById("import-chat-file");

importBtn.onclick = () => {

  importInput.click();

};

importInput.onchange = async (e) => {

  const file = e.target.files[0];

  if (!file) return;

  try {

    const text =
      await file.text();

    const data =
      JSON.parse(text);

    if (
      !data.title ||
      !Array.isArray(data.messages)
    ) {

      showToast(
        "Invalid Chat File"
      );

      return;

    }

    const id =
      "conv_" + Date.now();

    await setDoc(

      doc(

        db,

        "users",

        window.currentUser.uid,

        "conversations",

        id

      ),

      {

        title: data.title,

        createdAt:
          data.createdAt ||
          Date.now(),

        updatedAt:
          Date.now(),

        messages:
          data.messages,

        pinned: false

      }

    );

    await loadConversations();

    renderHistoryList();

    showToast(
      "📥 Chat Imported"
    );

  }

  catch (err) {

    console.log(err);

    showToast(
      "Import Failed"
    );

  }

};

const closeHistoryBtn =
  document.getElementById("close-history");

viewHistoryBtn?.addEventListener("click", () => {

  historyOverlay.style.display = "flex";

  renderHistoryList();

});


// OPEN

viewHistoryBtn?.addEventListener("click", () => {

  historyOverlay.style.display = "flex";

  renderHistoryList();

});


// CLOSE

closeHistoryBtn?.addEventListener("click", () => {

  historyOverlay.style.display = "none";

});


// CLICK OUTSIDE

historyOverlay?.addEventListener("click", (e) => {

  if (e.target === historyOverlay) {

    historyOverlay.style.display = "none";

  }

});


// SEARCH

historySearch?.addEventListener("input", () => {

  renderHistoryList(
    historySearch.value.toLowerCase()
  );

});


// RENDER

function renderHistoryList(search = "") {

  historyList.innerHTML = "";

  if (
    !Array.isArray(conversations) ||
    conversations.length === 0
  ) {

    historyList.innerHTML = `

<div class="history-item">

<div class="history-title">

No conversations

</div>

</div>

`;

    return;

  }

  const sortedConversations =

    [...conversations].sort((a, b) => {

      if (a.pinned !== b.pinned) {

        return b.pinned - a.pinned;

      }

      return (b.updatedAt || 0) - (a.updatedAt || 0);

    });
  let found = 0;

  sortedConversations.forEach(conv => {

    const titleMatch =
      (conv.title || "")
        .toLowerCase()
        .includes(search);

    const messageMatch =
      (conv.messages || []).some(msg =>
        (msg.text || "")
          .toLowerCase()
          .includes(search)
      );

    if (search && !(titleMatch || messageMatch)) {
      return;
    }

    found++;

    const item =
      document.createElement("div");

    item.className =
      "history-item";

    if (conv.id === currentConversationId) {

      item.classList.add("active-history");

    }

    if (conv.pinned) {

      item.classList.add("pinned");

    }
    let lastMessage = "No messages yet";

    if (conv.messages?.length) {

      if (search) {

        const found = conv.messages.find(msg =>
          (msg.text || "")
            .toLowerCase()
            .includes(search)
        );

        if (found) {
          lastMessage = found.text.substring(0, 60);
        } else {
          lastMessage =
            conv.messages.at(-1).text.substring(0, 60);
        }

      } else {

        lastMessage =
          conv.messages.at(-1).text.substring(0, 60);

      }

    }

    item.innerHTML = `

<div class="history-title">

${conv.title}

</div>

<div class="history-preview">

${lastMessage}

</div>

<div class="history-date">

${formatHistoryDate(
      conv.updatedAt || Date.now()
    )}

</div>

<div class="history-actions">

<button class="open-chat">
Open
</button>

<button class="rename-chat">
Rename
</button>

<button class="export-chat">
Export
</button>

<button class="delete-chat">
Delete
</button>

<button class="pin-chat">
📌
</button>

</div>

`;

    const pinBtn =
      item.querySelector(".pin-chat");

    const exportBtn =
      item.querySelector(".export-chat");

    exportBtn.onclick = () => {

      const exportData = {

        title: conv.title,

        createdAt: conv.createdAt,

        updatedAt: conv.updatedAt,

        messages: conv.messages || []

      };

      const blob = new Blob(

        [JSON.stringify(exportData, null, 2)],

        {

          type: "application/json"

        }

      );

      const url =
        URL.createObjectURL(blob);

      const a =
        document.createElement("a");

      a.href = url;

      a.download =
        `${conv.title.replace(/[\\/:*?"<>|]/g, "_")}.json`;

      a.click();

      URL.revokeObjectURL(url);

      showToast("📤 Chat Exported");

    };

    pinBtn.onclick = async () => {

      conv.pinned = !conv.pinned;

      try {

        await setDoc(

          doc(

            db,

            "users",

            window.currentUser.uid,

            "conversations",

            conv.id

          ),

          {

            ...conv

          }

        );

        await loadConversations();

        renderHistoryList(

          historySearch.value.toLowerCase()

        );

        showToast(

          conv.pinned

            ? "📌 Chat Pinned"

            : "📍 Chat Unpinned"

        );

      }

      catch (err) {

        console.log(err);

      }

    };


    // OPEN

    item.querySelector(".open-chat").onclick = async () => {

      historyOverlay.style.display = "none";

      currentConversationId = conv.id;

      await openConversation(conv.id);

      renderHistoryList(
        historySearch.value.toLowerCase()
      );

    };


    // RENAME

    item.querySelector(".rename-chat").onclick = async () => {

      const title = prompt(
        "Rename conversation",
        conv.title
      );

      if (!title || title.trim() === "") return;

      try {

        conv.title = title.trim();

        await setDoc(

          doc(

            db,

            "users",

            window.currentUser.uid,

            "conversations",

            conv.id

          ),

          {

            ...conv,

            title: title.trim(),

            updatedAt: Date.now()

          }

        );

        await loadConversations();

        renderHistoryList(

          historySearch.value.toLowerCase()

        );

        showToast("✏️ Conversation Renamed");

      }

      catch (err) {

        console.log(err);

        showToast("Rename Failed");

      }

    };

    // DELETE

    item.querySelector(".delete-chat").onclick = async () => {

      if (!confirm("Delete this conversation?"))
        return;

      try {

        await deleteDoc(

          doc(

            db,

            "users",

            window.currentUser.uid,

            "conversations",

            conv.id

          )

        );

        await loadConversations();

        renderHistoryList(
          historySearch.value.toLowerCase()
        );

        showToast("Conversation Deleted");

      }

      catch (err) {

        console.log(err);

      }

    };

    historyList.appendChild(item);

  });

  if (found === 0) {

    historyList.innerHTML = `
        <div class="history-item no-results">

            <div class="history-title">
                🔍 No conversations found
            </div>

            <div class="history-preview">
                Try searching with different keywords.
            </div>

        </div>
    `;

  }

}







const fontSizeSelect =
  document.getElementById("font-size-select");

fontSizeSelect?.addEventListener("change", () => {
  AstroSettings.set("fontSize", fontSizeSelect.value);
  applyAppearanceSettings();
  showToast("🎨 Font size updated");
});

function applyAppearanceSettings() {
  const size = AstroSettings.get("fontSize");
  document.documentElement.style.fontSize = size + "px";

  const bubble = AstroSettings.get("bubbleStyle");
  const width = AstroSettings.get("messageWidth");
  const animation = AstroSettings.get("animations");

  document.querySelectorAll(".message").forEach(msg => {
    msg.style.maxWidth = width + "%";
    msg.style.borderRadius = bubble === "rounded" ? "16px" : "4px";
  });

  const fsEl = document.getElementById("font-size-select");
  if (fsEl) fsEl.value = size;

  const bsEl = document.getElementById("bubble-style");
  if (bsEl) bsEl.value = bubble;

  const mwEl = document.getElementById("message-width");
  if (mwEl) mwEl.value = width;

  const atEl = document.getElementById("animation-toggle");
  if (atEl) atEl.checked = animation;
}

const bubbleStyle = document.getElementById("bubble-style");
bubbleStyle?.addEventListener("change", () => {
  AstroSettings.set("bubbleStyle", bubbleStyle.value);
  applyAppearanceSettings();
  showToast("💬 Bubble Style Updated");
});

const messageWidth = document.getElementById("message-width");
messageWidth?.addEventListener("change", () => {
  AstroSettings.set("messageWidth", messageWidth.value);
  applyAppearanceSettings();
  showToast("📏 Message Width Updated");
});

const animationToggle = document.getElementById("animation-toggle");
animationToggle?.addEventListener("change", () => {
  AstroSettings.set("animations", animationToggle.checked);
  applyAppearanceSettings();
  showToast("✨ Typing Animation Updated");
});

function applyAccentColor() {
  const color = AstroSettings.get("accentColor");
  document.documentElement.style.setProperty("--accent", color);
  const select = document.getElementById("accent-color-select");
  if (select) {
    select.value = color;
  }
}

const accentSelect = document.getElementById("accent-color-select");
accentSelect?.addEventListener("change", () => {
  AstroSettings.set("accentColor", accentSelect.value);
  applyAccentColor();
  showToast("🎨 Accent Updated");
});

const AI_PROVIDERS = {
  google_ai_studio: {
    id: "google_ai_studio",
    name: "Google AI Studio",
    icon: "🌐",
    defaultModel: "google/gemini-3.6-flash",
    models: [
      { id: "google/gemini-3.6-flash", name: "Gemini 3.6 Flash", badge: "Default" },
      { id: "google/gemini-3.5-flash", name: "Gemini 3.5 Flash", badge: "Fast" }
    ]
  },
  groq: {
    id: "groq",
    name: "Groq",
    icon: "⚡",
    defaultModel: "llama-3.3-70b-versatile",
    models: [
      { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", desc: "Best Quality" },
      { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B Instant", desc: "Fast" },
      { id: "openai/gpt-oss-120b", name: "GPT OSS 120B", desc: "Strong Reasoning" },
      { id: "qwen/qwen3.6-27b", name: "Qwen 3.6 27B", desc: "Good Balance" }
    ]
  },
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    icon: "⭐",
    defaultModel: "openai/gpt-4o-mini",
    models: [
      { id: "openai/gpt-4o-mini", name: "GPT-4o Mini", desc: "Fallback" },
      { id: "deepseek/deepseek-v4-flash", name: "DeepSeek V4 Flash", desc: "Fast & Efficient" },
      { id: "deepseek/deepseek-r1", name: "DeepSeek R1", desc: "Reasoning Model" },
      { id: "deepseek/deepseek-chat-v3.1", name: "DeepSeek V3.1", desc: "General Purpose" }
    ]
  }
};

// Per-Model Status Tracking: 'available' (🟢), 'rate_limited' (🟠), 'quota_exceeded' (🔴), 'key_missing' (🔴)
const modelStatuses = {};

function getModelStatus(modelId) {
  return modelStatuses[modelId] || "available";
}

function getSelectedAIProvider() {
  const storedProvider =
    (typeof AstroSettings !== "undefined" ? AstroSettings.get("aiProvider") : null) ||
    localStorage.getItem("aiProvider");

  if (storedProvider && AI_PROVIDERS[storedProvider]) return storedProvider;
  return "google_ai_studio";
}

function getSelectedAIModel() {
  const provider = getSelectedAIProvider();
  const providerConfig = AI_PROVIDERS[provider] || AI_PROVIDERS.google_ai_studio;
  const storedModel =
    (typeof AstroSettings !== "undefined" ? AstroSettings.get("aiModel") : null) ||
    localStorage.getItem("aiModel");

  const validModelIds = providerConfig.models.map(m => m.id);
  if (storedModel && validModelIds.includes(storedModel)) {
    return storedModel;
  }

  // Fallback to provider default model
  const defaultModel = providerConfig.defaultModel;
  if (typeof AstroSettings !== "undefined") AstroSettings.set("aiModel", defaultModel);
  localStorage.setItem("aiModel", defaultModel);
  return defaultModel;
}

function getModelDisplayName(modelId) {
  for (const key in AI_PROVIDERS) {
    const provider = AI_PROVIDERS[key];
    const found = provider.models.find(m => m.id === modelId);
    if (found) {
      return found.name;
    }
  }
  if (modelId.includes("gemini-3.6")) return "Gemini 3.6 Flash";
  if (modelId.includes("gemini-3.5")) return "Gemini 3.5 Flash";
  if (modelId.includes("llama-3.3")) return "Llama 3.3 70B";
  if (modelId.includes("llama-3.1")) return "Llama 3.1 8B Instant";
  if (modelId.includes("gpt-oss")) return "GPT OSS 120B";
  if (modelId.includes("qwen3.6")) return "Qwen 3.6 27B";
  if (modelId.includes("gpt-4o-mini")) return "GPT-4o Mini";
  if (modelId.includes("deepseek-v4")) return "DeepSeek V4 Flash";
  if (modelId.includes("deepseek-r1")) return "DeepSeek R1";
  if (modelId.includes("deepseek-chat-v3.1") || modelId.includes("deepseek-v3") || modelId.includes("deepseek-chat")) return "DeepSeek V3.1";
  return modelId;
}

function updateModelPickerButton() {
  const labelEl = document.getElementById("current-model-name");
  if (labelEl) {
    const currentModelId = getSelectedAIModel();
    labelEl.textContent = getModelDisplayName(currentModelId);
  }
}

function renderModelPopup() {
  const popupContent = document.getElementById("model-popup-content");
  if (!popupContent) return;

  const currentModel = getSelectedAIModel();

  let html = "";

  for (const providerKey in AI_PROVIDERS) {
    const provider = AI_PROVIDERS[providerKey];

    html += `
      <div class="model-group">
        <div class="model-group-header">
          <div class="model-group-title">
            <span>${provider.name}</span>
          </div>
        </div>
        <div class="model-group-list">
    `;

    provider.models.forEach(model => {
      const isSelected = model.id === currentModel;
      const status = getModelStatus(model.id);
      const isUnavailable = status !== "available";

      let statusBadge = "";
      if (status === "quota_exceeded") {
        statusBadge = '<span class="provider-status-badge quota_exceeded">Quota Exceeded</span>';
      } else if (status === "rate_limited") {
        statusBadge = '<span class="provider-status-badge rate_limited">Rate Limited</span>';
      } else if (status === "key_missing") {
        statusBadge = '<span class="provider-status-badge key_missing">Key Missing</span>';
      } else {
        const tagText = model.desc || model.badge || "";
        if (tagText) {
          statusBadge = `<span class="model-item-tag">${tagText}</span>`;
        }
      }

      const warnIcon = isUnavailable ? '<span class="model-item-warn-icon">⚠️</span>' : '';
      const selectedCheck = isSelected ? '<span class="model-item-check">✓</span>' : '';

      html += `
        <button type="button" class="model-item ${isSelected ? 'selected' : ''}" data-provider="${providerKey}" data-model="${model.id}">
          <div class="model-item-left">
            <div class="model-item-name">
              ${warnIcon}
              <span>${model.name}</span>
            </div>
            ${statusBadge}
          </div>
          ${selectedCheck}
        </button>
      `;
    });

    html += `
        </div>
      </div>
    `;
  }

  popupContent.innerHTML = html;

  // Bind model selection clicks
  const modelButtons = popupContent.querySelectorAll(".model-item");
  modelButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const prov = btn.getAttribute("data-provider");
      const mod = btn.getAttribute("data-model");

      if (prov && mod) {
        AstroSettings.set("aiProvider", prov);
        AstroSettings.set("aiModel", mod);
        localStorage.setItem("aiProvider", prov);
        localStorage.setItem("aiModel", mod);

        updateModelPickerButton();
        renderModelPopup();

        const popup = document.getElementById("ai-model-popup");
        if (popup) popup.classList.add("hidden");

        const pickerBtn = document.getElementById("ai-model-picker-btn");
        if (pickerBtn) pickerBtn.classList.remove("open");

        showToast("🤖 Model switched to " + getModelDisplayName(mod));
      }
    });
  });
}

function initModelPickerEvents() {
  const pickerBtn = document.getElementById("ai-model-picker-btn");
  const popup = document.getElementById("ai-model-popup");
  const closeBtn = document.getElementById("close-model-popup");

  if (pickerBtn && popup) {
    pickerBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = !popup.classList.contains("hidden");
      if (isOpen) {
        popup.classList.add("hidden");
        pickerBtn.classList.remove("open");
      } else {
        renderModelPopup();
        popup.classList.remove("hidden");
        pickerBtn.classList.add("open");
      }
    });
  }

  if (closeBtn && popup && pickerBtn) {
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      popup.classList.add("hidden");
      pickerBtn.classList.remove("open");
    });
  }

  document.addEventListener("click", (e) => {
    if (popup && !popup.classList.contains("hidden")) {
      const wrapper = document.getElementById("ai-model-picker-wrapper");
      if (wrapper && !wrapper.contains(e.target)) {
        popup.classList.add("hidden");
        if (pickerBtn) pickerBtn.classList.remove("open");
      }
    }
  });

  updateModelPickerButton();
}

function formatApiErrorResponse(statusCode, errorObj, providerId) {
  const message = typeof errorObj === "string"
    ? errorObj
    : (errorObj?.message || errorObj?.error?.message || JSON.stringify(errorObj));

  const code = statusCode || errorObj?.code || errorObj?.status;

  const currentProvider = providerId || (typeof getSelectedAIProvider === "function" ? getSelectedAIProvider() : "openrouter");
  const providerName = (typeof AI_PROVIDERS !== "undefined" && AI_PROVIDERS[currentProvider])
    ? AI_PROVIDERS[currentProvider].name
    : (currentProvider === "google_ai_studio" ? "Google AI Studio" : currentProvider === "groq" ? "Groq" : "AI Service");

  if (code === 400) {
    return `Invalid request/model: ${message}`;
  }
  if (code === 401) {
    return `Invalid API key: ${message}`;
  }
  if (code === 402) {
    return `Insufficient credits / quota: ${message}`;
  }
  if (code === 403) {
    return `Forbidden: ${message}`;
  }
  if (code === 404) {
    return `Resource not found: ${message}`;
  }
  if (code === 429) {
    return `Quota exceeded / Rate limit: ${message}`;
  }
  if (typeof code === "number" && code >= 500) {
    return `${providerName} server error (${code}): ${message}`;
  }

  return message ? `API Error (${code || "Unknown"}): ${message}` : "An unknown API error occurred.";
}

function handleModelQuotaExceeded(failedModelId, errorMessage) {
  const msg = String(errorMessage || "").toLowerCase();

  // Strict key missing check: Only when key is explicitly missing/empty or unconfigured
  const isKeyMissing = (
    msg.includes("key is missing") ||
    msg.includes("key is not configured") ||
    msg.includes("no api key") ||
    msg.includes("api key required")
  ) && !msg.includes("rate") && !msg.includes("quota") && !msg.includes("limit") && !msg.includes("unavailable") && !msg.includes("invalid");

  const isRateLimit = (
    msg.includes("rate") ||
    msg.includes("429") ||
    msg.includes("too many requests")
  );

  if (isKeyMissing) {
    modelStatuses[failedModelId] = "key_missing";
  } else if (isRateLimit) {
    modelStatuses[failedModelId] = "rate_limited";
  } else {
    modelStatuses[failedModelId] = "quota_exceeded";
  }

  const failedName = getModelDisplayName(failedModelId);

  // Update popup if open so status badge appears for failed model
  renderModelPopup();

  if (msg.includes("unavailable") || msg.includes("invalid model") || msg.includes("not a valid model id")) {
    return `The model ${failedName} is currently unavailable or invalid. Please select any other model.`;
  }

  return `${failedName} quota is exceeded, please select any other model.`;
}

function applyAISettings() {
  const responseLength = AstroSettings.get("responseLength");
  const creativity = AstroSettings.get("creativity");

  updateModelPickerButton();

  const responseSelect = document.getElementById("response-length");
  const creativitySelect = document.getElementById("creativity-select");
  const saveChatHistoryToggle = document.getElementById("toggle-save-chat-history");
  const cloudSyncToggle = document.getElementById("toggle-cloud-sync");

  if (responseSelect) responseSelect.value = responseLength;
  if (creativitySelect) creativitySelect.value = creativity;
  if (saveChatHistoryToggle) saveChatHistoryToggle.checked = AstroSettings.get("saveChatHistory");
  if (cloudSyncToggle) cloudSyncToggle.checked = AstroSettings.get("cloudSync");
}

const responseLengthSelect = document.getElementById("response-length");
const creativitySelect = document.getElementById("creativity-select");

responseLengthSelect?.addEventListener("change", () => {
  AstroSettings.set("responseLength", responseLengthSelect.value);
  applyAISettings();
  showToast("🤖 AI Settings Saved");
});

creativitySelect?.addEventListener("change", () => {
  AstroSettings.set("creativity", creativitySelect.value);
  applyAISettings();
  showToast("🤖 AI Settings Saved");
});

const saveChatHistoryEl = document.getElementById("toggle-save-chat-history");
saveChatHistoryEl?.addEventListener("change", () => {
  AstroSettings.set("saveChatHistory", saveChatHistoryEl.checked);
  applyAISettings();
  showToast("🤖 AI Chat History Settings Saved");
});

const cloudSyncToggle = document.getElementById("toggle-cloud-sync");
cloudSyncToggle?.addEventListener("change", () => {
  AstroSettings.set("cloudSync", cloudSyncToggle.checked);
  applyAISettings();
  showToast("🤖 Cloud Sync Settings Saved");
});

applyAISettings();

function updateMemorySettings() {

  const memories = astroMemory.memories || [];
  const theories = astroMemory.theories || [];
  const observations = astroMemory.observations || [];
  const equipments = astroMemory.memories || [];

  document.getElementById("memory-total").textContent =
    memories.length + theories.length + observations.length;

  document.getElementById("memory-pref-count").textContent =
    memories.length;

  document.getElementById("memory-theory-count").textContent =
    theories.length;

  document.getElementById("memory-observation-count").textContent =
    observations.length;

  document.getElementById("memory-telescope-count").textContent =
    astroMemory.telescopeSessions?.length || 0;

  document.getElementById("memory-file-count").textContent =
    astroMemory.files?.length || 0;



  document.getElementById("memory-telescope-equipment-count").textContent =
    equipments.filter(m =>
      m.category === "equipment" &&
      m.key === "telescope"
    ).length;

  document.getElementById("memory-camera-count").textContent =
    equipments.filter(m =>
      m.category === "equipment" &&
      m.key === "camera"
    ).length;

  document.getElementById("memory-binocular-count").textContent =
    equipments.filter(m =>
      m.category === "equipment" &&
      m.key === "binoculars"
    ).length;

  document.getElementById("memory-eyepiece-count").textContent =
    equipments.filter(m =>
      m.category === "equipment" &&
      m.key === "eyepiece"
    ).length;

}

function renderPinSVG(isPinned, size = 18) {
  if (isPinned) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#00f5ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="pin-icon is-pinned">
      <line x1="2" y1="2" x2="22" y2="22"></line>
      <line x1="12" y1="17" x2="12" y2="22"></line>
      <path d="M9 9v1.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h12m2 0v-1.76a2 2 0 0 0-.44-1.24"></path>
      <path d="M15 9.34V5h1a1 1 0 0 0 0-2H9"></path>
    </svg>`;
  } else {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="pin-icon">
      <line x1="12" y1="17" x2="12" y2="22"></line>
      <path d="M5 17h14l-1.5-6H19l-1.2-4.8A2 2 0 0 0 15.8 4H8.2a2 2 0 0 0-1.96 1.2L5 11h1.5L5 17z"></path>
    </svg>`;
  }
}

function renderMemoryList() {

  console.log("Memories:", astroMemory);
  console.table(getAllMemoryItems());

  const list = document.getElementById("memory-list");

  if (!list) return;

  let memories = getAllMemoryItems();

  const search =
    document.getElementById("memory-search")?.value
      ?.toLowerCase() || "";

  const filter =
    document.getElementById("memory-filter")?.value
    || "all";

  // Search
  // Search
  if (search) {

    memories = memories.filter(m =>

      (m.text || "")
        .toLowerCase()
        .includes(search)

    );

  }

  // Filter
  if (filter === "memory") {

    memories = memories.filter(m =>
      m.type === "Memory" &&
      m.category !== "equipment"
    );

  }

  else if (filter === "theory") {

    memories = memories.filter(m =>
      m.type === "Theory"
    );

  }

  else if (filter === "observation") {

    memories = memories.filter(m =>
      m.type === "Observation"
    );

  }

  else if (filter === "telescope") {

    memories = memories.filter(m =>
      m.category === "equipment" &&
      m.key === "telescope"
    );

  }

  else if (filter === "telescope_session") {

    memories = memories.filter(m =>
      m.type === "Telescope"
    );

  }

  else if (filter === "camera") {

    memories = memories.filter(m =>
      m.category === "equipment" &&
      m.key === "camera"
    );

  }

  else if (filter === "binoculars") {

    memories = memories.filter(m =>
      m.category === "equipment" &&
      m.key === "binoculars"
    );

  }

  else if (filter === "eyepiece") {

    memories = memories.filter(m =>
      m.category === "equipment" &&
      m.key === "eyepiece"
    );

  }

  else if (filter === "file") {

    memories = memories.filter(m =>
      m.type === "File"
    );

  }

  else if (filter === "favorite") {

    memories = memories.filter(m =>
      m.favorite
    );

  }

  else if (filter === "pinned") {

    memories = memories.filter(m =>
      m.pinned
    );

  }




  // Sort
  memories.sort((a, b) => {

    if (a.pinned !== b.pinned)
      return b.pinned - a.pinned;

    if (a.favorite !== b.favorite)
      return b.favorite - a.favorite;

    return new Date(b.time) - new Date(a.time);

  });

  if (memories.length === 0) {

    list.innerHTML = `
            <div class="memory-empty">

                <h3>🧠 No Memories</h3>

                <p>
                    Saved memories will appear here.
                </p>

            </div>
        `;

    return;
  }

  list.innerHTML = "";
  let currentTimeline = "";

  memories.forEach(memory => {

    const timeline = getTimelineLabel(memory.time);

    if (timeline !== currentTimeline) {



    }

    const card = document.createElement("div");

    card.className = "memory-card";

    card.innerHTML = `

<div class="memory-top">

<div class="memory-title">

${memory.type === "File"
        ? "📄 File"

        : memory.type === "Telescope"
          ? "🛰 Telescope Session"

          : memory.category === "equipment"
            ? (
              memory.key === "telescope"
                ? "🔭 Telescope"

                : memory.key === "camera"
                  ? "📷 Camera"

                  : memory.key === "binoculars"
                    ? "🔭 Binoculars"

                    : memory.key === "eyepiece"
                      ? "👁️ Eyepiece"

                      : "🔧 Equipment"
            )

            : memory.type === "Theory"
              ? "📚 Theory"

              : memory.type === "Observation"
                ? "🔭 Observation"

                : "🧠 Memory"
      }
</div>

<div class="memory-icons">

${memory.type === "File"

        ?

        ""

        :

        `
<button type="button" class="memory-btn ${memory.pinned ? 'active' : ''}" onclick="togglePin(${memory.id})" title="${memory.pinned ? 'Unpin' : 'Pin'}">
  ${renderPinSVG(Boolean(memory.pinned), 18)}
</button>
<button type="button" class="memory-btn ${memory.favorite ? 'active' : ''}" onclick="toggleFavorite(${memory.id})" title="${memory.favorite ? 'Remove Favorite' : 'Save Favorite'}">
  ${memory.favorite ? "⭐" : "☆"}
</button>
`

      }

</div>

</div>

<div class="memory-body">

${memory.type === "File"

        ?

        `
<div><strong>📄 ${memory.name}</strong></div>

<div style="margin-top:6px;font-size:13px;opacity:.8;">

Type:
${memory.fileType || "Unknown"}

<br>

Size:
${(memory.size / 1024).toFixed(1)} KB

</div>
`

        :

        memory.text

      }

</div>

<div class="memory-bottom">

<div class="memory-time">

${formatMemoryDate(memory.time)}

</div>

<div class="memory-actions">



${memory.type === "File"

        ?

        `

<button
class="memory-btn delete-btn"
onclick="removeFileMemory(${memory.id})">

📄 Remove File

</button>

`

        :

        `

<button
class="memory-btn edit-btn"
onclick="editMemory(${memory.id})">

✏ Edit

</button>

<button
class="memory-btn delete-btn"
onclick="deleteMemoryById(${memory.id})">

🗑 Delete

</button>

`

      }

</div>

</div>

`;

    list.appendChild(card);

  });

}

function findMemoryById(id) {

  const groups = [

    astroMemory.memories || [],
    astroMemory.theories || [],
    astroMemory.observations || [],
    astroMemory.telescopeSessions || []

  ];

  for (const group of groups) {

    const memory = group.find(m => m.id == id);

    if (memory) return memory;

  }

  return null;

}

function deleteMemoryById(id) {

  if (!confirm("Delete this memory?")) return;

  [
    astroMemory.memories,
    astroMemory.theories,
    astroMemory.observations,
    astroMemory.telescopeSessions

  ].forEach(arr => {

    const index = arr.findIndex(m => m.id == id);

    if (index != -1) {

      arr.splice(index, 1);

    }

  });

  localStorage.setItem(

    "astroMemory",

    JSON.stringify(astroMemory)

  );

  saveCloudMemory();

  updateMemorySettings();

  renderMemoryList();

}

function removeFileMemory(id) {

  if (!confirm("Remove this file from memory?"))
    return;

  const index =
    astroMemory.files.findIndex(f => f.id == id);

  if (index === -1)
    return;

  astroMemory.files.splice(index, 1);

  localStorage.setItem(

    "astroMemory",

    JSON.stringify(astroMemory)

  );

  saveCloudMemory();

  updateMemorySettings();

  updateGeneralSettings();

  renderMemoryList();

  showToast("📄 File Removed");

}

function editMemory(id) {

  const memory = findMemoryById(id);

  if (!memory) return;

  editingMemory = memory;

  document.getElementById(
    "edit-memory-text"
  ).value = memory.text;

  document
    .getElementById("edit-memory-overlay")
    .classList.add("show");

}
function togglePin(id) {

  const memory = findMemoryById(id);

  if (!memory) return;

  memory.pinned = !memory.pinned;

  memory.updatedAt = new Date().toISOString();

  localStorage.setItem(

    "astroMemory",

    JSON.stringify(astroMemory)

  );

  saveCloudMemory();

  updateMemorySettings();

  renderMemoryList();

}

function toggleFavorite(id) {

  const memory = findMemoryById(id);

  if (!memory) return;

  memory.favorite = !memory.favorite;

  memory.updatedAt = new Date().toISOString();

  localStorage.setItem(

    "astroMemory",

    JSON.stringify(astroMemory)

  );

  saveCloudMemory();

  updateMemorySettings();

  renderMemoryList();

}

function getAllMemoryItems() {

  return [

    ...(astroMemory.memories || []).map(m => ({
      ...m,
      type: "Memory",
      source: "memories"
    })),

    ...(astroMemory.theories || []).map(m => ({
      ...m,
      type: "Theory",
      source: "theories"
    })),

    ...(astroMemory.observations || []).map(m => ({
      ...m,
      type: "Observation",
      source: "observations"
    })),

    ...(astroMemory.telescopeSessions || []).map(m => ({
      ...m,
      type: "Telescope",
      source: "telescopeSessions"
    })),

    ...(astroMemory.files || []).map(f => ({
      ...f,

      text: f.name,

      fileType: f.type,

      type: "File",

      source: "files"

    }))

  ];

}

document.getElementById("export-memory")
  ?.addEventListener("click", () => {

    const blob = new Blob(

      [
        JSON.stringify(
          astroMemory,
          null,
          2
        )
      ],

      {
        type: "application/json"
      }

    );

    const url =
      URL.createObjectURL(blob);

    const a =
      document.createElement("a");

    a.href = url;

    a.download =
      "astro-memory.json";

    a.click();

    URL.revokeObjectURL(url);

  });

document.getElementById("export-memory")
  ?.addEventListener("click", () => {

    const blob = new Blob(

      [
        JSON.stringify(
          astroMemory,
          null,
          2
        )
      ],

      {
        type: "application/json"
      }

    );

    const url =
      URL.createObjectURL(blob);

    const a =
      document.createElement("a");

    a.href = url;

    a.download =
      "astro-memory.json";

    a.click();

    URL.revokeObjectURL(url);

  });

document
  .getElementById("import-memory")
  ?.addEventListener("click", () => {

    const input =
      document.createElement("input");

    input.type = "file";

    input.accept = ".json";

    input.onchange = e => {

      const file =
        e.target.files[0];



      if (!file) return;

      const reader =
        new FileReader();

      reader.onload = () => {

        try {

          astroMemory =
            JSON.parse(reader.result);

          astroMemory.files ??= [];
          astroMemory.memories ??= [];
          astroMemory.theories ??= [];
          astroMemory.observations ??= [];
          astroMemory.telescopeSessions ??= [];

          localStorage.setItem(

            "astroMemory",

            JSON.stringify(astroMemory)

          );

          saveCloudMemory();

          updateMemorySettings();

          renderMemoryList();

          alert("Memory Imported.");

        }

        catch {

          alert("Invalid File.");

        }

      };

      reader.readAsText(file);

    };

    input.click();

  });

document
  .getElementById("clear-memory")
  ?.addEventListener("click", () => {

    if (

      !confirm(

        "Delete ALL memories?"

      )

    )

      return;

    astroMemory = {

      memories: [],

      theories: [],

      observations: [],

      telescopeSessions: [],

      files: []

    };

    localStorage.setItem(

      "astroMemory",

      JSON.stringify(astroMemory)

    );

    saveCloudMemory();

    updateMemorySettings();

    renderMemoryList();

  });

function showMemorySuggestion(memory) {

  console.log("Calling showMemorySuggestion");
  console.log("Pending:", pendingStructuredMemory);

  let duplicate;

  if (memory.type === "Theory") {

    duplicate = findDuplicateInArray(
      astroMemory.theories,
      memory.value
    );

  }
  else if (memory.type === "Observation") {

    duplicate = findDuplicateInArray(
      astroMemory.observations,
      memory.value
    );

  }
  else if (memory.type === "Telescope") {

    duplicate = findDuplicateInArray(
      astroMemory.telescopeSessions,
      memory.value
    );

  }
  else {

    duplicate = findDuplicateMemory(memory);

  }

  console.log("Memory:", memory);
  console.log("Duplicate:", duplicate);
  console.log("All Memories:", astroMemory.memories);


  const existing =
    document.getElementById("memory-suggestion");

  if (existing) existing.remove();

  const box = document.createElement("div");

  box.id = "memory-suggestion";

  box.innerHTML = `

<h3>

${memory.type === "Theory"

      ? "📚 Theory Detected"

      : memory.type === "Observation"

        ? "🔭 Observation Detected"

        : memory.type === "Telescope"

          ? "🔭 Telescope Session Detected"

          : "🧠 Memory Detected"

    }

</h3>

<div class="memory-preview-row">

<b>Category</b>

<span>${memory.category}</span>

</div>

<div class="memory-preview-row">

<b>Key</b>

<span>${memory.key}</span>

</div>

<div class="memory-preview-row">

<b>Value</b>

<span>${memory.value}</span>

</div>

${duplicate ?

      `

<div class="duplicate-warning">

⚠ Similar memory already exists.

<br><br>

<b>Old:</b>

${duplicate.value || duplicate.text}

<br>

<b>New:</b>

${memory.value}

</div>

`

      :

      ""

    }

<div class="memory-suggest-buttons">

${duplicate ?

      `

<button id="update-memory-btn">

Update Existing

</button>

<button id="save-new-memory-btn">

Save New

</button>

`

      :

      `

<button id="remember-btn">

Remember

</button>

`

    }

<button id="edit-memory-preview-btn">

Edit

</button>

<button id="dismiss-memory-btn">

Dismiss

</button>

`;

  document
    .getElementById("memory-suggestion-container")
    .appendChild(box);

  box.scrollIntoView({
    behavior: "smooth"
  });

  document
    .getElementById("remember-btn")
    ?.addEventListener("click", () => {


      if (memory.category === "Theory") {

        saveTheory(memory.value, true);

      }

      else if (memory.category === "Observation") {

        saveObservation(memory.value, true);

      }

      else if (memory.category === "Telescope") {

        saveTelescopeSession(memory.value, true);

      }

      else {

        saveMemory(memory);

      }

      box.remove();

      showToast("🧠 Memory Saved");

    });

  document
    .getElementById("update-memory-btn")
    ?.addEventListener("click", () => {

      duplicate.value = memory.value;

      duplicate.text = memory.value;

      duplicate.updatedAt = new Date().toISOString();

      localStorage.setItem(
        "astroMemory",
        JSON.stringify(astroMemory)
      );

      saveCloudMemory();

      updateMemorySettings();

      renderMemoryList();

      box.remove();

      showToast("🧠 Memory Updated");

    });

  document
    .getElementById("save-new-memory-btn")
    ?.addEventListener("click", () => {

      if (memory.category === "Theory") {

        saveTheory(memory.value, true);

      }

      else if (memory.category === "Observation") {

        saveObservation(memory.value, true);

      }

      else if (memory.category === "Telescope") {

        saveTelescopeSession(memory.value, true);

      }

      else {

        saveMemory(memory);

      }

      box.remove();

      showToast("🧠 New Memory Saved");

    });

  document
    .getElementById("edit-memory-preview-btn")
    .onclick = () => {

      const value = prompt(
        "Edit Memory",
        memory.value
      );

      if (value === null) return;

      memory.value = value;

      box.querySelectorAll("span")[2].textContent = value;

    };

  document
    .getElementById("dismiss-memory-btn")
    .onclick = () => {

      box.remove();

    };

}

function saveFileMemory(file) {

  if (!astroMemory.files) {

    astroMemory.files = [];

  }

  astroMemory.files.push({

    id: Date.now(),

    name: file.name,

    type: file.type,

    size: file.size,

    uploadedAt: new Date().toISOString(),

    time: new Date().toISOString(),

    summary: "",

    tags: [],

    pinned: false,

    favorite: false

  });

  localStorage.setItem(

    "astroMemory",

    JSON.stringify(astroMemory)

  );

  saveCloudMemory();

  updateMemorySettings();

}

function getRelevantMemories(question) {

  const q = question.toLowerCase();

  const memories = getAllMemoryItems();

  return memories.filter(m => {

    const text = (m.text || "").toLowerCase();
    const value = (m.value || "").toLowerCase();
    const key = (m.key || "").toLowerCase();

    return (
      q.includes(key) ||
      q.includes(value) ||
      text.includes(q) ||
      q.includes(text)
    );

  });

}

function buildMemoryContext(question) {
  const memories = getRelevantMemories(question);
  if (!memories || memories.length === 0) return "";

  const unique = [];
  const seen = new Set();

  for (const m of memories) {
    const textStr = (m.text || m.value || m.key || "").trim();
    if (textStr && !seen.has(textStr.toLowerCase())) {
      seen.add(textStr.toLowerCase());
      unique.push(`- ${m.type || "Memory"}: ${textStr}`);
    }
  }

  return unique.slice(0, 3).join("\n");
}

function getTimelineLabel(date) {

  const now = new Date();

  const d = new Date(date);

  const diff = Math.floor(
    (now - d) / (1000 * 60 * 60 * 24)
  );

  if (diff === 0) return "📅 Today";

  if (diff === 1) return "📆 Yesterday";

  if (diff <= 7) return "🗓 Last 7 Days";

  if (diff <= 30) return "📁 Last Month";

  return "📦 Older";

}

function formatMemoryDate(time) {

  const d = new Date(time);

  const now = new Date();

  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const target = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate()
  );

  if (target.getTime() === today.getTime()) {

    return "Today • " + d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });

  }

  if (target.getTime() === yesterday.getTime()) {

    return "Yesterday • " + d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });

  }

  return d.toLocaleDateString([], {
    day: "numeric",
    month: "short",
    year: "numeric"
  });

}

// Load saved settings first so user preferences are available
// when window.skySettings is constructed below.
AstroSettings.load();

var skySettings = window.skySettings = {

  showStars: true,
  showMilkyWay: true,
  showSun: true,
  showMoon: true,
  showPlanets: true,
  showHorizon: true,
  showHorizonLine: true,

  showAtmosphere: false,
  showTwilight: false,
  horizonGlow: false,
  showHorizonGlow: false,

  showAsterisms: true,
  showConstellationLines: true,
  showConstellationNames: false,
  showConstellationLabels: false,
  showConstellationArt: false,
  showConstellationArtwork: false,

  showComets: true,
  showAsteroids: true,

  showSatellites: false,
  showSpacecraft: false,
  showMeteors: false,
  showMeteorShowers: false,

  showDSOs: true,
  showFOV: false,
  showTelescopeFOV: false,

  showEquatorialGrid: false,
  showEqGrid: false,
  showAltAzGrid: false,
  showAzGrid: false,
  showCardinalPoints: true,
  showCardinals: true,

  // Planet sub-toggles (independent)
  showPlanetSymbols: true,
  showPlanetNames: true,

  showStarLabels: true,
  showPlanetLabels: true,
  showDSOLabels: true,

  showObjectTrails: true,
  showFuturePath: true,
  showRisePath: true,
  showSetPath: true,
  showTransitPath: true,

  showOrbits: true,
  showMarker: true,
  showCoordinates: true,

  defaultZoom: 1,
  smoothAnimations: true,
  timeSpeed: 1,

  starMagnitude: 4,
  dsoMagnitude: 4,

  // Grid / Reference Lines
  showEcliptic: false,
  showCelestialEquator: false,
  showGalacticPlane: false,
  showMeridian: false,
  showZenithMarker: false,

  // Round 2: Atmosphere Settings
  enableRefraction: true,
  skyBrightness: 0.5,
  moonlightBrightness: 0.5,
  lightPollution: 9,
  airTransparency: 0.8,

  // Round 3: Visual Effects Settings
  enableTwinkling: true,
  twinklingSpeed: 0.5,
  twinklingIntensity: 0.5,
  starColorSaturation: 1.0,
  enableDeepSkyGlow: true,
  deepSkyGlowIntensity: 0.5,
  mwBrightness: 1.0,

  ...AstroSettings.get("skySettings")

};

// Ensure user-saved settings are loaded before applying to skySettings
// AstroSettings.load() was already called earlier in initialization.
// syncToGlobals() will push any saved skySettings into window.skySettings.
AstroSettings.syncToGlobals();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    try { initSkySettings(); } catch (e) { }
  });
} else {
  try { initSkySettings(); } catch (e) { }
}


function updateSkySettingValue(key, val, options = {}) {

  console.log("KEY:", key, "VALUE:", val);

  skySettings[key] = val;
  console.log("AFTER SAVE:", key, "=", skySettings[key]);
  if (key === "showCelestialObjects" || key === "showDSOs") {

    updateSearchStateForCelestialToggle();

    setTimeout(() => {
      updateSearchStateForCelestialToggle();
    }, 0);
  }
  if (key === "lightPollution") {
    window.lightPollution = val;
  }
  if (key === "showRendererOverlay" && window.rendererManager) {
    window.rendererManager.setOverlayVisible(val);
  }
  if (key === "showConstellations" || key === "showConstellationLines" || key === "showConstellationNames") {
    skySettings.showConstellations = val;
    skySettings.showConstellationLines = val;
    skySettings.showConstellationNames = val;
    skySettings.showConstellationLabels = val;
    AstroSettings.set("skySettings.showConstellations", val);
    AstroSettings.set("skySettings.showConstellationLines", val);
    AstroSettings.set("skySettings.showConstellationNames", val);
  }

  if (key === "showAsterisms" || key === "showAsterismNames") {
    skySettings.showAsterisms = val;
    skySettings.showAsterismNames = val;
    AstroSettings.set("skySettings.showAsterisms", val);
    AstroSettings.set("skySettings.showAsterismNames", val);
  }

  if (key === "showConstellationArt" || key === "showConstellationArtwork") {
    skySettings.showConstellationArt = val;
    skySettings.showConstellationArtwork = val;
    AstroSettings.set("skySettings.showConstellationArt", val);
    AstroSettings.set("skySettings.showConstellationArtwork", val);
  }

  // 1. Sync all data-sky-setting inputs (Quick panel + Main Settings)
  document.querySelectorAll(`input[data-sky-setting="${key}"]`).forEach(input => {
    if (input.type === "checkbox") {
      input.checked = !!val;
    } else {
      input.value = val;
    }
  });

  if (key === "showConstellations" || key === "showConstellationLines" || key === "showConstellationNames") {
    document.querySelectorAll(`input[data-sky-setting="showConstellations"], input[data-sky-setting="showConstellationLines"], #toggle-constellations`).forEach(input => {
      if (input.type === "checkbox") input.checked = !!val;
    });
  }

  if (key === "showAsterisms" || key === "showAsterismNames") {
    document.querySelectorAll(`input[data-sky-setting="showAsterisms"], #toggle-asterisms`).forEach(input => {
      if (input.type === "checkbox") input.checked = !!val;
    });
  }

  if (key === "showConstellationArt" || key === "showConstellationArtwork") {
    document.querySelectorAll(`input[data-sky-setting="showConstellationArt"], #toggle-constellation-art`).forEach(input => {
      if (input.type === "checkbox") input.checked = !!val;
    });
  }

  // 2. Sync legacy element IDs in main settings tab
  const legacyMap = {
    showCelestialObjects: "toggle-celestial-objects",
    showStars: "toggle-stars",
    showStarLabels: "toggle-star-labels",
    starMagnitude: "star-magnitude",
    showDSOs: "toggle-dsos",
    showDSOLabels: "toggle-dso-labels",
    dsoMagnitude: "dso-magnitude",
    showMilkyWay: "toggle-milky-way",
    mwBrightness: "mw-brightness-slider",
    showPlanets: "toggle-planets",
    showSun: "toggle-sun",
    showMoon: "toggle-moon",
    showAsteroids: "toggle-asteroids",
    showComets: "toggle-comets",
    showSatellites: "toggle-satellites",
    showSpacecraft: "toggle-spacecraft",
    showMeteors: "toggle-meteors",
    showOrbits: "toggle-orbits",
    showEquatorialGrid: "toggle-equatorial-grid",
    showCelestialEquator: "toggle-celestial-equator",
    showEcliptic: "toggle-ecliptic",
    showGalacticPlane: "toggle-galactic-plane",
    showHorizonLine: "toggle-horizon-line",
    showConstellations: "toggle-constellations",
    showConstellationArt: "toggle-constellation-art",
    showConstellationLines: "toggle-constellations",
    showAsterisms: "toggle-asterisms",
    enableRefraction: "toggle-refraction",
    horizonGlow: "toggle-horizon-glow",
    skyBrightness: "sky-brightness",
    lightPollution: "light-pollution",
    airTransparency: "air-transparency",
    moonlightBrightness: "moonlight-brightness",
    enableTwinkling: "toggle-twinkling",
    twinklingSpeed: "twinkling-speed",
    twinklingIntensity: "twinkling-intensity",
    starColorSaturation: "star-color-saturation"
  };

  if (legacyMap[key]) {
    const el = document.getElementById(legacyMap[key]);
    if (el) {
      if (el.type === "checkbox") el.checked = !!val;
      else el.value = val;
    }
  }

  // 3. Sync display text spans
  const legacyValSpan = document.getElementById(legacyMap[key] + "-value");
  if (legacyValSpan) legacyValSpan.textContent = val;

  document.querySelectorAll(`[data-val-for="${key}"]`).forEach(span => {
    span.textContent = val;
  });

  // 4. Update celestial markers & planet labels if object visibility changed
  if (["showPlanets", "showSun", "showMoon", "showPlanetSymbols", "showPlanetNames", "enableRefraction"].includes(key)) {
    try { updatePlanetMarkers(true); } catch (_) { }
    try { updatePlanetLabelPositions(true); } catch (_) { }
  }

  // 5. Trigger live canvas redraw
  if (!options.silent) {
    refreshSky();
  }
}


function initSkySettings() {
  // Sync initial values to all UI controls
  for (const [key, val] of Object.entries(skySettings)) {
    updateSkySettingValue(key, val, { silent: true });
  }
  updateSearchStateForCelestialToggle();

  // Wire legacy inputs in main settings modal tab
  const bindLegacyInput = (id, key) => {
    const el = document.getElementById(id);
    if (!el) return;
    const handler = function () {
      const val = el.type === "checkbox" ? el.checked : Number(el.value);
      updateSkySettingValue(key, val);
    };
    el.onchange = handler;
    el.oninput = handler;
  };

  const legacyMap = {
    "toggle-celestial-objects": "showCelestialObjects",
    "toggle-stars": "showStars",
    "toggle-star-labels": "showStarLabels",
    "star-magnitude": "starMagnitude",
    "toggle-dsos": "showDSOs",
    "toggle-dso-labels": "showDSOLabels",
    "dso-magnitude": "dsoMagnitude",
    "toggle-milky-way": "showMilkyWay",
    "mw-brightness-slider": "mwBrightness",
    "toggle-planets": "showPlanets",
    "toggle-sun": "showSun",
    "toggle-moon": "showMoon",
    "toggle-asteroids": "showAsteroids",
    "toggle-comets": "showComets",
    "toggle-satellites": "showSatellites",
    "toggle-spacecraft": "showSpacecraft",
    "toggle-meteors": "showMeteors",
    "toggle-orbits": "showOrbits",
    "toggle-equatorial-grid": "showEquatorialGrid",
    "toggle-celestial-equator": "showCelestialEquator",
    "toggle-ecliptic": "showEcliptic",
    "toggle-galactic-plane": "showGalacticPlane",
    "toggle-horizon-line": "showHorizonLine",
    "toggle-constellations": "showConstellations",
    "toggle-constellation-art": "showConstellationArt",
    "toggle-asterisms": "showAsterisms",
    "toggle-refraction": "enableRefraction",
    "toggle-horizon-glow": "horizonGlow",
    "sky-brightness": "skyBrightness",
    "light-pollution": "lightPollution",
    "air-transparency": "airTransparency",
    "moonlight-brightness": "moonlightBrightness",
    "toggle-twinkling": "enableTwinkling",
    "twinkling-speed": "twinklingSpeed",
    "twinkling-intensity": "twinklingIntensity",
    "star-color-saturation": "starColorSaturation",
    "toggle-renderer-overlay": "showRendererOverlay"
  };

  for (const [id, key] of Object.entries(legacyMap)) {
    bindLegacyInput(id, key);
  }

  // Quick Sky Controls Panel Setup
  const toggleBtn = document.getElementById("quick-sky-controls-toggle");
  const panel = document.getElementById("quick-sky-controls-panel");
  const closeBtn = document.getElementById("quick-panel-close-btn");

  if (toggleBtn && panel) {
    toggleBtn.onclick = (e) => {
      e.stopPropagation();
      panel.classList.toggle("quick-panel-hidden");
    };

    if (closeBtn) {
      closeBtn.onclick = (e) => {
        e.stopPropagation();
        panel.classList.add("quick-panel-hidden");
      };
    }

    // Dismiss on click outside
    document.addEventListener("click", (e) => {
      if (!panel.classList.contains("quick-panel-hidden")) {
        if (!panel.contains(e.target) && !toggleBtn.contains(e.target)) {
          panel.classList.add("quick-panel-hidden");
        }
      }
    });

    // Dismiss on ESC key & Toggle Renderer Overlay on Ctrl+Shift+R
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "r") {
        e.preventDefault();
        if (window.rendererManager) {
          window.rendererManager.toggleOverlay();
        }
      }
      if (e.key === "Escape" && !panel.classList.contains("quick-panel-hidden")) {
        panel.classList.add("quick-panel-hidden");
      }
    });

    // Single-Expanded Accordion Logic
    const accordionItems = panel.querySelectorAll(".quick-accordion-item");
    accordionItems.forEach(item => {
      const header = item.querySelector(".quick-accordion-header");
      if (!header) return;

      header.onclick = (e) => {
        e.stopPropagation();
        const isActive = item.classList.contains("active");

        // Collapse all accordion sections first
        accordionItems.forEach(otherItem => {
          otherItem.classList.remove("active");
        });

        // Expand clicked accordion if it wasn't already active
        if (!isActive) {
          item.classList.add("active");
        }
      };
    });
  }

  // Bind all data-sky-setting inputs across both interfaces
  document.querySelectorAll("input[data-sky-setting]").forEach(input => {
    const key = input.getAttribute("data-sky-setting");
    const handler = function () {
      const val = input.type === "checkbox" ? input.checked : Number(input.value);
      updateSkySettingValue(key, val);
    };

    input.oninput = handler;
    input.onchange = handler;
  });

  // Reset Sky Settings Button Logic
  const resetBtn = document.getElementById("reset-sky-settings-btn");
  if (resetBtn) {
    resetBtn.onclick = () => {
      const defaults = AstroSettings.defaults.skySettings;
      AstroSettings.data.skySettings = JSON.parse(JSON.stringify(defaults));
      AstroSettings.save();
      AstroSettings.syncToGlobals();

      for (const [key, val] of Object.entries(defaults)) {
        updateSkySettingValue(key, val, { silent: true });
      }
      refreshSky();
    };
  }
}

function buildCompass() {

  let html = "";

  for (

    let d = -720;

    d <= 720;

    d += 5

  ) {

    let value =

      ((d % 360) + 360) % 360;

    let label = "";

    switch (value) {

      case 0:

        label = "N";

        break;

      case 90:

        label = "E";

        break;

      case 180:

        label = "S";

        break;

      case 270:

        label = "W";

        break;

      default:

        label = value + "°";

    }

    html += `

<div class="compassTick">

${label}

</div>

`;

  }

  compassScale.innerHTML = html;

}

function updateCompassHUD() {

  if (!compassScale)
    return;

  const target = window.skyHeading || 0;

  let diff = target - compassHeading;

  // 359° → 0° jump fix
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;

  // Smooth movement
  let speed = 0.20;

  if (Math.abs(diff) > 20) speed = 0.30;
  if (Math.abs(diff) > 60) speed = 0.40;

  compassHeading += diff * speed;

  const offset = -compassHeading * 8;

  compassScale.style.transform =
    `translateX(${offset}px)`;
}

// ======================================
// Observation Assistant
// ======================================

function updateObservationAssistant() {

  if (!selectedObject) return;

  updateMoonPhase();

  updateVisibleTonight();

  updateBestViewingTime();

  updateObservationRecommendation();

  updateEclipseStatus();

}

// --------------------
// Moon Phase
// --------------------

function updateMoonPhase() {

  const moonEl = document.getElementById("obs-moon-phase");

  if (!moonEl) return;

  const synodic = 29.53058867;

  const knownNewMoon =
    new Date("2000-01-06T18:14:00Z");

  const days =
    (skyTime - knownNewMoon) /
    86400000;

  const age =
    ((days % synodic) + synodic) %
    synodic;

  let phase = "";

  if (age < 1.8)
    phase = "🌑 New";

  else if (age < 7.4)
    phase = "🌒 Waxing";

  else if (age < 9.5)
    phase = "🌓 First Quarter";

  else if (age < 14.8)
    phase = "🌔 Waxing Gibbous";

  else if (age < 16.5)
    phase = "🌕 Full";

  else if (age < 22)
    phase = "🌖 Waning";

  else if (age < 24.5)
    phase = "🌗 Last Quarter";

  else
    phase = "🌘 Waning Crescent";

  moonEl.textContent = phase;

}

// --------------------
// Temporary placeholders
// --------------------

function updateVisibleTonight() {

  const el = document.getElementById("obs-visible-tonight");

  if (!el || !selectedObject) return;

  // Try altitude from selected object
  let altitude = null;

  if (typeof selectedObject.alt === "number") {
    altitude = selectedObject.alt;
  }
  else if (typeof selectedObject.altitude === "number") {
    altitude = selectedObject.altitude;
  }

  // Fallback: read the altitude text already shown in the info panel
  if (altitude === null) {

    const altText =
      document.getElementById("info-alt")?.textContent || "";

    const match = altText.match(/-?\d+(\.\d+)?/);

    if (match)
      altitude = parseFloat(match[0]);

  }

  if (altitude === null) {

    el.textContent = "Unknown";
    return;

  }

  if (altitude > 20) {

    el.textContent = "✅ Yes";

  }
  else if (altitude > 0) {

    el.textContent = "⚠ Low";

  }
  else {

    el.textContent = "❌ No";

  }

}

function updateBestViewingTime() {

  const el = document.getElementById("obs-best-time");

  if (!el) return;

  // Reuse existing Transit time if available
  const transit =
    document.getElementById("info-transit")?.textContent || "";

  const match =
    transit.match(/\d{1,2}:\d{2}(\s?[AP]M)?/i);

  if (match) {

    el.textContent = "🕒 " + match[0];
    return;

  }

  // Fallback to rise time
  const rise =
    document.getElementById("info-rise")?.textContent || "";

  const riseMatch =
    rise.match(/\d{1,2}:\d{2}(\s?[AP]M)?/i);

  if (riseMatch) {

    el.textContent = "🕒 " + riseMatch[0];
    return;

  }

  el.textContent = "--";

}

function updateObservationRecommendation() {

  const el =
    document.getElementById("obs-recommendation");

  if (!el || !selectedObject) return;

  let altitude = null;

  if (typeof selectedObject.alt === "number")
    altitude = selectedObject.alt;

  else if (typeof selectedObject.altitude === "number")
    altitude = selectedObject.altitude;

  if (altitude === null) {

    const altText =
      document.getElementById("info-alt")?.textContent || "";

    const match =
      altText.match(/-?\d+(\.\d+)?/);

    if (match)
      altitude = parseFloat(match[0]);

  }

  if (altitude === null) {

    el.textContent = "--";
    return;

  }

  if (altitude >= 60) {

    el.textContent = "🌟 Excellent observing conditions";

  }
  else if (altitude >= 30) {

    el.textContent = "👍 Good time to observe";

  }
  else if (altitude > 0) {

    el.textContent = "⏳ Wait until object rises higher";

  }
  else {

    el.textContent = "🌍 Object is below the horizon";

  }

}

// Automatically initialize SearchManager and TelescopeManager on page load
document.addEventListener("DOMContentLoaded", () => {
  if (typeof SearchManager !== "undefined" && !SearchManager.initialized) {
    SearchManager.init();
    SearchManager.initialized = true;
  }
  if (typeof TelescopeManager !== "undefined" && !TelescopeManager.initialized) {
    TelescopeManager.init();
    TelescopeManager.initialized = true;
  }
  const skyTabBtn = document.querySelectorAll("#tabs button")[0];
  if (skyTabBtn) {
    skyTabBtn.classList.add("active");
  }
});

// ── TRAJECTORY & OBSERVATION VISUALIZERS ──

function getObjectTrajectoryPaths() {
  if (!selectedObject) return null;

  const coords = _getNavTarget();
  if (!coords) return null;
  const ra = coords[0];  // in degrees
  const dec = coords[1]; // in degrees

  const lat = observer ? observer.latitude : 0;

  // cos(H) = (sin(-0.566) - sin(lat)*sin(dec)) / (cos(lat)*cos(dec))
  let cosH = (Math.sin(-0.566 * Math.PI / 180) - Math.sin(lat * Math.PI / 180) * Math.sin(dec * Math.PI / 180)) /
    (Math.cos(lat * Math.PI / 180) * Math.cos(dec * Math.PI / 180));

  let circumpolar = false;
  let neverRises = false;
  let H = 0;

  if (cosH <= -1) {
    circumpolar = true;
  } else if (cosH >= 1) {
    neverRises = true;
  } else {
    H = Math.acos(cosH) * 180 / Math.PI; // in degrees
  }

  const paths = {
    rise: [],
    set: [],
    transit: [],
    future: []
  };

  if (neverRises) {
    return paths;
  }

  if (circumpolar) {
    for (let angle = 0; angle <= 360; angle += 5) {
      paths.transit.push([(ra - 180 + angle + 360) % 360, dec]);
    }
    paths.future = paths.transit;
  } else {
    const steps = 30;
    for (let i = 0; i <= steps; i++) {
      const offset = -H + (H * i / steps);
      paths.rise.push([(ra + offset + 360) % 360, dec]);
    }
    for (let i = 0; i <= steps; i++) {
      const offset = (H * i / steps);
      paths.set.push([(ra + offset + 360) % 360, dec]);
    }
    paths.transit = [...paths.rise, ...paths.set];

    for (let i = 0; i <= 360; i += 10) {
      paths.future.push([(ra + i) % 360, dec]);
    }
  }

  return paths;
}

function drawTrajectoryPaths() {
  if (!selectedObject) return;

  const context = Celestial.context;
  if (!context) return;

  const paths = getObjectTrajectoryPaths();
  if (!paths) return;

  function drawPathLine(points, strokeStyle, lineWidth, lineDash = []) {
    if (!points || points.length < 2) return;
    context.save();
    context.beginPath();

    let first = true;
    for (const pt of points) {
      if (Celestial.clip(pt)) {
        const pixel = Celestial.mapProjection(pt);
        if (pixel) {
          if (first) {
            context.moveTo(pixel[0], pixel[1]);
            first = false;
          } else {
            context.lineTo(pixel[0], pixel[1]);
          }
        }
      }
    }

    context.strokeStyle = strokeStyle;
    context.lineWidth = lineWidth;
    if (lineDash.length > 0) {
      context.setLineDash(lineDash);
    }
    context.stroke();
    context.restore();
  }

  if (skySettings.showRisePath) {
    drawPathLine(paths.rise, "rgba(0, 255, 100, 0.75)", 2);
  }

  if (skySettings.showSetPath) {
    drawPathLine(paths.set, "rgba(255, 100, 0, 0.75)", 2);
  }

  if (skySettings.showTransitPath) {
    drawPathLine(paths.transit, "rgba(255, 255, 0, 0.5)", 1.2, [4, 4]);
  }

  if (skySettings.showFuturePath) {
    drawPathLine(paths.future, "rgba(200, 100, 255, 0.6)", 1.5, [6, 4]);
  }

  if (skySettings.showObjectTrails && objectTrailHistory.length > 1) {
    context.save();
    context.lineWidth = 2.5;

    for (let i = 1; i < objectTrailHistory.length; i++) {
      const p1 = [objectTrailHistory[i - 1].ra, objectTrailHistory[i - 1].dec];
      const p2 = [objectTrailHistory[i].ra, objectTrailHistory[i].dec];

      if (Celestial.clip(p1) && Celestial.clip(p2)) {
        const pt1 = Celestial.mapProjection(p1);
        const pt2 = Celestial.mapProjection(p2);

        if (pt1 && pt2) {
          const opacity = (i / objectTrailHistory.length) * 0.8;
          context.strokeStyle = `rgba(0, 245, 255, ${opacity})`;
          context.beginPath();
          context.moveTo(pt1[0], pt1[1]);
          context.lineTo(pt2[0], pt2[1]);
          context.stroke();
        }
      }
    }
    context.restore();
  }
}

function drawTelescopeHelper() {
  const context = Celestial.context;
  if (!context) return;

  const metrics = Celestial.metrics();
  const width = metrics.width;
  const height = metrics.height;
  const cx = width / 2;
  const cy = height / 2;

  const crosshairStyle = TelescopeManager.enabled ? TelescopeManager.crosshairStyle : "off";

  // Render the current field-of-view numerical info in top-left
  context.save();
  context.fillStyle = "rgba(0, 255, 255, 0.85)";
  context.font = "bold 13px 'Space Grotesk', sans-serif";
  const scale = Celestial.mapProjection.scale();
  const fovDeg = (width / scale) * (180 / Math.PI);
  context.fillText(`FOV: ${fovDeg.toFixed(1)}°`, 20, 35);
  context.restore();

  if (crosshairStyle !== "off") {
    context.save();
    context.strokeStyle = TelescopeManager.nightVision ? "rgba(255, 0, 0, 0.7)" : "rgba(0, 255, 255, 0.6)";
    context.lineWidth = 1.5;

    if (crosshairStyle === "standard") {
      context.beginPath();
      context.moveTo(cx - 40, cy);
      context.lineTo(cx - 8, cy);
      context.moveTo(cx + 8, cy);
      context.lineTo(cx + 40, cy);
      context.moveTo(cx, cy - 40);
      context.lineTo(cx, cy - 8);
      context.moveTo(cx, cy + 8);
      context.lineTo(cx, cy + 40);
      context.stroke();
    }
    context.restore();
  }
}

// ── ADVANCED LAYERS & SIMULATIONS (ISS, Meteor Showers, Comets, Orbits) ──

// Cache for orbits
let orbitCache = {};
let lastOrbitCacheTime = null;

// Meteor streaks animation state
let activeMeteors = [];

// Comet & Asteroid datasets loaded dynamically from data/comets.json and data/asteroids.json
let COMETS_DATA = [];
let ASTEROIDS_DATA = [];

const METEOR_SHOWERS = [
  { name: "Quadrantids", peakMonth: 0, peakDay: 3, ra: 230.1, dec: 48.5 },
  { name: "Lyrids", peakMonth: 3, peakDay: 22, ra: 271.4, dec: 33.3 },
  { name: "Eta Aquariids", peakMonth: 4, peakDay: 5, ra: 338.0, dec: -1.0 },
  { name: "Perseids", peakMonth: 7, peakDay: 12, ra: 46.2, dec: 57.4 },
  { name: "Orionids", peakMonth: 9, peakDay: 21, ra: 95.0, dec: 15.5 },
  { name: "Leonids", peakMonth: 10, peakDay: 17, ra: 153.0, dec: 22.0 },
  { name: "Geminids", peakMonth: 11, peakDay: 14, ra: 112.5, dec: 33.0 }
];

let SPACECRAFT_DATA = [];


const FALLBACK_SATELLITES = [
  {
    name: "ISS (NORAD 25544)",
    NORAD_CAT_ID: 25544,
    line1: "1 25544U 98067A   26200.56233486  .00016717  00000-0  30104-3 0  9997",
    line2: "2 25544  51.6421  20.4321 0001123  88.1234 272.4567 15.49876543 56789"
  }
];

function hashString(str) {
  let hash = 0;
  if (!str) return 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getSpacecraftPosition(sp, date) {
  if (!sp) return [0, 0];
  const spData = sp.spData || sp;
  const dest = String(spData.destination || "").toLowerCase();
  const targets = Array.isArray(spData.celestialTargets) ? spData.celestialTargets.map(t => String(t).toLowerCase()) : [];
  const orbitType = String(spData.orbitType || "").toLowerCase();
  const lagrange = String(spData.lagrangePoint || "").toLowerCase();
  const spId = String(spData.id || "").toLowerCase();

  try {
    // 1. Lagrange Points (L1 / L2)
    if (lagrange.includes("l2") || spId.includes("james-webb") || spId.includes("euclid") || spId.includes("gaia") || spId.includes("planck") || spId.includes("herschel") || spId.includes("wmap") || spId.includes("spektr-rg") || spId.includes("lisa-pathfinder") || spId.includes("queqiao-1") || spId.includes("capstone")) {
      const sunPos = typeof getPlanetPosition === "function" ? getPlanetPosition("sun", date) : null;
      if (sunPos) {
        const raDeg = (sunPos[0] * 15 + 180) % 360;
        const decDeg = -sunPos[1];
        return [raDeg, decDeg];
      }
    }
    if (lagrange.includes("l1") || spId.includes("soho") || spId.includes("dscovr") || spId.includes("ace") || spId.includes("wind") || spId.includes("aditya-l1")) {
      const sunPos = typeof getPlanetPosition === "function" ? getPlanetPosition("sun", date) : null;
      if (sunPos) {
        return [sunPos[0] * 15, sunPos[1]];
      }
    }

    // 2. Moon & Lunar Missions
    if (dest.includes("moon") || dest.includes("lunar") || targets.some(t => t.includes("moon") || t.includes("lunar")) || orbitType.includes("lunar")) {
      const moonPos = typeof getPlanetPosition === "function" ? getPlanetPosition("moon", date) : null;
      if (moonPos) {
        return [moonPos[0] * 15, moonPos[1]];
      }
    }

    // 3. Mars Missions
    if (dest.includes("mars") || targets.some(t => t.includes("mars") || t.includes("phobos") || t.includes("deimos") || t.includes("jezero") || t.includes("gale") || t.includes("utopia") || t.includes("valles")) || orbitType.includes("mars") || orbitType.includes("martian")) {
      const marsPos = typeof getPlanetPosition === "function" ? getPlanetPosition("mars", date) : null;
      if (marsPos) {
        return [marsPos[0] * 15, marsPos[1]];
      }
    }

    // 4. Venus Missions
    if (dest.includes("venus") || targets.some(t => t.includes("venus")) || orbitType.includes("venus")) {
      const venusPos = typeof getPlanetPosition === "function" ? getPlanetPosition("venus", date) : null;
      if (venusPos) {
        return [venusPos[0] * 15, venusPos[1]];
      }
    }

    // 5. Mercury Missions
    if (dest.includes("mercury") || targets.some(t => t.includes("mercury")) || orbitType.includes("mercury")) {
      const mercPos = typeof getPlanetPosition === "function" ? getPlanetPosition("mercury", date) : null;
      if (mercPos) {
        return [mercPos[0] * 15, mercPos[1]];
      }
    }

    // 6. Jupiter & Outer System Moons
    if (dest.includes("jupiter") || dest.includes("ganymede") || dest.includes("europa") || targets.some(t => t.includes("jupiter") || t.includes("ganymede") || t.includes("europa") || t.includes("callisto") || t.includes("io"))) {
      const jupPos = typeof getPlanetPosition === "function" ? getPlanetPosition("jupiter", date) : null;
      if (jupPos) {
        return [jupPos[0] * 15, jupPos[1]];
      }
    }

    // 7. Saturn & Titan
    if (dest.includes("saturn") || dest.includes("titan") || targets.some(t => t.includes("saturn") || t.includes("titan") || t.includes("enceladus"))) {
      const satPos = typeof getPlanetPosition === "function" ? getPlanetPosition("saturn", date) : null;
      if (satPos) {
        return [satPos[0] * 15, satPos[1]];
      }
    }

    // 8. Heliocentric / Solar Orbit Missions
    if (dest.includes("sun") || dest.includes("heliocentric") || orbitType.includes("heliocentric")) {
      const sunPos = typeof getPlanetPosition === "function" ? getPlanetPosition("sun", date) : null;
      if (sunPos) {
        const seed = hashString(spId);
        const raDeg = (sunPos[0] * 15 + (seed % 60) - 30 + 360) % 360;
        const decDeg = Math.max(-85, Math.min(85, sunPos[1] + ((seed % 40) - 20)));
        return [raDeg, decDeg];
      }
    }

    // 9. LEO / GEO / MEO Earth Satellites & Space Stations (Hubble, ISS, GPS, TDRS)
    const seed = hashString(spId);
    const now = (date && date.getTime) ? date.getTime() : Date.now();
    const periodMs = (spData.orbit && spData.orbit.periodMinutes) ? spData.orbit.periodMinutes * 60 * 1000 : (90 * 60 * 1000);
    const orbitPhase = ((now / periodMs) + (seed / 1000)) % 1.0;
    const inc = (spData.orbit && spData.orbit.inclinationDeg != null) ? spData.orbit.inclinationDeg : 51.6;
    const raDeg = (orbitPhase * 360 + (seed % 360)) % 360;
    const decDeg = Math.sin(orbitPhase * 2 * Math.PI) * Math.min(inc, 80);

    return [raDeg, decDeg];
  } catch (e) {
    const seed = hashString(spId);
    return [seed % 360, (seed % 160) - 80];
  }
}

function openSpacecraftModal(spData) {
  const modal = document.getElementById("asteroid-modal");
  const modalBody = document.getElementById("modal-body");
  if (!modal || !modalBody || !spData) return;

  const name = spData.name || "Spacecraft Mission";
  const patch = spData.missionPatch ? `<img src="${spData.missionPatch}" alt="Patch" style="max-height: 80px; margin-right: 12px; filter: drop-shadow(0 0 6px rgba(0,255,255,0.4));">` : "";
  const img = spData.image ? `<div style="text-align: center; margin: 12px 0;"><img src="${spData.image}" alt="${name}" style="max-width: 100%; max-height: 260px; border-radius: 8px; border: 1px solid rgba(0,255,255,0.3); box-shadow: 0 0 15px rgba(0,0,0,0.5);"></div>` : "";

  const statusColor = spData.status === "Active" ? "#00ffcc" : (spData.status === "Planned" ? "#00bbff" : "#ffaa00");

  let html = `
    <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.15); padding-bottom: 10px; margin-bottom: 15px;">
      <div style="display: flex; align-items: center;">
        ${patch ? patch : '<img src="assets/icons/spacecraft.svg" alt="spacecraft" style="height: 48px; width: 48px; margin-right: 12px; filter: drop-shadow(0 0 8px rgba(0,245,255,0.5));">'}
        <div>
          <h2 style="margin: 0; font-size: 20px; color: #00f5ff; display: flex; align-items: center; gap: 8px;">
            ${patch ? '<img src="assets/icons/spacecraft.svg" alt="spacecraft" style="height: 20px; width: 20px;">' : ''}
            ${name}
          </h2>
          <div style="font-size: 13px; color: #aaa; margin-top: 4px;">Category: <span style="color: #fff;">${spData.category || "Spacecraft"}</span> | Status: <span style="color: ${statusColor}; font-weight: bold;">${spData.status || "N/A"}</span></div>
        </div>
      </div>
    </div>
    ${img}
    <p style="font-size: 13px; line-height: 1.5; color: #ddd; background: rgba(255,255,255,0.05); padding: 10px; border-radius: 6px; border-left: 3px solid #00f5ff;">
      ${spData.description || "No detailed description available."}
    </p>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 12px; margin: 15px 0; background: rgba(0,0,0,0.2); padding: 12px; border-radius: 6px;">
      <div>🚀 <strong>Launch Date:</strong> ${spData.launchDate || "N/A"}</div>
      <div>⏳ <strong>Mission Duration:</strong> ${spData.missionDurationDays ? spData.missionDurationDays + " days" : "N/A"}</div>
      <div>🛰️ <strong>Operator:</strong> ${spData.operator || spData.primaryAgency || "N/A"}</div>
      <div>📍 <strong>Destination:</strong> ${spData.destination || "N/A"}</div>
      <div>🚀 <strong>Launch Vehicle:</strong> ${spData.launchVehicle || "N/A"}</div>
      <div>🏢 <strong>Manufacturer:</strong> ${spData.manufacturer || "N/A"}</div>
    </div>
  `;

  if (Array.isArray(spData.missionObjectives) && spData.missionObjectives.length > 0) {
    html += `
      <h3 style="color: #00f5ff; font-size: 14px; margin-top: 15px; border-bottom: 1px solid rgba(0,255,255,0.2); padding-bottom: 4px;">🎯 Mission Objectives</h3>
      <ul style="font-size: 12px; color: #ccc; line-height: 1.5; padding-left: 20px;">
        ${spData.missionObjectives.map(obj => `<li>${obj}</li>`).join("")}
      </ul>
    `;
  }

  if (Array.isArray(spData.instruments) && spData.instruments.length > 0) {
    html += `
      <h3 style="color: #00f5ff; font-size: 14px; margin-top: 15px; border-bottom: 1px solid rgba(0,255,255,0.2); padding-bottom: 4px;">🔬 Scientific Instruments</h3>
      <ul style="font-size: 12px; color: #ccc; line-height: 1.5; padding-left: 20px;">
        ${spData.instruments.map(inst => `<li>${inst}</li>`).join("")}
      </ul>
    `;
  }

  if (Array.isArray(spData.majorDiscoveries) && spData.majorDiscoveries.length > 0) {
    html += `
      <h3 style="color: #00f5ff; font-size: 14px; margin-top: 15px; border-bottom: 1px solid rgba(0,255,255,0.2); padding-bottom: 4px;">🏆 Major Discoveries & Science Results</h3>
      <ul style="font-size: 12px; color: #ccc; line-height: 1.5; padding-left: 20px;">
        ${spData.majorDiscoveries.map(disc => `<li>${disc}</li>`).join("")}
      </ul>
    `;
  }

  if (Array.isArray(spData.interestingFacts) && spData.interestingFacts.length > 0) {
    html += `
      <div style="background: rgba(255, 170, 0, 0.1); border: 1px solid rgba(255, 170, 0, 0.3); border-radius: 6px; padding: 10px; margin-top: 15px;">
        <div style="color: #ffaa00; font-weight: bold; font-size: 13px;">💡 Interesting Fact:</div>
        <div style="font-size: 12px; color: #eee; margin-top: 4px; line-height: 1.4;">${spData.interestingFacts[0]}</div>
      </div>
    `;
  }

  if (Array.isArray(spData.timeline) && spData.timeline.length > 0) {
    html += `
      <h3 style="color: #00f5ff; font-size: 14px; margin-top: 15px; border-bottom: 1px solid rgba(0,255,255,0.2); padding-bottom: 4px;">📅 Mission Timeline</h3>
      <ul style="font-size: 12px; color: #bbb; line-height: 1.5; padding-left: 20px;">
        ${spData.timeline.map(t => `<li>${t}</li>`).join("")}
      </ul>
    `;
  }

  const links = [];
  if (spData.officialWebsite) links.push(`<a href="${spData.officialWebsite}" target="_blank" style="color: #00f5ff; margin-right: 12px; text-decoration: none;">🌐 Official Website</a>`);
  if (spData.nasa) links.push(`<a href="${spData.nasa}" target="_blank" style="color: #00f5ff; margin-right: 12px; text-decoration: none;">🚀 NASA Portal</a>`);
  if (spData.esa) links.push(`<a href="${spData.esa}" target="_blank" style="color: #00f5ff; margin-right: 12px; text-decoration: none;">🇪🇺 ESA Portal</a>`);
  if (spData.wikipedia) links.push(`<a href="${spData.wikipedia}" target="_blank" style="color: #00f5ff; text-decoration: none;">📖 Wikipedia Article</a>`);

  if (links.length > 0) {
    html += `
      <div style="margin-top: 20px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 12px;">
        ${links.join("")}
      </div>
    `;
  }

  modalBody.innerHTML = html;
  modal.classList.add("show");
}

function drawSpacecraftOnSky() {
  if (typeof skySettings !== "undefined" && skySettings.showSpacecraft === false) return;
  if (!SPACECRAFT_DATA || SPACECRAFT_DATA.length === 0) return;
  const context = Celestial.context;
  if (!context) return;

  SPACECRAFT_DATA.forEach(sp => {

    const name = (sp.name || "").toLowerCase();

    const important =
      name.includes("voyager") ||
      name.includes("parker") ||
      name.includes("jwst") ||
      name.includes("hubble") ||
      name.includes("dragon") ||
      name.includes("orion") ||
      name.includes("lucy") ||
      name.includes("europa") ||
      name.includes("psyche");

    const zoom = Celestial.zoomBy ? Celestial.zoomBy() : 1;

    if (!important && zoom < 2) {
      return;
    }
    try {
      const pos = getSpacecraftPosition(sp, skyTime || new Date());
      if (!Celestial.clip([pos[0], pos[1]])) return;
      let pt = null;
      try { pt = Celestial.mapProjection([pos[0], pos[1]]); } catch (_) { pt = null; }
      if (!pt || isNaN(pt[0]) || isNaN(pt[1])) return;

      const x = pt[0];
      const y = pt[1];
      const isSelected = selectedObject && (selectedObject.id === sp.id || selectedObject.name === sp.name);
      const primaryColor = sp.themeColor || (sp.status === "Active" ? "#00f5ff" : "#ffaa00");
      const isFeatured = sp.isFeatured || false;

      context.save();
      context.globalAlpha = 1.0;

      // 1. Halo ring (same as satellite bright-sat ring)
      if (isSelected || isFeatured) {
        context.strokeStyle = isSelected ? "#00ffff" : "rgba(0, 245, 255, 0.7)";
        context.lineWidth = 1.8;
        context.beginPath();
        context.arc(x, y, 8, 0, Math.PI * 2);
        context.stroke();
      }

      // 2. Vertical solar panels (top & bottom — satellites have horizontal left/right)
      context.fillStyle = isSelected ? "#00ffff" : primaryColor;
      context.fillRect(x - 1.5, y - 7, 3, 4);  // top panel arm
      context.fillRect(x - 1.5, y + 3, 3, 4);  // bottom panel arm

      // 3. Spacecraft body: upward-pointing triangle (distinct from satellite circle dot)
      context.beginPath();
      context.moveTo(x, y - 4);   // apex
      context.lineTo(x + 4, y + 3);   // bottom-right
      context.lineTo(x - 4, y + 3);   // bottom-left
      context.closePath();
      context.fillStyle = isSelected ? "#ffffff" : primaryColor;
      context.fill();
      context.strokeStyle = "#ffffff";
      context.lineWidth = 1.2;
      context.stroke();

      context.restore();

      // 4. Name label — crisp white/cyan text with heavy black stroke
      context.save();
      context.globalAlpha = 1.0;
      context.fillStyle = isSelected ? "#00ffff" : "#e0f7ff";
      context.strokeStyle = "#000000";
      context.lineWidth = 3.5;
      context.font = isSelected ? "bold 11px sans-serif" : "bold 10px sans-serif";
      context.textAlign = "center";
      const labelText = sp.shortName || sp.displayName || sp.name;
      context.strokeText(labelText, x, y + 18);
      context.fillText(labelText, x, y + 18);
      context.restore();
    } catch (_e) { /* skip broken spacecraft silently */ }
  });
}


function mergeSatellites(fetchedSats) {
  const merged = [...FALLBACK_SATELLITES];
  const existingIds = new Set(merged.map(s => String(s.NORAD_CAT_ID || s.name).toLowerCase()));
  if (Array.isArray(fetchedSats)) {
    for (const s of fetchedSats) {
      const id = String(s.NORAD_CAT_ID || s.name || s.OBJECT_NAME).toLowerCase();
      if (!existingIds.has(id)) {
        existingIds.add(id);
        merged.push(s);
      }
    }
  }
  return merged;
}

let SATELLITES_DATA = [...FALLBACK_SATELLITES];
fetch('data/satellites.json')
  .then(r => r.json())
  .then(d => { SATELLITES_DATA = mergeSatellites(d); })
  .catch(() => {
    SATELLITES_DATA = [...FALLBACK_SATELLITES];
  });

function ommToTle(sat) {
  if (!sat) return null;
  if (sat.line1 && sat.line2) return { line1: sat.line1, line2: sat.line2 };

  try {
    const epochDate = sat.EPOCH ? new Date(sat.EPOCH) : new Date();
    const fullYear = epochDate.getUTCFullYear();
    const year = fullYear % 100;
    const startOfYear = new Date(Date.UTC(fullYear, 0, 1));
    const dayOfYear = (epochDate - startOfYear) / (86400000) + 1;

    const satnum = String(sat.NORAD_CAT_ID || 0).padStart(5, '0').substring(0, 5);
    const classification = sat.CLASSIFICATION_TYPE || 'U';
    const rawDesig = String(sat.OBJECT_ID || '00000A')
      .replace(/^(19|20)/, '')
      .replace('-', '');

    const intlDesig = rawDesig.padEnd(8, ' ').substring(0, 8);

    const epochYrStr = String(year).padStart(2, '0');
    const epochDayStr = dayOfYear.toFixed(8).padStart(12, '0');

    function formatExp(val) {
      if (!val || val === 0) return " 00000-0";
      let sign = val < 0 ? "-" : " ";
      let absVal = Math.abs(val);
      let exp = Math.floor(Math.log10(absVal)) + 1;
      let mantissa = Math.round((absVal / Math.pow(10, exp)) * 100000);
      if (mantissa >= 100000) { mantissa = 10000; exp++; }
      let expSign = exp <= 0 ? "-" : "+";
      let expVal = Math.abs(exp);
      return `${sign}${String(mantissa).padStart(5, '0')}${expSign}${expVal}`;
    }

    const bstarStr = formatExp(sat.BSTAR);
    const ndotVal = sat.MEAN_MOTION_DOT || 0;
    const ndotSign = ndotVal < 0 ? "-" : " ";
    const ndotStr = (ndotSign + Math.abs(ndotVal).toFixed(8).substring(1)).padStart(10, ' ');

    const line1 = `1 ${satnum}${classification} ${intlDesig} ${epochYrStr}${epochDayStr} ${ndotStr}  00000-0 ${bstarStr} 0  9999`;

    const incStr = Number(sat.INCLINATION || 0).toFixed(4).padStart(8, ' ');
    const raanStr = Number(sat.RA_OF_ASC_NODE || 0).toFixed(4).padStart(8, ' ');

    let eccVal = sat.ECCENTRICITY || 0;
    let eccStr = String(Math.round(eccVal * 1e7)).padStart(7, '0').substring(0, 7);

    const argpStr = Number(sat.ARG_OF_PERICENTER || 0).toFixed(4).padStart(8, ' ');
    const maStr = Number(sat.MEAN_ANOMALY || 0).toFixed(4).padStart(8, ' ');
    const mmStr = Number(sat.MEAN_MOTION || 0).toFixed(8).padStart(11, ' ');
    const revStr = String(sat.REV_AT_EPOCH || 0).padStart(5, ' ').substring(0, 5);

    const line2 = `2 ${satnum} ${incStr} ${raanStr} ${eccStr} ${argpStr} ${maStr} ${mmStr}${revStr}1`;
    return { line1, line2 };
  } catch (e) {
    return null;
  }
}

function getSatRec(sat) {
  if (!sat) return null;
  if (sat._satrec !== undefined) return sat._satrec;
  try {
    let l1 = sat.line1;
    let l2 = sat.line2;
    if (!l1 || !l2) {
      const tle = ommToTle(sat);
      if (tle) {
        l1 = tle.line1;
        l2 = tle.line2;
      }
    }
    if (l1 && l2 && typeof satellite !== "undefined") {
      sat._satrec = satellite.twoline2satrec(l1, l2);
    } else {
      sat._satrec = null;
    }
  } catch (e) {
    sat._satrec = null;
  }
  return sat._satrec;
}

function getPlanetOrbitPoints(planetName) {
  const periods = {
    mercury: 88,
    venus: 224.7,
    mars: 687,
    jupiter: 4331,
    saturn: 10747,
    uranus: 30589,
    neptune: 59800,
    moon: 27.3
  };
  const period = periods[planetName.toLowerCase()] || 365;
  const points = [];
  const nowTime = new Date(skyTime);
  const steps = 60;
  for (let i = 0; i <= steps; i++) {
    const offsetDays = (i / steps - 0.5) * period;
    const t = new Date(nowTime.getTime() + offsetDays * 24 * 3600 * 1000);
    const pos = getPlanetPosition(planetName, t);
    if (pos) {
      points.push([pos[0] * 15, pos[1]]);
    }
  }
  return points;
}

function getCachedPlanetOrbit(planetName) {
  if (!lastOrbitCacheTime || Math.abs(skyTime - lastOrbitCacheTime) > 3600 * 1000) {
    orbitCache = {};
    lastOrbitCacheTime = new Date(skyTime);
  }
  if (!orbitCache[planetName]) {
    orbitCache[planetName] = getPlanetOrbitPoints(planetName);
  }
  return orbitCache[planetName];
}

function drawAdvancedLayers() {
  const context = Celestial.context;
  if (!context) return;

  const metrics = Celestial.metrics();
  const width = metrics.width;
  const height = metrics.height;

  // 🌟 SEARCHED NON-RENDERED OBJECT CELESTIAL.JS DEFAULT LABEL RENDERING
  if (selectedObject && typeof isSkyObjectRendered === "function" && !isSkyObjectRendered(selectedObject)) {
    const pt = getSkyObjectScreenPoint(selectedObject);
    if (pt && !isNaN(pt[0]) && !isNaN(pt[1])) {
      context.save();
      const objType = selectedObject.type;
      let labelColor = "#00f0ff";
      let labelText = selectedObject.displayName || selectedObject.name || selectedObject.id || "";

      if (objType === "dso") {
        const prop = selectedObject.properties || {};
        const dType = (prop.type || selectedObject.dsoType || "").toLowerCase();
        if (dType.includes("gg") || dType.includes("g") || dType.includes("galaxy")) {
          labelColor = "#ff4466"; // Red for Galaxies
        } else if (dType.includes("nebula") || dType.includes("pn") || dType.includes("en")) {
          labelColor = "#00ccff"; // Blue/Cyan for Nebulae
        } else if (dType.includes("cluster") || dType.includes("oc") || dType.includes("gc")) {
          labelColor = "#ffcc00"; // Yellow for Clusters
        } else {
          labelColor = "#00ccff"; // Native DSO Blue/Cyan
        }
      } else if (objType === "star") {
        labelColor = "#99ccff";
      } else if (objType === "comet") {
        labelColor = "#55ffaa";
      } else if (objType === "asteroid") {
        labelColor = "#ffaa44";
      }

      // Draw Celestial.js native default object symbol
      context.save();
      context.strokeStyle = labelColor;
      context.fillStyle = labelColor;
      context.lineWidth = 1.5;
      context.shadowBlur = 6;
      context.shadowColor = labelColor;

      context.beginPath();
      context.arc(pt[0], pt[1], 4, 0, Math.PI * 2);
      context.stroke();
      context.fill();

      // Draw Celestial.js native default canvas text label
      context.font = "11px 'Space Grotesk', sans-serif";
      context.textAlign = "left";
      context.textBaseline = "middle";
      context.strokeText(labelText, pt[0] + 8, pt[1]);
      context.fillText(labelText, pt[0] + 8, pt[1]);
      context.restore();

      context.restore();
    }
  }

  // 1. ORBITS DRAWING
  if (skySettings.showOrbits) {
    const orbitBodies = ["mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "moon"];
    orbitBodies.forEach(name => {
      const points = getCachedPlanetOrbit(name);
      if (points && points.length > 1) {
        context.save();
        context.beginPath();
        let first = true;
        for (const pt of points) {
          if (Celestial.clip(pt)) {
            const pixel = Celestial.mapProjection(pt);
            if (pixel) {
              if (first) {
                context.moveTo(pixel[0], pixel[1]);
                first = false;
              } else {
                context.lineTo(pixel[0], pixel[1]);
              }
            }
          }
        }
        context.strokeStyle = name === "moon" ? "rgba(255, 230, 100, 0.22)" : "rgba(0, 240, 255, 0.12)";
        context.lineWidth = name === "moon" ? 1.5 : 1.0;
        context.setLineDash([4, 4]);
        context.stroke();
        context.restore();
      }
    });
  }

  // 2. SATELLITES & ISS
  const satLib = (typeof satellite !== "undefined") ? satellite : (typeof window !== "undefined" && window.satellite ? window.satellite : null);
  if (skySettings.showSatellites && satLib) {
    const obsLat = observer ? observer.latitude : 0;
    const obsLon = observer ? observer.longitude : 0;
    const obsElev = observer ? (observer.elevation || 0) : 0;
    const observerGd = {
      longitude: obsLon * Math.PI / 180,
      latitude: obsLat * Math.PI / 180,
      height: obsElev / 1000
    };
    const gmst = satLib.gstime(skyTime);

    for (let i = 0; i < SATELLITES_DATA.length; i++) {
      const sat = SATELLITES_DATA[i];
    }

    const MAX_VISIBLE_SATS = 250;
    let renderedCount = 0;
    let clutterCount = 0;

    const selectedSatName = (selectedObject && selectedObject.type === "satellite")
      ? (selectedObject.name || "").toLowerCase()
      : null;

    for (let i = 0; i < SATELLITES_DATA.length; i++) {
      const sat = SATELLITES_DATA[i];
      if (!sat) continue;
      const rawName = String(sat.name || sat.OBJECT_NAME || "");
      const satName = rawName.toLowerCase();
      const isSelected = selectedSatName && (satName.includes(selectedSatName) || selectedSatName.includes(satName));

      // Fast break: stop looping once MAX_VISIBLE_SATS quota is met
      if (!isSelected && renderedCount >= MAX_VISIBLE_SATS) {
        if (!selectedSatName) break;
        continue;
      }

      const satrec = getSatRec(sat);
      if (!satrec) continue;

      try {
        const posVel = satLib.propagate(satrec, skyTime);
        const posEci = posVel ? posVel.position : null;

        if (posEci) {
          const lookAngles = satLib.ecfToLookAngles(observerGd, satLib.eciToEcf(posEci, gmst));
          const alt = (lookAngles.elevation ?? lookAngles.altitude ?? lookAngles.alt) * 180 / Math.PI;
          const az = (lookAngles.azimuth ?? lookAngles.az) * 180 / Math.PI;

          // Render if visible in current celestial map projection or explicitly selected
          if (alt > -30 || isSelected) {
            const coords = horizontalToEquatorial(alt, az, skyTime, observer);
            if (coords && Celestial.clip(coords)) {
              const pt = Celestial.mapProjection(coords);
              if (pt) {
                renderedCount++;

                context.save();
                context.globalAlpha = 1.0;

                const importantSat =
                  satName.includes("iss") ||
                  satName.includes("tiangong") ||
                  satName.includes("hst") ||
                  satName.includes("jwst") ||
                  satName.includes("voyager") ||
                  satName.includes("parker");

                const clutterSat =
                  satName.includes("starlink") ||
                  satName.includes("oneweb") ||
                  satName.includes("qianfan") ||
                  satName.includes("kuiper");

                if (clutterSat && !isSelected) {

                  clutterCount++;

                  if (clutterCount % 10 !== 0) {
                    continue;
                  }

                }
                let showLabel = true;



                // Zoom level (adjust values if needed)
                const zoom = Celestial.zoomBy ? Celestial.zoomBy() : 1;

                // Hide clutter satellites when zoomed out
                // Sirf kuch clutter satellites dikhao


                const isBrightSat = importantSat || isSelected;

                // Satellite body dot
                context.fillStyle = isBrightSat ? "#ffff00" : "#00f0ff";
                context.beginPath();
                context.arc(pt[0], pt[1], isBrightSat ? 3.5 : 2.5, 0, Math.PI * 2);
                context.fill();
                context.strokeStyle = "#ffffff";
                context.lineWidth = 0.8;
                context.stroke();

                // Solar panels
                context.fillStyle = isBrightSat ? "#ffee00" : "#00e5ff";
                context.fillRect(pt[0] - 7, pt[1] - 1, 4, 2);
                context.fillRect(pt[0] + 3, pt[1] - 1, 4, 2);

                // Halo ring for highlighted / selected satellite
                if (isBrightSat) {
                  context.strokeStyle = isSelected ? "#00ffff" : "rgba(255, 234, 0, 0.7)";
                  context.lineWidth = 1.8;
                  context.beginPath();
                  context.arc(pt[0], pt[1], 8, 0, 2 * Math.PI);
                  context.stroke();
                }

                // Satellite Name Label

                // Hide labels for clutter satellites unless zoomed in

                if (showLabel) {

                  context.fillStyle = isSelected ? "#00ffff" : "#ffffff";
                  context.strokeStyle = "#000000";
                  context.lineWidth = 3.5;
                  context.font = isSelected ? "bold 11px sans-serif" : "bold 10px sans-serif";
                  context.textAlign = "center";

                  let displayName = rawName.replace(/\s*\(NORAD.*?\)/i, "").trim();

                  if (/^STARLINK/i.test(displayName)) {
                    const m = displayName.match(/STARLINK[-\s]?\d+/i);
                    if (m) displayName = m[0].toUpperCase();
                  } else if (/^QIANFAN/i.test(displayName)) {
                    const m = displayName.match(/QIANFAN[-\s]?\d+/i);
                    if (m) displayName = m[0].toUpperCase();
                  }

                  context.strokeText(displayName, pt[0], pt[1] + 16);
                  context.fillText(displayName, pt[0], pt[1] + 16);

                }
                context.restore();

                // Predict orbital path for selected satellite or ISS
                if (isSelected || satName.includes("iss")) {
                  context.save();
                  context.beginPath();
                  let first = true;
                  for (let k = 0; k <= 40; k += 4) {
                    const t = new Date(skyTime.getTime() + k * 60000);
                    const pVal = satLib.propagate(satrec, t);
                    const pEci = pVal ? pVal.position : null;
                    if (pEci) {
                      const g = satLib.gstime(t);
                      const lAngles = satLib.ecfToLookAngles(observerGd, satLib.eciToEcf(pEci, g));
                      const a_alt = (lAngles.elevation ?? lAngles.altitude ?? lAngles.alt) * 180 / Math.PI;
                      const a_az = (lAngles.azimuth ?? lAngles.az) * 180 / Math.PI;
                      if (a_alt > 0) {
                        const c = horizontalToEquatorial(a_alt, a_az, t, observer);
                        if (c && Celestial.clip(c)) {
                          const pixel = Celestial.mapProjection(c);
                          if (pixel) {
                            if (first) {
                              context.moveTo(pixel[0], pixel[1]);
                              first = false;
                            } else {
                              context.lineTo(pixel[0], pixel[1]);
                            }
                          }
                        }
                      }
                    }
                  }
                  context.strokeStyle = "rgba(0, 240, 255, 0.4)";
                  context.lineWidth = 1;
                  context.setLineDash([3, 3]);
                  context.stroke();
                  context.restore();
                }
              }
            }
          }
        }
      } catch (e) { }
    }
  }

  // 3. METEOR SHOWERS
  if (skySettings.showMeteors) {
    const curMonth = skyTime.getMonth();
    const curDay = skyTime.getDate();

    METEOR_SHOWERS.forEach(shower => {
      const isPeakActive = shower.peakMonth === curMonth && Math.abs(shower.peakDay - curDay) <= 5;
      if (isPeakActive) {
        const coords = [shower.ra, shower.dec];
        if (Celestial.clip(coords)) {
          const pt = Celestial.mapProjection(coords);
          if (pt) {
            context.save();

            context.strokeStyle = "rgba(255, 60, 100, 0.75)";
            context.lineWidth = 1.2;
            context.beginPath();
            context.arc(pt[0], pt[1], 6, 0, 2 * Math.PI);
            context.arc(pt[0], pt[1], 12, 0, 2 * Math.PI);
            context.stroke();

            context.beginPath();
            for (let i = 0; i < 8; i++) {
              const angle = (i * Math.PI) / 4;
              context.moveTo(pt[0] + Math.cos(angle) * 14, pt[1] + Math.sin(angle) * 14);
              context.lineTo(pt[0] + Math.cos(angle) * 20, pt[1] + Math.sin(angle) * 20);
            }
            context.stroke();

            context.fillStyle = "rgba(255, 100, 140, 0.9)";
            context.font = "bold 9px sans-serif";
            context.fillText(`${shower.name} Radiant`, pt[0] + 16, pt[1] + 3);

            context.restore();

            if (activeMeteors.length < 5 && Math.random() < 0.12 && !simPaused) {
              const angle = Math.random() * 2 * Math.PI;
              activeMeteors.push({
                x: pt[0] + Math.cos(angle) * 20,
                y: pt[1] + Math.sin(angle) * 20,
                vx: Math.cos(angle) * (6 + Math.random() * 6),
                vy: Math.sin(angle) * (6 + Math.random() * 6),
                len: 15 + Math.random() * 25,
                opacity: 0.9,
                life: 0
              });
            }
          }
        }
      }
    });

    if (activeMeteors.length > 0) {
      context.save();
      activeMeteors.forEach((m, idx) => {
        context.strokeStyle = `rgba(255, 255, 255, ${m.opacity})`;
        context.lineWidth = 1.8;
        context.beginPath();
        context.moveTo(m.x, m.y);
        context.lineTo(m.x - m.vx * 1.5, m.y - m.vy * 1.5);
        context.stroke();

        if (!simPaused) {
          m.x += m.vx;
          m.y += m.vy;
          m.opacity -= 0.08;
          m.life++;
        }
      });
      activeMeteors = activeMeteors.filter(m => m.opacity > 0 && m.x > 0 && m.x < width && m.y > 0 && m.y < height);
      context.restore();
    }
  }

  // 4. COMETS
  if (skySettings.showComets && Array.isArray(COMETS_DATA)) {
    COMETS_DATA.forEach(comet => {
      try {
        let coords = null;
        if (typeof comet.getCoords === "function") {
          coords = comet.getCoords(skyTime);
        } else if (typeof getCometPosition === "function") {
          const pos = getCometPosition(comet, skyTime, observer);
          coords = pos ? [pos[0] * 15, pos[1]] : null;
        }
        if (coords && Celestial.clip(coords)) {
          const pt = Celestial.mapProjection(coords);
          if (pt) {
            context.save();
            context.globalAlpha = 1.0;

            let tailAngle = Math.PI / 4;
            const solPos = getPlanetPosition("sol", skyTime);
            if (solPos) {
              const solCoords = [solPos[0] * 15, solPos[1]];
              const solPt = Celestial.mapProjection(solCoords);
              if (solPt) {
                tailAngle = Math.atan2(pt[1] - solPt[1], pt[0] - solPt[0]);
              }
            }

            const tailLen = 30;
            const tailSpread = 0.22;
            const gradient = context.createLinearGradient(pt[0], pt[1], pt[0] + Math.cos(tailAngle) * tailLen, pt[1] + Math.sin(tailAngle) * tailLen);
            gradient.addColorStop(0, "rgba(0, 245, 255, 0.7)");
            gradient.addColorStop(0.3, "rgba(0, 200, 255, 0.35)");
            gradient.addColorStop(1, "rgba(255, 255, 255, 0)");

            context.fillStyle = gradient;
            context.beginPath();
            context.moveTo(pt[0], pt[1]);
            context.arc(pt[0], pt[1], tailLen, tailAngle - tailSpread, tailAngle + tailSpread);
            context.closePath();
            context.fill();

            const comaGlow = context.createRadialGradient(pt[0], pt[1], 1, pt[0], pt[1], 6);
            comaGlow.addColorStop(0, "rgba(0, 255, 255, 0.95)");
            comaGlow.addColorStop(0.4, "rgba(0, 240, 255, 0.6)");
            comaGlow.addColorStop(1, "rgba(255, 255, 255, 0)");
            context.fillStyle = comaGlow;
            context.beginPath();
            context.arc(pt[0], pt[1], 6, 0, 2 * Math.PI);
            context.fill();

            context.fillStyle = "#fff";
            context.beginPath();
            context.arc(pt[0], pt[1], 1.5, 0, 2 * Math.PI);
            context.fill();

            // Comet Name Label
            const isSelectedComet = selectedObject && selectedObject.type === "comet" &&
              selectedObject.id === (comet.id || comet.name);
            context.fillStyle = isSelectedComet ? "#00ffff" : "#00f5ff";
            context.strokeStyle = "#000000";
            context.lineWidth = 3.5;
            context.font = isSelectedComet ? "bold italic 12px sans-serif" : "bold italic 10px sans-serif";
            const cometName = comet.displayName || comet.name || "Comet";
            context.strokeText(cometName, pt[0] + 10, pt[1] - 2);
            context.fillText(cometName, pt[0] + 10, pt[1] - 2);
            context.restore();
          }
        }
      } catch (_e) { }
    });
  }

  // 4b. ASTEROIDS (Golden/Amber markers)
  if (skySettings.showAsteroids) {
    ASTEROIDS_DATA.forEach(asteroid => {
      const coords = asteroid.getCoords ? asteroid.getCoords(skyTime) : null;
      if (coords && Celestial.clip(coords)) {
        const pt = Celestial.mapProjection(coords);
        if (pt) {
          context.save();
          const isSelected = selectedObject && selectedObject.type === "asteroid" &&
            selectedObject.id === (asteroid.id || asteroid.name);

          // Golden/Amber marker glow
          const amberGlow = context.createRadialGradient(pt[0], pt[1], 1, pt[0], pt[1], isSelected ? 8 : 4);
          amberGlow.addColorStop(0, isSelected ? "rgba(255, 200, 0, 1.0)" : "rgba(255, 180, 0, 0.85)");
          amberGlow.addColorStop(0.5, isSelected ? "rgba(255, 150, 0, 0.6)" : "rgba(230, 140, 0, 0.4)");
          amberGlow.addColorStop(1, "rgba(255, 180, 0, 0)");

          context.fillStyle = amberGlow;
          context.beginPath();
          context.arc(pt[0], pt[1], isSelected ? 8 : 4, 0, 2 * Math.PI);
          context.fill();

          // Highlight selection ring
          if (isSelected) {
            context.strokeStyle = "rgba(255, 215, 0, 0.9)";
            context.lineWidth = 1.5;
            context.beginPath();
            context.arc(pt[0], pt[1], 10, 0, 2 * Math.PI);
            context.stroke();
          }

          context.fillStyle = "#ffffff";
          context.beginPath();
          context.arc(pt[0], pt[1], isSelected ? 2.0 : 1.2, 0, 2 * Math.PI);
          context.fill();

          // Asteroid Amber Label
          context.fillStyle = isSelected ? "#ffd700" : "rgba(255, 200, 100, 0.85)";
          context.font = isSelected ? "bold 10px sans-serif" : "9px sans-serif";
          context.fillText(asteroid.displayName || asteroid.name, pt[0] + 8, pt[1] - 3);

          context.restore();
        }
      }
    });
  }

  // 5. ACTIVE ECLIPSES (Corona Glow & Blood Moon crimson overlays)
  if (typeof activeEclipse !== "undefined" && activeEclipse) {
    if (activeEclipse.type === "solar") {
      const sol = getPlanetPosition("sol", skyTime);
      if (sol) {
        const solCoords = [sol[0] * 15, sol[1]];
        const pt = Celestial.mapProjection(solCoords);
        if (pt && Celestial.clip(solCoords)) {
          context.save();
          // Draw solar corona glow
          const coronaGlow = context.createRadialGradient(pt[0], pt[1], 5, pt[0], pt[1], 25);
          coronaGlow.addColorStop(0, "rgba(255, 255, 255, 0.98)");
          coronaGlow.addColorStop(0.15, "rgba(255, 230, 160, 0.85)");
          coronaGlow.addColorStop(0.4, "rgba(0, 230, 255, 0.4)");
          coronaGlow.addColorStop(0.7, "rgba(0, 100, 255, 0.15)");
          coronaGlow.addColorStop(1, "rgba(0, 0, 0, 0)");

          context.fillStyle = coronaGlow;
          context.beginPath();
          context.arc(pt[0], pt[1], 25, 0, 2 * Math.PI);
          context.fill();

          // Overlap Moon silhouette
          context.fillStyle = "#030812";
          const moon = getPlanetPosition("moon", skyTime);
          const moonPt = moon ? Celestial.mapProjection([moon[0] * 15, moon[1]]) : pt;
          context.beginPath();
          context.arc(moonPt[0], moonPt[1], 5.5, 0, 2 * Math.PI);
          context.fill();
          context.restore();
        }
      }
    } else if (activeEclipse.type === "lunar") {
      const moon = getPlanetPosition("moon", skyTime);
      if (moon) {
        const moonCoords = [moon[0] * 15, moon[1]];
        const pt = Celestial.mapProjection(moonCoords);
        if (pt && Celestial.clip(moonCoords)) {
          context.save();
          // Blood Moon crimson overlay
          const redShadow = context.createRadialGradient(pt[0], pt[1], 1, pt[0], pt[1], 6.5);
          redShadow.addColorStop(0, "rgba(230, 20, 20, 0.9)");
          redShadow.addColorStop(0.5, "rgba(160, 10, 10, 0.65)");
          redShadow.addColorStop(0.85, "rgba(90, 5, 5, 0.3)");
          redShadow.addColorStop(1, "rgba(0, 0, 0, 0)");

          context.fillStyle = redShadow;
          context.beginPath();
          context.arc(pt[0], pt[1], 6.5, 0, 2 * Math.PI);
          context.fill();
          context.restore();
        }
      }
    }
  }

  // 6. SPACECRAFT (215 missions)
  try { drawSpacecraftOnSky(); } catch (_e) { }
}

// ── ECLIPSE ARCHITECTURE (Real-time Detection & Future Prediction Search) ──

function getAngularSeparation(ra1, dec1, ra2, dec2) {
  const r1 = ra1 * Math.PI / 180;
  const d1 = dec1 * Math.PI / 180;
  const r2 = ra2 * Math.PI / 180;
  const d2 = dec2 * Math.PI / 180;
  const cosAngle = Math.sin(d1) * Math.sin(d2) + Math.cos(d1) * Math.cos(d2) * Math.cos(r1 - r2);
  const clampedCos = Math.max(-1.0, Math.min(1.0, cosAngle));
  return Math.acos(clampedCos) * 180 / Math.PI;
}

function searchNextEclipse(startDate, type) {
  let t = new Date(startDate);
  const maxIterations = 24;
  for (let i = 0; i < maxIterations; i++) {
    t = new Date(t.getTime() + 14.765 * 24 * 3600 * 1000);
    const sPos = getPlanetPosition("sol", t);
    const mPos = getPlanetPosition("moon", t);
    if (sPos && mPos) {
      const sRA = sPos[0] * 15;
      const sDec = sPos[1];
      const mRA = mPos[0] * 15;
      const mDec = mPos[1];

      if (type === "solar") {
        const sep = getAngularSeparation(sRA, sDec, mRA, mDec);
        if (sep < 0.8) {
          return { date: t, kind: sep < 0.53 ? "Total/Annular" : "Partial" };
        }
      } else {
        const shadowRA = (sRA + 180) % 360;
        const shadowDec = -sDec;
        const sep = getAngularSeparation(mRA, mDec, shadowRA, shadowDec);
        if (sep < 1.4) {
          return { date: t, kind: sep < 0.88 ? "Total/Partial Umbral" : "Penumbral" };
        }
      }
    }
  }
  return null;
}

let activeEclipse = null;

function updateEclipseStatus() {
  const solarEl = document.getElementById("obs-solar-eclipse");
  const lunarEl = document.getElementById("obs-lunar-eclipse");

  const sPos = getPlanetPosition("sol", skyTime);
  const mPos = getPlanetPosition("moon", skyTime);

  activeEclipse = null;

  if (sPos && mPos) {
    const sRA = sPos[0] * 15;
    const sDec = sPos[1];
    const mRA = mPos[0] * 15;
    const mDec = mPos[1];

    const solarSep = getAngularSeparation(sRA, sDec, mRA, mDec);
    if (solarSep < 0.54) {
      activeEclipse = {
        type: "solar",
        kind: solarSep < 0.15 ? "Total Solar Eclipse" : (solarSep < 0.38 ? "Annular Solar Eclipse" : "Partial Solar Eclipse"),
        separation: solarSep
      };
    } else {
      const shadowRA = (sRA + 180) % 360;
      const shadowDec = -sDec;
      const lunarSep = getAngularSeparation(mRA, mDec, shadowRA, shadowDec);
      if (lunarSep < 1.4) {
        activeEclipse = {
          type: "lunar",
          kind: lunarSep < 0.72 ? "Total Lunar Eclipse (Blood Moon)" : (lunarSep < 0.95 ? "Partial Lunar Eclipse" : "Penumbral Lunar Eclipse"),
          separation: lunarSep
        };
      }
    }
  }

  if (solarEl) {
    if (activeEclipse && activeEclipse.type === "solar") {
      solarEl.innerHTML = `<span style="color: #ff3c64; font-weight: bold;">🔴 ACTIVE: ${activeEclipse.kind}</span>`;
    } else {
      const nextSolar = searchNextEclipse(skyTime, "solar");
      if (nextSolar) {
        solarEl.textContent = `${nextSolar.date.toLocaleDateString()} (${nextSolar.kind})`;
      } else {
        solarEl.textContent = "None in next 2 years";
      }
    }
  }

  if (lunarEl) {
    if (activeEclipse && activeEclipse.type === "lunar") {
      lunarEl.innerHTML = `<span style="color: #ff3c64; font-weight: bold;">🔴 ACTIVE: ${activeEclipse.kind}</span>`;
    } else {
      const nextLunar = searchNextEclipse(skyTime, "lunar");
      if (nextLunar) {
        lunarEl.textContent = `${nextLunar.date.toLocaleDateString()} (${nextLunar.kind})`;
      } else {
        lunarEl.textContent = "None in next 2 years";
      }
    }
  }
}

/* ==========================================================================
   🔭 OBSERVATION MODAL, ATTACHMENTS, RATING, TAGS & AI SUMMARY LOGIC
   ========================================================================== */
let currentEditingObsId = null;
let currentObsFiles = [];
let currentObsSelectedRating = 5;
let currentObsTags = [];

function calculateSessionDurationFormatted(startTime, endTime) {
  if (!startTime || !endTime) return { formatted: "", minutes: 0 };
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return { formatted: "", minutes: 0 };

  let startMins = sh * 60 + sm;
  let endMins = eh * 60 + em;
  if (endMins < startMins) endMins += 24 * 60; // Overnight session

  const diffMins = endMins - startMins;
  const hrs = Math.floor(diffMins / 60);
  const mins = diffMins % 60;

  let formatted = "";
  if (hrs > 0 && mins > 0) formatted = `${hrs}h ${mins}m`;
  else if (hrs > 0) formatted = `${hrs}h`;
  else formatted = `${mins}m`;

  return { formatted, minutes: diffMins };
}

function updateLiveDurationBadge() {
  const start = document.getElementById("obs-start-time")?.value;
  const end = document.getElementById("obs-end-time")?.value;
  const badge = document.getElementById("obs-duration-live-badge");
  if (!badge) return;

  const res = calculateSessionDurationFormatted(start, end);
  if (res.formatted) {
    badge.textContent = `⏱️ ${res.formatted}`;
  } else {
    badge.textContent = "⏱️ --";
  }
}

function setModalRating(val) {
  currentObsSelectedRating = Math.max(1, Math.min(5, parseInt(val || 5, 10)));
  const picker = document.getElementById("obs-rating-picker");
  if (picker) {
    picker.setAttribute("data-rating", currentObsSelectedRating);
    const stars = picker.querySelectorAll(".star-item");
    stars.forEach(star => {
      const starVal = parseInt(star.getAttribute("data-value"), 10);
      star.classList.toggle("active", starVal <= currentObsSelectedRating);
    });
  }
}

function renderFormActiveTags() {
  const container = document.getElementById("obs-active-tags");
  if (!container) return;

  container.innerHTML = currentObsTags.map(tag => `
    <span class="tag-pill-badge" data-tag="${tag}">
      🏷️ ${tag}
      <button type="button" class="tag-pill-remove" data-tag="${tag}">✕</button>
    </span>
  `).join("");

  // Highlight matching built-in chips
  const builtinChips = document.querySelectorAll("#obs-builtin-tags .tag-selector-chip");
  builtinChips.forEach(chip => {
    const tagVal = chip.getAttribute("data-tag");
    chip.classList.toggle("active", currentObsTags.includes(tagVal));
  });
}

function addCustomTagFromInput() {
  const input = document.getElementById("obs-custom-tag-input");
  if (!input) return;
  const tagVal = input.value.trim();
  if (tagVal && !currentObsTags.includes(tagVal)) {
    currentObsTags.push(tagVal);
    renderFormActiveTags();
    input.value = "";
  }
}

function renderObsFilePreviews() {
  const previewContainer = document.getElementById("obs-file-previews");
  if (!previewContainer) return;

  if (!currentObsFiles || !currentObsFiles.length) {
    previewContainer.innerHTML = "";
    return;
  }

  previewContainer.innerHTML = currentObsFiles.map(file => {
    const isImg = file.type && file.type.startsWith("image/");
    return `
      <div class="obs-preview-card" data-id="${file.id}">
        ${isImg ? `<img src="${file.data}" alt="${file.name}">` : `<span class="file-doc-icon">📄</span><span class="file-doc-name">${file.name}</span>`}
        <button type="button" class="remove-file-btn" data-id="${file.id}" title="Remove attachment">✕</button>
      </div>
    `;
  }).join("");
}

function handleObsFiles(fileList) {
  if (!fileList || !fileList.length) return;

  const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"];
  const maxSizeBytes = 3 * 1024 * 1024; // 3MB limit

  Array.from(fileList).forEach(file => {
    if (!validTypes.includes(file.type) && !file.name.match(/\.(jpg|jpeg|png|webp|pdf)$/i)) {
      if (typeof showToast === "function") showToast(`File '${file.name}' type not supported. Use JPG, PNG, WEBP, or PDF.`);
      return;
    }
    if (file.size > maxSizeBytes) {
      if (typeof showToast === "function") showToast(`File '${file.name}' exceeds 3MB size limit.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      currentObsFiles.push({
        id: "file_" + Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
        name: file.name,
        type: file.type || (file.name.endsWith(".pdf") ? "application/pdf" : "image/jpeg"),
        size: file.size,
        data: e.target.result
      });
      renderObsFilePreviews();
    };
    reader.readAsDataURL(file);
  });
}

function openObsLightbox(src, caption) {
  const modal = document.getElementById("obs-lightbox-modal");
  const imgEl = document.getElementById("obs-lightbox-img");
  const captionEl = document.getElementById("obs-lightbox-caption");
  if (!modal || !imgEl) return;

  imgEl.src = src;
  if (captionEl) captionEl.textContent = caption || "";
  modal.classList.remove("hidden");
}

function closeObsLightbox() {
  const modal = document.getElementById("obs-lightbox-modal");
  if (modal) modal.classList.add("hidden");
}

document.addEventListener("DOMContentLoaded", () => {
  const openBtn = document.getElementById("open-new-observation-btn");
  const modal = document.getElementById("observation-modal");
  const closeBtn = document.getElementById("close-observation-modal");
  const cancelBtn = document.getElementById("cancel-observation-btn");
  const saveBtn = document.getElementById("save-observation-btn");
  const container = document.getElementById("observation-list-container");

  // Time Inputs Live Duration Listener
  document.getElementById("obs-start-time")?.addEventListener("input", updateLiveDurationBadge);
  document.getElementById("obs-end-time")?.addEventListener("input", updateLiveDurationBadge);

  // Rating Picker Event Listeners
  const ratingPicker = document.getElementById("obs-rating-picker");
  if (ratingPicker) {
    ratingPicker.addEventListener("click", (e) => {
      const star = e.target.closest(".star-item");
      if (star) setModalRating(star.getAttribute("data-value"));
    });
    ratingPicker.addEventListener("mouseover", (e) => {
      const star = e.target.closest(".star-item");
      if (star) {
        const hoverVal = parseInt(star.getAttribute("data-value"), 10);
        ratingPicker.querySelectorAll(".star-item").forEach(s => {
          const val = parseInt(s.getAttribute("data-value"), 10);
          s.classList.toggle("hover", val <= hoverVal);
        });
      }
    });
    ratingPicker.addEventListener("mouseout", () => {
      ratingPicker.querySelectorAll(".star-item").forEach(s => s.classList.remove("hover"));
    });
  }

  // Tags Event Listeners
  document.getElementById("obs-builtin-tags")?.addEventListener("click", (e) => {
    const chip = e.target.closest(".tag-selector-chip");
    if (chip) {
      const tagVal = chip.getAttribute("data-tag");
      if (currentObsTags.includes(tagVal)) {
        currentObsTags = currentObsTags.filter(t => t !== tagVal);
      } else {
        currentObsTags.push(tagVal);
      }
      renderFormActiveTags();
    }
  });

  document.getElementById("add-custom-tag-btn")?.addEventListener("click", addCustomTagFromInput);
  document.getElementById("obs-custom-tag-input")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addCustomTagFromInput();
    }
  });

  document.getElementById("obs-active-tags")?.addEventListener("click", (e) => {
    const removeBtn = e.target.closest(".tag-pill-remove");
    if (removeBtn) {
      const tagVal = removeBtn.getAttribute("data-tag");
      currentObsTags = currentObsTags.filter(t => t !== tagVal);
      renderFormActiveTags();
    }
  });

  // Dropzone & File picker setup
  const dropzone = document.getElementById("obs-dropzone");
  const browseBtn = document.getElementById("browse-obs-files");
  const fileInput = document.getElementById("obs-file-input");
  const previewsContainer = document.getElementById("obs-file-previews");

  browseBtn?.addEventListener("click", () => fileInput?.click());
  fileInput?.addEventListener("change", (e) => handleObsFiles(e.target.files));

  if (dropzone) {
    dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropzone.classList.add("drag-over");
    });
    dropzone.addEventListener("dragleave", () => dropzone.classList.remove("drag-over"));
    dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropzone.classList.remove("drag-over");
      if (e.dataTransfer && e.dataTransfer.files) {
        handleObsFiles(e.dataTransfer.files);
      }
    });
  }

  previewsContainer?.addEventListener("click", (e) => {
    const removeBtn = e.target.closest(".remove-file-btn");
    if (removeBtn) {
      const fileId = removeBtn.dataset.id;
      currentObsFiles = currentObsFiles.filter(f => f.id !== fileId);
      renderObsFilePreviews();
    }
  });

  // Lightbox listeners
  document.getElementById("close-obs-lightbox-btn")?.addEventListener("click", closeObsLightbox);
  document.getElementById("obs-lightbox-modal")?.addEventListener("click", (e) => {
    if (e.target === document.getElementById("obs-lightbox-modal")) closeObsLightbox();
  });

  function openModal(isEdit = false) {
    const modalTitle = document.querySelector("#observation-modal .modal-title");
    if (modalTitle) {
      modalTitle.textContent = isEdit ? "Edit Observation Session" : "New Observation Session";
    }
    if (!isEdit) {
      currentEditingObsId = null;
      currentObsFiles = [];
      setModalRating(5);
      currentObsTags = [];
      renderFormActiveTags();
      const favCheckbox = document.getElementById("obs-favorite-checkbox");
      if (favCheckbox) favCheckbox.checked = false;
      const form = document.querySelector(".observation-form");
      if (form) form.reset();
    }
    renderObsFilePreviews();
    updateLiveDurationBadge();
    if (modal) modal.classList.remove("hidden");
  }

  function closeModal() {
    if (modal) modal.classList.add("hidden");
    currentEditingObsId = null;
    currentObsFiles = [];
    currentObsTags = [];
    renderObsFilePreviews();
    renderFormActiveTags();
  }

  function saveObservationSession() {
    const title = document.getElementById("obs-title")?.value?.trim();
    const date = document.getElementById("obs-date")?.value;
    const startTime = document.getElementById("obs-start-time")?.value;
    const endTime = document.getElementById("obs-end-time")?.value;
    const location = document.getElementById("obs-location")?.value?.trim();
    const weather = document.getElementById("obs-weather")?.value?.trim();
    const telescope = document.getElementById("obs-telescope")?.value?.trim();
    const eyepiece = document.getElementById("obs-eyepiece")?.value?.trim();
    const camera = document.getElementById("obs-camera")?.value?.trim();
    const seeing = document.getElementById("obs-seeing")?.value;
    const transparency = document.getElementById("obs-transparency")?.value;
    const bortle = document.getElementById("obs-bortle")?.value;
    const cloudCover = document.getElementById("obs-cloud-cover")?.value?.trim();
    const temperature = document.getElementById("obs-temp")?.value?.trim();
    const humidity = document.getElementById("obs-humidity")?.value?.trim();
    const windSpeed = document.getElementById("obs-wind")?.value?.trim();
    const objectsRaw = document.getElementById("obs-objects")?.value?.trim();
    const notes = document.getElementById("obs-notes")?.value?.trim();
    const isFavorite = Boolean(document.getElementById("obs-favorite-checkbox")?.checked);
    const durationData = calculateSessionDurationFormatted(startTime, endTime);

    let existing = [];
    try {
      existing = JSON.parse(localStorage.getItem("astroObservations") || "[]");
    } catch (err) {
      existing = [];
    }

    if (currentEditingObsId) {
      const idx = existing.findIndex(o => o.id === currentEditingObsId);
      if (idx !== -1) {
        existing[idx] = {
          ...existing[idx],
          title: title || "Untitled Observation",
          date: date || existing[idx].date,
          startTime: startTime || "",
          endTime: endTime || "",
          duration: durationData.formatted,
          durationMinutes: durationData.minutes,
          location: location || "",
          weather: weather || "",
          telescope: telescope || "",
          eyepiece: eyepiece || "",
          camera: camera || "",
          seeing: seeing || "3",
          transparency: transparency || "3",
          bortle: bortle || "4",
          cloudCover: cloudCover || "",
          temperature: temperature || "",
          humidity: humidity || "",
          windSpeed: windSpeed || "",
          rating: currentObsSelectedRating,
          isFavorite,
          tags: [...currentObsTags],
          objects: objectsRaw ? objectsRaw.split(",").map(s => s.trim()).filter(Boolean) : [],
          notes: notes || "",
          files: currentObsFiles ? [...currentObsFiles] : []
        };
      }
    } else {
      const newObservation = {
        id: "obs_" + Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
        title: title || "Untitled Observation",
        date: date || new Date().toISOString().split("T")[0],
        startTime: startTime || "",
        endTime: endTime || "",
        duration: durationData.formatted,
        durationMinutes: durationData.minutes,
        location: location || "",
        weather: weather || "",
        telescope: telescope || "",
        eyepiece: eyepiece || "",
        camera: camera || "",
        seeing: seeing || "3",
        transparency: transparency || "3",
        bortle: bortle || "4",
        cloudCover: cloudCover || "",
        temperature: temperature || "",
        humidity: humidity || "",
        windSpeed: windSpeed || "",
        rating: currentObsSelectedRating,
        isFavorite,
        tags: [...currentObsTags],
        objects: objectsRaw ? objectsRaw.split(",").map(s => s.trim()).filter(Boolean) : [],
        notes: notes || "",
        files: currentObsFiles ? [...currentObsFiles] : [],
        createdAt: new Date().toISOString()
      };
      existing.push(newObservation);
    }

    try {
      localStorage.setItem("astroObservations", JSON.stringify(existing));
    } catch (err) {
      console.error("Error saving observation to localStorage:", err);
    }

    const isEditMode = Boolean(currentEditingObsId);
    const form = document.querySelector(".observation-form");
    if (form) form.reset();

    closeModal();
    renderObservations();

    if (typeof showToast === "function") {
      showToast(isEditMode ? "Observation updated successfully." : "Observation saved successfully.");
    }
  }

  openBtn?.addEventListener("click", () => openModal(false));
  closeBtn?.addEventListener("click", closeModal);
  cancelBtn?.addEventListener("click", closeModal);
  saveBtn?.addEventListener("click", saveObservationSession);

  modal?.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  // Delegated Edit & Delete listener
  container?.addEventListener("click", (e) => {
    const editBtn = e.target.closest(".edit-obs-btn");
    const deleteBtn = e.target.closest(".delete-obs-btn");

    if (editBtn) {
      const obsId = editBtn.dataset.id;
      editObservation(obsId, openModal);
    } else if (deleteBtn) {
      const obsId = deleteBtn.dataset.id;
      deleteObservation(obsId);
    }
  });

  // Search & Filter event listeners
  document.getElementById("obs-search-input")?.addEventListener("input", renderObservations);
  document.getElementById("obs-filter-select")?.addEventListener("change", renderObservations);

  // Observation History controls listeners
  document.getElementById("obs-history-search")?.addEventListener("input", renderObservationHistory);
  document.getElementById("obs-history-filter-date")?.addEventListener("change", renderObservationHistory);
  document.getElementById("obs-history-filter-telescope")?.addEventListener("change", renderObservationHistory);
  document.getElementById("obs-history-filter-type")?.addEventListener("change", renderObservationHistory);
  document.getElementById("obs-history-filter-rating")?.addEventListener("change", renderObservationHistory);
  document.getElementById("obs-history-filter-tag")?.addEventListener("change", renderObservationHistory);
  document.getElementById("obs-history-sort")?.addEventListener("change", renderObservationHistory);

  const favToggleBtn = document.getElementById("obs-history-fav-toggle");
  if (favToggleBtn) {
    favToggleBtn.addEventListener("click", () => {
      const isCurrentlyActive = favToggleBtn.getAttribute("data-active") === "true";
      favToggleBtn.setAttribute("data-active", isCurrentlyActive ? "false" : "true");
      renderObservationHistory();
    });
  }

  // Delegated history card clicks (View, Edit, Duplicate, Delete, Favorite Star)
  const historyListContainer = document.getElementById("observation-history-list");
  if (historyListContainer) {
    historyListContainer.addEventListener("click", (e) => {
      const favStar = e.target.closest(".card-fav-star");
      const viewBtn = e.target.closest(".view-obs-btn");
      const editBtn = e.target.closest(".history-edit-btn");
      const dupBtn = e.target.closest(".dup-obs-btn");
      const delBtn = e.target.closest(".history-del-btn");

      if (favStar) {
        toggleFavoriteObservation(favStar.dataset.id);
      } else if (viewBtn) {
        openObservationViewModal(viewBtn.dataset.id);
      } else if (editBtn) {
        editObservation(editBtn.dataset.id, openModal);
      } else if (dupBtn) {
        duplicateObservation(dupBtn.dataset.id);
      } else if (delBtn) {
        deleteObservation(delBtn.dataset.id);
      }
    });
  }

  // View modal close button listeners
  document.getElementById("close-obs-view-btn")?.addEventListener("click", closeObservationViewModal);
  document.getElementById("view-obs-close-btn")?.addEventListener("click", closeObservationViewModal);
  document.getElementById("observation-view-modal")?.addEventListener("click", (e) => {
    if (e.target === document.getElementById("observation-view-modal")) closeObservationViewModal();
  });

  renderObservations();
});

function toggleFavoriteObservation(obsId) {
  let observations = [];
  try {
    observations = JSON.parse(localStorage.getItem("astroObservations") || "[]");
  } catch (e) {
    observations = [];
  }

  const obs = observations.find(o => o.id === obsId);
  if (obs) {
    obs.isFavorite = !obs.isFavorite;
    localStorage.setItem("astroObservations", JSON.stringify(observations));
    renderObservations();
    if (typeof showToast === "function") {
      showToast(obs.isFavorite ? "Marked as Favorite ⭐" : "Removed from Favorites");
    }
  }
}

function duplicateObservation(obsId) {
  let observations = [];
  try {
    observations = JSON.parse(localStorage.getItem("astroObservations") || "[]");
  } catch (e) {
    observations = [];
  }

  const obs = observations.find(o => o.id === obsId);
  if (!obs) return;

  const clone = {
    ...JSON.parse(JSON.stringify(obs)),
    id: "obs_" + Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    title: (obs.title || "Observation") + " (Copy)",
    createdAt: new Date().toISOString()
  };

  observations.push(clone);
  localStorage.setItem("astroObservations", JSON.stringify(observations));
  renderObservations();

  if (typeof showToast === "function") {
    showToast("Observation duplicated successfully.");
  }
}

let activeViewObsId = null;

// ======================================
// AI OBSERVATION SUMMARY ENGINE
// ======================================
function generateAIObservationSummary(obs) {
  const title = obs.title || "Observation Session";
  const objectsArr = Array.isArray(obs.objects) ? obs.objects : (typeof obs.objects === "string" && obs.objects ? obs.objects.split(",") : []);
  const bortleNum = parseInt(obs.bortle || 4, 10);
  const seeingNum = parseInt(obs.seeing || 3, 10);
  const transNum = parseInt(obs.transparency || 3, 10);
  const cloudCover = obs.cloudCover ? parseInt(obs.cloudCover, 10) : 0;
  const humidity = obs.humidity ? parseInt(obs.humidity, 10) : 50;
  const temp = obs.temperature || "";
  const wind = obs.windSpeed || "";
  const telescope = obs.telescope || "Optical Setup";
  const eyepiece = obs.eyepiece || "";
  const camera = obs.camera || "";
  const location = obs.location || "Observing Location";

  // Compute Session Duration
  let durationText = "Standard observing session";
  if (obs.duration) {
    durationText = `${obs.duration} detailed observing session`;
  } else if (obs.startTime && obs.endTime) {
    const hours = calculateSessionHours(obs.startTime, obs.endTime);
    if (hours > 0) durationText = `${hours.toFixed(1)}-hour detailed observing session`;
  }

  // Bortle Sky Description
  let skyQuality = "Suburban/Rural transition sky";
  if (bortleNum <= 2) skyQuality = "Pristine dark sky site (Bortle " + bortleNum + ")";
  else if (bortleNum <= 4) skyQuality = "Dark rural/suburban sky (Bortle " + bortleNum + ")";
  else if (bortleNum <= 6) skyQuality = "Suburban light-polluted sky (Bortle " + bortleNum + ")";
  else skyQuality = "Urban high light pollution environment (Bortle " + bortleNum + ")";

  // Atmospheric State
  let atmosphericState = "moderate atmospheric stability";
  if (seeingNum >= 4) atmosphericState = "steady atmospheric seeing with minimal thermal turbulence";
  else if (seeingNum <= 2) atmosphericState = "noticeable atmospheric turbulence and thermal distortion";

  // Scientific Summary
  const skySummaryDetails = [
    `Seeing: ${seeingNum}/5`,
    `Transparency: ${transNum}/5`,
    `Cloud Cover: ${cloudCover}%`,
    temp ? `Temp: ${temp}` : null,
    humidity ? `Humidity: ${humidity}%` : null,
    wind ? `Wind: ${wind}` : null
  ].filter(Boolean).join(", ");

  const scientificSummary = `Conducted a ${durationText} at ${location} under a ${skyQuality} (${skySummaryDetails}). Targeted ${objectsArr.length ? objectsArr.length + ' primary celestial object(s)' : 'astronomical targets'} utilizing the ${telescope}${eyepiece ? ' paired with ' + eyepiece : ''}${camera ? ' and ' + camera + ' imaging sensor' : ''}.`;

  // Highlights
  let highlights = "";
  if (objectsArr.length) {
    highlights = `Successfully logged visual details for ${objectsArr.join(", ")}. Primary targets demonstrated strong visual contrast and resolve under the ${bortleNum <= 4 ? 'dark sky background' : 'local optical setup'}.`;
  } else {
    highlights = `General sky survey and equipment calibration completed at ${location}. Excellent baseline session for tracking local light pollution and sky transparency.`;
  }

  // Follow-up Recommendations
  const followUp = [];
  if (objectsArr.some(o => /M\d+|NGC|Nebula/i.test(o))) {
    followUp.push("Utilize a narrow-band UHC or O-III nebula filter to boost contrast on faint emission structures.");
  }
  if (objectsArr.some(o => /Jupiter|Saturn|Mars|Venus|Moon/i.test(o))) {
    followUp.push("Increase magnification with a 6mm–9mm planetary eyepiece or 2x Barlow lens to resolve subtle surface belt structures and lunar rim details.");
  }
  if (cloudCover > 20) {
    followUp.push("Schedule follow-up observations on clear nights with 0% cloud cover to observe uninterrupted faint deep-sky targets.");
  }
  if (bortleNum > 4) {
    followUp.push("Consider scheduling a mobile dark-site field trip (Bortle 1–3) to unlock faint outer spiral arms and globular cluster resolution.");
  } else {
    followUp.push("Conduct high-resolution astrophotography long-exposure stacks to leverage the dark background sky.");
  }

  // Observing Tips
  const observingTips = [];
  observingTips.push(`Allow at least 30 minutes for thermal equilibration of the ${telescope} optical tube assembly before critical planetary/double-star inspection.`);
  if (humidity > 70) observingTips.push("High relative humidity detected — attach a dew shield or dew heater band to prevent corrector lens fogging.");
  if (bortleNum >= 4) observingTips.push("Use an observing hood or shield peripheral ambient lighting to preserve scotopic dark adaptation.");
  observingTips.push("Practice averted vision techniques when examining deep-sky fuzzies and edge-on galaxies.");

  // Revisit Targets
  const revisitTargets = objectsArr.length ? objectsArr.slice(0, 3).join(", ") : "Messier 42 Orion Nebula, Saturn, M31 Andromeda Galaxy";

  // Overall Quality Rating
  const ratingScore = (obs.rating || 5) * 1.5 + (seeingNum * 0.8) + (transNum * 0.8) + (10 - bortleNum) * 0.5;
  let qualityRating = "⭐⭐⭐ Good Session (7.5/10)";
  if (ratingScore >= 12) qualityRating = "⭐⭐⭐⭐⭐ Exceptional Session (9.5/10)";
  else if (ratingScore >= 9.5) qualityRating = "⭐⭐⭐⭐ Great Session (8.6/10)";
  else if (ratingScore < 7) qualityRating = "⭐⭐ Fair Session (5.8/10)";

  return {
    generatedAt: new Date().toLocaleDateString() + " at " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    scientificSummary,
    highlights,
    followUp: followUp.join(" "),
    observingTips: observingTips.join(" "),
    revisitTargets,
    qualityRating
  };
}

function renderAIObsSummaryContent(summary) {
  if (!summary) return "";
  return `
    <div class="ai-summary-body">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
        <span class="ai-badge-quality">${summary.qualityRating}</span>
        <span style="font-size:0.72rem; color:#94a3b8;">Generated ${summary.generatedAt}</span>
      </div>
      
      <div class="ai-summary-section">
        <h5>🔬 Scientific Summary</h5>
        <p>${summary.scientificSummary}</p>
      </div>

      <div class="ai-summary-section">
        <h5>✨ Session Highlights</h5>
        <p>${summary.highlights}</p>
      </div>

      <div class="ai-summary-grid">
        <div class="ai-summary-section">
          <h5>🎯 Suggested Follow-Up</h5>
          <p>${summary.followUp}</p>
        </div>
        <div class="ai-summary-section">
          <h5>💡 Equipment & Observing Tips</h5>
          <p>${summary.observingTips}</p>
        </div>
      </div>

      <div class="ai-summary-section">
        <h5>🔭 Objects Worth Revisiting</h5>
        <p><strong>Recommended Targets:</strong> ${summary.revisitTargets}</p>
      </div>
    </div>
  `;
}

function openObservationViewModal(obsId) {
  let observations = [];
  try {
    observations = JSON.parse(localStorage.getItem("astroObservations") || "[]");
  } catch (e) {
    observations = [];
  }

  const obs = observations.find(o => o.id === obsId);
  if (!obs) return;

  activeViewObsId = obs.id;

  const modal = document.getElementById("observation-view-modal");
  const titleEl = document.getElementById("view-obs-title");
  const bodyEl = document.getElementById("view-obs-body");
  const editBtn = document.getElementById("view-obs-edit-btn");

  if (titleEl) titleEl.textContent = obs.title || "Observation Details";

  if (bodyEl) {
    const objectsArr = Array.isArray(obs.objects) ? obs.objects : (typeof obs.objects === "string" && obs.objects ? obs.objects.split(",") : []);
    const tagsArr = Array.isArray(obs.tags) ? obs.tags : [];
    const filesArr = Array.isArray(obs.files) ? obs.files : [];
    const ratingVal = obs.rating || 5;
    const ratingStars = "★".repeat(ratingVal) + "☆".repeat(5 - ratingVal);

    bodyEl.innerHTML = `
      <div class="view-obs-detail-grid">
        <div class="view-detail-item">
          <span class="lbl">Session Rating & Status</span>
          <span class="val" style="color: #f59e0b; font-weight: 700;">${ratingStars} (${ratingVal}/5) ${obs.isFavorite ? '⭐' : ''}</span>
        </div>
        <div class="view-detail-item">
          <span class="lbl">Date & Duration</span>
          <span class="val">${obs.date || "N/A"} (${obs.startTime || "--"} - ${obs.endTime || "--"}) ${obs.duration ? obs.duration : ''}</span>
        </div>
        <div class="view-detail-item">
          <span class="lbl">Location</span>
          <span class="val"><svg style="vertical-align:middle;margin-right:4px;color:#f43f5e;" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>${obs.location || "Not specified"}</span>
        </div>
        <div class="view-detail-item">
          <span class="lbl">Telescope & Gear</span>
          <span class="val">${obs.telescope || "None / N/A"} ${obs.eyepiece ? '| ' + obs.eyepiece : ''} ${obs.camera ? '| ' + obs.camera : ''}</span>
        </div>
        <div class="view-detail-item">
          <span class="lbl">Sky Quality & Bortle</span>
          <span class="val">🌤️ Weather: ${obs.weather || "Clear"} | Bortle Class ${obs.bortle || 4}</span>
        </div>
        <div class="view-detail-item">
          <span class="lbl">Atmospheric Conditions</span>
          <span class="val">👁️ Seeing: ${obs.seeing || 3}/5 | Trans: ${obs.transparency || 3}/5 | Cloud: ${obs.cloudCover || 0}%</span>
        </div>
        <div class="view-detail-item">
          <span class="lbl">Environment Details</span>
          <span class="val">🌡️ Temp: ${obs.temperature || "N/A"} | Hum: ${obs.humidity ? obs.humidity + '%' : 'N/A'} | Wind: ${obs.windSpeed || "N/A"}</span>
        </div>
      </div>

      ${tagsArr.length ? `
        <div class="view-section-box">
          <h4>🏷️ Categories & Tags (${tagsArr.length})</h4>
          <div class="card-tags-row">
            ${tagsArr.map(t => `<span class="obs-tag-pill">🏷️ ${t}</span>`).join("")}
          </div>
        </div>
      ` : ''}

      ${objectsArr.length ? `
        <div class="view-section-box">
          <h4>🌌 Observed Objects (${objectsArr.length})</h4>
          <div class="card-objects-badges">
            ${objectsArr.map(obj => `<span class="obs-tag-badge">${obj.trim()}</span>`).join("")}
          </div>
        </div>
      ` : ''}

      ${obs.notes ? `
        <div class="view-section-box">
          <h4>📝 Observation Notes</h4>
          <p style="white-space: pre-wrap; font-size: 0.9rem; color: rgba(224, 230, 237, 0.85); line-height: 1.5; background: rgba(255,255,255,0.03); padding: 12px; border-radius: 8px;">${obs.notes}</p>
        </div>
      ` : ''}

      ${filesArr.length ? `
        <div class="view-section-box">
          <h4>📎 Attached Images & Files (${filesArr.length})</h4>
          <div class="view-attachments-gallery">
            ${filesArr.map(f => {
      const isImg = f.type && f.type.startsWith("image/");
      if (isImg) {
        return `
                  <div class="view-thumb-item" onclick="openObsLightbox('${f.data}', '${f.name}')">
                    <img src="${f.data}" alt="${f.name}" title="Click to view full image: ${f.name}">
                  </div>
                `;
      } else {
        return `
                  <a href="${f.data}" target="_blank" download="${f.name}" class="view-doc-item" title="Download PDF: ${f.name}">
                    📄 ${f.name}
                  </a>
                `;
      }
    }).join("")}
          </div>
        </div>
      ` : ''}

      <div class="obs-ai-summary-container">
        <div class="ai-summary-header">
          <div class="ai-summary-title">🤖 AI Observation Summary</div>
          <button type="button" id="trigger-ai-summary-btn" class="ai-gen-btn" data-id="${obs.id}">
            ${obs.aiSummary ? '🔄 Regenerate AI Summary' : '✨ Generate AI Summary'}
          </button>
        </div>
        <div id="ai-summary-content-box">
          ${obs.aiSummary ? renderAIObsSummaryContent(obs.aiSummary) : `
            <p style="font-size:0.85rem; color:#94a3b8; margin:0;">Click 'Generate AI Summary' to analyze session data, equipment performance, and atmospheric conditions.</p>
          `}
        </div>
      </div>
    `;

    // AI Summary Trigger handler
    const aiBtn = document.getElementById("trigger-ai-summary-btn");
    const aiBox = document.getElementById("ai-summary-content-box");
    if (aiBtn && aiBox) {
      aiBtn.addEventListener("click", () => {
        aiBtn.classList.add("loading");
        aiBtn.innerHTML = "⏳ Analyzing Session...";

        setTimeout(() => {
          const generated = generateAIObservationSummary(obs);
          obs.aiSummary = generated;

          // Save to localStorage
          let currentObsList = [];
          try {
            currentObsList = JSON.parse(localStorage.getItem("astroObservations") || "[]");
          } catch (e) { currentObsList = []; }

          const targetIdx = currentObsList.findIndex(o => o.id === obs.id);
          if (targetIdx !== -1) {
            currentObsList[targetIdx].aiSummary = generated;
            localStorage.setItem("astroObservations", JSON.stringify(currentObsList));
          }

          aiBox.innerHTML = renderAIObsSummaryContent(generated);
          aiBtn.classList.remove("loading");
          aiBtn.innerHTML = "🔄 Regenerate AI Summary";

          if (typeof showToast === "function") {
            showToast("AI Observation Summary generated.");
          }
        }, 500);
      });
    }
  }

  if (editBtn) {
    editBtn.onclick = () => {
      closeObservationViewModal();
      editObservation(obs.id, (isEdit) => {
        const modalEl = document.getElementById("observation-modal");
        if (modalEl) modalEl.classList.remove("hidden");
      });
    };
  }

  if (modal) modal.classList.remove("hidden");
}

function closeObservationViewModal() {
  const modal = document.getElementById("observation-view-modal");
  if (modal) modal.classList.add("hidden");
}

function editObservation(obsId, openModalFn) {
  let observations = [];
  try {
    observations = JSON.parse(localStorage.getItem("astroObservations") || "[]");
  } catch (e) {
    observations = [];
  }

  const obs = observations.find(o => o.id === obsId);
  if (!obs) return;

  currentEditingObsId = obs.id;
  currentObsFiles = Array.isArray(obs.files) ? [...obs.files] : [];
  setModalRating(obs.rating || 5);
  currentObsTags = Array.isArray(obs.tags) ? [...obs.tags] : [];
  renderFormActiveTags();

  if (document.getElementById("obs-favorite-checkbox")) {
    document.getElementById("obs-favorite-checkbox").checked = Boolean(obs.isFavorite);
  }

  if (document.getElementById("obs-title")) document.getElementById("obs-title").value = obs.title || "";
  if (document.getElementById("obs-date")) document.getElementById("obs-date").value = obs.date || "";
  if (document.getElementById("obs-start-time")) document.getElementById("obs-start-time").value = obs.startTime || "";
  if (document.getElementById("obs-end-time")) document.getElementById("obs-end-time").value = obs.endTime || "";
  if (document.getElementById("obs-location")) document.getElementById("obs-location").value = obs.location || "";
  if (document.getElementById("obs-weather")) document.getElementById("obs-weather").value = obs.weather || "";
  if (document.getElementById("obs-telescope")) document.getElementById("obs-telescope").value = obs.telescope || "";
  if (document.getElementById("obs-eyepiece")) document.getElementById("obs-eyepiece").value = obs.eyepiece || "";
  if (document.getElementById("obs-camera")) document.getElementById("obs-camera").value = obs.camera || "";
  if (document.getElementById("obs-seeing")) document.getElementById("obs-seeing").value = obs.seeing || "3";
  if (document.getElementById("obs-transparency")) document.getElementById("obs-transparency").value = obs.transparency || "3";
  if (document.getElementById("obs-bortle")) document.getElementById("obs-bortle").value = obs.bortle || "4";
  if (document.getElementById("obs-cloud-cover")) document.getElementById("obs-cloud-cover").value = obs.cloudCover || "";
  if (document.getElementById("obs-temp")) document.getElementById("obs-temp").value = obs.temperature || "";
  if (document.getElementById("obs-humidity")) document.getElementById("obs-humidity").value = obs.humidity || "";
  if (document.getElementById("obs-wind")) document.getElementById("obs-wind").value = obs.windSpeed || "";

  if (document.getElementById("obs-objects")) {
    document.getElementById("obs-objects").value = Array.isArray(obs.objects) ? obs.objects.join(", ") : (obs.objects || "");
  }
  if (document.getElementById("obs-notes")) document.getElementById("obs-notes").value = obs.notes || "";

  renderObsFilePreviews();
  updateLiveDurationBadge();

  if (typeof openModalFn === "function") {
    openModalFn(true);
  }
}

function deleteObservation(obsId) {
  if (!confirm("Are you sure you want to delete this observation?")) return;

  let observations = [];
  try {
    observations = JSON.parse(localStorage.getItem("astroObservations") || "[]");
  } catch (e) {
    observations = [];
  }

  observations = observations.filter(o => o.id !== obsId);
  try {
    localStorage.setItem("astroObservations", JSON.stringify(observations));
  } catch (e) {
    console.error("Error deleting observation:", e);
  }

  renderObservations();

  if (typeof showToast === "function") {
    showToast("Observation deleted.");
  }
}

// ======================================
// Timeline Calendar & History Logic
// ======================================
let currentCalendarDate = new Date();

function renderObservations() {
  let observations = [];
  try {
    observations = JSON.parse(localStorage.getItem("astroObservations") || "[]");
  } catch (e) {
    observations = [];
  }

  const totalSessionsEl = document.querySelector(".observation-stat-card:nth-child(1) .stat-value");
  const totalObjectsEl = document.querySelector(".observation-stat-card:nth-child(2) .stat-value");

  if (totalSessionsEl) totalSessionsEl.textContent = observations.length;

  let totalObjectsCount = 0;
  observations.forEach(obs => {
    if (Array.isArray(obs.objects)) {
      totalObjectsCount += obs.objects.length;
    } else if (typeof obs.objects === "string" && obs.objects.trim()) {
      totalObjectsCount += obs.objects.split(",").length;
    }
  });
  if (totalObjectsEl) totalObjectsEl.textContent = totalObjectsCount;

  updateObservationStatistics(observations);

  const emptyCard = document.querySelector(".observation-empty-card");
  const calendarContainer = document.getElementById("observation-calendar-container");

  if (!observations.length) {
    if (emptyCard) emptyCard.style.display = "flex";
    if (calendarContainer) calendarContainer.style.display = "none";
  } else {
    if (emptyCard) emptyCard.style.display = "none";
    if (calendarContainer) calendarContainer.style.display = "flex";
  }

  renderTimelineCalendar();
  renderObservationHistory();
}

function renderObservationHistory() {
  const historyContainer = document.getElementById("observation-history-list");
  if (!historyContainer) return;

  let observations = [];
  try {
    observations = JSON.parse(localStorage.getItem("astroObservations") || "[]");
  } catch (e) {
    observations = [];
  }

  // Populate dynamic telescope dropdown options
  const scopeSelect = document.getElementById("obs-history-filter-telescope");
  if (scopeSelect) {
    const currentVal = scopeSelect.value;
    const telescopes = Array.from(new Set(observations.map(o => (o.telescope || "").trim()).filter(Boolean)));
    scopeSelect.innerHTML = '<option value="all">🔭 All Telescopes</option>' +
      telescopes.map(t => `<option value="${t}">${t}</option>`).join("");
    if (telescopes.includes(currentVal)) {
      scopeSelect.value = currentVal;
    }
  }

  // Populate dynamic tag dropdown options
  const tagSelect = document.getElementById("obs-history-filter-tag");
  if (tagSelect) {
    const currentTagVal = tagSelect.value;
    const builtinTags = ["Galaxy", "Nebula", "Planet", "Moon", "Comet", "Asteroid", "Satellite", "Star Cluster", "Double Star", "Variable Star"];
    const customTags = observations.flatMap(o => Array.isArray(o.tags) ? o.tags : []);
    const allTags = Array.from(new Set([...builtinTags, ...customTags])).filter(Boolean);

    tagSelect.innerHTML = '<option value="all">🏷️ All Tags</option>' +
      allTags.map(t => `<option value="${t}">${t}</option>`).join("");
    if (allTags.includes(currentTagVal)) {
      tagSelect.value = currentTagVal;
    }
  }

  // Get Filter & Search Inputs
  const searchVal = (document.getElementById("obs-history-search")?.value || "").toLowerCase().trim();
  const dateVal = document.getElementById("obs-history-filter-date")?.value || "all";
  const scopeVal = document.getElementById("obs-history-filter-telescope")?.value || "all";
  const typeVal = document.getElementById("obs-history-filter-type")?.value || "all";
  const ratingFilterVal = document.getElementById("obs-history-filter-rating")?.value || "all";
  const tagFilterVal = document.getElementById("obs-history-filter-tag")?.value || "all";
  const sortVal = document.getElementById("obs-history-sort")?.value || "newest";
  const favOnly = document.getElementById("obs-history-fav-toggle")?.getAttribute("data-active") === "true";

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const objects = searchObjects;
  // Filter Observations
  let filtered = observations.filter(obs => {
    // 1. Favorites Filter
    if (favOnly && !obs.isFavorite) return false;

    // 2. Rating Filter
    if (ratingFilterVal !== "all") {
      const r = obs.rating || 5;
      const targetR = parseInt(ratingFilterVal, 10);
      if (r < targetR) return false;
    }

    // 3. Tag Filter
    if (tagFilterVal !== "all") {
      const tags = Array.isArray(obs.tags) ? obs.tags : [];
      if (!tags.includes(tagFilterVal)) return false;
    }

    // 4. Search Text Matching
    if (searchVal) {
      const objectsStr = Array.isArray(obs.objects) ? obs.objects.join(" ") : (obs.objects || "");
      const tagsStr = Array.isArray(obs.tags) ? obs.tags.join(" ") : "";
      const matchTitle = (obs.title || "").toLowerCase().includes(searchVal);
      const matchLocation = (obs.location || "").toLowerCase().includes(searchVal);
      const matchTelescope = (obs.telescope || "").toLowerCase().includes(searchVal);
      const matchNotes = (obs.notes || "").toLowerCase().includes(searchVal);
      const matchObjects = objectsStr.toLowerCase().includes(searchVal);
      const matchTags = tagsStr.toLowerCase().includes(searchVal);

      if (!matchTitle && !matchLocation && !matchTelescope && !matchNotes && !matchObjects && !matchTags) return false;
    }

    // 5. Telescope Filter
    if (scopeVal !== "all") {
      if ((obs.telescope || "").trim() !== scopeVal) return false;
    }

    // 6. Object Type Filter
    if (typeVal !== "all") {
      const objectsArr = Array.isArray(obs.objects) ? obs.objects : (typeof obs.objects === "string" && obs.objects ? obs.objects.split(",") : []);
      const objectsCombined = objectsArr.join(" ").toLowerCase();

      if (typeVal === "messier" && !/\bm\d{1,3}\b/i.test(objectsCombined)) return false;
      if (typeVal === "ngc" && !/\bngc\d{1,4}\b/i.test(objectsCombined)) return false;
      if (typeVal === "planet" && !/\b(jupiter|saturn|mars|venus|mercury|uranus|neptune)\b/i.test(objectsCombined)) return false;
      if (typeVal === "moon" && !/\b(moon|lunar)\b/i.test(objectsCombined)) return false;
    }

    // 7. Date Filter
    if (dateVal !== "all" && obs.date) {
      const obsDate = new Date(obs.date + "T00:00:00");
      if (!isNaN(obsDate.getTime())) {
        if (dateVal === "today" && obsDate < startOfToday) return false;
        if (dateVal === "week") {
          const sevenDaysAgo = new Date(startOfToday);
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          if (obsDate < sevenDaysAgo) return false;
        }
        if (dateVal === "month") {
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          if (obsDate < startOfMonth) return false;
        }
      }
    }

    return true;
  });

  // Sort Observations
  filtered.sort((a, b) => {
    if (sortVal === "favorites") {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
    }
    if (sortVal === "rating") {
      const rA = a.rating || 5;
      const rB = b.rating || 5;
      if (rB !== rA) return rB - rA;
    }
    if (sortVal === "duration") {
      const durA = a.durationMinutes || 0;
      const durB = b.durationMinutes || 0;
      if (durB !== durA) return durB - durA;
    }
    if (sortVal === "most-objects") {
      const aLen = Array.isArray(a.objects) ? a.objects.length : (a.objects ? String(a.objects).split(",").length : 0);
      const bLen = Array.isArray(b.objects) ? b.objects.length : (b.objects ? String(b.objects).split(",").length : 0);
      if (bLen !== aLen) return bLen - aLen;
    }

    const dateA = new Date((a.date || "") + "T" + (a.startTime || "00:00"));
    const dateB = new Date((b.date || "") + "T" + (b.startTime || "00:00"));
    const timeA = !isNaN(dateA.getTime()) ? dateA.getTime() : 0;
    const timeB = !isNaN(dateB.getTime()) ? dateB.getTime() : 0;

    if (sortVal === "oldest") {
      return timeA - timeB;
    }
    // Default newest first
    return timeB - timeA;
  });

  // Render Empty State if no matches
  if (!filtered.length) {
    historyContainer.innerHTML = `
      <div class="obs-no-match-card" style="grid-column: 1 / -1;">
        <span style="font-size: 2rem; display: block; margin-bottom: 8px;">🔍</span>
        No observations match your selected search or filters.
      </div>
    `;
    return;
  }

  // Render History Cards
  historyContainer.innerHTML = filtered.map(obs => {
    const objectsArr = Array.isArray(obs.objects) ? obs.objects : (typeof obs.objects === "string" && obs.objects ? obs.objects.split(",") : []);
    const tagsArr = Array.isArray(obs.tags) ? obs.tags : [];
    const isFav = Boolean(obs.isFavorite);
    const ratingVal = obs.rating || 5;
    const ratingStars = "★".repeat(ratingVal) + "☆".repeat(5 - ratingVal);
    const objectsPreview = objectsArr.slice(0, 4);
    const remainingCount = objectsArr.length - objectsPreview.length;

    return `
      <div class="obs-history-card ${isFav ? 'is-favorite' : ''}">
        <div>
          <div class="card-header-row" style="display:flex; justify-content:space-between; align-items:flex-start; width:100%;">
            <div style="flex:1;">
              <div style="display:flex; align-items:center; gap:8px;">
                <h4 class="card-obs-title" style="margin:0;">${obs.title || "Untitled Observation"}</h4>
                <span class="card-rating-stars" title="${ratingVal}/5 Stars">${ratingStars}</span>
              </div>
              <div class="card-obs-meta" style="margin-top:4px;">
                <span>${obs.date || "Unknown Date"}</span>
              </div>
            </div>
            <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px; flex-shrink:0;">
              <button type="button" class="card-fav-star ${isFav ? 'active' : ''}" data-id="${obs.id}" title="${isFav ? 'Unmark Favorite' : 'Mark Favorite'}">
                ${isFav ? '⭐' : '☆'}
              </button>
              ${(obs.duration || obs.startTime) ? `<span class="card-obs-time" style="font-size:0.82rem; color:#94a3b8; font-weight:500;">${obs.duration ? obs.duration : (obs.startTime + (obs.endTime ? ' - ' + obs.endTime : ''))}</span>` : ''}
            </div>
          </div>

          <div class="card-details-grid" style="margin-top: 12px;">
            <div class="card-detail-item" title="Location">
              <svg style="vertical-align:middle;margin-right:4px;color:#f43f5e;" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>${obs.location || "N/A"}
            </div>
            <div class="card-detail-item" title="Telescope">
              ${obs.telescope || "N/A"}
            </div>
            <div class="card-detail-item" title="Weather">
              ${obs.weather || "Clear"}
            </div>
            <div class="card-detail-item" title="Seeing & Transparency">
              S:${obs.seeing || 3}/5 | T:${obs.transparency || 3}/5
            </div>
          </div>

          ${tagsArr.length ? `
            <div class="card-tags-row">
              ${tagsArr.map(t => `<span class="obs-tag-pill">${t}</span>`).join("")}
            </div>
          ` : ''}

          ${objectsArr.length ? `
            <div class="card-objects-badges">
              ${objectsPreview.map(o => `<span class="obs-tag-badge">${o.trim()}</span>`).join("")}
              ${remainingCount > 0 ? `<span class="obs-tag-badge">+${remainingCount} more</span>` : ''}
            </div>
          ` : ''}

          ${obs.notes ? `
            <p class="card-notes-preview" style="margin-top: 8px;">"${obs.notes}"</p>
          ` : ''}

          ${Array.isArray(obs.files) && obs.files.length ? `
            <div class="obs-card-attachments">
              ${obs.files.length} Attachment${obs.files.length > 1 ? 's' : ''}
            </div>
          ` : ''}
        </div>

        <div class="card-footer-actions">
          <div class="card-action-group">
            <button type="button" class="obs-btn-sm view-obs-btn" data-id="${obs.id}">View</button>
            <button type="button" class="obs-btn-sm history-edit-btn" data-id="${obs.id}">Edit</button>
            <button type="button" class="obs-btn-sm dup-obs-btn" data-id="${obs.id}">Copy</button>
          </div>
          <button type="button" class="obs-btn-sm delete-btn history-del-btn" data-id="${obs.id}" title="Delete Observation">Delete</button>
        </div>
      </div>
    `;
  }).join("");
}

function renderTimelineCalendar() {
  const container = document.getElementById("observation-calendar-container");
  if (!container) return;

  const monthLabel = document.getElementById("cal-current-month");
  const daysGrid = document.getElementById("calendar-days-grid");

  if (!monthLabel || !daysGrid) return;

  let observations = [];
  try {
    observations = JSON.parse(localStorage.getItem("astroObservations") || "[]");
  } catch (e) {
    observations = [];
  }

  // Filter logic
  const searchQuery = (document.getElementById("obs-search-input")?.value || "").toLowerCase().trim();
  const filterTime = document.getElementById("obs-filter-select")?.value || "all";

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const filtered = observations.filter(obs => {
    if (searchQuery) {
      const titleMatch = (obs.title || "").toLowerCase().includes(searchQuery);
      const locationMatch = (obs.location || "").toLowerCase().includes(searchQuery);
      const telescopeMatch = (obs.telescope || "").toLowerCase().includes(searchQuery);
      const objectsStr = Array.isArray(obs.objects) ? obs.objects.join(" ") : (obs.objects || "");
      const objectsMatch = objectsStr.toLowerCase().includes(searchQuery);
      if (!titleMatch && !locationMatch && !telescopeMatch && !objectsMatch) return false;
    }
    if (filterTime !== "all" && obs.date) {
      const obsDate = new Date(obs.date + "T00:00:00");
      if (!isNaN(obsDate.getTime())) {
        if (filterTime === "today") {
          if (obsDate < startOfToday || obsDate > startOfToday) return false;
        } else if (filterTime === "week") {
          const sevenDaysAgo = new Date(startOfToday);
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          if (obsDate < sevenDaysAgo) return false;
        } else if (filterTime === "month") {
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          if (obsDate < startOfMonth) return false;
        }
      }
    }
    return true;
  });

  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth();

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  monthLabel.textContent = `${monthNames[month]} ${year}`;

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  daysGrid.innerHTML = "";

  // Map observations to days
  const obsByDate = {};
  filtered.forEach(obs => {
    if (obs.date) {
      // Extract YYYY-MM-DD
      const dateKey = obs.date;
      if (!obsByDate[dateKey]) obsByDate[dateKey] = [];
      obsByDate[dateKey].push(obs);
    }
  });

  // Empty cells before start of month
  for (let i = 0; i < firstDay; i++) {
    const emptyCell = document.createElement("div");
    emptyCell.className = "calendar-day empty-day";
    daysGrid.appendChild(emptyCell);
  }

  const todayStr = new Date().toISOString().split("T")[0];

  for (let day = 1; day <= daysInMonth; day++) {
    const cell = document.createElement("div");
    const cellDate = new Date(year, month, day);

    // Format YYYY-MM-DD locally to match input type="date"
    const tzOffset = cellDate.getTimezoneOffset() * 60000;
    const dateKey = new Date(cellDate.getTime() - tzOffset).toISOString().split("T")[0];

    cell.className = "calendar-day";
    if (dateKey === todayStr) {
      cell.classList.add("today");
    }

    const dayEvents = obsByDate[dateKey] || [];

    let dotsHtml = "";
    dayEvents.slice(0, 3).forEach(ev => {
      dotsHtml += `<div class="calendar-event-dot">${ev.title || 'Observation'}</div>`;
    });

    if (dayEvents.length > 3) {
      dotsHtml += `<div class="calendar-event-dot" style="background:transparent;border:none;color:cyan;">+${dayEvents.length - 3} more</div>`;
    }

    cell.innerHTML = `
      <div class="day-number">${day}</div>
      <div class="day-events-container">${dotsHtml}</div>
    `;

    cell.addEventListener("click", () => {
      showCalendarEventsForDate(dateKey, dayEvents);
    });

    daysGrid.appendChild(cell);
  }
}

function showCalendarEventsForDate(dateKey, events) {
  const panel = document.getElementById("calendar-selected-events");
  const label = document.getElementById("selected-date-label");
  const list = document.getElementById("selected-events-list");

  if (!panel || !label || !list) return;

  label.textContent = `Events on ${dateKey}`;
  list.innerHTML = "";

  if (events.length === 0) {
    list.innerHTML = `<div class="obs-no-events">No observations for this date.</div>`;
  } else {
    events.forEach(obs => {
      const timeDisplay = (obs.startTime || obs.endTime) ? `${obs.startTime || ''}${obs.endTime ? ' - ' + obs.endTime : ''}` : 'N/A';
      const objectsArr = Array.isArray(obs.objects) ? obs.objects : (obs.objects ? String(obs.objects).split(',').map(s => s.trim()) : []);
      const objectBadges = objectsArr.length
        ? objectsArr.map(obj => `<span class="obs-object-tag">🪐 ${obj}</span>`).join('')
        : '';

      list.innerHTML += `
        <div class="timeline-event-card">
          <h5>
            ${obs.title || 'Untitled Session'}
            <div style="display:flex;gap:4px;">
              <button class="obs-action-btn edit-btn edit-obs-btn" data-id="${obs.id}" style="padding:2px 5px; font-size:10px;">Edit</button>
              <button class="obs-action-btn delete-btn delete-obs-btn" data-id="${obs.id}" style="padding:2px 5px; font-size:10px;">Del</button>
            </div>
          </h5>
          <div class="timeline-meta">
            <span>⏱️ ${timeDisplay}</span>
            <span>📍 ${obs.location || 'No Location'}</span>
            <span>🔭 ${obs.telescope || 'No Telescope'}</span>
          </div>
          <div class="timeline-objects">
            ${objectBadges}
          </div>
        </div>
      `;
    });
  }

  panel.classList.remove("hidden");
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("cal-prev-month")?.addEventListener("click", () => {
    currentCalendarDate.setDate(1);
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
    renderTimelineCalendar();
  });

  document.getElementById("cal-next-month")?.addEventListener("click", () => {
    currentCalendarDate.setDate(1);
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
    renderTimelineCalendar();
  });

  document.getElementById("cal-today-btn")?.addEventListener("click", () => {
    currentCalendarDate = new Date();
    renderTimelineCalendar();
  });

  document.getElementById("close-selected-events")?.addEventListener("click", () => {
    document.getElementById("calendar-selected-events")?.classList.add("hidden");
  });
});

function calculateSessionHours(startTimeStr, endTimeStr) {
  if (!startTimeStr || !endTimeStr) return 0;
  const [sh, sm] = startTimeStr.split(":").map(Number);
  const [eh, em] = endTimeStr.split(":").map(Number);
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return 0;

  let startMinutes = sh * 60 + sm;
  let endMinutes = eh * 60 + em;
  if (endMinutes < startMinutes) endMinutes += 24 * 60;

  return (endMinutes - startMinutes) / 60;
}

function updateObservationStatistics(observations) {
  const totalSessionsEl = document.querySelector(".observation-stat-card:nth-child(1) .stat-value");
  const totalObjectsEl = document.querySelector(".observation-stat-card:nth-child(2) .stat-value");
  const totalHoursEl = document.querySelector(".observation-stat-card:nth-child(3) .stat-value");
  const favObjectEl = document.querySelector(".observation-stat-card:nth-child(4) .stat-value");

  const mostTelescopeEl = document.getElementById("stat-most-used-telescope");
  const avgDurationEl = document.getElementById("stat-avg-duration");
  const darkestBortleEl = document.getElementById("stat-darkest-bortle");
  const bestSeeingEl = document.getElementById("stat-best-seeing");
  const activeMonthEl = document.getElementById("stat-most-active-month");
  const totalLocationsEl = document.getElementById("stat-total-locations");

  if (!observations || !observations.length) {
    if (totalSessionsEl) totalSessionsEl.textContent = "0";
    if (totalObjectsEl) totalObjectsEl.textContent = "0";
    if (totalHoursEl) totalHoursEl.textContent = "0h";
    if (favObjectEl) favObjectEl.textContent = "--";

    if (mostTelescopeEl) mostTelescopeEl.textContent = "--";
    if (avgDurationEl) avgDurationEl.textContent = "--";
    if (darkestBortleEl) darkestBortleEl.textContent = "--";
    if (bestSeeingEl) bestSeeingEl.textContent = "--";
    if (activeMonthEl) activeMonthEl.textContent = "--";
    if (totalLocationsEl) totalLocationsEl.textContent = "--";
    return;
  }

  // 1. Total Sessions
  if (totalSessionsEl) totalSessionsEl.textContent = observations.length;

  // 2. Objects & Favorite Object Frequency
  const objectFrequency = {};
  const allUniqueObjects = new Set();

  observations.forEach(obs => {
    const objectsArr = Array.isArray(obs.objects)
      ? obs.objects
      : (obs.objects ? String(obs.objects).split(",").map(s => s.trim()) : []);

    objectsArr.forEach(obj => {
      const clean = obj.trim();
      if (clean) {
        allUniqueObjects.add(clean.toLowerCase());
        objectFrequency[clean] = (objectFrequency[clean] || 0) + 1;
      }
    });
  });

  if (totalObjectsEl) totalObjectsEl.textContent = allUniqueObjects.size;

  let favoriteObj = "--";
  let maxObjFreq = 0;
  for (const [obj, freq] of Object.entries(objectFrequency)) {
    if (freq > maxObjFreq) {
      maxObjFreq = freq;
      favoriteObj = obj;
    }
  }
  if (favObjectEl) favObjectEl.textContent = favoriteObj;

  // 3. Total Observation Hours & Avg Duration
  let totalHours = 0;
  let sessionsWithTime = 0;

  observations.forEach(obs => {
    if (obs.startTime && obs.endTime) {
      const h = calculateSessionHours(obs.startTime, obs.endTime);
      totalHours += h;
      if (h > 0) sessionsWithTime++;
    }
  });

  if (totalHoursEl) totalHoursEl.textContent = totalHours > 0 ? `${totalHours.toFixed(1)}h` : "0h";
  if (avgDurationEl) {
    if (sessionsWithTime > 0) {
      const avgH = totalHours / sessionsWithTime;
      avgDurationEl.textContent = avgH < 1 ? `${Math.round(avgH * 60)}m` : `${avgH.toFixed(1)}h`;
    } else {
      avgDurationEl.textContent = "--";
    }
  }

  // 4. Most Used Telescope
  const telescopeFreq = {};
  observations.forEach(obs => {
    if (obs.telescope && obs.telescope.trim()) {
      const t = obs.telescope.trim();
      telescopeFreq[t] = (telescopeFreq[t] || 0) + 1;
    }
  });
  let mostTelescope = "--";
  let maxTelFreq = 0;
  for (const [t, freq] of Object.entries(telescopeFreq)) {
    if (freq > maxTelFreq) {
      maxTelFreq = freq;
      mostTelescope = t;
    }
  }
  if (mostTelescopeEl) mostTelescopeEl.textContent = mostTelescope;

  // 5. Darkest Bortle Scale (Lowest number)
  let minBortle = Infinity;
  observations.forEach(obs => {
    if (obs.bortle) {
      const num = parseInt(obs.bortle, 10);
      if (!isNaN(num) && num < minBortle) minBortle = num;
    }
  });
  if (darkestBortleEl) darkestBortleEl.textContent = minBortle !== Infinity ? `Class ${minBortle}` : "--";

  // 6. Best Seeing (Highest number)
  let maxSeeing = -Infinity;
  observations.forEach(obs => {
    if (obs.seeing) {
      const num = parseInt(obs.seeing, 10);
      if (!isNaN(num) && num > maxSeeing) maxSeeing = num;
    }
  });
  if (bestSeeingEl) bestSeeingEl.textContent = maxSeeing !== -Infinity ? `${maxSeeing}/5` : "--";

  // 7. Most Active Month
  const monthFreq = {};
  observations.forEach(obs => {
    if (obs.date) {
      const d = new Date(obs.date + "T00:00:00");
      if (!isNaN(d.getTime())) {
        const monthName = d.toLocaleString("default", { month: "short", year: "numeric" });
        monthFreq[monthName] = (monthFreq[monthName] || 0) + 1;
      }
    }
  });
  let mostActiveMonth = "--";
  let maxMonthFreq = 0;
  for (const [m, freq] of Object.entries(monthFreq)) {
    if (freq > maxMonthFreq) {
      maxMonthFreq = freq;
      mostActiveMonth = m;
    }
  }
  if (activeMonthEl) activeMonthEl.textContent = mostActiveMonth;

  // 8. Total Different Locations
  const locationsSet = new Set();
  observations.forEach(obs => {
    if (obs.location && obs.location.trim()) {
      locationsSet.add(obs.location.trim().toLowerCase());
    }
  });
  if (totalLocationsEl) totalLocationsEl.textContent = locationsSet.size ? `${locationsSet.size} Location${locationsSet.size > 1 ? 's' : ''}` : "--";
}

/* ==========================================================================
   💾 OBSERVATION IMPORT / EXPORT & BACKUP SYSTEM
   ========================================================================== */

let pendingImportObsList = null;
let pendingImportFileName = "";

function getFormattedDateStamp() {
  const d = new Date();
  return d.toISOString().split("T")[0]; // YYYY-MM-DD
}

// ----------------------------------------------------
// EXPORT FUNCTIONS
// ----------------------------------------------------
function exportObservationsJSON(obsList, customFilename) {
  const observations = obsList || JSON.parse(localStorage.getItem("astroObservations") || "[]");
  if (!observations.length) {
    if (typeof showToast === "function") showToast("No observations to export.");
    return;
  }

  const payload = {
    app: "Astro Explorer",
    version: "2.0.0",
    exportDate: new Date().toISOString(),
    count: observations.length,
    observations: observations
  };

  const jsonStr = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const fileName = customFilename || `astro_observations_${getFormattedDateStamp()}.json`;

  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  if (typeof showToast === "function") showToast(`Exported ${observations.length} observation(s) to JSON.`);
}

function exportObservationsCSV(obsList, customFilename) {
  const observations = obsList || JSON.parse(localStorage.getItem("astroObservations") || "[]");
  if (!observations.length) {
    if (typeof showToast === "function") showToast("No observations to export.");
    return;
  }

  const headers = [
    "ID", "Title", "Date", "Start Time", "End Time", "Duration", "Location", "Telescope",
    "Eyepiece", "Camera", "Objects", "Seeing", "Transparency", "Bortle", "Cloud Cover (%)",
    "Temperature", "Humidity (%)", "Wind Speed", "Rating", "Is Favorite", "Tags", "Weather",
    "Notes", "AI Summary Quality", "AI Scientific Summary", "Attachment Count", "Created At"
  ];

  const escapeCSV = (field) => {
    if (field === null || field === undefined) return '""';
    const str = String(field);
    if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return '"' + str + '"';
  };

  const rows = observations.map(obs => {
    const objectsStr = Array.isArray(obs.objects) ? obs.objects.join(", ") : (obs.objects || "");
    const tagsStr = Array.isArray(obs.tags) ? obs.tags.join(", ") : "";
    const filesCount = Array.isArray(obs.files) ? obs.files.length : 0;
    const aiQuality = obs.aiSummary ? (obs.aiSummary.qualityRating || "") : "";
    const aiSummaryText = obs.aiSummary ? (obs.aiSummary.scientificSummary || "") : "";

    return [
      obs.id || "",
      obs.title || "Untitled",
      obs.date || "",
      obs.startTime || "",
      obs.endTime || "",
      obs.duration || "",
      obs.location || "",
      obs.telescope || "",
      obs.eyepiece || "",
      obs.camera || "",
      objectsStr,
      obs.seeing || "",
      obs.transparency || "",
      obs.bortle || "",
      obs.cloudCover || "",
      obs.temperature || "",
      obs.humidity || "",
      obs.windSpeed || "",
      obs.rating || 5,
      obs.isFavorite ? "Yes" : "No",
      tagsStr,
      obs.weather || "",
      obs.notes || "",
      aiQuality,
      aiSummaryText,
      filesCount,
      obs.createdAt || ""
    ].map(escapeCSV).join(",");
  });

  const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const fileName = customFilename || `astro_observations_${getFormattedDateStamp()}.csv`;

  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  if (typeof showToast === "function") showToast(`Exported ${observations.length} observation(s) to CSV.`);
}

function exportObservationsPDF(obsList, reportTitle) {
  const observations = obsList || JSON.parse(localStorage.getItem("astroObservations") || "[]");
  if (!observations.length) {
    if (typeof showToast === "function") showToast("No observations to export.");
    return;
  }

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    if (typeof showToast === "function") showToast("Please allow popups to generate PDF report.");
    return;
  }

  const titleText = reportTitle || `Astro Explorer Observation Log Report (${getFormattedDateStamp()})`;

  const cardsHtml = observations.map((obs, idx) => {
    const objectsArr = Array.isArray(obs.objects) ? obs.objects : (obs.objects ? String(obs.objects).split(",") : []);
    const tagsArr = Array.isArray(obs.tags) ? obs.tags : [];
    const ratingVal = obs.rating || 5;
    const ratingStars = "★".repeat(ratingVal) + "☆".repeat(5 - ratingVal);

    return `
      <div class="pdf-card">
        <div class="pdf-card-header">
          <div>
            <h3>#${idx + 1}. ${obs.title || "Untitled Observation"}</h3>
            <div class="pdf-meta">
              📅 ${obs.date || "N/A"} | ⏱️ ${obs.duration || (obs.startTime ? obs.startTime + ' - ' + obs.endTime : 'N/A')} | 📍 ${obs.location || "N/A"}
            </div>
          </div>
          <div class="pdf-rating">
            ${ratingStars} (${ratingVal}/5) ${obs.isFavorite ? '⭐' : ''}
          </div>
        </div>

        <div class="pdf-grid">
          <div><strong>Telescope & Gear:</strong> ${obs.telescope || "N/A"} ${obs.eyepiece ? '| Eyepiece: ' + obs.eyepiece : ''} ${obs.camera ? '| Camera: ' + obs.camera : ''}</div>
          <div><strong>Sky Quality:</strong> Bortle Class ${obs.bortle || 4} | Weather: ${obs.weather || 'Clear'}</div>
          <div><strong>Seeing & Trans:</strong> Seeing: ${obs.seeing || 3}/5 | Transparency: ${obs.transparency || 3}/5 | Cloud: ${obs.cloudCover || 0}%</div>
          <div><strong>Environment:</strong> Temp: ${obs.temperature || 'N/A'} | Hum: ${obs.humidity ? obs.humidity + '%' : 'N/A'} | Wind: ${obs.windSpeed || 'N/A'}</div>
        </div>

        ${tagsArr.length ? `
          <div class="pdf-section">
            <strong>Tags:</strong> ${tagsArr.map(t => `<span class="pdf-badge">🏷️ ${t}</span>`).join(" ")}
          </div>
        ` : ''}

        ${objectsArr.length ? `
          <div class="pdf-section">
            <strong>Observed Objects (${objectsArr.length}):</strong> ${objectsArr.map(o => `<span class="pdf-badge">🌌 ${o.trim()}</span>`).join(" ")}
          </div>
        ` : ''}

        ${obs.notes ? `
          <div class="pdf-section">
            <strong>Notes:</strong>
            <p class="pdf-notes">${obs.notes}</p>
          </div>
        ` : ''}

        ${obs.aiSummary ? `
          <div class="pdf-section pdf-ai-box">
            <strong>🤖 AI Scientific Summary (${obs.aiSummary.qualityRating}):</strong>
            <p class="pdf-notes">${obs.aiSummary.scientificSummary}</p>
          </div>
        ` : ''}
      </div>
    `;
  }).join("");

  const docHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${titleText}</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1e293b; padding: 20px; line-height: 1.5; }
        .pdf-header { text-align: center; border-bottom: 3px solid #6366f1; padding-bottom: 12px; margin-bottom: 24px; }
        .pdf-header h1 { margin: 0; color: #312e81; font-size: 22px; }
        .pdf-header p { margin: 4px 0 0 0; color: #64748b; font-size: 13px; }
        .pdf-card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px; margin-bottom: 18px; page-break-inside: avoid; }
        .pdf-card-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 10px; }
        .pdf-card-header h3 { margin: 0; font-size: 16px; color: #1e1b4b; }
        .pdf-meta { font-size: 12px; color: #64748b; margin-top: 2px; }
        .pdf-rating { color: #d97706; font-weight: bold; font-size: 13px; }
        .pdf-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; font-size: 12px; margin-bottom: 10px; background: #f8fafc; padding: 8px; border-radius: 6px; }
        .pdf-section { font-size: 12px; margin-top: 8px; }
        .pdf-badge { display: inline-block; background: #e0e7ff; color: #3730a3; padding: 1px 6px; border-radius: 4px; font-size: 11px; margin-right: 4px; }
        .pdf-notes { background: #f1f5f9; padding: 6px 10px; border-radius: 6px; margin: 4px 0 0 0; white-space: pre-wrap; font-size: 11.5px; }
        .pdf-ai-box { background: #f0fdf4; border: 1px solid #bbf7d0; padding: 8px; border-radius: 6px; margin-top: 8px; }
        .pdf-footer { text-align: center; margin-top: 30px; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; }
      </style>
    </head>
    <body>
      <div class="pdf-header">
        <h1>🔭 ASTRO EXPLORER — OBSERVATION LOG REPORT</h1>
        <p>Generated on ${new Date().toLocaleString()} | Total Sessions Logged: ${observations.length}</p>
      </div>

      ${cardsHtml}

      <div class="pdf-footer">
        Astro Explorer 2.0 • Portable Astronomical Observation Backup & Log Report
      </div>
    </body>
    </html>
  `;

  printWindow.document.write(docHtml);
  printWindow.document.close();

  setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 400);

  if (typeof showToast === "function") showToast(`Generated PDF report for ${observations.length} observation(s).`);
}

// ----------------------------------------------------
// IMPORT FUNCTIONS
// ----------------------------------------------------
function handleImportFileSelect(file) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const errorBanner = document.getElementById("import-error-banner");
    const previewModal = document.getElementById("obs-import-preview-modal");
    const previewItemsContainer = document.getElementById("import-preview-items");
    const metaFilename = document.getElementById("import-meta-filename");
    const metaVersion = document.getElementById("import-meta-version");
    const metaDate = document.getElementById("import-meta-date");
    const metaCount = document.getElementById("import-meta-count");

    if (errorBanner) {
      errorBanner.classList.add("hidden");
      errorBanner.textContent = "";
    }

    try {
      const parsed = JSON.parse(e.target.result);
      let obsList = [];
      let version = "2.0.0";
      let exportDate = new Date().toLocaleDateString();

      if (Array.isArray(parsed)) {
        obsList = parsed;
      } else if (parsed && typeof parsed === "object" && Array.isArray(parsed.observations)) {
        obsList = parsed.observations;
        if (parsed.version) version = parsed.version;
        if (parsed.exportDate) exportDate = new Date(parsed.exportDate).toLocaleDateString();
      } else {
        throw new Error("Invalid backup format. File does not contain an array of observations.");
      }

      if (!obsList.length) {
        throw new Error("Backup file contains 0 observations.");
      }

      pendingImportObsList = obsList;
      pendingImportFileName = file.name;

      if (metaFilename) metaFilename.textContent = file.name;
      if (metaVersion) metaVersion.textContent = version;
      if (metaDate) metaDate.textContent = exportDate;
      if (metaCount) metaCount.textContent = obsList.length;

      if (previewItemsContainer) {
        previewItemsContainer.innerHTML = obsList.slice(0, 10).map(o => `
          <div class="import-preview-item">
            <strong>${o.title || 'Untitled Session'}</strong> — 📅 ${o.date || 'No Date'} (${o.location || 'No Location'})
          </div>
        `).join("") + (obsList.length > 10 ? `<div class="import-preview-item" style="color:#818cf8; text-align:center;">+${obsList.length - 10} more observations</div>` : '');
      }

      if (previewModal) previewModal.classList.remove("hidden");

    } catch (err) {
      console.error("Import file validation error:", err);
      if (typeof showToast === "function") showToast("Invalid backup file: " + err.message);
      if (errorBanner) {
        errorBanner.textContent = "❌ Import Failed: " + err.message;
        errorBanner.classList.remove("hidden");
      }
      if (previewModal) previewModal.classList.remove("hidden");
    }
  };

  reader.readAsText(file);
}

function confirmImportObservations() {
  if (!pendingImportObsList || !pendingImportObsList.length) return;

  const modeRadio = document.querySelector('input[name="import-mode"]:checked');
  const importMode = modeRadio ? modeRadio.value : "merge";

  let existing = [];
  try {
    existing = JSON.parse(localStorage.getItem("astroObservations") || "[]");
  } catch (e) {
    existing = [];
  }

  if (importMode === "replace") {
    if (!confirm("🔴 ARE YOU ABSOLUTELY SURE?\n\nThis will PERMANENTLY DELETE all current observations and replace them with the backup file data.")) {
      return;
    }
    existing = [...pendingImportObsList];
  } else {
    // Merge mode: skip duplicate IDs or duplicate title+date combos
    const existingIds = new Set(existing.map(o => o.id).filter(Boolean));
    const existingKeys = new Set(existing.map(o => `${(o.title || "").trim().toLowerCase()}_${o.date || ""}`));

    let addedCount = 0;
    pendingImportObsList.forEach(obs => {
      const key = `${(obs.title || "").trim().toLowerCase()}_${obs.date || ""}`;
      if (obs.id && existingIds.has(obs.id)) {
        return; // skip duplicate ID
      }
      if (existingKeys.has(key)) {
        return; // skip duplicate title + date
      }

      const restoredObs = {
        ...obs,
        id: obs.id || ("obs_" + Date.now().toString(36) + Math.random().toString(36).substr(2, 5))
      };
      existing.push(restoredObs);
      addedCount++;
    });

    if (typeof showToast === "function") {
      showToast(`Imported ${addedCount} new observation(s) (Skipped ${pendingImportObsList.length - addedCount} duplicates).`);
    }
  }

  try {
    localStorage.setItem("astroObservations", JSON.stringify(existing));
  } catch (e) {
    console.error("Error saving imported observations:", e);
  }

  const previewModal = document.getElementById("obs-import-preview-modal");
  if (previewModal) previewModal.classList.add("hidden");

  pendingImportObsList = null;
  pendingImportFileName = "";

  renderObservations();
}

// ----------------------------------------------------
// LOCAL BACKUP SNAPSHOTS MANAGEMENT
// ----------------------------------------------------
function createLocalSnapshot() {
  let existingObs = [];
  try {
    existingObs = JSON.parse(localStorage.getItem("astroObservations") || "[]");
  } catch (e) {
    existingObs = [];
  }

  if (!existingObs.length) {
    if (typeof showToast === "function") showToast("No observations to back up.");
    return;
  }

  let snapshots = [];
  try {
    snapshots = JSON.parse(localStorage.getItem("astroBackups") || "[]");
  } catch (e) {
    snapshots = [];
  }

  const jsonString = JSON.stringify(existingObs);
  const sizeKB = (jsonString.length / 1024).toFixed(1);
  const newSnapshot = {
    id: "snap_" + Date.now().toString(36),
    date: new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    count: existingObs.length,
    sizeKB: sizeKB,
    data: existingObs
  };

  snapshots.unshift(newSnapshot);
  // Keep up to 10 latest snapshots
  if (snapshots.length > 10) snapshots = snapshots.slice(0, 10);

  try {
    localStorage.setItem("astroBackups", JSON.stringify(snapshots));
  } catch (e) {
    console.error("Error saving local snapshot:", e);
  }

  renderLocalSnapshots();
  if (typeof showToast === "function") showToast(`Instant local snapshot created (${existingObs.length} items, ${sizeKB} KB).`);
}

function renderLocalSnapshots() {
  const container = document.getElementById("obs-snapshots-list-container");
  if (!container) return;

  let snapshots = [];
  try {
    snapshots = JSON.parse(localStorage.getItem("astroBackups") || "[]");
  } catch (e) {
    snapshots = [];
  }

  if (!snapshots.length) {
    container.innerHTML = `<p class="snapshots-empty">No local snapshots created yet. Click 'Create Instant Snapshot' above to save a local backup point.</p>`;
    return;
  }

  container.innerHTML = snapshots.map(snap => `
    <div class="snapshot-item-row" data-id="${snap.id}">
      <div class="snapshot-item-info">
        <span class="snapshot-item-title">Backup Snapshot (${snap.count} Observations)</span>
        <span class="snapshot-item-meta">${snap.date} | ${snap.sizeKB} KB</span>
      </div>
      <div class="snapshot-item-actions">
        <button type="button" class="obs-btn-sm restore-snap-btn" data-id="${snap.id}" title="Restore this snapshot">Restore</button>
        <button type="button" class="obs-btn-sm download-snap-btn" data-id="${snap.id}" title="Download JSON file">Download</button>
        <button type="button" class="obs-btn-sm delete-btn delete-snap-btn" data-id="${snap.id}" title="Delete snapshot">Delete</button>
      </div>
    </div>
  `).join("");
}

function restoreLocalSnapshot(snapId) {
  let snapshots = [];
  try {
    snapshots = JSON.parse(localStorage.getItem("astroBackups") || "[]");
  } catch (e) {
    snapshots = [];
  }

  const snap = snapshots.find(s => s.id === snapId);
  if (!snap || !snap.data) return;

  if (!confirm(`Restore observation backup snapshot from ${snap.date} (${snap.count} observations)?\n\nThis will merge with your current observations without deleting unique items.`)) {
    return;
  }

  let currentObs = [];
  try {
    currentObs = JSON.parse(localStorage.getItem("astroObservations") || "[]");
  } catch (e) { currentObs = []; }

  const currentIds = new Set(currentObs.map(o => o.id).filter(Boolean));
  let added = 0;

  snap.data.forEach(item => {
    if (!currentIds.has(item.id)) {
      currentObs.push(item);
      added++;
    }
  });

  localStorage.setItem("astroObservations", JSON.stringify(currentObs));
  renderObservations();

  if (typeof showToast === "function") {
    showToast(`Restored snapshot! Added ${added} missing observation(s).`);
  }
}

function downloadLocalSnapshotJSON(snapId) {
  let snapshots = [];
  try {
    snapshots = JSON.parse(localStorage.getItem("astroBackups") || "[]");
  } catch (e) {
    snapshots = [];
  }

  const snap = snapshots.find(s => s.id === snapId);
  if (!snap || !snap.data) return;

  exportObservationsJSON(snap.data, `astro_backup_snapshot_${snap.id}.json`);
}

function deleteLocalSnapshot(snapId) {
  let snapshots = [];
  try {
    snapshots = JSON.parse(localStorage.getItem("astroBackups") || "[]");
  } catch (e) {
    snapshots = [];
  }

  snapshots = snapshots.filter(s => s.id !== snapId);
  localStorage.setItem("astroBackups", JSON.stringify(snapshots));
  renderLocalSnapshots();

  if (typeof showToast === "function") showToast("Local backup snapshot deleted.");
}

document.addEventListener("DOMContentLoaded", () => {
  // Global Export Buttons
  document.getElementById("obs-export-json-all-btn")?.addEventListener("click", () => exportObservationsJSON());
  document.getElementById("obs-export-csv-all-btn")?.addEventListener("click", () => exportObservationsCSV());
  document.getElementById("obs-export-pdf-all-btn")?.addEventListener("click", () => exportObservationsPDF());
  document.getElementById("obs-create-snapshot-btn")?.addEventListener("click", createLocalSnapshot);

  // Import Dropzone & Browse File Setup
  const importDropzone = document.getElementById("obs-import-dropzone");
  const browseImportBtn = document.getElementById("browse-import-backup-btn");
  const importFileInput = document.getElementById("obs-import-file-input");

  browseImportBtn?.addEventListener("click", () => importFileInput?.click());
  importFileInput?.addEventListener("change", (e) => {
    if (e.target.files && e.target.files.length) {
      handleImportFileSelect(e.target.files[0]);
    }
  });

  if (importDropzone) {
    importDropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      importDropzone.classList.add("drag-over");
    });
    importDropzone.addEventListener("dragleave", () => importDropzone.classList.remove("drag-over"));
    importDropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      importDropzone.classList.remove("drag-over");
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
        handleImportFileSelect(e.dataTransfer.files[0]);
      }
    });
  }

  // Import Preview Modal Buttons
  document.getElementById("confirm-obs-import-btn")?.addEventListener("click", confirmImportObservations);
  document.getElementById("cancel-obs-import-btn")?.addEventListener("click", () => {
    document.getElementById("obs-import-preview-modal")?.classList.add("hidden");
  });
  document.getElementById("close-obs-import-modal")?.addEventListener("click", () => {
    document.getElementById("obs-import-preview-modal")?.classList.add("hidden");
  });

  // Local Snapshots Container Click Delegation
  const snapshotsContainer = document.getElementById("obs-snapshots-list-container");
  if (snapshotsContainer) {
    snapshotsContainer.addEventListener("click", (e) => {
      const restoreBtn = e.target.closest(".restore-snap-btn");
      const downloadBtn = e.target.closest(".download-snap-btn");
      const deleteBtn = e.target.closest(".delete-snap-btn");

      if (restoreBtn) restoreLocalSnapshot(restoreBtn.dataset.id);
      else if (downloadBtn) downloadLocalSnapshotJSON(downloadBtn.dataset.id);
      else if (deleteBtn) deleteLocalSnapshot(deleteBtn.dataset.id);
    });
  }

  renderLocalSnapshots();

  // ==========================================================================
  // 🔭 ASTRO AI OBSERVATION PICKER & MULTI-CONTEXT LISTENERS
  // ==========================================================================
  document.getElementById("close-ai-obs-picker")?.addEventListener("click", () => {
    document.getElementById("ai-obs-picker-modal")?.classList.add("hidden");
  });

  document.getElementById("ai-obs-picker-search")?.addEventListener("input", renderAIObservationPickerList);
  document.getElementById("ai-obs-picker-sort")?.addEventListener("change", renderAIObservationPickerList);

  const obsPickerListContainer = document.getElementById("ai-obs-picker-list");
  let selectedObsIdForAI = null;

  if (obsPickerListContainer) {
    obsPickerListContainer.addEventListener("click", (e) => {
      const item = e.target.closest(".ai-obs-picker-item");
      if (!item) return;
      selectedObsIdForAI = item.dataset.id;

      document.querySelectorAll(".ai-obs-picker-item").forEach(el => el.classList.remove("selected"));
      item.classList.add("selected");

      const confirmBtn = document.getElementById("confirm-ai-obs-attach-btn");
      if (confirmBtn) confirmBtn.disabled = false;
    });
  }

  document.getElementById("confirm-ai-obs-attach-btn")?.addEventListener("click", () => {
    if (selectedObsIdForAI) {
      selectObservationForAI(selectedObsIdForAI);
    }
  });
});

/* ==========================================================================
   🤖 ASTRO AI FLAGSHIP FUNCTIONS
   ========================================================================== */

let attachedObservationContext = null;

function openAIObservationPicker() {
  const modal = document.getElementById("ai-obs-picker-modal");
  if (!modal) return;
  renderAIObservationPickerList();
  modal.classList.remove("hidden");
}

function renderAIObservationPickerList() {
  const container = document.getElementById("ai-obs-picker-list");
  if (!container) return;

  const searchVal = (document.getElementById("ai-obs-picker-search")?.value || "").toLowerCase().trim();
  const sortVal = document.getElementById("ai-obs-picker-sort")?.value || "newest";

  let observations = [];
  try {
    observations = JSON.parse(localStorage.getItem("astroObservations") || "[]");
  } catch (e) { observations = []; }

  if (!observations.length) {
    container.innerHTML = `<div style="padding:16px; text-align:center; color:#94a3b8; font-size:0.85rem;">No saved observation sessions found. Create one in the Observation tab first!</div>`;
    return;
  }

  let filtered = observations.filter(obs => {
    if (!searchVal) return true;
    const objectsStr = Array.isArray(obs.objects) ? obs.objects.join(" ") : (obs.objects || "");
    const titleMatch = (obs.title || "").toLowerCase().includes(searchVal);
    const locationMatch = (obs.location || "").toLowerCase().includes(searchVal);
    const telescopeMatch = (obs.telescope || "").toLowerCase().includes(searchVal);
    const objectsMatch = objectsStr.toLowerCase().includes(searchVal);
    return titleMatch || locationMatch || telescopeMatch || objectsMatch;
  });

  filtered.sort((a, b) => {
    if (sortVal === "favorites") {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
    }
    if (sortVal === "rating") return (b.rating || 5) - (a.rating || 5);
    const dateA = new Date((a.date || "") + "T" + (a.startTime || "00:00")).getTime() || 0;
    const dateB = new Date((b.date || "") + "T" + (b.startTime || "00:00")).getTime() || 0;
    return sortVal === "oldest" ? dateA - dateB : dateB - dateA;
  });

  container.innerHTML = filtered.map(obs => {
    const isSelected = attachedObservationContext && attachedObservationContext.id === obs.id;
    const objectsArr = Array.isArray(obs.objects) ? obs.objects : (obs.objects ? String(obs.objects).split(",") : []);
    const ratingVal = obs.rating || 5;
    const ratingStars = "★".repeat(ratingVal);

    return `
      <div class="ai-obs-picker-item ${isSelected ? 'selected' : ''}" data-id="${obs.id}">
        <div>
          <div class="ai-obs-item-title">${obs.title || "Untitled Session"} ${obs.isFavorite ? '⭐' : ''}</div>
          <div class="ai-obs-item-meta">
            📅 ${obs.date || 'N/A'} | 📍 ${obs.location || 'N/A'} | 🔭 ${obs.telescope || 'N/A'} | ${ratingStars}
          </div>
          ${objectsArr.length ? `<div style="font-size:0.75rem; color:#818cf8; margin-top:2px;">🌌 ${objectsArr.join(", ")}</div>` : ''}
        </div>
        <button type="button" class="obs-btn-sm select-ai-obs-btn" data-id="${obs.id}">
          ${isSelected ? '✓ Selected' : 'Select'}
        </button>
      </div>
    `;
  }).join("");
}

function selectObservationForAI(obsId) {
  let observations = [];
  try {
    observations = JSON.parse(localStorage.getItem("astroObservations") || "[]");
  } catch (e) { observations = []; }

  const obs = observations.find(o => o.id === obsId);
  if (!obs) return;

  const modeRadio = document.querySelector('input[name="ai-obs-mode"]:checked');
  const mode = modeRadio ? modeRadio.value : "summary";

  if (mode === "summary") {
    attachedObservationContext = {
      id: obs.id,
      mode: "summary",
      title: obs.title,
      date: obs.date,
      location: obs.location,
      telescope: obs.telescope,
      objects: obs.objects,
      bortle: obs.bortle,
      rating: obs.rating,
      text: `Observation Summary: "${obs.title}" (${obs.date}) at ${obs.location}. Telescope: ${obs.telescope}. Objects: ${Array.isArray(obs.objects) ? obs.objects.join(", ") : obs.objects}. Bortle Class ${obs.bortle || 4}, Rating ${obs.rating || 5}/5.`
    };
  } else {
    attachedObservationContext = {
      id: obs.id,
      mode: "full",
      title: obs.title,
      date: obs.date,
      location: obs.location,
      telescope: obs.telescope,
      eyepiece: obs.eyepiece,
      camera: obs.camera,
      objects: obs.objects,
      bortle: obs.bortle,
      seeing: obs.seeing,
      transparency: obs.transparency,
      cloudCover: obs.cloudCover,
      temperature: obs.temperature,
      humidity: obs.humidity,
      windSpeed: obs.windSpeed,
      weather: obs.weather,
      notes: obs.notes,
      rating: obs.rating,
      isFavorite: obs.isFavorite,
      tags: obs.tags,
      aiSummary: obs.aiSummary ? obs.aiSummary.scientificSummary : "",
      text: `Full Observation Log: "${obs.title}" (${obs.date})
Location: ${obs.location} | Telescope: ${obs.telescope} | Eyepiece: ${obs.eyepiece || 'N/A'} | Camera: ${obs.camera || 'N/A'}
Objects Observed: ${Array.isArray(obs.objects) ? obs.objects.join(", ") : obs.objects}
Sky Quality: Bortle ${obs.bortle || 4}, Seeing ${obs.seeing || 3}/5, Transparency ${obs.transparency || 3}/5, Weather: ${obs.weather || 'Clear'}
Environment: Temp ${obs.temperature || 'N/A'}, Humidity ${obs.humidity || 'N/A'}%, Wind ${obs.windSpeed || 'N/A'}
Notes: ${obs.notes || 'None'}
${obs.aiSummary ? 'AI Scientific Summary: ' + obs.aiSummary.scientificSummary : ''}`
    };
  }

  renderContextPills();
  document.getElementById("ai-obs-picker-modal")?.classList.add("hidden");
  if (typeof showToast === "function") showToast(`Attached observation "${obs.title}" (${mode} mode).`);
}

function renderContextPills() {
  const container = document.getElementById("attachment-preview");
  if (!container) return;

  let html = "";

  if (typeof researchMode !== "undefined" && researchMode) {
    html += `
      <div class="context-chip chip-research">
        🧠 Research Mode Active
        <button type="button" class="context-chip-remove" id="remove-research-pill">✕</button>
      </div>
    `;
  }

  if (attachedObservationContext) {
    html += `
      <div class="context-chip chip-obs">
        🔭 Obs: ${attachedObservationContext.title} (${attachedObservationContext.mode})
        <button type="button" class="context-chip-remove" id="remove-obs-pill">✕</button>
      </div>
    `;
  }

  if (typeof attachments !== "undefined" && attachments.length > 0) {
    attachments.forEach((file, index) => {
      const icon = file.type === "image" ? "📷" : "📄";
      html += `
        <div class="context-chip">
          ${icon} ${file.name}
          <button type="button" class="context-chip-remove" onclick="removeAttachment(${index})">✕</button>
        </div>
      `;
    });
  }

  container.innerHTML = html;

  document.getElementById("remove-research-pill")?.addEventListener("click", () => {
    if (typeof researchMode !== "undefined") researchMode = false;
    document.getElementById("ai-research-badge")?.classList.add("hidden");
    renderContextPills();
  });

  document.getElementById("remove-obs-pill")?.addEventListener("click", () => {
    attachedObservationContext = null;
    renderContextPills();
  });
}

