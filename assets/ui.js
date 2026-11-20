// Service switcher (ARIA tabs). Progressive enhancement: without JS every panel is shown.
// Progressive enhancement only: without JS every panel is readable (hidden attribute is
// added here, not in the HTML).
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // C. "Pick what you need" switcher: ARIA tabs, arrow keys / Home / End, View Transitions when supported.
  document.querySelectorAll('[data-switcher]').forEach(function (root) {
    var tabs = Array.prototype.slice.call(root.querySelectorAll('[role="tab"]'));
    var panels = tabs.map(function (t) { return document.getElementById(t.getAttribute('aria-controls')); });
    var want = 0, first = true;
    function show(i, focus) {
      want = i;
      // Always apply the LATEST choice: with fast key presses an older transition's callback
      // can run after a newer one, so it must not use its own captured index.
      var apply = function () {
        var i = want;
        tabs.forEach(function (t, k) {
          var on = k === i;
          t.setAttribute('aria-selected', on ? 'true' : 'false');
          t.tabIndex = on ? 0 : -1;
          panels[k].hidden = !on;
        });
        root.setAttribute('data-active', tabs[i].dataset.key || String(i));
      };
      // First call (page load) applies directly: all panels are still visible then, and a transition would
      // capture several elements with the same view-transition-name and abort.
      if (document.startViewTransition && !reduce && !first) document.startViewTransition(apply); else apply();
      first = false;
      if (focus) tabs[i].focus();
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { show(i, false); });
      t.addEventListener('keydown', function (e) {
        var n = tabs.length, j = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % n;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + n) % n;
        else if (e.key === 'Home') j = 0;
        else if (e.key === 'End') j = n - 1;
        if (j !== null) { e.preventDefault(); show(j, true); }
      });
    });
    root.classList.add('is-enhanced');
    show(0, false);
  });

})();
