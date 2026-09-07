const https = require('https');
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const TMP = path.join(DIR, '_tmp');
if (!fs.existsSync(TMP)) fs.mkdirSync(TMP);

// 5 real reference category images (reference image CDN allows them)
const REF = {
  audio:   'https://images.mobileparts.shop/v7/Images/PartCategory/1/784/Audio%20-%20Bluetooth.jpg?p=m2-fr-ac&ci_eqs=cD1tMi1mci1hYw%3d%3d&ci_seal=b8f21704d53f694dbf801648a4e572a61765a1e4',
  case:    'https://images.mobileparts.shop/v7/Images/PartCategory/1/807/Case%20wallet%20case.jpg?p=m2-fr-ac&ci_eqs=cD1tMi1mci1hYw%3d%3d&ci_seal=92842cce38bf3db122697ac023cedae9efc0f77a',
  charger: 'https://images.mobileparts.shop/v7/Images/PartCategory/1/813/Charger%20wireless1.jpg?p=m2-fr-ac&ci_eqs=cD1tMi1mci1hYw%3d%3d&ci_seal=f5b9c084a3e4b2a8a9856301ca264dd2ab42e225',
  holder:  'https://images.mobileparts.shop/v7/Images/PartCategory/1/517/Holder%20car%20other-.jpg?p=m2-fr-ac&ci_eqs=cD1tMi1mci1hYw%3d%3d&ci_seal=36bb5dc4160718a717f770770eb6951aa82bdcd2',
  screen:  'https://images.mobileparts.shop/v7/Images/PartCategory/1/848/Curved%20glass%20-%20apple-.jpg?p=m2-fr-ac&ci_eqs=cD1tMi1mci1hYw%3d%3d&ci_seal=ebd520821abf1518d3c8718e0b46d2489b971e2e'
};

const REF_KW = {
  audio:   ['audio', 'earbud', 'headphone', 'speaker', 'sound', 'microphone'],
  case:    ['case', 'cover', 'pouch', 'sleeve', 'bumper', 'housing', 'shell'],
  charger: ['charger', 'charge', 'adapter', 'adaptor', 'plug', 'converter', 'chargin', 'wireless charg'],
  holder:  ['holder', 'mount', 'stand', 'cradle', 'dock', 'bracket', 'clip', 'support'],
  screen:  ['screen', 'glass', 'protector', 'protection', 'tempered', 'foil', 'film', 'display', 'lcd', 'digitizer']
};

function getJSON(u) {
  const mod = u.startsWith('https') ? https : require('http');
  return new Promise((resolve, reject) => {
    mod.get(u, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>{ try { resolve(JSON.parse(d)); } catch(e){ reject(e); } }); }).on('error', reject);
  });
}

function download(url, dest, redirects) {
  redirects = redirects || 0;
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        if (redirects > 5) return reject(new Error('too many redirects'));
        const next = res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, url).href;
        return download(next, dest, redirects + 1).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('status ' + res.statusCode)); }
      const ext = (res.headers['content-type'] || '').indexOf('png') >= 0 ? 'png' : 'jpg';
      const file = dest + '.' + ext;
      const ws = fs.createWriteStream(file);
      res.pipe(ws);
      ws.on('finish', () => resolve(file));
      ws.on('error', reject);
    }).on('error', reject);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function fileExists(p) { try { return fs.statSync(p).size > 0; } catch (e) { return false; } }

// cache Openverse results per search term
const OV_CACHE = {};
const OV_FILE = path.join(DIR, '_ov_cache.json');
if (fs.existsSync(OV_FILE)) Object.assign(OV_CACHE, JSON.parse(fs.readFileSync(OV_FILE, 'utf8')));

const PROGRESS = path.join(DIR, '_progress.log');
function log(s) { try { fs.appendFileSync(PROGRESS, s + '\n'); } catch (e) {} }
function saveOV() { try { fs.writeFileSync(OV_FILE, JSON.stringify(OV_CACHE, null, 2)); } catch (e) {} }

async function openverseImage(term) {
  if (OV_CACHE[term] !== undefined) return OV_CACHE[term];
  const url = 'https://api.openverse.org/v1/images/?q=' + encodeURIComponent(term) + '&page_size=5&license_type=all';
  try {
    const j = await getJSON(url);
    const r = (j.results || []).find(x => x.url && /\.(jpg|jpeg|png)$/i.test(x.url)) || (j.results && j.results[0]);
    const img = r ? (r.thumbnail || r.url) : null;
    OV_CACHE[term] = img;
    saveOV();
    return img;
  } catch (e) {
    OV_CACHE[term] = null; saveOV();
    return null;
  }
}

