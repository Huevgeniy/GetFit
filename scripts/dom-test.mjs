/**
 * Интеграционная проверка клиента в настоящем DOM (jsdom):
 * эффекты, гидратация состояния из облака, переключение вкладок.
 * Запуск: npm run test:dom
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';

let failures = 0;
const check = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' :: ' + extra : ''}`);
  if (!cond) failures += 1;
};

const projectRoot = process.cwd();
const outDir = path.join(projectRoot, '.tmp-dom');
fs.rmSync(outDir, { recursive: true, force: true });

execFileSync(
  process.execPath,
  [
    path.join(projectRoot, 'node_modules', 'typescript', 'bin', 'tsc'),
    '--outDir', outDir,
    '--module', 'commonjs',
    '--target', 'es2022',
    '--jsx', 'react-jsx',
    '--moduleResolution', 'node',
    '--esModuleInterop',
    '--skipLibCheck',
    '--lib', 'es2022,dom',
    '--rootDir', 'src',
    'src/App.tsx',
  ],
  { stdio: 'inherit' },
);
fs.writeFileSync(path.join(outDir, 'package.json'), JSON.stringify({ type: 'commonjs' }), 'utf-8');

/* ---------------- DOM ---------------- */
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'https://getfitbot.example.com/',
  pretendToBeVisual: true,
});
const { window } = dom;

// В интеграционном тесте не нужен онбординг-оверлей: он сам переключает вкладки
window.localStorage.setItem('getfit_tour_completed', 'true');
// Обучение по «Телу» проверяется отдельным тестом туров: здесь оно только мешало бы кликам.
window.localStorage.setItem('getfit_tour_done:tg:555:body', 'true');
window.localStorage.setItem('getfit_tour_done:local:body', 'true');

const noop = () => undefined;
// В Node 24 часть глобалов (navigator, localStorage) объявлена только для чтения
const define = (name, value) => Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });

globalThis.window = window;
globalThis.document = window.document;

/** jsdom не реализует clipboard — добавляем его настоящему Navigator (подмена прототипа ломает jsdom) */
let clipboardText = '';
Object.defineProperty(window.navigator, 'clipboard', {
  value: { writeText: async (value) => { clipboardText = String(value); } },
  configurable: true,
});
define('navigator', window.navigator);
define('localStorage', window.localStorage);
define('location', window.location);
globalThis.HTMLElement = window.HTMLElement;
globalThis.Element = window.Element;
globalThis.Node = window.Node;
globalThis.Event = window.Event;
globalThis.MouseEvent = window.MouseEvent;
globalThis.getComputedStyle = window.getComputedStyle.bind(window);
globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window);
globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
globalThis.matchMedia = () => ({ matches: false, addListener: noop, removeListener: noop, addEventListener: noop, removeEventListener: noop });
window.matchMedia = globalThis.matchMedia;
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
globalThis.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } };
globalThis.scrollTo = noop;
window.scrollTo = noop;
window.HTMLElement.prototype.scrollIntoView = noop;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/* ---------------- Сервер-заглушка ---------------- */
const CLOUD_USER = 'ИзОблака';
const requests = [];
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

globalThis.fetch = async (url, init = {}) => {
  const target = String(url);
  requests.push({ url: target, method: init.method || 'GET', body: init.body });
  if (target === '/api/auth/telegram') {
    return json({ valid: true, userId: 'tg:555', token: 'dom-token', devMode: false, user: { first_name: CLOUD_USER } });
  }
  if (target === '/api/me') return json({ userId: 'tg:555', storage: 'file' });
  if (target === '/api/db/sync' && (init.method || 'GET') === 'GET') {
    return json({ found: true, data: { user: { name: CLOUD_USER, currentWeight: 77, telegramUsername: '@fromcloud' } } });
  }
  if (target === '/api/db/sync') return json({ success: true, lastSyncedAt: new Date().toISOString() });
  if (target === '/api/battles') {
    return json({
      battles: [
        {
          id: 'b1', title: 'Заруба из облака', friendName: 'Боб', friendTelegram: '@bob', avatarBg: '',
          challengeType: 'steps', duration: '1 неделя', startDate: '2026-03-01', endDate: '2026-03-08',
          userProgress: 10, friendProgress: 20, targetGoal: 100, unit: 'шагов',
          wagerTerms: { condition: 'кто больше', penaltyLoser: 'кофе', rewardWinner: '+250' },
          status: 'active', inviteLink: 'https://t.me/get_fitbot?start=ABCD1234', mySide: 'creator',
        },
      ],
    });
  }
  if (target === '/api/notifications/test') return json({ delivered: true });
  return json({});
};
window.fetch = globalThis.fetch;

