import type { LanguageCode } from '../types/language';
import type { Phrase, PhraseTranslation } from '../types/phrase';

const t = (
  text: string,
  meaning: string,
  pronunciation?: string,
): PhraseTranslation => ({
  text,
  meaning,
  ...(pronunciation ? { pronunciation } : {}),
});

const tx = (
  translations: {
    en: PhraseTranslation;
  } & Partial<Record<LanguageCode, PhraseTranslation>>,
) => translations;

export const phrases: Phrase[] = [
  {
    id: 'callouts-behind-you',
    category: 'callouts',
    tags: ['enemy-position', 'danger', 'awareness'],
    translations: tx({
      en: t('Behind you!', 'An enemy is directly behind you.'),
      fr: t('Derriere toi !', 'Un ennemi est juste derriere toi.'),
      es: t('Detras de ti!', 'Un enemigo esta justo detras de ti.'),
      de: t('Hinter dir!', 'Ein Gegner ist direkt hinter dir.'),
      ar: t('وراك!', 'هناك عدو خلفك مباشرة.'),
      tr: t('Arkanda!', 'Bir dusman hemen arkanda.'),
      ru: t('Сзади!', 'Противник прямо у тебя за спиной.'),
      ja: t('後ろ!', '敵が真後ろにいる。'),
      ko: t('뒤에!', '적이 바로 뒤에 있다.'),
      zh: t('你后面!', '敌人就在你身后。'),
    }),
  },
  {
    id: 'callouts-left-side',
    category: 'callouts',
    tags: ['lane-info', 'pressure', 'enemy-position'],
    translations: tx({
      en: t('Left side!', 'Enemy pressure is coming from the left.'),
      fr: t('A gauche !', 'La pression ennemie arrive par la gauche.'),
      es: t('A la izquierda!', 'La presion enemiga viene por la izquierda.'),
      de: t('Links!', 'Der Gegnerdruck kommt von links.'),
      ar: t('على اليسار!', 'الضغط القادم من الجهة اليسرى.'),
      tr: t('Sol tarafta!', 'Dusman baskisi soldan geliyor.'),
      ru: t('Слева!', 'Давление противника идет слева.'),
      ja: t('左!', '敵の圧が左から来ている。'),
      ko: t('왼쪽!', '적 압박이 왼쪽에서 온다.'),
      zh: t('左边!', '敌人的压力来自左侧。'),
    }),
  },
  {
    id: 'callouts-sniper-top-mid',
    category: 'callouts',
    tags: ['sniper', 'mid-control', 'enemy-position'],
    translations: tx({
      en: t(
        'Sniper top mid.',
        'A sniper is watching the middle lane from high ground.',
      ),
      fr: t(
        'Sniper en haut mid.',
        'Un sniper surveille le milieu depuis la hauteur.',
      ),
      es: t(
        'Francotirador en top mid.',
        'Un francotirador vigila medio desde arriba.',
      ),
      de: t('Sniper oben Mitte.', 'Ein Sniper haelt die Mitte von oben.'),
      ar: t('قناص فوق الميد.', 'هناك قناص يراقب الميد من مكان مرتفع.'),
      tr: t(
        'Mid ustunde sniper var.',
        'Bir keskin nisanci yuksekten mide bakiyor.',
      ),
      ru: t(
        'Снайпер на миду сверху.',
        'Снайпер смотрит центр с возвышенности.',
      ),
      ja: t(
        'ミッド上にスナイパー。',
        '高所からミッドを見ているスナイパーがいる。',
      ),
      ko: t('탑 미드에 스나이퍼.', '고지대에서 미드를 보는 저격수가 있다.'),
      zh: t('中路高点有狙。', '有狙击手在高点盯着中路。'),
    }),
  },
  {
    id: 'callouts-one-hp',
    category: 'callouts',
    tags: ['damage-info', 'cleanup', 'urgency'],
    translations: tx({
      en: t(
        'One HP!',
        'The enemy is extremely weak and can be finished quickly.',
      ),
      fr: t(
        'Il est a un HP !',
        'L ennemi est tres faible et peut etre termine vite.',
      ),
      es: t('Esta a un HP!', 'El enemigo esta muy debil y cae con poco dano.'),
      de: t('Ein HP!', 'Der Gegner ist extrem schwach und schnell erledigt.'),
      ar: t('عدو دمّه واحد!', 'العدو ضعيف جدا ويمكن التخلص منه بسرعة.'),
      tr: t('Tek can!', 'Dusman cok zayif, hemen dusurulebilir.'),
      ru: t('Один хп!', 'Противник почти мертв и добивается быстро.'),
      ja: t('ワンHP!', '敵は瀕死で、すぐ倒せる。'),
      ko: t('원 HP!', '적이 거의 죽기 직전이라 바로 잡을 수 있다.'),
      zh: t('一滴血!', '敌人残血，很容易补掉。'),
    }),
  },
  {
    id: 'callouts-site-clear',
    category: 'callouts',
    tags: ['site-control', 'entry', 'objective'],
    translations: tx({
      en: t('Site clear.', 'The objective site looks safe to enter or plant.'),
      fr: t('Site clean.', 'Le site semble assez sur pour entrer ou poser.'),
      es: t(
        'Sitio limpio.',
        'La zona del objetivo parece segura para entrar o plantar.',
      ),
      de: t(
        'Site frei.',
        'Der Bereich wirkt sicher zum Betreten oder Pflanzen.',
      ),
      ar: t('السايت فاضي.', 'موقع الهدف يبدو آمنا للدخول او الزرع.'),
      tr: t('Site temiz.', 'Bolge girip kurmak icin guvenli gorunuyor.'),
      ru: t(
        'Плент чист.',
        'Площадка выглядит безопасной для входа или установки.',
      ),
      ja: t('サイトクリア。', 'サイトは入るか設置するのに安全そうだ。'),
      ko: t('사이트 클리어.', '사이트가 진입하거나 설치하기에 안전해 보인다.'),
      zh: t('点里干净。', '目标点看起来可以安全进入或下包。'),
    }),
  },
  {
    id: 'strategy-push-now',
    category: 'strategy',
    tags: ['timing', 'execute', 'tempo'],
    translations: tx({
      en: t(
        'Push now!',
        'Start the execute immediately before the enemy resets.',
      ),
      fr: t(
        'Poussez maintenant !',
        'Lancez l attaque tout de suite avant que l ennemi se replace.',
      ),
      es: t(
        'Entren ya!',
        'Inicien la entrada antes de que el rival se reorganice.',
      ),
      de: t(
        'Jetzt pushen!',
        'Startet den Execute sofort, bevor der Gegner sich neu stellt.',
      ),
      ar: t('ادفعوا الآن!', 'ابدؤوا الهجمة فورا قبل ان يعيد العدو تمركزه.'),
      tr: t('Simdi itin!', 'Rakip yeniden duzen almadan hucumu baslatin.'),
      ru: t(
        'Пушим сейчас!',
        'Начинайте врыв сразу, пока враг не перестроился.',
      ),
      ja: t('今プッシュ!', '敵が立て直す前にすぐ仕掛ける。'),
      ko: t('지금 밀어!', '상대가 다시 정비하기 전에 바로 들어가자.'),
      zh: t('现在压!', '趁敌人还没重新站好位立刻开打。'),
    }),
  },
  {
    id: 'strategy-hold-angle',
    category: 'strategy',
    tags: ['discipline', 'positioning', 'crosshair'],
    translations: tx({
      en: t(
        'Hold angle.',
        'Keep your crosshair on one line and wait for a peek.',
      ),
      fr: t(
        'Tenez l angle.',
        'Gardez le viseur sur une ligne et attendez le peek.',
      ),
      es: t('Mantengan angulo.', 'Dejen la mira fija y esperen a que asomen.'),
      de: t(
        'Winkel halten.',
        'Behalte eine Linie im Fadenkreuz und warte auf den Peek.',
      ),
      ar: t('امسك الزاوية.', 'ثبت التصويب على خط واحد وانتظر خروج الخصم.'),
      tr: t('Acini tut.', 'Nisangahi tek bir hatta tut ve cikisi bekle.'),
      ru: t('Держи угол.', 'Держи прицел на линии и жди выхода соперника.'),
      ja: t('角を保持。', '一つの射線に照準を置いてピークを待つ。'),
      ko: t('각 보고 있어.', '한 각도에 에임을 두고 피킹을 기다려라.'),
      zh: t('架住这个角。', '准星卡住这条线，等对面探头。'),
    }),
  },
  {
    id: 'strategy-rotate-b',
    category: 'strategy',
    tags: ['site-switch', 'macro', 'rotation'],
    translations: tx({
      en: t('Rotate B.', 'Shift players and utility toward the B site.'),
      fr: t(
        'Rotate B.',
        'Deplacez les joueurs et les utilitaires vers le site B.',
      ),
      es: t('Rota a B.', 'Muevan jugadores y utilidad hacia el sitio B.'),
      de: t('Rotate B.', 'Verlagert Spieler und Utility zur B Site.'),
      ar: t('لفوا على B.', 'حولوا اللاعبين والادوات نحو موقع B.'),
      tr: t("B'ye don.", 'Oyunculari ve yetenekleri B tarafina kaydirin.'),
      ru: t('Ротация на B.', 'Сместите игроков и ресурсы на точку B.'),
      ja: t('Bにローテート。', '人数とスキルをBサイトに寄せる。'),
      ko: t('B로 로테이트.', '인원과 스킬을 B 사이트 쪽으로 돌린다.'),
      zh: t('转B点。', '把人和技能往B点转过去。'),
    }),
  },
  {
    id: 'strategy-play-slow',
    category: 'strategy',
    tags: ['pacing', 'map-control', 'patience'],
    translations: tx({
      en: t(
        'Play slow.',
        'Take map control patiently and avoid forcing early fights.',
      ),
      fr: t(
        'Jouez lentement.',
        'Prenez la carte avec patience sans forcer les premiers duels.',
      ),
      es: t(
        'Jueguen lento.',
        'Tomen control del mapa con paciencia y sin forzar peleas.',
      ),
      de: t(
        'Langsam spielen.',
        'Nehmt die Map geduldig und erzwingt keine fruehen Kaempfe.',
      ),
      ar: t(
        'العبوا ببطء.',
        'خذوا السيطرة على الخريطة بهدوء ولا تفرضوا قتالا مبكرا.',
      ),
      tr: t(
        'Yavas oyna.',
        'Harita kontrolunu sabirla al ve erken savas zorlama.',
      ),
      ru: t(
        'Играем медленно.',
        'Берите контроль карты терпеливо и не форсите ранние драки.',
      ),
      ja: t('ゆっくり行こう。', '無理に早い戦闘をせず、丁寧にマップを取る。'),
      ko: t('천천히 하자.', '초반 교전을 억지로 열지 말고 차분히 맵을 먹자.'),
      zh: t('慢打。', '耐心拿地图控制，不要强行打前期架。'),
    }),
  },
  {
    id: 'strategy-trade-me',
    category: 'strategy',
    tags: ['teamplay', 'spacing', 'entry'],
    translations: tx({
      en: t('Trade me.', 'Stay close enough to punish anyone who kills me.'),
      fr: t('Trade moi.', 'Reste assez proche pour punir celui qui me tue.'),
      es: t(
        'Tradeame.',
        'Quedate lo bastante cerca para matar al que me mate.',
      ),
      de: t(
        'Trade mich.',
        'Bleib nah genug, um meinen Killer sofort zu bestrafen.',
      ),
      ar: t('بدّلني.', 'ابق قريبا بما يكفي لتقتل من يقتلني.'),
      tr: t(
        'Beni tradele.',
        'Beni oldureni hemen cezalandiracak kadar yakin kal.',
      ),
      ru: t(
        'Размени меня.',
        'Будь рядом, чтобы сразу убить того, кто убьет меня.',
      ),
      ja: t('トレードして。', '自分が倒されたらすぐ取り返せる距離にいて。'),
      ko: t('트레이드 봐줘.', '내가 죽으면 바로 받아칠 수 있게 붙어 있어.'),
      zh: t('帮我补枪。', '跟近一点，我死了就立刻补掉他。'),
    }),
  },
  {
    id: 'toxic-stop-feeding',
    category: 'toxic',
    tags: ['tilt', 'blame', 'team-morale'],
    isToxic: true,
    saferAlternative: "Let's slow down and take fights together.",
    translations: tx({
      en: t(
        'Stop feeding.',
        'The speaker is angrily telling a teammate to stop dying for free.',
      ),
      fr: t(
        'Arrete de feed.',
        'Le joueur dit agressivement a un allie d arreter de mourir gratuitement.',
      ),
      es: t(
        'Deja de fedear.',
        'El jugador le dice con enojo a un companero que deje de morir gratis.',
      ),
      de: t(
        'Hoer auf zu feeden.',
        'Der Sprecher sagt wuetend, dass ein Mitspieler nicht mehr umsonst sterben soll.',
      ),
      ar: t('وقف تفيد.', 'المتكلم يقولها بغضب لزميل حتى يتوقف عن الموت مجانا.'),
      tr: t(
        'Feedlemeyi birak.',
        'Konusan kisi ofkeyle takim arkadasina bos yere olmemesini soyluyor.',
      ),
      ru: t(
        'Хватит фидить.',
        'Игрок злится и требует перестать умирать без пользы.',
      ),
      ja: t('フィードするな。', '怒った味方が無駄死にをやめろと言っている。'),
      ko: t('피딩 좀 그만해.', '화난 팀원이 괜히 죽지 말라고 몰아붙이고 있다.'),
      zh: t('别再送了。', '说话的人正生气地让队友别再白给。'),
    }),
  },
  {
    id: 'toxic-learn-to-aim',
    category: 'toxic',
    tags: ['insult', 'mechanics', 'tilt'],
    isToxic: true,
    saferAlternative: "Let's focus on crosshair placement and spacing.",
    translations: tx({
      en: t(
        'Learn to aim.',
        'The speaker is insulting a teammate s mechanics.',
      ),
      fr: t('Apprends a viser.', 'Le joueur insulte la visee d un coequipier.'),
      es: t(
        'Aprende a apuntar.',
        'El jugador esta insultando la punteria de un companero.',
      ),
      de: t(
        'Lern zielen.',
        'Der Sprecher beleidigt die Aim-Faehigkeit eines Teamkollegen.',
      ),
      ar: t('تعلم تصويب.', 'المتكلم يهين مهارة التصويب عند زميله.'),
      tr: t(
        'Aim ogren.',
        'Konusan kisi takim arkadasinin nisanciligina hakaret ediyor.',
      ),
      ru: t('Научись стрелять.', 'Игрок оскорбляет стрельбу своего тиммейта.'),
      ja: t('エイム練習して。', '味方のエイムをばかにしている言い方だ。'),
      ko: t('에임부터 배워.', '팀원의 에임 실력을 비꼬며 모욕하는 말이다.'),
      zh: t('先学会瞄准吧。', '这是在羞辱队友的枪法。'),
    }),
  },
  {
    id: 'toxic-what-are-you-doing',
    category: 'toxic',
    tags: ['blame', 'conflict', 'decision-making'],
    isToxic: true,
    saferAlternative: 'Tell me your plan so I can play with you.',
    translations: tx({
      en: t(
        'What are you doing?',
        'The speaker is blaming a teammate for a confusing play.',
      ),
      fr: t(
        'Tu fais quoi ?',
        'Le joueur blame un coequipier pour une action jugee incomprehensible.',
      ),
      es: t(
        'Que estas haciendo?',
        'El jugador esta culpando a un companero por una jugada confusa.',
      ),
      de: t(
        'Was machst du da?',
        'Der Sprecher gibt einem Mitspieler die Schuld fuer einen fragwuerdigen Spielzug.',
      ),
      ar: t('شو عم تعمل؟', 'المتكلم يلوم زميلا على لقطة يراها غير مفهومة.'),
      tr: t(
        'Ne yapiyorsun?',
        'Konusan kisi karisik bir oyun yuzunden takim arkadasini sucluyor.',
      ),
      ru: t('Что ты делаешь?', 'Игрок обвиняет тиммейта за непонятный мув.'),
      ja: t('何してるの?', '味方の判断を責める言い方になっている。'),
      ko: t(
        '뭐 하는 거야?',
        '이해하기 어려운 플레이를 했다고 팀원을 탓하는 말이다.',
      ),
      zh: t('你在干嘛?', '说话的人在指责队友做了莫名其妙的操作。'),
    }),
  },
  {
    id: 'toxic-you-are-trolling',
    category: 'toxic',
    tags: ['accusation', 'tilt', 'griefing'],
    isToxic: true,
    saferAlternative: "Let's reset and keep the next round simple.",
    translations: tx({
      en: t(
        "You're trolling.",
        'The speaker is accusing a teammate of throwing on purpose.',
      ),
      fr: t(
        'Tu trolles.',
        'Le joueur accuse un coequipier de saboter volontairement la manche.',
      ),
      es: t(
        'Estas trolleando.',
        'El jugador acusa a un companero de arruinar la ronda a proposito.',
      ),
      de: t(
        'Du trollst.',
        'Der Sprecher wirft einem Mitspieler vor, absichtlich zu griefen.',
      ),
      ar: t('أنت بتترول.', 'المتكلم يتهم زميلا بانه يخرب الجولة عمدا.'),
      tr: t(
        'Trolluyorsun.',
        'Konusan kisi takim arkadasini kasti olarak roundu satmakla sucluyor.',
      ),
      ru: t(
        'Ты троллишь.',
        'Игрок обвиняет тиммейта в намеренном сливе раунда.',
      ),
      ja: t('トロールしてるだろ。', 'わざとラウンドを壊していると責めている。'),
      ko: t('트롤하냐?', '일부러 판을 던진다고 몰아가는 표현이다.'),
      zh: t('你在演吧。', '这是在指责队友故意送掉这一回合。'),
    }),
  },
  {
    id: 'toxic-shut-up',
    category: 'toxic',
    tags: ['hostile', 'comms', 'tilt'],
    isToxic: true,
    saferAlternative: 'Clear comms, only key info.',
    translations: tx({
      en: t(
        'Shut up.',
        'The speaker wants silence but says it in a hostile way.',
      ),
      fr: t(
        'Tais-toi.',
        'Le joueur veut du silence mais le dit de facon agressive.',
      ),
      es: t(
        'Callate.',
        'El jugador quiere silencio pero lo dice de manera hostil.',
      ),
      de: t(
        'Halt die Klappe.',
        'Der Sprecher will Ruhe, sagt es aber feindselig.',
      ),
      ar: t('اسكت.', 'المتكلم يريد هدوءا لكنه يقولها بطريقة عدائية.'),
      tr: t(
        'Sus.',
        'Konusan kisi sessizlik istiyor ama bunu sert sekilde soyluyor.',
      ),
      ru: t('Заткнись.', 'Игрок хочет тишины, но говорит это грубо.'),
      ja: t('黙って。', '静かにしてほしいが、言い方がきつい。'),
      ko: t('닥쳐.', '조용하길 원하지만 매우 공격적으로 말하고 있다.'),
      zh: t('闭嘴。', '说话的人想要安静，但表达方式很有攻击性。'),
    }),
  },
];

export const phraseMatchesQuery = (phrase: Phrase, query: string) => {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  const translationMatch = Object.values(phrase.translations).some(
    ({ text, meaning, pronunciation }) => {
      return [text, meaning, pronunciation]
        .filter((value): value is string => Boolean(value))
        .some(value => value.toLowerCase().includes(normalizedQuery));
    },
  );

  const tagMatch =
    phrase.tags?.some(tag => tag.toLowerCase().includes(normalizedQuery)) ??
    false;

  const saferAlternativeMatch =
    phrase.saferAlternative?.toLowerCase().includes(normalizedQuery) ?? false;

  return translationMatch || tagMatch || saferAlternativeMatch;
};
