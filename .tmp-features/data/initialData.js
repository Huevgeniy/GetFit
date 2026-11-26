"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.INITIAL_COMMUNITY_POSTS = exports.INITIAL_PERSONAL_RECORDS = exports.INITIAL_ACHIEVEMENTS = exports.INITIAL_PENALTIES = exports.INITIAL_FRIEND_BATTLES = exports.INITIAL_PAST_WORKOUTS = exports.INITIAL_WORKOUT_PLANS = exports.INITIAL_USER_PROFILE = void 0;
exports.INITIAL_USER_PROFILE = {
    id: 'user_local',
    name: '',
    telegramUsername: '',
    currentWeight: 0,
    targetWeight: 0,
    weightGoalType: 'maintain',
    stepGoalEnabled: true,
    dailyStepGoal: 10000,
    dailySteps: {},
    disciplineScore: 0,
    streakDays: 0,
    longestStreak: 0,
    selectedDisciplines: ['powerlifting', 'streetlifting'],
    inBodyRecords: [],
    targetRankTitle: undefined,
    targetRankMovement: undefined,
    targetRankGoalValue: undefined,
};
exports.INITIAL_WORKOUT_PLANS = [];
exports.INITIAL_PAST_WORKOUTS = [];
exports.INITIAL_FRIEND_BATTLES = [];
exports.INITIAL_PENALTIES = [];
// Empty initial achievements as requested by user
exports.INITIAL_ACHIEVEMENTS = [];
// Initial Personal Records & Complexes
exports.INITIAL_PERSONAL_RECORDS = [];
// Community feed with published workouts and complexes to try
exports.INITIAL_COMMUNITY_POSTS = [
    {
        id: 'post_1',
        authorId: 'coach_dmitry',
        authorName: 'Дмитрий В.',
        authorUsername: '@dmitry_lift',
        type: 'complex',
        title: 'Кроссфит-комплекс «Спартанский дуэт»',
        description: '100 отжиманий от пола + 50 подтягиваний строгим хватом на время. Отличный тест выносливости верха тела!',
        details: {
            recordValue: '06:45 мин',
            exercisesSummary: ['100 отжиманий', '50 подтягиваний'],
        },
        likes: 42,
        hasLiked: false,
        clones: 18,
        createdAt: 'Вчера',
    },
    {
        id: 'post_2',
        authorId: 'street_pro',
        authorName: 'Игорь К.',
        authorUsername: '@igor_wsf',
        type: 'record',
        title: 'Отжимания на брусьях с дополнительным весом',
        description: 'Личный рекорд на 1 повторение в категории до 80 кг по правилам WSF. Подвесной вес 100 кг!',
        details: {
            recordValue: '+100 кг × 1',
        },
        likes: 67,
        hasLiked: false,
        clones: 9,
        createdAt: '2 дня назад',
    },
];
