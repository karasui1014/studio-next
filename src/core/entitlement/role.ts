import { create } from 'zustand'

/**
 * 権限（Role）
 *
 * ■ 原則: 価格ではなく Role で管理する
 * 加入経路はYouTubeメンバーシップのみ（Studio直販は行わない・2026-08-12決定）。
 * 画面側は「いくら払ったか」を一切見ない。
 *
 *   YouTube「AI音楽部 Studio Premium」 → role = premium
 *   YouTube「AI音楽部 Studio Creator」 → role = creator
 *   YouTube「AI音楽部Studio Master」   → role = master
 *
 * ■ 「Studioのプラン名」と「YouTubeの商品名」は別物（2026-08-19決定）
 * Studio内では `ROLE_LABEL`（例：Studio Creator）を使う。**「AI音楽部」は付けない。**
 * YouTubeの加入案内など、メンバーシップの正式名称を出す場所でだけ
 * `YOUTUBE_TIERS[].youtubeName`（例：AI音楽部 Studio Creator）を使う。
 * この2つを混ぜて画面に直接書かないこと——改名のたびに探し回ることになる。
 *
 * ■ 認証について
 * Studio では別途アカウントを作らせない（V1の憲章どおりサーバー・ログインを持たない）。
 * メンバーシップ加入者には Role を含むキーを配り、端末内で検証して Role を付与する。
 * この層だけ差し替えれば、将来サーバーを持つ判断をしても画面側は書き換えずに済む。
 */

export type Role = 'free' | 'premium' | 'creator' | 'master'

/**
 * 権限の強さ。`free < premium < creator < master`
 *
 * 上位は下位をすべて含む（creator は premium の機能を全部使える）。
 * 画面側で「今より上か」を比べるときは、必ずこの表を通すこと。
 * 各画面が独自の順序表を持つと、プランが増えたときに片方だけ直し忘れる。
 * Worker側にも同じ並びがある（`worker/api/src/session.ts` の ROLE_RANK）。
 */
export const ROLE_RANK: Record<Role, number> = {
  free: 0,
  premium: 1,
  creator: 2,
  master: 3,
}

/** actual が required 以上の権限を持つか */
export function satisfiesRole(actual: Role, required: Role): boolean {
  return ROLE_RANK[actual] >= ROLE_RANK[required]
}

/**
 * Roleをどこから得たか。表示の出し分けに使う。
 *
 * ■ Studio直販は無い（2026-08-12決定）
 * 加入経路はYouTubeメンバーシップのみ。かつてはStudioでの直接購入も
 * 想定して 'studio' という値を持っていたが、実際に発行される経路が
 * 存在しなかった（ライセンスキーは常にYouTube会員確認を経て発行される）。
 * 存在しない経路をUIに残すと「（Studio直販）」のような誤った表示を生むため、
 * 選択肢自体を削除した。
 */
export type RoleSource = 'none' | 'youtube'

/**
 * **Studio Next の中で表示するプラン名。**
 *
 * ここに「AI音楽部」は付けない。付けるのはYouTube側の商品名だけ
 * （→ `YOUTUBE_TIERS[].youtubeName`）。
 */
export const ROLE_LABEL: Record<Role, string> = {
  free: '無料プラン',
  premium: 'Studio Premium',
  creator: 'Studio Creator',
  master: 'Studio Master',
}

/**
 * YouTubeメンバーシップとRoleの対応。ここを唯一の正とする。
 *
 * `youtubeName` は **YouTube側の商品名**であり、Studio内のプラン名とは別物。
 * YouTubeの加入案内で「どの段に入ればいいか」を伝える場面でだけ使う。
 * role が null の段は、Studioの権限が付かない応援用の段。
 *
 * ⚠️ 35,000円「企業様向け」の段は、Studioの権限体系とは無関係の別商品のため
 * ここには載せない（PROJECT_SPEC.md §4で明文化）。手動でキーを発行するときの
 * 判断基準は `scripts/membership-levels.mjs` 側に「権限なし」として明示してある。
 */
export const YOUTUBE_TIERS: {
  role: Exclude<Role, 'free'> | null
  /** YouTubeメンバーシップの商品名。Studio内のプラン名（ROLE_LABEL）とは別 */
  youtubeName: string
  price: number
  note?: string
}[] = [
  { role: null, youtubeName: 'Ai大好き部', price: 690, note: 'Studioの権限は付きません' },
  { role: 'premium', youtubeName: 'AI音楽部 Studio Premium', price: 1290 },
  { role: 'creator', youtubeName: 'AI音楽部 Studio Creator', price: 3490, note: '2026-08-18新設' },
  // 「部」と「Studio」の間に空白が無いのはYouTube側の実表記どおり。
  // 揃っていないが、ここは見た目を整える場所ではなく実物を写す場所（2026-08-19確認）
  { role: 'master', youtubeName: 'AI音楽部Studio Master', price: 5600 },
]

/** Roleに対応するYouTubeメンバーシップの段（無ければ null） */
export function youtubeTierFor(role: Role) {
  return YOUTUBE_TIERS.find((t) => t.role === role) ?? null
}

