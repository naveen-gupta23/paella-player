'use client'
import styles from './page.module.css'
import { PlayerContextProvider } from './components/player/PlayerContext'
import InlinePlayer from './components/player/Paella'

const event = {
  title: "Paella player",
  created: new Date().toString(),
  isLive: true,
  syncedData: {
    updated: new Date().toString(),
    startTime: null,
    endTime: null,
    duration: 2,
    tracks: [
      {
        uri: 'https://video-test.emeritus.org/play/cf43efa1-0321-4a15-a343-96240e061765',
        flavor: 'test',
        mimetype: null,
        resolution: null,
        isMaster: null
      }
    ],
    thumbnail: '/next.svg'
  }
}

export default function Home() {
    return (
      <main className={styles.main}>
        <PlayerContextProvider>
          <InlinePlayer event={event} />
        </PlayerContextProvider>
      </main>
    )
}
