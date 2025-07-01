import path from "path"
import fs from "fs"
import ffmpeg from "fluent-ffmpeg"
import ffmpegPath from "ffmpeg-static"
import {
  combineAudioWithCrossfade,
  combineAudioWithPause,
  formatDuration,
  writeTimelineFile,
} from "./utils"
import { combineAudioWithFade } from "./utils"
import { config } from "./config"

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
const generateVideo = modeArg === "--video"

// Resolve paths
const projectFolder = path.resolve(projectArg)
const inputDir = path.join(projectFolder, "in")
const outputDir = path.join(projectFolder, "out")
const tempListFile = path.join(projectFolder, "input.txt")
const combinedAudio = path.join(outputDir, "combined.mp3")
const outputVideo = path.join(outputDir, "final_video.mp4")
const imageBackground = path.join(inputDir, "background.jpg")

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

      // const { durations, startTimes } = await combineAudioWithCrossfade(
      //   mp3Files,
      //   inputDir,
      //   combinedAudio
      // )

      const { durations, startTimes } = await combineAudioWithPause(
        mp3Files,
        inputDir,
        combinedAudio,
        config.pauseDuration
      )

      const trackTitles = mp3Files.map((f) => path.parse(f).name)
      writeTimelineFile(outputDir, trackTitles, startTimes)
    }

    if (generateVideo) {
      console.log("🎞️ Creating video...")
      if (!fs.existsSync(imageBackground)) {
        console.error(`❌ Missing background image: ${imageBackground}`)
        process.exit(1)
      }

      await new Promise<void>((resolve, reject) => {
        ffmpeg()
          .input(imageBackground)
          .loop()
          .input(combinedAudio)
          .outputOptions(
            "-c:v",
            "libx264",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-shortest",
            "-pix_fmt",
            "yuv420p"
          )
          .size("1280x720")
          .output(outputVideo)
          .on("end", resolve)
          .on("error", reject)
          .run()
      })
    }

    fs.unlinkSync(tempListFile)

    const elapsed = formatDuration(Date.now() - startTime)
    console.log(`✅ Done in ${elapsed}. Output folder: ${outputDir}`)
  } catch (error) {
    console.error("❌ Error:", error)
  }
}

console.log(`📁 Project: ${projectFolder}`)
console.log(`📦 Mode: ${generateVideo ? "video" : "audio"}`)

run()
