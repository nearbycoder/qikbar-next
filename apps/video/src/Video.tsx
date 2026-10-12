import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame, continueRender, delayRender } from 'remotion'
import { useEffect, useState } from 'react'
import { QikbarStyles } from './components/qb'
import { Background, C, clamp, FONT, Logo } from './components/motion'
import { Hotkey, Intro } from './scenes/opening'
import { Actions, AI, Search, Sources, Views } from './scenes/features'
import { Extensions, Outro, Stats, Themes } from './scenes/showcase'
import { DURATION, SCENES } from './timeline'

const LABELS: Partial<Record<keyof typeof SCENES, string>> = {
  hotkey: 'Hotkey',
  search: 'Search',
  sources: 'Live data',
  actions: 'Actions',
  views: 'Views',
  ai: 'AI',
  extensions: 'Extensions',
  themes: 'Theming',
}

/** Small logo watermark + progress bar shown during the feature tour. */
function Chrome() {
  const f = useCurrentFrame()
  const visible = interpolate(f, [SCENES.hotkey.start + 60, SCENES.hotkey.start + 80, SCENES.stats.start - 10, SCENES.stats.start], [0, 1, 1, 0], clamp)
  const progress = f / DURATION
  return (
    <>
      <div style={{ position: 'absolute', left: 120, top: 70, display: 'flex', alignItems: 'center', gap: 14, opacity: visible, fontFamily: FONT }}>
        <Logo size={40} />
        <span style={{ color: C.text, fontSize: 30, fontWeight: 700, letterSpacing: '-0.03em' }}>qikbar</span>
      </div>
      <div style={{ position: 'absolute', left: 0, bottom: 0, height: 4, width: `${progress * 100}%`, background: `linear-gradient(90deg, ${C.brand}, ${C.brand2})`, opacity: 0.85 }} />
    </>
  )
}

export function Video() {
  const [handle] = useState(() => delayRender('fonts'))
  useEffect(() => {
    document.fonts.ready.then(() => continueRender(handle))
  }, [handle])
  const s = (name: keyof typeof SCENES) => ({ from: SCENES[name].start, durationInFrames: SCENES[name].len })
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <QikbarStyles />
      <Background />
      <Sequence {...s('intro')}>
        <Intro />
      </Sequence>
      <Sequence {...s('hotkey')}>
        <Hotkey />
      </Sequence>
      <Sequence {...s('search')}>
        <Search />
      </Sequence>
      <Sequence {...s('sources')}>
        <Sources />
      </Sequence>
      <Sequence {...s('actions')}>
        <Actions />
      </Sequence>
      <Sequence {...s('views')}>
        <Views />
      </Sequence>
      <Sequence {...s('ai')}>
        <AI />
      </Sequence>
      <Sequence {...s('extensions')}>
        <Extensions />
      </Sequence>
      <Sequence {...s('themes')}>
        <Themes />
      </Sequence>
      <Sequence {...s('stats')}>
        <Stats />
      </Sequence>
      <Sequence {...s('outro')}>
        <Outro />
      </Sequence>
      <Chrome />
      <Audio src={staticFile('soundtrack.wav')} />
    </AbsoluteFill>
  )
}

export const _labels = LABELS
