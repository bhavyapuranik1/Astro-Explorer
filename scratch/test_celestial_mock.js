const fs = require('fs');

// Create minimal DOM mock
const window = {
  innerWidth: 1000,
  innerHeight: 800,
  devicePixelRatio: 1,
  addEventListener: () => {},
  removeEventListener: () => {}
};

const document = {
  createElement: (tag) => {
    if (tag === 'canvas') {
      return {
        getContext: () => ({
          setTransform: () => {},
          clearRect: () => {},
          beginPath: () => {},
          moveTo: () => {},
          lineTo: () => {},
          stroke: () => {},
          fill: () => {},
          fillText: () => {},
          save: () => {},
          restore: () => {},
          clip: () => {},
          setLineDash: () => {},
          createLinearGradient: () => ({ addColorStop: () => {} }),
          createRadialGradient: () => ({ addColorStop: () => {} })
        }),
        style: {}
      };
    }
    return { style: {} };
  },
  querySelector: () => null,
  querySelectorAll: () => [],
  getElementById: () => null,
  body: { appendChild: () => {}, style: {} }
};

global.window = window;
global.document = document;
global.navigator = { userAgent: "node" };

const d3Code = fs.readFileSync('lib/d3.v3.min.js', 'utf8');
eval(d3Code);
global.d3 = window.d3;

const celestialCode = fs.readFileSync('lib/celestial.js', 'utf8');
eval(celestialCode);

console.log("Celestial loaded.");
