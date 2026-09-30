import { expect, test } from '@playwright/test';

test('샘플 체험에서 문구 생성, 저장, 기록 검색, 재접속까지', async ({
  page,
  context,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '오늘의 마감, 가볍게 끝내세요.' })).toBeVisible();
  await expect(page.getByRole('button', { name: '마감 문구 만들기', exact: true })).toBeDisabled();
  await page.screenshot({ path: `test-results/${testInfo.project.name}-home.png`, fullPage: true });
  await page.getByRole('button', { name: '샘플로 체험하기' }).click();
  await expect(page.locator('.summary-total')).toHaveText('198,000원');
  await page.getByRole('button', { name: '마감 문구 만들기', exact: true }).click();
  await expect(page.getByLabel('공유할 마감 문구')).toContainText('총 3건 · 198,000원');
  await expect(page.getByLabel('공유할 마감 문구')).toContainText('샘플');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: '텍스트 복사', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toContain('총 3건 · 198,000원');
  await page.getByRole('button', { name: '기록 저장', exact: true }).click();
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await page.goto('/#history');
  await expect(page.locator('.history-item')).toHaveCount(1);
  await page.getByLabel('마감 기록 검색').fill('김민지');
  await expect(page.locator('.history-item')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('.history-item')).toHaveCount(1);
  await page.locator('.history-item').click();
  await expect(page.getByLabel('저장된 마감 문구')).toContainText('김민지');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '텍스트 파일 다운로드' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^Magam-Beauty-\d{4}-\d{2}-\d{2}\.txt$/);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  expect(errors).toEqual([]);
});

test('직접 입력은 빈 이름과 금액을 막고 설정을 문구에 반영한다', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '직접 추가', exact: true }).click();
  await page.getByLabel('1번 이름', { exact: true }).fill('김테스트');
  await expect(page.getByRole('button', { name: '마감 문구 만들기', exact: true })).toBeDisabled();
  await page.getByLabel('1번 시술금액').fill('55000');
  await page.getByLabel('1번 시술 내용').fill('디자인 커트');
  await page.goto('/#settings');
  await page.getByLabel('매장 이름', { exact: true }).fill('마감 뷰티 성수점');
  await page.getByRole('switch', { name: /시술 내용 포함/ }).uncheck();
  await page.getByRole('switch', { name: /간결한 문구/ }).check();
  await page.goto('/#today');
  await page.getByRole('button', { name: '마감 문구 만들기', exact: true }).click();
  await expect(page.getByLabel('공유할 마감 문구')).toContainText('마감 뷰티 성수점');
  await expect(page.getByLabel('공유할 마감 문구')).toContainText('김테스트 · 55,000원');
  await expect(page.getByLabel('공유할 마감 문구')).not.toContainText('디자인 커트');
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await page.getByRole('button', { name: '새 마감', exact: true }).click();
  await page.getByRole('button', { name: '새 마감 시작', exact: true }).click();
  await expect(page.locator('.entry-row')).toHaveCount(0);
});

test('영수증 업로드 오류를 표시하고 미확인 OCR 금액을 검토하게 한다', async ({ page }) => {
  await page.goto('/');
  // Stub only the paid provider boundary: file selection, canvas processing, UI review and reporting remain real.
  await page.route('**/api/receipts/extract', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        entries: [{ name: '', service: '컬러', amount: null, needsReview: true }],
        warnings: ['이름과 금액을 확인해 주세요.'],
      }),
    });
  });
  const png = await page.locator('.receipt-illustration').screenshot();
  await page
    .getByLabel('영수증 사진 선택', { exact: true })
    .setInputFiles({ name: 'receipt.png', mimeType: 'image/png', buffer: png });
  await expect(page.locator('.entry-row')).toHaveCount(1);
  await expect(page.getByRole('button', { name: '마감 문구 만들기', exact: true })).toBeDisabled();
  await page.getByLabel('1번 이름', { exact: true }).fill('이테스트');
  await page.getByLabel('1번 시술금액').fill('80000');
  await expect(page.getByRole('button', { name: '마감 문구 만들기', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '전체 확인', exact: true }).click();
  await expect(page.getByRole('button', { name: '마감 문구 만들기', exact: true })).toBeEnabled();
  await page.unroute('**/api/receipts/extract');
  await page
    .getByLabel('영수증 사진 선택', { exact: true })
    .setInputFiles({ name: 'bad.txt', mimeType: 'text/plain', buffer: Buffer.from('invalid') });
  await expect(page.locator('.upload-item.error')).toContainText('JPG, PNG, WEBP');
});
