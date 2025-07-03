import path from "path"
import fs from "fs"
import ffmpeg from "fluent-ffmpeg"
import ffmpegPath from "ffmpeg-static"
import { formatDuration, writeTimelineFile } from "./utils"
import { config } from "./config"
import { combineAudioWithPause } from "./generation/audio/combineAudioWithPause"
import { generateVideo } from "./generation/video/generateVideo"
import { resolveProjectPaths } from "./paths"

ffmpeg.setFfmpegPath(ffmpegPath)

const args = process.argv.slice(2)
const projectArg = args[0]
const modeArg = args[1] === "--audio" ? "--audio" : "--video"

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
const generateVideoFlag = modeArg === "--video"

// Resolve all paths
const {
  projectFolder,
  inputDir,
  audioDir,
  backgroundDir,
  outputDir,
  tempListFile,
  combinedAudio,
  outputVideo,
  namesPath,
  hasCustomNames,
} = resolveProjectPaths(projectArg)

// Validate required folders
if (!fs.existsSync(audioDir)) {
  console.error(`❌ Audio folder does not exist: ${audioDir}`)
  process.exit(1)
}
if (!fs.existsSync(backgroundDir)) {
  console.error(`❌ Background folder does not exist: ${backgroundDir}`)
  process.exit(1)
}
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true })
}

const run = async (): Promise<void> => {
  const startTime = Date.now()

  try {
    const mp3Files = fs
      .readdirSync(audioDir)
      .filter((f) => f.endsWith(".mp3"))
      .sort()

    if (mp3Files.length === 0) {
      console.error("❌ No MP3 files found in audio folder.")
      process.exit(1)
    }

    const listFileContent = mp3Files
      .map((file) => {
        let fullPath = path.resolve(audioDir, file).replace(/\\/g, "/")
        fullPath = fullPath.replace(/'/g, `'\\''`)
        return `file '${fullPath}'`
      })
      .join("\n")

    fs.writeFileSync(tempListFile, listFileContent)

    if (generateAudio) {
      console.log("🎧 Combining audio with pauses...")

      const { durations, startTimes } = await combineAudioWithPause(
        mp3Files,
        audioDir,
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

    if (generateVideoFlag) {
      console.log("🎞️ Creating video...")
      await generateVideo(backgroundDir, outputDir, combinedAudio, outputVideo)
    }

    if (fs.existsSync(tempListFile)) {
      fs.unlinkSync(tempListFile)
    }

    const elapsed = formatDuration(Date.now() - startTime)
    console.log(`✅ Done in ${elapsed}. Output folder: ${outputDir}`)
  } catch (error) {
    console.error("❌ Error:", error)
  }
}

console.log(`📁 Project: ${projectFolder}`)
console.log(`📦 Mode: ${generateVideoFlag ? "video" : "audio"}`)

run()
