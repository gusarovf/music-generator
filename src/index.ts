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
    const audioFiles = fs
      .readdirSync(audioDir)
      .filter((f) => f.endsWith(".mp3") || f.endsWith(".m4a"))
      .sort()

    if (audioFiles.length === 0) {
      console.error("❌ No audio files found in audio folder.")
      process.exit(1)
    }

    const listFileContent = audioFiles
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
        audioFiles,
        audioDir,
        combinedAudio,
        config.pauseDuration
      )

      let trackTitles: string[] = audioFiles.map((f) => path.parse(f).name)

      if (hasCustomNames) {
        const rawNames = fs
          .readFileSync(namesPath, "utf-8")
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)

        if (rawNames.length >= audioFiles.length) {
          trackTitles = rawNames.slice(0, audioFiles.length)
          console.log(`✏️  Using custom track names from track-names.txt`)
        } else {
          console.warn(
            `⚠️  track-names.txt contains fewer names (${rawNames.length}) than audio files (${audioFiles.length}). Using default names.`
          )
        }
      }

      writeTimelineFile(outputDir, trackTitles, startTimes)
    }

    if (generateVideoFlag) {
      console.log("🎞️ Creating video...")
      // Find background file
      const backgroundFile = fs
        .readdirSync(backgroundDir)
        .find((file) => file.match(/\.(jpg|jpeg|png|mp4|mov|mkv)$/i))

      if (!backgroundFile) {
        console.error("❌ No background image or video found in input folder.")
        process.exit(1)
      }

      const backgroundPath = path.join(backgroundDir, backgroundFile)
      const isImage = backgroundFile.match(/\.(jpg|jpeg|png)$/i)

      await new Promise<void>((resolve, reject) => {
        const cmd = ffmpeg()

        if (isImage) {
          cmd.input(backgroundPath).loop() // Static image looped
        } else {
          cmd.input(backgroundPath).inputOptions("-stream_loop", "-1") // Looped video
        }

        cmd
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
