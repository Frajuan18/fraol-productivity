import '@/lib/server-only';
import type { Document, WithId } from 'mongodb';
import { getCollection } from '@/lib/mongodb/connection';

export interface Filter {
  [key: string]: unknown;
}

export interface UpdateDoc {
  [key: string]: unknown;
}

export interface CollectionLike<T extends Document> {
  findOne(filter: Filter): Promise<WithId<T> | null>;
  find(filter: Filter, options?: { sort?: Record<string, 1 | -1>; limit?: number }): Promise<WithId<T>[]>;
  insertOne(doc: T): Promise<string>;
  updateOne(filter: Filter, update: UpdateDoc, options?: { upsert?: boolean }): Promise<boolean>;
  updateMany(filter: Filter, update: UpdateDoc): Promise<number>;
  deleteOne(filter: Filter): Promise<boolean>;
  deleteMany(filter: Filter): Promise<number>;
  countDocuments(filter: Filter): Promise<number>;
}

export interface DbPort {
  collection<T extends Document>(name: string): CollectionLike<T>;
}

function toPlain<T extends Document>(doc: WithId<T>): WithId<T> {
  // Convert BSON _id (ObjectId) into a serialisable string where necessary.
  if (doc._id && typeof doc._id !== 'string' && typeof doc._id !== 'number') {
    return { ...doc, _id: String(doc._id) } as unknown as WithId<T>;
  }
  return doc;
}

/** Real adapter over the MongoDB driver. Used only on the server. */
export function createRealDbPort(): DbPort {
  return {
    collection<T extends Document>(name: string): CollectionLike<T> {
      const collection = (async () => getCollection<T>(name))();
      const resolve = async () => collection;
      return {
        async findOne(filter) {
          const col = await resolve();
          const doc = await col.findOne(filter as never);
          return doc ? toPlain(doc) : null;
        },
        async find(filter, options) {
          const col = await resolve();
          let cursor = col.find(filter as never);
          if (options?.sort) cursor = cursor.sort(options.sort as never);
          if (options?.limit) cursor = cursor.limit(options.limit);
          const docs = await cursor.toArray();
          return docs.map(toPlain);
        },
        async insertOne(doc) {
          const col = await resolve();
          const result = await col.insertOne(doc as never);
          return result.insertedId instanceof Object
            ? (result.insertedId as unknown as { toString(): string }).toString()
            : String(result.insertedId);
        },
        async updateOne(filter, update, options) {
          const col = await resolve();
          const result = await col.updateOne(filter as never, update as never, { upsert: options?.upsert });
          return result.modifiedCount > 0 || result.upsertedCount > 0;
        },
        async updateMany(filter, update) {
          const col = await resolve();
          const result = await col.updateMany(filter as never, update as never);
          return result.modifiedCount;
        },
        async deleteOne(filter) {
          const col = await resolve();
          const result = await col.deleteOne(filter as never);
          return result.deletedCount > 0;
        },
        async deleteMany(filter) {
          const col = await resolve();
          const result = await col.deleteMany(filter as never);
          return result.deletedCount;
        },
        async countDocuments(filter) {
          const col = await resolve();
          return col.countDocuments(filter as never);
        },
      };
    },
  };
}
