import test from 'node:test';
import assert from 'node:assert/strict';
import {messageDateTimeValue,messageDateTimeTimestamp} from '../src/lib/message-datetime';
test('message dates use Zurich time and save UTC in winter and summer',()=>{
 assert.equal(messageDateTimeTimestamp('2025-11-25T14:03'),'2025-11-25T13:03:00.000Z');
 assert.equal(messageDateTimeTimestamp('2026-07-20T14:03'),'2026-07-20T12:03:00.000Z');
 assert.equal(messageDateTimeValue('2026-07-20T12:03:00Z'),'2026-07-20T14:03');
 assert.equal(messageDateTimeValue('25.11.25, 14:03:12'),'2025-11-25T14:03');
});
test('date editor rejects empty, invalid and nonexistent daylight-saving times',()=>{
 assert.equal(messageDateTimeTimestamp(''),'');
 assert.equal(messageDateTimeTimestamp('2026-02-30T14:00'),'');
 assert.equal(messageDateTimeTimestamp('2026-03-29T02:30'),'');
 assert.equal(messageDateTimeTimestamp('2026-03-29T03:30'),'2026-03-29T01:30:00.000Z');
});
