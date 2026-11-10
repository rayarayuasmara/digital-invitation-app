import type { DashboardData } from '@/lib/dashboard'

type Props = {
  data: DashboardData
  onShare: () => void
}

function formatDate(value: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' })
}

export function InvitationPage({ data, onShare }: Props) {
  const event = data.event!

  return (
    <>
      <h1 className="page-title">Undangan</h1>
      <p className="page-sub">Detail acara yang tampil di undangan tamu</p>

      <div className="card">
        <p className="name" style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{event.couple_name || event.title}</p>
        <p style={{ margin: '4px 0 0', color: 'var(--sub)' }}>{event.title}</p>
        <div style={{ marginTop: 12 }}>
          <div className="kv"><span>Tanggal</span><span>{formatDate(event.event_date)}</span></div>
          <div className="kv"><span>Lokasi</span><span style={{ textAlign: 'right' }}>{event.location || '-'}</span></div>
          {(event.sessions ?? []).map(s => (
            <div key={s.id} className="kv"><span>{s.name}</span><span>{s.time_text || '-'}</span></div>
          ))}
        </div>
      </div>

      <h2 className="section-title">Bagikan</h2>
      <button type="button" className="btn btn-primary" onClick={onShare}>
        Salin tautan pratinjau
      </button>
      <p className="page-sub" style={{ margin: '10px 4px 0' }}>
        Tautan pratinjau memakai nama tamu placeholder. Undangan tiap tamu disalin dari tab Tamu.
      </p>
    </>
  )
}
