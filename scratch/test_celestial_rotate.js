const fs = require('fs');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

const dom = new JSDOM(`<!DOCTYPE html><html><body><div id="skyContainer"></div></body></html>`, {
  runScripts: "dangerously",
  resources: "usable"
});

const { window } = dom;
global.window = window;
global.document = window.document;
global.navigator = window.navigator;

// Load d3
const d3Code = fs.readFileSync('lib/d3.v3.min.js', 'utf8');
window.eval(d3Code);
global.d3 = window.d3;

// Load celestial.js
const celestialCode = fs.readFileSync('lib/celestial.js', 'utf8');
window.eval(celestialCode);

console.log("Celestial loaded successfully. Checking Celestial object...");
console.log("Celestial type:", typeof window.Celestial);
