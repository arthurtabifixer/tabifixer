/* TABI FIXER — page behaviour: optional analytics, source tracking, inquiry form, mobile CTA.
 * Personal data is never put in URLs or analytics events. */
(function () {
  'use strict';
  var CFG = window.TABI_CONFIG || {};
  var EMAIL = CFG.CONTACT_EMAIL || 'arthur@tabifixer.com';

  /* ---------- analytics: loaded only if GA_MEASUREMENT_ID is set ---------- */
  var gaOn = /^G-[A-Z0-9]+$/.test(CFG.GA_MEASUREMENT_ID || '');
  if (gaOn) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', CFG.GA_MEASUREMENT_ID);
    var gs = document.createElement('script');
    gs.async = true;
    gs.src = 'https://www.googletagmanager.com/gtag/js?id=' + CFG.GA_MEASUREMENT_ID;
    document.head.appendChild(gs);
  }
  function track(name, params) {
    if (!gaOn) return;
    try { window.gtag('event', name, params || {}); } catch (e) {}
  }

  /* ---------- source / referral ----------
   * First touch of the browser session only (sessionStorage; cleared when the tab closes).
   * Only these keys are kept: utm_source/medium/campaign/content/term, ref,
   * the referring site's host name, and the landing page PATH (no query string). */
  var SRC_KEY = 'tf_source_v2';
  var UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  function token(v) { v = String(v || '').trim().slice(0, 100); return /^[A-Za-z0-9._\- ]+$/.test(v) ? v : ''; }
  function code(v) { v = String(v || '').trim().slice(0, 40); return /^[A-Za-z0-9_-]+$/.test(v) ? v : ''; }
  function readSource() {
    try {
      var stored = JSON.parse(sessionStorage.getItem(SRC_KEY) || 'null');
      if (stored) return stored;
    } catch (e) {}
    var qs = new URLSearchParams(location.search);
    var s = { ref: code(qs.get('ref')), referrer_host: '', landing_path: location.pathname.slice(0, 100) };
    UTM.forEach(function (k) { s[k] = token(qs.get(k)); });
    try {
      if (document.referrer) {
        var h = new URL(document.referrer).hostname;
        if (h && h !== location.hostname) s.referrer_host = h;
      }
    } catch (e) {}
    try { sessionStorage.setItem(SRC_KEY, JSON.stringify(s)); } catch (e) {}
    return s;
  }
  var source = readSource();

  /* ---------- free call link (only if a real one is configured) ---------- */
  document.querySelectorAll('[data-free-call]').forEach(function (el) {
    var a = el.querySelector('a');
    if (CFG.FREE_CALL_URL && a) { a.href = CFG.FREE_CALL_URL; el.hidden = false; }
  });
  document.querySelectorAll('[data-free-call-fallback]').forEach(function (el) { el.hidden = !!CFG.FREE_CALL_URL; });

  /* ---------- CTA clicks (a click is NOT an inquiry) ---------- */
  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-cta]');
    if (!a) return;
    track('cta_click', { cta_id: a.getAttribute('data-cta') });
    var plan = a.getAttribute('data-plan');
    if (plan) { var sel = document.getElementById('f-plan'); if (sel) sel.value = plan; }
    if (a.hasAttribute('data-want-call')) {
      var cb = document.querySelector('input[name="wants_free_call"]');
      if (cb) cb.checked = true;
    }
  });

  /* ---------- inquiry form ---------- */
  var form = document.getElementById('inquiry-form');
  if (form) setupForm(form);

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    var b = new Uint8Array(16); crypto.getRandomValues(b);
    b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    var h = Array.prototype.map.call(b, function (x) { return (x + 256).toString(16).slice(1); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }

  function setupForm(form) {
    var status = document.getElementById('form-status');
    var btn = form.querySelector('button[type="submit"]');
    var success = document.getElementById('form-success');
    var copyBtn = document.getElementById('copy-details');
    var startedAt = Date.now();
    var submissionId = uuid();
    var lastSentContent = null;   // content of the last attempt with this id
    var sending = false, started = false;

    var undecidedDate = document.getElementById('f-dates-undecided');
    var dates = document.getElementById('f-dates');
    if (undecidedDate) undecidedDate.addEventListener('change', function () {
      dates.disabled = undecidedDate.checked;
      if (undecidedDate.checked) { dates.value = ''; clearError(dates); }
    });

    // Pre-fill the referral code from the link (the visitor can edit it; both are stored separately).
    var refInput = document.getElementById('f-ref');
    if (refInput && source.ref && !refInput.value) refInput.value = source.ref;

    form.addEventListener('input', function (e) {
      if (!started) { started = true; track('form_start', { form_id: 'inquiry' }); }
      if (e.target.getAttribute('aria-invalid') === 'true') validateField(e.target);
    });

    var rules = {
      name: function (v) { return v.trim() ? '' : 'Please enter your name.'; },
      email: function (v) {
        if (!v.trim()) return 'Please enter your email address.';
        return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'Please check your email address.';
      },
      days: function (v) { return !v || (/^\d+$/.test(v) && +v >= 1 && +v <= 60) ? '' : 'Enter a number from 1 to 60.'; },
      travelers: function (v) { return !v || (/^\d+$/.test(v) && +v >= 1 && +v <= 30) ? '' : 'Enter a number from 1 to 30.'; },
      message: function (v) { return v.trim() ? '' : 'Please tell me a little about your trip.'; },
      ref: function (v) { return !v || /^[A-Za-z0-9_-]{1,40}$/.test(v.trim()) ? '' : 'Letters, numbers, - and _ only.'; },
      privacy: function (_, el) { return el.checked ? '' : 'Please confirm you have read the Privacy Policy.'; }
    };
    function errEl(el) { return document.getElementById(el.id + '-error'); }
    function clearError(el) {
      el.removeAttribute('aria-invalid');
      var e = errEl(el); if (e) { e.textContent = ''; e.hidden = true; }
    }
    function validateField(el) {
      var rule = rules[el.name];
      if (!rule || el.disabled) return true;
      var msg = rule(el.value || '', el);
      var e = errEl(el);
      if (msg) {
        el.setAttribute('aria-invalid', 'true');
        if (e) { e.textContent = msg; e.hidden = false; }
        return false;
      }
      clearError(el);
      return true;
    }

    function fields() {
      var fd = new FormData(form);
      var g = function (k) { return String(fd.get(k) || '').trim(); };
      return {
        name: g('name'), email: g('email'),
        travel_dates: undecidedDate && undecidedDate.checked ? 'undecided' : g('travel_dates'),
        days: g('days'), travelers: g('travelers'), cities: g('cities'),
        plan: g('plan') || 'undecided', message: g('message'),
        wants_free_call: fd.get('wants_free_call') ? 'yes' : 'no',
        ref: g('ref'), privacy_ack: fd.get('privacy') ? 'yes' : 'no',
        website: g('website')   // honeypot — must stay empty
      };
    }

    // status messages are built from fixed text + DOM nodes (no user input as HTML)
    function showStatus(parts) {
      status.className = 'form-status error';
      status.textContent = '';
      parts.forEach(function (p) {
        if (p === '@email') {
          var a = document.createElement('a'); a.href = 'mailto:' + EMAIL; a.textContent = EMAIL; status.appendChild(a);
        } else status.appendChild(document.createTextNode(p));
      });
      status.hidden = false;
    }

    function detailsText(d) {
      return ['Name: ' + d.name, 'Email: ' + d.email, 'Travel dates: ' + (d.travel_dates || '-'),
        'Days: ' + (d.days || '-'), 'Travelers: ' + (d.travelers || '-'), 'Cities: ' + (d.cities || '-'),
        'Plan: ' + d.plan, 'Free 15-min call first: ' + d.wants_free_call,
        'Referral code: ' + (d.ref || '-'), '', d.message].join('\n');
    }
    if (copyBtn) copyBtn.addEventListener('click', function () {
      if (navigator.clipboard) navigator.clipboard.writeText(detailsText(fields())).then(function () { copyBtn.textContent = 'Copied'; }, function () {});
    });

    function finish(label) {
      sending = false;
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
      btn.textContent = label;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (sending) return;                                   // double-click guard
      var firstBad = null;
      form.querySelectorAll('input[name], textarea[name], select[name]').forEach(function (el) {
        if (!validateField(el) && !firstBad) firstBad = el;
      });
      if (firstBad) {
        showStatus(['Please check the highlighted fields.']);
        firstBad.focus();
        track('form_error', { form_id: 'inquiry', reason: 'validation' });
        return;
      }

      var f = fields();
      if (!CFG.FORM_ENDPOINT) {
        showStatus(['The online form isn’t connected yet, so this message was NOT sent. Please email ', '@email',
          '. Your details are still in the form — you can copy them into your email.']);
        if (copyBtn) copyBtn.hidden = false;
        track('form_error', { form_id: 'inquiry', reason: 'not_configured' });
        return;
      }

      // Same id only while the content is unchanged; edited content = a new submission.
      var content = JSON.stringify(f);
      if (lastSentContent !== null && content !== lastSentContent) submissionId = uuid();
      lastSentContent = content;

      var payload = Object.assign({ submission_id: submissionId, elapsed_ms: Date.now() - startedAt, source: source }, f);
      var replyTo = f.email;

      sending = true;
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
      var label = btn.textContent;
      btn.textContent = 'Sending…';
      status.hidden = true;

      var ctrl = window.AbortController ? new AbortController() : null;
      var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 25000);

      // text/plain body = "simple" request (no CORS preflight). Apps Script answers with a
      // redirect to googleusercontent.com, which fetch follows. If the answer can't be read
      // (network/CORS/HTML login page), it is treated as NOT sent.
      fetch(CFG.FORM_ENDPOINT, {
        method: 'POST', body: JSON.stringify(payload), redirect: 'follow', credentials: 'omit',
        signal: ctrl ? ctrl.signal : undefined
      })
        .then(function (r) {
          if (!r.ok) throw { kind: 'http' };
          return r.json().catch(function () { throw { kind: 'unreadable' }; });
        })
        .then(function (res) {
          clearTimeout(timer);
          if (res && res.ok === true && typeof res.receipt_no === 'string' && /^TF-\d{6}-[0-9A-F]{6}$/.test(res.receipt_no)) {
            track('generate_lead', { form_id: 'inquiry', plan: f.plan, has_ref: f.ref ? 'yes' : 'no' });
            document.getElementById('success-receipt').textContent = res.receipt_no;
            document.getElementById('success-email').textContent = replyTo;
            form.hidden = true;
            success.hidden = false;
            success.focus();
            return;
          }
          var err = (res && res.error) || 'unknown';
          if (err === 'conflict') {
            // An earlier version with this id was already received. Send the edited one as new.
            submissionId = uuid(); lastSentContent = null;
            showStatus(['An earlier version of this message was already received. Your edited version has NOT been sent yet — press Send again to send it as a new message.']);
          } else if (err === 'invalid') {
            (res.fields || []).forEach(function (n) {
              var el = form.elements[n]; if (el && el.setAttribute) el.setAttribute('aria-invalid', 'true');
            });
            showStatus(['Please check the highlighted fields and press Send again.']);
          } else if (err === 'busy') {
            // Not received yet, not refused either: same content → same submission id on the next try.
            showStatus(['The form is busy right now. Your details are still here — please wait a moment and press Send again (it won’t create a duplicate). If it keeps happening, email ', '@email', '.']);
          } else if (err === 'rate_limited') {
            showStatus(['Too many messages in a short time. Please wait about 10 minutes and press Send again, or email ', '@email', '.']);
          } else {
            showStatus(['Sorry — your message was NOT sent. Your details are still here — please press Send again, or email ', '@email', '.']);
          }
          track('form_error', { form_id: 'inquiry', reason: err });
        })
        .catch(function () {
          clearTimeout(timer);
          showStatus(['Sorry — we could not confirm that your message was received (connection problem). Your details are still here — please press Send again (it won’t create a duplicate), or email ', '@email', '.']);
          track('form_error', { form_id: 'inquiry', reason: 'network' });
        })
        .then(function () { finish(label); });
    });
  }

  /* ---------- one mobile CTA, hidden near the form and while typing ---------- */
  var bar = document.getElementById('mobile-cta');
  if (bar) {
    var contact = document.getElementById('contact');
    var hero = document.querySelector('.hero');
    var contactVisible = false, pastHero = false, typing = false;
    var update = function () { bar.hidden = !(pastHero && !contactVisible && !typing); };
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { contactVisible = en[0].isIntersecting; update(); }).observe(contact);
      new IntersectionObserver(function (en) { pastHero = !en[0].isIntersecting; update(); }).observe(hero);
    }
    document.addEventListener('focusin', function (e) {
      if (e.target.matches('input, textarea, select')) { typing = true; update(); }
    });
    document.addEventListener('focusout', function () { typing = false; setTimeout(update, 150); });
  }
})();