/* ---------------- Рендер в DOM ---------------- */
const require_ = createRequire(import.meta.url);
const React = require_('react');
const { createRoot } = require_('react-dom/client');
const { act } = React;

const App = require_(path.join(outDir, 'App.js'));
const AppComponent = App.default || App;

const container = window.document.getElementById('root');
let reactRoot;
let renderError = null;
try {
  await act(async () => {
    reactRoot = createRoot(container);
    reactRoot.render(React.createElement(AppComponent));
  });
  // Даём завершиться цепочке асинхронных эффектов (сессия -> состояние -> зарубы)
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 400));
  });
} catch (err) {
  renderError = err;
}

check('приложение монтируется в DOM без исключений', !renderError, renderError ? renderError.message : '');
if (renderError) console.log(renderError.stack?.split('\n').slice(0, 6).join('\n'));

const text = () => container.textContent || '';
const buttons = () => [...container.querySelectorAll('button')];
const labels = () => buttons().map((el) => (el.textContent || '').trim().slice(0, 20));
const navLabels = () =>
  [...container.querySelectorAll('nav button')].map((el) => (el.textContent || '').trim().slice(0, 20));
const navButton = (label) =>
  [...container.querySelectorAll('nav button')].find((el) => (el.textContent || '').includes(label));

const clickNav = async (label) => {
  const button = navButton(label);
  if (!button) return false;
  await act(async () => {
    button.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 120));
  });
  return true;
};

// 1. Сессия и цепочка запросов
check('выполнен вход по initData', requests.some((r) => r.url === '/api/auth/telegram'));
check('запрошен режим хранилища', requests.some((r) => r.url === '/api/me'));
check('состояние загружено из облака', requests.some((r) => r.url === '/api/db/sync' && r.method === 'GET'));
check('зарубы запрошены с сервера', requests.some((r) => r.url === '/api/battles'));

// 2. Данные из облака попали в интерфейс
check('имя пользователя подставлено из облака', text().includes(CLOUD_USER));
check('вес из облака отображается в шапке', text().includes('77'));
check('телеграм-ник из облака отображается', text().includes('@fromcloud'));

// 3. Индикатор хранилища: сервер сообщил file -> предупреждение
check('показано предупреждение об отсутствии базы (storage=file)', text().includes('без базы данных'));

// 4. Переключение вкладок в реальном DOM
const clickByText = async (label) => {
  const button = buttons().find((el) => (el.textContent || '').includes(label));
  if (!button) return false;
  await act(async () => {
    button.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 80));
  });
  return true;
};

if (process.env.DOM_DEBUG === '1') {
  console.log('  кнопок:', labels().length, JSON.stringify(labels()));
  console.log('  nav есть:', Boolean(container.querySelector('nav')));
}

const BASIC_TABS = ['Тренировки', 'Питание', 'Прогресс', 'Профиль'];
const ADVANCED_TABS = ['Лаборатория', 'Циклы', 'Разряды', 'Дисциплина', 'Тело', 'Зарубы'];
check(
  'базовый режим: внизу ровно четыре вкладки',
  BASIC_TABS.every((label) => navLabels().some((l) => l.includes(label))) &&
    navLabels().length === BASIC_TABS.length,
  JSON.stringify(navLabels()),
);
check(
  'базовый режим: дополнительные вкладки скрыты',
  ADVANCED_TABS.every((label) => !navLabels().some((l) => l.includes(label))),
  JSON.stringify(navLabels()),
);

