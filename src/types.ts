export type SportCategory = 
  | 'powerlifting' 
  | 'streetlifting' 
  | 'bodybuilding' 
  | 'fitness' 
  | 'weightlifting' 
  | 'crossfit' 
  | 'athletics' 
  | 'swimming' 
  | 'basketball' 
  | 'football' 
  | 'tennis' 
  | 'combat' 
  | 'steps';

export type SportFederation = 'WRPF' | 'WSF' | 'Минспорт / ЕВСК' | 'ОФП / Фитнес' | 'World Aquatics';

export type RankLevel = 
  | '3_junior' 
  | '2_junior' 
  | '1_junior' 
  | '3_adult' 
  | '2_adult' 
  | '1_adult' 
  | 'cms'    // КМС
  | 'ms'     // МС
  | 'msmk'   // МСМК
  | 'elite'; // Элита (для WSF и WRPF)

export interface SportRankCriteria {
  level: RankLevel;
  title: string;
  shortTitle: string;
  requiredValue: number;
  unit: string;
  description?: string;
}

export interface SportMovement {
  id: string;
  name: string;
  category: SportCategory;
  federation?: SportFederation;
  unit: string;
  isLowerBetter?: boolean;
  weightCategories?: {
    weightLimitKg: number;
    label: string;
    ranks: SportRankCriteria[];
  }[];
  standardRanks?: SportRankCriteria[];
}

export interface InBodyRecord {
  id: string;
  date: string; // '2026-09-10'
  weightKg: number;
  skeletalMuscleMassKg: number; // SMM
  bodyFatMassKg: number;        // Масса жира
  bodyFatPercent: number;       // PBF (% жира)
  totalBodyWaterL: number;      // TBW (вода)
  proteinKg: number;            // Протеин / белок
  mineralsKg: number;           // Минералы
  visceralFatLevel: number;     // Уровень висцерального жира (1-20)
  bmrKcal: number;              // Базальный метаболизм (ккал)
  inBodyScore?: number;         // Оценка InBody / 100
  scanImageUrl?: string;
  coachNotes?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  telegramUsername: string;
  currentWeight: number;
  targetWeight: number;
  weightGoalType: 'lose' | 'gain' | 'maintain' | 'recomp';
  stepGoalEnabled?: boolean;
  dailyStepGoal: number;
  disciplineScore: number; // 0 to 100
  streakDays: number;
  longestStreak: number;
  selectedDisciplines: string[];
  inBodyRecords?: InBodyRecord[];
  targetRankTitle?: string;
  targetRankMovement?: string;
  targetRankGoalValue?: number;
  avatarUrl?: string;
  heightCm?: number;
  age?: number;
  gender?: 'male' | 'female';
  activityLevel?: 'sedentary' | 'moderate' | 'active' | 'very_active';
  customCalorieTarget?: number;
  customProteinTarget?: number;
  customFatTarget?: number;
  customCarbsTarget?: number;
  customFiberTarget?: number;
  stepBank?: number;
  ratingScore?: number;
  respectPoints?: number;
  athleteRankTitle?: string;
  // Personal AI Coach Instructions & Physical Constraints
  aiPersonalPrompt?: string;
  injuriesAndLimitations?: string;
  activeSupplements?: string;
  trainingStylePreference?: string;
  dailyReadiness?: DailyReadiness;
}

export interface DailyReadiness {
  date: string; // YYYY-MM-DD
  sleepHours: number;
  sleepQuality: number; // 1-10
  sorenessScore?: number; // 1-10 (1 = fresh, 10 = extreme DOMS/pain)
  muscleSoreness?: number;
  sorenessLocation?: string;
  stressScore?: number; // 1-10
  stressLevel?: number;
  energyLevel?: number;
  painAreas?: string[];
  readinessScore?: number; // 0-100%
  overallReadinessScore?: number;
  autoAdjustRecommendation?: string; // e.g. "Снизь рабочий вес на 5-10%"
  rpeAdjustmentRecommendation?: string;
  notes?: string;
}

