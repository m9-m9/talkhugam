import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1.0.14";

import { createAladinBestsellerUrl, fetchAladinBestsellers } from "./aladin.ts";

Deno.test("createAladinBestsellerUrl keeps the TTB key in the server request and requests book bestsellers", () => {
  const url = createAladinBestsellerUrl("server-secret");

  assertEquals(
    url.origin + url.pathname,
    "https://www.aladin.co.kr/ttb/api/ItemList.aspx",
  );
  assertEquals(url.searchParams.get("TTBKey"), "server-secret");
  assertEquals(url.searchParams.get("QueryType"), "Bestseller");
  assertEquals(url.searchParams.get("SearchTarget"), "Book");
  assertEquals(url.searchParams.get("MaxResults"), "6");
});

Deno.test("fetchAladinBestsellers maps only the card data needed by the app", async () => {
  let requestedUrl = "";
  const fetcher: typeof fetch = (request) => {
    requestedUrl = String(request);
    return Promise.resolve(
      new Response(
        JSON.stringify({
          item: [
            {
              author: "기시미 이치로, 고가 후미타케",
              cover: "https://image.aladin.co.kr/product/1/1/cover500/1.jpg",
              isbn13: "9788996991342",
              link: "https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=1",
              publisher: "인플루엔셜",
              title: "미움받을 용기",
            },
          ],
        }),
        { status: 200 },
      ),
    );
  };

  const result = await fetchAladinBestsellers("server-secret", fetcher);

  assertStringIncludes(requestedUrl, "TTBKey=server-secret");
  assertEquals(result, [
    {
      authors: ["기시미 이치로", "고가 후미타케"],
      externalUrl: "https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=1",
      id: "9788996991342",
      publisher: "인플루엔셜",
      thumbnailUrl: "https://image.aladin.co.kr/product/1/1/cover500/1.jpg",
      title: "미움받을 용기",
    },
  ]);
});