// Отчёт по периодам больше не вкладка, а кнопка внутри «Прогресса»
const progressSwitched = await clickNav('Прогресс');
check('переключение на «Прогресс» не падает', progressSwitched && !renderError);
const openStats = container.querySelector('#open-period-stats');
check('в «Прогрессе» есть кнопка отчёта за период', Boolean(openStats), text().slice(0, 120));
if (openStats) {
  await act(async () => {
    openStats.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 80));
  });
  check('отчёт открывается по кнопке', text().includes('Отчёты и статистика'), text().slice(0, 140));
  check('в отчёте есть периоды', text().includes('30 дней') && text().includes('Всё время'));
  const closeStats = container.querySelector('#close-period-stats');
  check('у модального отчёта есть кнопка закрытия', Boolean(closeStats));
  if (closeStats) {
    await act(async () => {
      closeStats.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 80));
    });
    check('отчёт закрывается', !text().includes('Отчёты и статистика'));
  }
}

const profileSwitched = await clickNav('Профиль');
check('переключение на «Профиль» не падает', profileSwitched && !renderError);
check('в профиле видны данные из облака', text().includes(CLOUD_USER));

// 4a. Режим приложения: базовый -> расширенный и включение раздела
const advancedToggle = container.querySelector('#advanced-mode-toggle');
check('в профиле есть переключатель расширенного режима', Boolean(advancedToggle));
check('в базовом режиме описано, что остаётся', text().includes('Что остаётся в базовом режиме'));
if (advancedToggle) {
  await act(async () => {
    advancedToggle.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 80));
  });
  const featureToggles = ['marathons', 'battles', 'discipline', 'ranks', 'body', 'lab', 'periodization'];
  check(
    'расширенный режим показывает все тумблеры разделов',
    featureToggles.every((key) => Boolean(container.querySelector(`#feature-toggle-${key}`))),
  );
  check(
    'каждый тумблер объясняет, что включает',
    text().includes('Серии дней с шагами') &&
      text().includes('Дуэли 1 на 1') &&
      text().includes('Нормативы по пауэрлифтингу') &&
      text().includes('Замеры, пропорции') &&
      text().includes('Личные эксперименты') &&
      text().includes('Блоки роста мышц'),
    text().slice(-400),
  );
  check(
    'после включения расширенного режима вкладки пока не добавились',
    navLabels().length === BASIC_TABS.length,
    JSON.stringify(navLabels()),
  );

  const battlesToggle = container.querySelector('#feature-toggle-battles');
  if (battlesToggle) {
    await act(async () => {
      battlesToggle.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 120));
    });
    check('включение заруб добавляет вкладку', navLabels().some((l) => l.includes('Зарубы')), JSON.stringify(navLabels()));
    const battlesNav = navButton('Зарубы');
    if (battlesNav) {
      await act(async () => {
        battlesNav.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 120));
      });
      check('вкладка «Зарубы» открывается', !renderError && text().length > 0);
      check(
        'на вкладке видны зарубы с сервера',
        text().includes('Заруба из облака') || text().includes('Боб'),
        text().slice(0, 140),
      );
    }
  }
}

// Возвращаемся в профиль: настройки напоминаний и резервная копия
await clickNav('Профиль');

