"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CATEGORY_LABEL = exports.DISCIPLINE_LEVELS = exports.DEFAULT_DISCIPLINE_SETTINGS = exports.DISCIPLINE_HABITS = void 0;
exports.normalizeDisciplineSettings = normalizeDisciplineSettings;
exports.enabledHabits = enabledHabits;
exports.disciplineIsActive = disciplineIsActive;
exports.normalizedWeight = normalizedWeight;
exports.deductionForHabit = deductionForHabit;
exports.disciplineLevel = disciplineLevel;
exports.penaltySeverity = penaltySeverity;
exports.penaltyRestorePoints = penaltyRestorePoints;
exports.penaltyDeadline = penaltyDeadline;
exports.suggestPenalties = suggestPenalties;
exports.penaltyIsOverdue = penaltyIsOverdue;
exports.buildPenaltyNotice = buildPenaltyNotice;
exports.DISCIPLINE_HABITS = [
    { id: 'workout', label: 'Тренировка по плану', short: 'Тренировка', description: 'Запланированная тренировка выполнена.' },
    { id: 'sleep', label: 'График сна', short: 'Сон', description: 'Сон внесён и соответствует вашей цели.' },
    { id: 'nutrition', label: 'Дневник питания', short: 'Питание', description: 'Приёмы пищи внесены за день.' },
    { id: 'steps', label: 'Норма шагов', short: 'Шаги', description: 'Дневная цель по шагам достигнута.' },
    { id: 'marathon', label: 'Чек-ин марафона', short: 'Марафон', description: 'Отмечен активный марафон.' },
    { id: 'cycle', label: 'Тренировка цикла', short: 'Цикл', description: 'День активного цикла отмечен.' },
    { id: 'lab', label: 'Эксперимент', short: 'Лаборатория', description: 'Эксперимент отмечен в лаборатории.' },
];
exports.DEFAULT_DISCIPLINE_SETTINGS = {
    enabled: {
        workout: true,
        sleep: false,
        nutrition: false,
        steps: false,
        marathon: false,
        cycle: false,
        lab: false,
    },
    weights: {
        workout: 25,
        sleep: 15,
        nutrition: 15,
        steps: 10,
        marathon: 15,
        cycle: 10,
        lab: 10,
    },
    penaltyMode: 'confirm',
    confirmationHours: 24,
    difficulty: 'normal',
    financialMin: 100,
    financialMax: 1000,
    allowedCategories: {
        cardio: true,
        steps: false,
        financial: true,
        diet: true,
        sleep: true,
        social: true,
        skill: true,
    },
    notifyPenalties: true,
};
function normalizeDisciplineSettings(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const enabled = { ...exports.DEFAULT_DISCIPLINE_SETTINGS.enabled };
    const weights = { ...exports.DEFAULT_DISCIPLINE_SETTINGS.weights };
    for (const habit of exports.DISCIPLINE_HABITS) {
        if (typeof source.enabled?.[habit.id] === 'boolean')
            enabled[habit.id] = source.enabled[habit.id];
        const weight = Number(source.weights?.[habit.id]);
        if (Number.isFinite(weight))
            weights[habit.id] = Math.max(1, Math.min(50, weight));
    }
    const allowedCategories = { ...exports.DEFAULT_DISCIPLINE_SETTINGS.allowedCategories };
    if (source.allowedCategories && typeof source.allowedCategories === 'object') {
        for (const key of Object.keys(allowedCategories)) {
            if (typeof source.allowedCategories[key] === 'boolean') {
                allowedCategories[key] = source.allowedCategories[key];
            }
        }
    }
    return {
        enabled,
        weights,
        penaltyMode: source.penaltyMode === 'auto' ? 'auto' : 'confirm',
        confirmationHours: [12, 24, 48, 72].includes(Number(source.confirmationHours))
            ? Number(source.confirmationHours)
            : 24,
        difficulty: source.difficulty === 'soft' || source.difficulty === 'hard' ? source.difficulty : 'normal',
        financialMin: Math.max(50, Math.min(5000, Number(source.financialMin) || 100)),
        financialMax: Math.max(100, Math.min(20000, Number(source.financialMax) || 1000)),
        allowedCategories,
        notifyPenalties: source.notifyPenalties !== false,
    };
}
function enabledHabits(settings) {
    return exports.DISCIPLINE_HABITS.map((habit) => habit.id).filter((id) => settings.enabled[id]);
}
function disciplineIsActive(settings, plans) {
    const habits = enabledHabits(settings);
    if (habits.length === 0)
        return false;
    if (habits.length === 1 && habits[0] === 'workout' && plans.length === 0)
        return false;
    return true;
}
function normalizedWeight(settings) {
    const habits = enabledHabits(settings);
    const total = habits.reduce((sum, id) => sum + settings.weights[id], 0) || 1;
    const result = {};
    for (const habit of exports.DISCIPLINE_HABITS) {
        result[habit.id] = Math.round((settings.weights[habit.id] / total) * 1000) / 10;
    }
    return result;
}
function deductionForHabit(settings, habit) {
    const habits = enabledHabits(settings);
    if (!habits.includes(habit))
        return 0;
    const total = habits.reduce((sum, id) => sum + settings.weights[id], 0) || 1;
    // Вес — это и есть штраф в очках. Если сумма весов больше 100,
    // масштабируем, чтобы один пропуск не списывал больше 100.
    const scale = total > 100 ? 100 / total : 1;
    return Math.max(1, Math.round(settings.weights[habit] * scale));
}
exports.DISCIPLINE_LEVELS = {
    critical: {
        id: 'critical',
        label: 'Критическая',
        color: '#fb7185',
        description: 'Много пропусков. Наказания жёстче, восстановление требует закрыть все долги.',
    },
    low: {
        id: 'low',
        label: 'Просела',
        color: '#fb923c',
        description: 'Есть системные пропуски. Верните рутину и закройте штрафы.',
    },
    stable: {
        id: 'stable',
        label: 'Стабильная',
        color: '#fbbf24',
        description: 'Рабочее состояние. Держите привычки и не копите долги.',
    },
    iron: {
        id: 'iron',
        label: 'Железная',
        color: '#34d399',
        description: 'Высокая дисциплина. Сохраняйте серию и закрывайте штрафы вовремя.',
    },
};
function disciplineLevel(score, active) {
    if (!active) {
        return {
            id: 'inactive',
            label: 'Не активна',
            color: '#64748b',
            description: 'Добавьте план или включите привычки в настройках дисциплины.',
        };
    }
    if (score >= 90)
        return exports.DISCIPLINE_LEVELS.iron;
    if (score >= 75)
        return exports.DISCIPLINE_LEVELS.stable;
    if (score >= 50)
        return exports.DISCIPLINE_LEVELS.low;
    return exports.DISCIPLINE_LEVELS.critical;
}
const CATEGORY_LABEL = {
    cardio: 'Кардио',
    steps: 'Шаги',
    financial: 'Финансы',
    diet: 'Питание',
    sleep: 'Сон',
    social: 'Социальное',
    skill: 'Навык',
};
exports.CATEGORY_LABEL = CATEGORY_LABEL;
function roundMoney(value) {
    return Math.max(50, Math.round(value / 50) * 50);
}
/** Чем больше потеряно очков, тем выше сложность. */
function penaltySeverity(lostPoints, settings) {
    const base = Math.max(0.25, Math.min(1, lostPoints / 25));
    const multiplier = settings.difficulty === 'soft' ? 0.75 : settings.difficulty === 'hard' ? 1.25 : 1;
    return Math.max(0.2, Math.min(1.3, base * multiplier));
}
function penaltyRestorePoints(points, settings) {
    return Math.max(1, Math.round(points));
}
function penaltyDeadline(settings) {
    return new Date(Date.now() + settings.confirmationHours * 60 * 60 * 1000).toISOString();
}
function suggestPenalties(settings, lostPoints, stepGoalEnabled, dailyStepGoal) {
    const severity = penaltySeverity(lostPoints, settings);
    const points = Math.max(1, Math.round(lostPoints));
    const options = [];
    const financialAmount = roundMoney(settings.financialMin + (settings.financialMax - settings.financialMin) * severity);
    const stepAmount = Math.min(Math.max(1000, dailyStepGoal || 8000), Math.max(1000, Math.round((dailyStepGoal || 8000) * (0.35 + severity * 0.3))));
    const categories = Object.entries(settings.allowedCategories)
        .filter(([, allowed]) => allowed)
        .map(([id]) => id);
    for (const category of categories) {
        if (category === 'financial') {
            options.push({
                category,
                label: CATEGORY_LABEL[category],
                task: `Перевести ${financialAmount.toLocaleString('ru-RU')} ₽ на благотворительность или близкому человеку и показать подтверждение`,
                severity,
                points,
            });
        }
        else if (category === 'cardio') {
            const minutes = Math.round(15 + severity * 35);
            options.push({
                category,
                label: CATEGORY_LABEL[category],
                task: `${minutes} минут кардио в удобном темпе (без замены шагами)`,
                severity,
                points,
            });
        }
        else if (category === 'steps') {
            if (!stepGoalEnabled || dailyStepGoal <= 0)
                continue;
            options.push({
                category,
                label: CATEGORY_LABEL[category],
                task: `Добрать ${stepAmount.toLocaleString('ru-RU')} шагов сверх обычного дня, но не более дневной нормы ${dailyStepGoal.toLocaleString('ru-RU')}`,
                severity,
                points,
            });
        }
        else if (category === 'diet') {
            options.push({
                category,
                label: CATEGORY_LABEL[category],
                task: severity > 0.65 ? 'День без сахара и перекусов вне плана, все приёмы пищи внесены' : 'Внести все приёмы пищи и не есть вне плана до конца дня',
                severity,
                points,
            });
        }
        else if (category === 'sleep') {
            options.push({
                category,
                label: CATEGORY_LABEL[category],
                task: severity > 0.65 ? 'Лечь спать на час раньше и без экрана за 60 минут до сна' : 'Лечь спать в запланированное время',
                severity,
                points,
            });
        }
        else if (category === 'social') {
            options.push({
                category,
                label: CATEGORY_LABEL[category],
                task: severity > 0.65 ? 'Отправить другу отчёт о пропуске и план исправления' : 'Написать другу, что пропустил, и назвать дату исправления',
                severity,
                points,
            });
        }
        else if (category === 'skill') {
            options.push({
                category,
                label: CATEGORY_LABEL[category],
                task: severity > 0.65 ? '20 минут техники слабого упражнения и 3 подхода без отказа' : '10 минут техники слабого упражнения',
                severity,
                points,
            });
        }
    }
    return options.slice(0, 6);
}
function penaltyIsOverdue(penalty) {
    if (penalty.status !== 'pending' || !penalty.expiresAt)
        return false;
    return Date.parse(penalty.expiresAt) < Date.now();
}
function buildPenaltyNotice(penalty, settings) {
    const deadline = penalty.expiresAt
        ? new Date(penalty.expiresAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
        : 'без срока';
    return [
        'Дисциплина: назначен штраф.',
        `Задание: ${penalty.penaltyTask}`,
        `Вернёт очков: ${penalty.restorePoints ?? penalty.pointsDeducted}.`,
        `Подтвердить до: ${deadline}.`,
        settings.penaltyMode === 'confirm' ? 'Открой приложение, выбери штраф и подтверди его выполнение.' : 'Штраф назначен автоматически. После выполнения отметь его в приложении.',
    ].join('\n');
}
