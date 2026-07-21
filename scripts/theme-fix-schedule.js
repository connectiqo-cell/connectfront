const fs = require('fs');

const f = 'src/components/schedule/ScheduleUI.js';
let s = fs.readFileSync(f, 'utf8');

const reps = [
  [/borderColor: 'rgba\(255,255,255,0\.35\)'/g, 'borderColor: C.border.light'],
  [/backgroundColor: 'rgba\(255,255,255,0\.08\)'/g, 'backgroundColor: C.surface.chip'],
  [/borderColor: 'rgba\(255,255,255,0\.1\)'/g, 'borderColor: C.border.light'],
  [/borderBottomColor: 'rgba\(255,255,255,0\.1\)'/g, 'borderBottomColor: C.border.light'],
  [/borderColor: 'rgba\(255,255,255,0\.12\)'/g, 'borderColor: C.border.light'],
  [/backgroundColor: 'rgba\(255,255,255,0\.06\)'/g, 'backgroundColor: C.surface.chip'],
  [/backgroundColor: 'rgba\(0,0,0,0\.2\)'/g, 'backgroundColor: C.surface.chipStrong'],
  [/borderColor: 'rgba\(255,255,255,0\.08\)'/g, 'borderColor: C.border.light'],
  [/borderBottomColor: 'rgba\(255,255,255,0\.08\)'/g, 'borderBottomColor: C.border.light'],
  [/backgroundColor: 'rgba\(255,255,255,0\.05\)'/g, 'backgroundColor: C.surface.chip'],
  [/backgroundColor: 'rgba\(94,234,212,0\.08\)'/g, 'backgroundColor: C.surface.accentViolet'],
  [/backgroundColor: 'rgba\(255,255,255,0\.85\)'/g, 'backgroundColor: C.surface.panel'],
  [/borderTopColor: 'rgba\(255,255,255,0\.08\)'/g, 'borderTopColor: C.border.light'],
];

for (const [re, to] of reps) s = s.replace(re, to);
fs.writeFileSync(f, s);
console.log('OK ScheduleUI');
