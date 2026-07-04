
const LOCAL_API_KEY =
localStorage.getItem("OPENROUTER_API_KEY") || "";
const isLocal =
  location.hostname === "localhost" ||
  location.hostname === "127.0.0.1" ||
  location.protocol === "file:";

  const useCloud =
!localStorage.getItem("OPENROUTER_API_KEY");
var currentHDImage = "";
let showHazardOnly = false;
let showNewestOnly = false;
let searchQuery = "";
let searchObjects = [];
let messierObjects = [];
let lgObjects = [];
let animationId = null;
let starLabel = null;
let planetLabel = null;
let isRotating = false;
let skyTime = new Date(); // 🔥 main simulation time
let lastSelectedPlanet = null;
let lastUpdateTime = 0;
let allObjects = [];
let starNames = {};
let planetLabels = [];
let dsoSearchLabel = null;
let searchedObjectName = "";
let selectedObject = null;
let followObject = false;
let lastFollowRA = null;
let lastFollowDEC = null;
let smoothFollowRA = null;
let smoothFollowDEC = null;
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

let nasaCache =

JSON.parse(

localStorage.getItem("NASA_CACHE")

|| "{}"

);

let observer =
  new Astronomy.Observer(
    23,
    77,
    0
  );


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

  cer: "ceres",
  ves: "vesta",
  pal: "pallas",

  eri: "eris",
  mak: "makemake",
  hau: "haumea",

  sol: "sun",
  lun: "moon"
};

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

  telescopeSessions: []

};

async function refreshNASA(date){

try{

const url=

`https://api.nasa.gov/planetary/apod?api_key=7jYgA8NDOyNHfLpSbuEP2uncSWByYecDXKkYa6bJ&date=${date}`;

const res=

await fetchWithRetry(url);

const data=

await res.json();

nasaMemoryCache[date]=data;

nasaCache[date]=data;

localStorage.setItem(

"NASA_CACHE",

JSON.stringify(nasaCache)

);

}
catch(e){

console.log(e);

}

}

function extractStructuredMemory(text){

    const t = text.trim();

    const memory = {
        category: "general",
        key: "",
        value: t
    };

    const rules = [

        // 👤 Name
        {
            category:"profile",
            key:"name",
            patterns:[
                /my name is (.+)/i,
                /i am (.+)/i,
                /mera naam (.+)/i
            ]
        },

        // 🌍 Language
        {
            category:"profile",
            key:"language",
            patterns:[
                /i speak (.+)/i,
                /my language is (.+)/i,
                /meri language (.+)/i,
                /main (.+) bolta/i,
                /main (.+) bolti/i
            ]
        },

        // ❤️ Favourite Planet
        {
            category:"preference",
            key:"favourite_planet",
            patterns:[
                /favorite planet is (.+)/i,
                /favourite planet is (.+)/i,
                /my favourite planet is (.+)/i,
                /my favorite planet is (.+)/i,
                /mera favourite planet (.+)/i,
                /mera favorite planet (.+)/i
            ]
        },

        // 🌙 Favourite Satellite
        {
            category:"preference",
            key:"favourite_satellite",
            patterns:[
                /favorite satellite is (.+)/i,
                /favourite satellite is (.+)/i,
                /my favourite satellite is (.+)/i,
                /my favorite satellite is (.+)/i,
                /mera favourite satellite (.+)/i
            ]
        },

        // 🌌 Favourite Galaxy
        {
            category:"preference",
            key:"favourite_galaxy",
            patterns:[
                /favorite galaxy is (.+)/i,
                /favourite galaxy is (.+)/i,
                /my favourite galaxy is (.+)/i,
                /mera favourite galaxy (.+)/i
            ]
        },

        // ⭐ Favourite Star
        {
            category:"preference",
            key:"favourite_star",
            patterns:[
                /favorite star is (.+)/i,
                /favourite star is (.+)/i,
                /my favourite star is (.+)/i,
                /mera favourite star (.+)/i
            ]
        },

        // ☄️ Favourite Comet
        {
            category:"preference",
            key:"favourite_comet",
            patterns:[
                /favorite comet is (.+)/i,
                /favourite comet is (.+)/i,
                /my favourite comet is (.+)/i
            ]
        },

        // 🛰 Favourite Mission
        {
            category:"preference",
            key:"favourite_mission",
            patterns:[
                /favorite mission is (.+)/i,
                /favourite mission is (.+)/i,
                /my favourite mission is (.+)/i
            ]
        },

        // 🔭 Telescope
        {
            category:"equipment",
            key:"telescope",
            patterns:[
                /my telescope is (.+)/i,
                /i use (.+) telescope/i,
                /mere paas (.+) telescope/i
            ]
        },

        // 📷 Camera
        {
            category:"equipment",
            key:"camera",
            patterns:[
                /my camera is (.+)/i,
                /i use (.+) camera/i
            ]
        }

    ];

    for(const rule of rules){

        for(const pattern of rule.patterns){

            const match = t.match(pattern);

            if(match){

                memory.category = rule.category;
                memory.key = rule.key;
                memory.value = match[1].trim();

                return memory;

            }

        }

    }

    return memory;

}

function findDuplicateMemory(memory){

    return getAllMemoryItems().find(m=>

        m.key &&
        memory.key &&

        m.key.toLowerCase()===memory.key.toLowerCase()

    );

}

function saveMemory(

  
  memoryText,
  category = "general",
  importance = 1
) {

  if (!astroMemory.memories) {

    astroMemory.memories = [];
  }

  const structured = extractStructuredMemory(memoryText);

astroMemory.memories.push({

    id: Date.now(),

    text: memoryText,

    category: structured.category,

    key: structured.key,

    value: structured.value,

    importance,

    time: new Date().toISOString(),

    pinned: false,

    favorite: false,

    updatedAt: new Date().toISOString()

});

console.log("Saved Memory:", astroMemory.memories);

  localStorage.setItem(

    "astroMemory",

    JSON.stringify(
      astroMemory
    )
  );
  saveCloudMemory();
  updateGeneralSettings();
  updateMemorySettings();
renderMemoryList();
}


