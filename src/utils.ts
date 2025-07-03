import ffmpeg from "fluent-ffmpeg"
import ffmpegPath from "ffmpeg-static"
import ffprobePath from "ffprobe-static"
import path from "path"
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
