const https = require('https');
function head(url) {
  return new Promise(resolve => {
    https.get(url, res => { res.destroy(); resolve(res.statusCode); }).on('error', e => resolve('ERR:' + e.message));
  });
}
const base = 'https://images.mobileparts.shop/v7/Images/PartCategory/1/';
const items = [
  ['Audio',   base + '784/Audio%20-%20Bluetooth.jpg?p=m2-fr-ac&ci_eqs=cD1tMi1mci1hYw%3d%3d&ci_seal=b8f21704d53f694dbf801648a4e572a61765a1e4'],
  ['Case',    base + '807/Case%20wallet%20case.jpg?p=m2-fr-ac&ci_eqs=cD1tMi1mci1hYw%3d%3d&ci_seal=92842cce38bf3db122697ac023cedae9efc0f77a'],
  ['Charger', base + '813/Charger%20wireless1.jpg?p=m2-fr-ac&ci_eqs=cD1tMi1mci1hYw%3d%3d&ci_seal=f5b9c084a3e4b2a8a9856301ca264dd2ab42e225'],
  ['Holder',  base + '517/Holder%20car%20other-.jpg?p=m2-fr-ac&ci_eqs=cD1tMi1mci1hYw%3d%3d&ci_seal=36bb5dc4160718a717f770770eb6951aa82bdcd2'],
  ['Screen',  base + '848/Curved%20glass%20-%20apple-.jpg?p=m2-fr-ac&ci_eqs=cD1tMi1mci1hYw%3d%3d&ci_seal=ebd520821abf1518d3c8718e0b46d2489b971e2e'],
];
(async () => {
  for (const [n, u] of items) console.log(n, '->', await head(u));
  // tokenless test
  console.log('Audio tokenless ->', await head(base + '784/Audio%20-%20Bluetooth.jpg'));
})();
