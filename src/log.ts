
export const secondsToFriendly = (seconds: number) => {
  if (seconds < 60) {
    return `${seconds}s`
  } else if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  } else {
    return `${Math.floor(seconds / 3600)}h ${Math.floor(seconds / 60) % 60}m`
  }
}

export const secondsToDateTime = (seconds: number) => {
  return new Date(Date.now() + new Date(seconds * 1000).getTime()).toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' })
}