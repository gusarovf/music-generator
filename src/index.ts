import path from "path"
import fs from "fs"
import ffmpeg from "fluent-ffmpeg"
import ffmpegPath from "ffmpeg-static"
import { formatDuration } from "./utils"

ffmpeg.setFfmpegPath(ffmpegPath)

// Read project folder from command line arg
const projectArg = process.argv[2]
if (!projectArg) {
  console.error(
    "❌ Please provide a folder path, e.g.: node lib/index.js projects/30.06.2025 22:20:31"
  )
  process.exit(1)
}

const projectFolder = path.resolve(projectArg)
const inputDir = path.join(projectFolder, "in")
const outputDir = path.join(projectFolder, "out")
const tempListFile = path.join(projectFolder, "input.txt")
const combinedAudio = path.join(outputDir, "combined.mp3")
const outputVideo = path.join(outputDir, "final_video.mp4")
const imageBackground = path.join(inputDir, "background.jpg")

// Create ffmpeg concat list
const mp3Files = fs
  .readdirSync(inputDir)
  .filter((file) => file.endsWith(".mp3"))
  .sort()

const listFileContent = mp3Files
  .map((file) => {
    let fullPath = path.resolve(inputDir, file).replace(/\\/g, "/")
    fullPath = fullPath.replace(/'/g, `'\\''`)
    return `file '${fullPath}'`
  })
  .join("\n")

fs.writeFileSync(tempListFile, listFileContent)

const combineAudio = (): Promise<void> =>
  new Promise((resolve, reject) => {
    ffmpeg()
      .input(tempListFile)
      .inputOptions("-f", "concat", "-safe", "0")
      .outputOptions("-c", "copy")
      .output(combinedAudio)
      .on("end", resolve)
      .on("error", reject)
      .run()
  })

const makeVideo = (): Promise<void> =>
  new Promise((resolve, reject) => {
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

// Run
;(async () => {
  const startTime = Date.now()

  try {
    console.log("Combining audio...")
    await combineAudio()

    console.log("Creating video...")
    await makeVideo()

    const endTime = Date.now()
    const elapsed = formatDuration(endTime - startTime)

    console.log(`✅ Done! Job was done in ${elapsed}. Output: ${outputVideo}`)

    fs.unlinkSync(tempListFile)
    fs.unlinkSync(combinedAudio)
  } catch (error) {
    console.error("❌ Error:", error)
  }
})()
