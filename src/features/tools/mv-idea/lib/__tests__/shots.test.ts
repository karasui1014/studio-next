import { describe, expect, it } from 'vitest'

import {
  duplicateShot,
  moveShot,
  removeShot,
  renumberAndRetime,
  totalSeconds,
  updateShot,
} from '../shots'
import type { MvShot } from '../types'

function makeShot(no: number, startSec: number, endSec: number): MvShot {
  return {
    id: `shot-${no}`,
    no,
    startSec,
    endSec,
    scene: `場面${no}`,
    composition: 'ワイド',
    cameraMove: '固定',
    subjectMove: '静止',
    background: '路地',
    light: '夕方の光',
    imagePrompt: `image-${no}`,
    videoPrompt: `video-${no}`,
    negativePrompt: 'low quality',
    assets: '画像1枚',
    editMemo: '',
  }
}

// 5秒 / 6秒 / 4秒 の3ショット
function sampleShots(): MvShot[] {
  return [makeShot(1, 0, 5), makeShot(2, 5, 11), makeShot(3, 11, 15)]
}

describe('ショット編集ヘルパー', () => {
  it('renumberAndRetime: 秒数を保ったまま番号と時間を振り直す', () => {
    const shuffled = [makeShot(9, 100, 106), makeShot(5, 0, 5)]
    const result = renumberAndRetime(shuffled, 0)
    expect(result.map((s) => s.no)).toEqual([1, 2])
    expect(result[0].startSec).toBe(0)
    expect(result[0].endSec).toBe(6) // 6秒を維持
    expect(result[1].startSec).toBe(6)
    expect(result[1].endSec).toBe(11) // 5秒を維持
  })

  it('moveShot: 下へ移動すると入れ替わり、時間が詰め直される', () => {
    const result = moveShot(sampleShots(), 'shot-1', 'down')
    expect(result.map((s) => s.id)).toEqual(['shot-2', 'shot-1', 'shot-3'])
    expect(result.map((s) => s.no)).toEqual([1, 2, 3])
    // 6秒 / 5秒 / 4秒 の順になる
    expect(result[0].startSec).toBe(0)
    expect(result[0].endSec).toBe(6)
    expect(result[1].endSec).toBe(11)
    expect(result[2].endSec).toBe(15)
  })

  it('moveShot: 端のショットは動かない', () => {
    const shots = sampleShots()
    expect(moveShot(shots, 'shot-1', 'up')).toBe(shots)
    expect(moveShot(shots, 'shot-3', 'down')).toBe(shots)
    expect(moveShot(shots, 'unknown', 'up')).toBe(shots)
  })

  it('duplicateShot: 直後に複製され、IDは新しくなる', () => {
    const result = duplicateShot(sampleShots(), 'shot-2')
    expect(result).toHaveLength(4)
    expect(result[1].id).toBe('shot-2')
    expect(result[2].id).not.toBe('shot-2')
    expect(result[2].scene).toBe('場面2')
    // 複製分(6秒)だけ全体が伸びる
    expect(totalSeconds(result)).toBe(21)
    expect(result.map((s) => s.no)).toEqual([1, 2, 3, 4])
  })

  it('removeShot: 削除後に番号と時間が詰め直される', () => {
    const result = removeShot(sampleShots(), 'shot-2')
    expect(result).toHaveLength(2)
    expect(result.map((s) => s.id)).toEqual(['shot-1', 'shot-3'])
    expect(result.map((s) => s.no)).toEqual([1, 2])
    expect(result[1].startSec).toBe(5)
    expect(result[1].endSec).toBe(9) // 4秒を維持
  })

  it('updateShot: 秒数変更で後続ショットがずれる', () => {
    const result = updateShot(sampleShots(), 'shot-1', {}, 8)
    expect(result[0].endSec).toBe(8)
    expect(result[1].startSec).toBe(8)
    expect(result[1].endSec).toBe(14)
    expect(result[2].endSec).toBe(18)
  })

  it('updateShot: 内容の部分更新ができる', () => {
    const result = updateShot(sampleShots(), 'shot-3', { scene: '新しい場面', editMemo: 'メモ' })
    expect(result[2].scene).toBe('新しい場面')
    expect(result[2].editMemo).toBe('メモ')
    expect(result[2].endSec).toBe(15) // 時間は変わらない
  })

  it('totalSeconds: 全体の秒数を返す', () => {
    expect(totalSeconds(sampleShots())).toBe(15)
    expect(totalSeconds([])).toBe(0)
  })
})
