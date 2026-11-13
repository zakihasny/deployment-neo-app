import { createDatabaseChecker } from '../db/checker'
import { createMultiDatabaseChecker } from '../db/multi-checker'
const databaseChecker = createDatabaseChecker()
const multiChecker = createMultiDatabaseChecker()
export const checkDatabase = () => databaseChecker.check()
export const checkDatabases = () => multiChecker.check()
export const closeDatabaseConnections = async () => { await Promise.all([databaseChecker.close(), multiChecker.close()]) }
