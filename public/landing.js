// Landing-page motion: animated chat preview, auto-cycling stages,
// scroll reveal and the "simple words" cards. Respects reduced motion.
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Buttons that open the assistant
  document.addEventListener('click', function (e) {
    var trigger = e.target.closest('[data-open-assistant]');
    if (trigger && window.LapaasAssistant) window.LapaasAssistant.open();
  });

  // Scroll reveal
  var revealEls = document.querySelectorAll('[data-reveal]');
  if (reduce || !('IntersectionObserver' in window)) {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add('in');
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.15 });
    revealEls.forEach(function (el) { io.observe(el); });
  }

  // Animated chat preview in the hero (loops)
  var log = document.getElementById('demo-log');
  if (log) {
    var steps = Array.prototype.slice.call(log.querySelectorAll('[data-step]'));
    if (reduce) {
      steps.slice(-3).forEach(function (s) { s.classList.add('show'); });
    } else {
      var typing = document.createElement('div');
      typing.className = 'd-typing';
      typing.innerHTML = '<i></i><i></i><i></i>';
      var i = 0;
      var tick = function () {
        if (i >= steps.length) {
          setTimeout(function () {
            steps.forEach(function (s) { s.classList.remove('show'); });
            i = 0;
            tick();
          }, 4200);
          return;
        }
        var step = steps[i];
        var isBot = !step.classList.contains('d-user');
        if (isBot) {
          log.insertBefore(typing, step);
          setTimeout(function () {
            if (typing.parentNode) typing.parentNode.removeChild(typing);
            step.classList.add('show');
            i++;
            setTimeout(tick, 700);
          }, 750);
        } else {
          step.classList.add('show');
          i++;
          setTimeout(tick, 650);
        }
      };
      setTimeout(tick, 500);
    }
  }

  // "What you build": highlight one stage at a time
  var grid = document.getElementById('stage-grid');
  if (grid && !reduce) {
    var stages = Array.prototype.slice.call(grid.querySelectorAll('.stage'));
    var ms = 3200;
    var current = 0;
    var paused = false;
    grid.style.setProperty('--stage-ms', ms + 'ms');
    var show = function (n) {
      stages.forEach(function (s, k) {
        s.classList.toggle('is-active', k === n);
      });
    };
    stages.forEach(function (s, k) {
      s.addEventListener('mouseenter', function () { paused = true; current = k; show(k); });
      s.addEventListener('mouseleave', function () { paused = false; });
    });
    setInterval(function () {
      if (paused || document.hidden) return;
      current = (current + 1) % stages.length;
      show(current);
    }, ms);
  }

  // "Simple words" cards from the same glossary the assistant uses
  var wordGrid = document.getElementById('word-grid');
  if (wordGrid) {
    var wanted = (wordGrid.getAttribute('data-terms') || '').split(',');
    fetch('/kb/glossary.json')
      .then(function (r) { return r.json(); })
      .then(function (g) {
        wanted.forEach(function (name) {
          var t = g.terms.filter(function (x) { return x.term === name; })[0];
          if (!t) return;
          var card = document.createElement('div');
          card.className = 'word';
          var b = document.createElement('b');
          b.textContent = t.term;
          var p = document.createElement('p');
          p.textContent = t.simple;
          card.appendChild(b);
          card.appendChild(p);
          wordGrid.appendChild(card);
        });
      })
      .catch(function () {
        wordGrid.textContent = 'Open the assistant: it explains these words inside its answers.';
      });
  }
})();
