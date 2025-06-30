import ffmpeg from "fluent-ffmpeg"
import ffmpegPath from "ffmpeg-static"
import ffprobePath from "ffprobe-static"
import path from "path"
import { config } from "./config"

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
): Promise<void> => {
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
  })
}
