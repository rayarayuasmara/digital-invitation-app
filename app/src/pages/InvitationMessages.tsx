import { useRef, useState } from 'react'
import { Badge } from '@/components/arc/badge/badge'
import { Button } from '@/components/arc/button/button'
import { Select } from '@/components/arc/select/select'
import { DEFAULT_TEMPLATE, categoriesOf, fillTemplate, TEMPLATE_VARIABLES, type Templates } from '@/lib/whatsapp'
import type { DashboardData } from '@/lib/dashboard'
import styles from './InvitationWorkspace.module.css'

const themes = [
  { name: 'Formal', sample: 'Kami mengundang Anda…', text: DEFAULT_TEMPLATE },
  { name: 'Hangat', sample: 'Hari bahagia kami terasa lebih lengkap…', text: 'Halo {nama},\n\nHari bahagia kami terasa lebih lengkap dengan kehadiranmu di {acara}.\n\nKita bertemu pada {tanggal}, pukul {waktu} di {lokasi}, ya.\n\nIni undangan untukmu:\n{link}' },
  { name: 'Ringkas', sample: 'Simpan tanggalnya, ya!', text: 'Halo {nama}! Simpan tanggalnya, ya!\n\n{acara}\n{tanggal} · {waktu}\n{lokasi}\n\nDetail undangan: {link}' },
]

type Props = {
  data: DashboardData
  templates: Templates
  dirty: boolean
  busy: boolean
  error: string
  change: (category: string, value: string | null) => void
  save: () => void
  discard: () => void
}

export function InvitationMessages({ data, templates, dirty, busy, error, change, save, discard }: Props) {
  const [category, setCategory] = useState('Umum')
  const editor = useRef<HTMLTextAreaElement>(null)
  const event = data.event!
  const categories = categoriesOf(data)
  const general = templates.Umum?.trim() || DEFAULT_TEMPLATE
  const text = templates[category] ?? (category === 'Umum' ? DEFAULT_TEMPLATE : general)
  const effective = text.trim() || general
  const selected = themes.find(t => t.text === effective)
  const preview = fillTemplate(effective, event, { group_name: 'Kak Rani', session: null, invitation_token: 'contoh' })
  const insert = (token: string) => {
    const field = editor.current
    if (!field) return
    const start = field.selectionStart
    change(category, text.slice(0, start) + token + text.slice(field.selectionEnd))
    requestAnimationFrame(() => { field.focus(); field.setSelectionRange(start + token.length, start + token.length) })
  }
  return <section className={styles.panel} aria-label="Pesan WhatsApp">
    <header><h2>Pesan pengantar</h2><p>{data.guests.length ? 'Pilih gaya pesan yang menyertai tautan undangan tamu.' : 'Belum ada tamu? Siapkan pesan sekarang. Nama dan tautan akan terisi saat undangan dikirim.'}</p></header>
    {categories.length > 1 && <Select label="Atur pesan untuk" value={category} disabled={busy} onValueChange={setCategory}
      options={categories.map(c => ({ value: c, label: c === 'Umum' ? 'Semua tamu (pesan umum)' : c }))} />}
    {category !== 'Umum' && <div><p>{templates[category]?.trim() ? 'Kategori ini memakai pesan khusus.' : 'Kategori ini mengikuti pesan umum.'}</p>
      {templates[category] != null && <Button variant="secondary" size="sm" disabled={busy} onClick={() => change(category, null)}>Kembali ke pesan umum</Button>}</div>}
    <fieldset className={styles.themes} disabled={busy}>
      <legend>Pilih gaya pesan</legend>
      {themes.map(t => <label key={t.name} className={styles.theme}>
        <input type="radio" name="gaya-pesan" checked={selected === t} onChange={() => change(category, t.text)} />
        <span><strong>{t.name}</strong><small>{t.sample}</small></span>
      </label>)}
    </fieldset>
    <div className={styles.preview}>
      <div className={styles.heading}><h3>Contoh untuk Kak Rani</h3><Badge size="sm" pill>Pratinjau</Badge></div>
      <div className={styles.bubble}>{preview.split(/(\*[^*\n]+\*)/g).map((s,i) => s.startsWith('*') && s.endsWith('*') ? <strong key={i}>{s.slice(1,-1)}</strong> : s)}</div>
      <p>Nama dan tautan di atas hanya contoh.</p>
    </div>
    <details className={styles.custom} key={category}>
      <summary>Sesuaikan isi pesan</summary>
      <label htmlFor="isi-pesan">Teks pesan</label>
      <textarea id="isi-pesan" ref={editor} value={text} rows={8} disabled={busy} onChange={e => change(category, e.target.value)} />
      <p>Sisipkan detail di posisi kursor:</p>
      <div className={styles.tokens}>{TEMPLATE_VARIABLES.map(v => <Button key={v} type="button" variant="secondary" size="sm" disabled={busy} onClick={() => insert(v)}>{v}</Button>)}</div>
    </details>
    {error && <p className="form-error" role="alert">{error}</p>}
    {dirty && <div className={styles.saveBar}>
      <p className={styles.saveStatus} role="status">Perubahan pesan belum disimpan.</p>
      <div className={styles.saveActions}>
        <Button variant="accent" size="lg" fullWidth loading={busy} onClick={save}>Simpan pesan</Button>
        <Button variant="ghost" size="sm" disabled={busy} aria-label="Buang perubahan" onClick={discard}>Buang</Button>
      </div>
    </div>}
  </section>
}
