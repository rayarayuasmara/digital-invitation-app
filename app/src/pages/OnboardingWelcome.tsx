import { useRef } from 'react'
import { ArrowRight } from 'lucide-react'
import { PageAccountButton } from '@/components/PageHeader'
import { Button } from '@/components/arc/button/button'
import { CylinderCarousel } from '@/components/motion/cylinder-carousel'
import { useCollapseProgress } from '@/lib/hooks/use-collapse-progress'
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
        <span className="progressive-blur page-head-glass" aria-hidden="true" />
        <PageAccountButton account={account} className={styles.welcomeAvatar} />
      </header>
      <div className={styles.welcomeStage}>
        <div className={styles.covers} data-beui>
          <CylinderCarousel
            aria-label="Contoh tampilan undangan"
            labels={{ roleDescription: 'karusel' }}
            className="touch-pan-y"
            itemSize={179.4}
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
              <img key={file} className={styles.cover} src={`${asset}${file}`} width={780} height={1688}
                alt={`Contoh sampul undangan ${index + 1}`} fetchPriority={index === 1 ? 'high' : 'auto'} draggable={false} />
            ))}
          </CylinderCarousel>
        </div>
        <div className={styles.welcome}>
          <p className={styles.greeting}>Selamat datang di</p>
          <h1 className={styles.wordmark}>
            <span className="sr-only">Raya Rayu</span>
            {wordmark.map(file => (
              <span key={file} aria-hidden style={{ maskImage: `url(${asset}${file})` }}>
                <img src={`${asset}${file}`} alt="" />
              </span>
            ))}
          </h1>
          <p className={styles.welcomeCopy}>Buat undangan pernikahan digital, lalu bagikan ke tamu lewat WhatsApp.</p>
        </div>
        <div className={styles.footer}>
          <div className={styles.introCta}>
            <Button type="button" variant="accent" size="xl" fullWidth className={styles.primary} onClick={onStart}>
              Buat acara <ArrowRight size={18} aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
