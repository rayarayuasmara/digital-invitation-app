import { useCallback, useMemo } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { WheelPicker } from '@/components/motion/wheel-picker'
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

  const monthOptions = useMemo(() => months.map((label, index) => ({ label, value: String(index + 1) })), [])
  const yearOptions = useMemo(() => years.map(String), [years])

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
      <WheelPicker aria-label="Hari" options={days} value={String(day)} onValueChange={next => setPart(2, Number(next))} />
      <WheelPicker aria-label="Bulan" options={monthOptions} value={String(month)} onValueChange={next => setPart(1, Number(next))} />
      <WheelPicker aria-label="Tahun" options={yearOptions} value={String(year)} onValueChange={next => setPart(0, Number(next))} />
    </div>
  )
}
