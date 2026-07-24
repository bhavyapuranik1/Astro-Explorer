const fs = require('fs');

// We can test D3 projection behavior directly
const d3 = require('../lib/d3.v3.min.js');

const projection = d3.geo.equirectangular().scale(100).translate([400, 300]);
const map = d3.geo.path().projection(projection);

const astData = JSON.parse(fs.readFileSync('data/asterisms.json', 'utf8'));
const constData = JSON.parse(fs.readFileSync('data/constellations.lines.json', 'utf8'));

const astFeature = astData.features[0];
const constFeature = constData.features[0];

console.log("Initial projection rotation [0, 0, 0]:");
console.log("Constellation path:", map(constFeature).substring(0, 60) + "...");
console.log("Asterism path:", map(astFeature).substring(0, 60) + "...");

projection.rotate([45, 10, 0]);

console.log("\nAfter projection.rotate([45, 10, 0]):");
console.log("Constellation path:", map(constFeature).substring(0, 60) + "...");
console.log("Asterism path:", map(astFeature).substring(0, 60) + "...");
