import { useRef } from 'react'
import { Button } from '@/components/arc/button/button'
import { CylinderCarousel } from '@/components/motion/cylinder-carousel'
import { useCollapseProgress } from '@/lib/hooks/use-collapse-progress'
import { initialsName } from '@/lib/text'
import styles from './EventOnboarding.module.css'

const asset = '/onboarding/welcome/'
const covers = ['0c84a.png', '2743b.png', '74b9b.png']
const wordmark = ['07052.svg', '44aeb.svg', '8a234.svg', 'c181f.svg', '94f95.svg', '5ff92.svg', '1b9d7.svg', '22e7f.svg', '2ed84.svg']

type Props = {
  onStart: () => void
  account: { name: string; onOpen: () => void }
}

export function OnboardingWelcome({ onStart, account }: Props) {
  const header = useRef<HTMLElement>(null)
  useCollapseProgress(header)

  return (
    <div className={styles.intro} data-node-id="465:1404">
      <header ref={header} className={styles.welcomeHeader}>
        <span className="progressive-blur" aria-hidden="true" />
        <button type="button" className={styles.welcomeAvatar} onClick={account.onOpen} aria-label={`Akun ${account.name}`}>
          <span aria-hidden="true">{initialsName(account.name).split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase()}</span>
        </button>
      </header>
      <div className={styles.covers} data-beui>
        <CylinderCarousel
          aria-label="Contoh tampilan undangan"
          labels={{ roleDescription: 'karusel' }}
          className="touch-pan-y"
          itemSize={226.087}
          itemWidthRatio={.46}
          itemAspectRatio={226.087 / 409.275}
          itemSpacing={16}
          variant="convex"
          minScale={1}
          arc={0}
          dragSpeed={1}
          defaultIndex={1}
        >
          {covers.map((file, index) => (
            <img key={file} className={styles.cover} src={`${asset}${file}`} alt={`Contoh sampul undangan ${index + 1}`} fetchPriority={index === 1 ? 'high' : 'auto'} draggable={false} />
          ))}
        </CylinderCarousel>
      </div>
      <div className={styles.welcome}>
        <p className={styles.greeting}>Selamat datang di</p>
        <h1 className={styles.wordmark}>
          <span className="sr-only">Raya Rayu</span>
          {wordmark.map(file => <img key={file} src={`${asset}${file}`} alt="" />)}
        </h1>
        <p className={styles.welcomeCopy}>Buat undangan pernikahan digital yang indah dalam hitungan menit. Tamu bisa menerima undangan dengan mudah, dan pengiriman dengan WhatsApp.</p>
      </div>
      <div className={styles.footer}>
        <div className={styles.introCta}>
          <Button type="button" variant="accent" size="xl" fullWidth className={styles.primary} onClick={onStart}>Buat Acara</Button>
          <img src={`${asset}0615a.svg`} alt="" />
        </div>
      </div>
    </div>
  )
}
