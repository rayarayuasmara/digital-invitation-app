export function InvitationMarkup() {
  return (
    <>
      <div className="app">

        {/* LOADING */}
        <div id="loading" className="fullscreen" role="status">
          <span className="tilde">~</span>
          <p className="display it">Menyiapkan undangan…</p>
        </div>

        {/* ERROR */}
        <div id="error-screen" className="fullscreen" hidden>
          <span className="tilde">~</span>
          <h2 className="display">Undangan tidak ditemukan</h2>
          <p id="error-text">Tautan undangan tidak valid atau belum terdaftar.</p>
          <a href="/" className="btn light ghost" style={{ width: "auto", color: "var(--ink)", borderColor: "var(--ink)" }}>Kembali ke beranda</a>
        </div>

        {/* KONTEN */}
        <div id="main-content" hidden>

          {/* COVER */}
          <section id="cover" className="cover" aria-label="Sampul undangan">
            <div className="brand"><span id="cv-brand">Undangan Pernikahan</span>
              <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="8" fill="#0B0B0B" /><path d="M4.6 8.2l2.3 2.3 4.5-4.7" stroke="#BD9F7F" strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>

            <div className="cover-art" aria-hidden="true">
              <svg viewBox="0 0 220 170" fill="none" stroke="#0B0B0B" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
                <path className="draw" d="M72 40c-27 2-47 26-44 54s27 48 55 44 46-28 42-56-26-44-53-42z" />
                <path className="draw d2" d="M141 40c-26 3-44 27-40 55s28 46 56 41 45-29 39-57-28-42-55-39z" />
                <path className="draw d3" d="M60 26l11-14 12 14-12 14z" />
                <path className="draw d3" d="M96 160c11 4 32 5 50 0" strokeWidth="4" />
              </svg>
            </div>

            <div className="cover-title">
              <span className="eyebrow">The Wedding Of</span>
              <h1 id="cv-title" className="display h1">Rudi &amp; Irul</h1>
            </div>

            <div className="cover-to">
              <span className="tilde">~</span>
              <small>Kepada Yth. Bapak/Ibu/Saudara/i</small>
              <div id="cv-guest" className="cover-guest">Tamu Undangan</div>
              <small id="cv-pax">Undangan untuk 2 orang</small>
              <button className="btn" id="open-btn" type="button">
                Buka Undangan
                <svg className="arrow" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12L12 4M5 4h7v7" /></svg>
              </button>
              <p className="note">Mohon maaf apabila ada kesalahan penulisan nama atau gelar.</p>
            </div>
          </section>

          <main>
            {/* SALAM */}
            <section className="block paper salam">
              <div className="brand rv"><span className="bn">RayaRayu</span><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="8" fill="#0B0B0B" /><path d="M4.6 8.2l2.3 2.3 4.5-4.7" stroke="#EAEAEA" strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg><span className="tag">Walimatul ‘Ursy</span></div>
              <span className="tilde rv" style={{ marginTop: "42px" }}>~</span>
              <h2 className="quote rv">Bismillahirrahmanirrahim</h2>
              <p className="cap rv" id="event-caption">Dengan penuh syukur, kami mengundang Bapak/Ibu/Saudara/i untuk hadir dan memberikan doa restu di hari bahagia kami.</p>
            </section>

            {/* MEMPELAI */}
            <section className="block tan couple">
              <div className="brand rv"><span className="bn">RayaRayu</span><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="8" fill="#0B0B0B" /><path d="M4.6 8.2l2.3 2.3 4.5-4.7" stroke="#BD9F7F" strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg><span className="tag">Mempelai</span></div>
              <div className="couple-circles rv" id="couple-circles" aria-hidden="true"></div>
              <h2 className="display names rv" id="couple-names">Rudi &amp; Irul</h2>
              <p className="rv">Putra &amp; putri tercinta dari keluarga besar kami.</p>
            </section>

            {/* ACARA */}
            <section className="block sky" id="acara">
              <div className="brand rv"><span className="bn">RayaRayu</span><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="8" fill="#0B0B0B" /><path d="M4.6 8.2l2.3 2.3 4.5-4.7" stroke="#76B5C0" strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
              <h2 className="display h2 rv" style={{ marginTop: "34px" }}>Waktu &amp;<br /><span className="it">Tempat</span></h2>
              <div className="when-date rv" id="event-date">-</div>
              <div className="when-sessions rv" id="event-sessions"></div>
              <p className="where rv" id="event-location">-</p>

              <div className="cd rv" id="countdown" aria-live="off" role="timer" aria-label="Hitung mundur menuju acara">
                <div><b id="cd-days">0</b><span>Hari</span></div>
                <div><b id="cd-hours">0</b><span>Jam</span></div>
                <div><b id="cd-mins">0</b><span>Menit</span></div>
                <div><b id="cd-secs">0</b><span>Detik</span></div>
              </div>
              <p id="cd-note" className="where" hidden style={{ fontFamily: "var(--serif)", fontSize: "30px", lineHeight: "1.1" }}></p>

              <div className="when-actions rv">
                <a id="maps-btn" className="btn" href="#" hidden target="_blank" rel="noopener noreferrer">Buka lokasi
                  <svg className="arrow" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12L12 4M5 4h7v7" /></svg></a>
                <button id="cal-btn" className="btn ghost" type="button">Simpan ke Kalender</button>
              </div>
            </section>

            {/* RSVP */}
            <section className="block paper" id="rsvp">
              <div className="brand rv"><span className="bn">RayaRayu</span><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="8" fill="#0B0B0B" /><path d="M4.6 8.2l2.3 2.3 4.5-4.7" stroke="#EAEAEA" strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg><span className="tag">RSVP</span></div>
              <h2 className="display h2 rv" style={{ marginTop: "34px" }}>Konfirmasi<br /><span className="it">Kehadiran</span></h2>
              <p className="lead rv">Bantu kami menyiapkan tempat duduk dan konsumsi. Cukup satu menit.</p>

              <div className="guest-card rv">
                <div className="avatar st-none" id="rsvp-avatar"><span id="rsvp-initial">T</span><i className="dot st-none" id="rsvp-dot"></i></div>
                <div>
                  <div className="gname" id="rsvp-guest-name">-</div>
                  <div className="gsub" id="rsvp-guest-sub">Undangan untuk maksimal 2 orang</div>
                </div>
              </div>

              {/* Ringkasan jika sudah mengisi */}
              <div id="rsvp-summary" className="summary" hidden>
                <div className="chip-row"><span className="badge" id="sum-badge"></span></div>
                <h3 className="display h3" id="sum-title"></h3>
                <p id="sum-sub"></p>
                <button className="btn ghost sm" id="rsvp-edit" type="button">Ubah konfirmasi</button>
              </div>

              <p className="rr-frozen" id="rr-frozen">
                Konfirmasi kehadiran sudah ditutup karena masa aktif undangan telah berakhir.
                Tiket yang sudah Anda terima tetap berlaku untuk check-in di pintu masuk.
              </p>

              <form id="rsvp-form" noValidate>
                <fieldset id="rsvp-choices">
                  <legend>Apakah Anda bisa hadir?</legend>
                  <div className="choices">
                    <label className="choice yes">
                      <input type="radio" name="attend" value="hadir" />
                      <span className="face">
                        <span className="ico"><svg viewBox="0 0 20 20" fill="none" stroke="#0B0B0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10.5l4 4 8-9" /></svg></span>
                        <span><b>Saya akan hadir</b><small>Tiket QR untuk check-in langsung dibuat</small></span>
                        <span className="radio" aria-hidden="true"></span>
                      </span>
                    </label>
                    <label className="choice no">
                      <input type="radio" name="attend" value="tidak_hadir" />
                      <span className="face">
                        <span className="ico"><svg viewBox="0 0 20 20" fill="none" stroke="#0B0B0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 5l10 10M15 5L5 15" /></svg></span>
                        <span><b>Maaf, saya belum bisa hadir</b><small>Tidak apa-apa, doa Anda tetap berarti</small></span>
                        <span className="radio" aria-hidden="true"></span>
                      </span>
                    </label>
                  </div>
                </fieldset>

                <div className="pax-wrap" id="pax-wrap"><div><div className="pax-inner">
                  <fieldset style={{ marginTop: "20px" }}>
                    <legend id="pax-legend">Berapa orang yang akan datang?</legend>
                    <div className="stepper">
                      <button type="button" id="pax-minus" aria-label="Kurangi jumlah orang">−</button>
                      <div className="val" aria-live="polite"><b id="pax-val">1</b><span id="pax-label">orang</span></div>
                      <button type="button" id="pax-plus" aria-label="Tambah jumlah orang">+</button>
                    </div>
                    <p className="hint" id="pax-hint">Maksimal 2 orang, termasuk Anda.</p>
                  </fieldset>
                </div></div></div>

                <p className="err" id="rsvp-err" role="alert" hidden></p>
                <button className="btn" id="rsvp-submit" type="submit">Kirim Konfirmasi</button>
              </form>
            </section>

            {/* TIKET (amplop) */}
            <section className="block ink ticket on-dark" id="ticket-section" hidden>
              <div className="brand"><span className="bn">RayaRayu</span><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="8" fill="#EAEAEA" /><path d="M4.6 8.2l2.3 2.3 4.5-4.7" stroke="#0B0B0B" strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg><span className="tag">Tiket Masuk</span></div>
              <h2 className="display h2" style={{ marginTop: "34px" }}>Tiket <span className="it">Anda</span></h2>
              <p className="lead">Tunjukkan QR ini ke petugas penerima tamu saat tiba di lokasi.</p>

              <button type="button" className="stage" id="stage" aria-expanded="false" aria-label="Amplop tiket. Ketuk untuk membuka atau menutup">
                <div className="env">
                  <div className="env-back"></div>
                  <div className="env-flap"></div>
                  <div className="seal" aria-hidden="true"><svg viewBox="0 0 24 24" fill="#0B0B0B"><path d="M12 21s-7-4.4-9.3-8.6C1 9.1 2.700 5 6.400 5c2.200 0 3.700 1.300 4.600 2.900h2C13.900 6.300 15.400 5 17.600 5c3.700 0 5.400 4.100 3.700 7.400C19 16.600 12 21 12 21z" /></svg></div>
                  <div className="env-pocket"></div>
                </div>
                <div className="t-card">
                  <div className="t-top"><span>Tiket Masuk</span><span id="t-pax">1 orang</span></div>
                  <div className="t-qr"><div id="qrcode"></div></div>
                  <div className="t-name" id="t-name">-</div>
                  <div className="t-code" id="ticket-token-label"></div>
                </div>
                <span className="tap">Ketuk amplop</span>
              </button>

              <div id="ticket-status" className="ticket-status" role="status"><span className="pulse"></span><span id="ticket-status-text">Belum check-in</span></div>
              <div className="actions">
                <button className="btn light sm" id="dl-ticket" type="button">Simpan Tiket sebagai Gambar</button>
              </div>
            </section>

            {/* STATISTIK LIVE */}
            <section className="block sky" id="stats" hidden>
              <div className="brand"><span className="bn">RayaRayu</span><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="8" fill="#0B0B0B" /><path d="M4.6 8.2l2.3 2.3 4.5-4.7" stroke="#76B5C0" strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg><span className="tag">Update langsung</span></div>
              <h2 className="display h2" style={{ marginTop: "34px" }}>Siapa saja<br /><span className="it">yang hadir</span></h2>
              <span className="tilde" style={{ marginTop: "34px" }}>~</span>
              <div className="stat-big" id="st-pax">0</div>
              <div>Orang sudah memastikan hadir</div>
              <div className="circles" id="st-circles" aria-hidden="true"></div>
              <div className="stat-grid">
                <div><b id="st-yes">0</b><span>Undangan hadir</span></div>
                <div><b id="st-no">0</b><span>Belum bisa hadir</span></div>
              </div>
              <div className="progress">
                <div className="row"><b id="st-pct">0%</b><span id="st-resp" style={{ textAlign: "right", fontSize: "14px" }}>sudah<br />merespons</span></div>
                <div className="bar" aria-hidden="true"><i id="st-bar"></i></div>
              </div>
            </section>

            {/* AMPLOP DIGITAL */}
            <section className="block paper" id="gift">
              <div className="brand rv"><span className="bn">RayaRayu</span><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="8" fill="#0B0B0B" /><path d="M4.6 8.2l2.3 2.3 4.5-4.7" stroke="#EAEAEA" strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg><span className="tag">Opsional</span></div>
              <h2 className="display h2 rv" style={{ marginTop: "34px" }}>Tanda<br /><span className="it">Kasih</span></h2>
              <p className="lead rv">Kehadiran dan doa Anda sudah lebih dari cukup. Jika ingin berbagi kebahagiaan, Anda bisa mengirimnya lewat rekening berikut.</p>
              <div className="gift-list" id="gift-list"></div>
            </section>

            {/* UCAPAN & DOA */}
            <section className="block tan" id="wishes-section">
              <div className="brand rv"><span className="bn">RayaRayu</span><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="8" fill="#0B0B0B" /><path d="M4.6 8.2l2.3 2.3 4.5-4.7" stroke="#BD9F7F" strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg><span className="tag" id="wish-count-tag">Buku tamu</span></div>
              <h2 className="display h2 rv" style={{ marginTop: "34px" }}>Ucapan<br /><span className="it">&amp; Doa</span></h2>

              <form id="wish-form" className="composer rv" noValidate>
                <div className="as">
                  <div className="avatar st-none" id="w-avatar"><span id="w-initial">T</span><i className="dot st-none" id="w-dot"></i></div>
                  <div><small>Mengirim sebagai</small><b id="w-name">-</b></div>
                  <span className="badge st-none" id="w-badge"></span>
                </div>
                <label htmlFor="wish-message" className="sr" style={{ position: "absolute", left: "-9999px" }}>Tulis ucapan dan doa</label>
                <textarea id="wish-message" rows={3} maxLength={300} placeholder="Tulis ucapan dan doa untuk mempelai…"></textarea>
                <div className="quick" id="quick" aria-label="Contoh ucapan"></div>
                <div className="row">
                  <span className="counter" id="wish-counter">0/300</span>
                  <button type="submit" id="btn-wish" className="btn">Kirim Ucapan
                    <svg className="arrow" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12L12 4M5 4h7v7" /></svg></button>
                </div>
              </form>

              <div className="filters" id="filters" role="group" aria-label="Filter ucapan"></div>
              <div className="wishes" id="wishes-container" aria-live="polite">
                <div className="skeleton"></div><div className="skeleton"></div>
              </div>
              <button className="btn ghost" id="wish-more" type="button" hidden>Tampilkan lebih banyak</button>
            </section>

            {/* PENUTUP */}
            <section className="block ink closing on-dark">
              <span className="tilde">~</span>
              <h2 className="display">Terima<br /><span className="it">kasih</span></h2>
              <p>Merupakan kehormatan dan kebahagiaan bagi kami apabila Bapak/Ibu/Saudara/i berkenan hadir dan memberikan doa restu.</p>
              <div className="names" id="footer-client-name">Rudi &amp; Irul</div>
            </section>
          </main>

          {/* Banner mode pratinjau */}
          <div id="rr-preview" className="rr-preview" role="status" hidden>
            <b>Mode pratinjau</b> — seperti yang dilihat tamu. RSVP dan ucapan dimatikan.
          </div>

          {/* Badge paket Free; server yang menentukan lewat kolom watermark */}
          <a id="rr-wm" className="rr-wm" href="/" target="_blank" rel="noopener" hidden>
            Dibuat dengan <b>RayaRayu</b>
          </a>

          {/* Banner masa aktif berakhir */}
          <div id="rr-notice" className="rr-notice" role="status" hidden>
            <b>Masa aktif undangan telah berakhir.</b>
            <span>Isi undangan masih dapat dibaca. Hubungi pemilik undangan untuk memperpanjang.</span>
            <button type="button" id="rr-notice-x" aria-label="Tutup pemberitahuan">&times;</button>
          </div>
        </div>
      </div>

      <div className="toast-host" id="toast-host" aria-live="polite"></div>
    </>
  )
}
