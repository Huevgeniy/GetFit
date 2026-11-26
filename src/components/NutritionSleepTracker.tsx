import React, { useState, useMemo } from 'react';
import { 
  Utensils, 
  Moon, 
  Scale, 
  Sparkles, 
  CheckCircle2, 
  Plus, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  AlertCircle, 
  TrendingDown, 
  TrendingUp, 
  Flame, 
  ShieldCheck, 
  Clock, 
  Calendar,
  Layers,
  HeartPulse,
  Brain,
  Trash2,
  Edit2,
  Info
} from 'lucide-react';
import { 
  UserProfile, 
  DailyNutritionRecord, 
  LoggedMealItem, 
  FoodItem, 
  SleepRecord, 
  InBodyRecord, 
  WorkoutRecord 
} from '../types';
import { BASE_FOODS_DATABASE } from '../data/foodsData';
import { apiFetch } from '../lib/api';
import { calculateNutritionTargets } from '../lib/nutritionTargets';

const MEAL_TYPE_LABELS: Record<LoggedMealItem['mealType'], string> = {
  breakfast: 'Завтрак',
  lunch: 'Обед',
  dinner: 'Ужин',
  snack: 'Перекус',
};

const FOOD_CATEGORY_TABS = [
  { id: 'all', label: 'Все' },
  { id: 'meat', label: 'Мясо/Птица/Яйца' },
  { id: 'dairy', label: 'Молочка/Творог' },
  { id: 'grains', label: 'Крупы/Хлеб' },
  { id: 'fruits', label: 'Фрукты/Ягоды' },
  { id: 'vegetables', label: 'Овощи' },
  { id: 'oils_nuts', label: 'Масла/Орехи' },
  { id: 'custom', label: 'Мои продукты' },
];

const round1 = (value: number): number => Math.round(value * 10 + 1e-9) / 10;

/** Ингредиент, который пользователь собирает в один приём пищи. */
interface CompositeIngredient {
  rowId: string;
  foodId: string;
  name: string;
  grams: number;
  caloriesPer100g: number;
  proteinPer100g: number;
  fatPer100g: number;
  carbsPer100g: number;
  fiberPer100g: number;
}

/** Пересчитывает БЖУ ингредиента на указанную граммовку. */
const macrosForGrams = (item: CompositeIngredient, grams: number) => {
  const ratio = Math.max(0, grams) / 100;
  return {
    calories: Math.round(item.caloriesPer100g * ratio),
    protein: round1(item.proteinPer100g * ratio),
    fat: round1(item.fatPer100g * ratio),
    carbs: round1(item.carbsPer100g * ratio),
    fiber: round1(item.fiberPer100g * ratio),
  };
};

interface NutritionSleepTrackerProps {
  user: UserProfile;
  dailyRecords: DailyNutritionRecord[];
  onUpdateDailyRecords: (records: DailyNutritionRecord[]) => void;
  sleepRecords: SleepRecord[];
  onUpdateSleepRecords: (records: SleepRecord[]) => void;
  pastWorkouts: WorkoutRecord[];
  onUpdateUser: (updated: Partial<UserProfile>) => void;
  customFoods: FoodItem[];
  onSaveCustomFood: (food: FoodItem) => void;
}

