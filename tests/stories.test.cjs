const assert=require('node:assert/strict');
const {parseStories,storiesPrompt}=require('../desktop/stories.cjs');
const files=[{path:'src/auth.ts',content:'checkToken();\nreturn user;'}];
const story={title:'登入',summary:'驗證權杖後取得使用者',diagram:'sequence',level:'Container',trigger:'登入請求',uncertainty:'外部 IdP 行為未知',steps:[{title:'驗證',description:'檢查權杖',evidence:[{path:'src/auth.ts',startLine:1,endLine:1}]},{title:'回傳',description:'回傳使用者',evidence:[{path:'src/auth.ts',startLine:2,endLine:2}]}]};
const result=parseStories(JSON.stringify({stories:[story]}),files);
assert.equal(result[0].steps[0].evidence[0].excerpt,'checkToken();');
assert.equal(result[0].steps[1].evidence[0].excerpt,'return user;');
assert.deepEqual(parseStories('{"stories":[]}',files),[]);
for(const reference of [{path:'../secret',startLine:1,endLine:1},{path:'src/auth.ts',startLine:0,endLine:1},{path:'src/auth.ts',startLine:1,endLine:9},{path:'src/auth.ts',startLine:2,endLine:1}]){
 const bad=structuredClone(story);bad.steps[0].evidence=[reference];assert.throws(()=>parseStories(JSON.stringify({stories:[bad]}),files));
}
assert.throws(()=>parseStories(JSON.stringify({stories:[{...story,steps:[]}]}),files));
assert.throws(()=>parseStories('not json',files));
assert.throws(()=>parseStories(JSON.stringify({stories:Array(7).fill(story)}),files));
assert.match(storiesPrompt({prompt:'探索登入'},files),/1: checkToken/);
assert.match(storiesPrompt({prompt:'探索登入'},files),/探索登入/);
console.log('Story evidence paths, line bounds, excerpts, empty result and output limits passed.');