/**
 * Master限定のDiscordコミュニティについて。
 *
 * ⚠️ **招待URLはこのリポジトリ（公開コード）に置かない。**
 * ここは公開ビルドに含まれ、配信されるJSに文字列として埋め込まれる。
 * 一度でもコミットすると、Git履歴からも読めてしまい取り消せない。
 *
 * 招待は公式LINEから、キー送付と同じタイミングで手動でお送りする。
 * URLの実体は `~/軍配/house-rules.md`（Git管理外・ローカルのみ）に控えている。
 */

/**
 * 「YouTubeで加入する」ボタンの遷移先。
 * 通常のチャンネルページではなく、メンバーシップ加入画面へ直接遷移させる。
 * URLはここ1箇所だけで管理し、画面側に直接書かない。
 */
export const YOUTUBE_JOIN_URL = 'https://www.youtube.com/@AI音楽部-AImusic/join'

/**
 * 公式LINEの「友だち追加」URL。
 *
 * ■ Discordの招待URLとは性質が違う（2026-08-11 判断）
 * こちらは定員のある私的コミュニティへの入場鍵ではなく、
 * 既にYouTubeメンバー限定投稿で公開案内している問い合わせ窓口。
 * 誰が開いても「上限が崩れる」ような不都合は起きないため、
 * YOUTUBE_JOIN_URL と同じ扱いで定数として持ってよいと判断した。
 *
 * 利用申請・プラン変更（Premium→Master等）の連絡窓口として使う。
 * URLはここ1箇所だけで管理し、画面側に直接書かない。
 */
export const OFFICIAL_LINE_URL = 'https://lin.ee/OxFaiLT'

/** Premium以上か（Creator・Master は Premium をすべて含む） */
export function isPaid(role: Role): boolean {
  return satisfiesRole(role, 'premium')
}

/** Creator以上か（Master は Creator をすべて含む） */
export function isCreator(role: Role): boolean {
  return satisfiesRole(role, 'creator')
}

export function isMaster(role: Role): boolean {
  return role === 'master'
}

const ROLE_KEY = 'studio-next:role'
const SOURCE_KEY = 'studio-next:role-source'

/**
 * ■ ここでの role は「表示の出し分け」にしか使わない
 *
 * 限定コンテンツの本文は、この値がどうであろうと手に入らない。
 * 本文はAPIが持っていて、APIはサーバー側でセッションを検証してからしか返さない。
 * つまり localStorage を書き換えても、増えるのは「解除された見た目」だけで、
 * 中身は1文字も降ってこない。
 *
 * ■ それでも本番では localStorage を読まない
 * 見た目だけとはいえ、未購入者に「解除された画面」を見せる意味はなく、
 * 不具合の誤報のもとにもなる。本番の初期値は常に free とし、
 * 検証済みセッション（setRoleFromSession）でしか変えられないようにする。
 */
const DEV = import.meta.env.DEV

function loadRole(): Role {
  if (!DEV) return 'free' // 本番: localStorage は権限の根拠にしない
  try {
    const v = localStorage.getItem(ROLE_KEY)
    // ROLE_RANK を判定に使う。ここに個別の値を並べると、
    // プランが増えたときに書き足し忘れて静かに free へ落ちる
    if (v !== null && v in ROLE_RANK) return v as Role
  } catch {
    /* 読めなければ無料として扱う */
  }
  return 'free'
}

function loadSource(): RoleSource {
  if (!DEV) return 'none'
  try {
    const v = localStorage.getItem(SOURCE_KEY)
    if (v === 'youtube') return v
  } catch {
    /* noop */
  }
  return 'none'
}

interface RoleState {
  role: Role
  source: RoleSource
  /** 開発時の表示確認用（DevRoleSwitcher）。本番ビルドでは何もしない */
  setRole: (role: Role, source?: RoleSource) => void
  /** APIが検証したセッションの結果を反映する。本番で role が変わる唯一の経路 */
  setRoleFromSession: (role: Role, source: RoleSource) => void
}

export const useRoleStore = create<RoleState>((set) => ({
  role: loadRole(),
  source: loadSource(),

  setRole: (role, source = 'youtube') => {
    // 本番では表示の昇格すら許さない。DevRoleSwitcher 自体も描画されない
    if (!DEV) return
    const nextSource: RoleSource = role === 'free' ? 'none' : source
    try {
      localStorage.setItem(ROLE_KEY, role)
      localStorage.setItem(SOURCE_KEY, nextSource)
    } catch {
      /* 保存できなくても画面は動かす */
    }
    set({ role, source: nextSource })
  },

  setRoleFromSession: (role, source) => {
    // 保存しない。次回もAPIに聞き直す（localStorage を権限の記録場所にしない）
    set({ role, source: role === 'free' ? 'none' : source })
  },
}))

/**
 * 画面側はこれだけを使う。
 * ここを通しておけば、認証方式が変わっても各画面の書き換えは要らない。
 */
export function useRole() {
  const role = useRoleStore((s) => s.role)
  const source = useRoleStore((s) => s.source)
  return {
    role,
    source,
    paid: isPaid(role),
    creator: isCreator(role),
    master: isMaster(role),
    label: ROLE_LABEL[role],
    /** この権限が required 以上か。プランが増えても画面側は書き換えずに済む */
    can: (required: Role) => satisfiesRole(role, required),
  }
}
