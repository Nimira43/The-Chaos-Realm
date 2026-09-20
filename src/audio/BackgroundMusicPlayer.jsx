import { useEffect, useRef, useState } from 'react'
import { MUSIC_TRACKS } from '../data/musicTracks.js'

const VOLUME = 0.4

export default function BackgroundMusicPlayer() {
  const audioRef = useRef(null)
  const [trackIndex, setTrackIndex] = useState(() =>
    Math.floor(Math.random() * MUSIC_TRACKS.length)
  )

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    function handleEnded() {
      setTrackIndex(prev => (prev + 1) % MUSIC_TRACKS.length)
    }

    audio.addEventListener('ended', handleEnded)
    return () => audio.removeEventListener('ended', handleEnded)
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    audio.volume = VOLUME
    audio.src = MUSIC_TRACKS[trackIndex]

    const playPromise = audio.play()

    if (playPromise !== undefined) {
      playPromise.catch(() => {
        const resumeOnInteraction = () => {
          audio.play().catch(() => {})
          document.removeEventListener('pointerdown', resumeOnInteraction)
          document.removeEventListener('keydown', resumeOnInteraction)
        }

        document.addEventListener('pointerdown', resumeOnInteraction, { once: true })
        document.addEventListener('keydown', resumeOnInteraction, { once: true })
      })
    }
  }, [trackIndex])

  return <audio ref={audioRef} />
}