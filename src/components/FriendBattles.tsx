import React, { useState } from 'react';
import { 
  Swords, 
  Plus, 
  Trophy, 
  Send, 
  Calendar, 
  AlertCircle, 
  Flame, 
  Share2, 
  UserCheck, 
  CheckCircle2,
  Users,
  Heart,
  UserPlus,
  Dumbbell,
  Sparkles,
  Copy,
  MessageCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { FriendBattle, CommunityPost, UserProfile, PersonalRecord, WorkoutPlan } from '../types';
import { FriendsAndBattlesView } from './FriendsAndBattlesView';

interface FriendBattlesProps {
  battles: FriendBattle[];
  onAddBattle: (battle: FriendBattle) => void;
  onUpdateProgress: (battleId: string, amount: number) => void;
  user?: UserProfile;
  personalRecords?: PersonalRecord[];
  workoutPlans?: WorkoutPlan[];
  onUpdateUser?: (updated: Partial<UserProfile>) => void;
}

const INITIAL_COMMUNITY_POSTS: CommunityPost[] = [
  {
    id: 'post_1',
    authorId: 'usr_artem',
    authorName: 'Артем Медведев',
    authorUsername: '@artem_power',
    type: 'record',
    title: 'Жим штанги лежа',
    description: 'Новый личный рекорд после 8 недель силового цикла WRPF. Чувствую отличный запас в трицепсе!',
    details: {
      recordValue: '142.5 кг × 1',
    },
    likes: 18,
    clones: 4,
    createdAt: '2 часа назад',
  },
  {
    id: 'post_2',
    authorId: 'usr_elena',
    authorName: 'Елена Соколова',
    authorUsername: '@elena_fit',
    type: 'complex',
    title: 'Комплекс ОФП: 100 отжиманий + 50 подтягиваний',
    description: 'Сдала контрольный норматив на время. Разминка суставов обязательна!',
    details: {
      recordValue: '08:45 мин',
    },
    likes: 24,
    clones: 7,
    createdAt: 'Вчера',
  },
  {
    id: 'post_3',
    authorId: 'usr_victor',
    authorName: 'Виктор Кузнецов',
    authorUsername: '@victor_street',
    type: 'record',
    title: 'Отжимания на брусьях с весом',
    description: 'Взвешивание 78 кг, навесил блин 48 кг на пояс. Чистая фиксация в верхней точке.',
    details: {
      recordValue: '+48 кг × 3',
    },
    likes: 31,
    clones: 5,
    createdAt: '2 дня назад',
  },
];

export const FriendBattles: React.FC<FriendBattlesProps> = ({
  battles,
  onAddBattle,
  onUpdateProgress,
  user,
  personalRecords = [],
  workoutPlans = [],
  onUpdateUser,
}) => {
  const [activeTab, setActiveTab] = useState<'battles' | 'friends_bets' | 'community'>('battles');

  // Battle modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [friendName, setFriendName] = useState('');
  const [friendTg, setFriendTg] = useState('@');
  const [challengeType, setChallengeType] = useState<FriendBattle['challengeType']>('steps');
  const [title, setTitle] = useState('Заруба по шагам за неделю');
  const [duration, setDuration] = useState<FriendBattle['duration']>('1 неделя');
  const [targetGoal, setTargetGoal] = useState<number>(70000);
  const [unit, setUnit] = useState<string>('шагов');
  const [penaltyLoser, setPenaltyLoser] = useState<string>('1000₽ в копилку пари');
  const [rewardWinner, setRewardWinner] = useState<string>('Банк пари 2000₽');
  const [condition, setCondition] = useState<string>('Кто сделает больше шагов к дедлайну');

  // Community posts & Subscriptions
  const [posts, setPosts] = useState<CommunityPost[]>(() => {
    try {
      const saved = localStorage.getItem('getfit_community_posts');
      return saved ? JSON.parse(saved) : INITIAL_COMMUNITY_POSTS;
    } catch {
      return INITIAL_COMMUNITY_POSTS;
    }
  });

  const [subscriptions, setSubscriptions] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('getfit_subscriptions');
      return saved ? JSON.parse(saved) : ['@artem_power'];
    } catch {
      return ['@artem_power'];
    }
  });

  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishTitle, setPublishTitle] = useState('');
  const [publishValue, setPublishValue] = useState('');
  const [publishDesc, setPublishDesc] = useState('');
  const [shareToast, setShareToast] = useState<string | null>(null);

  const savePosts = (newPosts: CommunityPost[]) => {
    setPosts(newPosts);
    localStorage.setItem('getfit_community_posts', JSON.stringify(newPosts));
  };

  const handleChallengeTypeChange = (type: FriendBattle['challengeType']) => {
    setChallengeType(type);
    if (type === 'steps') {
      setTitle('Заруба по шагам');
      setTargetGoal(70000);
      setUnit('шагов');
      setCondition('Кто первый наберет 70 000 шагов');
    } else if (type === 'bench_press') {
      setTitle('Пари на жим лежа 120 кг');
      setTargetGoal(120);
      setUnit('кг');
      setCondition('Кто быстрее пожмет 120 кг на 1 раз');
      setPenaltyLoser('100 бёрпи на видео + ужин');
      setRewardWinner('Бесплатный спортивный ужин');
    } else if (type === 'pullups') {
      setTitle('Заруба по подтягиваниям');
      setTargetGoal(25);
      setUnit('раз');
      setCondition('Максимум чистых подтягиваний за 1 подход');
    } else if (type === 'discipline_streak') {
      setTitle('Марафон тренировок без пропусков');
      setTargetGoal(16);
      setUnit('тренировок');
      setCondition('16 тренировок за месяц без единого штрафа');
    }
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!friendName || !friendTg) return;

    const newBattle: FriendBattle = {
      id: `battle_${Date.now()}`,
      friendName,
      friendTelegram: friendTg.startsWith('@') ? friendTg : `@${friendTg}`,
      avatarBg: 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30',
      challengeType,
      title,
      duration,
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().split('T')[0],
      userProgress: 0,
      friendProgress: 0,
      targetGoal,
      unit,
      wagerTerms: {
        condition,
        penaltyLoser,
        rewardWinner,
      },
      status: 'active',
    };

    onAddBattle(newBattle);
    setShowCreateModal(false);
    confetti({ particleCount: 50, spread: 60 });
  };

  const handleNudgeFriend = (battle: FriendBattle) => {
    const text = `🔥 GetFit: Привет, ${battle.friendName}! Напоминаю про нашу зарубу «${battle.title}». Мой прогресс: ${battle.userProgress} ${battle.unit} против твоих: ${battle.friendProgress} ${battle.unit}. Не отставай, на кону: ${battle.wagerTerms.penaltyLoser}!`;
    setShareToast(`Ссылка-вызов для ${battle.friendTelegram} скопирована!`);
    setTimeout(() => setShareToast(null), 3000);

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }

    try {
      const tg = (window as any).Telegram?.WebApp;
      const shareUrl = `https://t.me/share/url?url=${encodeURIComponent('https://t.me/get_fitbot')}&text=${encodeURIComponent(text)}`;
      if (tg?.openTelegramLink) {
        tg.openTelegramLink(shareUrl);
      }
    } catch {
      // fallback to clipboard
    }
  };

  const handleToggleLike = (postId: string) => {
    const updated = posts.map(p => {
      if (p.id === postId) {
        const hasLiked = !p.hasLiked;
        return {
          ...p,
          hasLiked,
          likes: hasLiked ? p.likes + 1 : p.likes - 1,
        };
      }
      return p;
    });
    savePosts(updated);
  };

  const handleToggleSubscribe = (authorUsername: string) => {
    let updated: string[];
    if (subscriptions.includes(authorUsername)) {
      updated = subscriptions.filter(s => s !== authorUsername);
      setShareToast(`Отписка от ${authorUsername}`);
    } else {
      updated = [...subscriptions, authorUsername];
      setShareToast(`Вы подписались на ${authorUsername}!`);
      confetti({ particleCount: 25, spread: 40 });
    }
    setSubscriptions(updated);
    localStorage.setItem('getfit_subscriptions', JSON.stringify(updated));
    setTimeout(() => setShareToast(null), 2500);
  };

  const handlePublishPost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!publishTitle.trim() || !publishValue.trim()) return;

    const newPost: CommunityPost = {
      id: `post_${Date.now()}`,
      authorId: user?.id || 'usr_me',
      authorName: user?.name || 'Атлет',
      authorUsername: user?.telegramUsername || '@athlete',
      type: 'record',
      title: publishTitle.trim(),
      description: publishDesc.trim() || 'Новое спортивное достижение опубликовано в ленту!',
      details: {
        recordValue: publishValue.trim(),
      },
      likes: 1,
      hasLiked: true,
      clones: 0,
      createdAt: 'Только что',
    };

    savePosts([newPost, ...posts]);
    setShowPublishModal(false);
    setPublishTitle('');
    setPublishValue('');
    setPublishDesc('');
    confetti({ particleCount: 40, spread: 60 });
  };

  const handleChallengeAthlete = (post: CommunityPost) => {
    setFriendName(post.authorName);
    setFriendTg(post.authorUsername);
    setTitle(`Вызов: ${post.title}`);
    setActiveTab('battles');
    setShowCreateModal(true);
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Toast Notification */}
      {shareToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-slate-950 px-4 py-2 rounded-xl text-xs font-bold shadow-lg animate-bounce">
          {shareToast}
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="grid grid-cols-3 gap-1 bg-[#12181f] p-1 rounded-xl border border-[#1e293b]">
        <button
          onClick={() => setActiveTab('battles')}
          className={`py-2 px-1 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-all ${
            activeTab === 'battles'
              ? 'bg-emerald-500 text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Swords className="w-3.5 h-3.5" />
          <span>Зарубы ({battles.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('friends_bets')}
          className={`py-2 px-1 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-all ${
            activeTab === 'friends_bets'
              ? 'bg-emerald-500 text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>Друзья & Пари</span>
        </button>

        <button
          onClick={() => setActiveTab('community')}
          className={`py-2 px-1 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-all ${
            activeTab === 'community'
              ? 'bg-emerald-500 text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Лента</span>
        </button>
      </div>

      {activeTab === 'friends_bets' ? (
        <FriendsAndBattlesView
          user={user || {
            id: 'user_1',
            name: 'Атлет',
            telegramUsername: '@athlete',
            disciplineScore: 100,
            streakDays: 0,
            longestStreak: 0,
            currentWeight: 75,
            targetWeight: 75,
            weightGoalType: 'maintain',
            dailyStepGoal: 10000,
            selectedDisciplines: ['gym'],
          }}
          onUpdateUser={onUpdateUser || (() => {})}
          battles={battles}
          onAddBattle={onAddBattle}
          onUpdateBattleProgress={onUpdateProgress}
        />
      ) : activeTab === 'battles' ? (
        <>
          {/* Header Banner */}
          <div className="bg-gradient-to-br from-[#121c27] to-[#0c131a] border border-[#233345] rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Swords className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-sm font-bold text-slate-100">Зарубы и Пари с друзьями</h2>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed max-w-[280px]">
                  Добавь друга из Telegram, ставь на кон штраф или бонус и соревнуйся по шагам, жиму и тренировкам!
                </p>
              </div>

              <button
                onClick={() => setShowCreateModal(true)}
                className="p-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl shadow-md shadow-emerald-500/20 font-bold transition-all"
                title="Создать пари"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Active Battles List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Активные зарубы ({battles.length})
              </span>
              <button
                onClick={() => setShowCreateModal(true)}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Кинуть пари</span>
              </button>
            </div>

            {battles.length === 0 ? (
              <div className="bg-[#12181f] border border-[#1e293b] rounded-xl p-6 text-center text-xs text-slate-400">
                Пока нет активных заруб. Нажми «Кинуть пари», чтобы бросить вызов другу в Telegram!
              </div>
            ) : (
              battles.map(battle => {
                const userPercent = Math.min(100, Math.round((battle.userProgress / battle.targetGoal) * 100));
                const friendPercent = Math.min(100, Math.round((battle.friendProgress / battle.targetGoal) * 100));
                const isUserLeading = battle.userProgress >= battle.friendProgress;

                return (
                  <div
                    key={battle.id}
                    className="bg-[#12181f] border border-[#1e293b] rounded-2xl p-4 space-y-3 relative overflow-hidden"
                  >
                    {/* Battle Title & Friend info */}
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] text-emerald-400 font-mono uppercase tracking-wider font-semibold">
                          Срок: {battle.duration}
                        </span>
                        <h3 className="text-sm font-bold text-slate-100 mt-0.5">{battle.title}</h3>
                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                          <span>Противник: <strong>{battle.friendName}</strong></span>
                          <span className="text-emerald-400/90 font-mono text-[11px]">
                            {battle.friendTelegram}
                          </span>
                        </div>
                      </div>

                      {isUserLeading ? (
                        <div className="px-2 py-1 bg-emerald-950/80 border border-emerald-500/40 rounded-lg text-emerald-400 font-mono text-[11px] font-bold flex items-center gap-1">
                          <Trophy className="w-3 h-3" />
                          <span>Лидируешь</span>
                        </div>
                      ) : (
                        <div className="px-2 py-1 bg-amber-950/80 border border-amber-500/40 rounded-lg text-amber-400 font-mono text-[11px] font-bold">
                          Догоняешь
                        </div>
                      )}
                    </div>

                    {/* VS Comparison Progress Bars */}
                    <div className="bg-[#0c1218] p-3 rounded-xl border border-[#1b2532] space-y-2.5">
                      {/* User Bar */}
                      <div>
                        <div className="flex justify-between text-xs font-mono mb-1">
                          <span className="text-emerald-400 font-bold">Ты</span>
                          <span className="text-slate-200 font-bold">
                            {battle.userProgress.toLocaleString()} / {battle.targetGoal.toLocaleString()} {battle.unit}
                          </span>
                        </div>
                        <div className="w-full bg-[#16202c] h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                            style={{ width: `${userPercent}%` }}
                          />
                        </div>
                      </div>

                      {/* Friend Bar */}
                      <div>
                        <div className="flex justify-between text-xs font-mono mb-1">
                          <span className="text-slate-400 font-medium">{battle.friendName}</span>
                          <span className="text-slate-400 font-medium">
                            {battle.friendProgress.toLocaleString()} / {battle.targetGoal.toLocaleString()} {battle.unit}
                          </span>
                        </div>
                        <div className="w-full bg-[#16202c] h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-slate-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${friendPercent}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Wager Terms */}
                    <div className="grid grid-cols-2 gap-2 text-xs bg-[#151d26] p-2.5 rounded-xl">
                      <div>
                        <span className="text-[10px] text-rose-400 font-semibold uppercase block">
                          Штраф проигравшему:
                        </span>
                        <span className="text-slate-200 font-medium leading-tight block mt-0.5">
                          {battle.wagerTerms.penaltyLoser}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-emerald-400 font-semibold uppercase block">
                          Бонус победителю:
                        </span>
                        <span className="text-slate-200 font-medium leading-tight block mt-0.5">
                          {battle.wagerTerms.rewardWinner}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => handleNudgeFriend(battle)}
                        className="flex-1 py-2 rounded-xl bg-[#1a2533] hover:bg-[#243345] text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Share2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Подколоть в TG</span>
                      </button>

                      <button
                        onClick={() => {
                          const inc = battle.challengeType === 'steps' ? 2000 : 1;
                          onUpdateProgress(battle.id, inc);
                        }}
                        className="px-3 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 text-xs font-bold transition-colors"
                      >
                        +Прогресс
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      ) : (
        /* Community Feed Tab */
        <div className="space-y-3">
          {/* Feed Header & Publish CTA */}
          <div className="bg-[#12181f] border border-[#1e293b] rounded-2xl p-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-emerald-400" />
                <span>Лента атлетов GetFit</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Публикуй рекорды, подписывайся на спортсменов и бросай вызов!
              </p>
            </div>

            <button
              onClick={() => setShowPublishModal(true)}
              className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Поделиться</span>
            </button>
          </div>

          {/* Posts List */}
          <div className="space-y-3">
            {posts.map(post => {
              const isSubscribed = subscriptions.includes(post.authorUsername);

              return (
                <div
                  key={post.id}
                  className="bg-[#12181f] border border-[#1e293b] rounded-2xl p-4 space-y-3"
                >
                  {/* Author Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 flex items-center justify-center font-bold text-xs">
                        {post.authorName.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-100">{post.authorName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{post.authorUsername} • {post.createdAt}</div>
                      </div>
                    </div>

                    {post.authorUsername !== (user?.telegramUsername || '@athlete') && (
                      <button
                        onClick={() => handleToggleSubscribe(post.authorUsername)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors flex items-center gap-1 ${
                          isSubscribed
                            ? 'bg-slate-800 text-slate-300 border-slate-700'
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                        }`}
                      >
                        {isSubscribed ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            <span>Подписан</span>
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-3 h-3" />
                            <span>Подписаться</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Post Content */}
                  <div className="bg-[#0e141a] p-3 rounded-xl border border-[#1d2938] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-200">{post.title}</span>
                      <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/30 font-mono font-bold text-xs">
                        {post.details.recordValue}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {post.description}
                    </p>
                  </div>

                  {/* Post Actions: Like, Challenge */}
                  <div className="flex items-center justify-between pt-1 text-xs">
                    <button
                      onClick={() => handleToggleLike(post.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-colors ${
                        post.hasLiked
                          ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                          : 'bg-[#16202a] border-[#253342] text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Heart className={`w-3.5 h-3.5 ${post.hasLiked ? 'fill-rose-400' : ''}`} />
                      <span className="font-mono font-semibold">{post.likes}</span>
                    </button>

                    <button
                      onClick={() => handleChallengeAthlete(post)}
                      className="px-3 py-1.5 rounded-xl bg-[#16202a] hover:bg-[#1f2c3a] border border-[#253342] text-emerald-400 font-bold flex items-center gap-1.5 transition-colors"
                    >
                      <Swords className="w-3.5 h-3.5" />
                      <span>Бросить вызов</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Create Battle Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#12181f] border border-[#253342] rounded-2xl p-4 max-w-sm w-full max-h-[90vh] overflow-y-auto space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Swords className="w-4 h-4 text-emerald-400" />
                <span>Кинуть пари другу в Telegram</span>
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-200 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                  Имя атлета:
                </label>
                <input
                  type="text"
                  value={friendName}
                  onChange={e => setFriendName(e.target.value)}
                  placeholder="Дмитрий Соколов"
                  required
                  className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                  Юзернейм в Telegram:
                </label>
                <input
                  type="text"
                  value={friendTg}
                  onChange={e => setFriendTg(e.target.value)}
                  placeholder="@dmitry_iron"
                  required
                  className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-2 font-mono text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                  Тип соревнования:
                </label>
                <select
                  value={challengeType}
                  onChange={e => handleChallengeTypeChange(e.target.value as any)}
                  className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="steps">Дневные / недельные шаги</option>
                  <option value="bench_press">Жим лежа (1ПМ или рабочий вес)</option>
                  <option value="pullups">Подтягивания на максимум</option>
                  <option value="discipline_streak">Дисциплина (тренировки без пропусков)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                    Срок пари:
                  </label>
                  <select
                    value={duration}
                    onChange={e => setDuration(e.target.value as any)}
                    className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="1 неделя">1 неделя</option>
                    <option value="2 недели">2 недели</option>
                    <option value="1 месяц">1 месяц</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                    Цель ({unit}):
                  </label>
                  <input
                    type="number"
                    value={targetGoal}
                    onChange={e => setTargetGoal(parseFloat(e.target.value) || 1)}
                    className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-2 font-mono text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-rose-400 uppercase font-bold block mb-1">
                  Штраф проигравшему (наказание):
                </label>
                <input
                  type="text"
                  value={penaltyLoser}
                  onChange={e => setPenaltyLoser(e.target.value)}
                  placeholder="1000₽ в фонд пари / 100 бёрпи на видео..."
                  required
                  className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[10px] text-emerald-400 uppercase font-bold block mb-1">
                  Бонус победителю:
                </label>
                <input
                  type="text"
                  value={rewardWinner}
                  onChange={e => setRewardWinner(e.target.value)}
                  placeholder="Банк пари / Обед за счет друга..."
                  required
                  className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-[#1a2430] text-slate-300 font-semibold"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-md shadow-emerald-500/20"
                >
                  Бросить вызов
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Publish Post to Community Modal */}
      {showPublishModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#12181f] border border-[#253342] rounded-2xl p-4 max-w-sm w-full space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100">Поделиться рекордом в ленту</h3>
              <button
                onClick={() => setShowPublishModal(false)}
                className="text-slate-400 hover:text-slate-200 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePublishPost} className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                  Упражнение / Движение:
                </label>
                <input
                  type="text"
                  value={publishTitle}
                  onChange={e => setPublishTitle(e.target.value)}
                  placeholder="Жим лежа, Подтягивания с весом, Забег 10 км..."
                  required
                  className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                  Твой результат:
                </label>
                <input
                  type="text"
                  value={publishValue}
                  onChange={e => setPublishValue(e.target.value)}
                  placeholder="130 кг × 3, 30 повторений, 42:15 мин..."
                  required
                  className="w-full bg-[#18232f] border border-[#263546] rounded-xl px-3 py-2 font-mono text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                  Комментарий атлета:
                </label>
                <textarea
                  rows={2}
                  value={publishDesc}
                  onChange={e => setPublishDesc(e.target.value)}
                  placeholder="Как прошла подготовка, техника, самочувствие..."
                  className="w-full bg-[#18232f] border border-[#263546] rounded-xl p-2 text-slate-100 focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowPublishModal(false)}
                  className="flex-1 py-2 rounded-xl bg-[#1a2430] text-slate-300 font-semibold"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold"
                >
                  Опубликовать
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
