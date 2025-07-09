import ffmpeg from "fluent-ffmpeg"
import path from "path"
import { config } from "../../config"
import { getAudioDuration } from "."

export const combineAudioWithFade = async (
  audioFiles: string[],
  inputDir: string,
  outputPath: string
): Promise<number[]> => {
  const fade = config.fadeDuration
  const command = ffmpeg()

  const durations: number[] = []

  console.log("🎵 Gathering durations...")
  for (const file of audioFiles) {
    const fullPath = path.join(inputDir, file)
    command.input(fullPath)
    const duration = await getAudioDuration(fullPath)
    durations.push(duration)
    console.log(`  • ${file} — ${duration.toFixed(3)}s`)
  }

  const filterParts: string[] = []
  const fadeInputs: string[] = []

  audioFiles.forEach((_, index) => {
    const inputLabel = `[${index}:a]`
    const label = `a${index}`
    fadeInputs.push(`[${label}]`)

    const duration = durations[index]
    const filters = []

    if (index !== 0) {
      filters.push(`afade=t=in:st=0:d=${fade}`)
    }

    if (index !== audioFiles.length - 1 && duration > fade) {
      const safeStart = Math.max(0, duration - fade).toFixed(3)
      filters.push(`afade=t=out:st=${safeStart}:d=${fade}`)
    }

    const chain = filters.length
      ? `${inputLabel}${filters.join(",")}[${label}]`
      : `${inputLabel}[${label}]`

    filterParts.push(chain)
  })

  // Final concat
  filterParts.push(
    `${fadeInputs.join("")}concat=n=${audioFiles.length}:v=0:a=1[outa]`
  )

  console.log("🔍 Final filter graph:\n", filterParts.join(",\n"))

  console.log("🧪 Chain for each input:")
  filterParts.forEach((part) => console.log("  ", part))

  return new Promise((resolve, reject) => {
    command
      .complexFilter(filterParts)
      .outputOptions("-map", "[outa]")
      .output(outputPath)
      .on("end", resolve)
      .on("error", reject)
      .run()

    resolve(durations)
  })
}
