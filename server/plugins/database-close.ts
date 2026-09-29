import { closeDatabasePool } from '../utils/database'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('close', closeDatabasePool)
})
