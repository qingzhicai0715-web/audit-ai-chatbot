/*
 * Participant page logic. Condition is taken from the URL path: /a or /b
 * (or ?condition=A / ?condition=B as a fallback).
 *
 * Optional URL parameters:
 *   pid=...      participant / response ID to store with the log (PROLIFIC_PID also accepted)
 *   return=...   URL to send the participant to when they click Continue (e.g. your Qualtrics survey)
 *   test=1       pilot mode: nothing is logged
 */
(function () {
  'use strict';

  var C = window.STUDY_CONFIG;
  var params = new URLSearchParams(location.search);
  var pathMatch = location.pathname.match(/^\/(a|b)\/?$/i);
  var condParam = (params.get('condition') || '').toUpperCase();
  var COND = pathMatch ? pathMatch[1].toUpperCase() : condParam === 'A' || condParam === 'B' ? condParam : null;

  var $ = function (id) { return document.getElementById(id); };

  if (!COND) {
    document.querySelector('.app').hidden = true;
    $('error').hidden = false;
    return;
  }

  var PID = params.get('pid') || params.get('PROLIFIC_PID') || '';
  var RETURN_URL = safeUrl(params.get('return'));
  var TEST = params.get('test') === '1';
  var SID = makeId();
  var T0 = performance.now();

  var BOT_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M12 7V4.5"/><circle cx="12" cy="3.2" r="1.2"/><rect x="4" y="7" width="16" height="12" rx="4"/>' +
    '<path d="M9.5 12v1.6M14.5 12v1.6"/><path d="M2 12v3M22 12v3"/></svg>';

  var state = {
    sent: false,
    completeMs: null,
    displayed: false,
    clicked: false,
    clickLatencyMs: null,
  };

  // ---------- logging ----------

  function msSinceLoad() { return Math.round(performance.now() - T0); }

  function log(event, detail, useBeacon) {
    var payload = {
      session_id: SID,
      pid: PID,
      condition: COND,
      event: event,
      client_time: new Date().toISOString(),
      ms_since_load: msSinceLoad(),
      detail: detail || '',
    };

    // Lets a parent page (e.g. Qualtrics, if this is embedded in an iframe) listen for events.
    if (window.parent !== window) {
      try { window.parent.postMessage(Object.assign({ source: 'audit-ai-chatbot' }, payload), '*'); } catch (e) {}
    }

    if (TEST) return Promise.resolve();
    var body = JSON.stringify(payload);
    if (useBeacon && navigator.sendBeacon) {
      navigator.sendBeacon('/api/log', new Blob([body], { type: 'application/json' }));
      return Promise.resolve();
    }
    return fetch('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body,
      keepalive: true,
    }).catch(function () {});
  }

  // ---------- UI helpers ----------

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function scrollToEnd() {
    var chat = $('chat');
    chat.scrollTo({ top: chat.scrollHeight, behavior: 'smooth' });
  }

  function aiCard() {
    var card = el('section', 'msg-ai reveal');
    var head = el('div', 'msg-ai-head');
    var icon = el('span', 'bot-icon');
    icon.innerHTML = BOT_SVG;
    head.appendChild(icon);
    head.appendChild(el('span', '', C.assistantName));
    card.appendChild(head);
    $('chat').appendChild(card);
    return card;
  }

  function recommendationParagraph() {
    var p = el('p', 'rec reveal');
    p.appendChild(el('span', 'rec-label', C.recommendationLabel));
    p.appendChild(document.createTextNode(' ' + C.recommendationText));
    return p;
  }

  // ---------- flow ----------

  function init() {
    document.title = C.assistantName;
    $('assistant-name').textContent = C.assistantName;
    $('assistant-sub').textContent = C.assistantSubtitle || '';
    document.querySelector('.topbar .bot-icon').innerHTML = BOT_SVG;
    $('test-badge').hidden = !TEST;
    $('request').value = C.auditorRequest;
    fitComposer();
    window.addEventListener('resize', fitComposer);
    $('continue').textContent = C.continueButtonLabel;

    if (C.greeting) aiCard().appendChild(el('p', '', C.greeting));

    $('send').addEventListener('click', sendRequest);
    $('continue').addEventListener('click', goOn);

    document.addEventListener('visibilitychange', function () {
      log(document.visibilityState === 'hidden' ? 'tab_hidden' : 'tab_visible');
    });
    window.addEventListener('pagehide', function () { log('page_closed', '', true); });

    log('page_loaded', location.pathname);
    if (C.autoStart) setTimeout(sendRequest, 700);
  }

  function sendRequest() {
    if (state.sent) return;
    state.sent = true;
    log('request_sent');

    $('chat').appendChild(el('div', 'msg-user reveal', C.auditorRequest));
    $('request').value = '';
    $('request').style.height = '';
    window.removeEventListener('resize', fitComposer);
    $('request').placeholder = C.assistantName + ' is analysing…';
    $('send').disabled = true;
    $('composer').classList.add('locked');

    runProcessing();
    scrollToEnd();
  }

  function runProcessing() {
    var card = aiCard();
    var thinking = el('div', 'thinking');
    var dots = el('span', 'dots');
    dots.innerHTML = '<span></span><span></span><span></span>';
    thinking.appendChild(dots);
    thinking.appendChild(el('span', '', 'Analysing'));
    card.appendChild(thinking);

    var list = el('ul', 'steps');
    var items = C.processingSteps.map(function (text) {
      var li = el('li');
      li.appendChild(el('span', 'step-mark'));
      li.appendChild(el('span', '', text));
      list.appendChild(li);
      return li;
    });
    card.appendChild(list);

    var bar = el('div', 'progress');
    var fill = el('div');
    bar.appendChild(fill);
    card.appendChild(bar);

    var total = Math.max(1, Number(C.processingSeconds) || 8) * 1000;
    var start = Date.now();
    var timer = setInterval(function () {
      var elapsed = Date.now() - start;
      var frac = Math.min(1, elapsed / total);
      fill.style.width = (frac * 100).toFixed(1) + '%';
      var current = Math.min(items.length - 1, Math.floor(frac * items.length));
      items.forEach(function (li, i) {
        li.className = i < current || frac >= 1 ? 'done' : i === current ? 'active' : '';
      });
      if (frac >= 1) {
        clearInterval(timer);
        setTimeout(function () { finish(card); }, 400);
      }
    }, 100);
  }

  function finish(card) {
    // Replace the processing view with the completed message (same for both conditions).
    while (card.childNodes.length > 1) card.removeChild(card.lastChild);
    card.classList.remove('reveal');
    void card.offsetWidth; // restart the fade-in
    card.classList.add('reveal');
    card.appendChild(el('p', '', C.completeMessage));

    state.completeMs = msSinceLoad();
    log('processing_complete');

    if (COND === 'A') {
      // Condition A: recommendation appears automatically.
      card.appendChild(recommendationParagraph());
      state.displayed = true;
      log('recommendation_displayed', 'auto');
    } else {
      // Condition B: recommendation appears only after the auditor clicks.
      var holder = el('p');
      var btn = el('button', 'pill-btn', C.viewButtonLabel);
      btn.type = 'button';
      btn.addEventListener('click', function () {
        if (state.clicked) return;
        state.clicked = true;
        state.clickLatencyMs = msSinceLoad() - state.completeMs;
        log('view_button_clicked', String(state.clickLatencyMs));
        holder.replaceWith(recommendationParagraph());
        state.displayed = true;
        log('recommendation_displayed', 'click');
        scrollToEnd();
      });
      holder.appendChild(btn);
      card.appendChild(holder);
    }

    $('request').placeholder = 'The analysis is complete.';
    if (RETURN_URL) $('continue-bar').hidden = false;
    scrollToEnd();
  }

  function goOn() {
    var btn = $('continue');
    btn.disabled = true;
    var url = new URL(RETURN_URL);
    url.searchParams.set('ai_cond', COND);
    url.searchParams.set('ai_viewed', state.displayed ? '1' : '0');
    url.searchParams.set('ai_click_ms', COND === 'B' && state.clicked ? String(state.clickLatencyMs) : '');
    url.searchParams.set('ai_sid', SID);
    if (PID) url.searchParams.set('ai_pid', PID);
    var go = function () { location.href = url.toString(); };
    Promise.race([log('continue_clicked'), new Promise(function (r) { setTimeout(r, 800); })]).then(go, go);
  }

  // ---------- utilities ----------

  // Grow the message box so the whole pre-filled request is visible.
  function fitComposer() {
    var ta = $('request');
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
  }

  function safeUrl(raw) {
    if (!raw) return '';
    try {
      var u = new URL(raw);
      return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : '';
    } catch (e) {
      return '';
    }
  }

  function makeId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  init();
})();
