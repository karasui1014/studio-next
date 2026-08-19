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
  /**
   * ライセンスの連番（例: `C-002`）。**失効の即時反映に使う。**
   *
   * ■ ここに何を入れて、何を入れないか
   * 入れるのは連番だけ。**生のライセンスキーも、そのハッシュも入れない。**
   * JWTのペイロードはBase64URLで誰でも読めるため、キーそのものが漏れる形にしてはいけない。
   * 連番は台帳の行番号にすぎず、それ単体では何の権限も持たない
   * （連番からキーを逆算することはできず、KVの照合にも使えない）。
   *
   * ■ 省略可能な理由（経過措置）
   * この仕組みを入れる前（〜2026-08-19）に発行したトークンには入っていない。
   * 既存の会員にキーを入れ直させないため、`sid` が無いトークンは
   * 従来どおり通す。TTLが30日なので、経過措置は最長30日で自然に終わる。
   */
  sid?: string
  /** 発行時刻（秒） */
  iat: number
  /** 失効時刻（秒） */
  exp: number
}