export const NutritionSleepTracker: React.FC<NutritionSleepTrackerProps> = ({
  user,
  dailyRecords,
  onUpdateDailyRecords,
  sleepRecords,
  onUpdateSleepRecords,
  pastWorkouts,
  onUpdateUser,
  customFoods,
  onSaveCustomFood,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'calories' | 'meals' | 'sleep' | 'analysis'>('calories');
  const [showTargetsModal, setShowTargetsModal] = useState(false);
  // Today's date string YYYY-MM-DD
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // Search & add food state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [inputGrams, setInputGrams] = useState<number>(100);
  const [selectedMealType, setSelectedMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('lunch');
  const [quickTextInput, setQuickTextInput] = useState('');
  const [isAddingFoodModal, setIsAddingFoodModal] = useState(false);
  const [isCreatingNewProduct, setIsCreatingNewProduct] = useState(false);
  /** Сборка одного приёма пищи из нескольких ингредиентов. */
  const [isComposingMeal, setIsComposingMeal] = useState(false);
  const [compositeName, setCompositeName] = useState('');
  const [compositeItems, setCompositeItems] = useState<CompositeIngredient[]>([]);
  const [expandedMealId, setExpandedMealId] = useState<string | null>(null);

  // New product custom creation
  const [newProdName, setNewProdName] = useState('');
  const [newProdCals, setNewProdCals] = useState<number>(150);
  const [newProdProt, setNewProdProt] = useState<number>(10);
  const [newProdFat, setNewProdFat] = useState<number>(5);
  const [newProdCarbs, setNewProdCarbs] = useState<number>(15);
  const [newProdFiber, setNewProdFiber] = useState<number>(2);
  /** Как введены БЖУ: на 100 г или сразу на всю привычную порцию. */
  const [newProdBasis, setNewProdBasis] = useState<'per100' | 'portion'>('per100');
  const [newProdPortion, setNewProdPortion] = useState<number>(100);

  // Morning weigh-in state
  const [morningWeightInput, setMorningWeightInput] = useState<number>(user.currentWeight || 0);
  const [morningWeightSaved, setMorningWeightSaved] = useState(false);

  // Sleep logging state
  const [bedtimeInput, setBedtimeInput] = useState('23:30');
  const [wakeTimeInput, setWakeTimeInput] = useState('07:30');
  const [sleepQualityInput, setSleepQualityInput] = useState<number>(8);
  const [sleepFeelingInput, setSleepFeelingInput] = useState<'exhausted' | 'normal' | 'rested' | 'peak'>('rested');
  const [sleepNotesInput, setSleepNotesInput] = useState('');
  const [sleepLoggedToday, setSleepLoggedToday] = useState(false);

  // AI cross analysis state
  const [aiAnalysisLoading, setAiAnalysisLoading] = useState(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<string | null>(null);

  // Merge base foods + custom foods. Повторы id/названий не допускаем:
  // одинаковые React-ключи ломают перерисовку списка при фильтрации.
  const allFoods = useMemo(() => {
    const seenIds = new Set<string>();
    const seenNames = new Set<string>();
    const merged: FoodItem[] = [];
    for (const food of [...BASE_FOODS_DATABASE, ...customFoods]) {
      if (!food?.id || seenIds.has(food.id)) continue;
      const nameKey = food.name.toLowerCase().replace(/ё/g, 'е').trim();
      if (seenNames.has(nameKey)) continue;
      seenIds.add(food.id);
      seenNames.add(nameKey);
      merged.push(food);
    }
    return merged;
  }, [customFoods]);

  // Current day's record
  const currentDayRecord = useMemo(() => {
    return (
      dailyRecords.find(r => r.date === selectedDate) || {
        date: selectedDate,
        meals: [],
        totalCalories: 0,
        totalProtein: 0,
        totalFat: 0,
        totalCarbs: 0,
        totalFiber: 0,
        targetCalories: 2400,
        targetProtein: 160,
        targetFat: 75,
        targetCarbs: 260,
        targetFiber: 30,
        status: 'open' as const,
      }
    );
  }, [dailyRecords, selectedDate]);

  // Норма питания: базовый обмен по формуле Миффлина — Сан Жеора,
  // затем поправка на активность и цель по весу.
  const calculatedTargets = useMemo(() => calculateNutritionTargets(user), [user]);

  // Filter foods for picker
  const filteredFoods = useMemo(() => {
    return allFoods.filter(food => {
      const matchSearch = food.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCategory = selectedCategory === 'all' || food.category === selectedCategory;
      return matchSearch && matchCategory;
    });
  }, [allFoods, searchQuery, selectedCategory]);

  // Итоги составного приёма пищи: считаем по каждому ингредиенту.
  const compositeTotals = useMemo(() => {
    const sums = compositeItems.reduce(
      (acc, item) => {
        const macros = macrosForGrams(item, item.grams);
        acc.grams += Math.max(0, item.grams);
        acc.calories += macros.calories;
        acc.protein += macros.protein;
        acc.fat += macros.fat;
        acc.carbs += macros.carbs;
        acc.fiber += macros.fiber;
        return acc;
      },
      { grams: 0, calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 },
    );
    return {
      grams: Math.round(sums.grams),
      calories: sums.calories,
      protein: round1(sums.protein),
      fat: round1(sums.fat),
      carbs: round1(sums.carbs),
      fiber: round1(sums.fiber),
    };
  }, [compositeItems]);

  const openAddFoodModal = (mode: 'single' | 'composite' = 'single') => {
    setIsAddingFoodModal(true);
    setIsCreatingNewProduct(false);
    setIsComposingMeal(mode === 'composite');
    if (mode === 'composite') {
      setCompositeName(prev => prev.trim() || MEAL_TYPE_LABELS[selectedMealType]);
    }
  };

  const closeAddFoodModal = () => {
    setIsAddingFoodModal(false);
    setIsCreatingNewProduct(false);
    setIsComposingMeal(false);
    setCompositeName('');
    setCompositeItems([]);
    setSelectedFood(null);
  };

  const handleCompositeMealTypeChange = (value: LoggedMealItem['mealType']) => {
    setSelectedMealType(value);
    setCompositeName(prev => {
      const trimmed = prev.trim();
      const labels = Object.values(MEAL_TYPE_LABELS);
      return !trimmed || labels.includes(trimmed) ? MEAL_TYPE_LABELS[value] : prev;
    });
  };

  const handleAddCompositeIngredient = (food: FoodItem) => {
    const portion = Math.max(1, Math.round(food.defaultGrams || 100));
    setCompositeItems(prev => {
      const existing = prev.find(item => item.foodId === food.id);
      if (existing) {
        // Повторный выбор того же продукта увеличивает его граммовку,
        // а не создаёт вторую одинаковую строку.
        return prev.map(item =>
          item.rowId === existing.rowId ? { ...item, grams: item.grams + portion } : item,
        );
      }
      return [
        ...prev,
        {
          rowId: `ing_${food.id}_${Date.now()}`,
          foodId: food.id,
          name: food.name,
          grams: portion,
          caloriesPer100g: food.caloriesPer100g,
          proteinPer100g: food.proteinPer100g,
          fatPer100g: food.fatPer100g,
          carbsPer100g: food.carbsPer100g,
          fiberPer100g: food.fiberPer100g,
        },
      ];
    });
    setCompositeName(prev => prev.trim() || MEAL_TYPE_LABELS[selectedMealType]);
  };

  const handleCompositeGramsChange = (rowId: string, grams: number) => {
    setCompositeItems(prev =>
      prev.map(item =>
        item.rowId === rowId ? { ...item, grams: Math.max(0, grams) } : item,
      ),
    );
  };

  const handleRemoveCompositeIngredient = (rowId: string) => {
    setCompositeItems(prev => prev.filter(item => item.rowId !== rowId));
  };

  const handleAddCompositeMeal = () => {
    if (compositeItems.length === 0) return;

    const newMeal: LoggedMealItem = {
      id: `meal_${Date.now()}`,
      name: compositeName.trim() || MEAL_TYPE_LABELS[selectedMealType],
      grams: compositeTotals.grams,
      calories: compositeTotals.calories,
      protein: compositeTotals.protein,
      fat: compositeTotals.fat,
      carbs: compositeTotals.carbs,
      fiber: compositeTotals.fiber,
      mealType: selectedMealType,
      timestamp: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
      components: compositeItems.map(item => ({
        foodId: item.foodId,
        name: item.name,
        grams: Math.round(item.grams),
        ...macrosForGrams(item, item.grams),
      })),
    };

    updateDayRecord([...currentDayRecord.meals, newMeal]);
    setExpandedMealId(newMeal.id);
    closeAddFoodModal();
  };

  // Handle adding meal
  const handleAddMealItem = () => {
    if (!selectedFood || inputGrams <= 0) return;

    const multiplier = inputGrams / 100;
    const newMeal: LoggedMealItem = {
      id: `meal_${Date.now()}`,
      foodId: selectedFood.id,
      name: selectedFood.name,
      grams: inputGrams,
      calories: Math.round(selectedFood.caloriesPer100g * multiplier),
      protein: Math.round(selectedFood.proteinPer100g * multiplier * 10) / 10,
      fat: Math.round(selectedFood.fatPer100g * multiplier * 10) / 10,
      carbs: Math.round(selectedFood.carbsPer100g * multiplier * 10) / 10,
      fiber: Math.round(selectedFood.fiberPer100g * multiplier * 10) / 10,
      mealType: selectedMealType,
      timestamp: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
    };

    updateDayRecord([...currentDayRecord.meals, newMeal]);
    setSelectedFood(null);
    setInputGrams(100);
    setIsAddingFoodModal(false);
  };

  // Handle removing meal
  const handleRemoveMealItem = (mealId: string) => {
    const updatedMeals = currentDayRecord.meals.filter(m => m.id !== mealId);
    updateDayRecord(updatedMeals);
  };

  // Helper to update day record
  const updateDayRecord = (meals: LoggedMealItem[], additionalUpdates?: Partial<DailyNutritionRecord>) => {
    const totalCalories = meals.reduce((sum, m) => sum + m.calories, 0);
    const totalProtein = Math.round(meals.reduce((sum, m) => sum + m.protein, 0) * 10) / 10;
    const totalFat = Math.round(meals.reduce((sum, m) => sum + m.fat, 0) * 10) / 10;
    const totalCarbs = Math.round(meals.reduce((sum, m) => sum + m.carbs, 0) * 10) / 10;
    const totalFiber = Math.round(meals.reduce((sum, m) => sum + m.fiber, 0) * 10) / 10;

    const updatedRecord: DailyNutritionRecord = {
      ...currentDayRecord,
      meals,
      totalCalories,
      totalProtein,
      totalFat,
      totalCarbs,
      totalFiber,
      targetCalories: calculatedTargets.calories,
      targetProtein: calculatedTargets.protein,
      targetFat: calculatedTargets.fat,
      targetCarbs: calculatedTargets.carbs,
      targetFiber: calculatedTargets.fiber,
      ...additionalUpdates,
    };

    const existingIndex = dailyRecords.findIndex(r => r.date === selectedDate);
    let newDailyList: DailyNutritionRecord[];
    if (existingIndex >= 0) {
      newDailyList = [...dailyRecords];
      newDailyList[existingIndex] = updatedRecord;
    } else {
      newDailyList = [updatedRecord, ...dailyRecords];
    }

    onUpdateDailyRecords(newDailyList);
  };

  // Save new custom food into DB
  const handleCreateProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName.trim()) return;

    // Пользователь может ввести БЖУ на 100 г или сразу на всю порцию —
    // внутри храним всегда на 100 г, а привычную порцию запоминаем отдельно.
    const portion = Math.max(1, Math.round(newProdPortion || 100));
    const factor = newProdBasis === 'portion' ? 100 / portion : 1;
    const per100 = {
      caloriesPer100g: Math.round(newProdCals * factor),
      proteinPer100g: Math.round(newProdProt * factor * 10) / 10,
      fatPer100g: Math.round(newProdFat * factor * 10) / 10,
      carbsPer100g: Math.round(newProdCarbs * factor * 10) / 10,
      fiberPer100g: Math.round(newProdFiber * factor * 10) / 10,
    };

    // Check if food with same or similar name exists
    const existingIndex = customFoods.findIndex(f => f.name.toLowerCase() === newProdName.trim().toLowerCase());
    if (existingIndex >= 0) {
      // Average macros if logged again with different values as requested
      const existing = customFoods[existingIndex];
      const count = existing.timesLogged || 1;
      const averaged: FoodItem = {
        ...existing,
        caloriesPer100g: Math.round((existing.caloriesPer100g * count + per100.caloriesPer100g) / (count + 1)),
        proteinPer100g: Math.round(((existing.proteinPer100g * count + per100.proteinPer100g) / (count + 1)) * 10) / 10,
        fatPer100g: Math.round(((existing.fatPer100g * count + per100.fatPer100g) / (count + 1)) * 10) / 10,
        carbsPer100g: Math.round(((existing.carbsPer100g * count + per100.carbsPer100g) / (count + 1)) * 10) / 10,
        fiberPer100g: Math.round(((existing.fiberPer100g * count + per100.fiberPer100g) / (count + 1)) * 10) / 10,
        defaultGrams: portion,
        timesLogged: count + 1,
      };
      onSaveCustomFood(averaged);
      setSelectedFood(averaged);
      setInputGrams(averaged.defaultGrams || 100);
      // В режиме сборки новый продукт сразу становится ингредиентом приёма.
      if (isComposingMeal) handleAddCompositeIngredient(averaged);
    } else {
      const newFood: FoodItem = {
        id: `custom_${Date.now()}`,
        name: newProdName.trim(),
        category: 'custom',
        ...per100,
        defaultGrams: portion,
        userAdded: true,
        timesLogged: 1,
      };
      onSaveCustomFood(newFood);
      setSelectedFood(newFood);
      setInputGrams(newFood.defaultGrams || 100);
      // В режиме сборки новый продукт сразу становится ингредиентом приёма.
      if (isComposingMeal) handleAddCompositeIngredient(newFood);
    }

    setIsCreatingNewProduct(false);
    setNewProdName('');
  };

  // Complete / Close the day button
  const handleCloseDay = () => {
    const pDiff = currentDayRecord.totalProtein - calculatedTargets.protein;
    const fDiff = currentDayRecord.totalFat - calculatedTargets.fat;
    const fiberDiff = currentDayRecord.totalFiber - calculatedTargets.fiber;

    let verdict = '';
    if (pDiff >= -5 && fiberDiff >= -3 && Math.abs(fDiff) <= 15) {
      verdict = 'Отличный день! Норма белка и клетчатки закрыта, жиры под контролем. Полное восстановление мышц обеспечено.';
    } else if (pDiff < -15) {
      verdict = `Недобор белка (${Math.abs(Math.round(pDiff))}г). Мышцам не хватает аминокислот для гипертрофии. Завтра добавьте творог или куриное филе.`;
    } else if (fDiff > 20) {
      verdict = `Перебор по жирам (+${Math.round(fDiff)}г). Снизьте количество жареного и соусов, сделайте акцент на сложные углеводы.`;
    } else if (fiberDiff < -8) {
      verdict = `Мало клетчатки (${currentDayRecord.totalFiber}г из ${calculatedTargets.fiber}г). Добавьте в рацион брокколи, зелень, овсянку или яблоки для сытости.`;
    } else {
      verdict = 'День закрыт с хорошим балансом. Продолжайте придерживаться плана!';
    }

    updateDayRecord(currentDayRecord.meals, {
      status: 'closed',
      coachVerdict: verdict,
      closedAt: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
    });
  };

  // Morning weigh-in save
  const handleSaveMorningWeight = () => {
    if (morningWeightInput <= 0) return;
    onUpdateUser({ currentWeight: morningWeightInput });
    updateDayRecord(currentDayRecord.meals, { morningWeightKg: morningWeightInput });
    setMorningWeightSaved(true);
    setTimeout(() => setMorningWeightSaved(false), 3000);
  };

  // Sleep record save
  const handleSaveSleep = () => {
    // Calculate duration in hours
    const [bH, bM] = bedtimeInput.split(':').map(Number);
    const [wH, wM] = wakeTimeInput.split(':').map(Number);
    let diffMinutes = (wH * 60 + wM) - (bH * 60 + bM);
    if (diffMinutes < 0) diffMinutes += 24 * 60; // crossed midnight
    const durationHours = Math.round((diffMinutes / 60) * 10) / 10;

    const newSleep: SleepRecord = {
      id: `sleep_${Date.now()}`,
      date: selectedDate,
      bedtime: bedtimeInput,
      wakeTime: wakeTimeInput,
      durationHours,
      qualityScore: sleepQualityInput,
      feeling: sleepFeelingInput,
      notes: sleepNotesInput.trim() || undefined,
    };

    const existingIndex = sleepRecords.findIndex(s => s.date === selectedDate);
    let updatedSleep: SleepRecord[];
    if (existingIndex >= 0) {
      updatedSleep = [...sleepRecords];
      updatedSleep[existingIndex] = newSleep;
    } else {
      updatedSleep = [newSleep, ...sleepRecords];
    }

    onUpdateSleepRecords(updatedSleep);
    setSleepLoggedToday(true);
    setTimeout(() => setSleepLoggedToday(false), 3000);
  };

  // Deep AI Cross-module analysis
  const handleRunAiCrossAnalysis = async () => {
    setAiAnalysisLoading(true);
    try {
      // Call server endpoint or smart local synergy engine
      const response = await apiFetch('/api/ai/cross-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userProfile: user,
          dailyNutrition: dailyRecords.slice(0, 7),
          sleepRecords: sleepRecords.slice(0, 7),
          pastWorkouts: pastWorkouts.slice(0, 5),
          inBodyRecords: user.inBodyRecords?.slice(0, 3) || [],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setAiAnalysisResult(data.analysis || data.verdict);
      } else {
        throw new Error('Server error');
      }
    } catch {
      // Comprehensive algorithmic fallback engine
      const latestSleep = sleepRecords[0];
      const latestWorkout = pastWorkouts[0];
      const avgSleep = sleepRecords.length > 0 
        ? Math.round(sleepRecords.reduce((acc, s) => acc + s.durationHours, 0) / sleepRecords.length * 10) / 10
        : 7.5;
      
      const pCompliance = currentDayRecord.totalProtein >= calculatedTargets.protein * 0.9;
      const sleepOk = latestSleep ? latestSleep.durationHours >= 7.0 : true;

      const goalLabel =
        user.weightGoalType === 'gain'
          ? 'Набор веса'
          : user.weightGoalType === 'lose'
            ? 'Снижение веса'
            : user.weightGoalType === 'recomp'
              ? 'Перестройка тела'
              : 'Поддержание веса';

      let report = `📊 **Разбор питания и восстановления:**\n\n`;

      if (!sleepOk && latestSleep) {
        report += `⚠️ **Мало сна:** Последний сон — ${latestSleep.durationHours} ч, качество ${latestSleep.qualityScore}/10. Если первый подход в жиме или тяге кажется тяжелее обычного, добавьте отдых между подходами и не гонитесь за рекордом.\n\n`;
      } else {
        report += `✅ **Сон:** В среднем ${avgSleep} ч — хороший запас для восстановления.\n\n`;
      }

      if (pCompliance) {
        report += `✅ **Белок:** ${currentDayRecord.totalProtein} г при цели ${calculatedTargets.protein} г. Для задачи «${goalLabel}» этого достаточно.\n\n`;
      } else {
        report += `⚠️ **Белок:** ${currentDayRecord.totalProtein} г при цели ${calculatedTargets.protein} г. Для задачи «${goalLabel}» стоит добавить белок в следующие приёмы пищи.\n\n`;
      }

      if (user.inBodyRecords && user.inBodyRecords.length >= 2) {
        const [curr, prev] = user.inBodyRecords;
        const muscleDiff = Math.round((curr.skeletalMuscleMassKg - prev.skeletalMuscleMassKg) * 10) / 10;
        const fatDiff = Math.round((curr.bodyFatMassKg - prev.bodyFatMassKg) * 10) / 10;
        report += `📈 **Состав тела:** мышцы ${muscleDiff >= 0 ? '+' : ''}${muscleDiff} кг, жир ${fatDiff >= 0 ? '+' : ''}${fatDiff} кг. Ориентир по калориям: ${calculatedTargets.calories} ккал.`;
      } else {
        report += `💡 **Совет:** Сделайте повторный замер состава тела через 2–3 недели, чтобы сравнить динамику с калориями.`;
      }

      setAiAnalysisResult(report);
    } finally {
      setAiAnalysisLoading(false);
    }
  };

  const caloriesPercent = Math.min(100, Math.round((currentDayRecord.totalCalories / calculatedTargets.calories) * 100));
  const proteinPercent = Math.min(100, Math.round((currentDayRecord.totalProtein / calculatedTargets.protein) * 100));
  const fatPercent = Math.min(100, Math.round((currentDayRecord.totalFat / calculatedTargets.fat) * 100));
  const carbsPercent = Math.min(100, Math.round((currentDayRecord.totalCarbs / calculatedTargets.carbs) * 100));
  const fiberPercent = Math.min(100, Math.round((currentDayRecord.totalFiber / calculatedTargets.fiber) * 100));

  const renderCategoryPills = () => (
    <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs">
      {FOOD_CATEGORY_TABS.map(cat => (
        <button
          key={cat.id}
          type="button"
          onClick={() => setSelectedCategory(cat.id)}
          className={`py-1 px-2.5 rounded-lg whitespace-nowrap font-semibold ${
            selectedCategory === cat.id
              ? 'bg-emerald-500 text-slate-950'
              : 'bg-[#18232f] text-slate-400 hover:text-slate-200'
          }`}
        >
          {cat.label}
        </button>
      ))}
    </div>
  );

  const renderFoodPicker = (
    onPick: (food: FoodItem) => void,
    options: { selectedId?: string; compact?: boolean } = {},
  ) => (
    <div className={`${options.compact ? 'max-h-40' : 'max-h-48'} overflow-y-auto space-y-1.5 pr-1`}>
      {filteredFoods.map(food => {
        const isSelected = options.selectedId === food.id;
        return (
          <div
            key={food.id}
            onClick={() => onPick(food)}
            className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between text-xs ${
              isSelected
                ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300'
                : 'bg-[#151f2b] border-[#223142] text-slate-300 hover:bg-[#18232f]'
            }`}
          >
            <div>
              <div className="font-bold">{food.name}</div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                {food.caloriesPer100g} ккал • Б: {food.proteinPer100g} • Ж: {food.fatPer100g} • У: {food.carbsPer100g} • Клетчатка: {food.fiberPer100g}г
              </div>
            </div>
            <span className={`font-bold ${options.compact ? 'text-teal-300' : 'text-emerald-400'}`}>
              {isSelected ? '✓' : options.compact ? '+' : ''}
            </span>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-4 pb-24">
      {/* Sub-Tabs Header */}
      <div
        id="tour-nutrition-subtabs"
        className="flex bg-[#0f141a] p-1 rounded-xl border border-[#1d2734] gap-1 text-xs"
      >
        <button
          onClick={() => setActiveSubTab('calories')}
          className={`flex-1 py-2 rounded-lg font-semibold transition-all flex items-center justify-center gap-1.5 ${
            activeSubTab === 'calories'
              ? 'bg-emerald-500 text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Utensils className="w-3.5 h-3.5" />
          <span>Калории и БЖУ</span>
        </button>

        <button
          onClick={() => setActiveSubTab('meals')}
          className={`flex-1 py-2 rounded-lg font-semibold transition-all flex items-center justify-center gap-1.5 ${
            activeSubTab === 'meals'
              ? 'bg-emerald-500 text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Приемы пищи ({currentDayRecord.meals.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('sleep')}
          className={`flex-1 py-2 rounded-lg font-semibold transition-all flex items-center justify-center gap-1.5 ${
            activeSubTab === 'sleep'
              ? 'bg-emerald-500 text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Moon className="w-3.5 h-3.5" />
          <span>Сон и отдых</span>
        </button>

        <button
          onClick={() => setActiveSubTab('analysis')}
          className={`flex-1 py-2 rounded-lg font-semibold transition-all flex items-center justify-center gap-1.5 ${
            activeSubTab === 'analysis'
              ? 'bg-emerald-500 text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Brain className="w-3.5 h-3.5" />
          <span>ИИ-Синергия</span>
        </button>
      </div>

      {/* Date Switcher & Morning Weigh-in Bar */}
      <div className="bg-[#12181f] border border-[#1e293b] rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-emerald-400" />
          <span className="text-slate-300 font-semibold">Дата:</span>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="bg-[#18232f] border border-[#263546] rounded-lg px-2.5 py-1 text-slate-100 font-mono text-xs focus:outline-none focus:border-emerald-500"
          />
          {selectedDate === todayStr && (
            <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/30">
              Сегодня
            </span>
          )}
        </div>

        {/* Morning Weigh-in with prompt */}
        <div className="flex items-center gap-2">
          <Scale className="w-4 h-4 text-emerald-400" />
          <span className="text-slate-300 font-semibold">Утром натощак:</span>
          <div className="flex items-center gap-1">
            <input
              type="number"
              step="0.1"
              placeholder="0.0"
              value={morningWeightInput || ''}
              onChange={e => setMorningWeightInput(parseFloat(e.target.value) || 0)}
              className="w-16 bg-[#18232f] border border-[#263546] rounded-lg px-2 py-1 text-slate-100 font-mono text-xs text-right focus:outline-none focus:border-emerald-500"
            />
            <span className="text-slate-400 font-mono">кг</span>
            <button
              onClick={handleSaveMorningWeight}
              className="px-2 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg transition-colors text-[11px]"
            >
              {morningWeightSaved ? '✓' : 'Записать'}
            </button>
          </div>
        </div>
      </div>

      {/* Morning weigh-in reminder hint */}
      <div className="bg-[#0e141b] border border-[#1b2533] rounded-xl p-2.5 flex items-start gap-2.5 text-[11px] text-slate-400">
        <Info className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
        <span>
          <strong className="text-slate-200">Подсказка тренера:</strong> Взвешивайтесь строго утром натощак после туалета до приема воды и пищи. Это исключает колебания жидкости и показывает чистую динамику сухой массы и жира.
        </span>
      </div>

      {/* SUB-TAB 1: Calories & Macros Dashboard */}
      {activeSubTab === 'calories' && (
        <div className="space-y-4">
          {/* Main Target & Balance Card */}
          <div className="bg-gradient-to-br from-[#121c27] via-[#0d141d] to-[#12181f] border border-[#233345] rounded-2xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                  Цель: {user.weightGoalType === 'gain' ? 'Набор веса' : user.weightGoalType === 'lose' ? 'Снижение веса' : user.weightGoalType === 'recomp' ? 'Перестройка тела' : 'Поддержание веса'}
                </span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-2xl font-black font-mono text-slate-100">
                    {currentDayRecord.totalCalories}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    / {calculatedTargets.calories} ккал
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTargetsModal(true)}
                  className="mt-1 inline-flex items-center gap-1 text-[9px] font-semibold text-cyan-400 hover:text-cyan-300"
                >
                  <Info className="w-3 h-3" />
                  Как рассчитана норма?
                </button>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Остаток:</span>
                <div className={`text-lg font-bold font-mono ${
                  calculatedTargets.calories - currentDayRecord.totalCalories >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {calculatedTargets.calories - currentDayRecord.totalCalories >= 0 ? '+' : ''}
                  {calculatedTargets.calories - currentDayRecord.totalCalories} ккал
                </div>
              </div>
            </div>

            {/* Calorie Bar */}
            <div className="w-full bg-[#18232f] h-3 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  caloriesPercent > 105 ? 'bg-amber-500' : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                }`}
                style={{ width: `${Math.min(100, caloriesPercent)}%` }}
              />
            </div>

            {/* Goal-Specific Expert Recommendation Badge */}
            <div className="bg-[#151f2b] p-3 rounded-xl border border-[#202e3f] text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Ориентиры по питанию и восстановлению:</span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                {user.weightGoalType === 'gain' && (
                  <>При наборе веса держите белок <strong>1,6–1,8 г на кг</strong> ({calculatedTargets.protein} г), добавляйте 250–350 ккал сверх обычного и не меньше 25 г клетчатки.</>
                )}
                {user.weightGoalType === 'lose' && (
                  <>При снижении веса белок выше — <strong>2,0–2,2 г на кг</strong> ({calculatedTargets.protein} г), чтобы сохранить мышцы. Клетчатки около 35 г: она помогает дольше оставаться сытым.</>
                )}
                {user.weightGoalType === 'recomp' && (
                  <>При перестройке тела белок <strong>2,2–2,4 г на кг</strong> ({calculatedTargets.protein} г), а калории — примерно на уровне расхода. Жир уходит, мышцы остаются.</>
                )}
                {user.weightGoalType === 'maintain' && (
                  <>Для поддержания веса: {calculatedTargets.protein} г белка, {calculatedTargets.fat} г жиров и {calculatedTargets.carbs} г углеводов в день, плюс около 30 г клетчатки.</>
                )}
              </p>
            </div>

            {/* Macros Breakdown Grid (Proteins, Fats, Carbs, Fiber) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {/* Protein */}
              <div className="bg-[#141d27] border border-[#223142] p-3 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between text-slate-400 text-[11px]">
                  <span>Белки (4 ккал/г)</span>
                  <span className="font-mono text-emerald-400 font-bold">{proteinPercent}%</span>
                </div>
                <div className="flex items-baseline justify-between font-mono">
                  <span className="text-base font-bold text-slate-100">{currentDayRecord.totalProtein}г</span>
                  <span className="text-[10px] text-slate-400">из {calculatedTargets.protein}г</span>
                </div>
                <div className="w-full bg-[#1e2a38] h-1.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-400 h-full rounded-full" style={{ width: `${proteinPercent}%` }} />
                </div>
              </div>

              {/* Fats */}
              <div className="bg-[#141d27] border border-[#223142] p-3 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between text-slate-400 text-[11px]">
                  <span>Жиры (9 ккал/г)</span>
                  <span className="font-mono text-amber-400 font-bold">{fatPercent}%</span>
                </div>
                <div className="flex items-baseline justify-between font-mono">
                  <span className="text-base font-bold text-slate-100">{currentDayRecord.totalFat}г</span>
                  <span className="text-[10px] text-slate-400">из {calculatedTargets.fat}г</span>
                </div>
                <div className="w-full bg-[#1e2a38] h-1.5 rounded-full overflow-hidden">
                  <div className="bg-amber-400 h-full rounded-full" style={{ width: `${fatPercent}%` }} />
                </div>
              </div>

              {/* Carbs */}
              <div className="bg-[#141d27] border border-[#223142] p-3 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between text-slate-400 text-[11px]">
                  <span>Углеводы (4 ккал/г)</span>
                  <span className="font-mono text-teal-400 font-bold">{carbsPercent}%</span>
                </div>
                <div className="flex items-baseline justify-between font-mono">
                  <span className="text-base font-bold text-slate-100">{currentDayRecord.totalCarbs}г</span>
                  <span className="text-[10px] text-slate-400">из {calculatedTargets.carbs}г</span>
                </div>
                <div className="w-full bg-[#1e2a38] h-1.5 rounded-full overflow-hidden">
                  <div className="bg-teal-400 h-full rounded-full" style={{ width: `${carbsPercent}%` }} />
                </div>
              </div>

              {/* Dietary Fiber (Клетчатка) */}
              <div className="bg-[#141d27] border border-emerald-500/30 p-3 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between text-emerald-300 text-[11px] font-semibold">
                  <span>Клетчатка</span>
                  <span className="font-mono text-emerald-400 font-bold">{fiberPercent}%</span>
                </div>
                <div className="flex items-baseline justify-between font-mono">
                  <span className="text-base font-bold text-slate-100">{currentDayRecord.totalFiber}г</span>
                  <span className="text-[10px] text-slate-400">из {calculatedTargets.fiber}г</span>
                </div>
                <div className="w-full bg-[#1e2a38] h-1.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${fiberPercent}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* End of Day & Coach Verdict */}
          <div className="bg-[#12181f] border border-[#1e293b] rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-slate-100">Итоги дня и вывод тренера</h3>
              </div>
              {currentDayRecord.status === 'closed' && (
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  День закрыт в {currentDayRecord.closedAt}
                </span>
              )}
            </div>

            {currentDayRecord.coachVerdict ? (
              <div className="bg-[#0e151c] p-3 rounded-xl border border-emerald-500/30 space-y-1 text-xs">
                <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                  <Brain className="w-3.5 h-3.5" />
                  <span>Заключение по рациону:</span>
                </span>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  {currentDayRecord.coachVerdict}
                </p>
              </div>
            ) : (
              <p className="text-[11px] text-slate-400 leading-relaxed">
                По завершении дня нажмите кнопку ниже, чтобы получить экспертный вердикт тренера: достаточно ли белка для мышц, не превышены ли жиры, закрыта ли клетчатка.
              </p>
            )}

            <button
              onClick={handleCloseDay}
              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{currentDayRecord.status === 'closed' ? 'Обновить вердикт дня' : 'Завершить день и подвести итоги'}</span>
            </button>
          </div>

          {/* Quick Button to Add Meals */}
          <button
            onClick={() => openAddFoodModal('single')}
            className="w-full py-3 bg-[#18232f] hover:bg-[#223142] border border-[#2b3a4e] text-emerald-400 font-bold text-xs rounded-2xl transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Внести блюдо или продукт в дневник</span>
          </button>
          <button
            onClick={() => openAddFoodModal('composite')}
            className="w-full py-3 bg-[#18232f] hover:bg-[#223142] border border-[#2b3a4e] text-teal-300 font-bold text-xs rounded-2xl transition-colors flex items-center justify-center gap-2"
          >
            <Layers className="w-4 h-4" />
            <span>Собрать приём пищи из продуктов</span>
          </button>
        </div>
      )}

      {/* SUB-TAB 2: Meals Logger & Product Database */}
      {activeSubTab === 'meals' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-200">
              Приемы пищи за {selectedDate === todayStr ? 'сегодня' : selectedDate}
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => openAddFoodModal('composite')}
                className="px-3 py-2 bg-[#18232f] hover:bg-[#223142] text-teal-300 border border-teal-500/30 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Собрать приём</span>
              </button>
              <button
                onClick={() => openAddFoodModal('single')}
                className="px-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Добавить блюдо</span>
              </button>
            </div>
          </div>

          {currentDayRecord.meals.length === 0 ? (
            <div className="bg-[#12181f] border border-[#1e293b] rounded-2xl p-8 text-center text-xs text-slate-400 space-y-3">
              <Utensils className="w-8 h-8 text-slate-600 mx-auto" />
              <p>На эту дату пока нет записей о еде.</p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  onClick={() => openAddFoodModal('single')}
                  className="px-4 py-2 bg-[#18232f] text-emerald-400 hover:bg-[#223142] rounded-xl font-bold border border-[#29394b] transition-colors inline-flex items-center gap-2"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Внести продукт</span>
                </button>
                <button
                  onClick={() => openAddFoodModal('composite')}
                  className="px-4 py-2 bg-[#18232f] text-teal-300 hover:bg-[#223142] rounded-xl font-bold border border-teal-500/30 transition-colors inline-flex items-center gap-2"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Собрать приём</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {currentDayRecord.meals.map(meal => {
                const components = Array.isArray(meal.components) ? meal.components : [];
                const hasComponents = components.length > 0;
                const isExpanded = expandedMealId === meal.id;
                return (
                  <div
                    key={meal.id}
                    className="bg-[#12181f] border border-[#1e293b] rounded-xl p-3 text-xs hover:border-[#27374a] transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-100 truncate">{meal.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">({meal.grams} г)</span>
                          <span className="text-[9px] uppercase font-bold text-slate-500 bg-[#18232f] px-1.5 py-0.5 rounded">
                            {MEAL_TYPE_LABELS[meal.mealType] || meal.mealType}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400 font-mono flex-wrap">
                          <span className="text-emerald-400 font-bold">{meal.calories} ккал</span>
                          <span>•</span>
                          <span>Б: {meal.protein}г</span>
                          <span>•</span>
                          <span>Ж: {meal.fat}г</span>
                          <span>•</span>
                          <span>У: {meal.carbs}г</span>
                          <span>•</span>
                          <span className="text-teal-400">Клетчатка: {meal.fiber}г</span>
                        </div>

                        {hasComponents && (
                          <button
                            onClick={() => setExpandedMealId(isExpanded ? null : meal.id)}
                            className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold text-teal-300 hover:text-teal-200 transition-colors"
                            aria-expanded={isExpanded}
                          >
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            <span>Состав ({components.length})</span>
                          </button>
                        )}

                        {hasComponents && isExpanded && (
                          <div className="mt-2 space-y-1.5 border-t border-[#233345] pt-2">
                            {components.map((component, index) => (
                              <div
                                key={`${meal.id}_component_${index}`}
                                className="flex items-start justify-between gap-2 text-[10px]"
                              >
                                <span className="text-slate-300 min-w-0">
                                  {component.name}
                                  <span className="text-slate-500 font-mono"> — {component.grams} г</span>
                                </span>
                                <span className="text-right font-mono text-slate-400 whitespace-nowrap">
                                  {component.calories} ккал • Б {component.protein} / Ж {component.fat} / У {component.carbs}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => handleRemoveMealItem(meal.id)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors"
                        title="Удалить"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 3: Sleep & Recovery Tracker */}
      {activeSubTab === 'sleep' && (
        <div className="space-y-4">
          <div className="bg-[#12181f] border border-[#1e293b] rounded-2xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Moon className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-slate-200">Трекер сна и восстановления</h3>
              </div>
              {sleepLoggedToday && (
                <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  Сохранено ✓
                </span>
              )}
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Фиксируйте время отбоя, пробуждения и ощущение выспанности. ИИ отслеживает связь между качеством сна и силовыми показателями в зале.
            </p>

            {/* Times inputs */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                  Время отбоя (когда лег)
                </label>
                <input
                  type="time"
                  value={bedtimeInput}
                  onChange={e => setBedtimeInput(e.target.value)}
                  className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-2 font-mono text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                  Пробуждение (когда встал)
                </label>
                <input
                  type="time"
                  value={wakeTimeInput}
                  onChange={e => setWakeTimeInput(e.target.value)}
                  className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-2 font-mono text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Quality Score Slider */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-300 font-semibold">Качество сна:</span>
                <span className="font-mono font-bold text-emerald-400">{sleepQualityInput} из 10</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={sleepQualityInput}
                onChange={e => setSleepQualityInput(parseInt(e.target.value, 10))}
                className="w-full accent-emerald-500"
              />
            </div>

            {/* Feeling Selector */}
            <div>
              <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1.5">
                Состояние при подъеме:
              </label>
              <div className="grid grid-cols-4 gap-1.5 text-xs">
                {[
                  { id: 'exhausted', label: 'Разбит', icon: '🥱' },
                  { id: 'normal', label: 'Нормально', icon: '😐' },
                  { id: 'rested', label: 'Отдохнул', icon: '🔋' },
                  { id: 'peak', label: 'На пике', icon: '⚡' },
                ].map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSleepFeelingInput(item.id as any)}
                    className={`py-2 px-1 rounded-xl text-center font-semibold transition-all ${
                      sleepFeelingInput === item.id
                        ? 'bg-emerald-500 text-slate-950 shadow-sm'
                        : 'bg-[#18232f] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="text-base">{item.icon}</div>
                    <div className="text-[10px] mt-0.5">{item.label}</div>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleSaveSleep}
              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-colors"
            >
              Зафиксировать сон за день
            </button>
          </div>

          {/* Sleep History List */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-300 px-1">История сна за последние дни</h4>
            {sleepRecords.length === 0 ? (
              <div className="bg-[#12181f] border border-[#1e293b] rounded-xl p-4 text-center text-xs text-slate-400">
                Пока нет записей о сне. Зафиксируйте первую ночь выше!
              </div>
            ) : (
              sleepRecords.slice(0, 7).map(rec => (
                <div
                  key={rec.id}
                  className="bg-[#12181f] border border-[#1e293b] rounded-xl p-3 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-200">{rec.date}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        ({rec.bedtime} – {rec.wakeTime})
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Оценка: {rec.qualityScore}/10 • {rec.feeling === 'peak' ? 'На пике ⚡' : rec.feeling === 'rested' ? 'Отдохнул 🔋' : rec.feeling === 'normal' ? 'Нормально' : 'Разбит 🥱'}
                    </div>
                  </div>

                  <span className="font-mono font-bold text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-500/30">
                    {rec.durationHours} ч
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 4: AI Cross-Module Synergy & Analytics */}
      {activeSubTab === 'analysis' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-[#121c27] via-[#0d141d] to-[#12181f] border border-emerald-500/40 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-emerald-400" />
              <div>
                <h3 className="text-xs font-bold text-slate-100">Единая нейро-аналитика GetFit</h3>
                <p className="text-[10px] text-slate-400">Связка: Тренировки + Калории/БЖУ + Сон + InBody</p>
              </div>
            </div>

            <p className="text-[11px] text-slate-300 leading-relaxed">
              ИИ проводит сопоставление всех сфер: если на тренировке зафиксирован спад первого подхода в жиме, система проверяет количество сна за прошлую ночь и норму углеводов. При плато в весе сопоставляет калорийность с динамикой мышечной массы InBody.
            </p>

            <button
              onClick={handleRunAiCrossAnalysis}
              disabled={aiAnalysisLoading}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>{aiAnalysisLoading ? 'Анализирую данные атлета...' : 'Запустить глубокий кросс-анализ'}</span>
            </button>
          </div>

          {aiAnalysisResult && (
            <div className="bg-[#12181f] border border-[#1e293b] rounded-2xl p-4 space-y-3 text-xs">
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <HeartPulse className="w-4 h-4" />
                <span>Отчет спортивного ИИ-консилиума:</span>
              </div>
              <div className="text-slate-300 whitespace-pre-line leading-relaxed text-[11px] bg-[#0b1016] p-3 rounded-xl border border-[#1b2533]">
                {aiAnalysisResult}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL: Add Meal / Food Picker */}
      {isAddingFoodModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-3">
          <div className="bg-[#12181f] border border-[#233345] w-full max-w-lg rounded-2xl p-4 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#1d2938] pb-3">
              <div className="flex items-center gap-2">
                <Utensils className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-slate-100">
                  {isCreatingNewProduct
                    ? 'Создать свой продукт в базу'
                    : isComposingMeal
                      ? 'Собрать приём пищи'
                      : 'Добавить блюдо в дневник'}
                </h3>
              </div>
              <button
                onClick={closeAddFoodModal}
                className="text-slate-400 hover:text-slate-200 text-xs font-bold"
                title="Закрыть"
              >
                ✕
              </button>
            </div>

            {/* Переключатель: один продукт или составной приём пищи */}
            {!isCreatingNewProduct && (
              <div className="grid grid-cols-2 gap-1.5 bg-[#0e151c] p-1 rounded-xl border border-[#1f2d3d]">
                <button
                  type="button"
                  onClick={() => setIsComposingMeal(false)}
                  className={`py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                    !isComposingMeal
                      ? 'bg-emerald-500 text-slate-950'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Один продукт
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsComposingMeal(true);
                    setCompositeName(prev => prev.trim() || MEAL_TYPE_LABELS[selectedMealType]);
                  }}
                  className={`py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                    isComposingMeal
                      ? 'bg-teal-400 text-slate-950'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Собрать приём пищи
                </button>
              </div>
            )}

            {/* If creating a brand new product */}
            {isCreatingNewProduct ? (
              <form onSubmit={handleCreateProductSubmit} className="space-y-3 text-xs">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                    Название продукта / блюда
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Например: Протеиновый батончик Bombbar"
                    value={newProdName}
                    onChange={e => setNewProdName(e.target.value)}
                    className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-2 text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="bg-[#18232f] rounded-xl p-2.5 space-y-2">
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setNewProdBasis('per100')}
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold ${
                        newProdBasis === 'per100'
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-[#0e151c] text-slate-400'
                      }`}
                    >
                      БЖУ на 100 г
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewProdBasis('portion')}
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold ${
                        newProdBasis === 'portion'
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-[#0e151c] text-slate-400'
                      }`}
                    >
                      БЖУ на всю порцию
                    </button>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">
                      {newProdBasis === 'portion' ? 'Вес этой порции (г)' : 'Порция по умолчанию (г)'}
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={newProdPortion}
                      onChange={e => setNewProdPortion(parseFloat(e.target.value) || 0)}
                      className="w-full bg-[#0e151c] border border-[#263546] rounded-xl px-3 py-1.5 font-mono text-xs text-slate-100"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    {newProdBasis === 'portion'
                      ? 'Введите граммовку и БЖУ готового блюда целиком — приложение пересчитает на 100 г и запомнит порцию.'
                      : 'Введите БЖУ на 100 г. Порция подставится автоматически при выборе продукта.'}
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">
                      {newProdBasis === 'portion' ? 'Ккал за порцию' : 'Ккал на 100 г'}
                    </label>
                    <input
                      type="number"
                      value={newProdCals}
                      onChange={e => setNewProdCals(parseFloat(e.target.value) || 0)}
                      className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-1.5 font-mono text-xs text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">
                      {newProdBasis === 'portion' ? 'Белки за порцию (г)' : 'Белки на 100 г'}
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={newProdProt}
                      onChange={e => setNewProdProt(parseFloat(e.target.value) || 0)}
                      className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-1.5 font-mono text-xs text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">
                      {newProdBasis === 'portion' ? 'Жиры за порцию (г)' : 'Жиры на 100 г'}
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={newProdFat}
                      onChange={e => setNewProdFat(parseFloat(e.target.value) || 0)}
                      className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-1.5 font-mono text-xs text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">
                      {newProdBasis === 'portion' ? 'Углеводы за порцию (г)' : 'Углеводы на 100 г'}
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={newProdCarbs}
                      onChange={e => setNewProdCarbs(parseFloat(e.target.value) || 0)}
                      className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-1.5 font-mono text-xs text-slate-100"
                    />
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    <label className="text-[10px] text-emerald-400 font-bold block mb-1">
                      {newProdBasis === 'portion' ? 'Клетчатка за порцию (г)' : 'Клетчатка на 100 г'}
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={newProdFiber}
                      onChange={e => setNewProdFiber(parseFloat(e.target.value) || 0)}
                      className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-1.5 font-mono text-xs text-slate-100"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCreatingNewProduct(false)}
                    className="flex-1 py-2 rounded-xl bg-[#18232f] text-slate-300 font-semibold"
                  >
                    Назад к списку
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 transition-colors"
                  >
                    Сохранить в базу
                  </button>
                </div>
              </form>
            ) : isComposingMeal ? (
              <div className="space-y-3">
                {/* Название и тип приёма пищи */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Название приёма</label>
                    <input
                      type="text"
                      placeholder="Например: Завтрак"
                      value={compositeName}
                      onChange={e => setCompositeName(e.target.value)}
                      className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-2 text-slate-100 text-xs focus:outline-none focus:border-teal-400"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Приём пищи</label>
                    <select
                      value={selectedMealType}
                      onChange={e =>
                        handleCompositeMealTypeChange(e.target.value as LoggedMealItem['mealType'])
                      }
                      className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-2.5 py-2 text-slate-100 text-xs"
                    >
                      <option value="breakfast">Завтрак</option>
                      <option value="lunch">Обед</option>
                      <option value="dinner">Ужин</option>
                      <option value="snack">Перекус</option>
                    </select>
                  </div>
                </div>

                {/* Поиск ингредиента */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Найти ингредиент (овсянка, молоко, яйцо...)"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-[#18232f] border border-[#263546] rounded-xl pl-9 pr-3 py-2 text-slate-100 text-xs focus:outline-none focus:border-teal-400"
                  />
                </div>

                {renderCategoryPills()}

                {renderFoodPicker(handleAddCompositeIngredient, { compact: true })}

                {/* Состав приёма */}
                {compositeItems.length > 0 ? (
                  <div className="bg-[#0e151c] rounded-xl border border-[#1f2d3d] p-2.5 space-y-2">
                    <div className="text-[10px] uppercase font-bold text-slate-400">
                      Состав ({compositeItems.length})
                    </div>
                    {compositeItems.map(item => {
                      const macros = macrosForGrams(item, item.grams);
                      return (
                        <div key={item.rowId} className="space-y-1 border-b border-[#1c2836] pb-2 last:border-0 last:pb-0">
                          <div className="flex items-center gap-2">
                            <span className="flex-1 min-w-0 truncate text-xs font-semibold text-slate-200">
                              {item.name}
                            </span>
                            <input
                              type="number"
                              min="0"
                              value={item.grams}
                              onChange={e =>
                                handleCompositeGramsChange(item.rowId, parseFloat(e.target.value) || 0)
                              }
                              className="w-20 bg-[#18232f] border border-[#263546] rounded-lg px-2 py-1 font-mono text-xs text-slate-100 text-right"
                              aria-label={`Граммы: ${item.name}`}
                            />
                            <span className="text-[10px] text-slate-500">г</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveCompositeIngredient(item.rowId)}
                              className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                              title="Убрать ингредиент"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="font-mono text-[10px] text-slate-400 pl-0.5">
                            {macros.calories} ккал • Б {macros.protein} / Ж {macros.fat} / У {macros.carbs} • клетчатка {macros.fiber} г
                          </div>
                        </div>
                      );
                    })}

                    <div className="font-mono text-[11px] text-teal-300 font-bold pt-1">
                      Итого: {compositeTotals.grams} г • {compositeTotals.calories} ккал • Б {compositeTotals.protein} / Ж {compositeTotals.fat} / У {compositeTotals.carbs} • клетчатка {compositeTotals.fiber} г
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 text-center py-2">
                    Добавьте продукты из списка — итоговое КБЖУ посчитается автоматически.
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleAddCompositeMeal}
                  disabled={compositeItems.length === 0}
                  className="w-full py-2.5 bg-teal-400 hover:bg-teal-300 text-slate-950 font-bold text-xs rounded-xl transition-colors shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Добавить приём в дневник
                </button>

                <button
                  type="button"
                  onClick={() => setIsCreatingNewProduct(true)}
                  className="w-full py-2 bg-[#18232f] hover:bg-[#202e3d] text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Нет продукта? Добавить новый в базу</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Поиск продукта (говядина, творог, рис, сыр...)"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-[#18232f] border border-[#263546] rounded-xl pl-9 pr-3 py-2 text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {renderCategoryPills()}

                {renderFoodPicker(
                  food => {
                    setSelectedFood(food);
                    setInputGrams(food.defaultGrams || 100);
                  },
                  { selectedId: selectedFood?.id },
                )}

                {/* Button to create custom if not in list */}
                <button
                  onClick={() => setIsCreatingNewProduct(true)}
                  className="w-full py-2 bg-[#18232f] hover:bg-[#202e3d] text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Нет в списке? Добавить новый продукт в базу</span>
                </button>

                {/* Portions and Meal Type */}
                {selectedFood && (
                  <div className="bg-[#0e151c] p-3 rounded-xl border border-[#1f2d3d] space-y-3 pt-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-200">Выбрано: {selectedFood.name}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-1">Вес порции (грамм)</label>
                        <input
                          type="number"
                          value={inputGrams}
                          onChange={e => setInputGrams(parseFloat(e.target.value) || 0)}
                          className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-1.5 font-mono text-slate-100 text-xs"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 block mb-1">Прием пищи</label>
                        <select
                          value={selectedMealType}
                          onChange={e => setSelectedMealType(e.target.value as any)}
                          className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-2.5 py-1.5 text-slate-100 text-xs"
                        >
                          <option value="breakfast">Завтрак</option>
                          <option value="lunch">Обед</option>
                          <option value="dinner">Ужин</option>
                          <option value="snack">Перекус</option>
                        </select>
                      </div>
                    </div>

                    <div className="text-[11px] font-mono text-emerald-400 pt-1">
                      Итого за порцию: {Math.round(selectedFood.caloriesPer100g * (inputGrams / 100))} ккал • 
                      Б: {Math.round(selectedFood.proteinPer100g * (inputGrams / 100) * 10) / 10}г • 
                      Ж: {Math.round(selectedFood.fatPer100g * (inputGrams / 100) * 10) / 10}г • 
                      У: {Math.round(selectedFood.carbsPer100g * (inputGrams / 100) * 10) / 10}г • 
                      Клетчатка: {Math.round(selectedFood.fiberPer100g * (inputGrams / 100) * 10) / 10}г
                    </div>

                    <button
                      onClick={handleAddMealItem}
                      className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition-colors shadow-md"
                    >
                      Добавить в дневник
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      {showTargetsModal && (
        <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-black/80 p-3 backdrop-blur-sm" onClick={() => setShowTargetsModal(false)}>
          <div className="my-4 w-full max-w-md rounded-2xl border border-[#263a4a] bg-[#0d151c] shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[#1d2c38] px-4 py-3">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-cyan-400" />
                <div>
                  <div className="text-sm font-bold text-slate-100">Как рассчитана норма</div>
                  <div className="text-[9px] text-slate-500">BMR + активность + цель → калории → БЖУ</div>
                </div>
              </div>
              <button type="button" onClick={() => setShowTargetsModal(false)} className="rounded-lg bg-[#18232f] p-1.5 text-slate-400" aria-label="Закрыть разбор">
                <ChevronUp className="h-4 w-4 rotate-180" />
              </button>
            </div>
            <div className="space-y-3 px-4 py-4 text-[10px] text-slate-300">
              <div className="rounded-xl border border-[#223442] bg-[#091117] p-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200">1. Базовый метаболизм (BMR)</span>
                  <span className="font-mono text-cyan-300">{calculatedTargets.bmr} ккал</span>
                </div>
                <div className="mt-1 text-[9px] leading-relaxed text-slate-500">
                  Mifflin-St Jeor: 10 × вес + 6,25 × рост − 5 × возраст {user.gender === 'female' ? '− 161' : '+ 5'}.
                  Взято: вес {user.currentWeight || 75} кг, рост {user.heightCm || 175} см, возраст {user.age || 30}.
                </div>
              </div>
              <div className="rounded-xl border border-[#223442] bg-[#091117] p-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200">2. Поддержка с активностью</span>
                  <span className="font-mono text-emerald-300">{calculatedTargets.maintenanceCalories} ккал</span>
                </div>
                <div className="mt-1 text-[9px] leading-relaxed text-slate-500">
                  BMR × коэффициент активности {calculatedTargets.activityFactor.toFixed(3)}. Уровень: {
                    user.activityLevel === 'sedentary' ? 'низкий' :
                    user.activityLevel === 'active' ? 'высокий' :
                    user.activityLevel === 'very_active' ? 'очень высокий' : 'умеренный'
                  }.
                </div>
              </div>
              <div className="rounded-xl border border-[#223442] bg-[#091117] p-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200">3. Цель: {calculatedTargets.goalLabel}</span>
                  <span className="font-mono text-amber-300">× {calculatedTargets.goalMultiplier.toFixed(2)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[9px] text-slate-500">
                  <span>Расчётная цель</span>
                  <span className="font-mono text-slate-300">{Math.round(calculatedTargets.maintenanceCalories * calculatedTargets.goalMultiplier)} ккал</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[9px] text-slate-500">
                  <span>Итоговая цель</span>
                  <span className="font-mono font-bold text-slate-100">{calculatedTargets.calories} ккал</span>
                </div>
                {calculatedTargets.customCalories && (
                  <div className="mt-1 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[8px] text-amber-200">
                    Стоит ручная цель калорий — она важнее расчёта.
                  </div>
                )}
              </div>
              <div className="rounded-xl border border-[#223442] bg-[#091117] p-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200">4. БЖУ</span>
                  <span className="font-mono text-slate-400">{calculatedTargets.protein * 4 + calculatedTargets.fat * 9 + calculatedTargets.carbs * 4} ккал</span>
                </div>
                <div className="mt-1 grid grid-cols-2 gap-1 text-[9px]">
                  <div className="rounded-lg bg-[#18232f] px-2 py-1">Белки: <b>{calculatedTargets.protein} г</b> · 4 ккал/г</div>
                  <div className="rounded-lg bg-[#18232f] px-2 py-1">Жиры: <b>{calculatedTargets.fat} г</b> · 9 ккал/г</div>
                  <div className="rounded-lg bg-[#18232f] px-2 py-1">Углеводы: <b>{calculatedTargets.carbs} г</b> · 4 ккал/г</div>
                  <div className="rounded-lg bg-[#18232f] px-2 py-1">Клетчатка: <b>{calculatedTargets.fiber} г</b></div>
                </div>
                <div className="mt-1 text-[8px] leading-relaxed text-slate-500">
                  Белок — {calculatedTargets.proteinPerKg} г/кг. Углеводы — остаток калорий после белка и жира, минимум 80 г.
                  Сумма БЖУ может отличаться от цели на 1–5 ккал из-за округления.
                </div>
              </div>
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-2.5 py-2 text-[8px] leading-relaxed text-amber-200/80">
                Это ориентир по формуле, а не медицинская рекомендация. Для точной настройки нужны динамика веса, самочувствие и консультация специалиста.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
