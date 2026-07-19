import { z } from "npm:zod@4.4.3";

import {
  type AladinBestseller,
  aladinBestsellerResponseSchema,
} from "./schema.ts";

const ALADIN_BESTSELLER_ENDPOINT =
  "https://www.aladin.co.kr/ttb/api/ItemList.aspx";

/** 알라딘 응답의 선택 텍스트를 앱에서 사용할 null 가능 값으로 정리한다. */
function normalizeOptionalText(
  value: string | null | undefined,
): string | null {
  const normalized = value?.trim();
  return normalized || null;
}

/** 쉼표로 이어진 저자 이름을 카드에서 표시할 배열로 변환한다. */
function parseAuthors(value: string): string[] {
  return value.split(",").map((author) => author.trim()).filter(Boolean);
}

/** 알라딘 베스트셀러 목록 요청 URL을 서버 전용 키와 고정 조건으로 만든다. */
export function createAladinBestsellerUrl(ttbKey: string): URL {
  const url = new URL(ALADIN_BESTSELLER_ENDPOINT);
  url.searchParams.set("TTBKey", ttbKey);
  url.searchParams.set("QueryType", "Bestseller");
  url.searchParams.set("MaxResults", "6");
  url.searchParams.set("SearchTarget", "Book");
  url.searchParams.set("output", "JS");
  url.searchParams.set("Version", "20131101");
  url.searchParams.set("Cover", "MidBig");
  return url;
}

/** 검증된 알라딘 항목을 Talk후감 베스트셀러 카드 모델로 변환한다. */
function mapAladinBestseller(
  item: z.infer<typeof aladinBestsellerResponseSchema>["item"][number],
): AladinBestseller {
  const externalUrl = normalizeOptionalText(item.link);
  const thumbnailUrl = normalizeOptionalText(item.cover);

  return {
    authors: parseAuthors(item.author),
    externalUrl,
    id: normalizeOptionalText(item.isbn13) ?? externalUrl ?? item.title,
    publisher: normalizeOptionalText(item.publisher),
    thumbnailUrl,
    title: item.title,
  };
}

/** 알라딘 Open API에 베스트셀러를 요청하고 필요한 카드 데이터만 반환한다. */
export async function fetchAladinBestsellers(
  ttbKey: string,
  fetcher: typeof fetch = fetch,
): Promise<AladinBestseller[]> {
  const response = await fetcher(createAladinBestsellerUrl(ttbKey), {
    headers: { accept: "application/json" },
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(`Aladin bestseller request failed: ${response.status}`);
  }

  const value: unknown = await response.json();
  return aladinBestsellerResponseSchema.parse(value).item.map(
    mapAladinBestseller,
  );
}
