export interface OrderableItem {
  id: string;
  created_at?: number;
}

export class ListOrdering {
  static orderByCreationTime<T extends OrderableItem>(items: T[]): T[] {
    return [...items].sort((a, b) => {
      const timeA = a.created_at || 0;
      const timeB = b.created_at || 0;
      if (timeA !== timeB) return timeA - timeB;
      return a.id.localeCompare(b.id);
    });
  }

  static orderById<T extends OrderableItem>(items: T[]): T[] {
    return [...items].sort((a, b) => a.id.localeCompare(b.id));
  }

  static paginateDeterministic<T extends OrderableItem>(items: T[], page: number, pageSize: number): T[] {
    const sorted = this.orderByCreationTime(items);
    const start = (page - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }

  static ensureStableOrder<T extends OrderableItem>(items: T[]): T[] {
    return this.orderByCreationTime(items);
  }
}
