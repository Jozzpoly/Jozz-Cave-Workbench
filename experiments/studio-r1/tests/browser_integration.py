"""Studio R1 contract-harness smoke test. Not the full compiled Jaskinia."""
from pathlib import Path
from tempfile import TemporaryDirectory
from playwright.sync_api import sync_playwright
import json, os

ROOT = Path(__file__).resolve().parents[3] / 'src' / 'jaskinia'
model = (ROOT / '59a-studio-r1-model.js').read_text(encoding='utf-8')
host = (ROOT / '59b-studio-r1-host.js').read_text(encoding='utf-8')
shell = """
const mem = /*MEMORY*/;
Object.defineProperty(window, 'localStorage', {configurable:true, value:{
  getItem(k){return Object.hasOwn(mem,k)?mem[k]:null},
  setItem(k,v){mem[k]=String(v)}, removeItem(k){delete mem[k]}
}});
window.__memory=mem;
window.errors=[];window.addEventListener('error',e=>window.errors.push(e.message));
window.types={};window.views=[];
function openType(kind,opts={}){
 const type=window.types[kind];if(!type)throw Error('unknown type '+kind);
 const panel=document.createElement('div');panel.className='panel';
 const header=document.createElement('header');header.textContent=type.name;
 const content=document.createElement('div');content.className='body';panel.append(header,content);
 document.querySelector('#host').append(panel);
 let ds=[];const ctx={win:{st:opts.st||{}},size:{w:panel.clientWidth,h:panel.clientHeight},onDispose(f){ds.push(f)},openType};
 function draw(){for(const f of ds)f();ds=[];content.replaceChildren();type.render(content,ctx)}
 draw();const view={kind,panel,draw,close(){for(const f of ds)f();panel.remove();window.views.splice(window.views.indexOf(view),1)}};
 window.views.push(view);return view;
}
window.Jaskinia={ext:{type(k,d){window.types[k]=d},open:openType}};
"""
html = f"""<!doctype html><html lang="pl"><head><meta charset="utf-8"/><style>
body{{margin:0;color:#eee;background:#182236;font-family:system-ui}}
#host{{display:grid;grid-template-columns:repeat(auto-fit,minmax(310px,1fr));gap:8px;padding:8px}}
.panel{{border:2px solid #526687;min-width:0;min-height:380px}}
.panel>header{{padding:8px}} .body{{height:520px}}
</style></head><body><main id="host"></main><script>
{shell}
{model}
{host}
openType('studio-r1-painter');
</script></body></html>"""

with TemporaryDirectory() as td, sync_playwright() as p:
    executable = os.getenv('CHROMIUM_BINARY') or ('/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None)
    args = ['--no-sandbox', '--disable-dev-shm-usage'] if executable else []
    b = p.chromium.launch(executable_path=executable, headless=True, args=args)
    page = b.new_page(viewport={'width':1350,'height':860}, accept_downloads=True)
    page.set_default_timeout(5000)
    page.set_content(html.replace('/*MEMORY*/','{}'))
    assert page.evaluate('Object.keys(types).length') == 2
    page.get_by_role('button',name='Otwórz obserwator').click()
    assert page.locator('[data-studio-r1="observer"]').count() == 1
    canvas = page.locator('[data-studio-r1="painter"] canvas')
    r = canvas.bounding_box()
    x = r['x']+r['width']*2.5/24; y = r['y']+r['height']*2.5/24
    page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+r['width']/12,y);page.mouse.up()
    assert 'rewizja 1' in page.locator('[data-studio-r1="observer"]').inner_text()
    page.locator('[data-studio-r1="painter"]').get_by_role('button',name='Cofnij').click()
    assert 'rewizja 2' in page.locator('[data-studio-r1="observer"]').inner_text()
    page.locator('[data-studio-r1="painter"]').get_by_role('button',name='Ponów').click()
    assert 'rewizja 3' in page.locator('[data-studio-r1="observer"]').inner_text()
    page.evaluate("views.find(v=>v.kind==='studio-r1-painter').close()")
    page.locator('[data-studio-r1="observer"]').get_by_role('button',name='Otwórz edytor').click()
    assert 'rewizja 3' in page.locator('[data-studio-r1="painter"]').inner_text()
    memory=page.evaluate('window.__memory')
    assert memory.get('jaskinia-studio-r1:demo:1')
    page.close()
    page=b.new_page(viewport={'width':1350,'height':860}, accept_downloads=True)
    page.set_content(html.replace('/*MEMORY*/',json.dumps(memory)))
    assert 'rewizja 3' in page.locator('[data-studio-r1="painter"]').inner_text()
    page.get_by_role('button',name='Otwórz obserwator').click()
    with page.expect_download() as download:
        page.locator('[data-studio-r1="painter"]').get_by_role('button',name='Eksport JSON').click()
    out=Path(td)/'doc.json';download.value.save_as(out)
    saved=json.loads(out.read_text());assert saved['revision']==3 and len(saved['pixels'])==576
    page.locator('[data-studio-r1="painter"] input[type=file]').set_input_files(str(out))
    assert 'rewizja 3' in page.locator('[data-studio-r1="observer"]').inner_text()
    page.set_viewport_size({'width':390,'height':844})
    page.evaluate('views.forEach(v=>v.draw())')
    assert 'rewizja 3' in page.locator('[data-studio-r1="observer"]').inner_text()
    assert page.evaluate('window.errors') == []
    b.close()
print('PASS: Studio R1 contract host, two views, drawing, history, lifecycle, fake reload, export, phone size')
