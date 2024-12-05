const content = `User-Agent: *\nAllow: /\n`;

export default function (_req: Request): Response {
  return new Response(content, {
    status: 200,
    statusText: 'OK',
    headers: {
      'content-type': 'text/plain',
      'content-lenght': String(content.length),
    },
  });
}
