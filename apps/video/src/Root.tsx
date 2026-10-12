import { Composition } from 'remotion'
import { Video } from './Video'
import { DURATION, FPS } from './timeline'

export const Root = () => <Composition id="Main" component={Video} durationInFrames={DURATION} fps={FPS} width={1920} height={1080} />
