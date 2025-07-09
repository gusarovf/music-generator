import path from "path"
import fs from "fs"
import ffmpeg from "fluent-ffmpeg"
import { createLoopedBackground } from "./createLoopedBackground"
import { getAudioDuration } from "../audio"

export const generateVideo = async (
  backgroundDir: string,
  outputDir: string,
  combinedAudioPath: string,
  outputVideoPath: string
): Promise<void> => {
  const backgroundCandidates = fs
    .readdirSync(backgroundDir)
    .filter((f) => f.match(/\.(jpg|jpeg|png|mp4|mov|mkv)$/i))
    .sort()

  if (backgroundCandidates.length === 0) {
    throw new Error("No background image or video found in background folder.")
  }

  const imageFile = backgroundCandidates.find((f) =>
    f.match(/\.(jpg|jpeg|png)$/i)
  )
  const videoFiles = backgroundCandidates.filter((f) =>
    f.match(/\.(mp4|mov|mkv)$/i)
  )

  const audioDuration = await getAudioDuration(combinedAudioPath)

  let backgroundInput: string
  let useLoopFlag = false

  if (videoFiles.length === 1) {
    // Single video, just loop it
    backgroundInput = path.join(backgroundDir, videoFiles[0])
    useLoopFlag = true
  } else if (videoFiles.length > 1) {
    // Multiple videos: generate looped background
    backgroundInput = path.join(outputDir, "looped_background.mp4")
    await createLoopedBackground(backgroundDir, backgroundInput, audioDuration)
  } else if (imageFile) {
    // Fallback to static image
    backgroundInput = path.join(backgroundDir, imageFile)
    useLoopFlag = true
  } else {
    throw new Error("No suitable background found.")
  }

  return new Promise((resolve, reject) => {
    const cmd = ffmpeg().input(backgroundInput)

    if (useLoopFlag) {
      if (imageFile) {
        cmd.loop().inputOptions("-t", audioDuration.toString())
      } else {
        cmd.inputOptions("-stream_loop", "-1")
      }
    }

    cmd
      .input(combinedAudioPath)
      .outputOptions(
        "-c:v",
        "libx264",
        "-c:a",
        "aac",
        "-q:a",
        "0",
        "-shortest",
        "-pix_fmt",
        "yuv420p"
      )
      .size("1280x720")
      .output(outputVideoPath)
      .on("end", resolve)
      .on("error", reject)
      .run()
  })
}
