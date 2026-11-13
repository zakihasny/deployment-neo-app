import { checkDatabase } from '../utils/database'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  return await checkDatabase()
})
