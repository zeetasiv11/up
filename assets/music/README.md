# Zeechei music assets

Original purple/pink artwork generated for V4, distributed under the repository MIT license.

- Six animated application emojis: play, music, heart, volume, loading, equalizer.
- A looping decorative equalizer banner and a static paused/reconnecting version.
- Animation is decorative, not an analysis of the playing audio. Audio effects remain Lavalink filters.

Runtime uses the committed assets; no ffmpeg or image generator is needed in production.
To regenerate, use `node scripts/generate-music-assets.cjs` with the repository's canvas dependency and ffmpeg installed.

The bot fetches its application emoji collection on ready and uploads only missing versioned names.
Owner emoji settings take precedence. Upload failures fall back to Unicode; the banner remains available as a message attachment.
