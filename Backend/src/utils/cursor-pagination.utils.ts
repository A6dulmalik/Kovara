export interface CursorPaginationQuery {
  cursor?: string;
  limit: number;
}

export interface CursorPaginationResult<T> {
  data: T[];
  nextCursor?: string;
  hasMore: boolean;
}

export function encodeCursor(value: string): string {
  return Buffer.from(value).toString('base64');
}

export function decodeCursor(cursor: string): string {
  return Buffer.from(cursor, 'base64').toString('utf-8');
}
