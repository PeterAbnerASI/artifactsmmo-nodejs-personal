import fetch from "node-fetch"
import { JWT_TOKEN, SERVER_URL } from "./env"
import chalk from "chalk"

export const toQueryString = (params: any) => {
  if (!params || Object.keys(params).length === 0) return ""
  return "?" + Object.keys(params)
    .filter(key => params[key] !== undefined)
    .map(key => `${key}=${params[key]}`).join('&')
}

export const fetchApi = async (endpoint: string, method = "GET", body?: object) => {

  console.debug(`${chalk.whiteBright(`[${method}]`)} ${chalk.blue(endpoint)}`)
  
  const response = await fetch(`${SERVER_URL}${endpoint}`, {
    method: method,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: 'Bearer ' + JWT_TOKEN,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const result = await response.json()

  if (result && result.data) {
    if (Object.keys(result).length < 2) {
      return result.data
    } else {
      return result
    }
  } else {
    if (result && result.error) {
      console.error(`Error: ${result.error.code} - ${result.error.message}`)
      throw new Error(result.error.message)
    } else {
      console.error(`Invalid response`, result)
      throw new Error('Invalid response')
    }
  }
}