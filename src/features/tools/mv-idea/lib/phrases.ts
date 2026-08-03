/**
 * 日本語表示ラベルと、画像・動画生成AIへ渡す英語トークンの対応表。
 *
 * なぜ英語トークンを持つか: 主要な画像/動画生成AIは英語プロンプトで最も安定する。
 * 一方で企画書は日本語で読めないと使えない。そこで「表示は日本語・プロンプトは英語」を
 * 1か所で対応付け、ユーザーが自由入力で書き換えた場合はその文字列をそのまま使う
 * (最近のモデルは日本語も解釈できるため、未知語でも壊れない)。
 */

export interface Phrase {
  ja: string
  en: string
}

export const COMPOSITIONS = {
  wideEstablish: { ja: 'ワイドショット(状況説明)', en: 'wide establishing shot' },
  medium: { ja: 'ミディアムショット', en: 'medium shot' },
  closeUp: { ja: 'クローズアップ', en: 'close-up shot' },
  overShoulder: { ja: 'オーバーショルダー', en: 'over-the-shoulder shot' },
  longLonely: { ja: 'ロングショット(孤独感)', en: 'extreme long shot, small subject in frame' },
  insert: { ja: 'インサート(小道具)', en: 'insert shot, detail of a prop' },
  symmetry: { ja: 'シンメトリー構図', en: 'symmetrical composition, centered' },
  silhouetteLong: { ja: 'シルエットのロングショット', en: 'backlit silhouette, long shot' },
  lowAngle: { ja: 'ローアングル', en: 'low angle shot' },
  topDown: { ja: '真俯瞰', en: 'top-down overhead shot' },
  handFace: { ja: 'クローズアップ(手・目元)', en: 'extreme close-up of hands and eyes' },
  wideAngle: { ja: '広角ワイド', en: 'wide angle lens shot' },
  textCenter: { ja: '文字中心のフラット構図', en: 'flat graphic layout, large empty center for text' },
  bgWithLowerText: { ja: '背景+下部に歌詞スペース', en: 'background plate with clear empty space at the bottom third' },
  fullText: { ja: '画面全面テキスト', en: 'minimal flat background, full-frame negative space' },
  negativeSpace: { ja: '余白を活かした配置', en: 'minimalist composition, generous negative space' },
  diagonal: { ja: '対角線の配置', en: 'diagonal composition, dynamic asymmetry' },
  singleWide: { ja: '一枚絵のワイド', en: 'wide illustrated scene, detailed key art' },
  scenery: { ja: '引きの風景', en: 'wide landscape view' },
  faceCloseUp: { ja: '寄りの表情カット', en: 'close-up portrait, emotional expression' },
  birdsEye: { ja: '俯瞰の全景', en: "bird's eye view of the whole location" },
  throughFrame: { ja: '窓越し・隙間越しの構図', en: 'framed through a window, foreground framing' },
  abstractCenter: { ja: '中央対称の抽象構図', en: 'abstract radial symmetry, centered' },
  fullTexture: { ja: '全面テクスチャ', en: 'full frame texture, macro abstract' },
  horizonMinimal: { ja: '地平線のあるミニマル構図', en: 'minimal horizon line composition' },
  vortex: { ja: '渦の中心構図', en: 'spiral vortex centered composition' },
  grid: { ja: '格子・反復構図', en: 'repeating geometric grid pattern' },
  fixedWide: { ja: '定点のワイド', en: 'locked-off wide shot' },
  handsDetail: { ja: '手元のクローズアップ', en: 'close-up of hands, shallow focus' },
  windowBacklit: { ja: '窓辺の逆光構図', en: 'backlit window scene, rim light' },
  alleyLong: { ja: '路地のロングショット', en: 'long shot down a narrow alley' },
  tableTop: { ja: 'テーブル俯瞰', en: 'overhead flat lay of a table' },
  roomWide: { ja: '斜め俯瞰の部屋全景', en: 'high angle three-quarter view of a room interior' },
  deskMedium: { ja: '机上のミディアム', en: 'medium shot of a desk setup' },
  exteriorLong: { ja: '外景のロングショット', en: 'exterior long shot of the building' },
} as const satisfies Record<string, Phrase>

