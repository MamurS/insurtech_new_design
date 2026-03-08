// Cloudflare Pages Function — proxies requests to CBU.uz API
// This avoids CORS issues since the CBU API doesn't set Access-Control-Allow-Origin

export const onRequest: PagesFunction = async (context) => {
  // Handle CORS preflight
  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Accept',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  const url = new URL(context.request.url);
  const date = url.searchParams.get('date');

  const cbuUrl = date
    ? `https://cbu.uz/uz/arkhiv-kursov-valyut/json/all/${date}/`
    : `https://cbu.uz/uz/arkhiv-kursov-valyut/json/`;

  try {
    const response = await fetch(cbuUrl, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: `CBU returned ${response.status}` }), {
        status: response.status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const data = await response.text();

    return new Response(data, {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
};
