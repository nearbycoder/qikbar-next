# Qikbar product film

The 76-second marketing video on qikbar.com, built with [Remotion](https://remotion.dev). The bar mockups use Qikbar's real CSS, icons, fuzzy ranking and Markdown renderer, so they look like the shipped component.

```sh
bun run studio           # live preview
bun run render           # synthesize the soundtrack, then render out/qikbar.mp4
bun run preview-frames 300 960 1450   # render individual stills to out/frames
```

- `scripts/audio.ts` synthesizes the music and sound effects in TypeScript (120 BPM, no samples) and writes `public/soundtrack.wav`. Sound effect cues come from `src/timeline.ts`, so they stay in sync with the animation.
- `src/timeline.ts` sets the scene timing, typing schedules and sound cues. One beat is 15 frames.
- To publish, copy the render to the site with faststart enabled:
  `ffmpeg -i out/qikbar.mp4 -c copy -movflags +faststart ../web/public/video/qikbar.mp4`
