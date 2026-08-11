/**
 * YouTubeメンバーシップの段 → Studio Next の Role 参照表。
 *
 * ■ 用途（2026-08-11 改訂）
 * **手動ライセンス発行のときに参照する表**であり、
 * **将来CSV照合や自動発行を導入する場合の唯一の出典**でもある。
 *
 * 現行の本番（`worker/api` のライセンスキー方式）は、このファイルを読まない。
 * Role はキー発行時に運営者が決めてKVへ記録した値だけで決まるため。
 * つまり今このファイルは「コードから呼ばれない参照表」だが、意図的に残している。
 * ここに書かれた段名→Roleの対応こそが、公式LINEに来た申請を
 * 「Premiumか、Masterか、対象外か」に振り分ける判断基準そのものだからである。
 *
 * かつて PoC（`worker/auth-test`・`seed-auth-test-roster.mjs`）が読んでいたが、
 * PoC は 2026-08-11 に削除した。判定ロジックだけが残った形になる。
 *
 * ■ 手元で確認するとき
 *   node scripts/membership-levels.mjs "AiでMVを作りたい部"
 *   node scripts/membership-levels.mjs --list
 *
 * ■ 表示名で照合することについて（既知の弱点）
 * PROJECT_SPEC.md は「Role判定は表示名ではなくレベルIDで持つ」と定めている。
 * 表示名は改名で壊れるためで、その方針は正しい。
 * ただし YouTube Studio から書き出せるCSVにレベルIDが含まれるかは未確認のまま
 * （PoCで確かめる予定だったが、ライセンスキー方式を採ったため未検証で終わった）。
 * 自動照合を導入するなら、まずレベルIDが取れるかを確認し、ID基準へ移すこと。
 *
 * ■ 未知の段は free に倒す
 * 新しい段を作ったり改名したときに、意図せず権限が付くことを防ぐ。
 * 「知らないものは無料」が安全側。
 */

import { pathToFileURL } from 'node:url'

/** @typedef {'free'|'premium'|'master'} Role */

/**
 * 段の定義。
 *
 * ■ 価格では判定しない（重要）
 * 「高い段ほど上位の権限」という自動昇格はしない。**段名との明示的な対応だけ**で決める。
 * 実際、35,000円の「企業様向け」は Studio とは無関係の別商品であり、
 * 価格順で並べると誤って master に昇格してしまう。価格は参考情報として持つだけで、
 * 判定には一切使わない。
 *
 * ■ names には実在する表記をすべて入れる
 * 2026-08-08にYouTube Studioの実画面と照合したところ、
 * 従来ここに書かれていた名前は**3件とも実物と違っていた**
 * （`AI` と `Ai` の違い、5,600円の段名が別物）。
 * 実物を確認せずに書いた名前は、静かに全員 free に倒れる。
 *
 * 各段の `current` が **2026-08-08 にYouTube Studioの実画面で確認した現行の表記**。
 * `aliases` は表記ゆれ・旧称・将来の改名案で、照合の保険として持つ。
 * 改名したら `current` を差し替え、古い名前は `aliases` へ落とすこと
 * （消すと、改名前に申請した人の控えと突き合わせられなくなる）。
 */
export const MEMBERSHIP_LEVELS = [
  {
    role: null, // 応援用。Studioの権限は付かない
    price: 690,
    current: 'Ai大好き部',
    aliases: ['AI大好き部'],
  },
  {
    role: 'premium',
    price: 1290,
    current: 'AiでMVを作りたい部',
    aliases: [
      'AIでMVを作りたい部',
      'AIでMVを作りたい部Studio Premium', // 未保存ドラフトにあった名前
      'Studio Premium利用権付き', // 将来の改名案（PROJECT_SPEC.md の表記）
    ],
  },
  {
    role: 'master',
    price: 5600,
    current: 'AiでMVを作りたい部1ヶ月でマスターしたい方向け',
    aliases: [
      'AIでMVを作りたい部1ヶ月でマスターしたい方向け',
      'AIMVを1か月でマスターしたい方向けMaster', // 未保存ドラフトにあった名前
      'AIでMVを1か月でマスターしたい方向け',
      'Studio Master利用権付き', // 将来の改名案（PROJECT_SPEC.md の表記）
    ],
  },
  {
    /**
     * ⚠️ Studioとは無関係の別商品（企業向けの相談窓口）。
     *
     * 価格は最も高いが、**Studioの権限は一切付かない**（PROJECT_SPEC.md §4 で明文化）。
     * ここに明示的に載せてあるのは、「知らない段だから free」ではなく
     * 「意図して権限なしと決めた段」だと後から読めるようにするため。
     *
     * 価格順に並べて自動昇格させると、この段が master になる。それをやってはいけない。
     */
    role: null,
    price: 35000,
    current: '「企業様向け」Aiで曲作りしたい部',
    aliases: ['「企業様向け」AIで曲作りしたい部'],
    note: 'Studio対象外。企業向け相談という別商品',
  },
]

