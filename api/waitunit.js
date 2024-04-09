async function getSession(reqUrl) {
  const res = await fetch(`${reqUrl.origin}/api/cron`);;
  return res.json();
}

export function GET(request, context) {
  let reqUrl = new URL(request.url);
  context.waitUntil(
    (getSession(reqUrl).then((json) => console.log({ json })))
  );

  return new Response(`waitunit start!`);
}
