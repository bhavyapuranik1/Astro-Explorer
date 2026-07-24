const Astronomy = require('astronomy-engine');
console.log('Astronomy.Refraction:', Astronomy.Refraction);
try {
  const observer = new Astronomy.Observer(23, 77, 0);
  const time = Astronomy.MakeTime(new Date());
  // Test valid string values by calling Astronomy.Horizon with different values
  const testOptions = ['normal', 'none', 'None', 'Normal', 0, 1, null, undefined];
  for (const opt of testOptions) {
    try {
      Astronomy.Horizon(time, observer, 12, 10, opt);
      console.log(`Option "${opt}" (type: ${typeof opt}) is VALID`);
    } catch (err) {
      console.log(`Option "${opt}" (type: ${typeof opt}) is INVALID:`, err.message);
    }
  }
} catch (e) {
  console.error(e);
}
