
(async function BenchmarkHarness() {
  'use strict';

  // ── 1. Wait for Sky Engine to be fully ready ───────────────
  // We poll for window.SkyEngine readiness – this is observation only,
  // we never modify Sky Engine state here.
  async function waitForSkyEngine(timeoutMs) {
    // Fast path: SkyEngine already available (script.js finished before harness ran)
    if (window.SkyEngine && window.SkyEngine.PerformanceMonitor) {
      console.log('[HARNESS] SkyEngine found immediately on window.');
      return;
    }
    console.log('[HARNESS] Polling for window.SkyEngine... (type:', typeof window.SkyEngine, ')');
    return new Promise(function(resolve, reject) {
      var timer = setTimeout(function() {
        // Diagnostic: log what window actually contains
        console.log('[HARNESS] TIMEOUT. window.SkyEngine =', typeof window.SkyEngine);
        reject(new Error('SkyEngine not ready after ' + timeoutMs + 'ms'));
      }, timeoutMs);
      // Primary: listen for the skyengine:ready CustomEvent dispatched by script.js
      window.addEventListener('skyengine:ready', function onReady() {
        clearTimeout(timer);
        window.removeEventListener('skyengine:ready', onReady);
        console.log('[HARNESS] skyengine:ready event received.');
        resolve();
      });
      // Secondary fallback: poll via MessageChannel (micro-task safe, no throttle)
      var mc = new MessageChannel();
      mc.port1.onmessage = function checkPoll() {
        if (window.SkyEngine && window.SkyEngine.PerformanceMonitor) {
          clearTimeout(timer);
          console.log('[HARNESS] SkyEngine found via MessageChannel poll.');
          resolve();
        } else {
          setTimeout(function() { mc.port2.postMessage(null); }, 200);
        }
      };
      mc.port2.postMessage(null);
    });
  }

  // ── 2. Detect whether rAF is compositor-driven (SUSTAINED) ───
  // Headless Chrome fires rAF exactly ONCE on page load then stops.
  // Headed Chrome / real compositor fires rAF continuously at ~60fps.
  // Strategy: count up to MAX_CHECK_FRAMES rAF callbacks.
  //   - If ≥ REQUIRED_FRAMES fire → sustained compositor → resolve(true)
  //   - If rAF stops before MAX_CHECK_FRAMES → resolve(false)
  // No setTimeout used — fully immune to background timer throttling.
  function detectRafAvailability() {
    return new Promise(function(resolve) {
      var frameCount     = 0;
      var REQUIRED_FRAMES  = 5;   // need at least 5 sustained frames
      var MAX_CHECK_FRAMES = 8;   // stop checking after 8 attempts (~133ms @ 60fps)
      var lastTs         = 0;
      var stallTimeout   = null;

      function rafCheck(ts) {
        frameCount++;
        lastTs = ts;

        if (frameCount >= REQUIRED_FRAMES) {
          // Sustained rAF confirmed
          resolve(true);
          return;
        }

        if (frameCount >= MAX_CHECK_FRAMES) {
          // Ran out of attempts without reaching REQUIRED_FRAMES
          resolve(false);
          return;
        }

        // Schedule next check — if rAF stops, this never fires
        // Use a 300ms real-time guard via MessageChannel (not setTimeout)
        var mc = new MessageChannel();
        var fired = false;
        mc.port1.onmessage = function() {
          if (!fired) { fired = true; resolve(false); } // rAF stalled
        };
        // Post a message that will fire if rAF doesn't beat it
        // MessageChannel messages fire in microtask queue — but we want
        // a macro-task delay. Chain two levels to get ~macro-task timing.
        Promise.resolve().then(function() {
          Promise.resolve().then(function() {
            mc.port2.postMessage(null);
          });
        });

        requestAnimationFrame(function(ts2) {
          fired = true; // rAF won the race
          rafCheck(ts2);
        });
      }

      requestAnimationFrame(rafCheck);
    });
  }

  console.log('[HARNESS] Benchmark harness loaded. Waiting for Sky Engine...');

  try {
    await waitForSkyEngine(15000);
  } catch(e) {
    console.error('[HARNESS] ' + e.message + '. Aborting benchmark.');
    return;
  }

  console.log('[HARNESS] Sky Engine ready. Detecting rendering environment...');

  const rafAvailable = await detectRafAvailability();

  if (!rafAvailable) {
    // ── HEADLESS PATH ──────────────────────────────────────────
    // rAF is not compositor-driven. Real frame measurements are not
    // possible in this context. Signal the Node orchestrator to
    // relaunch Chrome in headed mode for accurate benchmarking.
    console.log('[HARNESS] Headless mode detected: rAF compositor not running.');
    console.log('[HARNESS] Sending headless-raf-unavailable signal to host...');
    try {
      await fetch('/signal?type=headless-raf-unavailable', { method: 'POST' });
    } catch(e) {
      console.error('[HARNESS] Failed to send signal: ' + e.message);
    }
    // Stop here. The orchestrator will relaunch Chrome in headed mode.
    return;
  }

  // ── HEADED / COMPOSITOR-DRIVEN PATH ───────────────────────
  console.log('[HARNESS] Compositor-driven rAF confirmed. Starting benchmark phases...');

  // ── 3. Long Task Observer ──────────────────────────────────
  // Benchmark infrastructure only. Never touches Sky Engine.
  var capturedLongTasks = [];
  var ltObserver = null;
  try {
    ltObserver = new PerformanceObserver(function(list) {
      list.getEntries().forEach(function(entry) {
        capturedLongTasks.push({ duration: entry.duration, startTime: entry.startTime });
      });
    });
    ltObserver.observe({ entryTypes: ['longtask'] });
  } catch(e) {
    console.warn('[HARNESS] PerformanceObserver not available:', e.message);
  }

  // ── 4. Private frame measurement loop ──────────────────────
  // This rAF chain is OWNED BY THE HARNESS ONLY.
  // It does not replace or affect the Sky Engine's globalSkyAnimationLoop.
  // Both loops run concurrently: Sky Engine has its own rAF chain,
  // this harness has a separate one for measurement.
  var harnessFrameTimes = [];
  var harnessLastFrame  = 0;
  var harnessRunning    = false;

  function harnessRafLoop(timestamp) {
    if (!harnessRunning) return;
    if (harnessLastFrame > 0) {
      harnessFrameTimes.push(timestamp - harnessLastFrame);
    }
    harnessLastFrame = timestamp;
    requestAnimationFrame(harnessRafLoop);
  }

  function startMeasuring() {
    harnessFrameTimes = [];
    harnessLastFrame  = 0;
    harnessRunning    = true;
    capturedLongTasks.length = 0;
    requestAnimationFrame(harnessRafLoop);
  }

  function stopMeasuring() {
    harnessRunning = false;
  }

  // ── 5. Read Sky Engine telemetry (read-only access) ────────
  // SkyEngine.PerformanceMonitor is a metrics API exposed by script.js.
  // The harness only READS from it. Never writes.
  function readSkyEngineCost() {
    try {
      return window.SkyEngine.PerformanceMonitor.metrics.lastTickDurationMs || 0;
    } catch(e) {
      return 0;
    }
  }

  function summariseFrames() {
    if (harnessFrameTimes.length === 0) return { fps: 0, avg: 0, max: 0 };
    var sum  = harnessFrameTimes.reduce(function(a, b) { return a + b; }, 0);
    var avg  = sum / harnessFrameTimes.length;
    var max  = Math.max.apply(null, harnessFrameTimes);
    var fps  = Math.min(60, Math.round(1000 / avg));
    return { fps: fps, avg: avg, max: max };
  }

  // ── 6. Phase runner ────────────────────────────────────────
  // Uses rAF exclusively for both measurement AND phase duration timing.
  // No setTimeout or setInterval — those are background-throttled in headless.
  // durationMs: target wall-clock duration measured via rAF timestamps
  // actionFn:   called every ~16ms (each rAF tick) during the phase
  var report = {};

  function runPhase(name, durationMs, actionFn) {
    console.log('[HARNESS] Phase start: ' + name);
    harnessFrameTimes = [];
    harnessLastFrame  = 0;
    harnessRunning    = true;
    capturedLongTasks.length = 0;

    return new Promise(function(resolve) {
      var phaseStart = 0;   // set on first rAF tick
      var actionCounter = 0;
      var ACTION_EVERY_N_FRAMES = 3;  // call actionFn every 3 frames (~50ms)

      function phaseLoop(timestamp) {
        if (!harnessRunning) { resolve(); return; }

        // Record frame time
        if (harnessLastFrame > 0) {
          harnessFrameTimes.push(timestamp - harnessLastFrame);
        }
        harnessLastFrame = timestamp;

        // First tick: record phase start
        if (phaseStart === 0) phaseStart = timestamp;

        // Run action function at reduced cadence to avoid flooding
        if (actionFn) {
          actionCounter++;
          if (actionCounter % ACTION_EVERY_N_FRAMES === 0) {
            try { actionFn(); } catch(_) {}
          }
        }

        // Check if phase duration elapsed
        if (timestamp - phaseStart >= durationMs) {
          harnessRunning = false;

          var frames   = summariseFrames();
          var skyCost  = readSkyEngineCost();
          var celCost  = Math.max(0, frames.avg - skyCost);

          report[name] = {
            fps:             frames.fps,
            avgFrameTimeMs:  +frames.avg.toFixed(2),
            maxFrameTimeMs:  +frames.max.toFixed(2),
            frameCount:      harnessFrameTimes.length,
            longTasks:       capturedLongTasks.slice(),
            skyEngineCostMs: +skyCost.toFixed(3),
            celestialCostMs: +celCost.toFixed(2)
          };
          console.log('[HARNESS] Phase done: ' + name +
            ' | fps=' + frames.fps +
            ' | avgFrame=' + frames.avg.toFixed(2) + 'ms' +
            ' | frames=' + harnessFrameTimes.length +
            ' | longTasks=' + capturedLongTasks.length);
          resolve();
          return;
        }

        requestAnimationFrame(phaseLoop);
      }

      requestAnimationFrame(phaseLoop);
    });
  }

  // ── 7. Test phases ─────────────────────────────────────────
  // These phases simulate user interactions.
  // Celestial.rotate / Celestial.zoomBy are legitimate public API calls.
  // They are test INPUTS, not Sky Engine modifications.
  await runPhase('idle', 3000);

  var dragAngle = 0;
  await runPhase('dragging', 4000, function() {
    dragAngle = (dragAngle + 3) % 360;
    if (window.Celestial) {
      try { Celestial.rotate({ center: [dragAngle, 0], duration: 0 }); } catch(_) {}
    }
  });

  var zoomDir = 1, zoomVal = 1.0;
  await runPhase('zooming', 3000, function() {
    zoomVal += 0.04 * zoomDir;
    if (zoomVal > 2.5) zoomDir = -1;
    if (zoomVal < 0.8) zoomDir =  1;
    if (window.Celestial) {
      try { Celestial.zoomBy(zoomVal); } catch(_) {}
    }
  });

  await runPhase('searching', 2000, function() {
    var box = document.getElementById('searchBox');
    if (box) {
      box.value = 'Sirius';
      var form = box.closest('form') || box.parentElement;
      if (form) form.dispatchEvent(new Event('submit', { bubbles: true }));
    }
  });

  // ── 8. Send report to Node orchestrator ───────────────────
  console.log('[HARNESS] All phases complete. Sending report...');
  try {
    await fetch('/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report)
    });
    console.log('[HARNESS] Report delivered.');
  } catch(e) {
    console.error('[HARNESS] Report delivery failed: ' + e.message);
  }
})();
