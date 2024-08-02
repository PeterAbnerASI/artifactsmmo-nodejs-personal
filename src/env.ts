import dotenv from 'dotenv'

const env = dotenv.config({ path: '.env' }).parsed

export const SERVER_URL = process.env.SERVER_URL || env.SERVER_URL || 'https://api.artifactsmmo.com'
export const JWT_TOKEN = process.env.JWT_TOKEN || env.JWT_TOKEN
export const CHARACTER_NAME = process.env.CHARACTER_NAME || env.CHARACTER_NAME