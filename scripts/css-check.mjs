/**
 * Проверка CSS-части сборки: Tailwind v4 компилирует src/index.css так же,
 * как это делает @tailwindcss/vite во время `npm run build`, но без запуска vite.
 * Запуск: npm run test:css
 */
import fs from 'node:fs';
import path from 'node:path';
import { compile } from '@tailwindcss/node';

let failures = 0;
const check = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' :: ' + extra : ''}`);
  if (!cond) failures += 1;
};

const root = process.cwd();
const srcDir = path.join(root, 'src');
const cssPath = path.join(srcDir, 'index.css');

// --- собираем классы, которые реально встречаются в разметке ---
const files = [];
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) files.push(full);
  }
};
walk(srcDir);

const candidates = new Set();
const classAttr = /(?:class|className)\s*=\s*(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\})/g;
for (const file of files) {
  const code = fs.readFileSync(file, 'utf-8');
  for (const match of code.matchAll(classAttr)) {
    const raw = match[1] ?? match[2] ?? match[3] ?? '';
    for (const token of raw.split(/\s+/)) {
      const clean = token.replace(/\$\{[^}]*\}/g, '').trim();
      if (clean && !clean.includes('{') && !clean.includes('}')) candidates.add(clean);
    }
  }
}
check('классы из разметки собраны', candidates.size > 100, `${candidates.size} кандидатов`);

// --- компиляция ---
const css = fs.readFileSync(cssPath, 'utf-8');
const dependencies = [];
let output = '';
try {
  const compiled = await compile(css, {
    base: srcDir,
    onDependency: (dep) => dependencies.push(dep),
  });
  output = compiled.build([...candidates]);
} catch (err) {
  check('Tailwind компилирует src/index.css', false, err.message);
  process.exit(1);
}

check('Tailwind компилирует src/index.css', output.length > 1000, `${(output.length / 1024).toFixed(1)} КБ CSS`);
check('@import "tailwindcss" разрешён', !/@import\s+["']tailwindcss["']/.test(output));
check('preflight подключён', /\*, ::before, ::after|box-sizing: border-box/.test(output), '');

// --- утилиты, которые точно используются в приложении ---
for (const utility of ['.bg-emerald-500', '.text-slate-100', '.rounded-xl', '.flex']) {
  check(`утилита ${utility} сгенерирована`, output.includes(utility), '');
}
check(
  'произвольные значения работают (bg-[#0b0f12])',
  /\.bg-\\\[#0b0f12\\\]/.test(output) || output.includes('background-color: #0b0f12'),
  '',
);

// --- наши собственные правила и переменные ---
check('safe-area класс .safe-top на месте', /\.safe-top\s*\{[^}]*padding-top:\s*var\(--tg-safe-top\)/s.test(output));
check('safe-area класс .safe-bottom на месте', /\.safe-bottom\s*\{[^}]*padding-bottom:\s*var\(--tg-safe-bottom\)/s.test(output));
check('переменная --app-height попала в вывод', output.includes('--app-height'));
check('переменная --tg-safe-top попала в вывод', output.includes('--tg-safe-top'));
check('цвет фона html/body сохранён', /background-color:\s*#070a0d/.test(output));
check('overscroll-behavior сохранён', output.includes('overscroll-behavior-y: none'));

console.log(`\nЗависимости CSS: ${dependencies.length > 0 ? dependencies.length + ' шт.' : 'нет (только базовый Tailwind)'}`);
console.log(`\n${failures === 0 ? 'CSS-СБОРКА ПРОХОДИТ' : `ПРОВАЛОВ: ${failures}`}`);
process.exit(failures === 0 ? 0 : 1);