/** その段のすべての表記（現行＋別名） */
function namesOf(level) {
  return [level.current, ...(level.aliases ?? [])]
}

/** CSVのレベル列を見つけるための、既知の段名すべて */
export const KNOWN_LEVEL_NAMES = MEMBERSHIP_LEVELS.flatMap(namesOf)

/**
 * 段の名前 → Role。
 * 一致しなければ 'free'（＝権限を付けない）。
 *
 * @param {string|null|undefined} levelName
 * @returns {{ role: Role, matchedLevel: string|null, known: boolean }}
 */
/**
 * 照合用の正規化。
 * 空白のゆらぎに加えて**大文字小文字も吸収する**。
 * 「AI」と「Ai」の違いだけで一致しなくなり、全員が静かに free へ倒れる——
 * という事故が実際に起きかけたため（2026-08-08）。
 */
function normalizeName(s) {
  return s.replace(/[\s　]+/g, '').toLowerCase()
}

export function levelNameToRole(levelName) {
  if (!levelName || typeof levelName !== 'string') {
    return { role: 'free', matchedLevel: null, known: false }
  }
  const normalized = normalizeName(levelName)

  for (const level of MEMBERSHIP_LEVELS) {
    for (const name of namesOf(level)) {
      if (normalizeName(name) === normalized) {
        // role が null の段（応援用・企業向け）は「既知だが権限なし」
        return { role: level.role ?? 'free', matchedLevel: name, known: true }
      }
    }
  }
  return { role: 'free', matchedLevel: null, known: false }
}

// ---------------------------------------------------------------
// コマンドラインから引ける小さな確認ツール。
// 公式LINEに来た申請の段名を貼って、Roleを確かめるために使う。
//   node scripts/membership-levels.mjs "AiでMVを作りたい部"
//   node scripts/membership-levels.mjs --list
// ---------------------------------------------------------------
// 直接実行されたときだけ動かす。import されたときは何もしない。
// パスに空白や日本語が入ると `file://` + パスの単純結合では一致しないため
// （このリポジトリの実際のパスがまさにそれ）、pathToFileURL で正しく変換する。
const isMain = import.meta.url === pathToFileURL(process.argv[1] ?? '').href

if (isMain) {
  const arg = process.argv[2]

  if (!arg || arg === '--list') {
    console.log('\n=== YouTubeメンバーシップの段 → Studio Role ===\n')
    for (const l of MEMBERSHIP_LEVELS) {
      const role = l.role ?? '（権限なし）'
      console.log(`  ¥${String(l.price).padStart(6)} : ${l.current}`)
      console.log(`           → ${role}${l.note ? `  ※${l.note}` : ''}`)
      if (l.aliases?.length) console.log(`           別名: ${l.aliases.join(' / ')}`)
      console.log()
    }
    console.log('  上記以外の段名は、すべて free（権限を付けない）に倒れます。\n')
    console.log('  使い方: node scripts/membership-levels.mjs "段名"\n')
  } else {
    const r = levelNameToRole(arg)
    console.log()
    console.log(`  入力   : ${arg}`)
    console.log(`  一致   : ${r.matchedLevel ?? '（一致なし）'}`)
    console.log(`  Role   : ${r.role}`)
    console.log()
    if (!r.known) {
      console.log('  ⚠️ 未知の段名です。free に倒しました。')
      console.log('     段名を改名した場合は、このファイルの current / aliases を更新してください。')
      console.log('     YouTube Studioの実画面を必ず確認してから書いてください。')
    } else if (r.role === 'free') {
      console.log('  ℹ️ 既知の段ですが、意図的に Studio 権限を付けない段です。')
      console.log('     ライセンスキーは発行しません。')
    } else {
      console.log(`  ✅ ${r.role} のライセンスキーを発行する対象です。`)
      console.log(`     node scripts/issue-license-key.mjs ${r.role} --name "YouTube表示名" --prod`)
    }
    console.log()
  }
}
