import { 
  UserProfile, 
  WorkoutPlan, 
  WorkoutRecord, 
  FriendBattle, 
  DisciplinePenalty, 
  Achievement,
  PersonalRecord,
  CommunityPost
} from '../types';

export const INITIAL_USER_PROFILE: UserProfile = {
  id: 'user_local',
  name: '',
  telegramUsername: '',
  currentWeight: 0,
  targetWeight: 0,
  weightGoalType: 'maintain',
  stepGoalEnabled: true,
  dailyStepGoal: 10000,
  disciplineScore: 100,
  streakDays: 0,
  longestStreak: 0,
  selectedDisciplines: ['powerlifting', 'streetlifting'],
  inBodyRecords: [],
  targetRankTitle: undefined,
  targetRankMovement: undefined,
  targetRankGoalValue: undefined,
};

export const INITIAL_WORKOUT_PLANS: WorkoutPlan[] = [];

export const INITIAL_PAST_WORKOUTS: WorkoutRecord[] = [];

export const INITIAL_FRIEND_BATTLES: FriendBattle[] = [];

export const INITIAL_PENALTIES: DisciplinePenalty[] = [];

// Empty initial achievements as requested by user
export const INITIAL_ACHIEVEMENTS: Achievement[] = [];

// Initial Personal Records & Complexes
export const INITIAL_PERSONAL_RECORDS: PersonalRecord[] = [];

// Community feed with published workouts and complexes to try
export const INITIAL_COMMUNITY_POSTS: CommunityPost[] = [
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

