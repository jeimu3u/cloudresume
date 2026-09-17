/* Floating CV viewer. Progressive enhancement: without JS the links open the PDF directly. */

const PDF_URL = '/james-chambers-cv.pdf';
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.530';
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 5;
const ZOOM_STEP = 1.25;

const viewer = document.getElementById('cv-viewer');
const panel = viewer && viewer.querySelector('.viewer-panel');
const bar = viewer && viewer.querySelector('.viewer-bar');
const stage = viewer && viewer.querySelector('.viewer-stage');
const doc = viewer && viewer.querySelector('.viewer-doc');
const status = viewer && viewer.querySelector('.viewer-status');
const readout = viewer && viewer.querySelector('.viewer-level');
const zoomIn = viewer && viewer.querySelector('[data-zoom="in"]');
const zoomOut = viewer && viewer.querySelector('[data-zoom="out"]');
const zoomFit = viewer && viewer.querySelector('[data-zoom="fit"]');

let pages = [];
let zoom = 1;
let baseScale = 1;
let renderSeq = 0;
let started = false;
let native = false;
let lastFocus = null;
let gesturing = false;
let gestureTimer = 0;
let holdSeq = 0;

if (viewer) wire();

function wire() {
  document.querySelectorAll('[data-cv-open]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      open();
    });
  });

  viewer.querySelectorAll('[data-cv-close]').forEach(function (el) {
    el.addEventListener('click', close);
  });

  zoomIn.addEventListener('click', function () { setZoom(zoom * ZOOM_STEP); });
  zoomOut.addEventListener('click', function () { setZoom(zoom / ZOOM_STEP); });
  zoomFit.addEventListener('click', function () { setZoom(1); });

  document.addEventListener('keydown', onKeydown);
  stage.addEventListener('wheel', onWheel, { passive: false });
  addPinch();
  addPan();

  let resizeTimer;
  window.addEventListener('resize', function () {
    if (viewer.hidden || native || !pages.length) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      baseScale = fitScale();
      render();
    }, 150);
  });
}

/* ---------- open and close ---------- */

function open() {
  if (!viewer.hidden) return;
  lastFocus = document.activeElement;
  const gutter = window.innerWidth - document.documentElement.clientWidth;
  document.body.style.setProperty('--scrollbar', gutter + 'px');
  document.body.classList.add('viewer-open');
  viewer.hidden = false;
  requestAnimationFrame(function () { viewer.classList.add('is-open'); });
  viewer.querySelector('.viewer-close').focus();
  load();

  /* Every visit starts on the whole page, at whatever size the window is now. */
  if (pages.length) {
    requestAnimationFrame(function () {
      zoom = 1;
      baseScale = fitScale();
      render();
      stage.scrollTop = 0;
      stage.scrollLeft = 0;
    });
  }
}

function close() {
  if (viewer.hidden) return;
  viewer.classList.remove('is-open');
  viewer.classList.remove('is-eased');
  panel.style.removeProperty('--panel-w');
  panel.style.removeProperty('--panel-h');
  document.body.classList.remove('viewer-open');
  window.setTimeout(function () { viewer.hidden = true; }, motionOK() ? 220 : 0);
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}

function onKeydown(e) {
  if (viewer.hidden) return;
  if (e.key === 'Escape') { e.preventDefault(); close(); return; }
  if (e.key === 'Tab') { trapFocus(e); return; }
  if (native) return;
  if (e.key === '+' || e.key === '=') { e.preventDefault(); setZoom(zoom * ZOOM_STEP); }
  else if (e.key === '-' || e.key === '_') { e.preventDefault(); setZoom(zoom / ZOOM_STEP); }
  else if (e.key === '0') { e.preventDefault(); setZoom(1); }
}

