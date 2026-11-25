import { toCanvas } from 'qrcode';

// Adaptasi template undangan lama. Markup dirender Next.js; perilaku DOM
// ini dibatasi pada satu instance undangan dan dibersihkan saat navigasi.
/**
 * @param {HTMLElement} root
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 * @param {string} routeToken
 * @param {boolean} preview
 */
export function mountInvitation(root, sb, routeToken, preview) {
  const { body, documentElement } = document;
  const previousTitle = document.title;
  const abort = new AbortController();
  const { signal } = abort;
  const timers = new Set();
  let channel;
  let bannerObserver;
  const rpc = (name, args) => sb.rpc(name, args).abortSignal(signal);
  const listen = (target, event, handler) => target.addEventListener(event, handler, { signal });
  const schedule = (fn, delay) => {
    if (signal.aborted) return;
    const id = window.setTimeout(() => { timers.delete(id); if (!signal.aborted) fn(); }, delay);
    timers.add(id);
    return id;
  };
  const repeat = (fn, delay) => {
    const id = window.setInterval(() => { if (!signal.aborted) fn(); }, delay);
    timers.add(id);
    return id;
  };
  const frame = (fn) => { if (!signal.aborted) requestAnimationFrame(t => { if (!signal.aborted) fn(t); }); };
  body.classList.add('locked');

  // Daftar rekening amplop digital (silakan tambah / ubah). "atasNama" kosong = pakai nama mempelai.
  const GIFTS = [
    { bank: "Bank BCA", nomor: "1234567890", atasNama: "" }
  ];

  const QUICK_WISHES = [
    "Selamat menempuh hidup baru! Semoga sakinah, mawaddah, warahmah 🤍",
    "Barakallahu lakuma wa baraka alaikuma wa jama’a bainakuma fi khair.",
    "Semoga lancar sampai hari H dan bahagia selamanya!",
    "Mohon maaf belum bisa hadir. Doa terbaik untuk kalian berdua 🤲"
  ];

  const MAX_WISH = 300;
  const WISH_PAGE = 6;

  /* ==========================================================
     STATE & HELPER
     ========================================================== */
  const $ = (id) => root.querySelector('#' + id);
  const S = {
    guest: null, guestId: null, eventId: null,
    status: null, pax: 1, max: 2, checked: false, editing: false,
    summary: null, wishes: [], filter: 'all', shown: WISH_PAGE, seen: new Set(), firstLoad: true,
    eventDate: null, clientName: '', ticketReady: false, sending: false
  };

  const ICON = {
    check: '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.500 6.300l2.400 2.400 4.600-5"/></svg>',
    x: '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 3l6 6M9 3L3 9"/></svg>',
    clock: '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.700" stroke-linecap="round"><circle cx="6" cy="6" r="4.500"/><path d="M6 3.600V6l1.600 1"/></svg>',
    copy: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.700" stroke-linecap="round" stroke-linejoin="round"><rect x="5.500" y="5.500" width="8" height="8" rx="2"/><path d="M10.500 5.500V4A1.500 1.500 0 009 2.500H4A1.500 1.500 0 002.500 4v5A1.500 1.500 0 004 10.500h1.500"/></svg>'
  };

  function cleanToken(str) {
    if (!str) return '';
    return String(str).trim().toLowerCase()
      .replace(/[​-‍﻿]/g, '')
      .replace(/[‐-―−]/g, '-');
  }
  const query = new URLSearchParams(window.location.search);
  const token = cleanToken(query.get('token') || routeToken);
  // Pratinjau memakai token acara, bukan token tamu.
  const IS_PREVIEW = preview || query.get('preview') === '1';

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const initial = (s) => (String(s || '?').trim().match(/[A-Za-z0-9À-ɏ]/) || ['?'])[0].toUpperCase();
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = schedule(() => fn(...a), ms); }; };

  function toast(msg, type) {
    const el = document.createElement('div');
    el.className = 'toast' + (type === 'err' ? ' err' : '');
    el.textContent = msg;
    $('toast-host').appendChild(el);
    schedule(() => { el.classList.add('out'); schedule(() => el.remove(), 320); }, 3200);
  }

  function relTime(iso) {
    if (!iso) return '';
    const d = new Date(iso).getTime();
    if (isNaN(d)) return '';
    const s = Math.max(1, Math.floor((Date.now() - d) / 1000));
    if (s < 60) return 'Baru saja';
    const m = Math.floor(s / 60); if (m < 60) return m + ' menit lalu';
    const h = Math.floor(m / 60); if (h < 24) return h + ' jam lalu';
    const dd = Math.floor(h / 24); if (dd < 7) return dd + ' hari lalu';
    return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function statusMeta(s) {
    if (s === 'hadir') return { key: 'hadir', cls: 'st-yes', label: 'Hadir', icon: ICON.check };
    if (s === 'tidak_hadir') return { key: 'tidak', cls: 'st-no', label: 'Tidak Hadir', icon: ICON.x };
    return { key: 'belum', cls: 'st-none', label: 'Belum Konfirmasi', icon: ICON.clock };
  }
  function badgeHTML(s) { const m = statusMeta(s); return `${m.icon}${m.label}`; }

  function countUp(el, to, dur = 1100, suffix = '') {
    const from = parseInt(el.dataset.v || '0', 10) || 0;
    el.dataset.v = to;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || from === to) { el.textContent = to + suffix; return; }
    const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(from + (to - from) * e) + suffix;
      if (p < 1) frame(tick);
    };
    frame(tick);
  }

  /* ==========================================================
     DATA (Supabase): akses lewat RPC
     ========================================================== */
  async function fetchGuest() {
    try {
      // Pratinjau: token acara, tamu palsu ("Nama Tamu"). Undangan: token tamu.
      const name = IS_PREVIEW ? 'get_event_preview' : 'get_invitation_details';
      const { data, error } = await rpc(name, { p_token: token });
      const row = Array.isArray(data) ? data[0] : data;
      if (!error && row) {
        try {
          const { data: mapsUrl } = await rpc('get_event_maps_url', { p_token: token, p_preview: IS_PREVIEW });
          return { ...row, maps_url: mapsUrl };
        } catch { return row; }
      }
    } catch { /* Tampilkan pesan tidak ditemukan. */ }
    return null;
  }

  function ensureIds(g) {
    S.guestId = g.guest_id || g.id || null;
    S.eventId = g.event_id || null;
  }

  // Ringkasan RSVP seluruh tamu pada acara ini (dipakai untuk statistik + indikator status di tiap ucapan)
  async function loadSummary() {
    try {
      const { data, error } = await rpc('get_event_rsvp_summary', { p_token: token });
      if (signal.aborted || error || !data) return;
      const byId = new Map(), byName = new Map();
      let yes = 0, no = 0, pax = 0; const yesNames = [];
      data.forEach(row => {
        const st = row.rsvp_status || null;
        byName.set(norm(row.guest_name), st);
        if (st === 'hadir') { yes++; pax += (row.pax_confirmed || 1); yesNames.push(row.guest_name); }
        else if (st === 'tidak_hadir') no++;
      });
      S.summary = { byId, byName, total: data.length, yes, no, pax, yesNames };
      renderStats(); renderWishes();
    } catch { /* Indikator tetap tampil untuk tamu ini. */ }
  }

  async function fetchWishes() {
    let list = [];
    try {
      const r = await rpc('get_event_wishes', { p_token: token });
      if (!r.error && Array.isArray(r.data)) list = r.data;
    } catch { /* Daftar ucapan boleh kosong. */ }
    list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    return list;
  }

  async function loadWishes() {
    S.wishes = await fetchWishes();
    if (!signal.aborted) renderWishes();
  }
  const loadWishesSoon = debounce(loadWishes, 600);
  const loadSummarySoon = debounce(loadSummary, 800);

  /* ==========================================================
     RENDER: UNDANGAN
     ========================================================== */
  function splitNames(n) {
    const p = String(n || '').split(/\s*(?:&|\bdan\b|\band\b)\s*/i).filter(Boolean);
    return p.length >= 2 ? [p[0], p[1]] : [p[0] || 'Mempelai', ''];
  }

  function renderInvitation(g) {
    S.guest = g;
    S.eventDate = g.event_date ? new Date(g.event_date) : null;
    // Jam acara = jam sesi tamu (mis. "10.00 WIB"); tanggal tetap dari event_date
    const tm = /(\d{1,2})[.:](\d{2})/.exec(g.session_time || '');
    if (S.eventDate && !isNaN(S.eventDate) && tm && +tm[1] < 24 && +tm[2] < 60) {
      const ymd = S.eventDate.toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });
      S.eventDate = new Date(`${ymd}T${tm[1].padStart(2, '0')}:${tm[2]}:00+07:00`);
    }
    S.clientName = g.client_name || 'Mempelai';
    S.max = Math.max(1, parseInt(g.max_pax || 2, 10));
    S.status = g.rsvp_status || null;
    S.pax = g.pax_confirmed || (S.status === 'hadir' ? S.max : Math.min(S.max, 2));
    if (S.pax < 1) S.pax = 1;
    S.checked = !!g.is_checked_in;

    document.title = `Undangan ${S.clientName}`;
    root.querySelectorAll('.bn').forEach(e => e.textContent = S.clientName);

    // Cover
    $('cv-brand').textContent = 'Undangan Pernikahan';
    $('cv-title').textContent = S.clientName;
    $('cv-guest').textContent = g.group_name || 'Tamu Undangan';
    $('cv-pax').textContent = `Undangan untuk ${S.max} orang`;

    // Isi
    const [n1, n2] = splitNames(S.clientName);
    $('couple-names').textContent = S.clientName;
    $('couple-circles').innerHTML = n2
      ? `<div class="mono c1">${esc(initial(n1))}</div><div class="mono amp">&amp;</div><div class="mono c2">${esc(initial(n2))}</div>`
      : `<div class="mono c1">${esc(initial(n1))}</div>`;
    if (g.event_caption) $('event-caption').textContent = g.event_caption;
    $('footer-client-name').textContent = S.clientName;

    if (S.eventDate && !isNaN(S.eventDate)) {
      const tz = 'Asia/Jakarta';
      $('event-date').textContent = S.eventDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: tz });

      // Jadwal: semua sesi ditampilkan, sesi tamu ini ditandai.
      const sess = Array.isArray(g.sessions) ? g.sessions : [];
      if (sess.length) {
        $('event-sessions').innerHTML = sess.map(s => {
          const mine = s.name === g.session_name;
          return `<div class="wsess${mine ? ' on' : ''}">
            <span>${esc(s.name)}${mine ? ' <small>undangan Anda</small>' : ''}</span>
            <b>${esc(s.time_text || '—')}</b>
          </div>`;
        }).join('');
      } else {
        $('event-sessions').innerHTML = g.session_time
          ? `<div class="wsess on"><span>${esc(g.session_name || 'Acara')}</span><b>${esc(g.session_time)}</b></div>`
          : `<div class="wsess on"><span>Acara</span><b>Pukul ${S.eventDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz }).replace(':', '.')} WIB</b></div>`;
      }
    } else {
      $('event-date').textContent = 'Segera diumumkan';
      $('event-sessions').hidden = true;
      $('cal-btn').hidden = true;
    }
    $('event-location').textContent = g.event_location || '';
    const mapsUrl = typeof g.maps_url === 'string' ? g.maps_url
      : g.event_location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(g.event_location)}` : '';
    const mapsButton = $('maps-btn');
    mapsButton.hidden = true;
    try {
      const link = new URL(mapsUrl);
      if (['http:', 'https:'].includes(link.protocol) && !link.username && !link.password) {
        mapsButton.href = link.href;
        mapsButton.hidden = false;
      }
    } catch { /* Tidak ada tautan lokasi yang dapat dibuka. */ }

    // RSVP: identitas
    $('rsvp-guest-name').textContent = g.group_name || 'Tamu Undangan';
    $('rsvp-guest-sub').textContent = S.max > 1 ? `Undangan untuk maksimal ${S.max} orang` : 'Undangan untuk 1 orang';
    $('w-name').textContent = g.group_name || 'Tamu Undangan';
    $('pax-hint').textContent = `Maksimal ${S.max} orang, termasuk Anda.`;

    // Gift
    renderGifts();
    // Quick wishes
    $('quick').innerHTML = QUICK_WISHES.map((t, i) => `<button type="button" data-i="${i}">${esc(t.length > 34 ? t.slice(0, 32) + '…' : t)}</button>`).join('');

    applyRsvpUI();
    startCountdown();

    $('loading').hidden = true;
    $('main-content').hidden = false;
  }

  function renderGifts() {
    $('gift-list').innerHTML = GIFTS.map((g, i) => `
      <div class="gift rv">
        <div class="bank"><span>${esc(g.bank)}</span>
          <button class="copy-btn" type="button" data-i="${i}">${ICON.copy}<span>Salin</span></button></div>
        <div class="no">${esc(g.nomor)}</div>
        <p class="an">a.n. ${esc(g.atasNama || S.clientName)}</p>
      </div>`).join('');
    observeReveals();
  }

  /* ==========================================================
     COVER
     ========================================================== */
  function openInvitation() {
    const c = $('cover');
    c.classList.add('gone');
    document.body.classList.remove('locked');
    schedule(() => { c.hidden = true; }, 950);
    observeReveals();
  }

  /* ==========================================================
     COUNTDOWN, KALENDER
     ========================================================== */
  let cdTimer = null;
  function startCountdown() {
    if (cdTimer) clearInterval(cdTimer);
    const tick = () => {
      if (!S.eventDate || isNaN(S.eventDate)) { $('countdown').hidden = true; return; }
      const d = S.eventDate.getTime() - Date.now();
      if (d <= 0) {
        $('countdown').hidden = true; $('cd-note').hidden = false;
        $('cd-note').textContent = (Date.now() - S.eventDate.getTime() < 864e5) ? 'Hari bahagia sedang berlangsung ✦' : 'Acara telah selesai. Terima kasih atas doanya ✦';
        clearInterval(cdTimer); return;
      }
      $('cd-days').textContent = Math.floor(d / 864e5);
      $('cd-hours').textContent = Math.floor(d % 864e5 / 36e5);
      $('cd-mins').textContent = Math.floor(d % 36e5 / 6e4);
      $('cd-secs').textContent = Math.floor(d % 6e4 / 1e3);
    };
    cdTimer = repeat(tick, 1000); tick();
  }

  function saveToCalendar() {
    if (!S.eventDate) return;
    const fmt = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const end = new Date(S.eventDate.getTime() + 3 * 36e5);
    const t = (s) => String(s || '').replace(/([,;])/g, '\\$1').replace(/\n/g, '\\n');
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//RayaRayu//Undangan//ID', 'BEGIN:VEVENT',
      `UID:${token}@rayarayu`, `DTSTAMP:${fmt(new Date())}`, `DTSTART:${fmt(S.eventDate)}`, `DTEND:${fmt(end)}`,
      `SUMMARY:${t('Pernikahan ' + S.clientName)}`, `LOCATION:${t(S.guest.event_location)}`,
      `DESCRIPTION:${t('Undangan pernikahan ' + S.clientName)}`,
      'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', 'DESCRIPTION:Besok hari bahagia', 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const a = document.createElement('a');
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    a.href = url;
    a.download = 'undangan-pernikahan.ics';
    document.body.appendChild(a); a.click(); a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Acara disimpan ke kalender');
  }

  /* ==========================================================
     RSVP
     ========================================================== */
  function setChoice(v) {
    root.querySelectorAll('input[name="attend"]').forEach(r => r.checked = (r.value === v));
    $('pax-wrap').classList.toggle('open', v === 'hadir' && S.max > 1);
    $('rsvp-submit').textContent = v === 'hadir' ? 'Konfirmasi Hadir' : v === 'tidak_hadir' ? 'Kirim Konfirmasi' : 'Kirim Konfirmasi';
  }
  function renderPax() {
    $('pax-val').textContent = S.pax;
    $('pax-minus').disabled = S.pax <= 1;
    $('pax-plus').disabled = S.pax >= S.max;
  }

  // Menyatukan semua tampilan yang bergantung pada status RSVP tamu
  function applyRsvpUI() {
    const m = statusMeta(S.status);
    const name = S.guest.group_name || 'Tamu';
    ['rsvp', 'w'].forEach(p => {
      $(p + '-avatar').className = 'avatar ' + m.cls;
      $(p + '-dot').className = 'dot ' + m.cls;
      $(p + '-initial').textContent = initial(name);
    });
    $('w-badge').className = 'badge ' + m.cls;
    $('w-badge').innerHTML = badgeHTML(S.status);

    const answered = !!S.status && !S.editing;
    $('rsvp-form').hidden = answered;
    $('rsvp-summary').hidden = !answered;

    if (answered) {
      $('sum-badge').className = 'badge ' + m.cls;
      $('sum-badge').innerHTML = badgeHTML(S.status);
      if (S.status === 'hadir') {
        $('sum-title').textContent = `Sampai jumpa, ${S.pax} orang akan hadir`;
        $('sum-sub').textContent = 'Tiket QR Anda ada di bagian bawah. Simpan atau tunjukkan saat tiba.';
      } else {
        $('sum-title').textContent = 'Terima kasih sudah memberi kabar';
        $('sum-sub').textContent = 'Anda tetap bisa mengirim ucapan dan doa di bawah.';
      }
      $('rsvp-edit').hidden = S.checked;
      if (S.checked) $('sum-sub').textContent = 'Anda sudah check-in di lokasi. Selamat menikmati acara!';
    } else {
      setChoice(S.status || '');
      renderPax();
    }

    // Tiket
    if (S.status === 'hadir') showTicket(false); else { $('ticket-section').hidden = true; }
    updateTicketStatus();
    renderWishes();
  }

  async function submitRsvp(status, pax) {
    try {
      const { data, error } = await rpc('submit_rsvp', { p_invitation_token: token, p_status: status, p_pax: pax });
      return !error && !!data && data.success === true;
    } catch { return false; }
  }

  /* ==========================================================
     TIKET: amplop + QR
     ========================================================== */
  function ticketCode() { return cleanToken(S.guest.invitation_token || token); }

  function buildQR() {
    if (S.ticketReady) return;
    const box = $('qrcode'); box.innerHTML = '';
    try {
      const canvas = document.createElement('canvas');
      box.appendChild(canvas);
      S.ticketReady = true;
      void toCanvas(canvas, ticketCode(), { width: 146, errorCorrectionLevel: 'H' }).catch(() => {
        if (!signal.aborted) box.textContent = ticketCode();
        S.ticketReady = false;
      });
    } catch { box.textContent = ticketCode(); }
    $('ticket-token-label').textContent = 'Kode: ' + ticketCode();
  }

  let stageIO = null;
  function showTicket(animate) {
    const sec = $('ticket-section');
    const wasHidden = sec.hidden;
    sec.hidden = false;
    buildQR();
    $('t-name').textContent = S.guest.group_name || 'Tamu Undangan';
    $('t-pax').textContent = `${S.pax} orang`;

    const stage = $('stage');
    if (animate) {
      stage.classList.remove('open'); stage.setAttribute('aria-expanded', 'false');
      schedule(() => sec.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
      schedule(() => setEnvelope(true), 1100);
    } else if (wasHidden || !stageIO) {
      // buka otomatis saat tiket terlihat di layar
      if (stageIO) stageIO.disconnect();
      if ('IntersectionObserver' in window) {
        stageIO = new IntersectionObserver((es) => {
          if (es[0].isIntersecting) { schedule(() => setEnvelope(true), 450); stageIO.disconnect(); }
        }, { threshold: .6 });
        stageIO.observe(stage);
      } else setEnvelope(true);
    }
  }
  function setEnvelope(open) {
    const st = $('stage');
    st.classList.toggle('open', open);
    st.setAttribute('aria-expanded', String(open));
  }

  function updateTicketStatus() {
    const el = $('ticket-status');
    el.classList.toggle('ok', S.checked);
    $('ticket-status-text').textContent = S.checked ? 'Sudah check-in di lokasi' : 'Belum check-in';
    if (S.checked) el.querySelector('.pulse').style.animation = 'none';
  }

  function onCheckedIn() {
    if (signal.aborted || S.checked) return;
    S.checked = true; updateTicketStatus(); applyRsvpUI();
    toast('Check-in berhasil. Selamat menikmati acara! 🎉');
  }

  // Cek berkala apakah petugas sudah memindai QR
  repeat(async () => {
    if (S.status !== 'hadir' || S.checked || document.hidden || $('ticket-section').hidden) return;
    const g = await fetchGuest();
    if (g?.is_checked_in) onCheckedIn();
  }, 12000);

  async function downloadTicket() {
    const qrEl = $('qrcode').querySelector('canvas') || $('qrcode').querySelector('img');
    const W = 720, H = 980;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    try { await document.fonts.ready; } catch { /* Gunakan font cadangan. */ }
    if (signal.aborted || !x) return;
    x.fillStyle = '#0B0B0B'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#EAEAEA';
    const roundedRect = (left, top, width, height, radius) => {
      x.beginPath();
      if (x.roundRect) x.roundRect(left, top, width, height, radius);
      else x.rect(left, top, width, height);
      x.fill();
    };
    roundedRect(50, 50, W - 100, H - 100, 40);
    x.fillStyle = '#0B0B0B'; x.textAlign = 'center';
    x.font = '600 26px "Instrument Sans Variable", sans-serif'; x.fillText('TIKET MASUK', W / 2, 135);
    x.font = '64px "Instrument Serif", serif'; x.fillText(S.clientName, W / 2, 215);
    x.fillStyle = '#fff'; roundedRect(160, 270, 400, 400, 28);
    x.strokeStyle = '#0B0B0B'; x.lineWidth = 3; x.stroke();
    if (qrEl) x.drawImage(qrEl, 190, 300, 340, 340);
    x.fillStyle = '#0B0B0B'; x.font = '60px "Instrument Serif", serif';
    let nm = S.guest.group_name || 'Tamu'; while (x.measureText(nm).width > 560 && nm.length > 4) nm = nm.slice(0, -2);
    x.fillText(nm === (S.guest.group_name || 'Tamu') ? nm : nm + '…', W / 2, 750);
    x.font = '500 28px "Instrument Sans Variable", sans-serif'; x.fillStyle = 'rgba(11,11,11,.7)';
    x.fillText(`${S.pax} orang · ` + (S.eventDate ? S.eventDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }) : ''), W / 2, 805);
    x.font = '500 22px ui-monospace, Menlo, monospace'; x.fillText('Kode: ' + ticketCode(), W / 2, 870);
    const a = document.createElement('a');
    a.download = 'tiket-' + norm(S.guest.group_name || 'tamu').replace(/[^a-z0-9]+/g, '-') + '.png';
    a.href = c.toDataURL('image/png'); document.body.appendChild(a); a.click(); a.remove();
    toast('Tiket tersimpan di galeri/unduhan Anda');
  }

  /* ==========================================================
     STATISTIK
     ========================================================== */
  function renderStats() {
    const s = S.summary; if (!s) return;
    $('stats').hidden = false;
    countUp($('st-pax'), s.pax, 1300);
    countUp($('st-yes'), s.yes); countUp($('st-no'), s.no);
    const responded = s.yes + s.no, pct = s.total ? Math.round(responded / s.total * 100) : 0;
    countUp($('st-pct'), pct, 1200, '%');
    $('st-bar').style.width = pct + '%';
    $('st-circles').innerHTML = s.yesNames.slice(0, 3).map((n, i) => `<div class="mono ${['c1', 'c3', 'c2'][i]}">${esc(initial(n))}</div>`).join('') +
      (s.yes > 3 ? `<div class="mono" style="background:var(--paper);font-family:var(--sans);font-size:15px;font-weight:600">+${s.yes - 3}</div>` : '');
  }

  /* ==========================================================
     UCAPAN & DOA
     ========================================================== */
  function resolveStatus(w) {
    if ((S.guestId && w.guest_id === S.guestId) || norm(w.guest_name) === norm(S.guest.group_name)) return S.status;
    if (w.rsvp_status !== undefined && w.rsvp_status !== null) return w.rsvp_status;
    if (S.summary) {
      if (w.guest_id && S.summary.byId.has(w.guest_id)) return S.summary.byId.get(w.guest_id);
      const k = norm(w.guest_name);
      if (S.summary.byName.has(k)) return S.summary.byName.get(k);
    }
    return null;
  }

  function renderWishes() {
    if (!S.guest) return;
    const box = $('wishes-container');
    const all = S.wishes.map(w => ({ ...w, st: resolveStatus(w) }));
    const cnt = { all: all.length, hadir: 0, tidak_hadir: 0, belum: 0 };
    all.forEach(w => { if (w.st === 'hadir') cnt.hadir++; else if (w.st === 'tidak_hadir') cnt.tidak_hadir++; else cnt.belum++; });
    $('wish-count-tag').textContent = all.length ? `${all.length} ucapan` : 'Buku tamu';

    const F = [['all', 'Semua', null], ['hadir', 'Hadir', 'var(--green)'], ['tidak_hadir', 'Tidak Hadir', 'var(--orange)'], ['belum', 'Belum', 'var(--grey)']];
    $('filters').innerHTML = F.map(([k, l, c]) =>
      `<button type="button" data-f="${k}" aria-pressed="${S.filter === k}">${c ? `<i style="background:${c}"></i>` : ''}${l} <em>${cnt[k]}</em></button>`).join('');

    const match = (w) => S.filter === 'all' || (S.filter === 'belum' ? (w.st !== 'hadir' && w.st !== 'tidak_hadir') : w.st === S.filter);
    const list = all.filter(match);

    if (!all.length) {
      box.innerHTML = `<div class="empty">Belum ada ucapan<small>Jadilah yang pertama mengirim doa untuk mempelai.</small></div>`;
      $('wish-more').hidden = true; return;
    }
    if (!list.length) {
      box.innerHTML = `<div class="empty">Tidak ada ucapan di kategori ini</div>`;
      $('wish-more').hidden = true; return;
    }

    const slice = list.slice(0, S.shown);
    box.innerHTML = slice.map(w => {
      const m = statusMeta(w.st);
      const key = w.id || (w.guest_name + w.created_at);
      const isNew = !S.firstLoad && !S.seen.has(key);
      const mine = norm(w.guest_name) === norm(S.guest.group_name);
      return `<article class="wish ${isNew ? 'pop' : ''} ${mine ? 'me' : ''}">
        <div class="avatar ${m.cls}" aria-hidden="true">${esc(initial(w.guest_name))}<i class="dot ${m.cls}"></i></div>
        <div>
          <div class="top"><span class="who">${esc(w.guest_name || 'Tamu')}</span><span class="when">${esc(relTime(w.created_at))}</span></div>
          <span class="badge ${m.cls}" title="Status kehadiran">${badgeHTML(w.st)}</span>
          <p>${esc(w.message)}</p>
        </div></article>`;
    }).join('');
    all.forEach(w => S.seen.add(w.id || (w.guest_name + w.created_at)));
    S.firstLoad = false;

    const more = list.length - slice.length;
    $('wish-more').hidden = more <= 0;
    if (more > 0) $('wish-more').textContent = `Tampilkan ${Math.min(more, WISH_PAGE)} ucapan lagi`;
  }

  async function sendWish(msg) {
    try {
      const { data, error } = await rpc('send_wish', { p_token: token, p_message: msg });
      return !error && !!data && data.success === true;
    } catch { return false; }
  }

  /* ==========================================================
     EVENT LISTENER
     ========================================================== */
  listen($('open-btn'), 'click', openInvitation);
  listen($('cal-btn'), 'click', saveToCalendar);
  listen($('stage'), 'click', () => setEnvelope(!$('stage').classList.contains('open')));
  listen($('dl-ticket'), 'click', downloadTicket);

  root.querySelectorAll('input[name="attend"]').forEach(r => listen(r, 'change', () => {
    $('rsvp-err').hidden = true;
    setChoice(r.value);
    if (r.value === 'hadir' && (!S.pax || S.pax < 1)) S.pax = S.max;
    renderPax();
  }));
  listen($('pax-minus'), 'click', () => { if (S.pax > 1) { S.pax--; renderPax(); } });
  listen($('pax-plus'), 'click', () => { if (S.pax < S.max) { S.pax++; renderPax(); } });
  listen($('rsvp-edit'), 'click', () => { S.editing = true; applyRsvpUI(); $('rsvp-form').scrollIntoView({ behavior: 'smooth', block: 'center' }); });

  listen($('rsvp-form'), 'submit', async (e) => {
    e.preventDefault();
    if (IS_PREVIEW || S.guest?.is_expired) return;
    const sel = root.querySelector('input[name="attend"]:checked');
    const err = $('rsvp-err');
    if (!sel) { err.textContent = 'Silakan pilih salah satu dulu ya.'; err.hidden = false; return; }
    err.hidden = true;
    const status = sel.value;
    const pax = status === 'hadir' ? Math.min(S.max, Math.max(1, S.pax)) : 0;

    const btn = $('rsvp-submit'); const label = btn.textContent;
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Menyimpan…';
    const ok = await submitRsvp(status, pax);
    if (signal.aborted) return;
    btn.disabled = false; btn.textContent = label;

    if (!ok) { err.textContent = 'Konfirmasi belum tersimpan. Periksa koneksi Anda lalu coba lagi.'; err.hidden = false; return; }

    S.status = status; if (status === 'hadir') S.pax = pax; S.editing = false;
    applyRsvpUI();
    toast(status === 'hadir' ? 'Terima kasih! Kehadiran Anda sudah dikonfirmasi 🤍' : 'Terima kasih sudah memberi kabar 🤍');
    if (status === 'hadir') showTicket(true);
    else $('rsvp-summary').scrollIntoView({ behavior: 'smooth', block: 'center' });
    loadSummary();
  });

  listen($('quick'), 'click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const ta = $('wish-message'); ta.value = QUICK_WISHES[+b.dataset.i]; ta.dispatchEvent(new Event('input')); ta.focus();
  });
  listen($('wish-message'), 'input', (e) => {
    const n = e.target.value.length;
    $('wish-counter').textContent = `${n}/${MAX_WISH}`;
    $('wish-counter').classList.toggle('max', n >= MAX_WISH);
  });
  listen($('wish-message'), 'keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); $('wish-form').requestSubmit(); }
  });
  listen($('wish-form'), 'submit', async (e) => {
    e.preventDefault();
    if (IS_PREVIEW || S.guest?.is_expired || S.sending) return;
    const ta = $('wish-message'); const msg = ta.value.trim();
    if (!msg) { toast('Tulis ucapan Anda dulu ya', 'err'); ta.focus(); return; }
    S.sending = true;
    const btn = $('btn-wish'); const html = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Mengirim…';
    const ok = await sendWish(msg);
    if (signal.aborted) return;
    btn.disabled = false; btn.innerHTML = html; S.sending = false;
    if (!ok) { toast('Ucapan belum terkirim. Coba lagi sebentar lagi.', 'err'); return; }
    ta.value = ''; ta.dispatchEvent(new Event('input'));
    S.filter = 'all';
    await loadWishes();
    if (signal.aborted) return;
    toast('Ucapan Anda terkirim. Terima kasih! 🤍');
  });

  listen($('filters'), 'click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    S.filter = b.dataset.f; S.shown = WISH_PAGE; renderWishes();
  });
  listen($('wish-more'), 'click', () => { S.shown += WISH_PAGE; renderWishes(); });

  listen($('gift-list'), 'click', async (e) => {
    const b = e.target.closest('.copy-btn'); if (!b) return;
    const nomor = GIFTS[+b.dataset.i].nomor;
    try { await navigator.clipboard.writeText(nomor); } catch { prompt('Salin nomor rekening berikut:', nomor); return; }
    if (signal.aborted) return;
    b.classList.add('done'); b.querySelector('span').textContent = 'Tersalin';
    toast('Nomor rekening disalin');
    schedule(() => { b.classList.remove('done'); b.querySelector('span').textContent = 'Salin'; }, 2200);
  });

  /* ==========================================================
     SCROLL REVEAL
     ========================================================== */
  let revealIO = null;
  function observeReveals() {
    const els = root.querySelectorAll('.rv:not(.in)');
    if (!('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('in')); return; }
    if (!revealIO) revealIO = new IntersectionObserver((es) => es.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add('in'); revealIO.unobserve(en.target); }
    }), { threshold: .12 });
    els.forEach(e => revealIO.observe(e));
  }

  /* ==========================================================
     REALTIME (butuh Realtime aktif di tabel wishes/rsvps/tickets; kalau tidak, abaikan saja)
     ========================================================== */
  function startRealtime() {
    try {
      channel = sb.channel('inv-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'wishes' }, loadWishesSoon)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'rsvps' }, () => { loadSummarySoon(); })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tickets' }, async () => {
          if (S.status === 'hadir' && !S.checked) { const g = await fetchGuest(); if (g && g.is_checked_in) onCheckedIn(); }
        })
        .subscribe();
    } catch { /* Tetap gunakan polling bila Realtime tidak tersedia. */ }
    // Cadangan bila realtime tidak aktif: segarkan ucapan tiap 45 detik
    repeat(() => { if (!document.hidden) loadWishes(); }, 45000);
  }

  /* ==========================================================
     INIT
     ========================================================== */
  function showError(msg) {
    document.body.classList.remove('locked');
    $('loading').hidden = true;
    $('error-text').textContent = msg;
    $('error-screen').hidden = false;
  }

  // Status paket ditentukan server (event_entitlements). Jangan percaya
  // nilai ini untuk penegakan — ini hanya tampilan.
  function applyEntitlements(g) {
    if (g.watermark) $('rr-wm').hidden = false;

    if (g.is_expired) {
      document.body.classList.add('is-expired');
      $('rr-notice').hidden = false;
      // RSVP & ucapan dibekukan, tetapi tiket dan QR tetap hidup sampai H+30.
      const submit = $('rsvp-submit'); if (submit) submit.disabled = true;
      const edit = $('rsvp-edit'); if (edit) edit.disabled = true;
    }
  }

  // Mode pratinjau: tampilkan seperti tamu lihat, tapi jangan izinkan aksi.
  function applyPreviewMode() {
    document.body.classList.add('is-preview');
    $('rr-preview').hidden = false;
    // Banner-nya fixed, jadi dorong isi undangan setinggi banner supaya
    // label "Undangan Pernikahan" di atas sampul tidak tertutup.
    // ResizeObserver dipakai karena tinggi banner berubah saat font selesai
    // dimuat atau saat teks membungkus di layar sempit.
    const rp = $('rr-preview');
    const syncBanner = () => {
      document.documentElement.style.setProperty('--rr-preview-h', rp.offsetHeight + 'px');
    };
    syncBanner();
    if (window.ResizeObserver) {
      bannerObserver = new ResizeObserver(syncBanner);
      bannerObserver.observe(rp);
    }
    else listen(window, 'resize', syncBanner);
    $('ticket-section').hidden = true;
    const submit = $('rsvp-submit'); if (submit) submit.disabled = true;
    const edit = $('rsvp-edit'); if (edit) edit.disabled = true;
  }

  async function init() {
    if (!token) return showError('Tautan undangan tidak memiliki kode. Silakan periksa kembali tautan yang Anda terima.');
    try {
      const g = await fetchGuest();
      if (signal.aborted) return;
      if (!g) {
        return showError(IS_PREVIEW
          ? 'Tautan pratinjau tidak valid atau sudah diganti pemilik undangan.'
          : `Undangan dengan kode “${token}” tidak ditemukan.`);
      }
      if (!IS_PREVIEW && g.is_published === false) {
        return showError('Undangan ini belum diterbitkan oleh pemiliknya. Silakan hubungi pemilik undangan.');
      }
      ensureIds(g);
      renderInvitation(g);
      applyEntitlements(g);
      if (IS_PREVIEW) applyPreviewMode();
      observeReveals();
      loadWishes(); loadSummary();
      if (!IS_PREVIEW) startRealtime();
    } catch {
      if (!signal.aborted) showError('Gagal terhubung ke server. Periksa koneksi internet Anda lalu muat ulang halaman.');
    }
  }
  listen($('rr-notice-x'), 'click', () => { $('rr-notice').hidden = true; });
  void init();

  return () => {
    abort.abort();
    timers.forEach(id => { window.clearTimeout(id); window.clearInterval(id); });
    stageIO?.disconnect();
    revealIO?.disconnect();
    bannerObserver?.disconnect();
    if (channel) void sb.removeChannel(channel);
    body.classList.remove('locked', 'is-preview', 'is-expired');
    documentElement.style.removeProperty('--rr-preview-h');
    document.title = previousTitle;
  };
}