// 4a-2. Много дополнительных разделов: нижняя панель не разрастается
const enableAll = buttons().find((el) => (el.textContent || '').trim() === 'Включить всё');
check('в профиле есть кнопка включить все разделы', Boolean(enableAll));
if (enableAll) {
  await act(async () => {
    enableAll.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 120));
  });
  check(
    'при многих разделах внизу пять кнопок и «Ещё»',
    navLabels().length === 5 && navLabels().some((label) => label.includes('Ещё')),
    JSON.stringify(navLabels()),
  );
  check(
    'дополнительные разделы убраны в «Ещё»',
    !['Зарубы', 'Дисциплина', 'Разряды', 'Тело', 'Лаборатория', 'Циклы'].some((label) =>
      navLabels().some((item) => item.includes(label)),
    ),
    JSON.stringify(navLabels()),
  );
  const moreButton = navButton('Ещё');
  if (moreButton) {
    await act(async () => {
      moreButton.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 80));
    });
    check(
      'меню «Ещё» показывает все включённые разделы',
      ['Зарубы', 'Дисциплина', 'Разряды', 'Тело', 'Лаборатория', 'Циклы'].every((label) => text().includes(label)),
      text().slice(-260),
    );
    const closeMore = container.querySelector('[role="dialog"] [aria-label="Закрыть"]');
    if (closeMore) {
      await act(async () => {
        closeMore.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 80));
      });
      check('меню «Ещё» закрывается', !text().includes('Ещё разделы'));
    }
  }
}

