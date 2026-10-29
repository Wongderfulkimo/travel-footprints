// Vercel Serverless Function：代理高德 JS API 安全服务与 Web 服务请求。
// Vercel 环境变量：AMAP_KEY、AMAP_SECURITY_CODE

export default async function handler(req, res) {
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const path = String(req.query?.path || '').replace(/^\/+/, '');

  // 只返回公开 Key，绝不返回安全密钥。
  if (path === 'config') {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ key: process.env.AMAP_KEY || '' });
  }

  if (!path || path.includes('..') || path.includes('://')) {
    return res.status(400).json({ error: 'Invalid AMap path' });
  }

  const base = /^(v4\/map\/styles|v3\/vectormap)/.test(path)
    ? 'https://webapi.amap.com/'
    : 'https://restapi.amap.com/';
  const target = new URL(path, base);

  for (const [key, value] of Object.entries(req.query || {})) {
    if (key === 'path' || value == null) continue;
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) target.searchParams.append(key, String(item));
  }

  target.searchParams.set('key', process.env.AMAP_KEY || '');
  target.searchParams.set('jscode', process.env.AMAP_SECURITY_CODE || '');

  try {
    const upstream = await fetch(target, { method: req.method });
    const body = await upstream.arrayBuffer();
    res.status(upstream.status);
    const contentType = upstream.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-store');
    return res.send(Buffer.from(body));
  } catch (error) {
    console.error('AMap proxy error', error);
    return res.status(502).json({ error: 'AMap upstream unavailable' });
  }
}
