import path from "path"
import fs from "fs"

export type ProjectPaths = {
  projectFolder: string
  inputDir: string
  backgroundDir: string
  audioDir: string
  outputDir: string
  tempListFile: string
  combinedAudio: string
  outputVideo: string
  namesPath: string
  hasCustomNames: boolean
}

export const resolveProjectPaths = (projectArg: string): ProjectPaths => {
  const projectFolder = path.resolve(projectArg)
  const inputDir = path.join(projectFolder, "in")
  const backgroundDir = path.join(inputDir, "background")
  const audioDir = path.join(inputDir, "audio")
  const outputDir = path.join(projectFolder, "out")
  const tempListFile = path.join(projectFolder, "input.txt")
  const combinedAudio = path.join(outputDir, "combined.mp3")
  const outputVideo = path.join(outputDir, "final_video.mp4")
  const namesPath = path.join(inputDir, "track-names.txt")
  const hasCustomNames = fs.existsSync(namesPath)

  return {
    projectFolder,
    inputDir,
    backgroundDir,
    audioDir,
    outputDir,
    tempListFile,
    combinedAudio,
    outputVideo,
    namesPath,
    hasCustomNames,
  }
}
