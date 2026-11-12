/* =========================================================
   AXE — WILD SPICE

   Le film est une section 100svh épinglée : la séquence d'images
   défile pendant que la page reste en place. Quand la timeline est
   finie, l'épinglage se libère et la page reprend son cours normal
   avec les sections suivantes.
   ========================================================= */
(function () {
  'use strict';

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MOBILE = window.matchMedia('(max-width: 767px)').matches;

  /* -------------------------------------------------------
     0. Le film — source unique des timings
     Chaque étape amène la séquence jusqu'à `frame` en `units`
     de défilement (100 units ≈ un écran).
     Une étape avec `hold` = plan posé : le chapitre correspondant
     est affiché pendant cette étape.
     Les numéros de `frame` sont ceux du jeu desktop (262 images) ;
     ils sont remis à l'échelle automatiquement sur mobile.
  ------------------------------------------------------- */
  var FILM = {
    dir: MOBILE ? 'frames-sm' : 'frames',
    frames: MOBILE ? 131 : 262,
    refFrames: 262
  };

  var TIMELINE = [
    { frame: 0,   units: 120, hold: 'arrivee'   }, // lévitation, volutes de lumière
    { frame: 52,  units: 80  },                    // descente vers la pierre
    { frame: 95,  units: 140, hold: 'tenue'     }, // posé sur la pierre, éclaboussure
    { frame: 128, units: 70  },                    // les matières entrent dans le champ
    { frame: 162, units: 140, hold: 'signature' }, // cèdre, orange, cardamome
    { frame: 186, units: 70  },                    // raccord sur la macro
    { frame: 212, units: 140, hold: 'geste'     }, // capot, diffusion
    { frame: 236, units: 60  },                    // recul
    { frame: 261, units: 150, hold: 'final'     }  // plan large
  ];

  var FADE_UNITS = 14;   // apparition / disparition d'un texte, en units
  var MOBILE_SCALE = 0.8; // film un peu plus court sur téléphone
  var EAGER = 60;         // images chargées en priorité
  var BATCH = 8;          // puis par paquets

  gsap.registerPlugin(ScrollTrigger);

  /* -------------------------------------------------------
     1. Scroll lissé
  ------------------------------------------------------- */
  var lenis = null;
  if (!REDUCED) {
    lenis = new Lenis({ duration: 1.1, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    // L'épinglage allonge la page : Lenis doit recalculer sa limite.
    ScrollTrigger.addEventListener('refresh', function () { lenis.resize(); });
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  function scrollToEl(el) {
    if (lenis) lenis.scrollTo(el, { offset: -70 });
    else el.scrollIntoView();
  }

  /* -------------------------------------------------------
     2. Film
  ------------------------------------------------------- */
  var section = document.getElementById('film');
  var canvas = document.getElementById('canvas');
  var fill = document.getElementById('filmFill');

  function pad(n) { return String(n).padStart(4, '0'); }

  // Les frames de la TIMELINE sont exprimées dans le référentiel desktop.
  function scaleFrame(f) {
    if (FILM.frames === FILM.refFrames) return f;
    return Math.round(f * (FILM.frames - 1) / (FILM.refFrames - 1));
  }

  function initFilm() {
    var ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    var imgs = new Array(FILM.frames).fill(null);
    var ready = new Uint8Array(FILM.frames);
    var state = { frame: scaleFrame(TIMELINE[0].frame) };
    var shown = -1;
    var started = false;

    // Image chargée la plus proche de celle demandée : le film reste
    // regardable pendant le chargement, sans écran noir.
    function nearest(f) {
      if (ready[f]) return f;
      for (var d = 1; d < FILM.frames; d++) {
        if (f - d >= 0 && ready[f - d]) return f - d;
        if (f + d < FILM.frames && ready[f + d]) return f + d;
      }
      return -1;
    }

    function render(force) {
      var f = Math.min(FILM.frames - 1, Math.max(0, Math.round(state.frame)));
      var idx = nearest(f);
      if (idx < 0 || (!force && idx === shown)) return;
      shown = idx;
      var im = imgs[idx];
      var cw = canvas.width, ch = canvas.height;
      var s = Math.max(cw / im.naturalWidth, ch / im.naturalHeight);
      var w = im.naturalWidth * s, h = im.naturalHeight * s;
      ctx.drawImage(im, (cw - w) / 2, (ch - h) / 2, w, h);
    }

    function load(i) {
      return new Promise(function (resolve) {
        var im = new Image();
        im.decoding = 'async';
        im.onload = function () {
          imgs[i] = im; ready[i] = 1;
          if (shown < 0 ||
              Math.abs(Math.round(state.frame) - i) < Math.abs(Math.round(state.frame) - shown)) {
            render(true);
          }
          resolve();
        };
        im.onerror = function () { resolve(); };
        im.src = FILM.dir + '/frame_' + pad(i + 1) + '.webp';
      });
    }

    // Les premières images d'abord, le reste par paquets.
    function startLoading() {
      if (started) return;
      started = true;
      var first = Math.min(EAGER, FILM.frames);
      var jobs = [];
      for (var i = 0; i < first; i++) jobs.push(load(i));

      Promise.all(jobs).then(function next(i) {
        i = typeof i === 'number' ? i : first;
        if (i >= FILM.frames) return;
        var b = [];
        for (var k = i; k < Math.min(i + BATCH, FILM.frames); k++) b.push(load(k));
        return Promise.all(b).then(function () { return next(i + BATCH); });
      });
    }

    function startWhenIdle() {
      if (document.readyState === 'complete') setTimeout(startLoading, 300);
      else window.addEventListener('load', function () { setTimeout(startLoading, 300); }, { once: true });
    }

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      render(true);
    }
    resize();
    window.addEventListener('resize', resize);

    var k = MOBILE ? MOBILE_SCALE : 1;
    var totalUnits = TIMELINE.reduce(function (a, s) { return a + s.units; }, 0) * k;

    // Premier chapitre déjà en place au début du film
    var firstHold = TIMELINE[0].hold;
    var firstEl = section.querySelector('[data-chapter="' + firstHold + '"]');
    if (firstEl) gsap.set(firstEl.querySelector('.head'), { autoAlpha: 1 });

    // Une seule timeline épinglée : images + textes + index + barre
    var tl = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: '+=' + totalUnits + '%',
        pin: true,
        scrub: 1,
        anticipatePin: 1
      }
    });

    var fade = FADE_UNITS * k;
    var t = 0;

    TIMELINE.forEach(function (step, i) {
      var dur = step.units * k;
      var last = i === TIMELINE.length - 1;

      tl.to(state, {
        frame: scaleFrame(step.frame),
        duration: dur, ease: 'none',
        onUpdate: function () { render(false); }
      }, t);

      if (step.hold) {
        var el = section.querySelector('[data-chapter="' + step.hold + '"]');
        var head = el && el.querySelector('.head');
        var body = el && el.querySelector('.body');

        if (head && body) {
          // Titre à l'arrêt du plan, puis le corps de texte.
          if (t > 0) {
            tl.fromTo(head, { autoAlpha: 0, y: 24 },
                            { autoAlpha: 1, y: 0, duration: fade, ease: 'power1.out' }, t);
          }
          tl.fromTo(body, { autoAlpha: 0, y: 16 },
                          { autoAlpha: 1, y: 0, duration: fade, ease: 'power1.out' }, t + dur * 0.25);
          if (!last) {
            tl.to([head, body], { autoAlpha: 0, y: -16, duration: fade, ease: 'power1.in' }, t + dur - fade);
          }
        }
      }

      t += dur;
    });

    if (fill) tl.fromTo(fill, { scaleX: 0 }, { scaleX: 1, ease: 'none', duration: t }, 0);

    // Charger quand le film approche, mais après l'affichage de la page.
    ScrollTrigger.create({ trigger: section, start: 'top bottom+=100%', onEnter: startWhenIdle, onEnterBack: startWhenIdle });
    ScrollTrigger.create({ trigger: section, start: 'top bottom', onEnter: startLoading, onEnterBack: startLoading });
    if (section.getBoundingClientRect().top < window.innerHeight * 2) startWhenIdle();

    ScrollTrigger.refresh();
  }

  /* -------------------------------------------------------
     3. Mouvement réduit : le film devient une suite d'images
  ------------------------------------------------------- */
  function initFilmStatic() {
    canvas.remove();
    section.querySelectorAll('.chapter').forEach(function (ch, i) {
      var step = TIMELINE.filter(function (s) { return s.hold; })[i];
      if (!step) return;
      var img = document.createElement('img');
      img.src = FILM.dir + '/frame_' + pad(scaleFrame(step.frame) + 1) + '.webp';
      img.alt = '';
      img.className = 'film__still';
      img.loading = 'lazy';
      section.insertBefore(img, ch);
    });
  }

  if (REDUCED) initFilmStatic(); else initFilm();

  /* -------------------------------------------------------
     4. Apparitions des sections qui suivent le film
  ------------------------------------------------------- */
  if (!REDUCED) {
    gsap.set('[data-reveal]', { autoAlpha: 0, y: 28 });
    ScrollTrigger.batch('[data-reveal]', {
      start: 'top 88%',
      once: true,
      onEnter: function (els) {
        gsap.to(els, { autoAlpha: 1, y: 0, duration: .8, ease: 'power2.out', stagger: .08, overwrite: true });
      }
    });
  }

  /* -------------------------------------------------------
     4 bis. Titres en mots + filets qui se tracent
     Le titre est découpé en mots, chacun masqué par son bloc et
     remontant de 110 % avec 60 ms d'écart. Le filet se trace en
     continu pendant que la section traverse l'écran.
  ------------------------------------------------------- */
  var seg = function (p, from, to) {
    return Math.min(1, Math.max(0, (p - from) / (to - from)));
  };
  var smoothstep = function (t) { return t * t * (3 - 2 * t); };

  document.querySelectorAll('[data-words]').forEach(function (el) {
    var words = el.textContent.trim().split(/\s+/);
    el.textContent = '';
    words.forEach(function (w, i) {
      var outer = document.createElement('span');
      outer.className = 'word';
      var inner = document.createElement('span');
      inner.style.setProperty('--i', i);
      inner.textContent = w;
      outer.appendChild(inner);
      el.appendChild(outer);
      if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
    });

    if (REDUCED) { el.classList.add('is-in'); return; }

    ScrollTrigger.create({
      trigger: el, start: 'top 88%', once: true,
      onEnter: function () { el.classList.add('is-in'); }
    });
  });

  document.querySelectorAll('.steps__line').forEach(function (line) {
    var host = line.closest('section') || line.parentNode;
    if (REDUCED) { line.style.setProperty('--draw', 1); return; }

    var last = '';
    ScrollTrigger.create({
      trigger: host, start: 'top bottom', end: 'bottom top', scrub: true,
      onUpdate: function (self) {
        // Le filet se trace entre 25 % et 62 %
        // de la traversée de la section.
        var v = smoothstep(seg(self.progress, .25, .62)).toFixed(4);
        if (v === last) return;        // pas d'écriture inutile
        last = v;
        line.style.setProperty('--draw', v);
      }
    });
  });

  /* -------------------------------------------------------
     5. Bandeau défilant
  ------------------------------------------------------- */
  var band = document.getElementById('bandText');
  if (band && !REDUCED) {
    gsap.fromTo(band, { xPercent: 0 }, {
      xPercent: -32, ease: 'none',
      scrollTrigger: { trigger: band.parentNode, start: 'top bottom', end: 'bottom top', scrub: true }
    });
  }

  /* -------------------------------------------------------
     7. Hero
  ------------------------------------------------------- */
  (function heroIntro() {
    document.querySelectorAll('.display .word').forEach(function (w) {
      var inner = document.createElement('span');
      inner.textContent = w.textContent;
      w.textContent = '';
      w.appendChild(inner);
    });
    if (REDUCED) return;

    gsap.timeline({ defaults: { ease: 'power3.out' } })
      .from('.hero .meta__item', { y: -14, opacity: 0, stagger: .06, duration: .7 })
      .from('.hero__inner .label', { y: 16, opacity: 0, duration: .7 }, .1)
      .from('.display .word > span', { yPercent: 115, duration: 1.15, stagger: .09 }, .18)
      .from('.hero .lede', { y: 20, opacity: 0, duration: .9 }, .6)
      .from('.meta--bottom .meta__item', { opacity: 0, duration: .9, stagger: .08 }, .75);
  })();

  /* -------------------------------------------------------
     8. Navigation
  ------------------------------------------------------- */
  var nav = document.getElementById('nav');
  var burger = document.getElementById('burger');
  var navLinks = document.getElementById('navLinks');
  var links = Array.prototype.slice.call(navLinks.querySelectorAll('a'));
  var targets = links
    .map(function (a) { return document.querySelector(a.getAttribute('href')); })
    .filter(Boolean);

  burger.addEventListener('click', function () {
    var open = nav.classList.toggle('is-open');
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
    if (lenis) { if (open) lenis.stop(); else lenis.start(); }
  });

  function closeMenu() {
    nav.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
    if (lenis) lenis.start();
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!a) return;
    var href = a.getAttribute('href');
    if (href === '#') return;
    var el = document.querySelector(href);
    if (!el) return;
    e.preventDefault();
    closeMenu();
    scrollToEl(el);
  });

  function onScroll(y) {
    nav.classList.toggle('is-stuck', y > 24);
    var active = null;
    targets.forEach(function (el, i) {
      if (el.getBoundingClientRect().top <= window.innerHeight * 0.4) active = links[i];
    });
    links.forEach(function (a) { a.classList.toggle('is-active', a === active); });
  }

  if (lenis) lenis.on('scroll', function (e) { onScroll(e.scroll); });
  else window.addEventListener('scroll', function () { onScroll(window.scrollY); }, { passive: true });
  onScroll(window.scrollY);

  var year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
})();
