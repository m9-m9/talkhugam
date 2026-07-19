import { assertEquals } from "jsr:@std/assert@1.0.14";

import { handleBookBestsellers } from "./index.ts";

Deno.test("베스트셀러 조회는 로그인하지 않은 요청을 거부한다", async () => {
  const request = new Request(
    "http://127.0.0.1:54321/functions/v1/book-bestsellers",
    {
      method: "POST",
    },
  );

  const response = await handleBookBestsellers(request);

  assertEquals(response.status, 401);
  assertEquals((await response.json()).error.code, "AUTH_REQUIRED");
});

Deno.test("베스트셀러 조회는 POST 요청만 받는다", async () => {
  const request = new Request(
    "http://127.0.0.1:54321/functions/v1/book-bestsellers",
  );

  const response = await handleBookBestsellers(request);

  assertEquals(response.status, 405);
});