function saveTheory(text) {

  console.log("🔥 saveTheory()");

  if (!astroMemory.theories) {
    astroMemory.theories = [];
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


function saveObservation(text) {

  if (!astroMemory.observations) {
    astroMemory.observations = [];
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


function saveTelescopeSession(text) {

  if (!astroMemory.telescopeSessions) {
    astroMemory.telescopeSessions = [];
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

  return `

General Memories:
${
  astroMemory.memories
    ?.map(m => "- " + m.text)
    .join("\n") || "None"
}

Theories:
${
  astroMemory.theories
    ?.map(t => "- " + t.text)
    .join("\n") || "None"
}

Observations:
${
  astroMemory.observations
    ?.map(o => "- " + o.text)
    .join("\n") || "None"
}

Telescope Sessions:
${
  astroMemory.telescopeSessions
    ?.map(s => "- " + s.text)
    .join("\n") || "None"
}
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
  return (h + m/60 + s/3600) * 15;
}

function decToDeg(dec) {
  const sign = dec.startsWith("-") ? -1 : 1;
  const [d, m, s] = dec.replace("-", "").split(":").map(Number);
  return sign * (d + m/60 + s/3600);
}



function showTab(tabId, el) {

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

  // 🌌 SKY TAB
  if (tabId === "sky") {
    if (!window.skyLoaded) {
      initSky();
      window.skyLoaded = true;
    }

    requestAnimationFrame(() => {
      Celestial.resize();
    });
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
    .catch(() => {});
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
function cleanNASAOldCache(){

const keys = Object.keys(nasaCache);

if(keys.length <= 30) return;

keys.sort();

while(keys.length > 30){

delete nasaCache[keys.shift()];

}

localStorage.setItem(
"NASA_CACHE",
JSON.stringify(nasaCache)
);

}


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

  if(selectedDate && nasaMemoryCache[selectedDate]){

renderNASA(
nasaMemoryCache[selectedDate]
);

setTimeout(()=>{

refreshNASA(selectedDate);

},100);

const { prev, next } = getAdjacentDates(selectedDate);

Promise.all([

prefetchAPOD(prev),

!isFuture(next)
? prefetchAPOD(next)
: Promise.resolve()

]);
return;

}

  if (selectedDate && nasaCache[selectedDate]) {
    const cached = nasaCache[selectedDate];

    if (!cached || cached.code) {
      if (desc) desc.innerText = "Data not available for this date ❌";
      return;
    }

    renderNASA(cached);

    const { prev, next } = getAdjacentDates(selectedDate);
    prefetchAPOD(prev);
    if (!isFuture(next)) prefetchAPOD(next);
  } else if (selectedDate) {

    if (desc) desc.innerText = "Checking availability... 🔍";

    let url = `https://api.nasa.gov/planetary/apod?api_key=7jYgA8NDOyNHfLpSbuEP2uncSWByYecDXKkYa6bJ&date=${selectedDate}`;

    fetchWithRetry(url)
      .then(res => {
        if (!res.ok) throw new Error("API Error");
        return res.json();
      })
      .then(data => {
        if (!data || data.code) {
          if (desc) desc.innerText = "Data not available ❌";
          return;
        }

        nasaCache[selectedDate] = data;

        nasaMemoryCache[selectedDate] = data;

        localStorage.setItem(

"NASA_CACHE",

JSON.stringify(nasaCache)

);

cleanNASAOldCache();
        const preload = new Image();

preload.src = data.hdurl || data.url;
        renderNASA(data);
        showToast("📦 Loaded from cache");

        const { prev, next } = getAdjacentDates(selectedDate);
        prefetchAPOD(prev);
        if (!isFuture(next)) prefetchAPOD(next);
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

  // 🎯 YouTube / embeddable
  if (videoURL.includes("youtube.com") || videoURL.includes("youtu.be")) {

    if (videoURL.includes("watch?v=")) {
      videoURL = videoURL.replace("watch?v=", "embed/");
    }

    if (videoContainer) {
      videoContainer.innerHTML = `
        <iframe src="${videoURL}" frameborder="0" allowfullscreen></iframe>
      `;

      videoContainer.style.opacity = "0";
      videoContainer.style.transition = "opacity 0.3s ease";

      requestAnimationFrame(() => {
        videoContainer.style.opacity = "1";
      });
    }

  } else {
    // ❌ fallback restore
    if (videoContainer) {
      videoContainer.innerHTML = `
        <div style="padding:20px; text-align:center;">
          <p>⚠️ This video cannot be embedded</p>
          <a href="${videoURL}" target="_blank">▶️ Watch Video</a>
        </div>
      `;
    }
  }

  if (title) title.innerText = data.title + " 🎥";
  if (desc) desc.innerText = data.explanation;
}
  }
  

  // ☄️ ASTEROIDS (FIXED 🔥)
  fetchWithRetry("https://api.nasa.gov/neo/rest/v1/feed?api_key=7jYgA8NDOyNHfLpSbuEP2uncSWByYecDXKkYa6bJ")
  .then(res => res.json())
  .then(data => {

    const container = document.getElementById("asteroid-container");
    container.innerHTML = "";

    // 🔥 FLATTEN
    let asteroids = Object.values(data.near_earth_objects).flat();

    // 🔥 CLEAN (remove invalid)
    asteroids = asteroids.filter(a => a.close_approach_data.length > 0);

    // 🔍 SEARCH
    if (searchQuery) {
      asteroids = asteroids.filter(obj =>
        obj.name.toLowerCase().includes(searchQuery)
      );
    }

    // ⚠️ HAZARD
    if (showHazardOnly) {
      asteroids = asteroids.filter(a => a.is_potentially_hazardous_asteroid);
    }

    asteroids.forEach(a => {
  const approachData = a.close_approach_data[0];

  const speed = Number(approachData.relative_velocity.kilometers_per_hour);
  const missDistance = Number(approachData.miss_distance.kilometers);
  const size = a.estimated_diameter.meters.estimated_diameter_max;
  const distanceFactor = missDistance / 1000000;

  const dangerScore = Math.round(
    (speed / 1000) +
    (size * 0.2) -
    (distanceFactor * 2)
  );

  a.dangerScore = Math.max(0, dangerScore);
});

// 🔥 STEP 2: sort
asteroids.sort((a, b) => b.dangerScore - a.dangerScore);

// 🌍 CLOSEST
    if (showNewestOnly) {
      asteroids = asteroids.slice(0, 10);
    }


    // 🔥 FIND CLOSEST
    let closest = asteroids[0];

    asteroids.forEach(obj => {
      const dist = Number(obj.close_approach_data[0].miss_distance.kilometers);
      const minDist = Number(closest.close_approach_data[0].miss_distance.kilometers);

      if (dist < minDist) {
        closest = obj;
      }
    });

    // 🔥 CREATE CARDS
    asteroids.forEach((obj, index) => {

      const isNewest = index < 5;
      const isHazard = obj.is_potentially_hazardous_asteroid;

      const card = createAsteroidCard(obj, isNewest);

      if (!card) return;

      // 🥇 TOP 3
if (index === 0) {
  const text = showHazardOnly
    ? "🔥 TOP HAZARD"
    : "🔥 MOST DANGEROUS";

  card.innerHTML += `<p style="color: yellow; font-weight: bold;">
    ${text}
  </p>`;
}
else if (index === 1) {
  const text = showHazardOnly
    ? "⚠️ HIGH HAZARD"
    : "⚡ HIGH THREAT";

  card.innerHTML += `<p style="color: orange; font-weight: bold;">
    ${text}
  </p>`;
}
else if (index === 2) {
  const text = showHazardOnly
    ? "⚠️ MODERATE HAZARD"
    : "⚠️ ELEVATED RISK";

  card.innerHTML += `<p style="color: lightgreen; font-weight: bold;">
    ${text}
  </p>`;
}

      // 🎯 highlight
      if (obj.name === closest.name) card.classList.add("closest-card");
      if (isHazard) card.classList.add("hazard-card");

      // 🔥 YAHAN LAGANA HAI (TEST)

      // 🟩 MODAL
      card.addEventListener("click", () => {

         const modal = document.getElementById("asteroid-modal");
    const modalBody = document.getElementById("modal-body");

        const approachData = obj.close_approach_data[0];
        if (!approachData) return;

        const speed = Math.round(approachData.relative_velocity.kilometers_per_hour);
        const missDistance = Math.round(approachData.miss_distance.kilometers);
        const approachDate = approachData.close_approach_date;

        modalBody.innerHTML = `
          <h2>${obj.name}</h2>
          <p>🚀 Speed: ${speed} km/h</p>
          <p>📏 Diameter: ${Math.round(obj.estimated_diameter.meters.estimated_diameter_max)} m</p>
          <p>🌍 Miss Distance: ${missDistance} km</p>
          <p>📅 Approach Date: ${approachDate}</p>
          <p>⚠️ Hazard: ${isHazard ? "Yes" : "No"}</p>
        `;

        modal.classList.add("show");

      }); // 🔵 event end

      container.appendChild(card);

    }); // 🔵 forEach end
    

    });
  }
 
  

function initSky() {
  Celestial.display({
    container: "skyContainer",

    projection: "equirectangular",
    datapath: "data/",

    stars: { show: true, limit: 4, names: true, proper: true },
    constellations: { show: true, names: true, lines: true },

    dsos: {
      show: true,
      names: true,
      name: "id" , 
      limit: 4,
      
    
    },
    messier: {  show: true,
      names: true,
      limit: 100,
      name: "id"  
    },

    planets: { show: false },

    mw: { show: true, opacity: 0.5 },
  });
  
  Celestial.add("lg.json");
  
}

let marker;
let currentTarget = null;

function createMarker() {

  const container = document.getElementById("skyContainer");

  if (!marker) {
    marker = document.createElement("div");
    marker.className = "marker";
    marker.style.position = "absolute";
    marker.style.width = "12px";
    marker.style.height = "12px";
    marker.style.border = "2px solid red";
    marker.style.borderRadius = "50%";
    marker.style.transform = "translate(-50%, -50%)";
    marker.style.pointerEvents = "none";
    marker.style.zIndex = "25";

    container.appendChild(marker);
  }

  // 🔥 IMPORTANT: initial position force
  if (currentTarget) {
    const pt = Celestial.mapProjection(currentTarget);
    if (pt) {
      marker.style.left = pt[0] + "px";
      marker.style.top  = pt[1] + "px";
    }
  }

  // 🔥 loop start (no delay)
  trackMarker();
}

let tracking = false;

function trackMarker() {

  if (!marker || !currentTarget) return;

  if (tracking) return;
  tracking = true;

  let smoothX = null;
  let smoothY = null;

  function loop() {

    if (isRotating) {

  animationId =
    requestAnimationFrame(loop);

  return;
}

    // 🔥 STOP IF INVALID
    if (!marker || !currentTarget) {
      tracking = false;
      return;
    }

    let pt = null;

    // 🔥 SAFE PROJECTION
    if (Array.isArray(currentTarget)) {

      try {
        pt = Celestial.mapProjection(currentTarget);
      }
      catch(err) {
        pt = null;
      }

      // 🔥 INVALID / NOT READY YET
      if (
        !pt ||
        isNaN(pt[0]) ||
        isNaN(pt[1])
      ) {

        animationId = requestAnimationFrame(loop);
        return;
      }
    }

    // 🔥 VALID POINT
    if (pt) {

      // 🔥 FIRST FRAME
      if (smoothX === null) {
        smoothX = pt[0];
        smoothY = pt[1];
      }

      // 🔥 SMOOTH INTERPOLATION
      smoothX += (pt[0] - smoothX) * 0.2;
      smoothY += (pt[1] - smoothY) * 0.2;

      // 🔥 MARKER POSITION
      marker.style.left = smoothX + "px";
      marker.style.top  = smoothY + "px";
      if (searchedObjectName) {
  createDSOSearchLabel(
    searchedObjectName,
    smoothX,
    smoothY
  );
}

      // 🌍 PLANET LABEL FOLLOW
      if (planetLabel) {

        const rect = document
          .getElementById("skyContainer")
          .getBoundingClientRect();

        planetLabel.style.left =
          (smoothX + rect.left + 10) + "px";

        planetLabel.style.top =
          (smoothY + rect.top - 10) + "px";
      }

      // ⭐ STAR LABEL FOLLOW
      if (starLabel) {

  starLabel.style.left = smoothX + "px";

  starLabel.style.top  = smoothY + "px";

}
    }

    // 🔥 NEXT FRAME
    animationId = requestAnimationFrame(loop);
  }

  // 🔥 START LOOP
  loop();
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

  name:
(
  o.messier ||
  o.name ||
  ""
)
.toLowerCase()
.replace(/\s+/g, ""),

id:
(
  o.messier ||
  o.name ||
  ""
)
.toLowerCase()
.replace(/\s+/g, ""),

    ra: raToDeg(o.ra),

    dec: decToDeg(o.dec),

    type: "dso",

    mag:
      o.mag || "N/A",

    constellation:
      o.const || "N/A",

    size:
      o.dim || "N/A",

    morph:
  o.morph || "N/A"
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

  console.log(
  "IC Objects:",
  searchObjects.filter(o => o.name.startsWith("ic"))
);

  // ⭐ CONSTELLATIONS AUTO ADD

const planetData = await fetch("data/planets.json").then(r => r.json());

const cleanPlanets = Object.entries(planetData).map(([key, p]) => {

  const fullName = p.name.toLowerCase(); // venus
  const shortId  = p.id.toLowerCase();   // ven

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

  const observer = new Astronomy.Observer(23, 77, 0); // India

  const equ = Astronomy.Equator(body, date, observer, true, true);

  return [equ.ra, equ.dec];
}
// 🔍 SEARCH FUNCTION
currentTarget = null;
searchedObjectName = "";
function searchObject() {

  // 🔥 RESET
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  if (marker) {
  marker.remove();
  marker = null; // 🔥 IMPORTANT
}
  document.getElementById("highlight-marker")?.remove();

  tracking = false;
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

  // 🔍 INPUT
  let query = document.getElementById("searchBox").value;
  let searchTerm = query.toLowerCase().trim();

  searchTerm = searchTerm.replace(/\s+/g, " ");

  if (constAlias[searchTerm]) {
    searchTerm = constAlias[searchTerm];
  }

  const cleanSearch = searchTerm.replace(/\s+/g, "");
  const cleanQuery  = query.toLowerCase().replace(/\s+/g, "");

  console.log("Searching for:", cleanSearch);

  let obj = null;

  // ⭐ 1. CONSTELLATION
  obj = searchObjects.find(o => {
    if (o.type !== "constellation") return false;

    const short = o.name;
    const full  = (o.fullName || "").replace(/\s+/g, "");

    if (cleanSearch === short) return true;
    if (cleanQuery === full) return true;

    return false;
  });

  // ⭐ 2. STAR
  if (!obj) {
    obj = searchObjects.find(o => {
      if (o.type !== "star") return false;

      const name = o.name || "";
      const id   = o.id?.toString() || "";

      if (!isNaN(cleanSearch) && id === cleanSearch) return true;
      if (name === cleanSearch) return true;

      return false;
    });
  }

  // 🌌 3. DSO
if (!obj) {

  obj = searchObjects.find(o => {

    if (o.type !== "dso") return false;

    // 🔥 NORMALIZED
   const normalize = str =>
  (str || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const name = normalize(o.name);
const id   = normalize(o.id);

const search = normalize(cleanSearch);

    // 🔥 MATCHES
    return (
      name === search ||
      id === search
    );
  });
}

  // 🪐 4. PLANET
  if (!obj) {
  obj = searchObjects.find(o => {
    if (o.type !== "planet") return false;

    return (
      o.name === cleanSearch ||               // venus
      planetMap[o.name] === cleanSearch ||   // ven
      reversePlanetMap[cleanSearch] === o.name // ven → venus
    );
  });
}
  // ❌ NOT FOUND
  if (!obj) {
    alert("Object not found ❌");
    return;
  }

  console.log("Found:", obj);
  selectedObject = obj;
  updateObjectInfo(obj);
  updateDynamicInfo();

  // 🌌 DSO
  if (obj.type === "dso") {
    lastSelectedPlanet = null; // 🔥 ADD THIS
    isRotating = true;

    Celestial.rotate({
      center: [obj.ra, obj.dec],
      duration: 0
    });

    setTimeout(() => {
      isRotating = false;

      currentTarget = [obj.ra, obj.dec]; // 🔥 FIXED
      searchedObjectName = obj.name;
      createMarker();

    }, 50);

    return;
  }

  // 🪐 PLANET (FINAL STABLE + TIME TRAVEL READY)
if (obj.type === "planet") {

  isRotating = true;

  // 🔥 full name resolve (venus, mars, etc)
  const planetName = reversePlanetMap[obj.id] || obj.name;

  // 🔥 SAVE for time simulation
  lastSelectedPlanet = planetName;
  followObject = true;

  // 🔥 get position using simulation time
  const pos = getPlanetPosition(planetName, skyTime);

  if (!pos) {
    console.log("Planet calc failed:", planetName);
    isRotating = false;
    return;
  }

  // 🔥 convert RA → degrees
  const raDeg = pos[0] * 15;
  const dec = pos[1];

  // 🔥 rotate sky
  Celestial.rotate({
    center: [raDeg, dec],
    duration: 0
  });

  // 🔥 marker after rotation
  setTimeout(() => {
    isRotating = false;

    currentTarget = [raDeg, dec];
    createMarker();

    const pt = Celestial.mapProjection([raDeg, dec]);

  }, 50);

  return;
}

//⭐ CONSTELLATION
  if (obj.type === "constellation") {
    lastSelectedPlanet = null; // 🔥 ADD THIS
    isRotating = true;

    Celestial.rotate({
      center: [obj.ra, obj.dec],
      duration: 0
    });

    setTimeout(() => {
      isRotating = false;

      currentTarget = [obj.ra, obj.dec]; // 🔥 FIXED
      createMarker();

    }, 50);

    return;
  }

  // ⭐ STAR
  if (obj.type === "star") {
    lastSelectedPlanet = null; // 🔥 ADD THIS
    isRotating = true;

    Celestial.rotate({
      center: [obj.ra, obj.dec],
      duration: 0
    });

    setTimeout(() => {
      isRotating = false;

      currentTarget = [obj.ra, obj.dec]; // 🔥 FIXED
      createMarker();

      const pt = Celestial.mapProjection([
  obj.ra,
  obj.dec
]);

if (pt) {
  createStarSearchLabel(
    obj.name,
    pt[0],
    pt[1]
  );
}

    }, 50);

    return;
  }
}

function applySkyTime() {

  const input =
    document.getElementById("sky-datetime");

  if (!input.value) return;

  skyTime = new Date(input.value);

selectedObject = selectedObject;

updateDynamicInfo();

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
  Celestial.skyview({
    date: skyTime
  });

  // 🌍 EARTH ROTATION EFFECT
  const hours =
    skyTime.getHours() +
    skyTime.getMinutes() / 60;

  const rotation =
    -(hours / 24) * 360;

  setTimeout(() => {

    Celestial.rotate({
      center: [rotation, 0],
      duration: 1000
    });

  }, 200);

}
function createStarSearchLabel(name, x, y) {

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

  label.style.pointerEvents = "none";
  label.style.zIndex = "9999";

  // ✨ GLOW
  label.style.textShadow =
    "0 0 8px #00ffcc";

  // 🎯 POSITION
  label.style.left = x + "px";
  label.style.top  = y + "px";

  label.style.transform =
    "translate(-50%, -120%)";

  document
    .getElementById("skyContainer")
    .appendChild(label);

  starLabel = label;
}

function updatePlanetLabelPositions() {

  planetLabels.forEach(p => {

    const pos =
      getPlanetPosition(p.name, skyTime);

    if (!pos) return;

    const raDeg = pos[0] * 15;
    const dec   = pos[1];

    const pt =
      Celestial.mapProjection([
        raDeg,
        dec
      ]);

    if (!pt) return;

    p.el.style.left =
      (pt[0] + 10) + "px";

    p.el.style.top =
      (pt[1] - 10) + "px";
  });

  requestAnimationFrame(
    updatePlanetLabelPositions
  );
}

function createPlanetLabel(name, pt) {

  if (planetLabel) {
    planetLabel.remove();
    planetLabel = null;
  }

  const container = document.getElementById("skyContainer");
  

  const label = document.createElement("div");
  label.className = "planet-label";
  label.innerText = name;
label.style.zIndex = "30"; 
  label.style.position = "absolute";
  label.style.color = "yellow";
  label.style.fontSize = "14px";
  label.style.fontWeight = "bold";
  label.style.zIndex = "9999";

  // 🔥 OFFSET FIX
 label.style.left = (pt[0] + 10) + "px";
label.style.top  = (pt[1] - 10) + "px";
  document.getElementById("skyContainer").appendChild(label); // 🔥 CHANGE HERE

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
    label.innerText = fullName;
    label.style.position = "absolute";
    label.style.color = "yellow";
    label.style.fontSize = "12px";
    label.style.zIndex = "20";

    label.style.left = (pt[0] + 10) + "px";
label.style.top  = (pt[1] - 10) + "px";

    document.getElementById("skyContainer").appendChild(label);

    planetLabels.push({
      el: label,
      name: fullName
    });
  });
}


function createDSOSearchLabel(name, x, y) {

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
  label.style.pointerEvents = "none";
  label.style.zIndex = "9999";

  // 🔥 PERFECT POSITION
  label.style.left = x + "px";
  label.style.top  = y + "px";

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

  catch(err) {

    console.log(err);

    document.getElementById(
      "info-ai"
    ).innerText =

      "Information fetch failed.";
  }
}
function updateObjectInfo(obj) {
  currentAIObject = obj;

  const cleanName =
    obj.name.toLowerCase();

  // 🔥 NAME
  document.getElementById(
    "info-name"
  ).innerText =
    obj.name.toUpperCase();

  // 🔥 TYPE
  document.getElementById(
    "info-type"
  ).innerText =
    "Type: " + obj.type;

  // 🔥 RA/DEC NOW HANDLED
  // BY updateDynamicInfo()

  document.getElementById(
    "info-ra"
  ).innerText = "";

  document.getElementById(
    "info-dec"
  ).innerText = "";

  // 🔥 DESCRIPTION

  document.getElementById(
  "info-mag"
).innerText =

  "Magnitude: " +
  (obj.mag || "N/A");

document.getElementById(
  "info-constellation"
).innerText =

  "Constellation: " +
  (obj.constellation || "N/A");

document.getElementById(
  "info-size"
).innerText =

  "Size: " +
  (obj.size || "N/A");

let structure =
  obj.morph || "N/A";

const morphMap = {

  // 🌌 SPIRAL
  "SA(s)b":
    "Spiral Galaxy",

  "SA(s)cd":
    "Spiral Galaxy",

  "SA(s)c":
    "Spiral Galaxy",

  "SA(s)a":
    "Spiral Galaxy",

  "SBa":
    "Barred Spiral Galaxy",

  "SBb":
    "Barred Spiral Galaxy",

  "SBc":
    "Barred Spiral Galaxy",

  "SB(s)m":
    "Barred Spiral Galaxy",

  "SB(s)c":
    "Barred Spiral Galaxy",

  "SB(s)b":
    "Barred Spiral Galaxy",

  "SB(rs)b":
    "Barred Spiral Galaxy",

  "SAB":
    "Intermediate Spiral Galaxy",

  // 🌌 ELLIPTICAL
  "E0":
    "Elliptical Galaxy",

  "E1":
    "Elliptical Galaxy",

  "E2":
    "Elliptical Galaxy",

  "E3":
    "Elliptical Galaxy",

  "E4":
    "Elliptical Galaxy",

  "E5":
    "Elliptical Galaxy",

  "E6":
    "Elliptical Galaxy",

  "E7":
    "Elliptical Galaxy",

  // 🌌 IRREGULAR
  "Irr":
    "Irregular Galaxy",

  "dIrr":
    "Dwarf Irregular Galaxy",

  // 🌟 OPEN CLUSTERS
  "I2m":
    "Open Star Cluster",

  "II2r":
    "Open Star Cluster",

  "III2p":
    "Open Star Cluster",

  "III1m":
    "Open Star Cluster",

  // 🌟 GLOBULAR
  "III":
    "Globular Cluster",

  "IV":
    "Globular Cluster",

  "V":
    "Globular Cluster",

  // ☁️ NEBULAE
  "HII":
    "Emission Nebula",

  "SNR":
    "Supernova Remnant"
};

if (
  morphMap[structure]
) {

  structure =
    morphMap[structure];
}

document.getElementById(
  "info-morph"
).innerText =

  "Structure: " +
  structure;


// 🪐 PLANETS
let temperature = "N/A";

// 🪐 PLANETS
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

// 🪐 PLANETS
if (
  obj.type === "planet"
) {

  temperature =

    planetTemps[
      obj.name.toLowerCase()
    ] || "N/A";
}

// 🌟 STARS
else if (
  obj.type === "star"
) {

  const bv =
    parseFloat(obj.bv);

  if (!isNaN(bv)) {

    temperature =

      Math.round(

        4600 *

        (
          (1 / ((0.92 * bv) + 1.7)) +

          (1 / ((0.92 * bv) + 0.62))
        )

      ) + "K";
  }
}

document.getElementById(
  "info-temp"
).innerText =

  "Temperature: " +
  temperature;

}

function updateDynamicInfo() {

  if (!selectedObject) return;

  let ra = selectedObject.ra;
  let dec = selectedObject.dec;

  // 🪐 PLANETS
  if (selectedObject.type === "planet") {

    const pos = getPlanetPosition(
      selectedObject.name,
      skyTime
    );

    if (!pos) return;

    // 🔥 REAL UPDATED VALUES
    ra = pos[0] * 15;
    dec = pos[1];
    // 🔥 UPDATE LIVE MARKER TARGET
currentTarget = [ra, dec];
  }

  // 🔥 NOW UPDATE PANEL
  document.getElementById(
    "info-ra"
  ).innerText =

    "RA: " +
    ra.toFixed(2);

  document.getElementById(
    "info-dec"
  ).innerText =

    "DEC: " +
    dec.toFixed(2);

  // 🌍 OBSERVER
  

    let riseText = "N/A";
let setText  = "N/A";

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

  const body =
    bodyMap[
      selectedObject.name.toLowerCase()
    ];

  if (body) {

   const astroTime =
  Astronomy.MakeTime(skyTime);

const rise =
  Astronomy.SearchRiseSet(
    body,
    observer,
    +1,
    astroTime,
    2
  );

const set =
  Astronomy.SearchRiseSet(
    body,
    observer,
    -1,
    astroTime,
    2
  );
    if (rise) {

  riseText = formatTime(

    rise.date
      ? rise.date
      : rise
  );
}

if (set) {

  setText = formatTime(

    set.date
      ? set.date
      : set
  );
}
  }

}
catch(err) {

  console.log(
    "Rise/Set error:",
    err
  );
}

  // 🔥 HORIZON CALC
  const hor =
    Astronomy.Horizon(
      skyTime,
      observer,
      ra / 15,
      dec,
      "normal"
    );

  // 🔥 ALTITUDE
  document.getElementById(
    "info-alt"
  ).innerText =

    "Altitude: " +
    hor.altitude.toFixed(2) +
    "°";

  // 🔥 AZIMUTH
  document.getElementById(
    "info-az"
  ).innerText =

    "Azimuth: " +
    hor.azimuth.toFixed(2) +
    "°";

    document.getElementById(
  "info-rise"
).innerText =

  "Rise: " + riseText;

document.getElementById(
  "info-set"
).innerText =

  "Set: " + setText;
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
function dynamicInfoLoop() {

  // 🔥 ADVANCE SIMULATION TIME
  skyTime = new Date(
    skyTime.getTime() +1000
  );

  updateDynamicInfo();
  if (
  followObject &&
  selectedObject &&
  selectedObject.type === "planet"
) {

  const pos = getPlanetPosition(
    selectedObject.name,
    skyTime
  );

  if (pos) {

    const raDeg = pos[0] * 15;
    const dec   = pos[1];

    // 🔥 FIRST TIME
    if (
      lastFollowRA === null ||
      lastFollowDEC === null
    ) {

      lastFollowRA = raDeg;
      lastFollowDEC = dec;
    }

    // 🔥 DRIFT CHECK
    const raDiff =
      Math.abs(raDeg - lastFollowRA);

    const decDiff =
      Math.abs(dec - lastFollowDEC);

    // 🔥 ONLY ROTATE IF BIG ENOUGH
    if (
      raDiff > 0.05 ||
      decDiff > 0.05
    ) {

      if (
  smoothFollowRA === null ||
  smoothFollowDEC === null
) {

  smoothFollowRA = raDeg;
  smoothFollowDEC = dec;
}

// 🔥 SMOOTH INTERPOLATION
smoothFollowRA +=
  (raDeg - smoothFollowRA) * 0.1;

smoothFollowDEC +=
  (dec - smoothFollowDEC) * 0.1;

// 🔥 ROTATE USING SMOOTHED VALUES
Celestial.rotate({

  center: [
    smoothFollowRA,
    smoothFollowDEC
  ],

  duration: 100
});

lastFollowRA = raDeg;
lastFollowDEC = dec;

      lastFollowRA = raDeg;
      lastFollowDEC = dec;
    }
  }
}
}

function updateLastTopic(userInput) {
  lastTopic = userInput;
}

function renderAttachments(){

const container =
document.getElementById(
"attachment-preview"
);

container.innerHTML="";

attachments.forEach((file,index)=>{

const chip =
document.createElement("div");

chip.className =
"attachment-chip";

if(file.type==="image"){

chip.innerHTML=`

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

else{

chip.innerHTML=`

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
.forEach(btn=>{

btn.onclick=()=>{

attachments.splice(

btn.dataset.index,

1

);

renderAttachments();

};

});

}

function createConversationContext(userInput) {

  return `
Previous Topic:
${lastTopic}

Current User Message:
${userInput}
`;
}


function buildAstroPrompt(userMessage, objectData) {

  return `
Selected Object Information:

Name: ${objectData?.name || "Unknown"}
Type: ${objectData?.type || "Unknown"}
Constellation: ${objectData?.constellation || "Unknown"}
Magnitude: ${objectData?.magnitude || "Unknown"}
Distance: ${objectData?.distance || "Unknown"}
RA: ${objectData?.ra || "Unknown"}
DEC: ${objectData?.dec || "Unknown"}

User Question:
${userMessage}
`;
}

document.addEventListener("DOMContentLoaded", async () => {

  


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
.onclick=()=>{

const key=
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
.onclick=()=>{

  localStorage.removeItem("OPENROUTER_API_KEY");

  document
  .getElementById("user-api-key")
  .value="";

  alert("API Key removed.");

};



  detectLocation();
  applyAppearanceSettings();
  applyAccentColor();
  applyAISettings();
  updateMemorySettings();
renderMemoryList();
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
loadNASA();

if (!window.skyLoaded) {
  initSky();

  // ✅ delay yahin lagana hai (DIRECT CALL hata)
    loadObjects().then(() => {

  createAllPlanetLabels();

  setInterval(
    dynamicInfoLoop,
    1000
  );

  updatePlanetLabelPositions();

  window.skyLoaded = true;
});
}

addAIMessage(
  "Hello 🌌 I am Astro AI. Ask me anything about space.",
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

    saveMemory(memoryText);

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

if(file.type === "file"){

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

const finalPrompt = `

${attachmentSummary}

${
uploadedAttachments.some(file => file.type === "image")
? `
One or more astronomical images were uploaded.

Analyze EVERY uploaded image individually.

If text files are also uploaded:

- Read every uploaded file.
- Correlate every image with every uploaded file.
- Never ignore uploaded images.
- Never ignore uploaded files.
- Produce one combined report.

Also analyze:

- celestial objects
- stars
- galaxies
- planets
- nebulae
- image quality
- blur
- noise
- astrophotography quality
- possible telescope capture details
- image sharpness
- exposure balance
- contrast quality
- possible atmospheric distortion
- possible telescope or camera type

Give a dedicated astrophotography analysis section.
`
: ""
}

Saved User Memory:

${loadAllMemories()}

Relevant Memories:

${relatedMemories || "None"}

${userInterestProfile}

${astroSystemPrompt}

${contextPrompt}

${objectPrompt}

${telescopeAdvice}

${relatedConcepts}

${proactiveInsights}

${
researchMode ||
autoResearchMode
? `
Use advanced astrophysics,
scientific terminology,
equations,
deep theoretical explanations,
and research-level discussion.
`
: ""
}

Provide a scientifically accurate and well-structured response.

The response length MUST follow the user's selected Response Length setting.

If the setting is SHORT:
- Keep the reply under 120 words.
- Use no headings.
- Use no bullet points unless absolutely necessary.

If the setting is MEDIUM:
- Keep the reply around 250-500 words.
- Use headings only when useful.

If the setting is DETAILED:
- Provide a comprehensive explanation.
- Use Markdown headings.
- Use bullet points, tables, examples, and scientific reasoning where appropriate.

If the user asks for comparisons:
- Use comparison tables or structured bullet points.

If images are uploaded:
- Analyze each image carefully.
- Mention notable astronomical objects, image quality, possible equipment, and observational details.

If files are uploaded:
- Read every uploaded file carefully.
- Extract important information.
- Summarize key findings.

If both images and files are uploaded:
- Correlate information from all uploaded content.
- Produce one combined analysis.
- Never ignore any uploaded content.

When appropriate:
- Expand into related astronomy concepts.
- Suggest observational tips.
- Mention telescope suitability.
- Mention astrophotography advice.
- Mention scientific implications.

Use proper Markdown headings, bullet points, tables, and equations where useful.

Avoid unnecessary repetition.

Keep the response engaging, educational, scientifically accurate, and well structured.
`;

const responseLength =
localStorage.getItem("responseLength")
|| "medium";

const defaultAISettings = {
    responseLength: "medium",
    creativity: "balanced"
};

const creativity =
localStorage.getItem("creativity")
|| "balanced";

let creativityInstruction = "";

switch (localStorage.getItem("creativity") || "balanced") {

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

let responseInstruction = "";

switch(responseLength){

case "short":

responseInstruction = `
IMPORTANT:
Reply in a maximum of 5 short sentences.
Do NOT use headings.
Do NOT use bullet points.
Keep the answer under 120 words.
`;

break;

case "medium":

responseInstruction = `
Provide a balanced explanation.
Keep the answer around 250-500 words.
Use headings only if needed.
`;

break;

case "long":

responseInstruction = `
Provide a comprehensive explanation.
Use Markdown headings.
Use tables where appropriate.
Explain concepts step by step.
Include scientific reasoning and examples.
`;

break;

}

const enhancedPrompt = `
${creativityInstruction}

${responseInstruction}

${finalPrompt}
`;
      const endpoint = useCloud
? "https://astro-exp-seven.vercel.app/api/chat"
: "https://openrouter.ai/api/v1/chat/completions";

const headers = useCloud

?{

    "Content-Type":"application/json"

}

:{

    "Authorization":

    "Bearer " +

    localStorage.getItem("OPENROUTER_API_KEY"),

    "Content-Type":"application/json",

    "HTTP-Referer":location.origin,

    "X-Title":"Astro AI"

};
let temperature = 0.8;

switch(localStorage.getItem("creativity")){

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

console.log("===== MAIN CHAT =====");
console.log("Endpoint:", endpoint);
console.log("useCloud:", useCloud);

const response = await fetch(endpoint,{

    method:"POST",

    headers,

    body:JSON.stringify({

        model:"openai/gpt-4o-mini",

       messages:[

    {
        role:"system",
        content:`
${creativityInstruction}

${responseInstruction}
`
    },

    {
        role:"user",
        content:[

            {
                type:"text",
                text:finalPrompt
            },

            {
                type:"text",
                text:attachmentPrompt
            },

            ...uploadedAttachments
            .filter(f=>f.type==="image")
            .map(f=>({
                type:"image_url",
                image_url:{
                    url:f.data
                }
            }))

        ]
    }

],

        temperature,
        max_tokens:3000

    })

});

      console.log("Status:", response.status);
console.log("OK:", response.ok);

const raw = await response.clone().text();
console.log("RAW RESPONSE:");
console.log(raw);

      const data =
        await response.json();

      



      let reply =
        "No response.";

      if (data.error) {

        reply =
          "API Error: " +
          data.error.message;
      }

      else if (
        data.choices &&
        data.choices.length > 0
      ) {

        reply =

          data.choices[0]
          .message.content;
      }
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






saveMessage("Astro AI", reply);

saveMessage("Astro AI", reply);

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

    catch(err) {

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

attachBtn.onclick=()=>{

attachMenu.classList.toggle("show");

};

document
.getElementById("image-option")
.onclick=()=>{

const input=
document.getElementById("astro-image");

input.accept="image/*";

input.click();

attachMenu.classList.remove("show");

};

document
.getElementById("file-option")
.onclick=()=>{

const input=
document.getElementById("astro-image");

input.accept=".pdf,.txt,.doc,.docx,.js,.html,.css,.json,.md,.py,.java,.cpp,.c,.zip,.rar";

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
.onclick=()=>{

alert("Coming Soon 🔭");

attachMenu.classList.remove("show");

};

document
.getElementById("research-option")
.onclick = () => {

if (researchMode) {

  addAIMessage(
    "Research mode disabled 😄🔥",
    "Astro AI"
  );

  researchMode = false;

}

else {

  addAIMessage(
    "Research mode enabled 🧠😈🔥",
    "Astro AI"
  );

  researchMode = true;

}

attachMenu.classList.remove("show");

};

document.onclick=(e)=>{

if(
!attachMenu.contains(e.target)
&&
e.target!==attachBtn
){

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


}); // 🔥 DOMContentLoaded END

document
.getElementById("cancel-edit-memory")
?.addEventListener("click",()=>{

document
.getElementById("edit-memory-overlay")
.classList.remove("show");

editingMemory = null;

});

document
.getElementById("save-edit-memory")
?.addEventListener("click",()=>{

if(!editingMemory) return;

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

function addAIMessage(text, sender) {

  const msg =
    document.createElement("div");

    msg.className = "message";

    msg.style.maxWidth = "85%";

msg.style.padding = "12px";

msg.style.borderRadius = "16px";

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

    content.innerHTML = marked.parse(text);

}

msg.appendChild(content);

// 🔥 Sirf AI replies ke liye actions
if (sender !== "You") {

    const actions = document.createElement("div");

    actions.className = "message-actions";

    actions.innerHTML = `
<button class="message-copy-btn">📋</button>
<button class="speak-btn">🔊</button>
<button class="like-btn">👍</button>
<button class="dislike-btn">👎</button>
<button class="regen-btn">🔄</button>
`;

    const copyBtn = actions.querySelector(".message-copy-btn");
    const speakBtn = actions.querySelector(".speak-btn");
    const likeBtn = actions.querySelector(".like-btn");
    const dislikeBtn = actions.querySelector(".dislike-btn");
    const regenBtn = actions.querySelector(".regen-btn");

    copyBtn.onclick = async () => {

        await navigator.clipboard.writeText(text);

        copyBtn.textContent = "✅";

        setTimeout(() => {

            copyBtn.textContent = "📋";

        }, 1000);

    };

    let speaking = false;

speakBtn.onclick = () => {

    if (!speaking) {

        window.speechSynthesis.cancel();

        const speech = new SpeechSynthesisUtterance(text);

        speech.lang = "en-US";
        speech.rate = 1;

        speech.onend = () => {

            speaking = false;
            speakBtn.textContent = "🔊";

        };

        window.speechSynthesis.speak(speech);

        speaking = true;
        speakBtn.textContent = "⏹";

    } else {

        window.speechSynthesis.cancel();

        speaking = false;

        speakBtn.textContent = "🔊";

    }

};

    

    likeBtn.onclick = () => {

    // Agar pehle se liked hai
    if (likeBtn.classList.contains("active")) {

        likeBtn.classList.remove("active");

        likeBtn.style.color = "";

        dislikeBtn.style.display = "inline-block";

        return;
    }

    // Like ON
    likeBtn.classList.add("active");

    likeBtn.style.color = "#22d3ee";

    dislikeBtn.style.display = "none";

    showToast("👍 Thanks for your feedback");

};

   dislikeBtn.onclick = () => {

    // Agar pehle se disliked hai
    if (dislikeBtn.classList.contains("active")) {

        dislikeBtn.classList.remove("active");

        dislikeBtn.style.color = "";

        likeBtn.style.display = "inline-block";

        return;
    }

    // Dislike ON
    dislikeBtn.classList.add("active");

    dislikeBtn.style.color = "#ef4444";

    likeBtn.style.display = "none";

    showToast("👎 Thanks for your feedback");

};

    regenBtn.onclick = () => {

    if (!lastQuestion) return;

    document.getElementById("ai-input").value = lastQuestion;

    document.getElementById("ai-send").click();

};

    // 🔥 Message ke niche buttons
    msg.appendChild(actions);
    



}

// 🔥 You message actions
if(sender === "You"){

const actions=document.createElement("div");

actions.className="message-actions";

actions.innerHTML=`
<button class="select-btn">🔤</button>
<button class="edit-btn">✏️</button>
<button class="message-copy-btn">📋</button>
`;

const selectBtn=actions.querySelector(".select-btn");
const editBtn=actions.querySelector(".edit-btn");
const copyBtn=actions.querySelector(".message-copy-btn");

copyBtn.onclick=async()=>{

await navigator.clipboard.writeText(text);

copyBtn.textContent="✅";

setTimeout(()=>{

copyBtn.textContent="📋";

},1000);

};

selectBtn.onclick = () => {

    content.contentEditable = "true";

    content.focus();

    showToast("Select any text you want");

};

content.addEventListener("blur", () => {

    content.contentEditable = "false";

});

editBtn.onclick=()=>{

const input=document.getElementById("ai-input");

input.value=text;

input.focus();

input.setSelectionRange(text.length,text.length);

};

msg.appendChild(actions);



}

// 🔥 Sirf ek baar append karna hai
document
    .getElementById("ai-messages")
    .appendChild(msg);
}



function formatHistoryDate(time){

const d=new Date(time);

const now=new Date();

const today=new Date(
now.getFullYear(),
now.getMonth(),
now.getDate()
);

const yesterday=new Date(today);

yesterday.setDate(
yesterday.getDate()-1
);

const target=new Date(
d.getFullYear(),
d.getMonth(),
d.getDate()
);

if(target.getTime()===today.getTime()){

return "Today • " +

d.toLocaleTimeString([],{

hour:"2-digit",

minute:"2-digit"

});

}

if(target.getTime()===yesterday.getTime()){

return "Yesterday • " +

d.toLocaleTimeString([],{

hour:"2-digit",

minute:"2-digit"

});

}

return d.toLocaleDateString([],{

day:"numeric",

month:"short",

year:"numeric"

});

}

function isMemoryRequest(text){

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

function shouldSuggestMemory(text){

const t = text.toLowerCase();

const patterns = [

"my favourite",

"my favorite",

"i like",

"i love",

"i prefer",

"my telescope",

"my camera",

"my language",

"my name is",

"i am a",

"mera favourite",

"mera favorite",

"mujhe pasand",

"mere paas",

"meri language",

"mera telescope",

"mera camera",

"main",

"mujhe"

];

return patterns.some(p => t.includes(p));

}

function extractMemory(text){

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

removePatterns.forEach(pattern=>{

memory = memory.replace(pattern,"");

});

return memory.trim();

}

function showToast(message){

const toast =
document.getElementById("toast");

toast.innerText = message;

toast.classList.add("show");

clearTimeout(toast.timer);

toast.timer = setTimeout(()=>{

toast.classList.remove("show");

},2000);

}

function clearChatUI(){

const container =
document.getElementById("ai-messages");

if(container){

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
    
    files.forEach(file=>{

const reader=
new FileReader();

    // 🖼️ IMAGE FILE
    if (
      file.type.startsWith(
        "image/"
      )
    ) {

      reader.onload = () => {

    

    attachments.push({

type:"image",

name:file.name,

data:reader.result

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

type:"file",

name:file.name,

data:reader.result

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

  catch(err) {

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
.addEventListener("click",()=>{

document
.getElementById("profile-menu")
.classList.toggle("show");

});

document
.getElementById("logout-menu-btn")
.addEventListener("click",async()=>{

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

// New profile menu buttons
document.getElementById("google-login").style.display =
"none";

document.getElementById("logout-menu-btn").style.display =
"block";

  // ✅ Pehle current user set karo
  window.currentUser = user;

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

      memories:
        astroMemory.memories || []

    }

  );

}

async function loadCloudMemory() {

  if (!window.currentUser)
    return;

  const docRef =

    doc(
      db,
      "memories",
      window.currentUser.uid
    );

  const snap =

    await getDoc(
      docRef
    );

  if (snap.exists()) {

    astroMemory.memories =

      snap.data().memories;

    localStorage.setItem(

      "astroMemory",

      JSON.stringify(
        astroMemory
      )

    );

  }
  updateGeneralSettings();

}


window.loadChatHistory =
async function() {

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

  catch(err) {

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

  const msg =
    document.createElement("div");

    msg.style.maxWidth = "85%";

msg.style.padding = "12px";

msg.style.borderRadius = "16px";

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

  document
    .getElementById("ai-messages")
    .appendChild(msg);

  const span =
    msg.querySelector(".typing-text");

  let i = 0;

  while (i < text.length) {

    const char = text.charAt(i);

    // 🔥 preserve line breaks
    if (char === "\n") {
      span.innerHTML += "<br>";
    }

    else {
      span.innerHTML += char;
    }

    i++;

    // 🔥 auto scroll
    const container =
      document.getElementById("ai-messages");

    container.scrollTop =
      container.scrollHeight;

    await new Promise(r =>
      setTimeout(r, 8)
    );
  }

  span.innerHTML =
  marked.parse(text);

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
const actions = document.createElement("div");

actions.className = "message-actions";

actions.innerHTML = `
<button class="message-copy-btn">📋</button>
<button class="speak-btn">🔊</button>
<button class="like-btn">👍</button>
<button class="dislike-btn">👎</button>
<button class="regen-btn">🔄</button>
`;

msg.appendChild(actions);

const copyBtn = actions.querySelector(".message-copy-btn");
const speakBtn = actions.querySelector(".speak-btn");
const likeBtn = actions.querySelector(".like-btn");
const dislikeBtn = actions.querySelector(".dislike-btn");
const regenBtn = actions.querySelector(".regen-btn");

copyBtn.onclick = async () => {

    await navigator.clipboard.writeText(text);

    copyBtn.textContent = "✅";

    setTimeout(() => {

        copyBtn.textContent = "📋";

    },1000);

};

let speaking = false;

speakBtn.onclick = () => {

    if (!speaking) {

        window.speechSynthesis.cancel();

        const speech = new SpeechSynthesisUtterance(text);

        speech.lang = "en-US";
        speech.rate = 1;

        speech.onend = () => {

            speaking = false;
            speakBtn.textContent = "🔊";

        };

        window.speechSynthesis.speak(speech);

        speaking = true;
        speakBtn.textContent = "⏹";

    } else {

        window.speechSynthesis.cancel();

        speaking = false;

        speakBtn.textContent = "🔊";

    }

};

likeBtn.onclick = () => {

    // Agar pehle se liked hai
    if (likeBtn.classList.contains("active")) {

        likeBtn.classList.remove("active");

        likeBtn.style.color = "";

        dislikeBtn.style.display = "inline-block";

        return;
    }

    // Like ON
    likeBtn.classList.add("active");

    likeBtn.style.color = "#22d3ee";

    dislikeBtn.style.display = "none";

    showToast("👍 Thanks for your feedback");

};

dislikeBtn.onclick = () => {

    // Agar pehle se disliked hai
    if (dislikeBtn.classList.contains("active")) {

        dislikeBtn.classList.remove("active");

        dislikeBtn.style.color = "";

        likeBtn.style.display = "inline-block";

        return;
    }

    // Dislike ON
    dislikeBtn.classList.add("active");

    dislikeBtn.style.color = "#ef4444";

    likeBtn.style.display = "none";

    showToast("👎 Thanks for your feedback");

};

regenBtn.onclick = () => {

    if (!lastQuestion) return;

    document.getElementById("ai-input").value = lastQuestion;

    document.getElementById("ai-send").click();

};
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

    text: "Hello 🌌 I am Astro AI. Ask me anything about space.",

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
  "Hello 🌌 I am Astro AI. Ask me anything about space.",
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

renderCurrentConversation();
renderHistoryList();
}

async function generateConversationTitle(question, reply){

if(!window.currentUser) return;

if(!currentConversationId) return;

try{

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

    "Content-Type":"application/json",

    "HTTP-Referer":location.origin,

    "X-Title":"Astro AI"
};



console.log("===== TITLE =====");
console.log("Endpoint:", endpoint);
console.log("useCloud:", useCloud);

const response = await fetch(endpoint,{

method:"POST",

headers,

body:JSON.stringify({

model:"openai/gpt-4o-mini",

messages: [

{
role:"system",
content:`
Generate a short conversation title.

Rules:
- Maximum 5 words.
- Do not use quotes.
- Do not use markdown.
- Return only the title.
`
},

{
role:"user",
content:`
Question:
${question}

Assistant Reply:
${reply}
`
}

],

temperature:0.2,

max_tokens:20

})

});

const data=await response.json();

if(!data.choices) return;

const title=
data.choices[0].message.content.trim();

const ref=doc(

db,

"users",

window.currentUser.uid,

"conversations",

currentConversationId

);

const snap=await getDoc(ref);

if(!snap.exists()) return;

const convo=snap.data();

if(convo.title!=="New Astronomy Chat") return;

await setDoc(ref,{

...convo,

title,

updatedAt:Date.now()

});

await loadConversations();

renderHistoryList();

}

catch(err){

console.log(err);

}

}





document
.getElementById("open-ai")
.addEventListener("click",()=>{

document.getElementById("ai-panel").style.display="flex";

document.getElementById("open-ai").style.display="none";

});

document
.getElementById("close-ai")
.addEventListener("click",()=>{

document.getElementById("ai-panel").style.display="none";

document.getElementById("open-ai").style.display="block";

});

function showAPIKeyModal(){

document.getElementById(
"api-key-modal"
).style.display="flex";

}

function hideAPIKeyModal(){

document.getElementById(
"api-key-modal"
).style.display="none";

}

function updateGeneralSettings(){

const conversationCount =
document.getElementById("conversation-count");

const memoryCount =
document.getElementById("memory-count");

const aiStatus =
document.getElementById("ai-status-general");

if(conversationCount){

conversationCount.textContent =
conversations.length;

}

if(memoryCount){

const totalMemories =
(astroMemory.memories?.length || 0) +
(astroMemory.theories?.length || 0) +
(astroMemory.observations?.length || 0) +
(astroMemory.telescopeSessions?.length || 0);

memoryCount.textContent = totalMemories;

}

if(aiStatus){

aiStatus.textContent =
localStorage.getItem("OPENROUTER_API_KEY")
? "🟢 Connected"
: "🔴 Not Connected";

}

}
/* ==========================================
   ASTRO EXPLORER SETTINGS
========================================== */

/* ==========================================
   ASTRO EXPLORER SETTINGS
========================================== */

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

    });

  });

}
document.getElementById("environment-status").textContent =
isLocal
? "🟡 Local Development"
: "🟢 Production";

document.getElementById("firebase-status").textContent =
window.db
? "🟢 Connected"
: "🔴 Offline";

document.getElementById("database-status").textContent =
window.db
? "🟢 Online"
: "🔴 Offline";

document.getElementById("ai-status-general").textContent =
localStorage.getItem("OPENROUTER_API_KEY")
? "🟢 Connected"
: "🔴 Not Connected";

document.getElementById("conversation-count").textContent =
conversations.length;

document.getElementById("memory-count").textContent =
astroMemory.memories.length;

document.getElementById("clear-cache-btn").onclick=()=>{

localStorage.clear();

showToast("🧹 Cache Cleared");

location.reload();

};

document.getElementById("reset-settings-btn").onclick=()=>{

if(!confirm("Reset all settings?"))
return;

localStorage.removeItem("astroSettings");

showToast("⚙ Settings Reset");

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
localStorage.getItem("openrouter_api_key");

if(savedKey){

settingsApiKey.value =
"••••••••••••••••";

apiStatus.textContent =
"🟢 Connected";

}else{

apiStatus.textContent =
"🔴 Not Connected";

}


// Change API Key

changeApiKeyBtn?.addEventListener("click",()=>{

showAPIKeyModal();

});


// Remove API Key

removeApiKeySettingsBtn?.addEventListener("click",()=>{

if(confirm("Remove saved API Key?")){

localStorage.removeItem("openrouter_api_key");

settingsApiKey.value="";

apiStatus.textContent=
"🔴 Not Connected";

showToast("API Key Removed");

}

});


// View History

viewHistoryBtn?.addEventListener("click",()=>{

showToast("Chat History coming in Phase 2.2");

});


// New Chat

newChatSettingsBtn?.addEventListener("click",async()=>{

if(typeof createNewConversation==="function"){

await createNewConversation(
"New Astronomy Chat"
);

showToast("New Chat Created");

}

});


// Clear Current Chat

clearCurrentBtn?.addEventListener("click", async ()=>{

if(!currentConversationId) return;

if(!confirm("Clear current conversation?")) return;

try{

const ref = doc(

db,

"users",

window.currentUser.uid,

"conversations",

currentConversationId

);

const snap = await getDoc(ref);

if(!snap.exists()) return;

const data = snap.data();

await setDoc(

ref,

{

...data,

messages:[],

updatedAt:Date.now()

}

);

clearChatUI();

addAIMessage(

"Hello 🌌 I am Astro AI. Ask me anything about space.",

"Astro AI"

);

await loadConversations();

renderHistoryList();

showToast("🗑 Current chat cleared");

}

catch(err){

console.log(err);

showToast("Failed to clear chat");

}

});


// Clear All Chats

clearAllBtn?.addEventListener("click", async ()=>{

if(!window.currentUser) return;

if(!confirm("Delete ALL conversations? This cannot be undone.")) return;

try{

for(const conv of conversations){

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

catch(err){

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

importInput.onchange=async(e)=>{

const file=e.target.files[0];

if(!file)return;

try{

const text=
await file.text();

const data=
JSON.parse(text);

if(
!data.title||
!Array.isArray(data.messages)
){

showToast(
"Invalid Chat File"
);

return;

}

const id=
"conv_"+Date.now();

await setDoc(

doc(

db,

"users",

window.currentUser.uid,

"conversations",

id

),

{

title:data.title,

createdAt:
data.createdAt||
Date.now(),

updatedAt:
Date.now(),

messages:
data.messages,

pinned:false

}

);

await loadConversations();

renderHistoryList();

showToast(
"📥 Chat Imported"
);

}

catch(err){

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

viewHistoryBtn?.addEventListener("click",()=>{

historyOverlay.style.display="flex";

renderHistoryList();

});


// CLOSE

closeHistoryBtn?.addEventListener("click",()=>{

historyOverlay.style.display="none";

});


// CLICK OUTSIDE

historyOverlay?.addEventListener("click",(e)=>{

if(e.target===historyOverlay){

historyOverlay.style.display="none";

}

});


// SEARCH

historySearch?.addEventListener("input",()=>{

renderHistoryList(
historySearch.value.toLowerCase()
);

});


// RENDER

function renderHistoryList(search=""){

historyList.innerHTML="";

if(
!Array.isArray(conversations) ||
conversations.length===0
){

historyList.innerHTML=`

<div class="history-item">

<div class="history-title">

No conversations

</div>

</div>

`;

return;

}

const sortedConversations =

[...conversations].sort((a,b)=>{

if(a.pinned!==b.pinned){

return b.pinned-a.pinned;

}

return (b.updatedAt||0)-(a.updatedAt||0);

});

sortedConversations.forEach(conv=>{

if(

search &&
!conv.title.toLowerCase().includes(search)

)return;

const item=
document.createElement("div");

item.className=
"history-item";

if(conv.id===currentConversationId){

item.classList.add("active-history");

}

if(conv.pinned){

    item.classList.add("pinned");

}
const lastMessage =

conv.messages &&
conv.messages.length

? conv.messages[
conv.messages.length-1
].text.substring(0,60)

: "No messages yet";

item.innerHTML=`

<div class="history-title">

${conv.title}

</div>

<div class="history-preview">

${lastMessage}

</div>

<div class="history-date">

${formatHistoryDate(
conv.updatedAt||Date.now()
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

[JSON.stringify(exportData,null,2)],

{

type:"application/json"

}

);

const url =
URL.createObjectURL(blob);

const a =
document.createElement("a");

a.href = url;

a.download =
`${conv.title.replace(/[\\/:*?"<>|]/g,"_")}.json`;

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

    catch(err){

        console.log(err);

    }

};


// OPEN

item.querySelector(".open-chat").onclick=async()=>{

historyOverlay.style.display="none";

currentConversationId=conv.id;

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

if(!title || title.trim()==="") return;

try{

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

catch(err){

console.log(err);

showToast("Rename Failed");

}

};

// DELETE

item.querySelector(".delete-chat").onclick = async () => {

if(!confirm("Delete this conversation?"))
return;

try{

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

catch(err){

console.log(err);

}

};

historyList.appendChild(item);

});

}

function applyAppearanceSettings(){

const size =

localStorage.getItem("fontSize") || "16";

document.documentElement.style.fontSize =
size + "px";

const select =
document.getElementById("font-size-select");

if(select){

select.value = size;

}

}

const fontSizeSelect =
document.getElementById("font-size-select");

fontSizeSelect?.addEventListener("change",()=>{

localStorage.setItem(

"fontSize",

fontSizeSelect.value

);

applyAppearanceSettings();

showToast("🎨 Font size updated");

});

function applyAccentColor(){

const color =

localStorage.getItem("accentColor")

|| "#00f5ff";

document.documentElement.style.setProperty(

"--accent",

color

);

const select =

document.getElementById(

"accent-color-select"

);

if(select){

select.value=color;

}

}

const accentSelect =

document.getElementById(

"accent-color-select"

);

accentSelect?.addEventListener(

"change",

()=>{

localStorage.setItem(

"accentColor",

accentSelect.value

);

applyAccentColor();

showToast(

"🎨 Accent Updated"

);

});

function applyAISettings(){

    const responseLength =
        localStorage.getItem("responseLength") || "medium";

    const creativity =
        localStorage.getItem("creativity") || "balanced";

    const responseSelect =
        document.getElementById("response-length");

    const creativitySelect =
        document.getElementById("creativity-select");

    if(responseSelect){
        responseSelect.value = responseLength;
    }

    if(creativitySelect){
        creativitySelect.value = creativity;
    }

}

const responseLengthSelect =
document.getElementById("response-length");

const creativitySelect =
document.getElementById("creativity-select");

// Response Length
responseLengthSelect?.addEventListener("change", () => {

    localStorage.setItem(
        "responseLength",
        responseLengthSelect.value
    );

    applyAISettings();

    showToast("🤖 AI Settings Saved");

});

// Creativity
creativitySelect?.addEventListener("change", () => {

    localStorage.setItem(
        "creativity",
        creativitySelect.value
    );

    applyAISettings();

    showToast("🤖 AI Settings Saved");

});

applyAISettings();

function updateMemorySettings() {

    const memories = astroMemory.memories || [];
    const theories = astroMemory.theories || [];
    const observations = astroMemory.observations || [];

    document.getElementById("memory-total").textContent =
        memories.length + theories.length + observations.length;

    document.getElementById("memory-pref-count").textContent =
        memories.length;

    document.getElementById("memory-theory-count").textContent =
        theories.length;

    document.getElementById("memory-observation-count").textContent =
        observations.length;

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
    memories = memories.filter(m =>
        (m.text || "").toLowerCase().includes(search)
    );

    // Filter
    if (filter !== "all" && filter !== "pinned") {

    memories = memories.filter(m =>
        m.type.toLowerCase() === filter
    );

}

if (filter === "pinned") {

    memories = memories.filter(m => m.pinned);

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

    memories.forEach(memory => {

        const card = document.createElement("div");

        card.className = "memory-card";

        card.innerHTML = `

<div class="memory-top">

<div class="memory-title">

${memory.pinned ? "📌" : "🧠"}

${memory.type}

</div>

<div class="memory-icons">

<button
class="memory-btn"
onclick="togglePin(${memory.id})">

${memory.pinned ? "📍" : "📌"}

</button>

<button
class="memory-btn"
onclick="toggleFavorite(${memory.id})">

${memory.favorite ? "⭐" : "☆"}

</button>

</div>

</div>

<div class="memory-body">

${memory.text}

</div>

<div class="memory-bottom">

<div class="memory-time">

${new Date(memory.time).toLocaleString()}

</div>

<div class="memory-actions">

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

</div>

</div>

`;

        list.appendChild(card);

    });

}

function findMemoryById(id){

    const groups=[

        astroMemory.memories||[],
        astroMemory.theories||[],
        astroMemory.observations||[],
        astroMemory.telescopeSessions||[]

    ];

    for(const group of groups){

        const memory=group.find(m=>m.id==id);

        if(memory) return memory;

    }

    return null;

}

function deleteMemoryById(id){

if(!confirm("Delete this memory?")) return;

[
astroMemory.memories,
astroMemory.theories,
astroMemory.observations,
astroMemory.telescopeSessions

].forEach(arr=>{

const index=arr.findIndex(m=>m.id==id);

if(index!=-1){

arr.splice(index,1);

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

function editMemory(id){

    const memory = findMemoryById(id);

    if(!memory) return;

    editingMemory = memory;

    document.getElementById(
        "edit-memory-text"
    ).value = memory.text;

    document
        .getElementById("edit-memory-overlay")
        .classList.add("show");

}
function togglePin(id){

    const memory=findMemoryById(id);

    if(!memory) return;

    memory.pinned=!memory.pinned;

    memory.updatedAt=new Date().toISOString();

    localStorage.setItem(

        "astroMemory",

        JSON.stringify(astroMemory)

    );

    saveCloudMemory();

    updateMemorySettings();

    renderMemoryList();

}

function toggleFavorite(id){

    const memory=findMemoryById(id);

    if(!memory) return;

    memory.favorite=!memory.favorite;

    memory.updatedAt=new Date().toISOString();

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
        }))

    ];

}
function toggleFavorite(id){

    const memory = findMemoryById(id);

    if(!memory) return;

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
function togglePin(id){

    const memory = findMemoryById(id);

    if(!memory) return;

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
document.getElementById("export-memory")
?.addEventListener("click",()=>{

const blob = new Blob(

[
JSON.stringify(
astroMemory,
null,
2
)
],

{
type:"application/json"
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
?.addEventListener("click",()=>{

const blob = new Blob(

[
JSON.stringify(
astroMemory,
null,
2
)
],

{
type:"application/json"
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
?.addEventListener("click",()=>{

const input =
document.createElement("input");

input.type="file";

input.accept=".json";

input.onchange=e=>{

const file =
e.target.files[0];

if(!file) return;

const reader =
new FileReader();

reader.onload=()=>{

try{

astroMemory=
JSON.parse(reader.result);

localStorage.setItem(

"astroMemory",

JSON.stringify(astroMemory)

);

saveCloudMemory();

updateMemorySettings();

renderMemoryList();

alert("Memory Imported.");

}

catch{

alert("Invalid File.");

}

};

reader.readAsText(file);

};

input.click();

});

document
.getElementById("clear-memory")
?.addEventListener("click",()=>{

if(

!confirm(

"Delete ALL memories?"

)

)

return;

astroMemory={

memories:[],

theories:[],

observations:[],

telescopeSessions:[]

};

localStorage.setItem(

"astroMemory",

JSON.stringify(astroMemory)

);

saveCloudMemory();

updateMemorySettings();

renderMemoryList();

});

function findMemoryById(id){

    const groups = [

        astroMemory.memories || [],
        astroMemory.theories || [],
        astroMemory.observations || [],
        astroMemory.telescopeSessions || []

    ];

    for(const group of groups){

        const memory = group.find(m => m.id == id);

        if(memory) return memory;

    }

    return null;

}

function showMemorySuggestion(memory){

  const duplicate =
findDuplicateMemory(memory);

const existing =
document.getElementById("memory-suggestion");

if(existing) existing.remove();

const box=document.createElement("div");

box.id="memory-suggestion";

box.innerHTML = `

<h3>🧠 Memory Detected</h3>

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

${
duplicate ?

`

<div class="duplicate-warning">

⚠ Similar memory already exists.

<br><br>

<b>Old:</b>

${duplicate.value||duplicate.text}

<br>

<b>New:</b>

${memory.value}

</div>

`

:

""

}

<div class="memory-suggest-buttons">

${
duplicate ?

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
behavior:"smooth"
});

document
.getElementById("remember-btn")
?.addEventListener("click",()=>{

saveMemory(

memory.value,

memory.category

);

box.remove();

showToast("🧠 Memory Saved");

});

document
.getElementById("update-memory-btn")
?.addEventListener("click",()=>{

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
?.addEventListener("click",()=>{

saveMemory(

memory.value,

memory.category

);

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
.onclick=()=>{

box.remove();

};

}