// 4a-3. Раздел «Тело»: открывается из «Ещё», замеры, модель и упражнения
const moreForBody = navButton('Ещё');
if (moreForBody) {
  await act(async () => {
    moreForBody.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 80));
  });
  const bodyEntry = [...container.querySelectorAll('[role="dialog"] button')].find((el) =>
    (el.textContent || '').trim().startsWith('Тело'),
  );
  check('в меню «Ещё» есть раздел «Тело»', Boolean(bodyEntry), text().slice(-200));
  if (bodyEntry) {
    await act(async () => {
      bodyEntry.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 220));
    });
    check(
      'вкладка «Тело» открывается',
      !renderError && text().includes('Тело и биомеханика'),
      text().slice(0, 160),
    );
    check('без замеров показан стартовый экран', text().includes('Начните с первого замера'));

    const measurementTab = container.querySelector('#body-tab-measurements');
    check('у раздела есть вкладка «Замеры»', Boolean(measurementTab));
    if (measurementTab) {
      await act(async () => {
        measurementTab.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 80));
      });
      const addMeasurement = container.querySelector('#body-add-measurement-empty');
      check('можно начать с добавления замера', Boolean(addMeasurement));
      if (addMeasurement) {
        await act(async () => {
          addMeasurement.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
        });
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 80));
        });
        check('форма замера открывается', Boolean(container.querySelector('#body-measurement-form')));
        const weightInput = container.querySelector('#body-measurement-weight');
        const waistInput = container.querySelector('#body-measurement-waistCm');
        check('в форме есть вес и обхваты', Boolean(weightInput) && Boolean(waistInput));
        if (weightInput && waistInput) {
          const setValue = (input, value) => {
            const setter = Object.getOwnPropertyDescriptor(
              window.HTMLInputElement.prototype,
              'value',
            ).set;
            setter.call(input, value);
            input.dispatchEvent(new window.Event('input', { bubbles: true }));
          };
          await act(async () => {
            setValue(waistInput, '82');
          });
          const saveMeasurement = container.querySelector('#body-measurement-save');
          check('замер можно сохранить', Boolean(saveMeasurement));
          if (saveMeasurement) {
            await act(async () => {
              saveMeasurement.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
            });
            await act(async () => {
              await new Promise((resolve) => setTimeout(resolve, 1700));
            });
            check('замер появился в истории', text().includes('Все замеры') && text().includes('82'), text().slice(0, 160));
            check(
              'замер уходит в облако вместе с профилем',
              requests.some(
                (r) => r.url === '/api/db/sync' && String(r.body || '').includes('bodyProfile'),
              ),
            );
          }
        }
      }
    }

    const exercisesTab = container.querySelector('#body-tab-exercises');
    if (exercisesTab) {
      await act(async () => {
        exercisesTab.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 160));
      });
      check(
        'вкладка упражнений открывает библиотеку с поиском',
        Boolean(container.querySelector('#body-exercise-search')) &&
          text().includes('Библиотека упражнений'),
      );
      check(
        'в библиотеке много упражнений',
        container.querySelectorAll('[id^="body-library-"]').length >= 24,
        String(container.querySelectorAll('[id^="body-library-"]').length),
      );
      const search = container.querySelector('#body-exercise-search');
      if (search) {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value',
        )?.set;
        await act(async () => {
          setter?.call(search, 'румын');
          search.dispatchEvent(new window.Event('input', { bubbles: true }));
        });
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 160));
        });
        check(
          'поиск находит румынскую тягу',
          Boolean(container.querySelector('#body-library-rdl')) && text().includes('Румынская тяга'),
        );
        const rdlCard = container.querySelector('#body-library-rdl');
        if (rdlCard) {
          await act(async () => {
            rdlCard.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
          });
          await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 180));
          });
          check(
            'карточка открывает разбор техники',
            Boolean(container.querySelector('#tour-body-technique')) &&
              text().includes('Румынская тяга') &&
              text().includes('Карта мышц'),
          );
          check(
            'схема скелета с углами отрисована',
            Boolean(container.querySelector('svg[role="img"][aria-label*="Схема скелета"]')),
          );
          check(
            'в технике есть риски, пропорции и нагрузка',
            text().includes('Риски и что с ними делать') &&
              text().includes('Под ваши пропорции') &&
              text().includes('Плечо момента'),
          );
          const techniqueWeight = container.querySelector('#body-technique-weight');
          const techniqueOneRm = container.querySelector('#body-technique-1rm');
          check(
            'в технике есть вес и 1ПМ',
            Boolean(techniqueWeight) && Boolean(techniqueOneRm),
          );
          if (techniqueWeight) {
            const setter = Object.getOwnPropertyDescriptor(
              window.HTMLInputElement.prototype,
              'value',
            )?.set;
            await act(async () => {
              setter?.call(techniqueWeight, '140');
              techniqueWeight.dispatchEvent(new window.Event('input', { bubbles: true }));
            });
            await act(async () => {
              await new Promise((resolve) => setTimeout(resolve, 140));
            });
            check(
              'техника показывает очень высокую зону',
              text().includes('очень высокая'),
              text().slice(-260),
            );
          }
          if (techniqueOneRm) {
            const setter = Object.getOwnPropertyDescriptor(
              window.HTMLInputElement.prototype,
              'value',
            )?.set;
            await act(async () => {
              setter?.call(techniqueOneRm, '150');
              techniqueOneRm.dispatchEvent(new window.Event('input', { bubbles: true }));
            });
            const saveOneRm = container.querySelector('#body-technique-1rm-save');
            if (saveOneRm) {
              await act(async () => {
                saveOneRm.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
              });
              await act(async () => {
                await new Promise((resolve) => setTimeout(resolve, 160));
              });
              check('1ПМ в технике можно поправить вручную', text().includes('вручную') && text().includes('150'));
            }
          }
          check(
            'есть чат по схеме',
            Boolean(container.querySelector('input[placeholder*="Свой вопрос"]')),
          );
          const lowBackQuestion = buttons().find((el) =>
            (el.textContent || '').trim() === 'Почему может тянуть поясницу?',
          );
          if (lowBackQuestion) {
            await act(async () => {
              lowBackQuestion.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
            });
            await act(async () => {
              await new Promise((resolve) => setTimeout(resolve, 80));
            });
            check(
              'чат отвечает по схеме',
              text().includes('Держите кор') || text().includes('поясницу'),
              text().slice(-320),
            );
          }
        }
      }
    }

    // Возвращаемся в профиль для проверок напоминаний и резервной копии.
    const moreForProfile = navButton('Ещё');
    if (moreForProfile) {
      await act(async () => {
        moreForProfile.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 80));
      });
      const profileShortcut = buttons().find((el) =>
        (el.textContent || '').includes('Настроить разделы в профиле'),
      );
      if (profileShortcut) {
        await act(async () => {
          profileShortcut.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
        });
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
        });
      }
    }
  }
}