function trapFocus(e) {
  const items = panel.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])');
  const list = Array.prototype.filter.call(items, function (el) { return el.offsetParent !== null; });
  if (!list.length) return;
  const first = list[0];
  const last = list[list.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

/* ---------- loading ---------- */

async function load() {
  if (started) return;
  started = true;
  try {
    const lib = await import(PDFJS + '/pdf.min.mjs');
    lib.GlobalWorkerOptions.workerSrc = PDFJS + '/pdf.worker.min.mjs';
    const pdf = await lib.getDocument({ url: PDF_URL }).promise;
    for (let n = 1; n <= pdf.numPages; n++) {
      const proxy = await pdf.getPage(n);
      const sheet = document.createElement('div');
      sheet.className = 'viewer-sheet';
      const canvas = document.createElement('canvas');
      canvas.className = 'viewer-page';
      sheet.appendChild(canvas);
      sheet.appendChild(await linkLayer(proxy));
      doc.appendChild(sheet);
      pages.push({ proxy: proxy, canvas: canvas, task: null });
    }
    baseScale = fitScale();
    await render();
    status.hidden = true;
    stage.tabIndex = 0;
  } catch (err) {
    useNative();
  }
}

/* ---------- links ---------- */

/* The email address, phone number and web links are real annotations in the
   PDF. Canvas alone throws them away, so lay an anchor over each one. The
   boxes are placed in percentages, which keeps them on the words as the page
   is zoomed, with no per-frame work. */
async function linkLayer(proxy) {
  const layer = document.createElement('div');
  layer.className = 'viewer-links';
  const view = proxy.getViewport({ scale: 1 });
  const annots = await proxy.getAnnotations({ intent: 'display' });

  annots.forEach(function (a) {
    if (a.subtype !== 'Link' || !a.url) return;
    const r = view.convertToViewportRectangle(a.rect);
    const link = document.createElement('a');
    link.className = 'viewer-link';
    link.href = a.url;
    link.rel = 'noopener noreferrer';
    if (/^https?:/i.test(a.url)) link.target = '_blank';
    link.setAttribute('aria-label', label(a.url));
    link.style.left = pct(Math.min(r[0], r[2]), view.width);
    link.style.top = pct(Math.min(r[1], r[3]), view.height);
    link.style.width = pct(Math.abs(r[2] - r[0]), view.width);
    link.style.height = pct(Math.abs(r[3] - r[1]), view.height);
    layer.appendChild(link);
  });
  return layer;
}

function pct(part, whole) {
  return (part / whole * 100).toFixed(4) + '%';
}

function label(url) {
  if (url.indexOf('mailto:') === 0) return 'Email ' + url.slice(7);
  if (url.indexOf('tel:') === 0) return 'Call ' + url.slice(4);
  try {
    return 'Open ' + new URL(url).hostname.replace(/^www\./, '');
  } catch (err) {
    return 'Open link';
  }
}

/* Browsers that block the CDN still get a working window, with their own PDF controls. */
function useNative() {
  native = true;
  viewer.classList.add('is-native');
  applySize();
  doc.textContent = '';
  const frame = document.createElement('iframe');
  frame.className = 'viewer-frame';
  frame.title = 'James Chambers CV';
  frame.src = PDF_URL + '#view=FitH';
  doc.appendChild(frame);
  status.hidden = true;
}

/* ---------- rendering ---------- */

/* The room a panel has, and the size it sits at before any zooming.
   Measured from the window, not from the panel, so growing the panel
   cannot feed back into the scale the page is fitted at. */
function box() {
  const cs = getComputedStyle(viewer);
  const availW = viewer.clientWidth - (parseFloat(cs.paddingLeft) || 0) * 2;
  const availH = viewer.clientHeight - (parseFloat(cs.paddingTop) || 0) * 2;
  const baseW = parseFloat(cs.getPropertyValue('--panel-base-w')) || availW;
  const baseH = parseFloat(cs.getPropertyValue('--panel-base-h')) || availH;
  return {
    availW: availW,
    availH: availH,
    w: Math.min(baseW, availW),
    h: Math.min(baseH, availH),
    pad: parseFloat(getComputedStyle(stage).paddingLeft) || 0,
    bar: bar.offsetHeight
  };
}

function fitScale() {
  if (!pages.length) return 1;
  const view = pages[0].proxy.getViewport({ scale: 1 });
  const b = box();
  const w = Math.max(120, b.w - b.pad * 2 - 4);
  const h = Math.max(120, b.h - b.bar - b.pad * 2 - 4);
  return Math.max(0.1, Math.min(w / view.width, h / view.height));
}

/* Zooming widens the panel into any space the window has going spare.
   Scrollbars only turn up once it has run out of room. */
function applySize() {
  if (native || !pages.length) {
    viewer.classList.remove('is-eased');
    panel.style.removeProperty('--panel-w');
    panel.style.removeProperty('--panel-h');
    return;
  }
  const b = box();
  const gap = parseFloat(getComputedStyle(doc).rowGap) || 0;
  let cw = 0;
  let ch = gap * (pages.length - 1);
  pages.forEach(function (p) {
    cw = Math.max(cw, parseFloat(p.canvas.style.width) || 0);
    ch += parseFloat(p.canvas.style.height) || 0;
  });

  const w = Math.min(b.availW, Math.max(b.w, cw + b.pad * 2));
  const h = Math.min(b.availH, Math.max(b.h, ch + b.pad * 2 + b.bar));
  panel.style.setProperty('--panel-w', Math.round(w) + 'px');
  panel.style.setProperty('--panel-h', Math.round(h) + 'px');

  /* Panel and page ease to their new size together, so a zoom step reads as
     one movement rather than a jump. */
  viewer.classList.toggle('is-eased', !gesturing);

  /* Where scrollbars take up room, hand the panel that room back, so a
     vertical bar cannot be what brings on a horizontal one. */
  const bars = stage.offsetWidth - stage.clientWidth;
  if (bars > 0) {
    panel.style.setProperty('--panel-w', Math.round(Math.min(b.availW, w + bars)) + 'px');
  }
}

async function render() {
  const seq = ++renderSeq;
  const scale = baseScale * zoom;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  updateControls();

  pages.forEach(function (p) {
    if (p.task) { p.task.cancel(); p.task = null; }
  });

  /* Lay the new size out before drawing anything. The pixels already on
     screen stretch to fill it, so the page is never blank mid-zoom. */
  const jobs = pages.map(function (p) {
    const css = p.proxy.getViewport({ scale: scale });
    p.canvas.style.width = Math.floor(css.width) + 'px';
    p.canvas.style.height = Math.floor(css.height) + 'px';
    return { page: p, viewport: p.proxy.getViewport({ scale: scale * dpr }) };
  });

  applySize();

  for (const job of jobs) {
    if (seq !== renderSeq) return;
    const p = job.page;
    const off = document.createElement('canvas');
    off.width = Math.floor(job.viewport.width);
    off.height = Math.floor(job.viewport.height);
    try {
      p.task = p.proxy.render({ canvas: off, viewport: job.viewport });
      await p.task.promise;
      p.task = null;
    } catch (err) {
      if (seq === renderSeq && err && err.name !== 'RenderingCancelledException') throw err;
      return;
    }
    if (seq !== renderSeq) return;
    p.canvas.width = off.width;
    p.canvas.height = off.height;
    p.canvas.getContext('2d').drawImage(off, 0, 0);
  }
}

/* ---------- zoom ---------- */

function setZoom(next, anchor) {
  if (native || !pages.length) return;
  const target = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next));
  if (Math.abs(target - zoom) < 0.005) return;

  const rect = stage.getBoundingClientRect();
  const ax = anchor ? anchor.x - rect.left : rect.width / 2;
  const ay = anchor ? anchor.y - rect.top : rect.height / 2;
  const ratio = target / zoom;
  const left = (stage.scrollLeft + ax) * ratio - ax;
  const top = (stage.scrollTop + ay) * ratio - ay;

  zoom = target;
  render();
  holdScroll(left, top);
}

