// One-shot bounded deployment probe, never a release gate or a human play PASS.
// Exercise *real* 2P staging Worker in a unique private Yard. Never print the
// room ID, ActorSession IDs, persisted records or bearer resume tokens.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { chromium } from 'playwright';

const origin = 'https://cloudflare-multiplayer-lab-staging.jozzpoly.workers.dev';
const run = 'j2p' + randomBytes(7).toString('hex'); // 17 chars, private ephemeral Yard
const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist',
    '--disable-background-timer-throttling','--disable-backgrounding-occluded-windows'],
});
const contexts = [];
const faults = [];
const timeout = 70000;
const evidence = async page => page.evaluate(() => {
  const v = window.__sharedYardV0Evidence?.();
  return v ? {
    identity: v.session?.actorSessionId ?? null,
    epoch: v.identity?.worldEpoch ?? null,
    network: v.networkState ?? null,
    guard: v.metrics?.guardMismatches ?? null,
    matches: v.metrics?.guardMatches ?? null,
    authored: v.inputScheduler?.authored ?? 0,
    actors: v.lifecycle?.topology?.actors?.length ?? 0,
    failed: v.runtimeFailed === true,
    position: v.livePhysics?.selfPosition ?? null,
  } : null;
});
const wait = (page, fn, label, ms=timeout) =>
  page.waitForFunction(fn, null, { timeout:ms, polling:200 })
      .catch(() => { throw new Error('probe did not reach ' + label); });

try {
  const launcher = await fetch(origin + '/api/ping', {signal:AbortSignal.timeout(10000)});
  assert.equal(launcher.status, 200, 'staging ping failed');
  const ping=await launcher.json();
  assert.equal(ping.ok,true,'staging ping not OK');
  const link = who => origin + '/world-v0/?run=' + run + '&lifecycle=r0&player=' + who;
  const a = await browser.newContext({viewport:{width:1280,height:800}});
  const b = await browser.newContext({viewport:{width:1280,height:800}});
  contexts.push(a,b);
  const p = await a.newPage();
  const q = await b.newPage();
  for (const [page,who] of [[p,'JaskiniaA'],[q,'JaskiniaB']]) {
    page.on('pageerror',()=>faults.push('script-error'));
    const navigation=await page.goto(link(who),{waitUntil:'domcontentloaded',timeout:30000});
    assert.equal(navigation?.status(),200,'staging page HTTP');
    await page.locator('#enter:not([disabled])').waitFor({timeout:timeout});
    await page.locator('#enter').click();
    await wait(page,()=>!!window.__sharedYardV0Evidence?.()?.session?.actorSessionId,'ActorSession welcome');
  }
  await Promise.all([p,q].map(page=>wait(page,()=>{
    const e=window.__sharedYardV0Evidence?.();
    return e?.networkState?.startsWith('live') && e?.lifecycle?.topology?.actors?.length===2 &&
      e?.metrics?.guardMismatches===0 && e?.metrics?.guardMatches>=5;
  },'two-person live exact physics',90000)));
  const before = await evidence(p);
  const other = await evidence(q);
  assert.ok(before?.identity&&other?.identity&&before.identity!==other.identity, 'not distinct actors');
  assert.ok(before.epoch && before.epoch===other.epoch,'not same world');
  assert.equal(before.guard,0);
  const hasRecord = await p.evaluate(() => {
    const room = new URL(location.href).searchParams.get('run');
    try { return !!JSON.parse(localStorage.getItem('shared-yard-v0-actor-sessions-v1'))?.sessions?.[room]?.resumeToken; }
    catch { return false; }
  });
  assert.equal(hasRecord,true,'no private resume capability written');
  await p.keyboard.down('w');
  await p.waitForTimeout(550);
  await p.keyboard.up('w');
  await p.keyboard.press('Space');
  await wait(p,()=>{
    const e=window.__sharedYardV0Evidence?.();
    return e?.inputScheduler?.authored>=25 && e.metrics?.guardMismatches===0;
  },'post-input canonical activity',30000);
  const beforeClose=await evidence(p);
  assert.ok(beforeClose.authored>before.authored,'no player input authorship after movement');
  const exactAddress=p.url();
  await p.close();
  await q.waitForTimeout(400);
  const reopened=await a.newPage();
  reopened.on('pageerror',()=>faults.push('script-error'));
  await reopened.goto(exactAddress,{waitUntil:'domcontentloaded',timeout:30000});
  await reopened.locator('#enter:not([disabled])').waitFor({timeout:timeout});
  await reopened.locator('#enter').waitFor({timeout:timeout});
  await wait(reopened,()=>document.querySelector('#enter')?.textContent?.includes('Resume'),
    'ordinary same-origin resume offer',20000);
  await reopened.locator('#enter').click();
  await wait(reopened,()=>{
    const e=window.__sharedYardV0Evidence?.();
    return e?.networkState?.startsWith('live') && !!e?.session?.actorSessionId &&
      e?.metrics?.guardMismatches===0 && e?.metrics?.guardMatches>=5;
  },'authority-backed original ActorSession resumed',75000);
  const after=await evidence(reopened);
  assert.equal(after.identity,before.identity,'ActorSession identity changed');
  assert.equal(after.epoch,before.epoch,'WorldEpoch changed');
  assert.equal(after.actors,2,'two-actor topology lost');
  assert.equal(faults.length,0,'browser script errors');
  console.log('JASKINIA_MULTI_2P_DEPLOYED_STAGING_SMOKE_PASS',JSON.stringify({
    deployedWorker:true,privateFixture:true,distinctHumanShapedBrowserActors:true,
    twoLiveActors:true,exactGuardMismatches:after.guard,
    movementAuthored:true,sameActorSessionResume:true,sameWorldEpoch:true,
    reopenedActualAddress:true,browserErrors:0,
    notClaim:'Not an Owner/human play test; Chromium scripted controlled environment',
  }));
} finally {
  for(const context of contexts) await context.close().catch(()=>{});
  await browser.close();
}
