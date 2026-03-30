/**
 * Emoji shortcode support — dictionary, replacement, and renderable.
 */

import { Segment } from "./segment.js";
import type { Style } from "./style.js";
import type { Renderable, RenderOptions } from "./protocol.js";

// [LAW:one-source-of-truth] Single emoji dictionary for all shortcode lookups
export const EMOJI: Record<string, string> = {
  // Faces
  smile: "😄",
  laugh: "😂",
  grinning: "😀",
  wink: "😉",
  blush: "😊",
  innocent: "😇",
  heart_eyes: "😍",
  kissing: "😘",
  thinking: "🤔",
  shushing: "🤫",
  zipper_mouth: "🤐",
  raised_eyebrow: "🤨",
  neutral: "😐",
  expressionless: "😑",
  unamused: "😒",
  rolling_eyes: "🙄",
  grimacing: "😬",
  lying: "🤥",
  relieved: "😌",
  pensive: "😔",
  sleepy: "😪",
  sleeping: "😴",
  mask: "😷",
  thermometer_face: "🤒",
  bandage_face: "🤕",
  nauseated: "🤢",
  sneezing: "🤧",
  cold_face: "🥶",
  hot_face: "🥵",
  dizzy_face: "😵",
  exploding_head: "🤯",
  cowboy: "🤠",
  party_face: "🥳",
  sunglasses: "😎",
  nerd: "🤓",
  monocle: "🧐",
  confused: "😕",
  worried: "😟",
  frowning: "☹",
  open_mouth: "😮",
  hushed: "😯",
  astonished: "😲",
  flushed: "😳",
  pleading: "🥺",
  cry: "😢",
  sob: "😭",
  scream: "😱",
  sweat: "😰",
  angry: "😡",
  rage: "🤬",
  devil: "😈",
  skull: "💀",
  poop: "💩",
  clown: "🤡",
  ghost: "👻",
  alien: "👽",
  robot: "🤖",

  // Hands
  wave: "👋",
  raised_hand: "✋",
  ok_hand: "👌",
  pinching: "🤏",
  victory: "✌",
  crossed_fingers: "🤞",
  love_you: "🤟",
  rock_on: "🤘",
  thumbs_up: "👍",
  thumbs_down: "👎",
  fist: "✊",
  punch: "👊",
  left_fist: "🤛",
  right_fist: "🤜",
  clap: "👏",
  raised_hands: "🙌",
  open_hands: "👐",
  palms_up: "🤲",
  handshake: "🤝",
  pray: "🙏",
  writing_hand: "✍",
  nail_polish: "💅",
  muscle: "💪",
  point_up: "☝",
  point_up_2: "👆",
  point_down: "👇",
  point_left: "👈",
  point_right: "👉",
  middle_finger: "🖕",

  // Hearts
  heart: "❤",
  orange_heart: "🧡",
  yellow_heart: "💛",
  green_heart: "💚",
  blue_heart: "💙",
  purple_heart: "💜",
  black_heart: "🖤",
  white_heart: "🤍",
  brown_heart: "🤎",
  broken_heart: "💔",
  heart_exclamation: "❣",
  two_hearts: "💕",
  revolving_hearts: "💞",
  heartbeat: "💓",
  heartpulse: "💗",
  sparkling_heart: "💖",
  growing_heart: "💗",
  cupid: "💘",
  gift_heart: "💝",

  // Objects & Symbols
  fire: "🔥",
  star: "⭐",
  star2: "🌟",
  sparkles: "✨",
  zap: "⚡",
  boom: "💥",
  droplet: "💧",
  rainbow: "🌈",
  sun: "☀",
  moon: "🌙",
  cloud: "☁",
  snowflake: "❄",
  umbrella: "☂",

  // Status
  check: "✅",
  check_mark: "✔",
  cross_mark: "❌",
  warning: "⚠",
  info: "ℹ",
  question: "❓",
  exclamation: "❗",
  no_entry: "⛔",
  prohibited: "🚫",
  stop_sign: "🛑",

  // Arrows
  arrow_up: "⬆",
  arrow_down: "⬇",
  arrow_left: "⬅",
  arrow_right: "➡",
  arrow_upper_left: "↖",
  arrow_upper_right: "↗",
  arrow_lower_left: "↙",
  arrow_lower_right: "↘",
  left_right_arrow: "↔",
  up_down_arrow: "↕",
  arrows_clockwise: "🔃",
  arrows_counterclockwise: "🔄",

  // Tech
  computer: "💻",
  keyboard: "⌨",
  desktop: "🖥",
  printer: "🖨",
  mouse: "🖱",
  cd: "💿",
  dvd: "📀",
  floppy: "💾",
  battery: "🔋",
  plug: "🔌",
  bulb: "💡",
  flashlight: "🔦",
  gear: "⚙",
  wrench: "🔧",
  hammer: "🔨",
  nut_and_bolt: "🔩",
  link: "🔗",
  chains: "⛓",
  lock: "🔒",
  unlock: "🔓",
  key: "🔑",
  shield: "🛡",
  bug: "🐛",
  magnifying_glass: "🔍",

  // Communication
  speech_balloon: "💬",
  thought_balloon: "💭",
  megaphone: "📣",
  loudspeaker: "📢",
  bell: "🔔",
  no_bell: "🔕",
  envelope: "✉",
  email: "📧",
  inbox: "📥",
  outbox: "📤",
  package: "📦",
  clipboard: "📋",
  memo: "📝",
  page: "📄",
  bookmark: "🔖",
  label: "🏷",

  // Time
  hourglass: "⌛",
  hourglass_flowing: "⏳",
  watch: "⌚",
  alarm_clock: "⏰",
  stopwatch: "⏱",
  timer: "⏲",
  clock: "🕐",

  // Numbers
  zero: "0️⃣",
  one: "1️⃣",
  two: "2️⃣",
  three: "3️⃣",
  four: "4️⃣",
  five: "5️⃣",
  six: "6️⃣",
  seven: "7️⃣",
  eight: "8️⃣",
  nine: "9️⃣",
  ten: "🔟",
  hash: "#️⃣",

  // Food & Drink
  coffee: "☕",
  tea: "🍵",
  beer: "🍺",
  wine: "🍷",
  cocktail: "🍸",
  pizza: "🍕",
  hamburger: "🍔",
  fries: "🍟",
  hotdog: "🌭",
  taco: "🌮",
  cake: "🎂",
  cookie: "🍪",
  chocolate: "🍫",
  candy: "🍬",
  apple: "🍎",
  banana: "🍌",

  // Nature & Animals
  dog: "🐕",
  cat: "🐈",
  snake: "🐍",
  turtle: "🐢",
  whale: "🐳",
  dolphin: "🐬",
  fish: "🐟",
  butterfly: "🦋",
  bee: "🐝",
  ladybug: "🐞",
  spider: "🕷",
  tree: "🌲",
  flower: "🌸",
  rose: "🌹",
  sunflower: "🌻",
  cactus: "🌵",

  // Activities
  trophy: "🏆",
  medal: "🏅",
  crown: "👑",
  gem: "💎",
  money_bag: "💰",
  dollar: "💵",
  rocket: "🚀",
  airplane: "✈",
  car: "🚗",
  bicycle: "🚲",
  house: "🏠",
  building: "🏢",
  globe: "🌍",
  world_map: "🗺",
  flag: "🏁",
  party: "🎉",
  confetti: "🎊",
  balloon: "🎈",
  gift: "🎁",
  art: "🎨",
  music: "🎵",
  notes: "🎶",
  microphone: "🎤",
  headphones: "🎧",
  movie: "🎬",
  camera: "📷",
  book: "📖",
  books: "📚",
  scroll: "📜",
  newspaper: "📰",

  // People
  person: "🧑",
  man: "👨",
  woman: "👩",
  child: "🧒",
  baby: "👶",
  eyes: "👀",
  eye: "👁",
  brain: "🧠",
  tongue: "👅",
  ear: "👂",
  nose: "👃",
  foot: "🦶",
  hand: "🤚",

  // Misc
  red_circle: "🔴",
  orange_circle: "🟠",
  yellow_circle: "🟡",
  green_circle: "🟢",
  blue_circle: "🔵",
  purple_circle: "🟣",
  black_circle: "⚫",
  white_circle: "⚪",
  red_square: "🟥",
  orange_square: "🟧",
  yellow_square: "🟨",
  green_square: "🟩",
  blue_square: "🟦",
  purple_square: "🟪",
  black_square: "⬛",
  white_square: "⬜",
  checkered_flag: "🏁",
  triangular_flag: "🚩",
  crossed_flags: "🎌",
  pirate_flag: "🏴‍☠️",
  white_flag: "🏳",
  100: "💯",
  infinity: "♾",
  recycle: "♻",
  peace: "☮",
  yin_yang: "☯",
  cross: "✝",
  atom: "⚛",
  radioactive: "☢",
  biohazard: "☣",
};