export interface CompletedSet {
  id: string;
  setNumber: number;
  weight: number;
  reps: number;
  rpe?: number;
  timestamp: string;
  actualRestSeconds?: number;
  calculated1RM: number;
  normalizedRepsAt100kg: number;
}

export interface ExerciseLog {
  exerciseId: string;
  name: string;
  sets: CompletedSet[];
  notes?: string;
  best1RM?: number;
}

export interface ExerciseComparison {
  exerciseName: string;
  previousWeight: number;
  previousSetsReps: number[];
  currentWeight: number;
  currentSetsReps: number[];
  summaryVerdict: string;
}

export interface WorkoutRecord {
  id: string;
  planId?: string;
  title: string;
  date?: string;
  startedAt: string; // ISO string
  completedAt?: string; // ISO string
  durationMinutes: number;
  exercises: ExerciseLog[];
  totalTonnageKg: number;
  status: 'in_progress' | 'completed' | 'abandoned';
  comparisons?: ExerciseComparison[];
}

export interface PlannedExercise {
  id: string;
  name: string;
  targetSets: number;
  targetReps: number;
  targetWeight: number;
  restMinutes: number; // отдых между подходами в минутах
  restBetweenExercisesMinutes?: number; // отдых перед следующим упражнением в минутах
  category?: SportCategory;
  muscleGroup?: string;
  notes?: string;
}

export interface WorkoutPlan {
  id: string;
  title: string;
  scheduledDay: string;
  scheduledTime?: string;
  estimatedDurationMinutes?: number;
  exercises: PlannedExercise[];
  status?: 'scheduled' | 'in_progress' | 'completed' | 'missed' | 'rescheduled';
  rescheduleDate?: string;
  penaltyApplied?: boolean;
  restBetweenExercisesMinutes?: number;
  isCustomTemplate?: boolean;
  createdAt?: string;
}

export interface DisciplinePenalty {
  id: string;
  date: string;
  workoutDate?: string;
  reason: string;
  penaltyTask: string;
  pointsDeducted: number;
  status: 'pending' | 'completed' | 'rescheduled';
  completedAt?: string;
}

export interface DisciplineMarathon {
  id: string;
  type: 'steps' | 'workout_streak' | 'exercise_focus' | 'custom';
  title: string;
  targetDays: number;
  currentDay: number;
  dailyGoalValue: number;
  unit: string;
  penaltyTask: string;
  startDate: string;
  endDate: string;
  completedDates: string[];
  missedDates: string[];
  status: 'active' | 'completed' | 'failed';
}

export interface FriendBattle {
  id: string;
  friendName: string;
  friendTelegram: string;
  avatarBg: string;
  challengeType: 'steps' | 'bench_press' | 'pullups' | 'discipline_streak' | 'custom_wager' | 'exercise_progress_percent' | 'workout_frequency';
  title: string;
  duration: string;
  startDate: string;
  endDate: string;
  userProgress: number;
  friendProgress: number;
  targetGoal: number;
  unit: string;
  wagerTerms: {
    condition: string;
    penaltyLoser: string;
    rewardWinner: string;
  };
  status: 'active' | 'user_won' | 'friend_won' | 'pending_friend';
}

export interface FriendBet {
  id: string;
  friendId: string;
  friendName: string;
  friendTelegram: string;
  betType: 'self_challenge' | 'friend_challenge';
  title: string;
  condition: string;
  durationDays: number;
  startDate: string;
  endDate: string;
  penaltyType: 'friend_money' | 'charity' | 'physical' | 'habit';
  penaltyText: string;
  rewardRespectPoints: number;
  status: 'active' | 'won' | 'lost' | 'pending_friend';
  progressPercent: number;
  createdAt: string;
}

export interface FriendUser {
  id: string;
  name: string;
  username: string;
  avatarBg: string;
  ratingScore: number;
  respectPoints: number;
  rankTitle: string;
  status: 'online' | 'offline';
  bestRecord?: string;
}

