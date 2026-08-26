import type { Pool, Post, Profile, PoolRecord } from "../db";

export interface ApiErrorResponse {
  error: string;
  code: string;
}

export interface DebugSnapshot {
  posts: Post[];
  profiles: Profile[];
  pools: PoolRecord[];
  generated_at: string;
  post_count: number;
  profile_count: number;
  pool_count: number;
}

export interface PaginationResponse {
  limit: number;
  offset: number;
  has_more: boolean;
}

export interface ProfileResponse extends Profile {}

export interface PostResponse extends Post {}

export interface PostListResponse extends PaginationResponse {
  posts: Post[];
  total: number;
}

export interface FollowersResponse extends PaginationResponse {
  address: string;
  followers: string[];
  total: number;
  next_offset: number | null;
  prev_offset: number | null;
}

export interface FollowingResponse extends PaginationResponse {
  address: string;
  following: string[];
  total: number;
  next_offset: number | null;
  prev_offset: number | null;
}

export interface PoolResponse extends PoolRecord {
  token_name?: string;
  token_symbol?: string;
  token_decimals?: number;
}

export interface PoolListResponse extends PaginationResponse {
  pools: PoolResponse[];
  total: number;
}

export interface SearchPost {
  id: number;
  author: string;
  content: string;
  tip_total: string;
  timestamp: number;
}

export interface SearchResponse {
  posts: SearchPost[];
  total: number;
  has_more: boolean;
  next_offset: number | null;
  prev_offset: number | null;
}