export const CAMERA_MOVES = {
  slowDollyIn: { ja: 'ゆっくりドリーイン', en: 'slow dolly in' },
  slowDollyOut: { ja: 'ゆっくりドリーアウト', en: 'slow dolly out' },
  fixed: { ja: '固定', en: 'locked-off static camera' },
  pan: { ja: '横パン', en: 'slow horizontal pan' },
  tilt: { ja: '縦チルト', en: 'slow vertical tilt' },
  handheld: { ja: '手持ち風の微揺れ', en: 'subtle handheld camera shake' },
  orbit: { ja: 'ゆっくり回り込み', en: 'slow orbit around the subject' },
  slowZoomIn: { ja: 'ゆっくりズームイン', en: 'slow zoom in' },
  slowZoomOut: { ja: 'ゆっくりズームアウト', en: 'slow zoom out' },
  verySlowZoomIn: { ja: '極めてゆっくりのズームイン', en: 'almost imperceptible slow push in' },
  verySlowZoomOut: { ja: '極めてゆっくりのズームアウト', en: 'almost imperceptible slow pull out' },
  bgZoom: { ja: '背景のゆっくりズーム', en: 'slow zoom on the background plate' },
  scrollH: { ja: '横スクロール', en: 'horizontal scrolling movement' },
  scrollV: { ja: '縦スクロール', en: 'vertical scrolling movement' },
  focusPull: { ja: 'フォーカス送り', en: 'rack focus' },
  forward: { ja: 'ゆっくり前進', en: 'slow forward travelling' },
  rotate: { ja: '回転', en: 'slow rotation' },
  wave: { ja: '波のような揺れ', en: 'gentle undulating drift' },
  infiniteZoom: { ja: '無限ズーム', en: 'endless zoom loop' },
} as const satisfies Record<string, Phrase>

export const SUBJECT_MOVES = {
  walk: { ja: '歩く', en: 'walking slowly' },
  stopTurn: { ja: '立ち止まり振り返る', en: 'stopping and turning around' },
  handAction: { ja: '手元の動作', en: 'small hand gesture' },
  lookUp: { ja: '空を見上げる', en: 'looking up at the sky' },
  startRun: { ja: '走り出す', en: 'starting to run' },
  sway: { ja: 'リズムに合わせて揺れる', en: 'swaying gently to the rhythm' },
  hairWind: { ja: '髪や衣装が風になびく', en: 'hair and clothes flowing in the wind' },
  reachOut: { ja: '手を伸ばす', en: 'reaching out a hand' },
  turnAround: { ja: '振り向く', en: 'turning to face the camera' },
  still: { ja: '静止', en: 'standing still' },
  graphicFadeIn: { ja: 'グラフィックがフェードイン', en: 'graphic elements gently fading in' },
  graphicBounce: { ja: 'グラフィックが拍で弾む', en: 'graphic elements pulsing on the beat' },
  graphicFlow: { ja: 'グラフィックが流れて消える', en: 'elements drifting out of frame' },
  graphicOneByOne: { ja: '要素が順番に現れる', en: 'elements appearing one after another' },
  graphicGlow: { ja: '光がにじむ', en: 'soft glow pulsing' },
  frozen: { ja: '静止(絵の中の時間が止まる)', en: 'completely still, frozen moment' },
  hairOnly: { ja: '髪だけ揺れる', en: 'only the hair moves gently' },
  lightFlicker: { ja: '光の明滅', en: 'light softly flickering' },
  weatherOnly: { ja: '雨や雪だけ動く', en: 'only rain or snow particles falling' },
  blinkOnly: { ja: '瞬きだけ', en: 'only a slow blink' },
  particlePulse: { ja: '粒子が拍で脈動', en: 'particles pulsing on the beat' },
  fluidFlow: { ja: '流体がうねる', en: 'fluid shapes undulating' },
  patternGrow: { ja: '模様が増殖', en: 'patterns multiplying outward' },
  colorShift: { ja: '色が転調', en: 'colors shifting hue' },
  steam: { ja: 'コーヒーの湯気が立つ', en: 'steam rising from a cup' },
  passerby: { ja: '人が通り過ぎる', en: 'a passerby crossing the frame' },
  pageTurn: { ja: 'ページをめくる', en: 'turning a page' },
  rainOnGlass: { ja: '雨粒が窓を伝う', en: 'raindrops running down the glass' },
  curtain: { ja: 'カーテンが揺れる', en: 'curtains swaying softly' },
  headBob: { ja: '一定リズムで頭を揺らす', en: 'head bobbing in a steady loop' },
  ambientLoop: { ja: '湯気や雨の環境ループ', en: 'looping ambient steam and rain' },
  screenBlink: { ja: '画面内の明かりが明滅', en: 'screen light blinking in a loop' },
  pendulum: { ja: '振り子の反復', en: 'a pendulum swinging in a loop' },
} as const satisfies Record<string, Phrase>

/** 日本語ラベル → 英語トークンの逆引き表(全フレーズを1つに統合) */
const JA_TO_EN = new Map<string, string>()
for (const table of [COMPOSITIONS, CAMERA_MOVES, SUBJECT_MOVES]) {
  for (const phrase of Object.values(table) as Phrase[]) {
    JA_TO_EN.set(phrase.ja, phrase.en)
  }
}

/**
 * 日本語ラベルを英語プロンプトトークンへ変換する。
 * 対応表にない場合(ユーザーが自由入力で書き換えた場合)は、その文字列をそのまま返す。
 */
export function toPromptToken(ja: string): string {
  const key = String(ja ?? '').trim()
  if (!key) return ''
  return JA_TO_EN.get(key) ?? key
}