// 4b. Напоминания: переключатель и проверка доставки
const toggle = container.querySelector('#notifications-toggle');
check('в профиле есть переключатель напоминаний', Boolean(toggle));
if (toggle) {
  await act(async () => {
    toggle.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 80));
  });
  check('переключатель отключает напоминания', text().includes('Отключены'), text().slice(-160));
  await act(async () => {
    toggle.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 80));
  });
  check('переключатель включает напоминания обратно', text().includes('Тренировка вечером'), text().slice(-160));
}

const testButton = container.querySelector('#notifications-test');
check('кнопка проверки уведомлений доступна', Boolean(testButton) && testButton.disabled === false);
if (testButton) {
  await act(async () => {
    testButton.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 120));
  });
  check('запрос проверки уведомлений ушёл на сервер', requests.some((r) => r.url === '/api/notifications/test' && r.method === 'POST'));
  check('пользователю показан успешный результат', text().includes('Отправлено'), text().slice(-160));
}

// 4c. Резервная копия: экспорт в буфер и восстановление
const exportButton = container.querySelector('#backup-export');
check('в профиле есть кнопка создания копии', Boolean(exportButton));
if (exportButton) {
  await act(async () => {
    exportButton.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 120));
  });
  check('копия попала в буфер обмена', clipboardText.includes('GetFitBot') && clipboardText.includes('workoutPlans'), clipboardText.slice(0, 60));
  check('в копии есть состояние пользователя', clipboardText.includes('@fromcloud'));
  check('пользователю сообщили об успехе', text().includes('буфер'));
}

const importToggle = container.querySelector('#backup-import-toggle');
check('есть кнопка восстановления', Boolean(importToggle));
if (importToggle) {
  await act(async () => {
    importToggle.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 80));
  });
  const area = container.querySelector('#backup-import-text');
  check('открылось поле для вставки копии', Boolean(area));
  if (area) {
    const restored = JSON.stringify({
      app: 'GetFitBot',
      version: 1,
      data: { user: { name: 'ИзКопии', telegramUsername: '@restored' }, workoutPlans: [{ id: 'p9', title: 'Восстановленный план', scheduledDay: 'Среда', exercises: [] }] },
    });
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    await act(async () => {
      setter.call(area, restored);
      area.dispatchEvent(new window.Event('input', { bubbles: true }));
    });
    const applyButton = container.querySelector('#backup-import-apply');
    check('кнопка применения доступна после вставки', Boolean(applyButton) && applyButton.disabled === false);
    if (applyButton) {
      await act(async () => {
        applyButton.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 120));
      });
      check('данные восстановлены из копии', text().includes('ИзКопии') && text().includes('@restored'), text().slice(0, 120));
      check('показано подтверждение восстановления', text().includes('восстановлены'));
    }
  }
}

// 4d. Шаблоны: библиотека и общая витрина
const backToWorkouts = await clickNav('Тренировки');
check('возврат на «Тренировки» работает', backToWorkouts && !renderError);

const savedTemplatesBtn = container.querySelector('#tour-saved-templates-btn');
check('в тренировках есть кнопка «Мои шаблоны»', Boolean(savedTemplatesBtn));
if (savedTemplatesBtn) {
  await act(async () => {
    savedTemplatesBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 150));
  });
  check(
    'библиотека шаблонов запросила свои шаблоны',
    requests.some((r) => r.url === '/api/templates/mine'),
    JSON.stringify(requests.map((r) => r.url).slice(-8)),
  );
  check('в библиотеке есть вкладка «Общие шаблоны»', text().includes('Общие шаблоны'), text().slice(-200));

  const communityTab = buttons().find((el) => (el.textContent || '').includes('Общие шаблоны'));
  if (communityTab) {
    await act(async () => {
      communityTab.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 120));
    });
    check(
      'общая библиотека запрошена с сервера',
      requests.some((r) => r.url === '/api/templates/public'),
      JSON.stringify(requests.map((r) => r.url).slice(-8)),
    );
    check('есть импорт по коду или ссылке', text().includes('Забрать по коду или ссылке'));
  }

  const closeTemplates = buttons().find((el) => (el.textContent || '').trim() === 'Закрыть');
  if (closeTemplates) {
    await act(async () => {
      closeTemplates.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 80));
    });
  }
  check('библиотека шаблонов закрывается', !text().includes('GetFitBot Workout Templates Engine'));
}

