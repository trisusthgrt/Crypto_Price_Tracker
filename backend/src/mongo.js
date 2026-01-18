import mongoose from 'mongoose'
import { config } from './config.js'

export async function connectToMongo({ optional = false } = {}) {
  const uri = config.mongoUri
  const dbName = config.mongoDbName

  if (!uri) {
    if (optional) {
      // eslint-disable-next-line no-console
      console.warn(
        'MONGODB_URI not set. Skipping MongoDB connection (some features will not work).',
      )
      return
    }

    throw new Error('Missing MONGODB_URI. Create a .env (copy from env.example).')
  }

  mongoose.set('strictQuery', true)
  // If Mongo isn't connected, fail fast instead of buffering queries.
  mongoose.set('bufferCommands', false)

  await mongoose.connect(uri, dbName ? { dbName } : undefined)

  // eslint-disable-next-line no-console
  console.log('Connected to MongoDB')
}

