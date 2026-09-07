const https = require('https');
function get(u) {
  return new Promise((resolve, reject) => {
    https.get(u, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({status: res.statusCode, html: d}));
    }).on('error', reject);
  });
}
(async () => {
  const r = await get('https://www.mobileparts.shop/en/articles/accessories/brand:153:apple/model:689:iphone-11-pro');
  console.log('status', r.status);
  console.log('len', r.html.length);
  console.log('has class="category":', r.html.includes('class="category"'));
  console.log('has background-image:', r.html.includes('background-image'));
  const i = r.html.indexOf('background-image');
  console.log('snippet:', r.html.substring(i - 80, i + 160));
})().catch(e => console.log('ERR', e.message));
