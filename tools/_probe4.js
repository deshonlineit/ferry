const https = require('https');
function get(u) {
  return new Promise((resolve, reject) => {
    https.get(u, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve({status:res.statusCode, body:d})); }).on('error', reject);
  });
}
(async () => {
  try {
    const r = await get('https://api.openverse.org/v1/images/?q=phone%20charger&page_size=1');
    console.log('openverse status', r.status, 'len', r.body.length);
    const j = JSON.parse(r.body);
    console.log('results', j.results ? j.results.length : 'none');
    if (j.results && j.results[0]) console.log('img', j.results[0].url);
  } catch (e) { console.log('openverse ERR', e.message); }
})();
