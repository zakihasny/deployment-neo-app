import { closeDatabaseConnections } from '../utils/database'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('close', closeDatabaseConnections)
})
