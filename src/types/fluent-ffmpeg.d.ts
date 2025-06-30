declare module "fluent-ffmpeg" {
  import stream = require("stream")

  type FfmpegCommand = {
    input: (path: string | stream.Readable) => FfmpegCommand
    inputOptions: (...args: string[]) => FfmpegCommand
    outputOptions: (...args: string[]) => FfmpegCommand
    size: (size: string) => FfmpegCommand
    loop: () => FfmpegCommand
    output: (path: string) => FfmpegCommand
    on: (event: "end" | "error", handler: (arg?: any) => void) => FfmpegCommand
    run: () => void
  }

  interface FfmpegModule {
    (input?: string | stream.Readable): FfmpegCommand
    setFfmpegPath: (path: string) => void
  }

  const ffmpeg: FfmpegModule
  export = ffmpeg
}