export interface MarathonDayLog {
  dayNumber: number;
  date: string;
  value: number;
  target: number;
  isHit: boolean;
  bankedAmount?: number;
  note?: string;
}

export interface GoalMarathon {
  id: string;
  category: 'steps' | 'strength' | 'cardio' | 'weight_loss' | 'custom';
  title: string;
  targetMetricName: string;
  targetGoalValue: number;
  unit: string;
  frequency: 'daily' | 'every_workout' | '3_times_week' | '4_times_week';
  durationDays: number;
  currentDay: number;
  startDate: string;
  endDate: string;
  status: 'active' | 'completed' | 'abandoned';
  bankedSurplus: number;
  rewardRating: number;
  rewardRespect: number;
  rewardBadgeTitle: string;
  rewardRankBonus?: string;
  dailyLogs: MarathonDayLog[];
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  parsedSet?: {
    exercise: string;
    weight: number;
    reps: number;
    rpe?: number;
  };
  inBodyRecord?: InBodyRecord;
  imageUrl?: string;
  advice?: string;
  recommendedRestSeconds?: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: 'discipline' | 'strength' | 'steps' | 'battles' | 'nutrition';
  unlocked: boolean;
  unlockedDate?: string;
  progress: number;
  maxProgress: number;
}

// Nutrition & Calorie Tracking Models
export interface FoodItem {
  id: string;
  name: string;
  category: 'meat' | 'dairy' | 'grains' | 'fruits' | 'vegetables' | 'oils_nuts' | 'custom';
  caloriesPer100g: number;
  proteinPer100g: number;
  fatPer100g: number;
  carbsPer100g: number;
  fiberPer100g: number; // Клетчатка (г)
  userAdded?: boolean;
  timesLogged?: number;
}

export interface LoggedMealItem {
  id: string;
  foodId?: string;
  name: string;
  grams: number;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  timestamp: string;
}

export interface DailyNutritionRecord {
  date: string; // 'YYYY-MM-DD'
  meals: LoggedMealItem[];
  morningWeightKg?: number;
  totalCalories: number;
  totalProtein: number;
  totalFat: number;
  totalCarbs: number;
  totalFiber: number;
  targetCalories: number;
  targetProtein: number;
  targetFat: number;
  targetCarbs: number;
  targetFiber: number;
  status: 'open' | 'closed';
  coachVerdict?: string;
  closedAt?: string;
}

// Sleep and Recovery Tracking Models
export interface SleepRecord {
  id: string;
  date: string; // 'YYYY-MM-DD' (день подъема)
  bedtime: string; // '23:30'
  wakeTime: string; // '07:30'
  durationHours: number;
  qualityScore: number; // 1 to 10
  feeling: 'exhausted' | 'normal' | 'rested' | 'peak';
  notes?: string;
}

// Personal Records (Личные рекорды & Комплексы)
export interface RecordHistoryItem {
  id: string;
  date: string;
  value: string; // e.g. "115 кг × 3", "24:10 мин", "100 отжиманий"
  numericValue?: number;
  notes?: string;
}

export interface PersonalRecord {
  id: string;
  title: string; // "Жим штанги лежа", "Забег 5 км", "Комплекс: 100 отжиманий + 50 подтягиваний"
  category: 'strength' | 'cardio' | 'complex' | 'other';
  currentBest: string; // "120 кг × 3"
  unit?: string;
  history: RecordHistoryItem[];
  isPublic?: boolean;
  authorName?: string;
  authorUsername?: string;
  likesCount?: number;
  clonedCount?: number;
  createdAt: string;
  updatedAt: string;
}

// Public Community Posts (Лента атлетов / Публикация рекордов и тренировок)
export interface CommunityPost {
  id: string;
  authorId: string;
  authorName: string;
  authorUsername: string;
  authorAvatar?: string;
  type: 'record' | 'workout_plan' | 'complex';
  title: string;
  description: string;
  details: {
    recordValue?: string;
    workoutPlan?: WorkoutPlan;
    exercisesSummary?: string[];
  };
  likes: number;
  hasLiked?: boolean;
  clones: number;
  createdAt: string;
}

