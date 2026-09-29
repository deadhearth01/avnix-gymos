import "server-only";
import { ID, Permission, Query, Role, type Models } from "node-appwrite";
import { adminClient, isAppwriteError } from "@/lib/appwrite/server";
import { DB_ID, TABLES, type TableId } from "@/lib/appwrite/schema";
import { invalidateGym } from "@/lib/data/cache";

const ACCESS = new Map(TABLES.map((t) => [t.id, t.access]));

export function rowPermissions(table: TableId, gymId: string): string[] {
  switch (ACCESS.get(table)) {
    case "team":
      return [Permission.read(Role.team(gymId))];
    case "team-admin":
      return [Permission.read(Role.team(gymId, "owner")), Permission.read(Role.team(gymId, "manager"))];
    default:
      return [];
  }
}

export class NotFoundError extends Error {
  constructor(what = "Record") {
    super(`${what} not found`);
    this.name = "NotFoundError";
  }
}

type Data = Record<string, unknown>;

/**
 * node-appwrite parses responses into null-prototype objects, which React
 * refuses to pass to Client Components. Normalise to plain objects once here.
 */
export function plain<T>(v: T): T {
  return structuredClone(v);
}

/**
 * Tenant-scoped data access. Every read is filtered by gymId and every
 * write is stamped with gymId + team read permissions, so one gym can never
 * see or touch another gym's rows — even if an id leaks.
 */
export function repo(gymId: string) {
  const { tables } = adminClient();
  const scope = Query.equal("gymId", gymId);

  async function get<R extends Models.Row>(table: TableId, id: string): Promise<R> {
    try {
      const row = await tables.getRow<R>({ databaseId: DB_ID, tableId: table, rowId: id });
      if ((row as unknown as { gymId?: string }).gymId !== gymId) throw new NotFoundError();
      return plain(row);
    } catch (e) {
      if (isAppwriteError(e, 404) || e instanceof NotFoundError) throw new NotFoundError();
      throw e;
    }
  }

  return {
    gymId,
    async list<R extends Models.Row>(table: TableId, queries: string[] = [], total = true) {
      return plain(await tables.listRows<R>({ databaseId: DB_ID, tableId: table, queries: [scope, ...queries], total }));
    },
    async count(table: TableId, queries: string[] = []) {
      const r = await tables.listRows({ databaseId: DB_ID, tableId: table, queries: [scope, ...queries, Query.limit(1), Query.select(["$id"])], total: true });
      return r.total;
    },
    /** Fetch every matching row (cursor pagination). Capped for safety. */
    async all<R extends Models.Row>(table: TableId, queries: string[] = [], cap = 10000): Promise<R[]> {
      const out: R[] = [];
      let cursor: string | undefined;
      while (out.length < cap) {
        const page = await tables.listRows<R>({
          databaseId: DB_ID,
          tableId: table,
          queries: [scope, ...queries, Query.limit(500), ...(cursor ? [Query.cursorAfter(cursor)] : [])],
          total: false,
        });
        out.push(...plain(page.rows));
        if (page.rows.length < 500) break;
        cursor = page.rows[page.rows.length - 1].$id;
      }
      return out;
    },
    get,
    async find<R extends Models.Row>(table: TableId, id: string): Promise<R | null> {
      try {
        return await get<R>(table, id);
      } catch (e) {
        if (e instanceof NotFoundError) return null;
        throw e;
      }
    },
    async create<R extends Models.Row>(table: TableId, data: Data, id: string = ID.unique()) {
      invalidateGym(gymId);
      return plain(
        await tables.createRow<R>({
          databaseId: DB_ID,
          tableId: table,
          rowId: id,
          data: { ...data, gymId } as never,
          permissions: rowPermissions(table, gymId),
        }),
      );
    },
    async update<R extends Models.Row>(table: TableId, id: string, data: Data) {
      await get(table, id);
      invalidateGym(gymId);
      const { gymId: _drop, ...rest } = data;
      return plain(await tables.updateRow<R>({ databaseId: DB_ID, tableId: table, rowId: id, data: rest as never }));
    },
    async remove(table: TableId, id: string) {
      await get(table, id);
      invalidateGym(gymId);
      await tables.deleteRow({ databaseId: DB_ID, tableId: table, rowId: id });
    },
  };
}

export type Repo = ReturnType<typeof repo>;
