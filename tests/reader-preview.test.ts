import assert from 'node:assert/strict';
import test from 'node:test';
import {previewZoom} from '../src/lib/reader-preview';
test('preview fits the space remaining beside settings and expands when settings close',()=>{const sidebar=previewZoom(200,760,794),full=previewZoom(200,1120,794);assert.equal(sidebar.percent,91);assert.equal(full.percent,137);assert.ok(sidebar.percent/100*794<=760-32);assert.equal(previewZoom(60,1120,794).percent,60);});
test('preview limits remain valid on narrow screens',()=>{for(const width of [120,240,320,768,1920]){const zoom=previewZoom(200,width,794);assert.ok(zoom.minimum<=zoom.maximum);assert.ok(zoom.percent>=zoom.minimum);assert.ok(zoom.percent<=zoom.maximum);}});
