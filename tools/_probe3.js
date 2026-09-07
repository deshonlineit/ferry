const https = require('https');
function get(u, headers) {
  return new Promise((resolve, reject) => {
    const req = https.get(u, { headers: headers || {} }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, html: d }));
    });
    req.on('error', reject);
  });
}
const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
(async () => {
  const r = await get('https://www.mobileparts.shop/en/articles/accessories/brand:153:apple/model:689:iphone-11-pro', { 'User-Agent': ua, 'Accept': 'text/html', 'Accept-Language': 'en-US,en;q=0.9' });
  console.log('status', r.status, 'len', r.html.length, 'has class="category":', r.html.includes('class="category"'));
})().catch(e => console.log('ERR', e.message));
