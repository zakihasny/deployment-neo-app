import { createDatabaseChecker } from '../db/checker'

const databaseChecker = createDatabaseChecker()

export const checkDatabase = () => databaseChecker.check()
export const closeDatabaseConnections = () => databaseChecker.close()