// 5. Состояние после переключений и модалок не потерялось
// Импорт заменил имя на «ИзКопии», но не затёр остальные поля из облака
check(
  'восстановленные данные и данные из облака сосуществуют',
  text().includes('ИзКопии') && text().includes('@restored') && text().includes('77'),
  text().slice(0, 140),
);

if (reactRoot) {
  await act(async () => {
    reactRoot.unmount();
  });
}

/* ---------------- Сценарий 2: приглашение в зарубу по deep-link ---------------- */
const INVITE_CODE = 'ABC123XY';
window.history.replaceState({}, '', `/?startapp=${INVITE_CODE}`);
container.innerHTML = '';
requests.length = 0;
// Сервер после принятия приглашения отдаёт зарубу в списке — как в реальности
let joined = false;
const JOINED_BATTLE = {
  id: 'joined-battle', title: 'Заруба по приглашению', friendName: 'Аня', friendTelegram: '@anya', avatarBg: '',
  challengeType: 'steps', duration: '1 неделя', startDate: '2026-03-01', endDate: '2026-03-08',
  userProgress: 0, friendProgress: 0, targetGoal: 50, unit: 'км',
  wagerTerms: { condition: 'кто больше', penaltyLoser: 'кофе', rewardWinner: '+250' },
  status: 'active', mySide: 'opponent',
};

globalThis.fetch = async (url, init = {}) => {
  const target = String(url);
  requests.push({ url: target, method: init.method || 'GET', body: init.body });
  if (target === '/api/auth/telegram') return json({ valid: true, userId: 'tg:777', token: 'dom-token-2', devMode: false });
  if (target === '/api/me') return json({ userId: 'tg:777', storage: 'postgres' });
  if (target === '/api/db/sync' && (init.method || 'GET') === 'GET') return json({ found: false });
  if (target === '/api/db/sync') return json({ success: true, lastSyncedAt: new Date().toISOString() });
  if (target === '/api/battles/join') {
    joined = true;
    return json({ success: true, battle: JOINED_BATTLE });
  }
  if (target === '/api/battles') return json({ battles: joined ? [JOINED_BATTLE] : [] });
  return json({});
};
window.fetch = globalThis.fetch;

let inviteError = null;
try {
  await act(async () => {
    reactRoot = createRoot(container);
    reactRoot.render(React.createElement(AppComponent));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 400));
  });
} catch (err) {
  inviteError = err;
}

const joinCall = requests.find((r) => r.url === '/api/battles/join');
check('сценарий приглашения: приложение монтируется', !inviteError, inviteError ? inviteError.message : '');
check('приглашение принято автоматически (POST /api/battles/join)', Boolean(joinCall), JSON.stringify(requests.map((r) => r.url)));
check('в запрос ушёл код из ссылки', String(joinCall?.body || '').includes(INVITE_CODE), String(joinCall?.body));
check('показано уведомление о принятой зарубе', text().includes('принял зарубу'), text().slice(0, 120));
check('принятая заруба видна в списке (её не перетёр устаревший список)', text().includes('Аня') && text().includes('Заруба по приглашению'), text().slice(0, 160));
check('повторный запрос приглашения не уходит', requests.filter((r) => r.url === '/api/battles/join').length === 1);

if (reactRoot) {
  await act(async () => {
    reactRoot.unmount();
  });
}

fs.rmSync(outDir, { recursive: true, force: true });
console.log(`\n${failures === 0 ? 'DOM-ПРОВЕРКИ ПРОЙДЕНЫ' : `ПРОВАЛОВ: ${failures}`}`);
process.exit(failures === 0 ? 0 : 1);
