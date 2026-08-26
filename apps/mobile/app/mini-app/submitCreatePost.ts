/**
 * Perform a post submission.
 *
 * This lives in its own module rather than inside the screen so the failure
 * path is reachable from a test. `jest.spyOn` on a screen's own export does
 * not intercept the screen's internal call — Babel's CommonJS output keeps
 * that reference pointing at the local binding — so an inline closure or a
 * same-module export offers no seam at all.
 *
 * It deliberately does not resolve the pending bridge request. That happens
 * only after this resolves, so a failed submission cannot leave a mini-app
 * request marked as answered.
 */
export async function submitCreatePost(content: string): Promise<string> {
  // Simulate brief network delay
  await new Promise((r) => setTimeout(r, 300));

  return `post_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
