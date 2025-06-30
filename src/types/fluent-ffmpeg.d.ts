declare module "fluent-ffmpeg" {
  import stream = require("stream")

  type FfmpegCommand = {
    input: (path: string | stream.Readable) => FfmpegCommand
    inputOptions: (...args: string[]) => FfmpegCommand
    outputOptions: (...args: string[]) => FfmpegCommand
    complexFilter: (filters: string[] | string, map?: string[]) => FfmpegCommand
    size: (size: string) => FfmpegCommand
    loop: () => FfmpegCommand
    output: (path: string) => FfmpegCommand
    on: (event: "end" | "error", handler: (arg?: any) => void) => FfmpegCommand
    run: () => void
  }

  interface FfmpegModule {
    (input?: string | stream.Readable): FfmpegCommand
    setFfmpegPath: (path: string) => void
    setFfprobePath: (path: string) => void // ✅ Add this
    ffprobe: (
      filePath: string,
      callback: (err: Error | null, metadata: any) => void
    ) => void
  }

  const ffmpeg: FfmpegModule
  export = ffmpeg
}
