const s = '?????????';
const strategies = [
    { name: '1: latin1 to utf8', fn: (s) => Buffer.from(s, 'latin1').toString('utf8') },
    { name: '2: utf8 to latin1', fn: (s) => Buffer.from(s, 'utf8').toString('latin1') },
    { name: '3: latin1 to utf8, then latin1 to utf8', fn: (s) => Buffer.from(Buffer.from(s, 'latin1').toString('utf8'), 'latin1').toString('utf8') },
    { name: '4: latin1 to utf8 twice (nested)', fn: (s) => {
        const first = Buffer.from(s, 'latin1').toString('utf8');
        return Buffer.from(first, 'latin1').toString('utf8');
    }}
];

strategies.forEach(strat => {
    try {
        const result = strat.fn(s);
        const codePoints = Array.from(result).map(c => 'U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')).join(' ');
        console.log('Strategy ' + strat.name + ':');
        console.log('  String: ' + result);
        console.log('  Code Points: ' + codePoints);
    } catch (e) {
        console.log('Strategy ' + strat.name + ' failed: ' + e.message);
    }
});
