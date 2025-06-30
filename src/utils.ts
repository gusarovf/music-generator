export const formatDuration = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return `${hours}:${String(minutes).padStart(2, "0")}:${String(
    seconds
  ).padStart(2, "0")}`
}

export const getTimestampFolderName = (): string => {
  const now = new Date()
  const pad = (n: number): string => n.toString().padStart(2, "0")

  const date = `${pad(now.getDate())}.${pad(
    now.getMonth() + 1
  )}.${now.getFullYear()}`
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(
    now.getSeconds()
  )}`

  return `${date} ${time}`
}
