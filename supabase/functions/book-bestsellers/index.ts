import { z } from "npm:zod@4.4.3";

import {
  createRequestId,
  failureResponse,
  successResponse,
} from "../_shared/api.ts";
import { createCorsHeaders, optionsResponse } from "../_shared/cors.ts";
import { readOptionalEnv } from "../_shared/env.ts";
import {
  createAdminClient,
  getAuthenticatedContext,
} from "../_shared/supabase.ts";
import { fetchAladinBestsellers } from "./aladin.ts";

/** 사용자별 베스트셀러 조회 빈도를 확인하고 허용 여부를 반환한다. */
async function consumeBestsellerLimit(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("consume_rate_limit", {
    p_bucket: "book-bestsellers",
    p_subject: userId,
    p_limit: 30,
    p_window_seconds: 60,
  });

  if (error) throw error;
  return z.boolean().parse(data);
}

/** 알라딘 베스트셀러 요청과 인증·제한·환경 경계를 처리한다. */
export async function handleBookBestsellers(
  request: Request,
): Promise<Response> {
  const preflight = optionsResponse(request);
  if (preflight) return preflight;

  const requestId = createRequestId(request);
  const headers = createCorsHeaders(request);

  if (request.method !== "POST") {
    return failureResponse(
      { code: "VALIDATION_FAILED", message: "지원하지 않는 요청입니다." },
      requestId,
      405,
      headers,
    );
  }

  const auth = await getAuthenticatedContext(request);
  if (!auth) {
    return failureResponse(
      { code: "AUTH_REQUIRED", message: "로그인이 필요합니다." },
      requestId,
      401,
      headers,
    );
  }

  const ttbKey = readOptionalEnv("ALADIN_TTB_KEY");
  if (!ttbKey) {
    return successResponse(
      { isConfigured: false, items: [] },
      requestId,
      headers,
    );
  }

  try {
    const isAllowed = await consumeBestsellerLimit(auth.user.id);
    if (!isAllowed) {
      return failureResponse(
        {
          code: "RATE_LIMITED",
          message: "잠시 후 다시 불러와 주세요.",
          retryable: true,
        },
        requestId,
        429,
        headers,
      );
    }

    const items = await fetchAladinBestsellers(ttbKey);
    return successResponse({ isConfigured: true, items }, requestId, headers);
  } catch {
    return failureResponse(
      {
        code: "BOOK_SEARCH_FAILED",
        message: "베스트셀러를 불러오지 못했어요.",
        retryable: true,
      },
      requestId,
      502,
      headers,
    );
  }
}

if (import.meta.main) Deno.serve(handleBookBestsellers);
