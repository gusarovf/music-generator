import ffmpeg from "fluent-ffmpeg"

export const getAudioDuration = (filePath: string): Promise<number> =>
  new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err: Error | null, metadata: any) => {
      if (err) return reject(err)
      const duration = metadata.format.duration
      if (typeof duration !== "number") return reject("No duration found")
      resolve(duration)
    })
  })
