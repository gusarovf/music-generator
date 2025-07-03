import fs from "fs"
import path from "path"
import { getTimestampFolderName } from "./utils"

const createNewProjectFolder = (): void => {
  const baseProjects = path.resolve(__dirname, "..", "projects")
  const folderName = getTimestampFolderName()
  const root = path.join(baseProjects, folderName)
  const inputDir = path.join(root, "in")
  const backgroundDir = path.join(inputDir, "background")
  const audioDir = path.join(inputDir, "audio")
  const outputDir = path.join(root, "out")

  if (!fs.existsSync(baseProjects)) fs.mkdirSync(baseProjects)
  fs.mkdirSync(root)
  fs.mkdirSync(inputDir)
  fs.mkdirSync(backgroundDir)
  fs.mkdirSync(audioDir)
  fs.mkdirSync(outputDir)

  console.log(
    `✅ Created project folder: ${path.relative(process.cwd(), root)}`
  )
}

createNewProjectFolder()