function resolveTerm(name) {
  const n = ' ' + name.toLowerCase() + ' ';
  for (const key of Object.keys(REF_KW)) {
    if (REF_KW[key].some(t => n.indexOf(t) >= 0)) return { refKey: key, term: key };
  }
  // generic accessory keywords -> openverse phrased
  const generic = [
    ['battery', 'phone battery'], ['powerbank', 'phone power bank'], ['power bank', 'phone power bank'],
    ['cable', 'phone charging cable'], ['wire', 'phone cable'], ['cord', 'phone cable'],
    ['camera', 'phone camera lens'], ['lens', 'phone camera lens'], ['button', 'phone button'],
    ['tool', 'phone repair tool'], ['repair', 'phone repair tool'], ['screwdriver', 'phone repair tool'],
    ['sticker', 'phone sticker'], ['decals', 'phone sticker'], ['watch', 'smartwatch'],
    ['band', 'smartwatch band'], ['strap', 'watch strap'], ['keyboard', 'phone keyboard'],
    ['mouse', 'computer mouse'], ['game', 'mobile game controller'], ['controller', 'game controller'],
    ['pen', 'stylus pen'], ['stylus', 'stylus pen'], ['light', 'led light'], ['led', 'led light']
  ];
  for (const [kw, phrase] of generic) if (n.indexOf(kw) >= 0) return { term: phrase };
  // otherwise treat as device/brand -> search device photo
  return { term: name + ' smartphone' };
}

(async () => {
  const data = await getJSON('http://localhost/ferry/rebuild/api/v1/categories');
  const cats = data.data;
  const dl = {};           // slug -> { tmp, rel }
  const termToSrc = {};    // search term -> source url (dedup)
  const ovCount = { done: 0 };
  log('=== run ' + new Date().toISOString() + ' === categories=' + cats.length);

  for (const c of cats) {
    const res = resolveTerm(c.name);
    let src = null;
    if (res.refKey) {
      src = REF[res.refKey];
    } else {
      const term = res.term;
      if (termToSrc[term] === undefined) {
        ovCount.done++;
        const img = await openverseImage(term);
        termToSrc[term] = img;
        log('OV [' + ovCount.done + '] ' + term + ' -> ' + (img ? 'OK' : 'none'));
        await sleep(200);
      }
      src = termToSrc[term];
    }
    dl[c.slug] = { src: src, name: c.name };
  }

  // download each unique source once
  const uniqueSrc = {};
  for (const slug of Object.keys(dl)) {
    const src = dl[slug].src;
    if (!src) continue;
    if (uniqueSrc[src] === undefined) uniqueSrc[src] = [];
    uniqueSrc[src].push(slug);
  }

  const map = {}; // slug -> rel webp path
  let i = 0, total = Object.keys(uniqueSrc).length, ok = 0, fail = 0;
  for (const src of Object.keys(uniqueSrc)) {
    i++;
    const slugs = uniqueSrc[src];
    const tmpBase = path.join(TMP, 'src_' + i);
    const existing = fs.readdirSync(TMP).filter(f => f.startsWith('src_' + i + '.'));
    try {
      let file;
      if (existing.length) {
        file = path.join(TMP, existing[0]);
      } else {
        file = await download(src, tmpBase);
      }
      for (const slug of slugs) {
        const rel = 'assets/img/categories/' + slug + '.webp';
        map[slug] = { tmp: path.basename(file), rel: rel };
      }
      ok++;
      log('DL [' + i + '/' + total + '] (' + slugs.length + ' cats) ' + src.slice(0, 60));
    } catch (e) {
      fail++;
      log('DL FAIL ' + e.message + ' :: ' + src.slice(0, 60));
    }
  }
  fs.writeFileSync(path.join(DIR, '_dl.json'), JSON.stringify(map, null, 2));
  const withImg = Object.keys(map).length;
  log('\nDONE: downloaded sources for ' + withImg + ' of ' + cats.length + ' categories (' + ok + ' ok, ' + fail + ' fail).');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
