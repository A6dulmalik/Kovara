export interface Pool {
  pool_id: string;
  token: string;
  balance: bigint;
  admins: string[];
  threshold: number;
  min_reward: bigint;
  max_reward: bigint;
}

export interface Post {
  id: string;
  author: string;
  content: string;
  tip_total: number | string;
  like_count?: number | string;
  created_at?: string | null;
}
