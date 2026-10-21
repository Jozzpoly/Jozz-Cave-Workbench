// Deterministic counterexample against the EXACT source function from Opus's v6.4 commit.
// No Jaskinia product files or Owner assets modified. All nodes below are deliberately synthetic.
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
const sha='fd93caabf91a98fd8a32cc34815b78a8e7f61183';
const filename='src/jaskinia/57b-ruch.js';
const source=execFileSync('git',['show',sha+':'+filename],{encoding:'utf8',maxBuffer:8<<20});
const start=source.indexOf('const ruchName =');
const finish=source.indexOf('const ruchClean =',start);
if(start<0||finish<0)throw Error('Exact v6.4 function block not found');
const real=source.slice(start,finish);
const {ruchFind,ruchPathOf,ruchNames}=vm.runInNewContext(real+'\n({ruchFind,ruchPathOf,ruchNames})');
let pass=0,fail=0;
const check=(ok,msg,payload)=>{console.log(ok?'PASS':'FAIL',msg,JSON.stringify(payload));ok?pass++:fail++};
const item=(name,identity)=>({name,identity,children:[],parent:null});
const inner=(...children)=>{const root=item('ROOT','root');root.children=children;children.forEach(c=>{c.parent=root});return root};

const old=inner(item('Wheel','left'),item('Wheel','right'));
const before=old.children[0];
const namePath=ruchNames(old,before),numericPath=ruchPathOf(old,before);
check(JSON.stringify(namePath)==='["Wheel"]'&&numericPath==='0','baseline: author chose first of two identically named wheels',{namePath,numericPath});

const swapped=inner(item('Wheel','right'),item('Wheel','left'));
const transferred=ruchFind(swapped,namePath,numericPath);
check(transferred?.identity==='right','actual v6.4 algorithm silently assigns saved left-wheel intent to right after sibling reorder',{expected:'left',found:transferred?.identity,path:numericPath,names:namePath});

const inserted=inner(item('Decoration','decor'),item('Wheel','right'),item('Wheel','left'));
const transferred2=ruchFind(inserted,namePath,numericPath);
check(transferred2?.identity==='right','name fallback after index shift also chooses wrong identical sibling',{expected:'left',found:transferred2?.identity});

const uniqueOld=inner(item('Wheel_Left','left'),item('Wheel_Right','right'));
const uniquePath=ruchPathOf(uniqueOld,uniqueOld.children[0]);
const uniqueNames=ruchNames(uniqueOld,uniqueOld.children[0]);
const uniqueNew=inner(item('Extra','decor'),item('Wheel_Right','right'),item('Wheel_Left','left'));
const positive=ruchFind(uniqueNew,uniqueNames,uniquePath);
check(positive?.identity==='left','unique names correctly rescue stable semantic identity after index shift',{wanted:'left',found:positive?.identity,uniquePath,uniqueNames});

const deleted=inner(item('Wheel_Right','right'));
check(ruchFind(deleted,uniqueNames,uniquePath)===null,'missing unambiguous part is not falsely assigned to a different name',{uniqueNames});

console.log('RUCH_IDENTITY_GATE',JSON.stringify({pass,fail,sourceSha:sha.slice(0,12),sourceFile:filename}));
if(fail)process.exitCode=1;