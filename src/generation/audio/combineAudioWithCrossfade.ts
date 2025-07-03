import ffmpeg from "fluent-ffmpeg"
import path from "path"
import { config } from "../../config"
import { getAudioDuration } from "."
import fs from "fs"

export const combineAudioWithCrossfade = async (
  mp3Files: string[],
  inputDir: string,
  outputPath: string
): Promise<{ durations: number[]; startTimes: number[] }> => {
  const fade = config.fadeDuration
  if (mp3Files.length < 2) {
    throw new Error("At least 2 audio files are required for crossfading.")
  }

  let tempCounter = 0
  const getTempFile = () =>
    path.join(inputDir, `.tmp-crossfade-${tempCounter++}.mp3`)
  const tempFiles: string[] = []

  const durations: number[] = []
  const startTimes: number[] = []

  console.log("🎵 Gathering durations...")
  for (let i = 0; i < mp3Files.length; i++) {
    const fullPath = path.join(inputDir, mp3Files[i])
    const duration = await getAudioDuration(fullPath)
    durations.push(duration)

    if (i === 0) {
      startTimes.push(0)
    } else {
      const prevStart = startTimes[i - 1]
      const prevDur = durations[i - 1]
      startTimes.push(prevStart + prevDur - fade)
    }

    console.log(`  • ${mp3Files[i]} — ${duration.toFixed(3)}s`)
  }

  // Step 1: Crossfade first two
  let previous = getTempFile()
  tempFiles.push(previous)

  await new Promise((resolve, reject) => {
    ffmpeg()
      .input(path.join(inputDir, mp3Files[0]))
      .input(path.join(inputDir, mp3Files[1]))
      .complexFilter([`[0:a][1:a]acrossfade=d=${fade}:c1=tri:c2=tri[outa]`])
      .outputOptions("-map", "[outa]")
      .output(previous)
      .on("end", resolve)
      .on("error", reject)
      .run()
  })

  // Step 2+: Crossfade previous output with next track
  for (let i = 2; i < mp3Files.length; i++) {
    const next = getTempFile()
    tempFiles.push(next)

    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(previous)
        .input(path.join(inputDir, mp3Files[i]))
        .complexFilter([`[0:a][1:a]acrossfade=d=${fade}:c1=tri:c2=tri[outa]`])
        .outputOptions("-map", "[outa]")
        .output(next)
        .on("end", resolve)
        .on("error", reject)
        .run()
    })

    previous = next
  }

  fs.copyFileSync(previous, outputPath)

  for (const file of tempFiles) {
    fs.unlinkSync(file)
  }

  console.log(`✅ Crossfade complete → ${outputPath}`)
  return { durations, startTimes }
}
