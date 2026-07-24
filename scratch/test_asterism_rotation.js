const fs = require('fs');

const astData = JSON.parse(fs.readFileSync('data/asterisms.json', 'utf8'));
const constData = JSON.parse(fs.readFileSync('data/constellations.lines.json', 'utf8'));

console.log("Asterisms count:", astData.features.length);
console.log("Constellation lines count:", constData.features.length);

console.log("Sample Asterism Feature:", JSON.stringify(astData.features[0], null, 2));
console.log("Sample Constellation Line Feature:", JSON.stringify(constData.features[0], null, 2));