const EMOJI_PATTERN = /:([a-z0-9_]+(?:-(?:emoji|text))?):/g;

/**
 * Replaces :shortcode: patterns in text with emoji characters.
 */
export function emojiReplace(
  text: string,
  defaultVariant?: "emoji" | "text",
): string {
  return text.replace(EMOJI_PATTERN, (_match, code: string) => {
    let variant = defaultVariant;
    let name = code;

    // Check for inline variant suffix
    if (name.endsWith("-emoji")) {
      variant = "emoji";
      name = name.slice(0, -6);
    } else if (name.endsWith("-text")) {
      variant = "text";
      name = name.slice(0, -5);
    }

    const emoji = EMOJI[name];
    if (emoji === undefined) return _match; // Not found, leave unchanged

    // Apply variant selector
    // [LAW:dataflow-not-control-flow] Always compute suffix, let the value decide
    const suffix =
      variant === "emoji"
        ? "\uFE0F"
        : variant === "text"
          ? "\uFE0E"
          : "";

    return emoji + suffix;
  });
}

export class NoEmoji extends Error {
  constructor(name: string) {
    super(`No emoji with name: "${name}"`);
    this.name = "NoEmoji";
  }
}

export class Emoji implements Renderable {
  readonly name: string;
  private readonly _char: string;
  private readonly _style: Style | undefined;
  private readonly _variant: "emoji" | "text" | undefined;

  constructor(
    name: string,
    style?: Style,
    variant?: "emoji" | "text",
  ) {
    const emoji = EMOJI[name];
    if (emoji === undefined) throw new NoEmoji(name);
    this.name = name;
    this._char = emoji;
    this._style = style;
    this._variant = variant;
  }

  toString(): string {
    const suffix =
      this._variant === "emoji"
        ? "\uFE0F"
        : this._variant === "text"
          ? "\uFE0E"
          : "";
    return this._char + suffix;
  }

  *render(_options: RenderOptions): Iterable<Segment> {
    yield new Segment(this.toString(), this._style);
  }

  static replace(text: string): string {
    return emojiReplace(text);
  }
}
