// Tag the book's recurring ritual blocks so the stylesheet can render them as
// distinct cards: the emoji-led callouts (Instinct check / In the room / Trap),
// the "Say it in 60 seconds" performance block, the "Numbers to keep" list, and
// the Interviewer/You pushback dialogue.
(function () {
  var main = document.querySelector('.content main');
  if (!main) return;

  // 1. Emoji-led blockquote callouts.
  main.querySelectorAll('blockquote').forEach(function (bq) {
    var t = (bq.textContent || '').trim();
    if (/^⚡/.test(t) || /^Instinct check/i.test(t)) bq.classList.add('callout-instinct');
    else if (/^🎯/.test(t) || /^In the room/i.test(t)) bq.classList.add('callout-room');
    else if (/^⚠/.test(t) || /^Trap/i.test(t)) bq.classList.add('callout-trap');
    else if (/^🧮/.test(t) || /^Worked example/i.test(t)) bq.classList.add('callout-worked');
  });

  // 2. Section-based cards: tag an <h2> and the block that immediately follows.
  main.querySelectorAll('h2').forEach(function (h) {
    var label = (h.textContent || '').replace(/[#\s]+$/, '').trim();
    if (/^Say it in 60 seconds/i.test(label)) {
      h.classList.add('sec-say60');
      var n = h.nextElementSibling;
      if (n && n.tagName === 'BLOCKQUOTE') n.classList.add('say60');
    } else if (/^Numbers to keep/i.test(label)) {
      h.classList.add('sec-numbers');
      var el = h.nextElementSibling;
      if (el && (el.tagName === 'UL' || el.tagName === 'OL')) el.classList.add('numbers');
    } else if (/^The pushback round/i.test(label)) {
      h.classList.add('sec-pushback');
    }
  });

  // 3. Interviewer / You dialogue in the pushback round.
  main.querySelectorAll('p').forEach(function (p) {
    var s = p.querySelector('strong');
    if (!s) return;
    var lead = s.textContent.trim();
    if (/^Interviewer/i.test(lead)) p.classList.add('dialogue-q');
    else if (/^You\b/i.test(lead)) p.classList.add('dialogue-a');
  });
})();
