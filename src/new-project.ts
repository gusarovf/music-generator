import fs from "fs"
import path from "path"
import { getTimestampFolderName } from "./utils"

const createNewProjectFolder = (): void => {
  const baseProjects = path.resolve(__dirname, "..", "projects")

  const customName = process.argv[2] // optional argument
  const folderName = customName?.trim() || getTimestampFolderName()

  const root = path.join(baseProjects, folderName)
  const inputDir = path.join(root, "in")
  const audioDir = path.join(inputDir, "audio")
  const backgroundDir = path.join(inputDir, "background")
  const outputDir = path.join(root, "out")
  const trackNamesFile = path.join(audioDir, "track-names.txt")

  if (!fs.existsSync(baseProjects)) fs.mkdirSync(baseProjects)
  fs.mkdirSync(root)
  fs.mkdirSync(inputDir)
  fs.mkdirSync(audioDir)
  fs.mkdirSync(backgroundDir)
  fs.mkdirSync(outputDir)
  fs.writeFileSync(trackNamesFile, "") // create empty track-names.txt

  console.log(
    `✅ Created project folder: ${path.relative(process.cwd(), root)}`
  )
}

createNewProjectFolder()
