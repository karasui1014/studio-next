/**
 * LICENSE_PEPPER の取得。
 *
 * ■ なぜこれが要るか（2026-08-12・実際に起きた事故）
 * 以前は発行のたびに `LICENSE_PEPPER=xxx node scripts/issue-license-key.mjs ...`
 * と手入力していた。ある日その場で覚えていた値と、本番Workerに
 * `wrangler secret put` 済みの値がずれ、正しく発行したキーが2回連続で
 * 認証に通らないという障害になった（原因究明に時間を要した）。
 *
 * 「値を記憶して毎回手入力する」運用そのものが事故の温床だったので、
 * macOSのキーチェーン（OS標準の安全な保管場所）に一度だけ登録し、
 * 発行のたびに自動で読みに行く方式に変えた。人間の記憶を経由させない。
 *
 * ■ Claude（AI）はこの値を扱わない
 * この関数はNode.jsプロセスの中でしか値を保持しない。呼び出し元
 * （issue-license-key.mjs）も、値をログへ出したり戻り値として外に出したり
 * しない。画面に表示されるのは、この値から作ったライセンスキーと
 * そのハッシュだけで、pepper自体は一度も表示されない。
 * キーチェーンへの登録も、発行の実行も、必ずカラスイさん自身の
 * ターミナルで行う（Claudeが代わりに実行しない）。
 *
 * ■ 初回セットアップ（1回だけ・自分のターミナルで）
 *   read -s -p "pepperを貼り付けてEnter: " P && echo && \
 *     security add-generic-password -a "$USER" -s "studio-next-license-pepper" -w "$P" && \
 *     unset P
 * `read -s` は入力を画面に表示せず、シェルの履歴にも残さない。
 * 初回だけキーチェーンのアクセス許可ダイアログが出ることがある
 * （「常に許可」を選べば以後は聞かれない）。
 *
 * ■ 値を変更したいとき
 * 同じコマンドをもう一度実行すれば上書きされる（-U は付けていないが
 * add-generic-password は既存項目があれば上書きする）。
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { userInfo } from 'node:os'

export const KEYCHAIN_SERVICE = 'studio-next-license-pepper'

function fromKeychain() {
  try {
    return execFileSync(
      'security',
      ['find-generic-password', '-a', userInfo().username, '-s', KEYCHAIN_SERVICE, '-w'],
      { stdio: ['ignore', 'pipe', 'ignore'] },
    ).toString().trim()
  } catch {
    return ''
  }
}

function fromDevVars(devVarsPath) {
  if (!existsSync(devVarsPath)) return ''
  const m = /^LICENSE_PEPPER\s*=\s*"?(.*?)"?\s*$/m.exec(readFileSync(devVarsPath, 'utf8'))
  return m ? m[1] : ''
}

/**
 * pepperを解決する。優先順位:
 *   1. 環境変数 LICENSE_PEPPER（明示指定。従来どおりの手入力も引き続き使える）
 *   2. 本番（isProd）: macOSキーチェーン
 *   3. ローカル: worker/api/.dev.vars
 */
export function resolvePepper({ isProd, devVarsPath }) {
  if (process.env.LICENSE_PEPPER) return process.env.LICENSE_PEPPER
  if (isProd) return fromKeychain()
  return fromDevVars(devVarsPath)
}

export function keychainSetupHint() {
  return [
    'キーチェーンに登録されていません。最初の1回だけ、ご自身のターミナルで実行してください：',
    '',
    '  read -s -p "pepperを貼り付けてEnter: " P && echo && \\',
    `    security add-generic-password -a "$USER" -s "${KEYCHAIN_SERVICE}" -w "$P" && \\`,
    '    unset P',
    '',
    '（読み上げは画面に表示されず、シェル履歴にも残りません）',
    '（初回だけキーチェーンのアクセス許可ダイアログが出ることがあります。「常に許可」を選んでください）',
  ].join('\n')
}
