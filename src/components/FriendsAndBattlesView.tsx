import React, { useState, useEffect } from 'react';
import { 
  Swords, 
  Users, 
  Plus, 
  Trophy, 
  Send, 
  Calendar, 
  Flame, 
  UserPlus, 
  Share2, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  DollarSign, 
  Heart, 
  ArrowRight, 
  Clock, 
  Check, 
  X, 
  ChevronRight, 
  Dumbbell, 
  Footprints,
  MessageCircle,
  HelpCircle,
  Award,
  Zap
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { FriendBattle, FriendBet, FriendUser, UserProfile } from '../types';

interface FriendsAndBattlesViewProps {
  user: UserProfile;
  onUpdateUser: (updated: Partial<UserProfile>) => void;
  battles?: FriendBattle[];
  onAddBattle?: (battle: FriendBattle) => void;
  onUpdateBattleProgress?: (battleId: string, amount: number) => void;
}

export const FriendsAndBattlesView: React.FC<FriendsAndBattlesViewProps> = ({
  user,
  onUpdateUser,
  battles = [],
  onAddBattle = () => {},
  onUpdateBattleProgress = () => {},
}) => {
  // Friends state - start clean and purge any legacy fake/mock friends
  const [friends, setFriends] = useState<FriendUser[]>(() => {
    try {
      const saved = localStorage.getItem('getfit_friends_list');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter((f: any) => 
            f.id !== 'f_1' && f.id !== 'f_2' && f.id !== 'f_3' &&
            !f.name?.includes('Артем Медведев') &&
            !f.name?.includes('Илья Сорокин') &&
            !f.name?.includes('Макс Воронов')
          );
          if (cleaned.length !== parsed.length) {
            localStorage.setItem('getfit_friends_list', JSON.stringify(cleaned));
          }
          return cleaned;
        }
      }
      return [];
    } catch {
      return [];
    }
  });

  // Bets / Wagers state - start clean and purge any legacy fake bets
  const [bets, setBets] = useState<FriendBet[]>(() => {
    try {
      const saved = localStorage.getItem('getfit_friend_bets');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter((b: any) => b.id !== 'bet_1' && b.id !== 'bet_2');
          if (cleaned.length !== parsed.length) {
            localStorage.setItem('getfit_friend_bets', JSON.stringify(cleaned));
          }
          return cleaned;
        }
      }
      return [];
    } catch {
      return [];
    }
  });

  // Modals
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [showCreateBattleModal, setShowCreateBattleModal] = useState(false);
  const [showCreateBetModal, setShowCreateBetModal] = useState(false);
  const [preselectedFriend, setPreselectedFriend] = useState<FriendUser | null>(null);

  // New Friend form
  const [newFriendName, setNewFriendName] = useState('');
  const [newFriendUsername, setNewFriendUsername] = useState('');

  // New Battle form
  const [battleFriendId, setBattleFriendId] = useState('');
  const [battleType, setBattleType] = useState<FriendBattle['challengeType']>('steps');
  const [battleDuration, setBattleDuration] = useState('1 неделя');
  const [battleGoal, setBattleGoal] = useState(70000);
  const [battlePenalty, setBattlePenalty] = useState('Оплата кофе и протеинового батончика');

  // New Bet form
  const [betFriendId, setBetFriendId] = useState('');
  const [betType, setBetType] = useState<FriendBet['betType']>('self_challenge');
  const [betTitle, setBetTitle] = useState('');
  const [betDays, setBetDays] = useState(7);
  const [betPenaltyType, setBetPenaltyType] = useState<FriendBet['penaltyType']>('friend_money');
  const [betPenaltyText, setBetPenaltyText] = useState('500 ₽ на шавуху / кофе');
  const [betRespect, setBetRespect] = useState(100);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem('getfit_friends_list', JSON.stringify(friends));
    } catch (e) {
      console.error(e);
    }
  }, [friends]);

  useEffect(() => {
    try {
      localStorage.setItem('getfit_friend_bets', JSON.stringify(bets));
    } catch (e) {
      console.error(e);
    }
  }, [bets]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Add friend
  const handleAddFriendSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFriendName.trim()) return;

    let tg = newFriendUsername.trim();
    if (tg && !tg.startsWith('@')) tg = '@' + tg;

    const colors = ['bg-emerald-600', 'bg-cyan-600', 'bg-indigo-600', 'bg-amber-600', 'bg-rose-600'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const newFriend: FriendUser = {
      id: `f_${Date.now()}`,
      name: newFriendName.trim(),
      username: tg || '@friend',
      avatarBg: randomColor,
      ratingScore: 1250,
      respectPoints: 50,
      rankTitle: 'Атлет',
      status: 'online',
    };

    setFriends(prev => [newFriend, ...prev]);
    setNewFriendName('');
    setNewFriendUsername('');
    setShowAddFriendModal(false);
    showToast(`Кент ${newFriend.name} добавлен!`);
  };

  // Open battle modal with preselected friend
  const handleOpenBattleModal = (f?: FriendUser) => {
    if (friends.length === 0) {
      setShowAddFriendModal(true);
      showToast('Сначала добавьте кента по нику в Telegram!');
      return;
    }
    if (f) {
      setPreselectedFriend(f);
      setBattleFriendId(f.id);
    } else if (friends.length > 0) {
      setBattleFriendId(friends[0].id);
    }
    setShowCreateBattleModal(true);
  };

  // Open bet modal with preselected friend
  const handleOpenBetModal = (f?: FriendUser) => {
    if (friends.length === 0) {
      setShowAddFriendModal(true);
      showToast('Сначала добавьте кента по нику в Telegram!');
      return;
    }
    if (f) {
      setPreselectedFriend(f);
      setBetFriendId(f.id);
    } else if (friends.length > 0) {
      setBetFriendId(friends[0].id);
    }
    setShowCreateBetModal(true);
  };

  // Create Battle Submit
  const handleCreateBattleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const friend = friends.find(f => f.id === battleFriendId) || friends[0];
    if (!friend) return;

    let challengeTitle = '';
    let unit = 'шагов';

    if (battleType === 'steps') {
      challengeTitle = `Заруба по шагам за ${battleDuration}`;
      unit = 'шагов';
    } else if (battleType === 'bench_press') {
      challengeTitle = `Заруба в жиме лежа за ${battleDuration}`;
      unit = 'кг';
    } else if (battleType === 'exercise_progress_percent') {
      challengeTitle = `Прогресс в % за ${battleDuration}`;
      unit = '%';
    } else if (battleType === 'workout_frequency') {
      challengeTitle = `Частота тренировок за ${battleDuration}`;
      unit = 'тренировок';
    } else {
      challengeTitle = `Спортивная заруба за ${battleDuration}`;
      unit = 'баллов';
    }

    const newBattle: FriendBattle = {
      id: `battle_${Date.now()}`,
      friendName: friend.name,
      friendTelegram: friend.username,
      avatarBg: friend.avatarBg,
      challengeType: battleType,
      title: challengeTitle,
      duration: battleDuration,
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      userProgress: 0,
      friendProgress: 0,
      targetGoal: Number(battleGoal) || 50000,
      unit,
      wagerTerms: {
        condition: `Кто первым наберет норму или покажет больший результат за ${battleDuration}`,
        penaltyLoser: battlePenalty,
        rewardWinner: '+250 очков рейтинга и уважение!',
      },
      status: 'pending_friend',
    };

    onAddBattle(newBattle);
    setShowCreateBattleModal(false);
    showToast(`Приглашение на зарубу отправлено ${friend.name} (${friend.username})!`);
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
  };

  // Create Bet Submit
  const handleCreateBetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const friend = friends.find(f => f.id === betFriendId) || friends[0];
    if (!friend || !betTitle.trim()) return;

    const newBet: FriendBet = {
      id: `bet_${Date.now()}`,
      friendId: friend.id,
      friendName: friend.name,
      friendTelegram: friend.username,
      betType,
      title: betTitle.trim(),
      condition: betType === 'self_challenge'
        ? `Я обязуюсь выполнить: ${betTitle.trim()}. Свидетель: ${friend.name}. Если не выполню — штраф: ${betPenaltyText}.`
        : `Вызов для ${friend.name}: ${betTitle.trim()}. Если не выполнит — с него: ${betPenaltyText}.`,
      durationDays: betDays,
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + betDays * 86400000).toISOString().split('T')[0],
      penaltyType: betPenaltyType,
      penaltyText: betPenaltyText,
      rewardRespectPoints: betRespect,
      status: 'active',
      progressPercent: 0,
      createdAt: new Date().toISOString().split('T')[0],
    };

    setBets(prev => [newBet, ...prev]);
    setShowCreateBetModal(false);
    showToast(`Пари заключено! Свидетель: ${friend.name}`);
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
  };

  // Simulate friend accepting battle
  const handleSimulateAcceptBattle = (battleId: string) => {
    const battle = battles.find(b => b.id === battleId);
    if (!battle) return;

    battle.status = 'active';
    showToast(`⚔️ ${battle.friendName} принял(а) зарубу! Погнали!`);
    confetti({ particleCount: 60, spread: 70, origin: { y: 0.5 } });
  };

  // Complete bet
  const handleCompleteBet = (betId: string, won: boolean) => {
    setBets(prev => prev.map(b => {
      if (b.id !== betId) return b;
      return {
        ...b,
        status: won ? 'won' : 'lost',
        progressPercent: won ? 100 : b.progressPercent,
      };
    }));

    if (won) {
      const addedRespect = 100;
      onUpdateUser({
        respectPoints: (user.respectPoints || 0) + addedRespect,
        ratingScore: (user.ratingScore || 0) + 150,
      });
      confetti({ particleCount: 80, spread: 80, origin: { y: 0.5 } });
      showToast(`🤝 Пари выиграно! +${addedRespect} очков респекта начислено!`);
    } else {
      showToast(`Пари отмечено как невыполненное. Время платить цену слова!`);
    }
  };

  const activeBattles = battles.filter(b => b.status === 'active' || b.status === 'pending_friend');
  const activeBets = bets.filter(b => b.status === 'active' || b.status === 'pending_friend');

  return (
    <div className="space-y-4 pb-16">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-slate-950 px-4 py-2.5 rounded-xl font-bold text-xs shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <Sparkles className="w-4 h-4 fill-current" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Hero Stats: Athlete Rating & Respect */}
      <div className="bg-gradient-to-br from-[#121c27] via-[#0f1721] to-[#0d141d] border border-emerald-500/30 rounded-2xl p-4 shadow-lg">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono font-bold">
              <Swords className="w-4 h-4" />
              <span>Социальный хаб & Telegram-сообщество</span>
            </div>
            <h2 className="text-lg font-extrabold text-slate-100 mt-1">
              Друзья, Зарубы и Пари
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Бросай вызов кентам, ставь цену слова на свои цели и зарабатывай рейтинг атлета.
            </p>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-emerald-950/80 border border-emerald-500/30 text-right">
            <span className="text-[10px] text-slate-400 uppercase font-mono block">Твой ранг:</span>
            <span className="text-xs font-extrabold text-emerald-400 font-mono">
              {user.athleteRankTitle && user.athleteRankTitle.trim() ? user.athleteRankTitle : 'Без ранга'}
            </span>
          </div>
        </div>

        {/* Rating & Respect Badges */}
        <div className="grid grid-cols-2 gap-2 mt-3.5">
          <div className="bg-[#16222f] border border-[#24374a] rounded-xl p-2.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400">Рейтинг атлета</div>
              <div className="text-base font-black font-mono text-amber-400">
                {(user.ratingScore || 0).toLocaleString('ru-RU')} pts
              </div>
            </div>
          </div>

          <div className="bg-[#16222f] border border-[#24374a] rounded-xl p-2.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
              <Flame className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400">Очки респекта</div>
              <div className="text-base font-black font-mono text-emerald-400">
                {(user.respectPoints || 0).toLocaleString('ru-RU')} pts
              </div>
            </div>
          </div>
        </div>

        {/* Big Action Buttons: Invite to Battle & Send Bet */}
        <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-[#1b2837]">
          <button
            onClick={() => handleOpenBattleModal()}
            className="py-2.5 px-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 active:scale-95"
          >
            <Swords className="w-4 h-4 fill-current" />
            <span>Пригласить на зарубу</span>
          </button>

          <button
            onClick={() => handleOpenBetModal()}
            className="py-2.5 px-3 bg-[#182635] hover:bg-[#22354a] text-emerald-400 font-extrabold text-xs rounded-xl border border-emerald-500/40 transition-all flex items-center justify-center gap-1.5 active:scale-95"
          >
            <DollarSign className="w-4 h-4" />
            <span>Отправить пари</span>
          </button>
        </div>
      </div>

      {/* Section 1: Friends List (Кенты из Telegram) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Кенты из Telegram ({friends.length})
            </h3>
          </div>

          <button
            onClick={() => setShowAddFriendModal(true)}
            className="flex items-center gap-1 text-xs font-bold text-emerald-400 hover:text-emerald-300"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Добавить кента</span>
          </button>
        </div>

        <div className="space-y-2">
          {friends.length === 0 ? (
            <div className="bg-[#101720] border border-[#202d3c] rounded-2xl p-5 text-center space-y-2">
              <Users className="w-8 h-8 text-slate-500 mx-auto" />
              <h4 className="text-xs font-bold text-slate-200">Нет добавленных кентов</h4>
              <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                Добавь своих реальных друзей по нику в Telegram, чтобы соревноваться и ставить цену слова.
              </p>
              <button
                onClick={() => setShowAddFriendModal(true)}
                className="mt-1 px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl inline-flex items-center gap-1.5 transition-all"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ Добавить первого кента</span>
              </button>
            </div>
          ) : (
            friends.map(f => (
              <div
                key={f.id}
                className="bg-[#121b25] border border-[#202d3c] hover:border-[#2b3c4f] rounded-xl p-3 flex items-center justify-between transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl ${f.avatarBg} text-white font-black text-sm flex items-center justify-center shadow`}>
                    {f.name.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-slate-100">{f.name}</h4>
                      <span className="text-[10px] font-mono text-emerald-400">
                        {f.username}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                      <span>{f.rankTitle}</span>
                      <span>•</span>
                      <span className="font-mono text-amber-400">{f.ratingScore} pts</span>
                      {f.bestRecord && (
                        <>
                          <span>•</span>
                          <span className="text-slate-300">{f.bestRecord}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Fast Action Buttons on Friend Card */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleOpenBattleModal(f)}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[11px] font-bold border border-emerald-500/30 flex items-center gap-1 transition-all active:scale-95"
                    title="Бросить вызов на зарубу"
                  >
                    <Swords className="w-3 h-3" />
                    <span>Заруба</span>
                  </button>

                  <button
                    onClick={() => handleOpenBetModal(f)}
                    className="px-2.5 py-1.5 rounded-lg bg-[#182431] hover:bg-[#233242] text-slate-200 text-[11px] font-semibold border border-[#293a4b] flex items-center gap-1 transition-all active:scale-95"
                    title="Заключить пари с ценой слова"
                  >
                    <span>Пари</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Section 2: Active Friend Battles (Зарубы 1-на-1) */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Swords className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Зарубы 1-на-1 ({activeBattles.length})
            </h3>
          </div>
        </div>

        {activeBattles.length === 0 ? (
          <div className="bg-[#101720] border border-[#202d3c] rounded-2xl p-5 text-center space-y-2">
            <Swords className="w-8 h-8 text-slate-500 mx-auto" />
            <p className="text-xs text-slate-400">Нет активных заруб. Брось вызов другу!</p>
            <button
              onClick={() => handleOpenBattleModal()}
              className="px-3.5 py-1.5 bg-emerald-500 text-slate-950 font-bold text-xs rounded-xl"
            >
              + Создать зарубу
            </button>
          </div>
        ) : (
          activeBattles.map(b => {
            const isPending = b.status === 'pending_friend';
            const userPercent = Math.min(100, Math.round((b.userProgress / b.targetGoal) * 100));
            const friendPercent = Math.min(100, Math.round((b.friendProgress / b.targetGoal) * 100));

            return (
              <div
                key={b.id}
                className="bg-gradient-to-br from-[#121c27] to-[#0e1620] border border-[#223344] hover:border-emerald-500/40 rounded-2xl p-4 space-y-3 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded border ${
                        isPending 
                          ? 'bg-amber-950/60 text-amber-300 border-amber-500/30' 
                          : 'bg-emerald-950/60 text-emerald-300 border-emerald-500/30'
                      }`}>
                        {isPending ? '⏳ Ожидает подтверждения' : '⚔️ В процессе'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {b.duration}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-100 mt-1">
                      {b.title}
                    </h4>
                  </div>

                  <div className="text-right font-mono">
                    <span className="text-xs font-bold text-emerald-400">
                      Цель: {b.targetGoal.toLocaleString('ru-RU')} {b.unit}
                    </span>
                  </div>
                </div>

                {/* Terms / Stake */}
                <div className="bg-[#0b1016] p-2.5 rounded-xl border border-[#1b2635] text-xs space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Проигравшему:</span>
                    <span className="text-rose-400 font-medium">{b.wagerTerms.penaltyLoser}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Победителю:</span>
                    <span className="text-emerald-400 font-medium">{b.wagerTerms.rewardWinner}</span>
                  </div>
                </div>

                {/* Head-to-Head Visual Progress */}
                <div className="space-y-2">
                  {/* You */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1 font-mono">
                      <span className="text-slate-200 font-bold">Ты: {b.userProgress.toLocaleString('ru-RU')} {b.unit}</span>
                      <span className="text-emerald-400 font-bold">{userPercent}%</span>
                    </div>
                    <div className="w-full bg-[#18232f] h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${userPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Friend */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1 font-mono">
                      <span className="text-slate-400">{b.friendName}: {b.friendProgress.toLocaleString('ru-RU')} {b.unit}</span>
                      <span className="text-slate-400 font-bold">{friendPercent}%</span>
                    </div>
                    <div className="w-full bg-[#18232f] h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-slate-600 h-full rounded-full transition-all duration-500"
                        style={{ width: `${friendPercent}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 pt-1">
                  {isPending ? (
                    <button
                      onClick={() => handleSimulateAcceptBattle(b.id)}
                      className="w-full py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-xs rounded-xl border border-amber-500/40 transition-all flex items-center justify-center gap-1.5"
                      title="Симулировать принятие другом"
                    >
                      <Check className="w-4 h-4" />
                      <span>Друг принял вызов (начать зарубу)</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => onUpdateBattleProgress(b.id, b.challengeType === 'steps' ? 2500 : 5)}
                      className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow transition-all active:scale-95 flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Внести прогресс (+{b.challengeType === 'steps' ? '2 500 ш.' : '5 кг'})</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Section 3: Active Bets & Wagers (Пари и Челленджи) */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Пари с ценой слова ({activeBets.length})
            </h3>
          </div>

          <button
            onClick={() => handleOpenBetModal()}
            className="flex items-center gap-1 text-xs font-bold text-emerald-400 hover:text-emerald-300"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Заключить пари</span>
          </button>
        </div>

        {activeBets.length === 0 ? (
          <div className="bg-[#101720] border border-[#202d3c] rounded-2xl p-5 text-center space-y-2">
            <p className="text-xs text-slate-400">Нет активных пари. Поставь цену слова на свою цель!</p>
            <button
              onClick={() => handleOpenBetModal()}
              className="px-3.5 py-1.5 bg-emerald-500 text-slate-950 font-bold text-xs rounded-xl"
            >
              + Заключить пари
            </button>
          </div>
        ) : (
          activeBets.map(bet => (
            <div
              key={bet.id}
              className="bg-gradient-to-br from-[#121c27] to-[#0f1722] border border-[#233446] rounded-2xl p-4 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-mono font-bold text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/30">
                      {bet.betType === 'self_challenge' ? 'Челлендж себе' : 'Вызов другу'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Свидетель: {bet.friendName}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-100 mt-1">
                    {bet.title}
                  </h4>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-amber-400 font-mono font-bold block">
                    +{bet.rewardRespectPoints} респекта
                  </span>
                </div>
              </div>

              {/* Terms */}
              <div className="bg-[#0b1016] p-2.5 rounded-xl border border-[#1a2533] space-y-1.5 text-xs">
                <p className="text-slate-300 leading-relaxed">
                  {bet.condition}
                </p>
                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-[#192432]">
                  <span className="text-slate-400">Штраф при срыве (цена слова):</span>
                  <span className="text-rose-400 font-bold font-mono">
                    {bet.penaltyText}
                  </span>
                </div>
              </div>

              {/* Progress */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1 font-mono">
                  <span className="text-slate-400">Прогресс пари:</span>
                  <span className="text-emerald-400 font-bold">{bet.progressPercent}%</span>
                </div>
                <div className="w-full bg-[#18232f] h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${bet.progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => handleCompleteBet(bet.id, true)}
                  className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow transition-all active:scale-95 flex items-center justify-center gap-1"
                >
                  <Check className="w-4 h-4" />
                  <span>Пари выполнено (победа)</span>
                </button>
                <button
                  onClick={() => handleCompleteBet(bet.id, false)}
                  className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-semibold text-xs rounded-xl border border-rose-500/30 transition-all"
                >
                  Провал
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* MODAL 1: Add Friend */}
      {showAddFriendModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121820] border border-[#263749] rounded-2xl p-4 max-w-sm w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-emerald-400" />
                <span>Добавить кента по Telegram</span>
              </h3>
              <button
                onClick={() => setShowAddFriendModal(false)}
                className="w-8 h-8 rounded-lg bg-[#18232f] text-slate-400 hover:text-slate-200 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddFriendSubmit} className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                  Имя кента:
                </label>
                <input
                  type="text"
                  value={newFriendName}
                  onChange={e => setNewFriendName(e.target.value)}
                  placeholder="Артем, Илья, Денис..."
                  required
                  autoFocus
                  className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                  Telegram @username:
                </label>
                <input
                  type="text"
                  value={newFriendUsername}
                  onChange={e => setNewFriendUsername(e.target.value)}
                  placeholder="@username"
                  className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow transition-all active:scale-95"
              >
                Добавить в список
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Create Battle */}
      {showCreateBattleModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121820] border border-[#263749] rounded-2xl p-4 max-w-sm w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Swords className="w-4 h-4 text-emerald-400" />
                <span>Пригласить на зарубу 1-на-1</span>
              </h3>
              <button
                onClick={() => setShowCreateBattleModal(false)}
                className="w-8 h-8 rounded-lg bg-[#18232f] text-slate-400 hover:text-slate-200 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateBattleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                  Выбери соперника:
                </label>
                <select
                  value={battleFriendId}
                  onChange={e => setBattleFriendId(e.target.value)}
                  className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  {friends.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.username})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                  Вид зарубы:
                </label>
                <select
                  value={battleType}
                  onChange={e => {
                    const val = e.target.value as any;
                    setBattleType(val);
                    if (val === 'steps') setBattleGoal(70000);
                    else if (val === 'bench_press') setBattleGoal(120);
                    else if (val === 'exercise_progress_percent') setBattleGoal(10);
                    else if (val === 'workout_frequency') setBattleGoal(16);
                  }}
                  className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="steps">👟 Заруба по шагам</option>
                  <option value="exercise_progress_percent">📈 Прогресс в упражнении в %</option>
                  <option value="workout_frequency">🔥 Частота тренировок без пропусков</option>
                  <option value="bench_press">🏋️ Жим штанги лежа</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                    Срок:
                  </label>
                  <select
                    value={battleDuration}
                    onChange={e => setBattleDuration(e.target.value)}
                    className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="1 неделя">1 неделя</option>
                    <option value="2 недели">2 недели</option>
                    <option value="1 месяц">1 месяц</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                    Целевой объем:
                  </label>
                  <input
                    type="number"
                    value={battleGoal}
                    onChange={e => setBattleGoal(Number(e.target.value))}
                    required
                    className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-2 text-slate-100 font-mono font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                  Наказание проигравшему (ставка):
                </label>
                <input
                  type="text"
                  value={battlePenalty}
                  onChange={e => setBattlePenalty(e.target.value)}
                  placeholder="Оплата кофе и шавухи, 50 берпи..."
                  required
                  className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow transition-all active:scale-95 flex items-center justify-center gap-1.5"
              >
                <Send className="w-4 h-4" />
                <span>Отправить вызов кенту</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Create Bet */}
      {showCreateBetModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121820] border border-[#263749] rounded-2xl p-4 max-w-sm w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <span>Заключить пари с ценой слова</span>
              </h3>
              <button
                onClick={() => setShowCreateBetModal(false)}
                className="w-8 h-8 rounded-lg bg-[#18232f] text-slate-400 hover:text-slate-200 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateBetSubmit} className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                  Тип пари:
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setBetType('self_challenge')}
                    className={`py-2 px-2.5 rounded-xl border text-center font-bold text-xs transition-all ${
                      betType === 'self_challenge'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500'
                        : 'bg-[#18232f] text-slate-400 border-[#263546]'
                    }`}
                  >
                    Челлендж себе (друг-судья)
                  </button>

                  <button
                    type="button"
                    onClick={() => setBetType('friend_challenge')}
                    className={`py-2 px-2.5 rounded-xl border text-center font-bold text-xs transition-all ${
                      betType === 'friend_challenge'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500'
                        : 'bg-[#18232f] text-slate-400 border-[#263546]'
                    }`}
                  >
                    Вызов другу
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                  С кем пари (друг):
                </label>
                <select
                  value={betFriendId}
                  onChange={e => setBetFriendId(e.target.value)}
                  className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  {friends.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.username})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                  Что нужно выполнить:
                </label>
                <input
                  type="text"
                  value={betTitle}
                  onChange={e => setBetTitle(e.target.value)}
                  placeholder="10 000 шагов 7 дней подряд, жим 110 кг..."
                  required
                  className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                    Срок (дней):
                  </label>
                  <select
                    value={betDays}
                    onChange={e => setBetDays(Number(e.target.value))}
                    className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  >
                    <option value={7}>7 дней</option>
                    <option value={14}>14 дней</option>
                    <option value={21}>21 день</option>
                    <option value={30}>30 дней</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                    Награда (респект):
                  </label>
                  <input
                    type="number"
                    value={betRespect}
                    onChange={e => setBetRespect(Number(e.target.value))}
                    className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-2 text-slate-100 font-mono font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                  Цена слова (штраф при провале):
                </label>
                <input
                  type="text"
                  value={betPenaltyText}
                  onChange={e => setBetPenaltyText(e.target.value)}
                  placeholder="500 ₽ кенту на шавуху/кофе или 1000 ₽ в фонд..."
                  required
                  className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow transition-all active:scale-95"
              >
                Заключить пари 🤝
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
