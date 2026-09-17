/* Floating CV viewer. Progressive enhancement: without JS the links open the PDF directly. */

const PDF_URL = '/james-chambers-cv.pdf';
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.530';
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 5;
const ZOOM_STEP = 1.25;

const viewer = document.getElementById('cv-viewer');
const panel = viewer && viewer.querySelector('.viewer-panel');
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
      render().then(function () {
        stage.scrollTop = 0;
        stage.scrollLeft = 0;
      });
    });
  }
}

function close() {
  if (viewer.hidden) return;
  viewer.classList.remove('is-open');
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
      const canvas = document.createElement('canvas');
      canvas.className = 'viewer-page';
      doc.appendChild(canvas);
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

/* Browsers that block the CDN still get a working window, with their own PDF controls. */
function useNative() {
  native = true;
  viewer.classList.add('is-native');
  doc.textContent = '';
  const frame = document.createElement('iframe');
  frame.className = 'viewer-frame';
  frame.title = 'James Chambers CV';
  frame.src = PDF_URL + '#view=FitH';
  doc.appendChild(frame);
  status.hidden = true;
}

/* ---------- rendering ---------- */

function fitScale() {
  if (!pages.length) return 1;
  const view = pages[0].proxy.getViewport({ scale: 1 });
  const pad = 56;
  const w = Math.max(120, stage.clientWidth - pad);
  const h = Math.max(120, stage.clientHeight - pad);
  return Math.max(0.1, Math.min(w / view.width, h / view.height));
}

async function render() {
  const seq = ++renderSeq;
  const scale = baseScale * zoom;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  updateControls();

  pages.forEach(function (p) {
    if (p.task) { p.task.cancel(); p.task = null; }
  });

  for (const p of pages) {
    if (seq !== renderSeq) return;
    const css = p.proxy.getViewport({ scale: scale });
    const bitmap = p.proxy.getViewport({ scale: scale * dpr });
    p.canvas.width = Math.floor(bitmap.width);
    p.canvas.height = Math.floor(bitmap.height);
    p.canvas.style.width = Math.floor(css.width) + 'px';
    p.canvas.style.height = Math.floor(css.height) + 'px';
    try {
      p.task = p.proxy.render({ canvas: p.canvas, viewport: bitmap });
      await p.task.promise;
      p.task = null;
    } catch (err) {
      if (seq === renderSeq && err && err.name !== 'RenderingCancelledException') throw err;
      return;
    }
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
  render().then(function () {
    stage.scrollLeft = left;
    stage.scrollTop = top;
  });
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
