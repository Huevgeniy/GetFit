import { SportMovement, SportRankCriteria } from '../types';

export const SPORT_MOVEMENTS: SportMovement[] = [
  // ==========================================
  // WRPF (Федерация пауэрлифтинга WRPF с допинг-контролем, Raw без экипировки)
  // ==========================================
  {
    id: 'wrpf_bench_press',
    name: 'Жим штанги лежа (WRPF с ДК, без экипировки)',
    category: 'powerlifting',
    federation: 'WRPF',
    unit: 'кг',
    isLowerBetter: false,
    weightCategories: [
      {
        weightLimitKg: 67.5,
        label: 'До 67.5 кг',
        ranks: [
          { level: '3_junior', title: '3 Юношеский', shortTitle: '3 Юн', requiredValue: 52.5, unit: 'кг' },
          { level: '2_junior', title: '2 Юношеский', shortTitle: '2 Юн', requiredValue: 62.5, unit: 'кг' },
          { level: '1_junior', title: '1 Юношеский', shortTitle: '1 Юн', requiredValue: 72.5, unit: 'кг' },
          { level: '3_adult', title: 'III Взрослый разряд', shortTitle: 'III разряд', requiredValue: 82.5, unit: 'кг' },
          { level: '2_adult', title: 'II Взрослый разряд', shortTitle: 'II разряд', requiredValue: 92.5, unit: 'кг' },
          { level: '1_adult', title: 'I Взрослый разряд', shortTitle: 'I разряд', requiredValue: 105, unit: 'кг' },
          { level: 'cms', title: 'КМС (Кандидат в мастера спорта)', shortTitle: 'КМС', requiredValue: 117.5, unit: 'кг' },
          { level: 'ms', title: 'МС (Мастер спорта WRPF)', shortTitle: 'МС', requiredValue: 135, unit: 'кг' },
          { level: 'msmk', title: 'МСМК (Мастер спорта межд. класса)', shortTitle: 'МСМК', requiredValue: 152.5, unit: 'кг' },
          { level: 'elite', title: 'Элита России WRPF', shortTitle: 'Элита', requiredValue: 167.5, unit: 'кг' },
        ],
      },
      {
        weightLimitKg: 75,
        label: 'До 75 кг',
        ranks: [
          { level: '3_junior', title: '3 Юношеский', shortTitle: '3 Юн', requiredValue: 57.5, unit: 'кг' },
          { level: '2_junior', title: '2 Юношеский', shortTitle: '2 Юн', requiredValue: 67.5, unit: 'кг' },
          { level: '1_junior', title: '1 Юношеский', shortTitle: '1 Юн', requiredValue: 77.5, unit: 'кг' },
          { level: '3_adult', title: 'III Взрослый разряд', shortTitle: 'III разряд', requiredValue: 90, unit: 'кг' },
          { level: '2_adult', title: 'II Взрослый разряд', shortTitle: 'II разряд', requiredValue: 100, unit: 'кг' },
          { level: '1_adult', title: 'I Взрослый разряд', shortTitle: 'I разряд', requiredValue: 112.5, unit: 'кг' },
          { level: 'cms', title: 'КМС (Кандидат в мастера спорта)', shortTitle: 'КМС', requiredValue: 127.5, unit: 'кг' },
          { level: 'ms', title: 'МС (Мастер спорта WRPF)', shortTitle: 'МС', requiredValue: 145, unit: 'кг' },
          { level: 'msmk', title: 'МСМК (Мастер спорта межд. класса)', shortTitle: 'МСМК', requiredValue: 165, unit: 'кг' },
          { level: 'elite', title: 'Элита России WRPF', shortTitle: 'Элита', requiredValue: 180, unit: 'кг' },
        ],
      },
      {
        weightLimitKg: 82.5,
        label: 'До 82.5 кг',
        ranks: [
          { level: '3_junior', title: '3 Юношеский', shortTitle: '3 Юн', requiredValue: 62.5, unit: 'кг' },
          { level: '2_junior', title: '2 Юношеский', shortTitle: '2 Юн', requiredValue: 72.5, unit: 'кг' },
          { level: '1_junior', title: '1 Юношеский', shortTitle: '1 Юн', requiredValue: 85, unit: 'кг' },
          { level: '3_adult', title: 'III Взрослый разряд', shortTitle: 'III разряд', requiredValue: 97.5, unit: 'кг' },
          { level: '2_adult', title: 'II Взрослый разряд', shortTitle: 'II разряд', requiredValue: 110, unit: 'кг' },
          { level: '1_adult', title: 'I Взрослый разряд', shortTitle: 'I разряд', requiredValue: 122.5, unit: 'кг' },
          { level: 'cms', title: 'КМС (Кандидат в мастера спорта)', shortTitle: 'КМС', requiredValue: 137.5, unit: 'кг' },
          { level: 'ms', title: 'МС (Мастер спорта WRPF)', shortTitle: 'МС', requiredValue: 157.5, unit: 'кг' },
          { level: 'msmk', title: 'МСМК (Мастер спорта межд. класса)', shortTitle: 'МСМК', requiredValue: 177.5, unit: 'кг' },
          { level: 'elite', title: 'Элита России WRPF', shortTitle: 'Элита', requiredValue: 195, unit: 'кг' },
        ],
      },
      {
        weightLimitKg: 90,
        label: 'До 90 кг',
        ranks: [
          { level: '3_junior', title: '3 Юношеский', shortTitle: '3 Юн', requiredValue: 67.5, unit: 'кг' },
          { level: '2_junior', title: '2 Юношеский', shortTitle: '2 Юн', requiredValue: 80, unit: 'кг' },
          { level: '1_junior', title: '1 Юношеский', shortTitle: '1 Юн', requiredValue: 92.5, unit: 'кг' },
          { level: '3_adult', title: 'III Взрослый разряд', shortTitle: 'III разряд', requiredValue: 105, unit: 'кг' },
          { level: '2_adult', title: 'II Взрослый разряд', shortTitle: 'II разряд', requiredValue: 117.5, unit: 'кг' },
          { level: '1_adult', title: 'I Взрослый разряд', shortTitle: 'I разряд', requiredValue: 135, unit: 'кг' },
          { level: 'cms', title: 'КМС (Кандидат в мастера спорта)', shortTitle: 'КМС', requiredValue: 150, unit: 'кг' },
          { level: 'ms', title: 'МС (Мастер спорта WRPF)', shortTitle: 'МС', requiredValue: 170, unit: 'кг' },
          { level: 'msmk', title: 'МСМК (Мастер спорта межд. класса)', shortTitle: 'МСМК', requiredValue: 192.5, unit: 'кг' },
          { level: 'elite', title: 'Элита России WRPF', shortTitle: 'Элита', requiredValue: 210, unit: 'кг' },
        ],
      },
      {
        weightLimitKg: 100,
        label: 'До 100 кг',
        ranks: [
          { level: '3_junior', title: '3 Юношеский', shortTitle: '3 Юн', requiredValue: 72.5, unit: 'кг' },
          { level: '2_junior', title: '2 Юношеский', shortTitle: '2 Юн', requiredValue: 85, unit: 'кг' },
          { level: '1_junior', title: '1 Юношеский', shortTitle: '1 Юн', requiredValue: 97.5, unit: 'кг' },
          { level: '3_adult', title: 'III Взрослый разряд', shortTitle: 'III разряд', requiredValue: 112.5, unit: 'кг' },
          { level: '2_adult', title: 'II Взрослый разряд', shortTitle: 'II разряд', requiredValue: 125, unit: 'кг' },
          { level: '1_adult', title: 'I Взрослый разряд', shortTitle: 'I разряд', requiredValue: 142.5, unit: 'кг' },
          { level: 'cms', title: 'КМС (Кандидат в мастера спорта)', shortTitle: 'КМС', requiredValue: 160, unit: 'кг' },
          { level: 'ms', title: 'МС (Мастер спорта WRPF)', shortTitle: 'МС', requiredValue: 182.5, unit: 'кг' },
          { level: 'msmk', title: 'МСМК (Мастер спорта межд. класса)', shortTitle: 'МСМК', requiredValue: 205, unit: 'кг' },
          { level: 'elite', title: 'Элита России WRPF', shortTitle: 'Элита', requiredValue: 225, unit: 'кг' },
        ],
      },
      {
        weightLimitKg: 110,
        label: 'До 110 кг',
        ranks: [
          { level: '3_junior', title: '3 Юношеский', shortTitle: '3 Юн', requiredValue: 77.5, unit: 'кг' },
          { level: '2_junior', title: '2 Юношеский', shortTitle: '2 Юн', requiredValue: 90, unit: 'кг' },
          { level: '1_junior', title: '1 Юношеский', shortTitle: '1 Юн', requiredValue: 105, unit: 'кг' },
          { level: '3_adult', title: 'III Взрослый разряд', shortTitle: 'III разряд', requiredValue: 117.5, unit: 'кг' },
          { level: '2_adult', title: 'II Взрослый разряд', shortTitle: 'II разряд', requiredValue: 132.5, unit: 'кг' },
          { level: '1_adult', title: 'I Взрослый разряд', shortTitle: 'I разряд', requiredValue: 150, unit: 'кг' },
          { level: 'cms', title: 'КМС (Кандидат в мастера спорта)', shortTitle: 'КМС', requiredValue: 170, unit: 'кг' },
          { level: 'ms', title: 'МС (Мастер спорта WRPF)', shortTitle: 'МС', requiredValue: 192.5, unit: 'кг' },
          { level: 'msmk', title: 'МСМК (Мастер спорта межд. класса)', shortTitle: 'МСМК', requiredValue: 215, unit: 'кг' },
          { level: 'elite', title: 'Элита России WRPF', shortTitle: 'Элита', requiredValue: 237.5, unit: 'кг' },
        ],
      },
    ],
  },
  {
    id: 'wrpf_squat',
    name: 'Приседания со штангой (WRPF с ДК, без бинтов)',
    category: 'powerlifting',
    federation: 'WRPF',
    unit: 'кг',
    isLowerBetter: false,
    weightCategories: [
      {
        weightLimitKg: 75,
        label: 'До 75 кг',
        ranks: [
          { level: '3_adult', title: 'III Взрослый разряд', shortTitle: 'III разряд', requiredValue: 127.5, unit: 'кг' },
          { level: '2_adult', title: 'II Взрослый разряд', shortTitle: 'II разряд', requiredValue: 145, unit: 'кг' },
          { level: '1_adult', title: 'I Взрослый разряд', shortTitle: 'I разряд', requiredValue: 162.5, unit: 'кг' },
          { level: 'cms', title: 'КМС (Кандидат в мастера спорта)', shortTitle: 'КМС', requiredValue: 185, unit: 'кг' },
          { level: 'ms', title: 'МС (Мастер спорта WRPF)', shortTitle: 'МС', requiredValue: 210, unit: 'кг' },
          { level: 'msmk', title: 'МСМК (Мастер спорта межд. класса)', shortTitle: 'МСМК', requiredValue: 235, unit: 'кг' },
          { level: 'elite', title: 'Элита WRPF', shortTitle: 'Элита', requiredValue: 255, unit: 'кг' },
        ],
      },
      {
        weightLimitKg: 82.5,
        label: 'До 82.5 кг',
        ranks: [
          { level: '3_adult', title: 'III Взрослый разряд', shortTitle: 'III разряд', requiredValue: 140, unit: 'кг' },
          { level: '2_adult', title: 'II Взрослый разряд', shortTitle: 'II разряд', requiredValue: 160, unit: 'кг' },
          { level: '1_adult', title: 'I Взрослый разряд', shortTitle: 'I разряд', requiredValue: 180, unit: 'кг' },
          { level: 'cms', title: 'КМС (Кандидат в мастера спорта)', shortTitle: 'КМС', requiredValue: 202.5, unit: 'кг' },
          { level: 'ms', title: 'МС (Мастер спорта WRPF)', shortTitle: 'МС', requiredValue: 230, unit: 'кг' },
          { level: 'msmk', title: 'МСМК (Мастер спорта межд. класса)', shortTitle: 'МСМК', requiredValue: 255, unit: 'кг' },
          { level: 'elite', title: 'Элита WRPF', shortTitle: 'Элита', requiredValue: 280, unit: 'кг' },
        ],
      },
      {
        weightLimitKg: 90,
        label: 'До 90 кг',
        ranks: [
          { level: '3_adult', title: 'III Взрослый разряд', shortTitle: 'III разряд', requiredValue: 152.5, unit: 'кг' },
          { level: '2_adult', title: 'II Взрослый разряд', shortTitle: 'II разряд', requiredValue: 172.5, unit: 'кг' },
          { level: '1_adult', title: 'I Взрослый разряд', shortTitle: 'I разряд', requiredValue: 195, unit: 'кг' },
          { level: 'cms', title: 'КМС (Кандидат в мастера спорта)', shortTitle: 'КМС', requiredValue: 217.5, unit: 'кг' },
          { level: 'ms', title: 'МС (Мастер спорта WRPF)', shortTitle: 'МС', requiredValue: 247.5, unit: 'кг' },
          { level: 'msmk', title: 'МСМК (Мастер спорта межд. класса)', shortTitle: 'МСМК', requiredValue: 275, unit: 'кг' },
          { level: 'elite', title: 'Элита WRPF', shortTitle: 'Элита', requiredValue: 300, unit: 'кг' },
        ],
      },
      {
        weightLimitKg: 100,
        label: 'До 100 кг',
        ranks: [
          { level: '3_adult', title: 'III Взрослый разряд', shortTitle: 'III разряд', requiredValue: 165, unit: 'кг' },
          { level: '2_adult', title: 'II Взрослый разряд', shortTitle: 'II разряд', requiredValue: 187.5, unit: 'кг' },
          { level: '1_adult', title: 'I Взрослый разряд', shortTitle: 'I разряд', requiredValue: 210, unit: 'кг' },
          { level: 'cms', title: 'КМС (Кандидат в мастера спорта)', shortTitle: 'КМС', requiredValue: 235, unit: 'кг' },
          { level: 'ms', title: 'МС (Мастер спорта WRPF)', shortTitle: 'МС', requiredValue: 265, unit: 'кг' },
          { level: 'msmk', title: 'МСМК (Мастер спорта межд. класса)', shortTitle: 'МСМК', requiredValue: 295, unit: 'кг' },
          { level: 'elite', title: 'Элита WRPF', shortTitle: 'Элита', requiredValue: 320, unit: 'кг' },
        ],
      },
    ],
  },
  {
    id: 'wrpf_deadlift',
    name: 'Становая тяга (WRPF с ДК, без экипировки)',
    category: 'powerlifting',
    federation: 'WRPF',
    unit: 'кг',
    isLowerBetter: false,
    weightCategories: [
      {
        weightLimitKg: 75,
        label: 'До 75 кг',
        ranks: [
          { level: '3_adult', title: 'III Взрослый разряд', shortTitle: 'III разряд', requiredValue: 155, unit: 'кг' },
          { level: '2_adult', title: 'II Взрослый разряд', shortTitle: 'II разряд', requiredValue: 177.5, unit: 'кг' },
          { level: '1_adult', title: 'I Взрослый разряд', shortTitle: 'I разряд', requiredValue: 202.5, unit: 'кг' },
          { level: 'cms', title: 'КМС (Кандидат в мастера спорта)', shortTitle: 'КМС', requiredValue: 227.5, unit: 'кг' },
          { level: 'ms', title: 'МС (Мастер спорта WRPF)', shortTitle: 'МС', requiredValue: 255, unit: 'кг' },
          { level: 'msmk', title: 'МСМК (Мастер спорта межд. класса)', shortTitle: 'МСМК', requiredValue: 282.5, unit: 'кг' },
          { level: 'elite', title: 'Элита WRPF', shortTitle: 'Элита', requiredValue: 305, unit: 'кг' },
        ],
      },
      {
        weightLimitKg: 82.5,
        label: 'До 82.5 кг',
        ranks: [
          { level: '3_adult', title: 'III Взрослый разряд', shortTitle: 'III разряд', requiredValue: 170, unit: 'кг' },
          { level: '2_adult', title: 'II Взрослый разряд', shortTitle: 'II разряд', requiredValue: 195, unit: 'кг' },
          { level: '1_adult', title: 'I Взрослый разряд', shortTitle: 'I разряд', requiredValue: 220, unit: 'кг' },
          { level: 'cms', title: 'КМС (Кандидат в мастера спорта)', shortTitle: 'КМС', requiredValue: 247.5, unit: 'кг' },
          { level: 'ms', title: 'МС (Мастер спорта WRPF)', shortTitle: 'МС', requiredValue: 277.5, unit: 'кг' },
          { level: 'msmk', title: 'МСМК (Мастер спорта межд. класса)', shortTitle: 'МСМК', requiredValue: 305, unit: 'кг' },
          { level: 'elite', title: 'Элита WRPF', shortTitle: 'Элита', requiredValue: 330, unit: 'кг' },
        ],
      },
      {
        weightLimitKg: 90,
        label: 'До 90 кг',
        ranks: [
          { level: '3_adult', title: 'III Взрослый разряд', shortTitle: 'III разряд', requiredValue: 182.5, unit: 'кг' },
          { level: '2_adult', title: 'II Взрослый разряд', shortTitle: 'II разряд', requiredValue: 207.5, unit: 'кг' },
          { level: '1_adult', title: 'I Взрослый разряд', shortTitle: 'I разряд', requiredValue: 235, unit: 'кг' },
          { level: 'cms', title: 'КМС (Кандидат в мастера спорта)', shortTitle: 'КМС', requiredValue: 265, unit: 'кг' },
          { level: 'ms', title: 'МС (Мастер спорта WRPF)', shortTitle: 'МС', requiredValue: 295, unit: 'кг' },
          { level: 'msmk', title: 'МСМК (Мастер спорта межд. класса)', shortTitle: 'МСМК', requiredValue: 325, unit: 'кг' },
          { level: 'elite', title: 'Элита WRPF', shortTitle: 'Элита', requiredValue: 350, unit: 'кг' },
        ],
      },
      {
        weightLimitKg: 100,
        label: 'До 100 кг',
        ranks: [
          { level: '3_adult', title: 'III Взрослый разряд', shortTitle: 'III разряд', requiredValue: 195, unit: 'кг' },
          { level: '2_adult', title: 'II Взрослый разряд', shortTitle: 'II разряд', requiredValue: 222.5, unit: 'кг' },
          { level: '1_adult', title: 'I Взрослый разряд', shortTitle: 'I разряд', requiredValue: 250, unit: 'кг' },
          { level: 'cms', title: 'КМС (Кандидат в мастера спорта)', shortTitle: 'КМС', requiredValue: 280, unit: 'кг' },
          { level: 'ms', title: 'МС (Мастер спорта WRPF)', shortTitle: 'МС', requiredValue: 312.5, unit: 'кг' },
          { level: 'msmk', title: 'МСМК (Мастер спорта межд. класса)', shortTitle: 'МСМК', requiredValue: 342.5, unit: 'кг' },
          { level: 'elite', title: 'Элита WRPF', shortTitle: 'Элита', requiredValue: 370, unit: 'кг' },
        ],
      },
    ],
  },

  // ==========================================
  // WSF (World Streetlifting Federation, Classic с допинг-контролем)
  // ==========================================
  {
    id: 'wsf_pullups',
    name: 'Подтягивания с доп. весом (WSF Classic с ДК)',
    category: 'streetlifting',
    federation: 'WSF',
    unit: 'кг',
    isLowerBetter: false,
    weightCategories: [
      {
        weightLimitKg: 67.5,
        label: 'До 67.5 кг',
        ranks: [
          { level: '3_junior', title: '3 Юношеский', shortTitle: '3 Юн', requiredValue: 10, unit: 'кг' },
          { level: '2_junior', title: '2 Юношеский', shortTitle: '2 Юн', requiredValue: 17.5, unit: 'кг' },
          { level: '1_junior', title: '1 Юношеский', shortTitle: '1 Юн', requiredValue: 25, unit: 'кг' },
          { level: '3_adult', title: 'III Взрослый разряд', shortTitle: 'III разряд', requiredValue: 32.5, unit: 'кг' },
          { level: '2_adult', title: 'II Взрослый разряд', shortTitle: 'II разряд', requiredValue: 42.5, unit: 'кг' },
          { level: '1_adult', title: 'I Взрослый разряд', shortTitle: 'I разряд', requiredValue: 50, unit: 'кг' },
          { level: 'cms', title: 'КМС (WSF)', shortTitle: 'КМС', requiredValue: 60, unit: 'кг' },
          { level: 'ms', title: 'МС (Мастер спорта WSF)', shortTitle: 'МС', requiredValue: 72.5, unit: 'кг' },
          { level: 'msmk', title: 'МСМК (WSF International)', shortTitle: 'МСМК', requiredValue: 82.5, unit: 'кг' },
          { level: 'elite', title: 'Элита Стритлифтинга (WSF)', shortTitle: 'Элита', requiredValue: 92.5, unit: 'кг' },
        ],
      },
      {
        weightLimitKg: 75,
        label: 'До 75 кг',
        ranks: [
          { level: '3_junior', title: '3 Юношеский', shortTitle: '3 Юн', requiredValue: 12.5, unit: 'кг' },
          { level: '2_junior', title: '2 Юношеский', shortTitle: '2 Юн', requiredValue: 20, unit: 'кг' },
          { level: '1_junior', title: '1 Юношеский', shortTitle: '1 Юн', requiredValue: 27.5, unit: 'кг' },
          { level: '3_adult', title: 'III Взрослый разряд', shortTitle: 'III разряд', requiredValue: 35, unit: 'кг' },
          { level: '2_adult', title: 'II Взрослый разряд', shortTitle: 'II разряд', requiredValue: 45, unit: 'кг' },
          { level: '1_adult', title: 'I Взрослый разряд', shortTitle: 'I разряд', requiredValue: 55, unit: 'кг' },
          { level: 'cms', title: 'КМС (WSF)', shortTitle: 'КМС', requiredValue: 65, unit: 'кг' },
          { level: 'ms', title: 'МС (Мастер спорта WSF)', shortTitle: 'МС', requiredValue: 77.5, unit: 'кг' },
          { level: 'msmk', title: 'МСМК (WSF International)', shortTitle: 'МСМК', requiredValue: 90, unit: 'кг' },
          { level: 'elite', title: 'Элита Стритлифтинга (WSF)', shortTitle: 'Элита', requiredValue: 100, unit: 'кг' },
        ],
      },
      {
        weightLimitKg: 82.5,
        label: 'До 82.5 кг',
        ranks: [
          { level: '3_junior', title: '3 Юношеский', shortTitle: '3 Юн', requiredValue: 15, unit: 'кг' },
          { level: '2_junior', title: '2 Юношеский', shortTitle: '2 Юн', requiredValue: 22.5, unit: 'кг' },
          { level: '1_junior', title: '1 Юношеский', shortTitle: '1 Юн', requiredValue: 30, unit: 'кг' },
          { level: '3_adult', title: 'III Взрослый разряд', shortTitle: 'III разряд', requiredValue: 37.5, unit: 'кг' },
          { level: '2_adult', title: 'II Взрослый разряд', shortTitle: 'II разряд', requiredValue: 47.5, unit: 'кг' },
          { level: '1_adult', title: 'I Взрослый разряд', shortTitle: 'I разряд', requiredValue: 57.5, unit: 'кг' },
          { level: 'cms', title: 'КМС (WSF)', shortTitle: 'КМС', requiredValue: 70, unit: 'кг' },
          { level: 'ms', title: 'МС (Мастер спорта WSF)', shortTitle: 'МС', requiredValue: 82.5, unit: 'кг' },
          { level: 'msmk', title: 'МСМК (WSF International)', shortTitle: 'МСМК', requiredValue: 95, unit: 'кг' },
          { level: 'elite', title: 'Элита Стритлифтинга (WSF)', shortTitle: 'Элита', requiredValue: 105, unit: 'кг' },
        ],
      },
      {
        weightLimitKg: 90,
        label: 'До 90 кг',
        ranks: [
          { level: '3_junior', title: '3 Юношеский', shortTitle: '3 Юн', requiredValue: 17.5, unit: 'кг' },
          { level: '2_junior', title: '2 Юношеский', shortTitle: '2 Юн', requiredValue: 25, unit: 'кг' },
          { level: '1_junior', title: '1 Юношеский', shortTitle: '1 Юн', requiredValue: 32.5, unit: 'кг' },
          { level: '3_adult', title: 'III Взрослый разряд', shortTitle: 'III разряд', requiredValue: 40, unit: 'кг' },
          { level: '2_adult', title: 'II Взрослый разряд', shortTitle: 'II разряд', requiredValue: 52.5, unit: 'кг' },
          { level: '1_adult', title: 'I Взрослый разряд', shortTitle: 'I разряд', requiredValue: 62.5, unit: 'кг' },
          { level: 'cms', title: 'КМС (WSF)', shortTitle: 'КМС', requiredValue: 75, unit: 'кг' },
          { level: 'ms', title: 'МС (Мастер спорта WSF)', shortTitle: 'МС', requiredValue: 87.5, unit: 'кг' },
          { level: 'msmk', title: 'МСМК (WSF International)', shortTitle: 'МСМК', requiredValue: 100, unit: 'кг' },
          { level: 'elite', title: 'Элита Стритлифтинга (WSF)', shortTitle: 'Элита', requiredValue: 112.5, unit: 'кг' },
        ],
      },
      {
        weightLimitKg: 100,
        label: 'До 100 кг',
        ranks: [
          { level: '3_junior', title: '3 Юношеский', shortTitle: '3 Юн', requiredValue: 20, unit: 'кг' },
          { level: '2_junior', title: '2 Юношеский', shortTitle: '2 Юн', requiredValue: 27.5, unit: 'кг' },
          { level: '1_junior', title: '1 Юношеский', shortTitle: '1 Юн', requiredValue: 35, unit: 'кг' },
          { level: '3_adult', title: 'III Взрослый разряд', shortTitle: 'III разряд', requiredValue: 45, unit: 'кг' },
          { level: '2_adult', title: 'II Взрослый разряд', shortTitle: 'II разряд', requiredValue: 55, unit: 'кг' },
          { level: '1_adult', title: 'I Взрослый разряд', shortTitle: 'I разряд', requiredValue: 67.5, unit: 'кг' },
          { level: 'cms', title: 'КМС (WSF)', shortTitle: 'КМС', requiredValue: 80, unit: 'кг' },
          { level: 'ms', title: 'МС (Мастер спорта WSF)', shortTitle: 'МС', requiredValue: 92.5, unit: 'кг' },
          { level: 'msmk', title: 'МСМК (WSF International)', shortTitle: 'МСМК', requiredValue: 107.5, unit: 'кг' },
          { level: 'elite', title: 'Элита Стритлифтинга (WSF)', shortTitle: 'Элита', requiredValue: 120, unit: 'кг' },
        ],
      },
    ],
  },
  {
    id: 'wsf_dips',
    name: 'Отжимания на брусьях с весом (WSF Classic с ДК)',
    category: 'streetlifting',
    federation: 'WSF',
    unit: 'кг',
    isLowerBetter: false,
    weightCategories: [
      {
        weightLimitKg: 67.5,
        label: 'До 67.5 кг',
        ranks: [
          { level: '3_adult', title: 'III Взрослый разряд', shortTitle: 'III разряд', requiredValue: 50, unit: 'кг' },
          { level: '2_adult', title: 'II Взрослый разряд', shortTitle: 'II разряд', requiredValue: 62.5, unit: 'кг' },
          { level: '1_adult', title: 'I Взрослый разряд', shortTitle: 'I разряд', requiredValue: 75, unit: 'кг' },
          { level: 'cms', title: 'КМС (WSF)', shortTitle: 'КМС', requiredValue: 90, unit: 'кг' },
          { level: 'ms', title: 'МС (Мастер спорта WSF)', shortTitle: 'МС', requiredValue: 105, unit: 'кг' },
          { level: 'msmk', title: 'МСМК (WSF International)', shortTitle: 'МСМК', requiredValue: 120, unit: 'кг' },
          { level: 'elite', title: 'Элита (WSF)', shortTitle: 'Элита', requiredValue: 135, unit: 'кг' },
        ],
      },
      {
        weightLimitKg: 75,
        label: 'До 75 кг',
        ranks: [
          { level: '3_adult', title: 'III Взрослый разряд', shortTitle: 'III разряд', requiredValue: 55, unit: 'кг' },
          { level: '2_adult', title: 'II Взрослый разряд', shortTitle: 'II разряд', requiredValue: 70, unit: 'кг' },
          { level: '1_adult', title: 'I Взрослый разряд', shortTitle: 'I разряд', requiredValue: 82.5, unit: 'кг' },
          { level: 'cms', title: 'КМС (WSF)', shortTitle: 'КМС', requiredValue: 97.5, unit: 'кг' },
          { level: 'ms', title: 'МС (Мастер спорта WSF)', shortTitle: 'МС', requiredValue: 115, unit: 'кг' },
          { level: 'msmk', title: 'МСМК (WSF International)', shortTitle: 'МСМК', requiredValue: 130, unit: 'кг' },
          { level: 'elite', title: 'Элита (WSF)', shortTitle: 'Элита', requiredValue: 145, unit: 'кг' },
        ],
      },
      {
        weightLimitKg: 82.5,
        label: 'До 82.5 кг',
        ranks: [
          { level: '3_adult', title: 'III Взрослый разряд', shortTitle: 'III разряд', requiredValue: 60, unit: 'кг' },
          { level: '2_adult', title: 'II Взрослый разряд', shortTitle: 'II разряд', requiredValue: 75, unit: 'кг' },
          { level: '1_adult', title: 'I Взрослый разряд', shortTitle: 'I разряд', requiredValue: 90, unit: 'кг' },
          { level: 'cms', title: 'КМС (WSF)', shortTitle: 'КМС', requiredValue: 105, unit: 'кг' },
          { level: 'ms', title: 'МС (Мастер спорта WSF)', shortTitle: 'МС', requiredValue: 122.5, unit: 'кг' },
          { level: 'msmk', title: 'МСМК (WSF International)', shortTitle: 'МСМК', requiredValue: 140, unit: 'кг' },
          { level: 'elite', title: 'Элита (WSF)', shortTitle: 'Элита', requiredValue: 155, unit: 'кг' },
        ],
      },
      {
        weightLimitKg: 90,
        label: 'До 90 кг',
        ranks: [
          { level: '3_adult', title: 'III Взрослый разряд', shortTitle: 'III разряд', requiredValue: 67.5, unit: 'кг' },
          { level: '2_adult', title: 'II Взрослый разряд', shortTitle: 'II разряд', requiredValue: 82.5, unit: 'кг' },
          { level: '1_adult', title: 'I Взрослый разряд', shortTitle: 'I разряд', requiredValue: 97.5, unit: 'кг' },
          { level: 'cms', title: 'КМС (WSF)', shortTitle: 'КМС', requiredValue: 115, unit: 'кг' },
          { level: 'ms', title: 'МС (Мастер спорта WSF)', shortTitle: 'МС', requiredValue: 132.5, unit: 'кг' },
          { level: 'msmk', title: 'МСМК (WSF International)', shortTitle: 'МСМК', requiredValue: 150, unit: 'кг' },
          { level: 'elite', title: 'Элита (WSF)', shortTitle: 'Элита', requiredValue: 165, unit: 'кг' },
        ],
      },
      {
        weightLimitKg: 100,
        label: 'До 100 кг',
        ranks: [
          { level: '3_adult', title: 'III Взрослый разряд', shortTitle: 'III разряд', requiredValue: 72.5, unit: 'кг' },
          { level: '2_adult', title: 'II Взрослый разряд', shortTitle: 'II разряд', requiredValue: 90, unit: 'кг' },
          { level: '1_adult', title: 'I Взрослый разряд', shortTitle: 'I разряд', requiredValue: 105, unit: 'кг' },
          { level: 'cms', title: 'КМС (WSF)', shortTitle: 'КМС', requiredValue: 122.5, unit: 'кг' },
          { level: 'ms', title: 'МС (Мастер спорта WSF)', shortTitle: 'МС', requiredValue: 140, unit: 'кг' },
          { level: 'msmk', title: 'МСМК (WSF International)', shortTitle: 'МСМК', requiredValue: 160, unit: 'кг' },
          { level: 'elite', title: 'Элита (WSF)', shortTitle: 'Элита', requiredValue: 177.5, unit: 'кг' },
        ],
      },
    ],
  },

  // ==========================================
  // ОФП / Street Workout / Фитнес
  // ==========================================
  {
    id: 'bodyweight_pullups',
    name: 'Подтягивания на максимум (ОФП / Фитнес)',
    category: 'fitness',
    federation: 'ОФП / Фитнес',
    unit: 'раз',
    isLowerBetter: false,
    standardRanks: [
      { level: '3_junior', title: '3 Юношеский', shortTitle: '3 Юн', requiredValue: 8, unit: 'раз' },
      { level: '2_junior', title: '2 Юношеский', shortTitle: '2 Юн', requiredValue: 12, unit: 'раз' },
      { level: '1_junior', title: '1 Юношеский', shortTitle: '1 Юн', requiredValue: 16, unit: 'раз' },
      { level: '3_adult', title: 'III Взрослый разряд', shortTitle: 'III разряд', requiredValue: 20, unit: 'раз' },
      { level: '2_adult', title: 'II Взрослый разряд', shortTitle: 'II разряд', requiredValue: 24, unit: 'раз' },
      { level: '1_adult', title: 'I Взрослый разряд', shortTitle: 'I разряд', requiredValue: 28, unit: 'раз' },
      { level: 'cms', title: 'КМС (Стритворкаут ОФП)', shortTitle: 'КМС', requiredValue: 33, unit: 'раз' },
      { level: 'ms', title: 'МС (Мастер спорта ОФП)', shortTitle: 'МС', requiredValue: 38, unit: 'раз' },
      { level: 'msmk', title: 'МСМК (Легенда турника)', shortTitle: 'МСМК', requiredValue: 44, unit: 'раз' },
    ],
  },
  {
    id: 'bodyweight_dips',
    name: 'Отжимания на брусьях на максимум (ОФП)',
    category: 'fitness',
    federation: 'ОФП / Фитнес',
    unit: 'раз',
    isLowerBetter: false,
    standardRanks: [
      { level: '3_junior', title: '3 Юношеский', shortTitle: '3 Юн', requiredValue: 15, unit: 'раз' },
      { level: '2_junior', title: '2 Юношеский', shortTitle: '2 Юн', requiredValue: 22, unit: 'раз' },
      { level: '1_junior', title: '1 Юношеский', shortTitle: '1 Юн', requiredValue: 30, unit: 'раз' },
      { level: '3_adult', title: 'III Взрослый разряд', shortTitle: 'III разряд', requiredValue: 38, unit: 'раз' },
      { level: '2_adult', title: 'II Взрослый разряд', shortTitle: 'II разряд', requiredValue: 46, unit: 'раз' },
      { level: '1_adult', title: 'I Взрослый разряд', shortTitle: 'I разряд', requiredValue: 55, unit: 'раз' },
      { level: 'cms', title: 'КМС (Брусья ОФП)', shortTitle: 'КМС', requiredValue: 66, unit: 'раз' },
      { level: 'ms', title: 'МС (Мастер брусьев)', shortTitle: 'МС', requiredValue: 78, unit: 'раз' },
      { level: 'msmk', title: 'МСМК (Железный трицепс)', shortTitle: 'МСМК', requiredValue: 90, unit: 'раз' },
    ],
  },

  // ==========================================
  // Легкая атлетика (Минспорт / ЕВСК)
  // ==========================================
  {
    id: 'run_100m',
    name: 'Бег 100 метров (Минспорт / ЕВСК)',
    category: 'athletics',
    federation: 'Минспорт / ЕВСК',
    unit: 'сек',
    isLowerBetter: true,
    standardRanks: [
      { level: '3_junior', title: '3 Юношеский', shortTitle: '3 Юн', requiredValue: 15.0, unit: 'сек' },
      { level: '2_junior', title: '2 Юношеский', shortTitle: '2 Юн', requiredValue: 14.2, unit: 'сек' },
      { level: '1_junior', title: '1 Юношеский', shortTitle: '1 Юн', requiredValue: 13.6, unit: 'сек' },
      { level: '3_adult', title: 'III Взрослый разряд', shortTitle: 'III разряд', requiredValue: 13.0, unit: 'сек' },
      { level: '2_adult', title: 'II Взрослый разряд', shortTitle: 'II разряд', requiredValue: 12.6, unit: 'сек' },
      { level: '1_adult', title: 'I Взрослый разряд', shortTitle: 'I разряд', requiredValue: 12.0, unit: 'сек' },
      { level: 'cms', title: 'КМС (Спринт)', shortTitle: 'КМС', requiredValue: 11.4, unit: 'сек' },
      { level: 'ms', title: 'МС (Мастер спорта РФ)', shortTitle: 'МС', requiredValue: 10.8, unit: 'сек' },
      { level: 'msmk', title: 'МСМК (Международный спринтер)', shortTitle: 'МСМК', requiredValue: 10.4, unit: 'сек' },
    ],
  },
  {
    id: 'run_1000m',
    name: 'Бег 1000 метров (Минспорт / ЕВСК)',
    category: 'athletics',
    federation: 'Минспорт / ЕВСК',
    unit: 'сек',
    isLowerBetter: true,
    standardRanks: [
      { level: '3_junior', title: '3 Юношеский (3:40)', shortTitle: '3 Юн', requiredValue: 220, unit: 'сек', description: '3 минуты 40 секунд' },
      { level: '2_junior', title: '2 Юношеский (3:25)', shortTitle: '2 Юн', requiredValue: 205, unit: 'сек', description: '3 минуты 25 секунд' },
      { level: '1_junior', title: '1 Юношеский (3:12)', shortTitle: '1 Юн', requiredValue: 192, unit: 'сек', description: '3 минуты 12 секунд' },
      { level: '3_adult', title: 'III Взрослый разряд (3:00)', shortTitle: 'III разряд', requiredValue: 180, unit: 'сек', description: '3 минуты 00 секунд' },
      { level: '2_adult', title: 'II Взрослый разряд (2:48)', shortTitle: 'II разряд', requiredValue: 168, unit: 'сек', description: '2 минуты 48 секунд' },
      { level: '1_adult', title: 'I Взрослый разряд (2:38)', shortTitle: 'I разряд', requiredValue: 158, unit: 'сек', description: '2 минуты 38 секунд' },
      { level: 'cms', title: 'КМС (2:27)', shortTitle: 'КМС', requiredValue: 147, unit: 'сек', description: '2 минуты 27 секунд' },
      { level: 'ms', title: 'МС (2:20)', shortTitle: 'МС', requiredValue: 140, unit: 'сек', description: '2 минуты 20 секунд' },
      { level: 'msmk', title: 'МСМК (2:15)', shortTitle: 'МСМК', requiredValue: 135, unit: 'сек', description: '2 минуты 15 секунд' },
    ],
  },

  // ==========================================
  // Плавание (World Aquatics / ЕВСК)
  // ==========================================
  {
    id: 'swim_50m',
    name: 'Плавание 50м вольный стиль (ЕВСК)',
    category: 'swimming',
    federation: 'World Aquatics',
    unit: 'сек',
    isLowerBetter: true,
    standardRanks: [
      { level: '3_junior', title: '3 Юношеский', shortTitle: '3 Юн', requiredValue: 40.0, unit: 'сек' },
      { level: '2_junior', title: '2 Юношеский', shortTitle: '2 Юн', requiredValue: 36.0, unit: 'сек' },
      { level: '1_junior', title: '1 Юношеский', shortTitle: '1 Юн', requiredValue: 33.0, unit: 'сек' },
      { level: '3_adult', title: 'III Взрослый разряд', shortTitle: 'III разряд', requiredValue: 30.0, unit: 'сек' },
      { level: '2_adult', title: 'II Взрослый разряд', shortTitle: 'II разряд', requiredValue: 27.8, unit: 'сек' },
      { level: '1_adult', title: 'I Взрослый разряд', shortTitle: 'I разряд', requiredValue: 25.8, unit: 'сек' },
      { level: 'cms', title: 'КМС (Плавание 50м)', shortTitle: 'КМС', requiredValue: 24.3, unit: 'сек' },
      { level: 'ms', title: 'МС (Мастер спорта)', shortTitle: 'МС', requiredValue: 23.4, unit: 'сек' },
      { level: 'msmk', title: 'МСМК (Спринт кролем)', shortTitle: 'МСМК', requiredValue: 22.4, unit: 'сек' },
    ],
  },

  // ==========================================
  // Шаги / Дневная активность
  // ==========================================
  {
    id: 'daily_steps',
    name: 'Норматив активности (Шаги)',
    category: 'steps',
    federation: 'ОФП / Фитнес',
    unit: 'шагов',
    isLowerBetter: false,
    standardRanks: [
      { level: '3_junior', title: 'Бронзовый уровень', shortTitle: 'Бронза', requiredValue: 7000, unit: 'шагов', description: 'Базовая активность' },
      { level: '2_junior', title: 'Серебряный уровень', shortTitle: 'Серебро', requiredValue: 10000, unit: 'шагов', description: 'Здоровая норма ВОЗ' },
      { level: '1_junior', title: 'Золотой уровень', shortTitle: 'Золото', requiredValue: 12500, unit: 'шагов', description: 'Отличный активный день' },
      { level: '3_adult', title: 'Платиновый уровень', shortTitle: 'Платина', requiredValue: 15000, unit: 'шагов', description: 'Высокая подвижность' },
      { level: '2_adult', title: 'Алмазный уровень', shortTitle: 'Алмаз', requiredValue: 20000, unit: 'шагов', description: 'Марафонский уровень' },
      { level: 'cms', title: 'Чемпион ходьбы (25K)', shortTitle: '25K', requiredValue: 25000, unit: 'шагов', description: 'Сверхнагрузка' },
    ],
  },
];

