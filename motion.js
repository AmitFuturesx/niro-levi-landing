/*! Amitzur Digital — premium motion library (motion.js)
 *
 * Needs GSAP 3 + ScrollTrigger loaded first. Lenis is optional (smooth scroll).
 * Every module is opt-in through a data attribute, so a page only pays for what it uses.
 * The page must be fully readable with JS off: modules only ANIMATE content that is already in the HTML.
 *
 * Modules (attribute on the section root → what it does):
 *   [data-hero]            intro choreography: preloader → media mask reveal → title word-rise → steps in order → markers
 *   [data-split]           heading rises word by word when it enters the viewport
 *   [data-reveal]          fade + rise once ("stagger" value = animate direct children one after another)
 *   [data-scrub-words]     paragraph colours in word by word while scrolling (scrub)
 *   .mark                  highlighter marker that draws itself behind a word
 *   [data-count]           number counts up from 0 (the HTML keeps the final number for SEO / no-JS)
 *   [data-parallax="0.08"] gentle scroll parallax on media
 *   [data-mask]            circle | rect clip-path reveal on enter
 *   [data-arc-loop]        infinite scroll-snap carousel bent on an arc (cap shape)
 *   [data-arc-tabs]        tabs sitting on a dome; the active one rotates to the top, panel cross-fades
 *   [data-hscroll]         desktop: pinned section, vertical scroll moves a row sideways · mobile: native swipe
 *   [data-wheel]           cards on the rim of a huge wheel; drag / fling / dots rotate it
 *   [data-sticky-bounce]   sticky card stack; each card straightens on a spring and squashes when it lands
 *   [data-fan]             cards fanned like playing cards; hover / tap / arrow keys lift one
 *   [data-blur-stack]      sticky stack; each card blurs, shrinks and fades as the next one covers it
 *   [data-process-wheel]   desktop: pinned, a circle draws itself and steps swap at each dot · mobile: plain list
 *   [data-auto-process]    tabs with a filling progress bar that advance by themselves (starts in view)
 *   [data-line-draw]       SVG line draws between steps; each step lights up (grayscale → colour) when reached
 *   [data-spread]          a tilted pile of cards spreads into a row while scrolling (desktop)
 *   [data-bg]              page background eases to this colour while the section is in view
 *   [data-marquee]         single CSS marquee, content duplicated for a seamless loop (max ONE per page)
 *   [data-vcard]           vertical testimonial video card with play / mute
 *   [data-buybar]          sticky buy bar / floating price button that appears after [data-buybar-after]
 *   .site-header           gets .is-scrolled after the first scroll
 */
