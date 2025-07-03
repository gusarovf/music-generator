import ffmpeg from "fluent-ffmpeg"
import path from "path"
import { config } from "../../config"
import { getAudioDuration } from ".";

export const combineAudioWithPause = async (
  mp3Files: string[],
  inputDir: string,
  outputPath: string,
  pauseDuration: number
): Promise<{ durations: number[]; startTimes: number[] }> => {
  const command = ffmpeg()
  const inputLabels: string[] = []
  const durations: number[] = []
  const startTimes: number[] = []

  let inputIndex = 0
  let currentStart = 0

  console.log("🎧 Preparing audio inputs with pauses...")

  for (let i = 0; i < mp3Files.length; i++) {
    const mp3Path = path.join(inputDir, mp3Files[i])
    const duration = await getAudioDuration(mp3Path)

    durations.push(duration)
    startTimes.push(currentStart)

    console.log(
      `  • ${mp3Files[i]} — ${duration.toFixed(
        3
      )}s (start at ${currentStart.toFixed(3)}s)`
    )

    // Add MP3 file
    command.input(mp3Path)
    inputLabels.push(`[${inputIndex++}:a]`)

    currentStart += duration

    // Add silence between tracks
    if (i < mp3Files.length - 1) {
      console.log(`    ⏸ Adding ${pauseDuration}s silence after this track`)
      command.input("anullsrc=r=44100:cl=stereo")
      command.inputOptions("-f", "lavfi", "-t", pauseDuration.toString())
      inputLabels.push(`[${inputIndex++}:a]`)
      currentStart += pauseDuration
    }
  }

  const concatFilter = `${inputLabels.join("")}concat=n=${
    inputLabels.length
  }:v=0:a=1[outa]`
  console.log("🔧 FFmpeg concat filter:", concatFilter)

  return new Promise((resolve, reject) => {
    command
      .complexFilter([concatFilter])
      .outputOptions("-map", "[outa]")
      .output(outputPath)
      .on("start", (cmd) => console.log("🚀 FFmpeg started:", cmd))
      .on("end", () => {
        console.log(`✅ Silence-concat complete → ${outputPath}`)
        resolve({ durations, startTimes })
      })
      .on("error", (err) => {
        console.error("❌ FFmpeg error:", err)
        reject(err)
      })
      .run()
  })
}