/* While the page eases to its new size the scrollable area is still growing,
   so where the zoom was aimed has to be re-applied until it settles. */
function holdScroll(left, top) {
  const id = ++holdSeq;
  const until = performance.now() + (viewer.classList.contains('is-eased') ? 300 : 0);
  (function step() {
    if (id !== holdSeq) return;
    stage.scrollLeft = left;
    stage.scrollTop = top;
    if (performance.now() < until) requestAnimationFrame(step);
  })();
}

/* Pinching and wheel zooming send a stream of small steps. Easing each one
   would leave the page trailing behind the fingers, so it tracks them
   directly and picks the easing back up once they stop. */
function gesture() {
  gesturing = true;
  viewer.classList.remove('is-eased');
  clearTimeout(gestureTimer);
  gestureTimer = window.setTimeout(function () {
    gesturing = false;
    if (!native && pages.length) viewer.classList.add('is-eased');
  }, 180);
}

function updateControls() {
  readout.textContent = Math.round(zoom * 100) + '%';
  zoomIn.disabled = zoom >= ZOOM_MAX - 0.005;
  zoomOut.disabled = zoom <= ZOOM_MIN + 0.005;
  stage.classList.toggle('is-zoomed', zoom > 1.005);
}

function onWheel(e) {
  if (native) return;
  if (!e.ctrlKey && !e.metaKey) return;
  e.preventDefault();
  gesture();
  setZoom(zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12), { x: e.clientX, y: e.clientY });
}

function addPinch() {
  let start = 0;
  let from = 1;
  stage.addEventListener('touchstart', function (e) {
    if (native || e.touches.length !== 2) return;
    start = spread(e.touches);
    from = zoom;
  }, { passive: true });

  stage.addEventListener('touchmove', function (e) {
    if (native || e.touches.length !== 2 || !start) return;
    e.preventDefault();
    gesture();
    const mid = {
      x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
      y: (e.touches[0].clientY + e.touches[1].clientY) / 2
    };
    setZoom(from * (spread(e.touches) / start), mid);
  }, { passive: false });

  stage.addEventListener('touchend', function (e) {
    if (e.touches.length < 2) start = 0;
  }, { passive: true });
}

function spread(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy) || 1;
}

/* Drag to move around a zoomed page. */
function addPan() {
  let from = null;
  stage.addEventListener('pointerdown', function (e) {
    if (native || e.pointerType === 'touch' || zoom <= 1.005 || e.button !== 0) return;
    if (e.target.closest && e.target.closest('.viewer-link')) return;
    from = { x: e.clientX, y: e.clientY, left: stage.scrollLeft, top: stage.scrollTop };
    stage.setPointerCapture(e.pointerId);
    stage.classList.add('is-panning');
  });
  stage.addEventListener('pointermove', function (e) {
    if (!from) return;
    stage.scrollLeft = from.left - (e.clientX - from.x);
    stage.scrollTop = from.top - (e.clientY - from.y);
  });
  ['pointerup', 'pointercancel'].forEach(function (type) {
    stage.addEventListener(type, function () {
      from = null;
      stage.classList.remove('is-panning');
    });
  });
}

function motionOK() {
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
