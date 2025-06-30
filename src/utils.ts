import ffmpeg from "fluent-ffmpeg"
import ffmpegPath from "ffmpeg-static"
import ffprobePath from "ffprobe-static"
import path from "path"
import { config } from "./config"
import fs from "fs"

ffmpeg.setFfmpegPath(ffmpegPath as string)
ffmpeg.setFfprobePath(ffprobePath.path)

export const formatDuration = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return `${hours}:${String(minutes).padStart(2, "0")}:${String(
    seconds
  ).padStart(2, "0")}`
}

export const getTimestampFolderName = (): string => {
  const now = new Date()
  const pad = (n: number): string => n.toString().padStart(2, "0")

  const date = `${pad(now.getDate())}.${pad(
    now.getMonth() + 1
  )}.${now.getFullYear()}`
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(
    now.getSeconds()
  )}`

  return `${date} ${time}`
}

export const getAudioDuration = (filePath: string): Promise<number> =>
  new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err: Error | null, metadata: any) => {
      if (err) return reject(err)
      const duration = metadata.format.duration
      if (typeof duration !== "number") return reject("No duration found")
      resolve(duration)
    })
  })

export const combineAudioWithFade = async (
  mp3Files: string[],
  inputDir: string,
  outputPath: string
): Promise<number[]> => {
  const fade = config.fadeDuration
  const command = ffmpeg()

  const durations: number[] = []

  console.log("🎵 Gathering durations...")
  for (const file of mp3Files) {
    const fullPath = path.join(inputDir, file)
    command.input(fullPath)
    const duration = await getAudioDuration(fullPath)
    durations.push(duration)
    console.log(`  • ${file} — ${duration.toFixed(3)}s`)
  }

  const filterParts: string[] = []
  const fadeInputs: string[] = []

  mp3Files.forEach((_, index) => {
    const inputLabel = `[${index}:a]`
    const label = `a${index}`
    fadeInputs.push(`[${label}]`)

    const duration = durations[index]
    const filters = []

    if (index !== 0) {
      filters.push(`afade=t=in:st=0:d=${fade}`)
    }

    if (index !== mp3Files.length - 1 && duration > fade) {
      const safeStart = Math.max(0, duration - fade).toFixed(3)
      filters.push(`afade=t=out:st=${safeStart}:d=${fade}`)
    }

    const chain = filters.length
      ? `${inputLabel}${filters.join(",")}[${label}]`
      : `${inputLabel}[${label}]`

    filterParts.push(chain)
  })

  // Final concat
  filterParts.push(
    `${fadeInputs.join("")}concat=n=${mp3Files.length}:v=0:a=1[outa]`
  )

  console.log("🔍 Final filter graph:\n", filterParts.join(",\n"))

  console.log("🧪 Chain for each input:")
  filterParts.forEach((part) => console.log("  ", part))

  return new Promise((resolve, reject) => {
    command
      .complexFilter(filterParts)
      .outputOptions("-map", "[outa]")
      .output(outputPath)
      .on("end", resolve)
      .on("error", reject)
      .run()

    resolve(durations)
  })
}

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

export const writeTimelineFile = (
  outputDir: string,
  trackTitles: string[],
  startTimes: number[]
): void => {
  const lines: string[] = []

  for (let i = 0; i < trackTitles.length; i++) {
    const timestamp = formatDuration(startTimes[i] * 1000)
    lines.push(`${timestamp} ${trackTitles[i]}`)
  }

  const outputPath = path.join(outputDir, "timeline.txt")
  fs.writeFileSync(outputPath, lines.join("\n"), "utf-8")
  console.log(`📝 Timeline saved to ${outputPath}`)
}
