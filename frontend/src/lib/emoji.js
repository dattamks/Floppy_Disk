// A compact, curated emoji set for the ":" picker — enough to be useful without
// shipping a huge table. Each entry: [char, name, ...extra keywords].
const RAW = [
  ['😀', 'grin', 'smile', 'happy'], ['😃', 'smiley', 'happy'], ['😄', 'laugh', 'happy'],
  ['😁', 'beaming', 'grin'], ['😆', 'laughing', 'lol'], ['😅', 'sweat_smile'], ['🤣', 'rofl', 'lol'],
  ['😂', 'joy', 'lol', 'cry'], ['🙂', 'slight_smile'], ['🙃', 'upside_down'], ['😉', 'wink'],
  ['😊', 'blush', 'happy'], ['😇', 'innocent', 'angel'], ['🥰', 'smiling_hearts', 'love'],
  ['😍', 'heart_eyes', 'love'], ['🤩', 'star_struck'], ['😘', 'kiss'], ['😗', 'kissing'],
  ['😜', 'stuck_out_tongue_wink'], ['🤪', 'zany'], ['🤨', 'raised_eyebrow'], ['🧐', 'monocle'],
  ['🤓', 'nerd'], ['😎', 'sunglasses', 'cool'], ['🥳', 'party', 'celebrate'], ['😏', 'smirk'],
  ['😒', 'unamused'], ['😞', 'disappointed'], ['😔', 'pensive'], ['😟', 'worried'], ['😕', 'confused'],
  ['🙁', 'frown'], ['😣', 'persevere'], ['😖', 'confounded'], ['😫', 'tired'], ['😩', 'weary'],
  ['🥺', 'pleading'], ['😢', 'cry', 'sad'], ['😭', 'sob', 'cry', 'sad'], ['😤', 'triumph', 'huff'],
  ['😠', 'angry', 'mad'], ['😡', 'rage', 'angry'], ['🤬', 'cursing'], ['🤯', 'exploding_head', 'mind_blown'],
  ['😳', 'flushed'], ['🥵', 'hot'], ['🥶', 'cold'], ['😱', 'scream', 'fear'], ['😨', 'fearful'],
  ['😰', 'anxious'], ['😥', 'sad_relieved'], ['🤗', 'hug'], ['🤔', 'thinking'], ['🤫', 'shush'],
  ['🤥', 'lying'], ['😶', 'no_mouth'], ['😐', 'neutral'], ['😑', 'expressionless'], ['😬', 'grimace'],
  ['🙄', 'eye_roll'], ['😯', 'hushed'], ['😴', 'sleeping', 'zzz'], ['🤤', 'drool'], ['😪', 'sleepy'],
  ['😵', 'dizzy'], ['🤐', 'zipper_mouth'], ['🥴', 'woozy'], ['🤢', 'nauseated'], ['🤮', 'vomit'],
  ['🤧', 'sneeze'], ['😷', 'mask'], ['🤒', 'thermometer_face', 'sick'], ['🤕', 'head_bandage'],
  ['👍', 'thumbsup', '+1', 'like', 'yes'], ['👎', 'thumbsdown', '-1', 'no'], ['👌', 'ok_hand'],
  ['✌️', 'victory', 'peace'], ['🤞', 'crossed_fingers'], ['🤟', 'love_you'], ['🤘', 'rock_on'],
  ['👏', 'clap'], ['🙌', 'raised_hands', 'praise'], ['👐', 'open_hands'], ['🤝', 'handshake', 'deal'],
  ['🙏', 'pray', 'please', 'thanks'], ['✍️', 'writing'], ['💪', 'muscle', 'strong'], ['👀', 'eyes', 'look'],
  ['🧠', 'brain'], ['❤️', 'heart', 'love'], ['🧡', 'orange_heart'], ['💛', 'yellow_heart'],
  ['💚', 'green_heart'], ['💙', 'blue_heart'], ['💜', 'purple_heart'], ['🖤', 'black_heart'],
  ['🤍', 'white_heart'], ['💔', 'broken_heart'], ['💯', '100', 'hundred'], ['💢', 'anger'],
  ['💥', 'boom', 'collision'], ['💫', 'dizzy_star'], ['💦', 'sweat_drops'], ['💨', 'dash'],
  ['🔥', 'fire', 'lit', 'hot'], ['⭐', 'star'], ['🌟', 'glowing_star'], ['✨', 'sparkles'],
  ['⚡', 'zap', 'lightning'], ['☀️', 'sun'], ['🌈', 'rainbow'], ['☁️', 'cloud'], ['❄️', 'snowflake'],
  ['✅', 'check', 'done', 'white_check_mark'], ['✔️', 'heavy_check', 'done'], ['❌', 'x', 'cross', 'no'],
  ['❓', 'question'], ['❗', 'exclamation', 'bang'], ['⚠️', 'warning', 'caution'], ['🚫', 'no_entry'],
  ['💡', 'bulb', 'idea'], ['🔑', 'key'], ['🔒', 'lock'], ['🔓', 'unlock'], ['📌', 'pushpin', 'pin'],
  ['📎', 'paperclip', 'attach'], ['🔗', 'link'], ['📝', 'memo', 'note'], ['✏️', 'pencil', 'edit'],
  ['📅', 'calendar', 'date'], ['⏰', 'alarm', 'clock'], ['⏳', 'hourglass', 'waiting'],
  ['📈', 'chart_up', 'growth'], ['📉', 'chart_down'], ['📊', 'bar_chart', 'stats'], ['💰', 'money_bag'],
  ['💵', 'dollar', 'money'], ['🎯', 'target', 'dart', 'goal'], ['🚀', 'rocket', 'launch', 'ship'],
  ['🏆', 'trophy', 'win'], ['🎉', 'tada', 'party', 'celebrate'], ['🎊', 'confetti'], ['🎁', 'gift'],
  ['🐛', 'bug'], ['✉️', 'email', 'mail'], ['📮', 'postbox'], ['🔔', 'bell', 'notify'],
  ['🔕', 'no_bell', 'mute'], ['📢', 'loudspeaker', 'announce'], ['🗑️', 'trash', 'delete'],
  ['♻️', 'recycle'], ['🔍', 'search', 'magnify'], ['🛠️', 'tools'], ['⚙️', 'gear', 'settings'],
  ['🧩', 'puzzle'], ['📦', 'package', 'box'], ['🏁', 'checkered_flag', 'finish'], ['🚩', 'triangular_flag'],
];

export const EMOJI = RAW.map(([char, name, ...kw]) => ({ char, name, keywords: kw }));

// Rank matches for a query: exact name first, then name-startsWith, then any hit.
export function searchEmoji(query, limit = 24) {
  const q = (query || '').toLowerCase();
  if (!q) return EMOJI.slice(0, limit);
  const scored = [];
  for (const e of EMOJI) {
    const hay = [e.name, ...e.keywords];
    let score = -1;
    if (e.name === q) score = 100;
    else if (e.name.startsWith(q)) score = 60;
    else if (hay.some((k) => k.startsWith(q))) score = 40;
    else if (hay.some((k) => k.includes(q))) score = 20;
    if (score >= 0) scored.push([score, e]);
  }
  return scored.sort((a, b) => b[0] - a[0]).slice(0, limit).map((s) => s[1]);
}