export interface RankComparisonResult {
  movement: SportMovement;
  userResult: number;
  weightCategoryLabel?: string;
  currentRank: SportRankCriteria | null;
  nextRank: SportRankCriteria | null;
  remainingToNext: number;
  percentToNext: number;
  allRanks: {
    criteria: SportRankCriteria;
    status: 'achieved' | 'current' | 'next' | 'locked';
  }[];
}

export function compareResultWithRanks(
  movementId: string,
  userWeightKg: number,
  userResult: number
): RankComparisonResult | null {
  const movement = SPORT_MOVEMENTS.find(m => m.id === movementId);
  if (!movement) return null;

  let ranksList: SportRankCriteria[] = [];
  let weightCategoryLabel: string | undefined;

  if (movement.weightCategories && movement.weightCategories.length > 0) {
    // Find closest or containing weight category
    const cat = movement.weightCategories.find(c => userWeightKg <= c.weightLimitKg)
      || movement.weightCategories[movement.weightCategories.length - 1];
    ranksList = cat.ranks;
    weightCategoryLabel = cat.label;
  } else if (movement.standardRanks) {
    ranksList = movement.standardRanks;
  }

  if (ranksList.length === 0) return null;

  const isLowerBetter = Boolean(movement.isLowerBetter);

  let currentRank: SportRankCriteria | null = null;
  let nextRank: SportRankCriteria | null = null;

  if (!isLowerBetter) {
    // Higher is better (kg, reps, steps)
    for (let i = 0; i < ranksList.length; i++) {
      if (userResult >= ranksList[i].requiredValue) {
        currentRank = ranksList[i];
      } else {
        nextRank = ranksList[i];
        break;
      }
    }
  } else {
    // Lower is better (seconds in running / swimming)
    for (let i = 0; i < ranksList.length; i++) {
      if (userResult <= ranksList[i].requiredValue) {
        currentRank = ranksList[i];
      } else {
        nextRank = ranksList[i];
        break;
      }
    }
  }

  // Calculate remaining
  let remainingToNext = 0;
  let percentToNext = 100;

  if (nextRank) {
    if (!isLowerBetter) {
      remainingToNext = Math.round((nextRank.requiredValue - userResult) * 10) / 10;
      const prevVal = currentRank ? currentRank.requiredValue : 0;
      const range = nextRank.requiredValue - prevVal;
      const earned = userResult - prevVal;
      percentToNext = Math.min(100, Math.max(0, Math.round((earned / range) * 100)));
    } else {
      remainingToNext = Math.round((userResult - nextRank.requiredValue) * 10) / 10;
      const prevVal = currentRank ? currentRank.requiredValue : ranksList[0].requiredValue * 1.25;
      const range = prevVal - nextRank.requiredValue;
      const earned = prevVal - userResult;
      percentToNext = Math.min(100, Math.max(0, Math.round((earned / range) * 100)));
    }
  }

  const allRanksWithStatus = ranksList.map(r => {
    let status: 'achieved' | 'current' | 'next' | 'locked' = 'locked';
    if (currentRank && r.level === currentRank.level) {
      status = 'current';
    } else if (nextRank && r.level === nextRank.level) {
      status = 'next';
    } else if (
      (!isLowerBetter && userResult >= r.requiredValue) ||
      (isLowerBetter && userResult <= r.requiredValue)
    ) {
      status = 'achieved';
    }
    return {
      criteria: r,
      status,
    };
  });

  return {
    movement,
    userResult,
    weightCategoryLabel,
    currentRank,
    nextRank,
    remainingToNext: Math.max(0, remainingToNext),
    percentToNext,
    allRanks: allRanksWithStatus,
  };
}
