export type Role = 'free' | 'premium' | 'creator' | 'master'

export interface Env {
  /** 会員名簿・ライセンスキー・レート制限 */
  ROSTER_KV: KVNamespace

  /** セッショントークンの署名鍵（HS256）。本番は wrangler secret で設定する */
  SESSION_SECRET: string

  /** ライセンスキーをハッシュ化するときに混ぜる値。名簿投入時と同じ値でなければ一致しない */
  LICENSE_PEPPER?: string

  /** CORS で許可するオリジン（カンマ区切り） */
  ALLOWED_ORIGINS?: string

  /**
   * 'true' のときだけ、DevRoleSwitcher からの role 指定でトークンを発行する。
   * .dev.vars にしか書かない。本番では undefined。
   */
  DEV_ROLE_OVERRIDE?: string
}

/** セッショントークンに入れる中身。role はサーバーが決めたものだけが入る */
export interface SessionClaims {
  /** 権限。クライアントの申告ではなく resolveMembership() の結果 */
  role: Role
  /** 判定の根拠 */
  src: string
  /** 発行時刻（秒） */
  iat: number
  /** 失効時刻（秒） */
  exp: number
}
