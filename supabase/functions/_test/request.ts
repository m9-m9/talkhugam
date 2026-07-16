type RequestOptions = {
  authorization?: string
  headers?: HeadersInit
  method?: string
}

export function createJsonRequest(
  path: string,
  body: unknown,
  options: RequestOptions = {},
): Request {
  const headers = new Headers(options.headers)
  headers.set('content-type', 'application/json')
  if (options.authorization) headers.set('authorization', options.authorization)

  return new Request(`http://127.0.0.1:54321/functions/v1/${path}`, {
    method: options.method ?? 'POST',
    headers,
    body: JSON.stringify(body),
  })
}