(function () {
  'use strict';

  var gsap = window.gsap, ST = window.ScrollTrigger;
  var html = document.documentElement;
  if (!gsap || !ST) { html.classList.remove('js'); return; }
  gsap.registerPlugin(ST);

  /* ── helpers ─────────────────────────────────────────── */
  var RTL = (html.getAttribute('dir') || getComputedStyle(html).direction) === 'rtl';
  var DIR = RTL ? -1 : 1;                       // physical sign of "forward" on the x axis
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DESKTOP = '(min-width: 1025px)';
  var MOBILE = '(max-width: 1024px)';
  var EASE = 'power4.out';                      // ≈ cubic-bezier(.22,1,.36,1)
  var mm = gsap.matchMedia();

  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  function clamp(x, a, b) { a = a === undefined ? 0 : a; b = b === undefined ? 1 : b; return Math.max(a, Math.min(b, x)); }
  function cssNum(el, prop, def) { var v = parseFloat(getComputedStyle(el).getPropertyValue(prop)); return isFinite(v) ? v : def; }
  function dataNum(el, key, def) { var v = parseFloat(el.dataset[key]); return isFinite(v) ? v : def; }
  function inView(el, cb, opts) {
    var io = new IntersectionObserver(function (entries) { entries.forEach(function (e) { cb(e.isIntersecting, e); }); }, opts || { threshold: 0 });
    io.observe(el); return io;
  }

  /* Split an element into word spans (.w > .wi). Children with class "line" are split recursively,
     any other child element (e.g. .mark, strong) is kept whole as one word. Hebrew is never split into letters. */
  function splitWords(el) {
    if (el.__words) return el.__words;
    var words = [];
    function walk(node, out) {
      var frag = document.createDocumentFragment();
      var kids = Array.prototype.slice.call(node.childNodes);
      while (node.firstChild) node.removeChild(node.firstChild);
      kids.forEach(function (child) {
        if (child.nodeType === 3) {
          child.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            var w = document.createElement('span'); w.className = 'w';
            var i = document.createElement('span'); i.className = 'wi'; i.textContent = part;
            w.appendChild(i); frag.appendChild(w); out.push(i);
          });
        } else if (child.nodeType === 1 && child.classList.contains('line')) {
          walk(child, out); frag.appendChild(child);
        } else if (child.nodeType === 1 && child.tagName !== 'BR') {
          var w2 = document.createElement('span'); w2.className = 'w';
          var i2 = document.createElement('span'); i2.className = 'wi';
          i2.appendChild(child); w2.appendChild(i2); frag.appendChild(w2); out.push(i2);
        } else { frag.appendChild(child); }
      });
      node.appendChild(frag);
    }
    walk(el, words);
    el.__words = words;
    return words;
  }

  /* ── smooth scroll (Lenis) ───────────────────────────── */
  function initSmoothScroll() {
    if (reduce || !window.Lenis) return;
    var lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true });
    lenis.on('scroll', ST.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
    window.__lenis = lenis;
    // anchor links go through Lenis so they glide too
    $$('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href'); if (id.length < 2) return;
        var target = $(id); if (!target) return;
        e.preventDefault(); lenis.scrollTo(target, { offset: -90 });
      });
    });
  }

  /* ── header ──────────────────────────────────────────── */
  function initHeader() {
    var h = $('.site-header'); if (!h) return;
    var on = false;
    function check() { var s = window.scrollY > 20; if (s !== on) { on = s; h.classList.toggle('is-scrolled', s); } }
    window.addEventListener('scroll', check, { passive: true }); check();
    var toggle = $('[data-menu-toggle]', h);
    if (toggle) {
      toggle.addEventListener('click', function () {
        var open = h.classList.toggle('is-open');
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (window.__lenis) open ? window.__lenis.stop() : window.__lenis.start();
      });
      $$('.site-header__nav a', h).forEach(function (a) { a.addEventListener('click', function () {
        h.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false'); if (window.__lenis) window.__lenis.start();
      }); });
    }
  }

  /* ── intro: preloader + hero choreography ────────────── */
  function initIntro() {
    var pre = $('.preloader');
    var hero = $('[data-hero]');
    var tl = gsap.timeline({ defaults: { ease: EASE } });
    var seen = false;
    try { seen = sessionStorage.getItem('intro-seen') === '1'; } catch (e) {}

    if (pre && !seen && !reduce) {
      var mark = $('.preloader__mark', pre) || pre;
      tl.fromTo(mark, { autoAlpha: 0, y: 14, scale: 0.96 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.55 })
        .to(mark, { autoAlpha: 0, y: -14, duration: 0.35 }, '+=0.3')
        .to(pre, { clipPath: 'inset(0 0 100% 0)', duration: 0.7, ease: 'power3.inOut' }, '-=0.1')
        .set(pre, { display: 'none' });
      try { sessionStorage.setItem('intro-seen', '1'); } catch (e) {}
    } else if (pre) { pre.style.display = 'none'; }

    if (!hero) return;
    var media = $('[data-hero-media]', hero);
    var title = $('[data-hero-title]', hero);
    var steps = $$('[data-hero-step]', hero).sort(function (a, b) { return (+a.dataset.heroStep || 0) - (+b.dataset.heroStep || 0); });
    var marks = $$('.mark', hero);

    if (reduce) { gsap.set([title].concat(steps).filter(Boolean), { autoAlpha: 1 }); marks.forEach(function (m) { m.classList.add('is-in'); }); return; }

    if (media) {
      var shape = media.dataset.heroMedia || 'circle';
      var from = shape === 'rect' ? 'inset(18% 18% 18% 18% round 40px)' : 'circle(0% at 50% 50%)';
      var to = shape === 'rect' ? 'inset(0% 0% 0% 0% round 0px)' : 'circle(75% at 50% 50%)';
      tl.fromTo(media, { clipPath: from }, { clipPath: to, duration: 1.1, ease: 'power3.inOut', clearProps: 'clipPath' }, pre && !seen ? '-=0.45' : 0);
      var img = $('img, video, .ph', media);
      if (img) tl.fromTo(img, { scale: 1.12 }, { scale: 1, duration: 1.6, ease: 'power2.out' }, '<');
    }
    if (title) {
      var words = splitWords(title);
      tl.set(title, { autoAlpha: 1 }, media ? '-=0.55' : '>')
        .from(words, { yPercent: 115, duration: 0.95, stagger: 0.07 }, '<');
    }
    steps.forEach(function (s, i) { tl.fromTo(s, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.7 }, i === 0 ? '-=0.45' : '-=0.5'); });
    tl.add(function () { marks.forEach(function (m) { m.classList.add('is-in'); }); }, '-=0.3');
  }

  /* ── generic reveals ─────────────────────────────────── */
  function initReveals() {
    $$('[data-split]').forEach(function (el) {
      if (el.closest('[data-hero]')) return;
      var words = splitWords(el);
      if (reduce) return;
      gsap.from(words, { yPercent: 115, duration: 0.9, ease: EASE, stagger: 0.06, scrollTrigger: { trigger: el, start: 'top 85%', once: true } });
    });
    $$('[data-reveal]').forEach(function (el) {
      if (reduce) return;
      var targets = el.dataset.reveal === 'stagger' ? Array.prototype.slice.call(el.children) : [el];
      gsap.from(targets, { autoAlpha: 0, y: 32, duration: 0.8, ease: EASE, stagger: 0.09, scrollTrigger: { trigger: el, start: 'top 85%', once: true } });
    });
    $$('.mark').forEach(function (m) {
      if (m.closest('[data-hero]')) return;
      if (reduce) { m.classList.add('is-in'); return; }
      ST.create({ trigger: m, start: 'top 85%', once: true, onEnter: function () { m.classList.add('is-in'); } });
    });
    $$('[data-scrub-words]').forEach(function (el) {
      var words = splitWords(el);
      if (reduce) return;
      var from = cssNumColor(el, '--scrub-from'), to = cssNumColor(el, '--scrub-to');
      gsap.set(words, { color: from });
      gsap.to(words, { color: to, ease: 'none', stagger: 1, scrollTrigger: { trigger: el, start: 'top 78%', end: 'bottom 45%', scrub: true } });
    });
    $$('[data-count]').forEach(function (el) {
      var target = parseFloat(el.dataset.count); if (!isFinite(target) || reduce) return;
      var decimals = (el.dataset.count.split('.')[1] || '').length;
      var prefix = el.dataset.prefix || '', suffix = el.dataset.suffix || '';
      var obj = { v: 0 };
      function paint() { el.textContent = prefix + obj.v.toLocaleString('he-IL', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix; }
      ST.create({ trigger: el, start: 'top 90%', once: true, onEnter: function () { gsap.to(obj, { v: target, duration: 1.6, ease: 'power2.out', onUpdate: paint }); } });
      obj.v = 0; paint();
    });
    $$('[data-parallax]').forEach(function (el) {
      if (reduce) return;
      var p = dataNum(el, 'parallax', 0.08) * 100;
      gsap.fromTo(el, { yPercent: -p }, { yPercent: p, ease: 'none', scrollTrigger: { trigger: el.parentElement || el, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
    $$('[data-mask]').forEach(function (el) {
      if (reduce || el.closest('[data-hero]')) return;
      var rect = el.dataset.mask === 'rect';
      gsap.fromTo(el, { clipPath: rect ? 'inset(15% 15% 15% 15% round 32px)' : 'circle(0% at 50% 50%)' },
        { clipPath: rect ? 'inset(0% 0% 0% 0% round 0px)' : 'circle(75% at 50% 50%)', duration: 1.2, ease: 'power3.inOut', clearProps: 'clipPath',
          scrollTrigger: { trigger: el, start: 'top 80%', once: true } });
    });
  }
  function cssNumColor(el, prop) { return getComputedStyle(el).getPropertyValue(prop).trim() || 'currentColor'; }

  /* ── arc loop carousel ───────────────────────────────── */
  function initArcLoop(root) {
    var track = $('[data-arc-track]', root); if (!track) return;
    var originals = Array.prototype.slice.call(track.children);
    var n = originals.length; if (n < 3) return;
    for (var k = 0; k < 2; k++) originals.forEach(function (o) {
      var c = o.cloneNode(true); c.setAttribute('aria-hidden', 'true'); c.setAttribute('inert', '');
      track.appendChild(c);
    });
    var slides = Array.prototype.slice.call(track.children);
    var setW = 0, step = 0, raf = 0, timer = 0, paused = false, visible = false;

    function measure() {
      setW = Math.abs(slides[n].offsetLeft - slides[0].offsetLeft);
      step = Math.abs(slides[1].offsetLeft - slides[0].offsetLeft);
    }
    function pos() { return Math.abs(track.scrollLeft); }
    function jump(p) {
      track.style.scrollSnapType = 'none'; track.style.scrollBehavior = 'auto';
      track.scrollLeft = DIR * p;
      requestAnimationFrame(function () { track.style.scrollSnapType = ''; track.style.scrollBehavior = ''; });
    }
    function loop() { var p = pos(); if (p < setW * 0.5) jump(p + setW); else if (p > setW * 1.5) jump(p - setW); }
    function arc() {
      var r = track.getBoundingClientRect(), cx = r.left + r.width / 2, half = r.width / 2 || 1;
      var depth = cssNum(root, '--arc-depth', 70), rot = cssNum(root, '--arc-rotate', 9);
      slides.forEach(function (s) {
        var b = s.getBoundingClientRect(), d = clamp((b.left + b.width / 2 - cx) / half, -1.6, 1.6), a = Math.abs(d);
        gsap.set(s, { y: a * a * depth, rotation: d * rot, zIndex: Math.round(100 - a * 10) });
        s.classList.toggle('is-center', a < 0.2);
      });
    }
    var settle = 0;
    track.addEventListener('scroll', function () {
      cancelAnimationFrame(raf); raf = requestAnimationFrame(arc);
      clearTimeout(settle); settle = setTimeout(loop, 140);
    }, { passive: true });
    function next(dirSign) { track.scrollBy({ left: DIR * step * dirSign, behavior: 'smooth' }); }
    var prevBtn = $('[data-arc-prev]', root), nextBtn = $('[data-arc-next]', root);
    if (prevBtn) prevBtn.addEventListener('click', function () { next(-1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { next(1); });

    var every = dataNum(root, 'autoplay', 0);
    function tick() { if (!paused && visible && !document.hidden) next(1); }
    if (every && !reduce) {
      timer = setInterval(tick, every);
      ['pointerenter', 'focusin', 'touchstart'].forEach(function (ev) { root.addEventListener(ev, function () { paused = true; }, { passive: true }); });
      ['pointerleave', 'focusout'].forEach(function (ev) { root.addEventListener(ev, function () { paused = false; }); });
    }
    inView(root, function (v) { visible = v; });
    function setup() { measure(); jump(setW); arc(); }
    setup();
    window.addEventListener('resize', function () { setup(); });
    if (document.fonts) document.fonts.ready.then(setup);
  }

  /* ── dome / arc tabs ─────────────────────────────────── */
  function initArcTabs(root) {
    var items = $$('[data-arc-item]', root), panels = $$('[data-arc-panel]', root), imgs = $$('[data-arc-img]', root);
    if (!items.length) return;
    var current = Math.floor(items.length / 2);
    var ai = items.findIndex(function (i) { return i.getAttribute('aria-selected') === 'true'; });
    if (ai > -1) current = ai;

    function layout(animate) {
      var w = document.documentElement.clientWidth || window.innerWidth;   // layout width, so device emulation / iframes can't fool it
      imgs.forEach(function (im, i) { im.classList.toggle('is-on', i === current); });
      var span = w < 768 ? 140 : w < 1025 ? 120 : 124;
      var stepDeg = span / Math.max(1, items.length - 1);
      var R = cssNum(root, '--arc-r', 25) * w / 100;
      var idle = cssNum(root, '--idle-opacity', 0.4);
      items.forEach(function (it, i) {
        // circular offset: the wheel wraps, so every tab stays on the arc whichever one is on top
        var k = ((i - current) % items.length + items.length) % items.length; if (k > items.length / 2) k -= items.length;
        var wrapped = it.__k !== undefined && Math.abs(it.__k - k) > items.length / 2; it.__k = k;   // only a true wrap jumps, a 2-step click still glides
        var deg = k * stepDeg, rad = deg * Math.PI / 180;
        var vis = Math.abs(deg) <= span / 2 + 0.01;
        // forward (higher index) sits toward the inline-end side: right in LTR, left in RTL
        gsap.to(it, {
          x: Math.sin(rad) * R * (RTL ? -1 : 1),
          y: (1 - Math.cos(rad)) * R,
          rotation: deg * (RTL ? -1 : 1),
          autoAlpha: i === current ? 1 : vis ? idle : 0,
          duration: animate && !reduce && !wrapped ? 0.8 : 0, ease: 'power3.inOut', overwrite: 'auto'   // one tween per circle: a re-layout can never fight a running one
        });
        it.setAttribute('aria-selected', i === current ? 'true' : 'false');
        it.tabIndex = i === current ? 0 : -1;
      });
      panels.forEach(function (p, i) {
        var on = i === current;
        if (on === p.classList.contains('is-active') && animate) return;
        p.classList.toggle('is-active', on);
        p.setAttribute('aria-hidden', on ? 'false' : 'true');
        if (!animate || reduce) { gsap.set(p, { autoAlpha: on ? 1 : 0 }); return; }
        if (on) gsap.to(p, { autoAlpha: 1, duration: 0.5, delay: 0.1, ease: EASE, overwrite: 'auto' });
        else gsap.to(p, { autoAlpha: 0, duration: 0.3, overwrite: 'auto' });
      });
    }
    function go(i) { current = (i + items.length) % items.length; layout(true); }
    items.forEach(function (it, i) {
      it.addEventListener('click', function () { go(i); });
      it.addEventListener('keydown', function (e) {
        var fwd = RTL ? 'ArrowLeft' : 'ArrowRight', back = RTL ? 'ArrowRight' : 'ArrowLeft';
        if (e.key === fwd) { e.preventDefault(); go(current + 1); items[current].focus(); }
        if (e.key === back) { e.preventDefault(); go(current - 1); items[current].focus(); }
      });
    });
    layout(false);
    var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { layout(false); }, 80); });
    window.addEventListener('orientationchange', function () { setTimeout(function () { layout(false); }, 200); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { layout(false); });
  }

  /* ── pinned horizontal scroll (desktop) ──────────────── */
  function initHScroll(root) {
    var track = $('[data-hscroll-track]', root); if (!track || reduce) return;
    var bar = $('[data-hscroll-progress]', root), counter = $('[data-hscroll-count]', root);
    var total = track.children.length;
    mm.add(DESKTOP, function () {
      var amount = function () { return Math.max(0, track.scrollWidth - root.clientWidth); };
      var speed = dataNum(root, 'speed', 1.4);
      gsap.to(track, {
        x: function () { return -DIR * amount(); }, ease: 'none',
        scrollTrigger: {
          trigger: root, pin: true, scrub: 0.6, start: 'top top', end: function () { return '+=' + amount() * speed; }, invalidateOnRefresh: true,
          onUpdate: function (self) {
            if (bar) bar.style.setProperty('--p', self.progress.toFixed(4));
            if (counter) counter.textContent = String(Math.min(total, Math.floor(self.progress * total) + 1)).padStart(2, '0');
          }
        }
      });
    });
  }

  /* ── radial wheel ────────────────────────────────────── */
  function initWheel(root) {
    var stage = $('[data-wheel-stage]', root), cards = $$('[data-wheel-card]', root);
    if (!stage || !cards.length) return;
    var stepDeg = dataNum(root, 'step', 16), dur = dataNum(root, 'duration', 0.8), dragK = dataNum(root, 'drag', 1);
    var st = { rot: 0 }, index = 0, n = cards.length;
    var dotsWrap = $('[data-wheel-dots]', root), dots = [];
    if (dotsWrap) cards.forEach(function (_, i) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'wheel__dot'; b.setAttribute('aria-label', 'כרטיס ' + (i + 1));
      b.addEventListener('click', function () { goTo(i); }); dotsWrap.appendChild(b); dots.push(b);
    });
    function apply() {
      var cw = cards[0].offsetWidth || 300, R = cssNum(root, '--wheel-radius', 4.2) * cw;
      cards.forEach(function (c, i) {
        var off = i * stepDeg - st.rot, a = Math.abs(off);
        c.style.transformOrigin = '50% ' + R + 'px';
        c.style.transform = 'rotate(' + (off * (RTL ? -1 : 1)) + 'deg)';
        c.style.opacity = clamp(1 - (a - stepDeg * 1.2) / (stepDeg * 2)).toFixed(3);
        c.style.pointerEvents = a > stepDeg * 2.5 ? 'none' : '';
        c.classList.toggle('is-active', a < stepDeg / 2);
      });
      dots.forEach(function (d, i) { d.classList.toggle('is-active', i === index); d.setAttribute('aria-current', i === index ? 'true' : 'false'); });
    }
    function goTo(i) {
      index = clamp(Math.round(i), 0, n - 1);
      gsap.to(st, { rot: index * stepDeg, duration: reduce ? 0 : dur, ease: 'power3.out', onUpdate: apply, overwrite: true });
    }
    var startX = 0, startRot = 0, lastX = 0, lastT = 0, vel = 0, dragging = false, moved = false;
    stage.addEventListener('pointerdown', function (e) {
      if (!dragK) return;
      dragging = true; moved = false; startX = lastX = e.clientX; lastT = performance.now(); startRot = st.rot; vel = 0;
      gsap.killTweensOf(st); stage.setPointerCapture(e.pointerId);
    });
    stage.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var cw = cards[0].offsetWidth || 300, dx = e.clientX - startX;
      if (Math.abs(dx) > 6) moved = true;
      var raw = startRot - DIR * dx / cw * stepDeg * dragK, max = (n - 1) * stepDeg;
      st.rot = raw < 0 ? raw * 0.35 : raw > max ? max + (raw - max) * 0.35 : raw;
      var now = performance.now(), dt = Math.max(1, now - lastT);
      vel = -DIR * (e.clientX - lastX) / cw * stepDeg * dragK / dt; lastX = e.clientX; lastT = now;
      apply();
    });
    function end() {
      if (!dragging) return; dragging = false;
      var projected = st.rot + vel * dataNum(root, 'fling', 320);
      goTo(projected / stepDeg);
    }
    stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
    stage.addEventListener('click', function (e) {
      if (moved) { e.preventDefault(); e.stopPropagation(); return; }
      var c = e.target.closest('[data-wheel-card]'); if (c) { var i = cards.indexOf(c); if (i !== index) goTo(i); }
    }, true);
    root.addEventListener('keydown', function (e) {
      var fwd = RTL ? 'ArrowLeft' : 'ArrowRight', back = RTL ? 'ArrowRight' : 'ArrowLeft';
      if (e.key === fwd) goTo(index + 1); if (e.key === back) goTo(index - 1);
    });
    var start = dataNum(root, 'start', Math.floor(n / 2)); index = start; st.rot = start * stepDeg;
    apply(); window.addEventListener('resize', apply);
  }

  /* ── sticky bounce cards (spring physics) ────────────── */
  function initStickyBounce(root) {
    var cards = $$('[data-sb-card]', root); if (!cards.length) return;
    var cfg = { turnRange: dataNum(root, 'turnRange', 0.6), bounce: clamp(dataNum(root, 'bounce', 3), 0, 30) / 100, wobble: clamp(dataNum(root, 'wobble', 1), 0.2, 3) };
    var OMEGA = 13, VREF = 1.25, ZETA = clamp(0.62 / cfg.wobble, 0.15, 1);
    var anchors = cards.map(function (c, i) {
      c.style.setProperty('--i', i);
      var a = document.createElement('i'); a.className = 'sb-anchor'; a.setAttribute('aria-hidden', 'true');
      c.parentNode.insertBefore(a, c); return a;
    });
    var state = cards.map(function () { return { turn: 1, tv: 0, sq: 0, sv: 0, prev: null }; });
    var raf = 0, last = 0, running = false;
    function frame(t) {
      var dt = last ? Math.min(1 / 30, Math.max(0, (t - last) / 1000)) : 0; last = t;
      cards.forEach(function (c, i) {
        var s = state[i], h = c.offsetHeight || 1, stick = parseFloat(getComputedStyle(c).top) || 0;
        var dist = anchors[i].getBoundingClientRect().top - stick;
        var p = clamp(1 - dist / (cfg.turnRange * h)), target = p * p;
        if (s.prev === null) { s.prev = dist; s.turn = target; }
        if (reduce) { s.turn = target > 0.5 ? 1 : 0; s.sq = 0; }
        else if (dt > 0) {
          if (s.prev > 0 && dist <= 0) { var speed = (s.prev - dist) / dt / h; s.sv += cfg.bounce * Math.min(speed / VREF, 1.6) * OMEGA / 0.63; }
          s.tv += (-OMEGA * OMEGA * (s.turn - target) - 2 * ZETA * OMEGA * s.tv) * dt; s.turn += s.tv * dt;
          s.sv += (-OMEGA * OMEGA * s.sq - 2 * ZETA * OMEGA * s.sv) * dt; s.sq += s.sv * dt;
          if (Math.abs(s.turn - target) < 1e-4 && Math.abs(s.tv) < 1e-3) { s.turn = target; s.tv = 0; }
          if (Math.abs(s.sq) < 1e-4 && Math.abs(s.sv) < 1e-3) { s.sq = 0; s.sv = 0; }
        }
        s.prev = dist;
        c.style.setProperty('--turn', s.turn.toFixed(4));
        c.style.setProperty('--sx', (1 + s.sq).toFixed(4));
        c.style.setProperty('--sy', (1 - s.sq).toFixed(4));
      });
      if (running) raf = requestAnimationFrame(frame);
    }
    inView(root, function (v) {
      if (v && !running) { running = true; last = 0; raf = requestAnimationFrame(frame); }
      else if (!v && running) { running = false; cancelAnimationFrame(raf); }
    }, { rootMargin: '20% 0px' });
  }

  /* ── fan cards ───────────────────────────────────────── */
  function initFan(root) {
    var cards = $$('[data-fan-card]', root); if (!cards.length) return;
    var mid = (cards.length - 1) / 2;
    function select(card) { cards.forEach(function (c) { var on = c === card; c.classList.toggle('is-selected', on); c.setAttribute('aria-pressed', on ? 'true' : 'false'); }); }
    cards.forEach(function (card, i) {
      card.style.setProperty('--fi', String(i - mid));
      if (!card.hasAttribute('tabindex')) card.tabIndex = 0;
      card.addEventListener('pointerenter', function (e) { if (e.pointerType !== 'touch') select(card); });
      card.addEventListener('pointerdown', function (e) { if (e.isPrimary) select(card); });
      card.addEventListener('focus', function () { select(card); });
      card.addEventListener('keydown', function (e) {
        var keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End']; if (keys.indexOf(e.key) < 0) return; e.preventDefault();
        var fwd = RTL ? 'ArrowLeft' : 'ArrowRight';
        var j = e.key === 'Home' ? 0 : e.key === 'End' ? cards.length - 1 : (i + (e.key === fwd ? 1 : -1) + cards.length) % cards.length;
        cards[j].focus();
      });
    });
    root.addEventListener('pointerleave', function (e) { if (e.pointerType !== 'touch') select(null); });
    var start = root.dataset.fanStart; if (start !== undefined) select(cards[+start] || null);
  }

  /* ── blur stack ──────────────────────────────────────── */
  function initBlurStack(root) {
    if (reduce) return;
    var wraps = $$('[data-blur-item]', root);
    var blur = getComputedStyle(root).getPropertyValue('--blur').trim() || '6px';
    var exitScale = cssNum(root, '--exit-scale', 0.84);
    wraps.forEach(function (w, i) {
      var next = wraps[i + 1]; if (!next) return;
      var card = w.firstElementChild || w;
      gsap.to(card, { filter: 'blur(' + blur + ')', scale: exitScale, autoAlpha: 0, ease: 'none',
        scrollTrigger: { trigger: next, start: 'top 60%', end: 'top 5%', scrub: true } });
    });
  }

  /* ── process wheel ───────────────────────────────────── */
  function initProcessWheel(root) {
    var arc = $('[data-pw-arc]', root), dots = $$('[data-pw-dot]', root), steps = $$('[data-pw-step]', root);
    if (!arc || !steps.length) return;
    mm.add(DESKTOP, function () {
      if (reduce) return;
      var LEN = arc.getTotalLength(), n = steps.length;
      root.classList.add('is-pinned');
      gsap.set(arc, { strokeDasharray: LEN, strokeDashoffset: LEN });
      gsap.set(steps, { autoAlpha: 0, y: 20 }); gsap.set(steps[0], { autoAlpha: 1, y: 0 });
      dots.forEach(function (d, i) { d.classList.toggle('is-on', i === 0); });
      var tl = gsap.timeline({ scrollTrigger: { trigger: root, start: 'top top', end: '+=' + dataNum(root, 'length', 2200), scrub: true, pin: true, anticipatePin: 1 } });
      steps.forEach(function (s, i) {
        tl.to(arc, { strokeDashoffset: LEN * (1 - (i + 1) / n), duration: 2, ease: 'none' });
        tl.call(function () { dots.forEach(function (d, j) { d.classList.toggle('is-on', j <= Math.min(i + 1, n - 1)); }); });
        if (steps[i + 1]) {
          tl.to(s, { autoAlpha: 0, y: -16, duration: 0.5 }, '>')
            .to(steps[i + 1], { autoAlpha: 1, y: 0, duration: 0.5 }, '<0.2');
        }
      });
      return function () { root.classList.remove('is-pinned'); };
    });
  }

  /* ── auto-advancing process tabs ─────────────────────── */
  function initAutoProcess(root) {
    var tabs = $$('[data-ap-tab]', root), steps = $$('[data-ap-step]', root); if (!tabs.length) return;
    var DUR = dataNum(root, 'duration', 4), current = 0, tween = null, visible = false, started = false;
    function activate(i, auto) {
      current = i;
      if (tween) tween.kill();
      tabs.forEach(function (t, j) { t.classList.toggle('is-active', j === i); t.setAttribute('aria-selected', j === i ? 'true' : 'false'); t.style.setProperty('--progress', '0%'); });
      if (reduce || !auto) tabs[i].style.setProperty('--progress', '100%');
      steps.forEach(function (s, j) {
        if (j === i) { s.hidden = false; if (!reduce) gsap.fromTo(s, { autoAlpha: 0, y: 15 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power3.out' }); }
        else { s.hidden = true; }
      });
      if (reduce || !auto) return;
      var o = { p: 0 };
      tween = gsap.to(o, { p: 100, duration: DUR, ease: 'none',
        onUpdate: function () { tabs[i].style.setProperty('--progress', o.p + '%'); },
        onComplete: function () { if (visible) activate((i + 1) % tabs.length, true); } });
      if (!visible) tween.pause();
    }
    tabs.forEach(function (t, i) { t.addEventListener('click', function () { activate(i, true); }); });
    activate(0, false);
    inView(root, function (v) {
      visible = v;
      if (v && !started) { started = true; activate(0, true); }
      else if (tween) { v ? tween.resume() : tween.pause(); }
    }, { threshold: 0.35 });
  }

  /* ── line draw process ───────────────────────────────── */
  function initLineDraw(root) {
    var lines = $$('[data-ld-line] path', root), steps = $$('[data-ld-step]', root); if (!steps.length) return;
    if (reduce) { steps.forEach(function (s) { s.classList.add('is-lit'); }); return; }
    mm.add({ desk: DESKTOP, mob: MOBILE }, function (ctx) {
      var desk = ctx.conditions.desk;
      root.classList.toggle('is-desk', !!desk);
      lines.forEach(function (p) { var L = p.getTotalLength(); gsap.set(p, { strokeDasharray: L, strokeDashoffset: L }); });
      gsap.set(steps, { opacity: 0.35, filter: 'grayscale(1)' });
      var tl = gsap.timeline({ scrollTrigger: { trigger: root, start: desk ? 'top top' : 'top 65%', end: desk ? '+=250%' : 'bottom 60%', pin: desk, scrub: 1 } });
      steps.forEach(function (step, i) {
        if (lines[i]) tl.to(lines[i], { strokeDashoffset: 0, duration: 1, ease: 'none' });
        tl.to(step, { opacity: 1, filter: 'grayscale(0)', duration: 0.5, ease: 'power1.inOut' }, lines[i] ? '-=0.2' : '>');
      });
    });
  }

  /* ── pile → row spread ───────────────────────────────── */
  function initSpread(root) {
    var cards = $$('[data-spread-card]', root); if (!cards.length || reduce) return;
    mm.add(DESKTOP, function () {
      var box = root.getBoundingClientRect();
      gsap.from(cards, {
        x: function (i, el) { var r = el.getBoundingClientRect(); return (box.left + box.width / 2) - (r.left + r.width / 2); },
        rotation: function (i) { return [-7, 5, -3, 8, -5, 4][i % 6]; },
        y: function (i) { return i * -6; },
        ease: 'none', stagger: 0,
        scrollTrigger: { trigger: root, start: 'top 85%', end: 'top 25%', scrub: 0.8, invalidateOnRefresh: true }
      });
    });
  }

  /* ── page background by section ──────────────────────── */
  function initBgSwitch() {
    var secs = $$('[data-bg]'); if (!secs.length) return;
    var base = getComputedStyle(document.body).backgroundColor;
    var baseFg = getComputedStyle(document.body).color;
    secs.forEach(function (s) {
      function on() { gsap.to(document.body, { backgroundColor: s.dataset.bg, color: s.dataset.fg || baseFg, duration: reduce ? 0 : 0.6, overwrite: 'auto' }); }
      function off() { gsap.to(document.body, { backgroundColor: base, color: baseFg, duration: reduce ? 0 : 0.6, overwrite: 'auto' }); }
      ST.create({ trigger: s, start: 'top 55%', end: 'bottom 45%', onEnter: on, onEnterBack: on, onLeave: off, onLeaveBack: off });
    });
  }

  /* ── marquee: fill the track to ≥ 2× the viewport, then duplicate it once and translate −50%.
        Seamless in both directions; data-marquee="end" runs the other way. Speed is px/s so both rows match. ── */
  function initMarquee(root) {
    var track = $('[data-marquee-track]', root); if (!track || track.__dup) return;
    var items = [].slice.call(track.children); if (!items.length) return;
    var need = Math.max(Math.min(root.clientWidth, window.innerWidth) * 2, 1600), w = track.scrollWidth, guard = 0;
    while (w < need && guard++ < 12) { items.forEach(function (n) { var c = n.cloneNode(true); c.setAttribute('aria-hidden', 'true'); track.appendChild(c); }); w = track.scrollWidth; }
    var half = track.scrollWidth;
    [].slice.call(track.children).forEach(function (n) { var c = n.cloneNode(true); c.setAttribute('aria-hidden', 'true'); track.appendChild(c); });
    track.__dup = true;
    if (reduce) return;
    var pxPerSec = parseFloat(root.dataset.marqueeSpeed) || 38;
    track.style.setProperty('--dur', (half / pxPerSec).toFixed(1) + 's');
    if (root.dataset.marquee === 'end') track.classList.add('is-rev');
    track.classList.add('is-run');
  }

  /* ── vertical video testimonial card ─────────────────── */
  function initVCard(card) {
    var v = $('video', card), play = $('[data-vcard-play]', card), mute = $('[data-vcard-mute]', card);
    if (!v) return;
    v.muted = true; v.playsInline = true;
    function sync() { card.classList.toggle('is-playing', !v.paused); card.classList.toggle('is-muted', v.muted); }
    if (play) play.addEventListener('click', function () { v.paused ? v.play() : v.pause(); });
    if (mute) mute.addEventListener('click', function () {
      v.muted = !v.muted;
      if (!v.muted) $$('[data-vcard] video').forEach(function (o) { if (o !== v && !o.muted) { o.muted = true; o.dispatchEvent(new Event('volumechange')); } });
      sync();
    });
    v.addEventListener('volumechange', sync);
    v.addEventListener('play', sync); v.addEventListener('pause', sync); sync();
    if (card.dataset.vcard === 'autoplay' && !reduce) inView(card, function (vis) { vis ? v.play().catch(function () {}) : v.pause(); }, { threshold: 0.6 });
  }

  /* ── sticky buy bar / floating price ─────────────────── */
  function initBuybar() {
    var bar = $('[data-buybar]'), after = $('[data-buybar-after]'); if (!bar || !after) return;
    ST.create({ trigger: after, start: 'bottom 15%', onEnter: function () { bar.classList.add('is-on'); }, onLeaveBack: function () { bar.classList.remove('is-on'); } });
    var stop = $('[data-buybar-stop]');
    if (stop) ST.create({ trigger: stop, start: 'top bottom', onEnter: function () { bar.classList.remove('is-on'); }, onLeaveBack: function () { bar.classList.add('is-on'); } });
  }

  /* ── boot ────────────────────────────────────────────── */

  /* ── PAGE: stage (hero) — Nir arrives after the name, props hang in depth and follow the pointer ── */
  function initStage(root) {
    var nir = $('[data-stage-nir]', root), seal = $('[data-stage-seal]', root), props = $$('.prop', root), sky = $('[data-stage-sky]', root);
    var stars = $('[data-stage-stars]', root);
    if (reduce) { gsap.set([nir, seal].concat(props).filter(Boolean), { autoAlpha: 1 }); return; }
    var tl = gsap.timeline({ defaults: { ease: EASE }, delay: 0.55 });
    if (nir) tl.fromTo(nir, { autoAlpha: 0, y: 60 }, { autoAlpha: 1, y: 0, duration: 1.2, ease: 'expo.out' }, 0);
    if (seal) tl.fromTo(seal, { autoAlpha: 0, scale: 0.6, rotate: -8 }, { autoAlpha: 1, scale: 1, rotate: -8, duration: 0.7, ease: 'back.out(1.8)' }, 0.9);
    if (props.length) tl.fromTo(props, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 1.2, stagger: 0.1 }, 0.5);
    // scroll: the stage sinks slower than the page
    mm.add(DESKTOP, function () {
      if (nir) gsap.to(nir, { y: 90, ease: 'none', scrollTrigger: { trigger: root, start: 'top top', end: 'bottom top', scrub: true } });
      gsap.to(props, { y: -60, ease: 'none', scrollTrigger: { trigger: root, start: 'top top', end: 'bottom top', scrub: true } });
      if (sky) gsap.to(sky, { yPercent: 12, ease: 'none', scrollTrigger: { trigger: root, start: 'top top', end: 'bottom top', scrub: true } });
      // pointer parallax by depth
      var qx = props.map(function (p) { return gsap.quickTo(p, 'x', { duration: 0.8, ease: 'power3' }); });
      var qy = props.map(function (p) { return gsap.quickTo(p, 'y', { duration: 0.8, ease: 'power3' }); });
      var depth = props.map(function (p) { return dataNum(p, 'depth', 1); });
      var nx = nir ? gsap.quickTo(nir, 'x', { duration: 1, ease: 'power3' }) : null;
      function move(e) {
        var r = root.getBoundingClientRect(); var dx = (e.clientX - r.left) / r.width - 0.5, dy = (e.clientY - r.top) / r.height - 0.5;
        depth.forEach(function (d, i) { qx[i](dx * 44 * d); qy[i](dy * 28 * d); });
        if (nx) nx(dx * -10);
      }
      root.addEventListener('pointermove', move);
      return function () { root.removeEventListener('pointermove', move); };
    });
    // starfield (canvas, pauses off-screen)
    if (stars && stars.getContext) {
      var ctx = stars.getContext('2d'), w = 0, h = 0, pts = [], raf = 0, running = false;
      function resize() { var dpr = Math.min(devicePixelRatio || 1, 2); w = stars.clientWidth; h = stars.clientHeight; stars.width = w * dpr; stars.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        pts = []; for (var i = 0, n = Math.min(160, Math.round(w * h / 11000)); i < n; i++) pts.push({ x: Math.random() * w, y: Math.random() * h * 0.8, r: Math.random() * 1.2 + 0.3, a: Math.random() * 6.28, s: Math.random() * 0.5 + 0.15, g: Math.random() < 0.4 }); }
      function draw() { ctx.clearRect(0, 0, w, h); for (var i = 0; i < pts.length; i++) { var p = pts[i]; var t = (Math.sin(p.a) + 1) / 2; p.a += p.s * 0.02; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fillStyle = p.g ? 'rgba(242,201,76,' + (0.15 + t * 0.6) + ')' : 'rgba(255,255,255,' + (0.1 + t * 0.5) + ')'; ctx.fill(); } }
      function frame() { if (!running) return; draw(); raf = requestAnimationFrame(frame); }
      resize(); window.addEventListener('resize', resize);
      inView(stars, function (vis) { if (vis && !running) { running = true; frame(); } if (!vis && running) { running = false; cancelAnimationFrame(raf); } });
    }
  }

  /* ── PAGE: booking form → WhatsApp with a prefilled message (no backend) ── */
  function initBooking(form) {
    var name = $('#f-name', form), phone = $('#f-phone', form), date = $('#f-date', form), btn = $('.booking__submit', form), label = $('[data-booking-label]', form);
    var WA = 'https://wa.me/972545203225';
    function err(input, id, bad) { var e = document.getElementById(id); if (e) e.hidden = !bad; input.classList.toggle('is-invalid', bad); input.setAttribute('aria-invalid', bad ? 'true' : 'false'); }
    function okPhone(v) { var d = v.replace(/\D/g, ''); if (d.indexOf('972') === 0) d = '0' + d.slice(3); return d.length === 9 || d.length === 10; }
    [name, phone].forEach(function (i) { i.addEventListener('input', function () { if (i.classList.contains('is-invalid')) err(i, i === name ? 'e-name' : 'e-phone', false); }); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var nb = name.value.trim().length < 2, pb = !okPhone(phone.value);
      err(name, 'e-name', nb); err(phone, 'e-phone', pb);
      if (nb) { name.focus(); return; } if (pb) { phone.focus(); return; }
      var d = 'עדיין לא נקבע';
      if (date.value) { var dt = new Date(date.value + 'T00:00:00'); if (!isNaN(dt)) d = dt.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' }); }
      var msg = 'היי ניר, אני ' + name.value.trim() + '. אשמח לשריין תאריך למופע: ' + d + '. הטלפון שלי: ' + phone.value.trim();
      var url = WA + '?text=' + encodeURIComponent(msg);
      var win = window.open(url, '_blank'); if (win) { try { win.opener = null; } catch (x) {} } else { location.href = url; }
      var orig = label.textContent; btn.classList.add('is-busy'); label.textContent = 'פותחים וואטסאפ...';
      setTimeout(function () { btn.classList.remove('is-busy'); label.textContent = 'ההודעה מוכנה, רק לשלוח'; }, 900);
      setTimeout(function () { label.textContent = orig; }, 5000);
    });
  }

  /* ── PAGE: video poster → YouTube embed on click ── */
  function initVideo(box) {
    var id = (box.dataset.youtubeId || '').trim(), play = $('.play', box); if (!play) return;
    if (!id) { play.hidden = true; return; }
    play.addEventListener('click', function () {
      var f = document.createElement('iframe'); f.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0&hl=he'; f.title = 'קטע מתוך המופע של ניר לוי';
      f.allow = 'autoplay; encrypted-media; picture-in-picture'; f.allowFullscreen = true; box.appendChild(f); box.classList.add('is-playing');
    });
  }

  /* ── PAGE: think of a card — the court-card force. All six cards the visitor could pick are absent from the second spread. ── */
  function initThinkCard(root) {
    var list = $('[data-think-cards]', root), go = $('[data-think-go]', root), cta = $('[data-think-cta]', root), again = $('[data-think-again]', root);
    var steps = [$('.think__step--1', root), $('.think__step--2', root), $('.think__step--3', root)];
    if (!list || !go) return;
    var first = $$('.tcard', list).map(function (c) { return c.outerHTML; });
    var second = [['J', '♥', 1], ['Q', '♠', 0], ['K', '♦', 1], ['J', '♣', 0], ['Q', '♥', 1]];
    function card(r, s, red) { return '<li class="tcard' + (red ? ' tcard--red' : '') + '" data-card="' + r + s + '"><span class="tcard__idx">' + r + '<i>' + s + '</i></span><span class="tcard__pip">' + s + '</span></li>'; }
    function show(i) { steps.forEach(function (p, k) { if (p) p.hidden = k !== i; }); }
    function spread(html) { list.innerHTML = html; return $$('.tcard', list); }
    var busy = false;
    go.addEventListener('click', function () {
      if (busy) return; busy = true;
      go.hidden = true; show(1);
      var cards = $$('.tcard', list);
      if (reduce) { spread(second.map(function (c) { return card(c[0], c[1], c[2]); }).join('')); show(2); cta.hidden = false; again.hidden = false; busy = false; return; }
      var tl = gsap.timeline({ onComplete: function () { show(2); cta.hidden = false; again.hidden = false; gsap.from([cta, again], { autoAlpha: 0, y: 12, duration: .5, ease: EASE }); busy = false; } });
      tl.to(cards, { rotateY: 90, duration: .35, ease: 'power2.in', stagger: .06 })
        .add(function () { cards.forEach(function (c) { c.classList.add('is-back'); }); })
        .to(cards, { rotateY: 0, duration: .35, ease: 'power2.out', stagger: .06 })
        .to(cards, { y: -6, duration: .45, yoyo: true, repeat: 1, ease: 'sine.inOut', stagger: { each: .07, yoyo: true } }, '+=.15')
        .to(cards, { rotateY: 90, duration: .3, ease: 'power2.in', stagger: .05 }, '+=.1')
        .add(function () { var n = spread(second.map(function (c) { return card(c[0], c[1], c[2]); }).join('')); gsap.set(n, { rotateY: 90 }); })
        .to({}, { duration: .05 })
        .add(function () { gsap.to($$('.tcard', list), { rotateY: 0, duration: .45, ease: 'back.out(1.4)', stagger: .07 }); })
        .to({}, { duration: .9 });
    });
    if (again) again.addEventListener('click', function () {
      spread(first.join('')); show(0); cta.hidden = true; again.hidden = true; go.hidden = false;
      if (!reduce) gsap.from($$('.tcard', list), { autoAlpha: 0, y: 16, duration: .5, stagger: .05, ease: EASE });
    });
  }

  function boot() {
    initSmoothScroll();
    initHeader();
    initIntro();
    initReveals();
    $$('[data-arc-loop]').forEach(initArcLoop);
    $$('[data-arc-tabs]').forEach(initArcTabs);
    $$('[data-hscroll]').forEach(initHScroll);
    $$('[data-wheel]').forEach(initWheel);
    $$('[data-sticky-bounce]').forEach(initStickyBounce);
    $$('[data-fan]').forEach(initFan);
    $$('[data-blur-stack]').forEach(initBlurStack);
    $$('[data-process-wheel]').forEach(initProcessWheel);
    $$('[data-auto-process]').forEach(initAutoProcess);
    $$('[data-line-draw]').forEach(initLineDraw);
    $$('[data-spread]').forEach(initSpread);
    $$('[data-marquee]').forEach(initMarquee);
    $$('[data-vcard]').forEach(initVCard);
    initBgSwitch();
    initBuybar();
    $$('[data-stage]').forEach(initStage);
    $$('[data-booking]').forEach(initBooking);
    $$('[data-video]').forEach(initVideo);
    $$('[data-think]').forEach(initThinkCard);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ST.refresh(); });
    window.addEventListener('load', function () { ST.refresh(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
