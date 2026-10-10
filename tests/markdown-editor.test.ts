import test from "node:test";
import assert from "node:assert/strict";
import {clipboardMarkdown,formatMarkdown} from "../src/lib/markdown-editor";
import {prepareEntries, type Entry} from "../src/lib/archive";

test("Teams rich text retains styled emphasis, lists, links and paragraphs as Markdown",()=>{
  const result=clipboardMarkdown('<html><body><!--StartFragment--><p><span style="font-weight:700">Important</span> <span style="font-style:italic">words</span></p><ul><li>First</li><li><strong>Second</strong></li></ul><p><a href="https://example.com/story">Read more</a></p><blockquote>A quotation</blockquote><!--EndFragment--></body></html>');
  assert.match(result,/\*\*Important\*\*/);assert.match(result,/\*words\*/);
  assert.match(result,/-\s+First/);assert.match(result,/-\s+\*\*Second\*\*/);
  assert.match(result,/\[Read more\]\(https:\/\/example.com\/story\)/);assert.match(result,/> A quotation/);
});
test("rich paste removes executable markup and unsafe links, and retains tables",()=>{
  const result=clipboardMarkdown('<script>alert(1)</script><style>evil</style><p><a href="javascript:alert(1)">Safe text</a></p><table><tr><th>Name</th><th>Words</th></tr><tr><td>Alice</td><td><strong>Bold</strong> | text</td></tr></table>');
  assert.doesNotMatch(result,/alert|javascript|<script|<style|evil/);
  assert.match(result,/Safe text/);assert.match(result,/\| Name \| Words \|/);
  assert.match(result,/\| --- \| --- \|/);assert.match(result,/\*\*Bold\*\*/);assert.match(result,/\\\| text/);
});
test("formatting preserves surrounding text and expands selected lines correctly",()=>{
  const bold=formatMarkdown("Before words after",7,12,"bold");
  assert.equal(bold.value,"Before **words** after");assert.equal(bold.value.slice(bold.start,bold.end),"words");
  assert.equal(formatMarkdown("First\nSecond\nLast",2,10,"bullet").value,"- First\n- Second\nLast");
  assert.equal(formatMarkdown("",0,0,"heading").value,"## text");
  const code=formatMarkdown("",0,0,"code");assert.equal(code.value.slice(code.start,code.end),"code");
});
test("HTML examples inside Markdown code blocks survive story preparation",()=>{
  const content="```html\n<p><strong>Hello</strong></p>\n```";
  const entry={id:"story",type:"single",title:"Code",score:0,reason:"",source:"LoreKeeper",messages:[{id:"message",author:"Author",timestamp:"2026-10-11",source:"LoreKeeper",sourceFormat:"markdown",content}]} satisfies Entry;
  assert.equal(prepareEntries([entry])[0].messages[0].content,content);
});

test("inline code survives semantic and Office monospace paste, including backticks",()=>{
  assert.equal(clipboardMarkdown('<p>Say <code>HELLO BITCOIN</code>.</p>'),'Say `HELLO BITCOIN`.');
  assert.equal(clipboardMarkdown('<p><span style="font-family:Consolas, monospace">HELLO BITCOIN</span></p>'),'`HELLO BITCOIN`');
  assert.equal(clipboardMarkdown('<code>a`b</code>'),'`` a`b ``');
  assert.equal(clipboardMarkdown('<p><del>Removed</del></p>'),'~~Removed~~');
});
test("imported HTML preserves inline code and styled emphasis in the reader",()=>{
  const entry={id:"story",type:"single",title:"Code",score:0,reason:"",source:"LoreKeeper",messages:[{id:"message",author:"Author",timestamp:"2026-10-11",source:"LoreKeeper",sourceFormat:"html",content:'<code>HELLO BITCOIN</code>',original:'<p><span style="font-weight:700">Say</span> <code>HELLO BITCOIN</code></p>'}]} satisfies Entry;
  const message=prepareEntries([entry])[0].messages[0];
  assert.equal(message.content,'`HELLO BITCOIN`');
  assert.equal(message.presentation,'**Say** `HELLO BITCOIN`');
});
