const Astronomy = require('astronomy-engine');

function getCometPosition(cometData, date, obs) {
  if (!cometData || !cometData.orbitalElements) return null;
  const elem = cometData.orbitalElements;
  const T_p = new Date(elem.perihelionDate);
  if (isNaN(T_p.getTime())) return null;

  const dtDays = (date.getTime() - T_p.getTime()) / (86400000);
  const k = 0.01720209895; // Gaussian gravitational constant
  const q = elem.q;
  const e = elem.e;
  const iRad = (elem.i || 0) * Math.PI / 180;
  const omRad = (elem.om || 0) * Math.PI / 180;
  const wRad = (elem.w || 0) * Math.PI / 180;

  let xPrime = 0, yPrime = 0, rHelio = 0;

  if (e < 1.0) {
    // Elliptical Orbit
    const a = elem.a || (q / (1.0 - e));
    const n = k / Math.pow(a, 1.5);
    let M = (n * dtDays) % (2 * Math.PI);
    if (M < -Math.PI) M += 2 * Math.PI;
    if (M > Math.PI) M -= 2 * Math.PI;

    // Solve Kepler's equation for E: E - e*sin(E) = M
    let E = M + e * Math.sin(M);
    for (let iter = 0; iter < 20; iter++) {
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
    // Hyperbolic Orbit (e >= 1.0)
    const a = Math.abs(elem.a || (q / (e - 1.0)));
    const n = k / Math.pow(a, 1.5);
    const M = n * dtDays;

    let H = Math.log(2.0 * Math.abs(M) / e + 1.8);
    if (M < 0) H = -H;
    for (let iter = 0; iter < 20; iter++) {
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

  // Subtract Earth's heliocentric position using Astronomy Engine
  const time = Astronomy.MakeTime(date);
  const earthVec = Astronomy.HelioVector(Astronomy.Body.Earth, time);

  const xGeo = xHelio - earthVec.x;
  const yGeo = yHelio - earthVec.y;
  const zGeo = zHelio - earthVec.z;

  // Convert Geocentric Ecliptic J2000 to Geocentric Equatorial J2000
  const eps = 23.4392911 * Math.PI / 180;
  const xEq = xGeo;
  const yEq = yGeo * Math.cos(eps) - zGeo * Math.sin(eps);
  const zEq = yGeo * Math.sin(eps) + zGeo * Math.cos(eps);

  const deltaAU = Math.sqrt(xEq * xEq + yEq * yEq + zEq * zEq);
  let raDeg = Math.atan2(yEq, xEq) * 180 / Math.PI;
  if (raDeg < 0) raDeg += 360;
  const decDeg = Math.asin(Math.max(-1, Math.min(1, zEq / deltaAU))) * 180 / Math.PI;

  const hor = obs ? Astronomy.Horizon(time, obs, raDeg / 15, decDeg, Astronomy.Refraction.None) : { altitude: 0, azimuth: 0 };

  const H_mag = cometData.absoluteMagnitude || 5.5;
  const K_param = cometData.slopeParam || 4.0;
  const appMag = H_mag + 5 * Math.log10(deltaAU) + 2.5 * K_param * Math.log10(rHelio);

  return {
    ra: raDeg,
    dec: decDeg,
    altitude: hor.altitude,
    azimuth: hor.azimuth,
    distanceAU: deltaAU,
    helioDistanceAU: rHelio,
    magnitude: Number(appMag.toFixed(1))
  };
}

// Validation Test for 1P/Halley at perihelion (1986-02-09) and current date
const halley = {
  name: "1P/Halley",
  absoluteMagnitude: 5.5,
  slopeParam: 4.0,
  orbitalElements: {
    perihelionDate: "1986-02-09T10:59:00Z",
    q: 0.585978,
    e: 0.9671429,
    i: 162.2627,
    om: 58.4201,
    w: 111.3325,
    a: 17.834144
  }
};

const obs = new Astronomy.Observer(23, 77, 0);

// Test 1: Perihelion date 1986-02-09
const pos1986 = getCometPosition(halley, new Date("1986-02-09T11:00:00Z"), obs);
console.log("Halley 1986 Perihelion Position:", pos1986);

// Test 2: Current date
const posCurrent = getCometPosition(halley, new Date("2026-07-21T12:00:00Z"), obs);
console.log("Halley 2026 Current Position:", posCurrent);
