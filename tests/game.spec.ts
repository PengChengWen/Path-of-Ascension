import { test, expect, type Page } from '@playwright/test';
async function saved(page: Page) {
  return page.evaluate(
    () =>
      new Promise<Record<string, unknown>>((resolve, reject) => {
        const req = indexedDB.open('path-of-ascension');
        req.onsuccess = () => {
          const db = req.result;
          const r = db.transaction('saves').objectStore('saves').get('current');
          r.onsuccess = () => {
            resolve(r.result.state);
            db.close();
          };
          r.onerror = () => reject(r.error);
        };
        req.onerror = () => reject(req.error);
      }),
  );
}
test('完整试玩流程：奇遇、突破、历练、道侣、构筑、战斗与存档', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '炼气六层', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /查看机缘/ }).click();
  await page.getByRole('button', { name: '静心参悟', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '突破境界', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '突破境界', exact: true }).click();
  await expect(page.getByRole('heading', { name: '炼气七层', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: '炼气七层', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /查看机缘/ })).toHaveCount(0);
  await page.getByRole('button', { name: '山海历练', exact: true }).click();
  await page
    .getByRole('button', { name: /前往历练/ })
    .first()
    .click();
  await expect(page.getByRole('button', { name: /历练中/ })).toBeVisible();
  await page.getByRole('button', { name: '仙缘道侣', exact: true }).click();
  await page.getByRole('button', { name: /结识青禾/ }).click();
  await page.getByRole('button', { name: /送去灵草/ }).click();
  await page.getByRole('button', { name: '邀请同行', exact: true }).click();
  await expect(page.getByRole('button', { name: '暂别同行', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '功法典籍', exact: true }).click();
  await page.getByRole('button', { name: '研习此道', exact: true }).last().click();
  await expect.poll(async () => String((await saved(page)).build)).toBe('ward');
  await page.getByRole('button', { name: '山海历练', exact: true }).click();
  await page.getByRole('button', { name: '挑战妖虎', exact: false }).click();
  await page.getByRole('button', { name: '跳过演出', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '妖雾已散，道心更明', exact: true }),
  ).toBeVisible();
  const afterFight = await saved(page);
  await page.reload();
  await expect(page.getByRole('heading', { name: '洞府修炼', exact: true })).toBeVisible();
  const afterReload = await saved(page);
  expect(afterReload.spirit).toBe(afterFight.spirit);
  expect(afterReload.battleCounter).toBe(1);
  await page.getByRole('button', { name: '设置', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出修行存档', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain('修行存档');
  const snapshot = await saved(page);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: '设置', exact: true }).click();
  page.once('dialog', (d) => d.accept());
  await page
    .locator('input[type=file]')
    .setInputFiles({
      name: 'save.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(snapshot)),
    });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect((await saved(page)).level).toBe(7);
  await page.getByRole('button', { name: '通天塔', exact: true }).click();
  await expect(page.getByText('后期挑战 · 尚未开放')).toBeVisible();
  expect(errors).toEqual([]);
});
test('双标签页只允许一个写入者', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '洞府修炼', exact: true })).toBeVisible();
  const second = await context.newPage();
  await second.goto('/');
  await expect(second.getByText(/当前为只读预览/)).toBeVisible();
  await expect(second.getByRole('button', { name: '开始闭关', exact: true })).toBeDisabled();
  await page.close();
  await second.reload();
  await expect(second.getByRole('button', { name: '开始闭关', exact: true })).toBeEnabled();
});
test('窄屏布局不溢出且主要页面可访问', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '洞府修炼', exact: true })).toBeVisible();
  for (const name of ['山海历练', '功法典籍', '仙缘道侣', '通天塔', '行囊藏珍', '洞府修炼']) {
    await page.getByRole('button', { name, exact: true }).click();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
});
