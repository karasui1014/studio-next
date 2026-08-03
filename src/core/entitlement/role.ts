import { create } from 'zustand'

/**
 * 権限（Role）
 *
 * ■ 原則: 価格ではなく Role で管理する
 * 入手経路が YouTube メンバーシップでも Studio 直販でも、最終的に同じ Role になる。
 * 画面側は「いくら払ったか」「どこで買ったか」を一切見ない。
 *
 *   YouTube「AIでMVを作りたい部」                 → role = premium
 *   Studio Premium（直販）                         → role = premium
 *   YouTube「AIでMVを1か月でマスターしたい方向け」  → role = master
 *   Studio Master（直販）                          → role = master
 *
 * ■ 認証について
 * Studio では別途アカウントを作らせない（V1の憲章どおりサーバー・ログインを持たない）。
 * メンバーシップ加入者には Role を含むキーを配り、端末内で検証して Role を付与する。
 * この層だけ差し替えれば、将来サーバーを持つ判断をしても画面側は書き換えずに済む。
 */

export type Role = 'free' | 'premium' | 'master'

/** Roleをどこから得たか。表示の出し分けと将来の移行判断に使う。 */
export type RoleSource = 'none' | 'youtube' | 'studio'

export const ROLE_LABEL: Record<Role, string> = {
  free: '無料プラン',
  premium: 'Studio Premium',
  master: 'Studio Master',
}

/**
 * Studio直販の価格。ここが「Studioというサービスそのものの値段」。
 * YouTube経由より安いのは、YouTube側にはメンバーシップ特典が別に付くため。
 */
export const STUDIO_PRICE: Record<Exclude<Role, 'free'>, number> = {
  premium: 980,
  master: 5600,
}

/**
 * YouTubeメンバーシップとRoleの対応。ここを唯一の正とする。
 * role が null の段は、Studioの権限が付かない応援用の段。
 */
export const YOUTUBE_TIERS: {
  role: Exclude<Role, 'free'> | null
  name: string
  price: number
  note?: string
}[] = [
  { role: null, name: 'AI大好き部', price: 690, note: 'Studioの権限は付きません' },
  { role: 'premium', name: 'Studio Premium利用権付き', price: 1290, note: '現「AIでMVを作りたい部」' },
  { role: 'master', name: 'Studio Master利用権付き', price: 5600, note: '現「AIでMVを1か月でマスターしたい方向け」' },
]

/** Master限定のDiscordコミュニティ */
export const DISCORD_INVITE_URL = 'https://discord.gg/zdGrkph8'

/**
 * 「YouTubeで加入する」ボタンの遷移先。
 * 通常のチャンネルページではなく、メンバーシップ加入画面へ直接遷移させる。
 * URLはここ1箇所だけで管理し、画面側に直接書かない。
 */
export const YOUTUBE_JOIN_URL = 'https://www.youtube.com/@AI音楽部-AImusic/join'

/** Premium以上か（Master は Premium をすべて含む） */
export function isPaid(role: Role): boolean {
  return role === 'premium' || role === 'master'
}

export function isMaster(role: Role): boolean {
  return role === 'master'
}

const ROLE_KEY = 'studio-next:role'
const SOURCE_KEY = 'studio-next:role-source'

function loadRole(): Role {
  try {
    const v = localStorage.getItem(ROLE_KEY)
    if (v === 'free' || v === 'premium' || v === 'master') return v
  } catch {
    /* 読めなければ無料として扱う */
  }
  return 'free'
}

function loadSource(): RoleSource {
  try {
    const v = localStorage.getItem(SOURCE_KEY)
    if (v === 'youtube' || v === 'studio') return v
  } catch {
    /* noop */
  }
  return 'none'
}

interface RoleState {
  role: Role
  source: RoleSource
  setRole: (role: Role, source?: RoleSource) => void
}

export const useRoleStore = create<RoleState>((set) => ({
  role: loadRole(),
  source: loadSource(),
  setRole: (role, source = 'studio') => {
    const nextSource: RoleSource = role === 'free' ? 'none' : source
    try {
      localStorage.setItem(ROLE_KEY, role)
      localStorage.setItem(SOURCE_KEY, nextSource)
    } catch {
      /* 保存できなくても画面は動かす */
    }
    set({ role, source: nextSource })
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
    master: isMaster(role),
    label: ROLE_LABEL[role],
  }
}
