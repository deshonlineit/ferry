const https = require('https');
const fs = require('fs');

function get(u) {
  return new Promise((resolve, reject) => {
    https.get(u, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    }).on('error', reject);
  });
}

function extractCategories(html) {
  const map = {};
  // matches: <div class="category"><a ...><span class="image" title="Audio" style="background-image: url(&quot;...&quot;);">
  const re = /class="category"[^>]*>\s*<a[^>]*>\s*<span class="image" title="([^"]+)" style="background-image:\s*url\(&quot;([^&]+)&quot;\)/g;
  let m;
  while ((m = re.exec(html))) {
    let title = m[1].trim();
    let url = m[2].replace(/&amp;/g, '&');
    map[title] = url;
  }
  return map;
}

(async () => {
  const seeds = [
    'https://www.mobileparts.shop/en/articles/accessories/brand:153:apple/model:689:iphone-11-pro',
    'https://www.mobileparts.shop/en/articles/accessories/brand:153:apple/model:690:iphone-12',
    'https://www.mobileparts.shop/en/articles/accessories/brand:154:samsung/model:700:galaxy-s21',
    'https://www.mobileparts.shop/en/articles/accessories/brand:154:samsung/model:701:galaxy-s22',
    'https://www.mobileparts.shop/en/articles/accessories/brand:155:huawei',
    'https://www.mobileparts.shop/en/articles/accessories/brand:156:xiaomi',
    'https://www.mobileparts.shop/en/articles/accessories/brand:153:apple',
    'https://www.mobileparts.shop/en/articles/accessories/brand:154:samsung'
  ];
  const dict = {};
  for (const s of seeds) {
    try {
      const html = await get(s);
      const found = extractCategories(html);
      console.error('seed', s.split('/').pop(), '->', Object.keys(found).length, 'cats');
      Object.assign(dict, found);
    } catch (e) {
      console.error('seed failed', s, e.message);
    }
  }
  console.error('TOTAL unique reference categories:', Object.keys(dict).length);
  fs.writeFileSync(__dirname + '/_ref_dict.json', JSON.stringify(dict, null, 2));
  console.log(Object.keys(dict).join(' | '));
})();
