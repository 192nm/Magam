import { expect, test } from '@playwright/test';

test('DB 저장 실패는 브라우저에 저장하지 않고 같은 ID로 재시도한다', async ({ page }) => {
  const ids: string[] = [];
  const records: Record<string, unknown>[] = [];
  await page.route('**/api/health', (route) =>
    route.fulfill({
      json: {
        status: 'ok',
        recognitionAvailable: false,
        accessKeyRequired: true,
        databaseEnabled: true,
        databaseAvailable: true,
      },
    }),
  );
  await page.route('**/api/closing-records**', async (route) => {
    expect(route.request().headers()['x-access-key']).toBe('test-database-key');
    if (route.request().method() === 'POST') {
      const payload = route.request().postDataJSON();
      ids.push(payload.id);
      if (ids.length === 1) {
        await route.fulfill({ status: 503, json: { message: '테스트 DB 연결 오류' } });
        return;
      }
      records.push({
        id: payload.id,
        date: payload.report.date,
        text: '테스트 DB 마감 문구',
        total: 198000,
        count: 3,
        createdAt: new Date().toISOString(),
        sample: true,
      });
      await route.fulfill({ json: records[0] });
    } else if (route.request().method() === 'DELETE') {
      records.length = 0;
      await route.fulfill({ json: { deleted: true } });
    } else {
      await route.fulfill({ json: records });
    }
  });
  await page.goto('/#settings');
  await page.getByLabel('서비스 접속 키', { exact: true }).fill('test-database-key');
  await page.goto('/#today');
  await page.getByRole('button', { name: '샘플로 체험하기' }).click();
  await page.getByRole('button', { name: '마감 문구 만들기', exact: true }).click();
  await page.getByRole('button', { name: '기록 저장', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('테스트 DB 연결 오류');
  await page.getByRole('button', { name: '기록 저장', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('마감 기록을 DB에 저장했어요.');
  expect(ids).toHaveLength(2);
  expect(ids[0]).toBe(ids[1]);
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await page.goto('/#history');
  await expect(page.locator('.history-item')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('.history-item')).toHaveCount(1);
  await page.getByRole('button', { name: '이 브라우저 기록 (0)', exact: true }).click();
  await expect(page.locator('.history-item')).toHaveCount(0);
  await page.getByRole('button', { name: 'DB 기록', exact: true }).click();
  await page.locator('.history-item').click();
  await page.getByRole('button', { name: '이 기록 삭제' }).click();
  await expect(page.locator('.history-item')).toHaveCount(0);
});
