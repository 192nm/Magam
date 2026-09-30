import { describe, expect, it } from 'vitest';
import {
  buildReport,
  initialStore,
  sampleEntries,
  totalAmount,
  validDate,
  validEntry,
} from '../src/lib/domain';

describe('마감 문구와 금액', () => {
  it('샘플은 실제 마감과 구분하고 시술 금액을 한 번씩 합산한다', () => {
    const store = initialStore();
    store.draft = { date: '2026-09-30', entries: sampleEntries() };
    expect(totalAmount(store.draft.entries)).toBe(198000);
    expect(buildReport(store.draft, store.settings)).toBe(
      '[우리 매장 · 샘플] 2026.09.30 마감\n\n1. 김민지 / 디자인 커트 · 45,000원\n2. 이서연 / 컬러 + 클리닉 · 120,000원\n3. 박지훈 / 남성 커트 · 33,000원\n\n총 3건 · 198,000원\n오늘도 수고하셨습니다.',
    );
  });
  it('0원은 유효하고 누락, 소수, 음수 금액은 확인이 필요하다', () => {
    const entry = sampleEntries()[0];
    expect(validEntry({ ...entry, amount: 0 })).toBe(true);
    for (const amount of [null, -1, 0.5, 100_000_001])
      expect(validEntry({ ...entry, amount })).toBe(false);
    expect(validEntry({ ...entry, name: '  ' })).toBe(false);
  });
  it('간결한 문구에서 번호, 시술명, 인사말을 생략한다', () => {
    const store = initialStore();
    store.draft = {
      date: '2026-09-30',
      entries: [{ ...sampleEntries()[0], source: 'manual', name: '김민지\n고객' }],
    };
    expect(
      buildReport(store.draft, { ...store.settings, compact: true, includeService: false }),
    ).toBe('[우리 매장] 2026.09.30 마감\n\n김민지 고객 · 45,000원\n\n총 1건 · 45,000원');
  });
  it('잘못된 날짜를 거부한다', () => {
    expect(validDate('2026-02-30')).toBe(false);
    expect(validDate('2026-09-30')).toBe(true);
    expect(validDate('2026-2-3')).toBe(false);
  });
});
