import path from "path"
import fs from "fs"
import ffmpeg from "fluent-ffmpeg"
import ffmpegPath from "ffmpeg-static"

// Explicitly tell fluent-ffmpeg to use the local ffmpeg binary
ffmpeg.setFfmpegPath(ffmpegPath)

// Always work from the project root
const projectRoot = path.resolve(__dirname, "..")

const audioDir = path.join(projectRoot, "mp3s")
const tempListFile = path.join(projectRoot, "input.txt")
const combinedAudio = path.join(projectRoot, "combined.mp3")
const outputVideo = path.join(projectRoot, "final_video.mp4")
const imageBackground = path.join(projectRoot, "background.jpg")

// Step 1: Create ffmpeg input list file
const mp3Files = fs
  .readdirSync(audioDir)
  .filter((file) => file.endsWith(".mp3"))
  .sort()

const listFileContent = mp3Files
  .map((file) => {
    let fullPath = path.resolve(audioDir, file).replace(/\\/g, "/")
    fullPath = fullPath.replace(/'/g, `'\\''`) // escape single quotes
    return `file '${fullPath}'`
  })
  .join("\n")

fs.writeFileSync(tempListFile, listFileContent)

// Step 2: Combine MP3s into one audio track
const combineAudio = () =>
  new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(tempListFile)
      .inputOptions("-f", "concat", "-safe", "0")
      .outputOptions("-c", "copy")
      .output(combinedAudio)
      .on("end", resolve)
      .on("error", reject)
      .run()
  })

// Step 3: Create video using a background image and the combined audio
const makeVideo = () =>
  new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(imageBackground)
      .loop() // loop the image to match audio
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

// Main
;(async () => {
  try {
    console.log("Combining audio...")
    await combineAudio()

    console.log("Creating video...")
    await makeVideo()

    console.log(`✅ Done! Output: ${outputVideo}`)
    fs.unlinkSync(tempListFile) // cleanup
  } catch (error) {
    console.error("❌ Error:", error)
  }
})()
