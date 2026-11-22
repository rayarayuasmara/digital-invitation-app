import { useCallback, useMemo } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { CylinderCarousel } from '@/components/motion/cylinder-carousel'
import styles from './EventOnboarding.module.css'

const months = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

export function todayInJakarta() {
  const parts = new Intl.DateTimeFormat('id-ID', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Jakarta',
  }).formatToParts(new Date())
  const part = (type: string) => parts.find(item => item.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

const monthLength = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate()
const twoDigits = (value: number) => String(value).padStart(2, '0')

export function EventDateWheel({ value, onChange, startYear }: {
  value: string
  onChange: Dispatch<SetStateAction<string>>
  startYear: number
}) {
  const [year, month, day] = value.split('-').map(Number)
  const maxDay = monthLength(year, month)
  const days = useMemo(() => Array.from({ length: maxDay }, (_, index) => String(index + 1)), [maxDay])
  const years = useMemo(() => Array.from({ length: 31 }, (_, index) => startYear - 10 + index), [startYear])

  const rowProps = {
    variant: 'convex' as const,
    visibleItems: 3,
    minScale: 0.7,
    itemSize: 96,
    itemAspectRatio: 2.2,
    height: 64,
    arc: 0,
  }

  const setPart = useCallback((part: 0 | 1 | 2, next: number) => {
    onChange(current => {
      const parts = current.split('-').map(Number)
      parts[part] = next
      const [y, m, d] = parts
      return `${y}-${twoDigits(m)}-${twoDigits(Math.min(d, monthLength(y, m)))}`
    })
  }, [onChange])

  return (
    <div data-beui className={styles.dateCard} role="group" aria-label="Tanggal acara">
      <div className={styles.dateRow}>
        <span className={styles.dateRowLabel} aria-hidden="true">Hari</span>
        <CylinderCarousel
          key={`${year}-${month}`}
          {...rowProps}
          aria-label="Hari"
          defaultIndex={day - 1}
          onIndexChange={index => setPart(2, index + 1)}
        >
          {days.map(label => <span key={label} className={styles.dateItem}>{label}</span>)}
        </CylinderCarousel>
      </div>
      <div className={styles.dateRow}>
        <span className={styles.dateRowLabel} aria-hidden="true">Bulan</span>
        <CylinderCarousel
          {...rowProps}
          aria-label="Bulan"
          defaultIndex={month - 1}
          onIndexChange={index => setPart(1, index + 1)}
        >
          {months.map(label => <span key={label} className={styles.dateItem}>{label}</span>)}
        </CylinderCarousel>
      </div>
      <div className={styles.dateRow}>
        <span className={styles.dateRowLabel} aria-hidden="true">Tahun</span>
        <CylinderCarousel
          {...rowProps}
          aria-label="Tahun"
          defaultIndex={years.indexOf(year)}
          onIndexChange={index => setPart(0, years[index])}
        >
          {years.map(label => <span key={label} className={styles.dateItem}>{label}</span>)}
        </CylinderCarousel>
      </div>
    </div>
  )
}
