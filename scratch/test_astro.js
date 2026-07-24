const Astronomy = require('astronomy-engine');

const observer = new Astronomy.Observer(23, 77, 0);
const skyTime = new Date('2026-07-18T12:00:00Z');

try {
  const time = Astronomy.MakeTime(skyTime);
  console.log('Time created successfully:', time);
  
  const sunEqu = Astronomy.Equator(Astronomy.Body.Sun, time, observer, true, true);
  console.log('Sun Equator:', sunEqu);
  
  const sunHor = Astronomy.Horizon(time, observer, sunEqu.ra, sunEqu.dec, 0);
  console.log('Sun Horizon:', sunHor);
  
  const moonEqu = Astronomy.Equator(Astronomy.Body.Moon, time, observer, true, true);
  const moonHor = Astronomy.Horizon(time, observer, moonEqu.ra, moonEqu.dec, 0);
  console.log('Moon Horizon:', moonHor);
  
  const moonIllum = Astronomy.Illumination(Astronomy.Body.Moon, time).phase;
  console.log('Moon Illum:', moonIllum);
} catch (e) {
  console.error('Error during execution:', e);
}
