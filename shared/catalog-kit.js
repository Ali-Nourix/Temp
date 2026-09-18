/* ============================================================
   catalog-kit.js — mechanisms shared by every catalog variant.

   Three things every variant gets, wired by one call to CatalogKit.mount():

     1. Procedural placeholder artwork. Deterministic per seed, so a
        product keeps its look across reloads and across variants. No
        network, no stock photos. Swap in real photography by putting a
        real URL in the media descriptor's `src`.

     2. A detail viewer. Click any media and it opens: zoom to the point
        you clicked, drag to pan, wheel/pinch to scale, numbered hotspots
        that name the part you are looking at, a thumbnail strip, and
        keyboard control throughout.

     3. A video player. Give a media descriptor a real `src` and it plays
        that file through a <video>. Give it none and it plays a
        synthetic clip rendered to canvas on a real timeline — play,
        pause, scrub, seek, mute and loop all behave exactly as they will
        once the real footage lands.

   Nothing here knows about themes. Colours come from the design-system
   custom properties, so a catalog changes style by changing data-theme.
   ============================================================ */
(function (global) {
  'use strict';

  /* ── deterministic randomness ─────────────────────────────
     Same seed, same artwork — on every reload, in every variant. */

  function hash(str) {
    var h = 2166136261;
    str = String(str);
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function rng(seed) {
    var a = hash(seed);
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pick(rand, list) {
    return list[Math.floor(rand() * list.length) % list.length];
  }

  function round(n, places) {
    var f = Math.pow(10, places == null ? 2 : places);
    return Math.round(n * f) / f;
  }

  /* ── procedural artwork ───────────────────────────────────
     A product shot is a lit backdrop, a subject, a contact shadow and
     film grain. Each subject is drawn from primitives, so the result
     reads as an object on a surface rather than as an abstract pattern. */

  var PALETTES = {
    warm:    { bg: ['#efe9df', '#e6ddcd'], sub: ['#b08256', '#8d6440', '#c99b6b'], acc: '#a8613a', deep: '#41342a' },
    stone:   { bg: ['#e9e7e2', '#d9d6cf'], sub: ['#8e8d88', '#6f6e6a', '#a8a6a0'], acc: '#5d5c58', deep: '#33322f' },
    ink:     { bg: ['#e8e8ea', '#d4d5d9'], sub: ['#3d4148', '#23262b', '#585d66'], acc: '#1a1c20', deep: '#111316' },
    sage:    { bg: ['#e4e9e1', '#d3dbcf'], sub: ['#7d9070', '#5f7355', '#96a889'], acc: '#4f6347', deep: '#2c382a' },
    clay:    { bg: ['#f0e4dd', '#e4d1c6'], sub: ['#c07a5e', '#a15c42', '#d59b80'], acc: '#8f4b31', deep: '#4a2a1e' },
    indigo:  { bg: ['#e3e6ee', '#cfd5e4'], sub: ['#5a6b95', '#3f4d72', '#7887ac'], acc: '#33406a', deep: '#1c2440' },
    amber:   { bg: ['#f4ead7', '#ecdcbc'], sub: ['#d0a558', '#b98c3f', '#e0bd86'], acc: '#96702c', deep: '#4c3a16' },
    rose:    { bg: ['#f2e5e5', '#e6cfd0'], sub: ['#b87b81', '#9a5f65', '#cf989d'], acc: '#8a4f56', deep: '#472a2d' }
  };

  var PALETTE_NAMES = Object.keys(PALETTES);

  var SUBJECTS = ['bottle', 'chair', 'lamp', 'vase', 'bag', 'watch', 'shoe', 'textile'];

  /* Each subject returns SVG markup drawn inside a 0..1000 square. */
  var draw = {
    bottle: function (r, c) {
      var w = 150 + r() * 70, neck = 46 + r() * 22, shoulder = 300 + r() * 70;
      return (
        '<path d="M' + (500 - neck) + ' 250 L' + (500 - neck) + ' ' + shoulder +
        ' Q' + (500 - w) + ' ' + (shoulder + 70) + ' ' + (500 - w) + ' ' + (shoulder + 160) +
        ' L' + (500 - w) + ' 790 Q' + (500 - w) + ' 840 ' + (500 - w + 50) + ' 840' +
        ' L' + (500 + w - 50) + ' 840 Q' + (500 + w) + ' 840 ' + (500 + w) + ' 790' +
        ' L' + (500 + w) + ' ' + (shoulder + 160) +
        ' Q' + (500 + w) + ' ' + (shoulder + 70) + ' ' + (500 + neck) + ' ' + shoulder +
        ' L' + (500 + neck) + ' 250 Z" fill="url(#body)"/>' +
        '<rect x="' + (500 - neck - 8) + '" y="' + (200 + r() * 30) + '" width="' + (neck * 2 + 16) +
        '" height="58" rx="6" fill="' + c.deep + '" opacity="0.85"/>' +
        '<rect x="' + (500 - w * 0.62) + '" y="' + (shoulder + 230) + '" width="' + w * 1.24 +
        '" height="' + (170 + r() * 60) + '" rx="4" fill="#fff" opacity="0.9"/>' +
        '<rect x="' + (500 - w * 0.4) + '" y="' + (shoulder + 280) + '" width="' + w * 0.8 +
        '" height="10" rx="5" fill="' + c.acc + '" opacity="0.8"/>'
      );
    },
    chair: function (r, c) {
      var seatY = 590 + r() * 40;        /* top of the seat slab */
      var half = 165 + r() * 35;         /* seat half-width */
      var backTop = 250 + r() * 70;
      var backHalf = half * (0.62 + r() * 0.16);
      var legH = 840 - seatY - 54;
      /* Back legs read first, then the backrest, then the seat slab on
         top of both — so the parts stack the way a chair actually does. */
      return (
        '<rect x="' + (500 - half + 26) + '" y="' + (seatY + 40) + '" width="20" height="' + legH +
        '" rx="4" fill="' + c.deep + '" opacity="0.55"/>' +
        '<rect x="' + (500 + half - 46) + '" y="' + (seatY + 40) + '" width="20" height="' + legH +
        '" rx="4" fill="' + c.deep + '" opacity="0.55"/>' +
        '<path d="M' + (500 - backHalf) + ' ' + (seatY + 10) +
        ' L' + (500 - backHalf * 0.86) + ' ' + backTop +
        ' Q500 ' + (backTop - 42) + ' ' + (500 + backHalf * 0.86) + ' ' + backTop +
        ' L' + (500 + backHalf) + ' ' + (seatY + 10) + ' Z" fill="url(#body)"/>' +
        '<rect x="' + (500 - half) + '" y="' + seatY + '" width="' + half * 2 +
        '" height="54" rx="10" fill="url(#body)"/>' +
        '<rect x="' + (500 - half) + '" y="' + (seatY + 44) + '" width="' + half * 2 +
        '" height="10" rx="5" fill="' + c.deep + '" opacity="0.28"/>' +
        '<rect x="' + (500 - half + 18) + '" y="' + (seatY + 54) + '" width="22" height="' + legH +
        '" rx="5" fill="' + c.deep + '"/>' +
        '<rect x="' + (500 + half - 40) + '" y="' + (seatY + 54) + '" width="22" height="' + legH +
        '" rx="5" fill="' + c.deep + '"/>'
      );
    },
    lamp: function (r, c) {
      var shadeW = 180 + r() * 80, shadeY = 250 + r() * 60;
      return (
        '<path d="M' + (500 - shadeW * 0.55) + ' ' + shadeY + ' L' + (500 + shadeW * 0.55) + ' ' + shadeY +
        ' L' + (500 + shadeW) + ' ' + (shadeY + 200) + ' L' + (500 - shadeW) + ' ' + (shadeY + 200) + ' Z" fill="url(#body)"/>' +
        '<ellipse cx="500" cy="' + (shadeY + 200) + '" rx="' + shadeW + '" ry="22" fill="#fff" opacity="0.55"/>' +
        '<rect x="494" y="' + (shadeY + 200) + '" width="12" height="' + (820 - shadeY - 200) + '" fill="' + c.deep + '"/>' +
        '<ellipse cx="500" cy="828" rx="' + (110 + r() * 40) + '" ry="26" fill="' + c.deep + '"/>'
      );
    },
    vase: function (r, c) {
      var belly = 190 + r() * 80, mouth = 90 + r() * 50, top = 240 + r() * 50;
      return (
        '<path d="M' + (500 - mouth) + ' ' + top +
        ' C' + (500 - belly) + ' ' + (top + 200) + ' ' + (500 - belly) + ' ' + (top + 320) + ' ' + (500 - belly * 0.6) + ' 820' +
        ' L' + (500 + belly * 0.6) + ' 820' +
        ' C' + (500 + belly) + ' ' + (top + 320) + ' ' + (500 + belly) + ' ' + (top + 200) + ' ' + (500 + mouth) + ' ' + top + ' Z" fill="url(#body)"/>' +
        '<ellipse cx="500" cy="' + top + '" rx="' + mouth + '" ry="' + (mouth * 0.28) + '" fill="' + c.deep + '" opacity="0.7"/>' +
        '<path d="M' + (500 - belly * 0.5) + ' ' + (top + 300) + ' Q500 ' + (top + 260) + ' ' + (500 + belly * 0.5) + ' ' + (top + 300) +
        '" stroke="' + c.acc + '" stroke-width="' + (6 + r() * 8) + '" fill="none" opacity="0.75"/>'
      );
    },
    bag: function (r, c) {
      var w = 210 + r() * 70, top = 400 + r() * 50, h = 330 + r() * 60;
      return (
        '<path d="M' + (500 - w * 0.62) + ' ' + top + ' Q500 ' + (top - 190 - r() * 60) + ' ' + (500 + w * 0.62) + ' ' + top +
        '" stroke="' + c.deep + '" stroke-width="' + (20 + r() * 12) + '" fill="none"/>' +
        '<rect x="' + (500 - w) + '" y="' + top + '" width="' + w * 2 + '" height="' + h + '" rx="' + (10 + r() * 24) + '" fill="url(#body)"/>' +
        '<rect x="' + (500 - w) + '" y="' + (top + h * 0.42) + '" width="' + w * 2 + '" height="' + (26 + r() * 18) + '" fill="' + c.deep + '" opacity="0.5"/>' +
        '<circle cx="500" cy="' + (top + h * 0.42 + 20) + '" r="' + (16 + r() * 10) + '" fill="' + c.acc + '"/>'
      );
    },
    watch: function (r, c) {
      var rad = 150 + r() * 60;
      return (
        '<rect x="' + (500 - rad * 0.45) + '" y="' + (500 - rad - 210) + '" width="' + rad * 0.9 + '" height="240" rx="26" fill="' + c.deep + '"/>' +
        '<rect x="' + (500 - rad * 0.45) + '" y="' + (500 + rad - 30) + '" width="' + rad * 0.9 + '" height="240" rx="26" fill="' + c.deep + '"/>' +
        '<circle cx="500" cy="500" r="' + rad + '" fill="url(#body)"/>' +
        '<circle cx="500" cy="500" r="' + rad * 0.78 + '" fill="#fff" opacity="0.92"/>' +
        '<line x1="500" y1="500" x2="500" y2="' + (500 - rad * 0.55) + '" stroke="' + c.deep + '" stroke-width="12" stroke-linecap="round"/>' +
        '<line x1="500" y1="500" x2="' + (500 + rad * 0.42) + '" y2="' + (500 + rad * 0.2) + '" stroke="' + c.acc + '" stroke-width="10" stroke-linecap="round"/>' +
        '<circle cx="500" cy="500" r="12" fill="' + c.deep + '"/>'
      );
    },
    shoe: function (r, c) {
      var len = 320 + r() * 90, y = 640 + r() * 40;
      return (
        '<path d="M' + (500 - len) + ' ' + y + ' L' + (500 - len) + ' ' + (y - 150 - r() * 60) +
        ' Q' + (500 - len * 0.2) + ' ' + (y - 120) + ' ' + (500 + len * 0.35) + ' ' + (y - 90) +
        ' Q' + (500 + len) + ' ' + (y - 60) + ' ' + (500 + len) + ' ' + y + ' Z" fill="url(#body)"/>' +
        '<rect x="' + (500 - len) + '" y="' + y + '" width="' + len * 2 + '" height="' + (34 + r() * 20) + '" rx="16" fill="' + c.deep + '"/>' +
        '<path d="M' + (500 - len * 0.55) + ' ' + (y - 130) + ' L' + (500 - len * 0.1) + ' ' + (y - 60) +
        ' M' + (500 - len * 0.3) + ' ' + (y - 150) + ' L' + (500 + len * 0.1) + ' ' + (y - 70) +
        '" stroke="#fff" stroke-width="10" opacity="0.65" stroke-linecap="round"/>'
      );
    },
    textile: function (r, c) {
      var out = '<rect x="180" y="220" width="640" height="620" rx="8" fill="url(#body)"/>';
      var step = 40 + r() * 50;
      for (var y = 240; y < 840; y += step) {
        out += '<path d="M180 ' + y + ' Q500 ' + (y + (r() - 0.5) * 60) + ' 820 ' + y +
          '" stroke="' + (r() > 0.5 ? c.acc : c.deep) + '" stroke-width="' + round(3 + r() * 9) +
          '" fill="none" opacity="' + round(0.25 + r() * 0.5) + '"/>';
      }
      return out;
    }
  };

  /* Subjects are drawn in a fixed 1000-wide space, standing on a baseline
     at y=845 and rising to about y=190. Keeping those constants here lets
     a frame of any shape re-place the same drawing. */
  var SUBJECT_BASE = 845;
  var SUBJECT_RISE = 660;

  /* Build one SVG frame. `t` (0..1) drives the synthetic video: the light
     sweeps and the subject drifts, so successive frames read as footage.
     The frame is composed for the requested aspect rather than cropped to
     it — a wide box gets a small object in a wide room, not a portrait
     shot with its top and bottom sliced off. */
  function svgFrame(seed, opts) {
    opts = opts || {};
    var r = rng(seed);
    var pal = PALETTES[opts.palette] || PALETTES[pick(r, PALETTE_NAMES)];
    var subject = opts.subject || pick(r, SUBJECTS);
    var t = opts.t || 0;
    var spin = opts.spin || 0;
    var w = opts.w || 1000, h = opts.h || 1250;
    var ratio = opts.ratio || (w / h);
    var vh = round(1000 / ratio, 1);
    var id = 'g' + hash(seed + ':' + subject).toString(36);

    /* Stand the subject on a baseline set below centre, scaled to leave
       headroom. Capped at 1 so the default portrait frame is unchanged. */
    var baseline = vh * 0.78;
    var fit = Math.min(1, (vh * 0.60) / SUBJECT_RISE);

    var lightX = 30 + Math.sin(t * Math.PI * 2) * 22;
    var drift = Math.sin(t * Math.PI * 2) * 12 * fit;
    var breathe = 1 + Math.sin(t * Math.PI * 2 + 1) * 0.02;
    /* A 360 spin narrows the subject and shifts its highlight — enough to
       read as rotation without pretending to be a real photogrammetry set. */
    var spinSquash = 0.78 + Math.abs(Math.cos(spin * Math.PI / 180)) * 0.22;
    var spinShade = 0.5 + Math.cos(spin * Math.PI / 180) * 0.5;

    var body = draw[subject] ? draw[subject](r, pal) : draw.vase(r, pal);
    var grain = '';
    var gr = rng(seed + ':grain');
    var grains = Math.round(90 * Math.min(1, vh / 1250));
    for (var i = 0; i < grains; i++) {
      grain += '<circle cx="' + round(gr() * 1000, 1) + '" cy="' + round(gr() * vh, 1) +
        '" r="' + round(0.6 + gr() * 1.6, 2) + '" fill="#000" opacity="' + round(0.02 + gr() * 0.05, 3) + '"/>';
    }

    var sx = round(fit * spinSquash * breathe, 4);
    var sy = round(fit * breathe, 4);

    return (
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 ' + vh + '" width="' + w + '" height="' + h +
      '" preserveAspectRatio="xMidYMid slice" role="img">' +
      '<defs>' +
      '<linearGradient id="bg' + id + '" x1="0" y1="0" x2="0.4" y2="1">' +
      '<stop offset="0" stop-color="' + pal.bg[0] + '"/><stop offset="1" stop-color="' + pal.bg[1] + '"/></linearGradient>' +
      '<radialGradient id="key' + id + '" cx="' + lightX + '%" cy="18%" r="78%">' +
      '<stop offset="0" stop-color="#fff" stop-opacity="' + round(0.55 + t * 0.12, 3) + '"/>' +
      '<stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="body" x1="0" y1="0" x2="1" y2="0.7">' +
      '<stop offset="0" stop-color="' + pal.sub[0] + '" stop-opacity="' + round(0.75 + spinShade * 0.25, 3) + '"/>' +
      '<stop offset="0.55" stop-color="' + pal.sub[1] + '"/>' +
      '<stop offset="1" stop-color="' + pal.sub[2] + '"/></linearGradient>' +
      '<radialGradient id="vig' + id + '" cx="50%" cy="46%" r="72%">' +
      '<stop offset="0.55" stop-color="#000" stop-opacity="0"/>' +
      '<stop offset="1" stop-color="#000" stop-opacity="0.22"/></radialGradient>' +
      '</defs>' +
      '<rect width="1000" height="' + vh + '" fill="url(#bg' + id + ')"/>' +
      '<rect width="1000" height="' + vh + '" fill="url(#key' + id + ')"/>' +
      /* the surface the object sits on */
      '<rect y="' + round(baseline + 30 * fit, 1) + '" width="1000" height="' + vh + '" fill="' + pal.deep + '" opacity="0.07"/>' +
      '<ellipse cx="500" cy="' + round(baseline + 24 * fit + drift * 0.4, 1) + '" rx="' + round(300 * spinSquash * fit, 1) +
      '" ry="' + round(34 * fit, 1) + '" fill="' + pal.deep + '" opacity="0.2"/>' +
      '<g transform="translate(0 ' + round(drift, 2) + ') translate(500 ' + round(baseline, 1) + ') scale(' + sx + ' ' + sy +
      ') translate(-500 -' + SUBJECT_BASE + ')">' +
      body + '</g>' +
      '<rect width="1000" height="' + vh + '" fill="url(#vig' + id + ')"/>' +
      grain +
      '</svg>'
    );
  }

  function svgUrl(seed, opts) {
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgFrame(seed, opts));
  }

  /* ── media descriptors ────────────────────────────────────
     A descriptor is what a variant hands the kit for one piece of media:
       { type: 'photo' | 'video' | 'spin', seed, src?, poster?, label?,
         hotspots: [{ x, y, title, body }], duration? }
     `src` wins whenever present: a real image or a real video file drops
     straight in and every control keeps working. */

  function normalise(media, seedBase) {
    return (media || []).map(function (m, i) {
      var d = Object.assign({ type: 'photo' }, m);
      d.seed = d.seed || seedBase + '-' + i;
      d.hotspots = d.hotspots || [];
      d.duration = d.duration || 12;
      return d;
    });
  }

  function thumbUrl(d) {
    if (d.poster) return d.poster;
    if (d.src && d.type === 'photo') return d.src;
    return svgUrl(d.seed, { w: 200, h: 250, palette: d.palette, subject: d.subject });
  }

  function fullUrl(d, t) {
    if (d.src && d.type === 'photo') return d.src;
    return svgUrl(d.seed, { w: 1000, h: 1250, palette: d.palette, subject: d.subject, t: t || 0 });
  }

  /* The poster a card shows is composed for that card's box, so a wide or
     square slot gets artwork made for it rather than a portrait shot
     cropped by object-fit. */
  function posterUrl(d, ratio) {
    if (d.poster) return d.poster;
    if (d.src && d.type === 'photo') return d.src;
    var h = Math.round(1000 / (ratio || 0.8));
    return svgUrl(d.seed, { w: 1000, h: h, ratio: ratio || 0.8, palette: d.palette, subject: d.subject });
  }

  function boxRatio(node) {
    var r = node.getBoundingClientRect();
    return r.width > 0 && r.height > 0 ? r.width / r.height : 0.8;
  }

  /* ── synthetic video ──────────────────────────────────────
     No footage yet, but the transport must be real: play, pause, scrub,
     seek, loop, mute, and a time readout that tracks the timeline. The
     canvas renders frames of the procedural scene against a wall clock,
     so swapping in <video src> later changes nothing above this layer. */

  function SyntheticClip(canvas, descriptor, ratio) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.d = descriptor;
    this.ratio = ratio || 0.8;
    this.duration = descriptor.duration;
    this.time = 0;
    this.playing = false;
    this.loop = true;
    this.muted = true;
    this._raf = 0;
    this._last = 0;
    this._frames = [];
    this._onTick = null;
    this._buildFrames();
  }

  SyntheticClip.FRAMES = 24;

  SyntheticClip.prototype._buildFrames = function () {
    var n = SyntheticClip.FRAMES;
    var w = 800, h = Math.round(800 / this.ratio);
    for (var i = 0; i < n; i++) {
      var img = new Image();
      img.src = svgUrl(this.d.seed, {
        w: w, h: h, ratio: this.ratio,
        palette: this.d.palette, subject: this.d.subject, t: i / n
      });
      this._frames.push(img);
    }
  };

  SyntheticClip.prototype.render = function () {
    var c = this.canvas, ctx = this.ctx;
    var w = c.clientWidth || 800, h = c.clientHeight || 450;
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    var idx = Math.floor((this.time / this.duration) * SyntheticClip.FRAMES) % SyntheticClip.FRAMES;
    var img = this._frames[idx];
    ctx.fillStyle = '#0d0d0f';
    ctx.fillRect(0, 0, w, h);
    if (img && img.complete && img.naturalWidth) {
      /* cover-fit, then a slow push-in so the frame breathes like footage */
      var zoom = 1.06 + Math.sin((this.time / this.duration) * Math.PI * 2) * 0.05;
      var ir = img.naturalWidth / img.naturalHeight, cr = w / h;
      var dw, dh;
      if (ir > cr) { dh = h * zoom; dw = dh * ir; } else { dw = w * zoom; dh = dw / ir; }
      ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    }
    /* a light sweep, so a paused frame still reads as a moving image */
    var sweep = ctx.createLinearGradient(0, 0, w, h);
    var p = (this.time / this.duration);
    sweep.addColorStop(Math.max(0, p - 0.25), 'rgba(255,255,255,0)');
    sweep.addColorStop(Math.min(1, p), 'rgba(255,255,255,0.07)');
    sweep.addColorStop(Math.min(1, p + 0.25), 'rgba(255,255,255,0)');
    ctx.fillStyle = sweep;
    ctx.fillRect(0, 0, w, h);
  };

  SyntheticClip.prototype._loop = function () {
    var self = this;
    this._raf = global.requestAnimationFrame(function (now) {
      if (!self.playing) return;
      var dt = self._last ? (now - self._last) / 1000 : 0;
      self._last = now;
      self.time += dt;
      if (self.time >= self.duration) {
        if (self.loop) { self.time = self.time % self.duration; }
        else { self.time = self.duration; self.pause(); }
      }
      self.render();
      if (self._onTick) self._onTick(self.time, self.duration);
      if (self.playing) self._loop();
    });
  };

  SyntheticClip.prototype.play = function () {
    if (this.playing) return;
    this.playing = true;
    this._last = 0;
    this._loop();
  };

  SyntheticClip.prototype.pause = function () {
    this.playing = false;
    global.cancelAnimationFrame(this._raf);
    this._last = 0;
    if (this._onTick) this._onTick(this.time, this.duration);
  };

  SyntheticClip.prototype.seek = function (t) {
    this.time = Math.max(0, Math.min(this.duration, t));
    this.render();
    if (this._onTick) this._onTick(this.time, this.duration);
  };

  SyntheticClip.prototype.destroy = function () { this.pause(); this._onTick = null; };

  /* ── helpers ──────────────────────────────────────────────── */

  function el(tag, cls, attrs) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }

  function fmtTime(s, fa) {
    var m = Math.floor(s / 60), sec = Math.floor(s % 60);
    var out = m + ':' + (sec < 10 ? '0' : '') + sec;
    return fa ? toFa(out) : out;
  }

  var FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
  function toFa(str) {
    return String(str).replace(/[0-9]/g, function (d) { return FA_DIGITS[+d]; });
  }

  function reduced() {
    return global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* ── the detail viewer ────────────────────────────────────
     One overlay, reused. Photo mode zooms and pans and shows hotspots;
     video mode gives a full transport; spin mode turns the object under
     the pointer. Arrow keys move between an item's media throughout. */

  var VIEWER_CSS = [
    '.ck-scrim{position:fixed;inset:0;z-index:2000;background:var(--overlay,rgba(12,12,14,.72));',
    'backdrop-filter:blur(3px);animation:ck-fade var(--dur-base,240ms) var(--ease-out,ease) both}',
    '.ck-viewer{position:fixed;inset:0;z-index:2001;display:grid;grid-template-rows:auto 1fr auto;',
    'gap:var(--s-3,12px);padding:clamp(12px,2.4vw,28px);pointer-events:none}',
    '.ck-viewer>*{pointer-events:auto}',
    '.ck-vtop{display:flex;align-items:center;gap:var(--s-4,16px);color:var(--ink,#fff);',
    'background:var(--surface,#fff);border:var(--border-w,1px) solid var(--line,#ddd);',
    'border-radius:var(--radius-card,4px);padding:var(--s-3,12px) var(--s-4,16px)}',
    '.ck-vtitle{font-family:var(--font-fa-display,inherit);font-size:var(--t-md,1.15rem);line-height:1.35}',
    '.ck-vsub{font-family:var(--font-num,monospace);font-size:var(--t-xs,.78rem);color:var(--ink-faint,#888);direction:ltr}',
    '.ck-vstage{position:relative;overflow:hidden;background:var(--surface-alt,#111);',
    'border:var(--border-w,1px) solid var(--line,#333);border-radius:var(--radius-media,2px);display:grid;place-items:center}',
    /* The frame hugs the artwork, so a hotspot placed at 50%/38% lands on
       the same pixel of the object no matter how the stage is shaped.
       Zoom and pan transform the frame, carrying the hotspots along.
       Its pixel size is set by fitFrame() — percentage sizing on a grid
       item resolved against the image's intrinsic size instead of the
       stage, which blew the frame past the viewport. */
    '.ck-frame{position:relative;transform-origin:50% 50%;will-change:transform}',
    '.ck-vstage img{width:100%;height:100%;object-fit:contain;display:block;user-select:none;-webkit-user-drag:none}',
    '.ck-vstage[data-zoom="on"]{cursor:grab}.ck-vstage[data-zoom="on"].ck-drag{cursor:grabbing}',
    '.ck-vstage[data-zoom="off"]{cursor:zoom-in}',
    '.ck-vstage[data-mode="spin"]{cursor:ew-resize}',
    '.ck-vstage canvas{width:100%;height:100%;display:block;object-fit:contain}',
    '.ck-vstage video{width:100%;height:100%;object-fit:contain;background:#000}',
    /* hotspots */
    '.ck-hot{position:absolute;width:30px;height:30px;margin:-15px 0 0 -15px;padding:0;border-radius:999px;',
    'display:grid;place-items:center;font-family:var(--font-num,monospace);font-size:12px;cursor:pointer;',
    'background:var(--accent,#a8613a);color:var(--on-accent,#fff);border:2px solid rgba(255,255,255,.9);',
    'box-shadow:0 2px 10px rgba(0,0,0,.35);transition:transform var(--dur-fast,160ms) var(--ease-out,ease)}',
    '.ck-hot::after{content:"";position:absolute;inset:-8px;border-radius:999px;border:2px solid var(--accent,#a8613a);',
    'opacity:.55;animation:ck-ping 2.4s var(--ease-out,ease) infinite}',
    '.ck-hot:hover,.ck-hot[aria-expanded="true"]{transform:scale(1.18)}',
    '.ck-hot[aria-expanded="true"]::after{animation:none;opacity:1}',
    '.ck-hotcard{position:absolute;z-index:5;width:min(280px,62vw);padding:var(--s-4,16px);',
    'background:var(--surface,#fff);color:var(--ink,#222);border:var(--border-w,1px) solid var(--line-strong,#333);',
    'border-radius:var(--radius-card,4px);box-shadow:var(--shadow-2,0 12px 34px rgba(0,0,0,.25));',
    'animation:ck-pop-sm var(--dur-fast,160ms) var(--ease-out,ease) both}',
    '.ck-hotcard h4{margin:0 0 6px;font-size:var(--t-sm,.9rem)}',
    '.ck-hotcard p{margin:0;font-size:var(--t-xs,.8rem);color:var(--ink-muted,#666);line-height:1.7;max-width:none}',
    /* transport */
    '.ck-vbar{display:flex;flex-wrap:wrap;align-items:center;gap:var(--s-3,12px);',
    'background:var(--surface,#fff);border:var(--border-w,1px) solid var(--line,#ddd);',
    'border-radius:var(--radius-card,4px);padding:var(--s-3,12px) var(--s-4,16px)}',
    /* A timeline reads left-to-right even on an RTL page. */
    '.ck-scrub{flex:1;min-width:160px;height:28px;appearance:none;background:none;cursor:pointer;direction:ltr}',
    '.ck-scrub::-webkit-slider-runnable-track{height:4px;border-radius:999px;',
    'background:linear-gradient(to right,var(--accent,#a8613a) var(--p,0%),var(--line,#ddd) var(--p,0%))}',
    '.ck-scrub::-moz-range-track{height:4px;border-radius:999px;background:var(--line,#ddd)}',
    '.ck-scrub::-moz-range-progress{height:4px;border-radius:999px;background:var(--accent,#a8613a)}',
    '.ck-scrub::-webkit-slider-thumb{appearance:none;width:14px;height:14px;margin-top:-5px;border-radius:999px;',
    'background:var(--accent,#a8613a);border:2px solid var(--surface,#fff);box-shadow:0 1px 4px rgba(0,0,0,.3)}',
    '.ck-scrub::-moz-range-thumb{width:14px;height:14px;border:2px solid var(--surface,#fff);border-radius:999px;background:var(--accent,#a8613a)}',
    '.ck-time{font-family:var(--font-num,monospace);font-size:var(--t-xs,.78rem);color:var(--ink-muted,#666);',
    'direction:ltr;min-width:84px;text-align:center}',
    '.ck-thumbs{display:flex;gap:var(--s-2,8px);overflow-x:auto;padding:2px}',
    '.ck-thumbs button{position:relative;flex:0 0 auto;width:58px;aspect-ratio:4/5;padding:0;overflow:hidden;cursor:pointer;',
    'background:var(--surface-alt,#eee);border:var(--border-w,1px) solid var(--line,#ddd);border-radius:var(--radius-media,2px)}',
    '.ck-thumbs button[aria-current="true"]{border-color:var(--accent,#a8613a);border-width:2px}',
    '.ck-thumbs img{width:100%;height:100%;object-fit:cover}',
    '.ck-tbadge{position:absolute;inset-block-end:2px;inset-inline-end:2px;width:16px;height:16px;border-radius:999px;',
    'background:rgba(0,0,0,.65);color:#fff;font-size:9px;display:grid;place-items:center}',
    /* inline card affordances */
    '.ck-media{position:relative;display:block;width:100%;height:100%;padding:0;border:0;background:none;cursor:pointer;overflow:hidden}',
    '.ck-media>img,.ck-media>canvas{width:100%;height:100%;object-fit:cover;display:block}',
    '.ck-media>canvas{position:absolute;inset:0;opacity:0;transition:opacity var(--dur-base,240ms) var(--ease-out,ease)}',
    '.ck-media.ck-previewing>canvas{opacity:1}',
    '.ck-cue{position:absolute;inset-block-end:8px;inset-inline-start:8px;display:inline-flex;align-items:center;gap:6px;',
    'padding:4px 9px;border-radius:999px;background:rgba(14,14,16,.72);color:#fff;',
    'font-family:var(--font-num,monospace);font-size:11px;letter-spacing:.04em;pointer-events:none;',
    'opacity:.92;transition:opacity var(--dur-fast,160ms) var(--ease-out,ease)}',
    '.ck-cue svg{width:11px;height:11px;fill:currentColor}',
    '.ck-media:hover .ck-cue{opacity:1}',
    '.ck-bigplay{position:absolute;inset:0;margin:auto;width:56px;height:56px;border-radius:999px;',
    'display:grid;place-items:center;background:rgba(14,14,16,.6);color:#fff;pointer-events:none;',
    'transition:transform var(--dur-base,240ms) var(--ease-out,ease),opacity var(--dur-base,240ms) var(--ease-out,ease)}',
    '.ck-media:hover .ck-bigplay{transform:scale(1.08)}',
    '.ck-media.ck-previewing .ck-bigplay{opacity:0}',
    '@keyframes ck-fade{from{opacity:0}to{opacity:1}}',
    '@keyframes ck-pop-sm{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}',
    '@keyframes ck-ping{0%{transform:scale(.85);opacity:.6}70%{transform:scale(1.5);opacity:0}100%{opacity:0}}',
    '@media (prefers-reduced-motion:reduce){.ck-hot::after{animation:none}.ck-scrim,.ck-hotcard{animation-duration:1ms}}'
  ].join('');

  var ICONS = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>',
    zoom: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 2a8 8 0 105.3 14l5.4 5.4 1.4-1.4-5.4-5.4A8 8 0 0010 2zm0 2a6 6 0 110 12 6 6 0 010-12zm-1 2v3H6v2h3v3h2v-3h3V9h-3V6z"/></svg>',
    spin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4V1L8 5l4 4V6a6 6 0 11-6 6H4a8 8 0 108-8z"/></svg>',
    sound: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 5V4L8 9H4z"/></svg>',
    mute: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 5V4L8 9H4zm12.5 3l2.5-2.5-1-1L15.5 11 13 8.5l-1 1L14.5 12 12 14.5l1 1 2.5-2.5 2.5 2.5 1-1z"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.3 5.7l-1.4-1.4L12 9.2 7.1 4.3 5.7 5.7l4.9 4.9-4.9 4.9 1.4 1.4 4.9-4.9 4.9 4.9 1.4-1.4-4.9-4.9z"/></svg>',
    prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.4 7.4L14 6l-6 6 6 6 1.4-1.4-4.6-4.6z"/></svg>',
    next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.6 16.6L10 18l6-6-6-6-1.4 1.4 4.6 4.6z"/></svg>'
  };

  var T = {
    fa: {
      close: 'بستن', prev: 'قبلی', next: 'بعدی', play: 'پخش', pause: 'مکث',
      mute: 'بی‌صدا', unmute: 'صدادار', zoomIn: 'بزرگ‌نمایی', zoomOut: 'بازگشت',
      detail: 'جزئیات', video: 'ویدیو', spin: 'چرخش ۳۶۰', photo: 'عکس',
      hintPhoto: 'کلیک برای بزرگ‌نمایی · کشیدن برای جابه‌جایی',
      hintSpin: 'بکشید تا بچرخد',
      hintVideo: 'Space پخش/مکث · ←→ جابه‌جایی',
      placeholder: 'جانگهدار — عکس واقعی جایگزین می‌شود',
      of: 'از'
    },
    en: {
      close: 'Close', prev: 'Previous', next: 'Next', play: 'Play', pause: 'Pause',
      mute: 'Mute', unmute: 'Unmute', zoomIn: 'Zoom in', zoomOut: 'Reset zoom',
      detail: 'Details', video: 'Video', spin: '360 spin', photo: 'Photo',
      hintPhoto: 'Click to zoom · drag to pan',
      hintSpin: 'Drag to rotate',
      hintVideo: 'Space play/pause · arrows to seek',
      placeholder: 'Placeholder — swap in the real shot',
      of: 'of'
    }
  };

  function Viewer(lang) {
    this.lang = lang || 'fa';
    this.t = T[this.lang] || T.fa;
    this.open = false;
    this.items = [];
    this.index = 0;
    this.zoom = 1;
    this.ox = 0; this.oy = 0;
    this.spin = 0;
    this.clip = null;
    this.video = null;
    this._lastFocus = null;
    this._build();
  }

  Viewer.prototype._build = function () {
    var self = this;
    var t = this.t;

    this.scrim = el('div', 'ck-scrim');
    this.root = el('div', 'ck-viewer', {
      role: 'dialog', 'aria-modal': 'true', tabindex: '-1'
    });

    /* header: title, counter, close */
    this.top = el('div', 'ck-vtop');
    var titles = el('div');
    this.title = el('div', 'ck-vtitle');
    this.sub = el('div', 'ck-vsub');
    titles.appendChild(this.title);
    titles.appendChild(this.sub);
    this.top.appendChild(titles);

    var spacer = el('div');
    spacer.style.flex = '1';
    this.top.appendChild(spacer);

    this.hint = el('div', 'ck-vsub');
    this.top.appendChild(this.hint);

    this.closeBtn = this._iconBtn(ICONS.close, t.close, function () { self.close(); });
    this.top.appendChild(this.closeBtn);

    /* stage */
    this.stage = el('div', 'ck-vstage', { 'data-zoom': 'off', 'data-mode': 'photo' });

    /* footer: transport / thumbs */
    this.bar = el('div', 'ck-vbar');
    this.prevBtn = this._iconBtn(ICONS.prev, t.prev, function () { self.step(-1); });
    this.nextBtn = this._iconBtn(ICONS.next, t.next, function () { self.step(1); });
    this.playBtn = this._iconBtn(ICONS.play, t.play, function () { self.togglePlay(); });
    this.muteBtn = this._iconBtn(ICONS.mute, t.unmute, function () { self.toggleMute(); });
    this.scrub = el('input', 'ck-scrub', { type: 'range', min: '0', max: '1000', value: '0', 'aria-label': 'timeline' });
    this.timeEl = el('div', 'ck-time');
    this.thumbs = el('div', 'ck-thumbs');

    this.scrub.addEventListener('input', function () {
      var frac = +self.scrub.value / 1000;
      if (self.video) self.video.currentTime = frac * (self.video.duration || 0);
      else if (self.clip) self.clip.seek(frac * self.clip.duration);
    });

    this.root.appendChild(this.top);
    this.root.appendChild(this.stage);
    this.root.appendChild(this.bar);

    this.scrim.addEventListener('click', function () { self.close(); });

    /* zoom + pan + spin on the stage */
    this.stage.addEventListener('click', function (e) {
      if (self.stage.dataset.mode !== 'photo') return;
      if (e.target.closest('.ck-hot') || e.target.closest('.ck-hotcard')) return;
      if (self._moved) { self._moved = false; return; }
      if (self.zoom > 1) { self.setZoom(1, 0, 0); return; }
      var r = self.stage.getBoundingClientRect();
      /* zoom toward the point clicked, not the centre */
      var px = (e.clientX - r.left) / r.width - 0.5;
      var py = (e.clientY - r.top) / r.height - 0.5;
      self.setZoom(2.4, -px * r.width * 1.4, -py * r.height * 1.4);
    });

    this.stage.addEventListener('wheel', function (e) {
      if (self.stage.dataset.mode !== 'photo') return;
      e.preventDefault();
      self.setZoom(Math.max(1, Math.min(5, self.zoom * (e.deltaY < 0 ? 1.12 : 0.89))), self.ox, self.oy);
    }, { passive: false });

    var dragging = false, sx = 0, sy = 0, bx = 0, by = 0, spinStart = 0;
    this.stage.addEventListener('pointerdown', function (e) {
      var mode = self.stage.dataset.mode;
      if (mode === 'video') return;
      if (mode === 'photo' && self.zoom <= 1) return;
      dragging = true; self._moved = false;
      sx = e.clientX; sy = e.clientY; bx = self.ox; by = self.oy; spinStart = self.spin;
      self.stage.classList.add('ck-drag');
      self.stage.setPointerCapture(e.pointerId);
    });
    this.stage.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) + Math.abs(dy) > 4) self._moved = true;
      if (self.stage.dataset.mode === 'spin') {
        self.spin = (spinStart + dx * 0.9) % 360;
        self._renderSpin();
      } else {
        self.ox = bx + dx; self.oy = by + dy;
        self._applyTransform(false);
      }
    });
    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      self.stage.classList.remove('ck-drag');
      try { self.stage.releasePointerCapture(e.pointerId); } catch (err) { /* already released */ }
    }
    this.stage.addEventListener('pointerup', endDrag);
    this.stage.addEventListener('pointercancel', endDrag);

    this._onKey = function (e) {
      if (!self.open) return;
      if (e.key === 'Escape') { e.preventDefault(); self.close(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); self._arrow(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); self._arrow(-1); }
      else if (e.key === ' ' && self.stage.dataset.mode === 'video') { e.preventDefault(); self.togglePlay(); }
      else if (e.key === '+' || e.key === '=') { e.preventDefault(); self.setZoom(Math.min(5, self.zoom * 1.3), self.ox, self.oy); }
      else if (e.key === '-') { e.preventDefault(); self.setZoom(Math.max(1, self.zoom / 1.3), 0, 0); }
      else if (e.key === 'Tab') { self._trap(e); }
    };
  };

  Viewer.prototype._arrow = function (dir) {
    /* In video mode the arrows seek; elsewhere they move between media.
       RTL flips the direction so "next" always means forward visually. */
    if (this.stage.dataset.mode === 'video') {
      var d = dir * 5;
      if (this.video) this.video.currentTime = Math.max(0, Math.min(this.video.duration || 0, this.video.currentTime + d));
      else if (this.clip) this.clip.seek(this.clip.time + d);
      return;
    }
    var rtl = document.documentElement.dir === 'rtl' || document.body.dir === 'rtl';
    this.step(rtl ? -dir : dir);
  };

  Viewer.prototype._iconBtn = function (svg, label, fn) {
    var b = el('button', 'cat-btn cat-btn--ghost cat-btn--icon', { type: 'button', 'aria-label': label, title: label });
    b.innerHTML = svg;
    b.querySelector('svg').style.width = '18px';
    b.querySelector('svg').style.height = '18px';
    b.querySelector('svg').style.fill = 'currentColor';
    b.addEventListener('click', fn);
    return b;
  };

  Viewer.prototype._trap = function (e) {
    var f = this.root.querySelectorAll('button,input,[tabindex]:not([tabindex="-1"])');
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  Viewer.prototype.show = function (items, index, meta) {
    this.items = items;
    this.index = index || 0;
    this.meta = meta || {};
    if (!this.open) {
      this._lastFocus = document.activeElement;
      document.body.appendChild(this.scrim);
      document.body.appendChild(this.root);
      document.addEventListener('keydown', this._onKey);
      if (!this._onResize) {
        var self = this;
        this._onResize = function () { self.fitFrame(); };
      }
      global.addEventListener('resize', this._onResize);
      this._prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      this.open = true;
    }
    this.root.setAttribute('aria-label', this.meta.title || this.t.detail);
    this.render();
    this.root.focus();
  };

  Viewer.prototype.close = function () {
    if (!this.open) return;
    this._teardownMedia();
    document.removeEventListener('keydown', this._onKey);
    if (this._onResize) global.removeEventListener('resize', this._onResize);
    document.body.style.overflow = this._prevOverflow || '';
    if (this.scrim.parentNode) this.scrim.parentNode.removeChild(this.scrim);
    if (this.root.parentNode) this.root.parentNode.removeChild(this.root);
    this.open = false;
    if (this._lastFocus && this._lastFocus.focus) this._lastFocus.focus();
  };

  Viewer.prototype.step = function (dir) {
    if (!this.items.length) return;
    this.index = (this.index + dir + this.items.length) % this.items.length;
    this.render();
  };

  Viewer.prototype._teardownMedia = function () {
    if (this.clip) { this.clip.destroy(); this.clip = null; }
    if (this.video) { this.video.pause(); this.video = null; }
  };

  Viewer.prototype.setZoom = function (z, ox, oy) {
    /* An open hotspot card would scale with the frame and stop being
       readable, so zooming dismisses it. */
    if (z !== this.zoom) this._closeHot();
    this.zoom = z;
    this.ox = z <= 1 ? 0 : ox;
    this.oy = z <= 1 ? 0 : oy;
    this.stage.dataset.zoom = z > 1 ? 'on' : 'off';
    this._applyTransform(true);
  };

  /* Size the frame to the largest box of the media's ratio that fits the
     stage. Explicit pixels, so the result does not depend on how the
     stage happens to be laid out. */
  Viewer.prototype.fitFrame = function () {
    if (!this.frame) return;
    var sw = this.stage.clientWidth, sh = this.stage.clientHeight;
    if (!sw || !sh) return;
    var ar = this._ratio || 0.8;
    var w = sw, h = sw / ar;
    if (h > sh) { h = sh; w = sh * ar; }
    this.frame.style.width = Math.round(w) + 'px';
    this.frame.style.height = Math.round(h) + 'px';
  };

  Viewer.prototype._applyTransform = function (animate) {
    if (!this.frame) return;
    this.frame.style.transition = animate && !reduced()
      ? 'transform var(--dur-base,240ms) var(--ease-out,ease)' : 'none';
    this.frame.style.transform = 'translate(' + this.ox + 'px,' + this.oy + 'px) scale(' + this.zoom + ')';
  };

  Viewer.prototype._renderSpin = function () {
    if (!this.img) return;
    var d = this.items[this.index];
    this.img.src = svgUrl(d.seed, { w: 1000, h: 1250, palette: d.palette, subject: d.subject, spin: this.spin });
    if (this.spinRead) this.spinRead.textContent = (this.lang === 'fa' ? toFa(Math.round((this.spin + 360) % 360)) : Math.round((this.spin + 360) % 360)) + '°';
  };

  Viewer.prototype.render = function () {
    var self = this, t = this.t;
    var d = this.items[this.index];
    if (!d) return;

    this._teardownMedia();
    this.stage.innerHTML = '';
    this.bar.innerHTML = '';
    this.zoom = 1; this.ox = 0; this.oy = 0; this.spin = 0;
    this.stage.dataset.zoom = 'off';
    this.stage.dataset.mode = d.type;
    this.img = null; this.frame = null; this.hotLayer = null; this.spinRead = null;
    this._ratio = null;

    this.title.textContent = this.meta.title || d.label || '';
    var kindLabel = t[d.type] || d.type;
    this.sub.textContent = (this.meta.sku ? this.meta.sku + ' · ' : '') + kindLabel +
      ' ' + (this.lang === 'fa' ? toFa(this.index + 1) : this.index + 1) + ' ' + t.of + ' ' +
      (this.lang === 'fa' ? toFa(this.items.length) : this.items.length);
    this.hint.textContent = d.type === 'video' ? t.hintVideo : d.type === 'spin' ? t.hintSpin : t.hintPhoto;

    if (d.type === 'video') this._renderVideo(d);
    else this._renderImage(d);

    /* footer */
    this.bar.appendChild(this.prevBtn);
    this.bar.appendChild(this.nextBtn);
    if (d.type === 'video') {
      this.bar.appendChild(this.playBtn);
      this.bar.appendChild(this.scrub);
      this.bar.appendChild(this.timeEl);
      this.bar.appendChild(this.muteBtn);
    } else if (d.type === 'spin') {
      var read = el('div', 'ck-time');
      this.spinRead = read;
      read.textContent = this.lang === 'fa' ? toFa('0') + '°' : '0°';
      this.bar.appendChild(read);
      var note = el('div', 'ck-vsub');
      note.textContent = t.hintSpin;
      this.bar.appendChild(note);
    }
    var flex = el('div'); flex.style.flex = '1';
    this.bar.appendChild(flex);

    /* thumbnail strip — only worth showing for more than one piece */
    if (this.items.length > 1) {
      this.thumbs.innerHTML = '';
      this.items.forEach(function (m, i) {
        var b = el('button', '', { type: 'button', 'aria-current': String(i === self.index), 'aria-label': (T[self.lang][m.type] || m.type) + ' ' + (i + 1) });
        var im = el('img', '', { src: thumbUrl(m), alt: '' });
        b.appendChild(im);
        if (m.type !== 'photo') {
          var badge = el('span', 'ck-tbadge');
          badge.innerHTML = m.type === 'video' ? ICONS.play : ICONS.spin;
          badge.querySelector('svg').style.width = '9px';
          badge.querySelector('svg').style.height = '9px';
          badge.querySelector('svg').style.fill = 'currentColor';
          b.appendChild(badge);
        }
        b.addEventListener('click', function () { self.index = i; self.render(); });
        self.thumbs.appendChild(b);
      });
      this.bar.appendChild(this.thumbs);
    }
  };

  Viewer.prototype._renderImage = function (d) {
    var self = this;
    var frame = el('div', 'ck-frame');
    this.frame = frame;

    this.img = el('img', '', { alt: d.label || this.meta.title || '', draggable: 'false' });
    this.img.addEventListener('load', function () {
      /* A real photograph may be any shape; take the ratio from the file
         itself so the hotspot coordinates stay true. */
      if (self.img.naturalWidth && self.img.naturalHeight) {
        self._ratio = self.img.naturalWidth / self.img.naturalHeight;
        self.fitFrame();
      }
    });
    this.img.src = d.type === 'spin'
      ? svgUrl(d.seed, { w: 1000, h: 1250, palette: d.palette, subject: d.subject, spin: 0 })
      : fullUrl(d);
    frame.appendChild(this.img);

    /* Hotspots live inside the frame, so they are pinned to the artwork
       and inherit its zoom and pan for free. */
    if (d.hotspots.length && d.type === 'photo') {
      this.hotLayer = frame;
      d.hotspots.forEach(function (h, i) {
        var dot = el('button', 'ck-hot', {
          type: 'button', 'aria-expanded': 'false',
          'aria-label': h.title, title: h.title
        });
        dot.style.position = 'absolute';
        dot.style.left = h.x + '%';
        dot.style.top = h.y + '%';
        dot.textContent = self.lang === 'fa' ? toFa(i + 1) : String(i + 1);
        dot.addEventListener('click', function (e) {
          e.stopPropagation();
          self._toggleHot(dot, h);
        });
        frame.appendChild(dot);
      });
    }

    this.stage.appendChild(frame);
    this._ratio = this._ratio || 0.8;
    this.fitFrame();

    if (!d.src) {
      var ph = el('div', 'ck-cue');
      ph.textContent = this.t.placeholder;
      ph.style.insetBlockEnd = '10px';
      this.stage.appendChild(ph);
    }

    if (d.type === 'spin') this._renderSpin();
  };

  Viewer.prototype._closeHot = function () {
    var existing = this.stage.querySelector('.ck-hotcard');
    if (existing) existing.parentNode.removeChild(existing);
    Array.prototype.forEach.call(this.stage.querySelectorAll('.ck-hot'), function (d2) {
      d2.setAttribute('aria-expanded', 'false');
    });
  };

  Viewer.prototype._toggleHot = function (dot, h) {
    var open = dot.getAttribute('aria-expanded') === 'true';
    this._closeHot();
    if (open) return;
    dot.setAttribute('aria-expanded', 'true');
    var card = el('div', 'ck-hotcard');
    card.innerHTML = '<h4></h4><p></p>';
    card.querySelector('h4').textContent = h.title;
    card.querySelector('p').textContent = h.body || '';
    card.style.left = 'calc(' + h.x + '% + 24px)';
    card.style.top = 'calc(' + h.y + '% + 10px)';
    card.style.pointerEvents = 'auto';
    if (h.x > 62) { card.style.left = 'auto'; card.style.right = 'calc(' + (100 - h.x) + '% + 24px)'; }
    if (h.y > 68) { card.style.top = 'auto'; card.style.bottom = 'calc(' + (100 - h.y) + '% + 10px)'; }
    this.hotLayer.appendChild(card);
  };

  Viewer.prototype._renderVideo = function (d) {
    var self = this;
    /* Same frame as a photo, so the clip is letterboxed rather than
       cropped when the stage is wider than the footage. */
    var frame = el('div', 'ck-frame');
    this.frame = frame;
    this.stage.appendChild(frame);

    if (d.src) {
      /* A real file: the browser's own pipeline, our chrome on top. */
      var v = el('video', '', { playsinline: '', preload: 'metadata' });
      v.src = d.src;
      if (d.poster) v.poster = d.poster;
      v.muted = true;
      v.loop = true;
      this.video = v;
      v.addEventListener('timeupdate', function () { self._tick(v.currentTime, v.duration || 0); });
      v.addEventListener('loadedmetadata', function () {
        if (v.videoWidth && v.videoHeight) { self._ratio = v.videoWidth / v.videoHeight; self.fitFrame(); }
        self._tick(0, v.duration || 0);
      });
      v.addEventListener('play', function () { self._setPlayIcon(true); });
      v.addEventListener('pause', function () { self._setPlayIcon(false); });
      frame.appendChild(v);
      this._ratio = 16 / 9;
      this.fitFrame();
      v.play().catch(function () { /* autoplay refused — the button still works */ });
    } else {
      var c = el('canvas');
      frame.appendChild(c);
      this._ratio = 0.8;
      this.fitFrame();
      var clip = new SyntheticClip(c, d);
      this.clip = clip;
      clip._onTick = function (time, dur) { self._tick(time, dur); };
      clip.render();
      /* Give the first frames a moment to decode, then roll. */
      setTimeout(function () { if (self.clip === clip) { clip.play(); self._setPlayIcon(true); } }, 120);
      var cue = el('div', 'ck-cue');
      cue.textContent = this.t.placeholder;
      this.stage.appendChild(cue);
    }
  };

  Viewer.prototype._tick = function (time, dur) {
    var frac = dur ? time / dur : 0;
    this.scrub.value = String(Math.round(frac * 1000));
    this.scrub.style.setProperty('--p', (frac * 100) + '%');
    this.timeEl.textContent = fmtTime(time, this.lang === 'fa') + ' / ' + fmtTime(dur, this.lang === 'fa');
  };

  Viewer.prototype._setPlayIcon = function (playing) {
    this.playBtn.innerHTML = playing ? ICONS.pause : ICONS.play;
    var s = this.playBtn.querySelector('svg');
    s.style.width = '18px'; s.style.height = '18px'; s.style.fill = 'currentColor';
    this.playBtn.setAttribute('aria-label', playing ? this.t.pause : this.t.play);
  };

  Viewer.prototype.togglePlay = function () {
    if (this.video) {
      if (this.video.paused) this.video.play(); else this.video.pause();
    } else if (this.clip) {
      if (this.clip.playing) { this.clip.pause(); this._setPlayIcon(false); }
      else { this.clip.play(); this._setPlayIcon(true); }
    }
  };

  Viewer.prototype.toggleMute = function () {
    var muted;
    if (this.video) { this.video.muted = !this.video.muted; muted = this.video.muted; }
    else if (this.clip) { this.clip.muted = !this.clip.muted; muted = this.clip.muted; }
    else return;
    this.muteBtn.innerHTML = muted ? ICONS.mute : ICONS.sound;
    var s = this.muteBtn.querySelector('svg');
    s.style.width = '18px'; s.style.height = '18px'; s.style.fill = 'currentColor';
    this.muteBtn.setAttribute('aria-label', muted ? this.t.unmute : this.t.mute);
  };

  /* ── inline media on a card ───────────────────────────────
     Renders the poster, marks what the media is, and — for video —
     runs a muted micro-preview on hover or focus so the motion is
     visible without opening anything. */

  function mountMedia(host, descriptors, meta, viewer, lang) {
    var t = T[lang] || T.fa;
    var d = descriptors[0];
    host.classList.add('ck-media');
    host.innerHTML = '';
    if (host.tagName !== 'BUTTON') {
      host.setAttribute('role', 'button');
      host.setAttribute('tabindex', '0');
    }
    host.setAttribute('aria-label', (meta.title || '') + ' — ' + t.detail);

    var ratio = boxRatio(host);
    var src = posterUrl(d, ratio);
    var img = el('img', '', { src: src, alt: meta.title || '' });
    /* Deferring a data URI buys nothing — there is no request to save — and
       it leaves artwork far down a long page unpainted in a static capture
       or a print. Only a real file is worth deferring. */
    if (src.slice(0, 5) !== 'data:') img.loading = 'lazy';
    host.appendChild(img);

    var cue = el('span', 'ck-cue');
    if (d.type === 'video') cue.innerHTML = ICONS.play + '<span>' + t.video + '</span>';
    else if (d.type === 'spin') cue.innerHTML = ICONS.spin + '<span>' + t.spin + '</span>';
    else cue.innerHTML = ICONS.zoom + '<span>' + t.detail + '</span>';
    host.appendChild(cue);

    if (d.type === 'video') {
      var big = el('span', 'ck-bigplay');
      big.innerHTML = ICONS.play;
      big.querySelector('svg').style.width = '22px';
      big.querySelector('svg').style.height = '22px';
      big.querySelector('svg').style.fill = 'currentColor';
      host.appendChild(big);

      /* The hover preview is built lazily — a grid of forty cards should
         not allocate forty canvases before anyone points at one. */
      var preview = null;
      var start = function () {
        if (reduced()) return;
        if (!preview) {
          var c = el('canvas');
          host.appendChild(c);
          preview = new SyntheticClip(c, d, boxRatio(host));
          preview.duration = d.duration;
        }
        host.classList.add('ck-previewing');
        preview.play();
      };
      var stop = function () {
        host.classList.remove('ck-previewing');
        if (preview) preview.pause();
      };
      host.addEventListener('pointerenter', start);
      host.addEventListener('pointerleave', stop);
      host.addEventListener('focus', start);
      host.addEventListener('blur', stop);
    }

    function open() { viewer.show(descriptors, 0, meta); }
    host.addEventListener('click', open);
    host.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    });
  }

  /* ── public surface ───────────────────────────────────── */

  var injected = false;
  function injectCss() {
    if (injected) return;
    injected = true;
    var s = document.createElement('style');
    s.id = 'ck-style';
    s.textContent = VIEWER_CSS;
    /* First in the head, not last: these are defaults a page is meant to
       override. Appended, they would win every specificity tie against the
       page's own rules — .ck-media's height beat a host's aspect-ratio and
       squashed the artwork to a sliver. */
    document.head.insertBefore(s, document.head.firstChild);
  }

  var CatalogKit = {
    /* Artwork for a seed. `opts.t` animates it, `opts.spin` rotates it. */
    image: svgUrl,
    imageMarkup: svgFrame,
    palettes: PALETTE_NAMES,
    subjects: SUBJECTS,
    toFa: toFa,
    rng: rng,
    hash: hash,
    normalise: normalise,
    thumb: thumbUrl,
    SyntheticClip: SyntheticClip,

    /* One viewer per page, created on demand. */
    viewer: function (lang) {
      injectCss();
      if (!this._viewer || this._viewer.lang !== (lang || 'fa')) {
        if (this._viewer) this._viewer.close();
        this._viewer = new Viewer(lang);
      }
      return this._viewer;
    },

    /* Wire one element as a piece of a product's media. */
    mountMedia: function (host, media, meta, lang) {
      injectCss();
      var descriptors = normalise(media, (meta && meta.sku) || 'm');
      mountMedia(host, descriptors, meta || {}, this.viewer(lang), lang || 'fa');
      return descriptors;
    },

    /* Open the viewer directly — for "view details" buttons. */
    open: function (media, meta, lang, index) {
      injectCss();
      this.viewer(lang).show(normalise(media, (meta && meta.sku) || 'm'), index || 0, meta || {});
    },

    /* Give a product a sensible media set when a variant has no opinion:
       one photo with hotspots, one clip, one spin. */
    defaultMedia: function (seed, hotspots, opts) {
      opts = opts || {};
      return [
        { type: 'photo', seed: seed + '-a', hotspots: hotspots || [], palette: opts.palette, subject: opts.subject },
        { type: 'video', seed: seed + '-a', duration: opts.duration || 12, palette: opts.palette, subject: opts.subject },
        { type: 'spin', seed: seed + '-a', palette: opts.palette, subject: opts.subject },
        { type: 'photo', seed: seed + '-b', hotspots: [], palette: opts.palette, subject: opts.subject }
      ];
    }
  };

  global.CatalogKit = CatalogKit;
})(window);
