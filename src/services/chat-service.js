/**
 * Chat Service Bridge
 * Provides a stable handleChat(request, env, ctx, sessionManager?) API and
 * delegates to the generic context-based handler in stubs.
 */

import { handleChat as handleChatStub } from "./stubs.js";
import { createKVCache } from "../lib/cache.js";

export async function handleChat(request, env, ctx, sessionManager) {
  // Build minimal context compatible with service handlers
  const context = {
    request,
    env,
    ctx,
    cache: createKVCache(env.PLATFORM_CACHE || env.CACHE),
    userDb: env.PLATFORM_DB || env.USER_DB,
    platformDb: env.PLATFORM_DB,
    cacheDb: env.PLATFORM_CACHE || env.CACHE,
    vectors: env.PLATFORM_VECTORS || env.VECTORS,
    data: env.PLATFORM_STORAGE || env.DATA,
    sessionManager,
  };

  return handleChatStub(context);
}

export default { handleChat };