// 🔬 ЛАБОРАТОРИЯ ЭКСПЕРИМЕНТОВ (Research Lab & N=1 Self-Studies)
export interface ExperimentMetric {
  id?: string;
  name: string;
  unit: string;
  type: string; // 'numeric' | 'boolean' | 'scale' | 'performance' | 'volume' | 'rpe' | 'recovery' | 'hydration' | 'sleep' | 'supplement' | 'nutrition'
  targetValue?: number | string;
  baselineValue?: number | string;
}

export interface ExperimentDailyLog {
  date: string; // 'YYYY-MM-DD'
  independentValues: Record<string, number | boolean>; // metricId -> value
  dependentValue?: number; // e.g. 1RM (kg), reps, or performance metric
  notes?: string;
  loggedAt?: string;
}

export interface Experiment {
  id: string;
  title: string;
  hypothesis: string; // e.g. "Если спать 8+ часов и пить 3л воды, жим вырастет на 5% за 2 недели"
  startDate: string; // 'YYYY-MM-DD'
  endDate: string; // 'YYYY-MM-DD'
  durationDays: number;
  dependentMetric: ExperimentMetric; // e.g. "Жим лежа (1ПМ)", "Подтягивания"
  independentMetrics: ExperimentMetric[]; // e.g. Сон, Вода, Креатин, Кофеин
  baselineValue?: number | string;
  dailyLogs: Record<string, ExperimentDailyLog>; // date -> log
  status: 'active' | 'completed' | 'paused';
  aiConclusion?: {
    summary: string;
    correlationDetected: boolean;
    effectPercent?: number;
    statsText: string;
    pValueApprox?: number;
    recommendations: string;
    calculatedAt: string;
  } | null;
  createdAt?: string;
}

// ГРУППИРОВКА ТРЕНИРОВОК В ЦИКЛЫ (Periodization Blocks)
export interface TrainingBlock {
  id: string;
  title: string; // e.g. "Набор массы #3", "Силовой пик WRPF", "Делод"
  type: 'hypertrophy' | 'strength' | 'deload' | 'recomp' | 'endurance' | 'custom' | string;
  startDate: string; // 'YYYY-MM-DD'
  endDate: string; // 'YYYY-MM-DD'
  goals?: string[]; // e.g. ["+5 кг к жиму", "+2 кг к весу тела"]
  targetTonnageKg?: number;
  workoutIds?: string[]; // references to completed workout records
  status?: 'active' | 'completed' | 'planned' | string;
  notes?: string;
  targetRpeRange?: [number, number];
  completedWorkoutsCount?: number;
  totalTonnage?: number;
  averageRpe?: number;
  isCurrent?: boolean;
  aiVerdict?: {
    summary: string;
    totalTonnage: number;
    avgWeeklyTonnage: number;
    strengthProgress: Record<string, number>; // exerciseName -> delta kg 1RM
    fatigueTrend: 'low' | 'moderate' | 'high';
    nextBlockRecommendation: string;
  };
}

// КОНСТРУКТОР КАСТОМНЫХ МЕТРИК (Custom Metrics Builder & Correlation Explorer)
export interface CustomMetricValue {
  date: string; // 'YYYY-MM-DD'
  value: number | boolean | string;
  notes?: string;
}

export interface CustomMetric {
  id: string;
  name: string; // e.g. "Боль в колене", "Кофеин", "Креатин", "Время реакции", "Настроение"
  category: 'physical' | 'nutrition_supps' | 'mental' | 'lifestyle' | string;
  type?: 'numeric' | 'scale' | 'boolean' | 'categorical' | string;
  trackingType?: string;
  unit: string; // e.g. "мг", "1-10", "мс", "да/нет", "баллы"
  description?: string;
  values?: Record<string, CustomMetricValue>; // date -> value
  createdAt: string;
}

