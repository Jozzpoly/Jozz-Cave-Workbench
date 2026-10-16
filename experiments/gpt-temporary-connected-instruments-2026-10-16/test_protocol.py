"""Real Chromium, HTTP+opaque sandbox, two independently wired Jaskinia panes.
Not a full project-UI acceptance test. Run: python test_protocol.py
"""
import json, os
from pathlib import Path
from playwright.sync_api import sync_playwright

HERE=Path(__file__).resolve().parent
results={}
with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'],headless=True)
  page=browser.new_page(viewport={'width':1200,'height':850})
  errors=[]
  page.on('pageerror',lambda e: errors.append(str(e)))
  html=(HERE/'harness.html').read_text().replace('<head>','<head><base href="https://jaskinia.invalid/">',1).replace('<script src="./42-gpt-temp-instrument.js"></script>','<script>'+ (HERE/'42-gpt-temp-instrument.js').read_text() + '</script>')
  page.set_content(html,wait_until='load')
  panes=page.locator('.pane')
  results['registered_in_shell'] = page.evaluate("!!TYPES.gpt_instrument_temp && !!window.__JASK_GPT_TEMP")
  assert results['registered_in_shell']
  # Sandbox srcdoc runs real child JS without network access; the browser blocks local HTTP in this environment.
  page.evaluate('(html) => [...document.querySelectorAll(".gpti iframe")].forEach(f => f.srcdoc = html)', (HERE/'adapter.html').read_text())
  for i in range(2):
    panes.nth(i).get_by_role('button',name='Połącz z wyborem projektu').click()
  page.wait_for_function('window.__JASK_GPT_TEMP.list().length===2 && window.__JASK_GPT_TEMP.list().every(s=>s.lastAck?.project==="Mini_Feniks")',timeout=10000)
  results['two_frames_ACK_initial']=True
  page.locator('#select-b').click()
  page.wait_for_function('window.__JASK_GPT_TEMP.list().every(s=>s.lastAck?.project==="ReflexBrain-Lab")',timeout=10000)
  results['two_frames_follow_selection']=True
  page.screenshot(path=str(HERE/'two-instruments.png'),full_page=True)
  # Only A drops the next acknowledgement; the other instrument must still acknowledge.
  panes.nth(0).frame_locator('iframe').get_by_role('button',name='Pomiń następny ACK: OFF').click()
  page.locator('#select-c').click()
  page.wait_for_function('window.__JASK_GPT_TEMP.list().some(s=>s.lastAck?.project==="Combat-Lab")',timeout=5000)
  page.wait_for_timeout(2050)
  snaps=page.evaluate('window.__JASK_GPT_TEMP.list()')
  assert any('timeout' in ' '.join(s['history']) for s in snaps)
  assert len([s for s in snaps if s['lastAck']['project']=='Combat-Lab'])==1
  results['missing_ACK_is_uncertain_no_retry']=True
  results['other_window_independent']=True
  # Attempt false ACK and check the parent rejects it.
  panes.nth(1).frame_locator('iframe').get_by_role('button',name='Wyślij fałszywy/stary ACK').click()
  page.wait_for_timeout(80)
  assert 'Odrzucono przestarzały' in ' '.join(page.evaluate('window.__JASK_GPT_TEMP.list()')[1]['history'])
  results['false_ACK_rejected']=True
  # Private records in the actual full Jaskinia must NEVER be relayed to unknown iframes.
  before=page.evaluate('window.__JASK_GPT_TEMP.list()')
  page.locator('#select-private').click()
  page.wait_for_timeout(100)
  after=page.evaluate('window.__JASK_GPT_TEMP.list()')
  assert all(s['currentProject'] != 'VeryPrivateProject' for s in after)
  assert all(s['lastAck'] == old['lastAck'] for s,old in zip(after,before))
  assert all('Zatrzymano wybór prywatny' in ' '.join(s['history']) for s in after)
  results['private_project_not_disclosed']=True
  # Injection protocol should refuse non-HTTP URLs.
  panes.nth(1).get_by_role('textbox',name='Adres instrumentu').fill('javascript:alert(1)')
  panes.nth(1).get_by_role('button',name='Załaduj instrument').click()
  assert 'Odrzucono adres' in panes.nth(1).locator('[role=status]').inner_text()
  results['dangerous_URL_rejected']=True
  page.locator('#destroy-a').click()
  assert len(page.evaluate('window.__JASK_GPT_TEMP.list()'))==1
  results['dispose_unsubscribes']=True
  assert not errors,errors
  results['page_errors']=errors

  browser.close()
(HERE/'test_results.json').write_text(json.dumps(results,indent=2,ensure_ascii=False),encoding="utf-8")
print(json.dumps(results,indent=2,ensure_ascii=False))
assert all(v is True for k,v in results.items() if k!='page_errors')