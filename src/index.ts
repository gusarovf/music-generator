import path from "path"
import fs from "fs"
import ffmpeg from "fluent-ffmpeg"
import ffmpegPath from "ffmpeg-static"
import { formatDuration, writeTimelineFile } from "./utils"
import { config } from "./config"
import { combineAudioWithPause } from "./generation/audio/combineAudioWithPause"
import { generateVideo } from "./generation/video/generateVideo"

ffmpeg.setFfmpegPath(ffmpegPath)

const args = process.argv.slice(2)
const projectArg = args[0]
const modeArg = args[1] == "--audio" ? "--audio" : "--video"

const validModes = ["--audio", "--video"] as const
if (!projectArg) {
  console.error(
    "❌ Please provide a project folder.\nExample:\n  node lib/index.js projects/30.06.2025 22:20:31 [--audio|--video]"
  )
  process.exit(1)
}

if (!validModes.includes(modeArg as any)) {
  console.error("❌ Invalid mode. Use --audio or --video")
  process.exit(1)
}

const generateAudio = modeArg === "--audio" || modeArg === "--video"
const shouldGenerateVideo = modeArg === "--video"

// Resolve paths
const projectFolder = path.resolve(projectArg)
const inputDir = path.join(projectFolder, "in")
const outputDir = path.join(projectFolder, "out")
const tempListFile = path.join(projectFolder, "input.txt")
const combinedAudio = path.join(outputDir, "combined.mp3")
const outputVideo = path.join(outputDir, "final_video.mp4")

const namesPath = path.join(inputDir, "track-names.txt")
const hasCustomNames = fs.existsSync(namesPath)

// Validate paths
if (!fs.existsSync(inputDir)) {
  console.error(`❌ Input folder does not exist: ${inputDir}`)
  process.exit(1)
}

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true })
}

// Main
const run = async (): Promise<void> => {
  const startTime = Date.now()

  try {
    const mp3Files = fs
      .readdirSync(inputDir)
      .filter((f) => f.endsWith(".mp3"))
      .sort()

    if (mp3Files.length === 0) {
      console.error("❌ No MP3 files found in input folder.")
      process.exit(1)
    }

    const listFileContent = mp3Files
      .map((file) => {
        let fullPath = path.resolve(inputDir, file).replace(/\\/g, "/")
        fullPath = fullPath.replace(/'/g, `'\\''`)
        return `file '${fullPath}'`
      })
      .join("\n")

    fs.writeFileSync(tempListFile, listFileContent)

    if (generateAudio) {
      console.log("🎧 Combining audio with fades...")

      const { durations, startTimes } = await combineAudioWithPause(
        mp3Files,
        inputDir,
        combinedAudio,
        config.pauseDuration
      )

      let trackTitles: string[] = mp3Files.map((f) => path.parse(f).name)

      if (hasCustomNames) {
        const raw = fs
          .readFileSync(namesPath, "utf-8")
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line !== "")

        if (raw.length >= mp3Files.length) {
          trackTitles = raw.slice(0, mp3Files.length)
          console.log(`✏️  Using custom track names from track-names.txt`)
        } else {
          console.warn(
            `⚠️  track-names.txt contains fewer names (${raw.length}) than MP3 files (${mp3Files.length}). Using default names.`
          )
        }
      }

      writeTimelineFile(outputDir, trackTitles, startTimes)
    }

    if (shouldGenerateVideo) {
      console.log("🎞️ Creating video...")
      await generateVideo(inputDir, outputDir, combinedAudio, outputVideo)
    }

    fs.unlinkSync(tempListFile)

    const elapsed = formatDuration(Date.now() - startTime)
    console.log(`✅ Done in ${elapsed}. Output folder: ${outputDir}`)
  } catch (error) {
    console.error("❌ Error:", error)
  }
}

console.log(`📁 Project: ${projectFolder}`)
console.log(`📦 Mode: ${shouldGenerateVideo ? "video" : "audio"}`)

run()
