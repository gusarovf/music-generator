import fs from "fs"
import path from "path"
import ffmpeg from "fluent-ffmpeg"
import { getAudioDuration } from "../audio"

export const createLoopedBackground = async (
  inputDir: string,
  outputPath: string,
  requiredDuration: number
): Promise<void> => {
  const videoFiles = fs
    .readdirSync(inputDir)
    .filter((f) => f.match(/\.(mp4|mov|mkv)$/i))
    .sort()

  if (videoFiles.length === 0) {
    throw new Error("No video files found in input folder.")
  }

  const durations = await Promise.all(
    videoFiles.map((file) => getAudioDuration(path.join(inputDir, file)))
  )

  const fullCycleDuration = durations.reduce((a, b) => a + b, 0)
  const repeatCount = Math.ceil(requiredDuration / fullCycleDuration)

  const repeatedList = Array(repeatCount).fill(videoFiles).flat().slice(0, 1000)

  const inputListPath = path.join(path.dirname(outputPath), "video_input.txt")
  const content = repeatedList
    .map((f) => `file '${path.resolve(inputDir, f).replace(/'/g, `'\\''`)}'`)
    .join("\n")
  fs.writeFileSync(inputListPath, content)

  await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(inputListPath)
      .inputOptions("-f", "concat", "-safe", "0")
      .outputOptions("-c", "copy")
      .output(outputPath)
      .on("end", resolve)
      .on("error", reject)
      .run()
  })
}
