
(function() {
  'use strict';
  const _log   = console.log.bind(console);
  const _error = console.error.bind(console);
  const _warn  = console.warn.bind(console);

  function serialize(arg) {
    if (!arg) return String(arg);
    if (arg instanceof Error || (arg.message && arg.stack)) return arg.stack || arg.message;
    if (typeof arg === 'object') {
      try { return JSON.stringify(arg); } catch(_) { return String(arg); }
    }
    return String(arg);
  }

  function relay(type, args) {
    const msg = Array.from(args).map(serialize).join(' ');
    // fire-and-forget – do not await so we never block
    fetch('/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, msg })
    }).catch(function() {});
  }

  console.log   = function() { _log.apply(console, arguments);   relay('LOG',   arguments); };
  console.error = function() { _error.apply(console, arguments); relay('ERROR', arguments); };
  console.warn  = function() { _warn.apply(console, arguments);  relay('WARN',  arguments); };

  window.addEventListener('error', function(ev) {
    relay('UNCAUGHT', [(ev.error ? ev.error.stack : ev.message) +
      ' @ ' + ev.filename + ':' + ev.lineno]);
  });
  window.addEventListener('unhandledrejection', function(ev) {
    relay('REJECTION', ['Unhandled Promise: ' +
      (ev.reason ? (ev.reason.stack || ev.reason) : 'unknown')]);
  });
})();
