/**
 * Generates content/questions/2026.09.json — Unsaid question set.
 * Run: node scripts/generate-question-bank.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const ag5 = [
  { value: 1, label: "Strongly disagree" },
  { value: 2, label: "Disagree" },
  { value: 3, label: "Unsure / neutral" },
  { value: 4, label: "Agree" },
  { value: 5, label: "Strongly agree" },
];

function prompts(topic, extras = []) {
  const base = [
    `What does your ideal picture of ${topic} actually look like?`,
    `Is this a preference or a requirement for you?`,
    `Has either person's position changed before—and what caused that?`,
    `What would happen if neither person changed their mind?`,
  ];
  return extras.length ? [...extras.slice(0, 2), ...base.slice(0, 2)] : base;
}

function ag(code, section, order, text, topic, extras = {}, morePrompts = []) {
  return {
    code,
    section,
    displayOrder: order,
    text,
    responseType: "AG5",
    responseOptions: ag5,
    neutralDescription: `Expectations differ around ${topic}.`,
    prompts: prompts(topic, morePrompts),
    parentCode: null,
    followUpWhen: null,
    compatibilityMatrix: null,
    distanceMode: "ag5",
    ...extras,
  };
}

const sections = [
  {
    id: "marriage_commitment",
    title: "Marriage & commitment",
    intro:
      "What marriage means to you—commitment, decisions, openness, and priority.",
    durationHint: "8 questions · about 90 seconds",
  },
  {
    id: "children_parenting",
    title: "Children & parenting",
    intro:
      "Whether you want children, when, how many, and how you'd raise them.",
    durationHint: "8 questions · about 90 seconds",
  },
  {
    id: "money",
    title: "Money",
    intro:
      "Money disagreements are rarely just about dollars. These questions compare how you expect earning, spending, saving, debt, and generosity to work.",
    durationHint: "8 questions · about 90 seconds",
  },
  {
    id: "faith_values",
    title: "Faith & values",
    intro:
      "Faith, spiritual practice, moral frameworks, and how much shared belief matters.",
    durationHint: "8 questions · about 90 seconds",
  },
  {
    id: "sex_affection",
    title: "Sex & affection",
    intro:
      "These questions are private. Their purpose is not to define a “normal” relationship. They identify whether your expectations differ.",
    durationHint: "8 questions · about 90 seconds",
  },
  {
    id: "communication_conflict",
    title: "Communication & conflict",
    intro:
      "How you want to fight, apologize, cool down, and ask for help.",
    durationHint: "8 questions · about 90 seconds",
  },
  {
    id: "family_boundaries",
    title: "Family & boundaries",
    intro:
      "In-laws, holidays, caregiving, friendships, and where the marriage sits relative to family.",
    durationHint: "8 questions · about 90 seconds",
  },
  {
    id: "career_ambition",
    title: "Career & ambition",
    intro: "Work identity, relocation, hours, risk, and income versus time.",
    durationHint: "8 questions · about 90 seconds",
  },
  {
    id: "home_lifestyle",
    title: "Home & lifestyle",
    intro: "Where you live, how you live, pets, travel, and the feel of home.",
    durationHint: "8 questions · about 90 seconds",
  },
  {
    id: "roles_responsibilities",
    title: "Roles & responsibilities",
    intro:
      "Who does what—chores, childcare, money admin, and mental load.",
    durationHint: "8 questions · about 90 seconds",
  },
  {
    id: "health_habits",
    title: "Health & habits",
    intro:
      "Substances, health, sleep, and habits that affect a shared life.",
    durationHint: "8 questions · about 90 seconds",
  },
  {
    id: "future_adversity",
    title: "Future & adversity",
    intro:
      "Marriage includes situations neither person can predict. These questions explore expectations about how you would face them.",
    durationHint: "8 questions · about 90 seconds",
  },
];

const live = ["major_city", "suburb", "small_town", "rural", "no_preference"];
function liveDist(a, b) {
  if (a === b) return 0;
  if (a === "no_preference" || b === "no_preference") return 0.25;
  const order = ["major_city", "suburb", "small_town", "rural"];
  const ia = order.indexOf(a);
  const ib = order.indexOf(b);
  if (ia < 0 || ib < 0) return 0.5;
  const d = Math.abs(ia - ib);
  return [0, 0.25, 0.5, 0.75][d];
}
const hl02Matrix = {};
for (const a of live) {
  hl02Matrix[a] = {};
  for (const b of live) hl02Matrix[a][b] = liveDist(a, b);
}

const questions = [];

// ——— Section 1
const s1 = "marriage_commitment";
questions.push(
  ag("MC01", s1, 1, "I intend marriage to be a lifelong commitment except in extraordinary circumstances.", "lifelong commitment"),
  ag("MC02", s1, 2, "Being legally married matters to me.", "legal marriage"),
  {
    code: "MC03",
    section: s1,
    displayOrder: 3,
    text: "When would you ideally want to be married?",
    responseType: "ORD",
    responseOptions: [
      { value: "within_1_year", label: "Within 1 year" },
      { value: "1_2_years", label: "1–2 years" },
      { value: "3_5_years", label: "3–5 years" },
      { value: "more_than_5_years", label: "More than 5 years" },
      { value: "unsure", label: "I'm not sure" },
    ],
    neutralDescription: "Preferred marriage timing differs.",
    prompts: prompts("when you marry"),
    parentCode: null,
    followUpWhen: null,
    compatibilityMatrix: null,
    distanceMode: "ord",
  },
  ag("MC04", s1, 4, "I expect major life decisions to be made jointly after marriage.", "joint decision-making"),
  ag("MC05", s1, 5, "My spouse should become my primary adult relationship, ahead of parents and friends.", "relationship priority"),
  ag("MC06", s1, 6, "I want a prenuptial agreement before marriage.", "prenuptial agreements"),
  ag("MC07", s1, 7, "I consider emotional infidelity a serious violation of marriage even if nothing physical happens.", "emotional exclusivity"),
  ag("MC08", s1, 8, "I expect a high level of openness about phones, messages, online accounts, and digital life.", "digital openness"),
);

// ——— Section 2
const s2 = "children_parenting";
questions.push(
  ag("CP01", s2, 1, "I want to have children.", "having children"),
  {
    code: "CP02",
    section: s2,
    displayOrder: 2,
    text: "Ideally, how many children would you want?",
    responseType: "ORD",
    responseOptions: [
      { value: "none", label: "None" },
      { value: "one", label: "One" },
      { value: "two", label: "Two" },
      { value: "three", label: "Three" },
      { value: "four_or_more", label: "Four or more" },
      { value: "dont_care", label: "I genuinely don't care" },
      { value: "unsure", label: "Unsure" },
    ],
    neutralDescription: "Preferred number of children differs.",
    prompts: prompts("how many children you want"),
    parentCode: null,
    followUpWhen: null,
    compatibilityMatrix: null,
    distanceMode: "ord_cp02_dont_care",
    specialScoring: "cp02_dont_care",
  },
  {
    code: "CP03",
    section: s2,
    displayOrder: 3,
    text: "If we want children, when would you ideally begin trying?",
    responseType: "ORD",
    responseOptions: [
      { value: "immediately", label: "Immediately after marriage" },
      { value: "1_2_years", label: "Within 1–2 years" },
      { value: "3_5_years", label: "Within 3–5 years" },
      { value: "more_than_5", label: "More than 5 years" },
      { value: "unsure", label: "Unsure" },
      { value: "dont_want", label: "I don't want children" },
    ],
    neutralDescription: "Preferred timing for children differs.",
    prompts: prompts("when to begin trying for children"),
    parentCode: null,
    followUpWhen: null,
    compatibilityMatrix: null,
    distanceMode: "ord",
  },
  ag("CP04", s2, 4, "If having biological children were difficult, I would want to pursue fertility treatment.", "fertility treatment"),
  ag("CP05", s2, 5, "I would seriously consider adoption or fostering if biological children were not possible.", "adoption or fostering"),
  {
    code: "CP06",
    section: s2,
    displayOrder: 6,
    text: "What parenting style feels closest to you?",
    responseType: "ORD",
    responseOptions: [
      { value: "very_flexible", label: "Very flexible" },
      { value: "somewhat_flexible", label: "Somewhat flexible" },
      { value: "balanced", label: "Balanced" },
      { value: "somewhat_structured", label: "Somewhat structured" },
      { value: "very_structured", label: "Very structured" },
    ],
    neutralDescription: "Preferred parenting structure differs.",
    prompts: prompts("parenting style"),
    parentCode: null,
    followUpWhen: null,
    compatibilityMatrix: null,
    distanceMode: "ord",
  },
  ag("CP07", s2, 7, "I have strong preferences about how our children should be educated.", "children's education", {
    followUpWhen: { importanceMin: null, answerMin: 4, followUpCode: "CP07F" },
  }),
  {
    code: "CP07F",
    section: s2,
    displayOrder: 7.1,
    text: "Which education approaches would you want for your children?",
    responseType: "MULTI",
    responseOptions: [
      { value: "public", label: "Public school" },
      { value: "private", label: "Private school" },
      { value: "religious", label: "Religious school" },
      { value: "homeschool", label: "Homeschool" },
      { value: "other", label: "Other" },
      { value: "open", label: "Open to several" },
    ],
    neutralDescription: "Preferred education approaches differ.",
    prompts: prompts("how children are educated"),
    parentCode: "CP07",
    followUpWhen: null,
    compatibilityMatrix: null,
    distanceMode: "multi",
    hiddenUnlessParent: { code: "CP07", answerMin: 4 },
  },
  ag("CP08", s2, 8, "I want one parent to stay home full-time or substantially reduce work while our children are young.", "a parent staying home"),
);

// ——— Section 3
const s3 = "money";
questions.push(
  ag("MO01", s3, 1, "All significant debt should be fully disclosed before marriage.", "debt disclosure"),
  {
    code: "MO02",
    section: s3,
    displayOrder: 2,
    text: "How should married finances primarily work?",
    responseType: "CAT",
    responseOptions: [
      { value: "fully_combined", label: "Fully combined" },
      { value: "mostly_combined", label: "Mostly combined with individual spending accounts" },
      { value: "half", label: "Roughly half combined / half separate" },
      { value: "mostly_separate", label: "Mostly separate" },
      { value: "fully_separate", label: "Fully separate" },
    ],
    neutralDescription: "Preferred household finance structure differs.",
    prompts: prompts("how money is shared"),
    parentCode: null,
    followUpWhen: null,
    compatibilityMatrix: null,
    distanceMode: "ord_as_cat",
    specialScoring: "mo02_ordered",
  },
  ag("MO03", s3, 3, "I want us to maintain a household budget.", "household budgeting"),
  ag("MO04", s3, 4, "I want us to agree before either person makes a large purchase.", "agreeing on large purchases", {
    followUpWhen: { answerMin: 3, followUpCode: "MO04F" },
  }),
  {
    code: "MO04F",
    section: s3,
    displayOrder: 4.1,
    text: "What counts as a large purchase?",
    responseType: "ORD",
    responseOptions: [
      { value: "100", label: "$100" },
      { value: "250", label: "$250" },
      { value: "500", label: "$500" },
      { value: "1000", label: "$1,000" },
      { value: "2500", label: "$2,500" },
      { value: "5000_plus", label: "$5,000+" },
      { value: "depends", label: "Depends on our income" },
    ],
    neutralDescription: "Threshold for a “large purchase” differs.",
    prompts: prompts("what counts as a large purchase"),
    parentCode: "MO04",
    followUpWhen: null,
    compatibilityMatrix: null,
    distanceMode: "ord",
    hiddenUnlessParent: { code: "MO04", answerMin: 3 },
  },
  ag("MO05", s3, 5, "Building savings and investments should take priority over increasing our lifestyle.", "saving versus lifestyle"),
  ag("MO06", s3, 6, "I am comfortable carrying debt for things other than a home.", "non-mortgage debt"),
  ag("MO07", s3, 7, "I expect us to financially support parents or extended family if they need help.", "supporting extended family financially"),
  ag("MO08", s3, 8, "Charitable or religious giving should be a regular part of our household finances.", "regular giving"),
);

// ——— Section 4
const s4 = "faith_values";
questions.push(
  ag("FV01", s4, 1, "Sharing the same faith or spiritual worldview is important to me.", "shared faith or worldview"),
  ag("FV02", s4, 2, "Faith or spirituality should play an active role in our marriage.", "faith in the marriage"),
  ag("FV03", s4, 3, "I expect regular participation in a church, religious community, or spiritual community.", "religious or spiritual community"),
  ag("FV04", s4, 4, "I want our children raised within a specific faith or spiritual tradition.", "raising children in a faith tradition"),
  ag("FV05", s4, 5, "I expect my spouse and me to make major moral decisions from a shared set of beliefs.", "shared moral frameworks"),
  ag("FV06", s4, 6, "Political differences between spouses would be difficult for me.", "political differences"),
  ag("FV07", s4, 7, "My spouse's personal beliefs matter to me even if their behavior toward me does not change.", "a spouse's personal beliefs"),
  ag("FV08", s4, 8, "If one of us changed our religious or spiritual beliefs significantly, it would seriously affect the marriage.", "major belief changes"),
);

// ——— Section 5
const s5 = "sex_affection";
questions.push(
  {
    code: "SA01",
    section: s5,
    displayOrder: 1,
    text: "In a healthy marriage, how often would you ideally expect sexual intimacy?",
    responseType: "ORD",
    responseOptions: [
      { value: "less_than_monthly", label: "Less than monthly" },
      { value: "few_per_month", label: "A few times per month" },
      { value: "weekly", label: "About weekly" },
      { value: "2_3_weekly", label: "2–3 times per week" },
      { value: "4_plus_weekly", label: "4+ times per week" },
      { value: "no_expectation", label: "I don't have a frequency expectation" },
    ],
    neutralDescription: "Expectations about sexual frequency differ.",
    prompts: prompts("sexual intimacy frequency", [
      "What does “enough” intimacy mean to each of you?",
      "How would you want to talk about mismatch if it appeared?",
    ]),
    parentCode: null,
    followUpWhen: null,
    compatibilityMatrix: null,
    distanceMode: "ord",
  },
  ag("SA02", s5, 2, "Regular physical affection outside of sex is very important to me.", "non-sexual physical affection"),
  ag("SA03", s5, 3, "I expect sexual exclusivity throughout marriage.", "sexual exclusivity"),
  ag("SA04", s5, 4, "Pornography use by my spouse would seriously bother me.", "pornography"),
  ag("SA05", s5, 5, "I want both spouses to feel comfortable initiating sex.", "initiating sex"),
  ag("SA06", s5, 6, "A prolonged mismatch in sexual desire would be a serious marriage issue for me.", "desire mismatch"),
  ag("SA07", s5, 7, "I would be willing to seek professional help together if sexual intimacy became a persistent problem.", "seeking help for sexual intimacy"),
  ag("SA08", s5, 8, "Sexual boundaries and expectations should be explicitly discussed rather than assumed.", "discussing sexual boundaries"),
);

// ——— Section 6
const s6 = "communication_conflict";
questions.push(
  ag("CC01", s6, 1, "When conflict becomes intense, I prefer to take time apart before continuing the conversation.", "cooling off during conflict"),
  ag("CC02", s6, 2, "I want disagreements resolved before going to sleep whenever reasonably possible.", "resolving conflict before sleep"),
  ag("CC03", s6, 3, "Raised voices during arguments are unacceptable to me.", "raised voices"),
  ag("CC04", s6, 4, "Sarcasm or joking during conflict bothers me.", "sarcasm during conflict"),
  ag("CC05", s6, 5, "I need verbal apologies when someone has clearly done something wrong.", "verbal apologies"),
  ag("CC06", s6, 6, "I am comfortable discussing difficult relationship issues directly rather than waiting for them to pass.", "direct difficult conversations"),
  ag("CC07", s6, 7, "I would be willing to attend couples counseling before our marriage reached a crisis.", "couples counseling"),
  ag("CC08", s6, 8, "Relationship conflicts should generally stay private rather than being discussed with friends or family.", "keeping conflict private"),
);

// ——— Section 7
const s7 = "family_boundaries";
questions.push(
  ag("FB01", s7, 1, "Our marriage should generally take priority when our spouse and extended family disagree.", "marriage versus extended family"),
  ag("FB02", s7, 2, "I expect to spend major holidays regularly with my family of origin.", "holidays with family of origin"),
  ag("FB03", s7, 3, "I would be willing for one of our parents to live with us if they could no longer live independently.", "a parent living with you"),
  ag("FB04", s7, 4, "I am comfortable financially supporting members of our extended family.", "financial support for extended family"),
  ag("FB05", s7, 5, "Parents and in-laws should have significant involvement in major family decisions.", "in-law involvement in decisions"),
  ag("FB06", s7, 6, "I need strong boundaries between our private relationship and our families.", "boundaries with family"),
  ag("FB07", s7, 7, "I am comfortable maintaining close friendships with people my spouse could potentially view as romantic alternatives.", "close opposite-attraction friendships"),
  ag("FB08", s7, 8, "Remaining close friends with former romantic partners is acceptable to me.", "friendship with ex-partners"),
);

// ——— Section 8
const s8 = "career_ambition";
questions.push(
  ag("CA01", s8, 1, "My career is a major part of my identity.", "career and identity"),
  ag("CA02", s8, 2, "I would relocate for my spouse's career if the opportunity were significant enough.", "relocating for a spouse's career"),
  ag("CA03", s8, 3, "I expect my spouse to relocate for my career if the opportunity were significant enough.", "expecting a spouse to relocate"),
  ag("CA04", s8, 4, "I am comfortable with periods when one spouse works substantially more hours than the other.", "uneven work hours"),
  ag("CA05", s8, 5, "I would be comfortable taking substantial financial risk to start a business.", "business risk"),
  ag("CA06", s8, 6, "I want both spouses to continue pursuing careers after having children.", "careers after children"),
  ag("CA07", s8, 7, "Achieving a high household income is important to me.", "household income goals"),
  ag("CA08", s8, 8, "I would willingly choose more family time even if it meant earning substantially less money.", "family time versus income"),
);

// ——— Section 9
const s9 = "home_lifestyle";
questions.push(
  ag("HL01", s9, 1, "Owning a home is an important life goal for me.", "homeownership"),
  {
    code: "HL02",
    section: s9,
    displayOrder: 2,
    text: "Where would you most like to live long term?",
    responseType: "CAT",
    responseOptions: [
      { value: "major_city", label: "Major city" },
      { value: "suburb", label: "Suburb" },
      { value: "small_town", label: "Small town" },
      { value: "rural", label: "Rural area" },
      { value: "no_preference", label: "No strong preference" },
    ],
    neutralDescription: "Long-term living preferences differ.",
    prompts: prompts("where you live long term"),
    parentCode: null,
    followUpWhen: null,
    compatibilityMatrix: hl02Matrix,
    distanceMode: "cat_matrix",
    specialScoring: "hl02_matrix",
  },
  {
    code: "HL03",
    section: s9,
    displayOrder: 3,
    text: "How geographically flexible are you?",
    responseType: "ORD",
    responseOptions: [
      { value: "stay", label: "I strongly want to remain where I currently live" },
      { value: "region", label: "I would move within my region" },
      { value: "country", label: "I would move anywhere in my country" },
      { value: "international", label: "I would move internationally" },
      { value: "no_preference", label: "I have no strong preference" },
    ],
    neutralDescription: "Geographic flexibility differs.",
    prompts: prompts("geographic flexibility"),
    parentCode: null,
    followUpWhen: null,
    compatibilityMatrix: null,
    distanceMode: "ord",
  },
  ag("HL04", s9, 4, "Keeping our home very clean and organized is important to me.", "home cleanliness"),
  ag("HL05", s9, 5, "I want pets to be part of our household.", "pets"),
  ag("HL06", s9, 6, "I want our home to be a place where friends and family visit frequently.", "a social home"),
  ag("HL07", s9, 7, "Travel should be a significant part of our lifestyle.", "travel"),
  ag("HL08", s9, 8, "I prefer spending money on experiences rather than possessions.", "experiences versus possessions"),
);

// ——— Section 10
const s10 = "roles_responsibilities";
questions.push(
  ag("RR01", s10, 1, "Household work should generally be divided as evenly as possible.", "dividing household work"),
  ag("RR02", s10, 2, "Traditional gender roles should influence how responsibilities are divided in marriage.", "gender roles in responsibilities"),
  ag("RR03", s10, 3, "The spouse working fewer paid hours should generally perform more household work.", "unpaid work and paid hours"),
  ag("RR04", s10, 4, "Both spouses should know the household's financial situation in detail.", "shared financial visibility"),
  ag("RR05", s10, 5, "Both parents should participate substantially in daily childcare.", "daily childcare participation"),
  ag("RR06", s10, 6, "I am comfortable paying for cleaning, childcare, lawn care, or other household help when we can afford it.", "paid household help"),
  ag("RR07", s10, 7, "Meal planning, appointments, birthdays, school obligations, and similar “mental load” tasks should be deliberately shared.", "sharing mental load"),
  ag("RR08", s10, 8, "If one spouse became overwhelmed, I would expect responsibilities to change temporarily even if the division became unequal.", "flexing responsibilities under stress"),
);

// ——— Section 11
const s11 = "health_habits";
questions.push(
  ag("HH01", s11, 1, "Regular alcohol use by my spouse is acceptable to me.", "alcohol use"),
  ag("HH02", s11, 2, "Recreational drug use by my spouse is acceptable to me where legal.", "recreational drug use"),
  ag("HH03", s11, 3, "Nicotine or tobacco use by my spouse is acceptable to me.", "nicotine or tobacco"),
  ag("HH04", s11, 4, "Maintaining physical health and fitness should be an active household priority.", "health and fitness"),
  ag("HH05", s11, 5, "I expect my spouse to seek medical or mental-health care when a persistent problem is affecting our relationship or family.", "seeking medical or mental-health care"),
  ag("HH06", s11, 6, "Gambling for money is acceptable entertainment in moderation.", "gambling"),
  ag("HH07", s11, 7, "Having similar sleep schedules is important to me.", "sleep schedules"),
  ag("HH08", s11, 8, "Significant changes in a spouse's appearance or weight would affect my attraction.", "attraction and appearance change", {
    toneNote: "Do not flag with judgmental language.",
  }),
);

// ——— Section 12
const s12 = "future_adversity";
questions.push(
  ag("FA01", s12, 1, "If my spouse became seriously ill or disabled, I would expect us to substantially reorganize our lives around their care.", "care during serious illness"),
  ag("FA02", s12, 2, "If one of us lost our job, I would be comfortable significantly reducing our lifestyle for an extended period.", "job loss and lifestyle"),
  ag("FA03", s12, 3, "If we discovered we could not have biological children, I believe we could build a fulfilling marriage without them.", "marriage without biological children"),
  ag("FA04", s12, 4, "If one spouse wanted to return to school or completely change careers, I would be open to temporary financial sacrifice.", "career change sacrifice"),
  ag("FA05", s12, 5, "I would be willing to care for an aging parent even if it substantially changed our lifestyle.", "caring for an aging parent"),
  ag("FA06", s12, 6, "If our marriage became deeply unhappy, I would want to pursue counseling or other help before considering separation.", "help before separation"),
  ag("FA07", s12, 7, "I believe spouses should remain committed through major financial setbacks such as bankruptcy or business failure.", "commitment through financial setbacks"),
  ag("FA08", s12, 8, "If we discovered a serious incompatibility after marriage, I would rather confront it directly than avoid the issue to preserve peace.", "confronting incompatibility"),
);

const primary = questions.filter((q) => !q.parentCode);
if (primary.length !== 96) {
  throw new Error(`Expected 96 primary questions, got ${primary.length}`);
}

const bank = {
  questionSetVersion: "2026.09",
  algorithmVersionCompatible: ["1.0.0"],
  currencyNote: "Importance 1–5 and optional hard line on every answered item.",
  sections,
  questions,
  scoringNotes: {
    cp02_dont_care:
      "If either answer is dont_care AND that participant's importance <= 3, distance = min(ordDistance, 0.25). If importance >= 4, use normal ORD including dont_care index.",
    mo02_ordered: "Treat CAT options as ordered continuum; use ORD distance.",
    hl02_matrix: "Use compatibilityMatrix; no_preference is 0.25 from all others unless identical.",
    hardLineUi:
      "Show hard-line toggle only when importance >= 4. Never disclose who set hard line in results.",
  },
};

const out = join(__dirname, "../content/questions/2026.09.json");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(bank, null, 2) + "\n");
console.log(`Wrote ${questions.length} questions (${primary.length} primary) to ${out}`);
