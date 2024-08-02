import { readFile, writeFile, mkdir } from "fs/promises"

let _innerCache: Record<string, any> = {}

let ensureCacheDir = false
export const ensureCacheDirExists = async () => {
  if (ensureCacheDir) { return }
  await mkdir('./cache').catch(() => null)
  await writeFile('./cache/.gitkeep', '')
  ensureCacheDir = true
}

export const getCached = async <T>(key: string, retriever: () => Promise<T>): Promise<T> => {
  if (_innerCache[key]) {
    return _innerCache[key]
  }
  try {
    await ensureCacheDirExists()
    const cachedValue = await readFile(`./cache/${key}.json`, 'utf-8').catch(() => null)
    if (!cachedValue) { throw new Error('No cache') }
    _innerCache[key] = JSON.parse(cachedValue)
    return _innerCache[key]
  } catch (e) {
    const value = await retriever()
    await writeFile(`./cache/${key}.json`, JSON.stringify(value, null, 2), 'utf-8')
    _innerCache[key] = value
    return value
  }
}