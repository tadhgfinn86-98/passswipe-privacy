/* Ripple Recycling — interaction layer.
   Nav state, scroll reveals, the Waste Wins gallery and the audit form. */

(function () {
  'use strict';

  /* --- Sticky nav: frosted state on scroll, mobile disclosure ------------ */

  var nav = document.querySelector('[data-nav]');
  var toggle = document.querySelector('[data-nav-toggle]');

  if (nav) {
    var setScrolled = function () {
      nav.classList.toggle('is-scrolled', window.scrollY > 8);
    };
    setScrolled();
    window.addEventListener('scroll', setScrolled, { passive: true });
  }

  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
    });

    nav.querySelectorAll('.nav__links a').forEach(function (link) {
      link.addEventListener('click', function () {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* --- Scroll reveal ----------------------------------------------------- */

  var revealables = document.querySelectorAll('.reveal');

  if ('IntersectionObserver' in window && revealables.length) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });

    revealables.forEach(function (el) { observer.observe(el); });
  } else {
    revealables.forEach(function (el) { el.classList.add('is-visible'); });
  }

  /* --- Waste Wins gallery: page-based dot pagination -------------------- */
  /* The gallery shows one card on a phone and roughly three on a desktop, so
     the dots track pages of the scroller rather than individual cards. */

  var gallery = document.querySelector('[data-gallery]');
  var dots = document.querySelector('[data-gallery-dots]');

  if (gallery && dots) {
    var pageCount = function () {
      if (!gallery.clientWidth) return 1;
      return Math.max(1, Math.ceil(gallery.scrollWidth / gallery.clientWidth));
    };

    var currentPage = function () {
      if (!gallery.clientWidth) return 0;
      return Math.min(pageCount() - 1, Math.round(gallery.scrollLeft / gallery.clientWidth));
    };

    var syncDots = function () {
      var active = currentPage();
      Array.prototype.forEach.call(dots.children, function (dot, index) {
        dot.classList.toggle('is-active', index === active);
        dot.setAttribute('aria-current', index === active ? 'true' : 'false');
      });
    };

    var buildDots = function () {
      var pages = pageCount();
      if (dots.children.length === pages) {
        syncDots();
        return;
      }

      dots.textContent = '';
      for (var i = 0; i < pages; i++) {
        (function (page) {
          var dot = document.createElement('button');
          dot.type = 'button';
          dot.setAttribute('aria-label', 'Show results page ' + (page + 1) + ' of ' + pages);
          dot.addEventListener('click', function () {
            gallery.scrollTo({ left: page * gallery.clientWidth, behavior: 'smooth' });
          });
          dots.appendChild(dot);
        })(i);
      }
      syncDots();
    };

    buildDots();

    gallery.addEventListener('scroll', function () {
      window.requestAnimationFrame(syncDots);
    }, { passive: true });

    var resizeTimer;
    window.addEventListener('resize', function () {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(buildDots, 150);
    });
  }

  /* --- Testimonial carousel --------------------------------------------- */

  var carousel = document.querySelector('[data-carousel]');

  if (carousel) {
    var slides = Array.prototype.slice.call(carousel.querySelectorAll('[data-slide]'));
    var index = 0;

    var show = function (next) {
      index = (next + slides.length) % slides.length;
      slides.forEach(function (slide, i) { slide.hidden = i !== index; });
    };

    var prev = carousel.querySelector('[data-prev]');
    var nextBtn = carousel.querySelector('[data-next]');
    if (prev) prev.addEventListener('click', function () { show(index - 1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { show(index + 1); });

    if (slides.length < 2 && prev && nextBtn) {
      prev.hidden = true;
      nextBtn.hidden = true;
    }
  }

  /* --- Hero quick-start -------------------------------------------------- */
  /* Carries the address down to the full audit form rather than asking for
     it twice. */

  var quick = document.querySelector('[data-quick-form]');

  if (quick) {
    var handoff = function (event) {
      event.preventDefault();
      var typed = quick.querySelector('input[type="email"]');
      var target = document.querySelector('#audit');
      var full = document.querySelector('[data-audit-form] input[type="email"]');

      if (full && typed && typed.value) full.value = typed.value;
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (full) window.setTimeout(function () { full.focus({ preventScroll: true }); }, 500);
    };

    quick.addEventListener('submit', handoff);
    var quickCta = quick.querySelector('.btn');
    if (quickCta) quickCta.addEventListener('click', handoff);
  }

  /* --- Audit form -------------------------------------------------------- */
  /* No endpoint is wired up yet. Point `action` at your form handler
     (Tally, Formspree, a Netlify form, your own API) and delete this block. */

  var form = document.querySelector('[data-audit-form]');
  var status = document.querySelector('[data-form-status]');

  if (form && !form.getAttribute('action')) {
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (!status) return;
      status.textContent =
        'This form is not connected yet — set the form action to your handler to start receiving audits.';
    });
  }

  /* --- Footer year ------------------------------------------------------- */

  var year = document.querySelector('[data-year]');
  if (year) year.textContent = String(new Date().getFullYear());
})();
