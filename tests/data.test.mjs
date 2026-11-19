import { test } from 'node:test';
import assert from 'node:assert/strict';
import { username, profileName, fileKind, parseExport, assemble, emptySnapshot, ready, insights, compare, csv, demoSnapshots } from '../data.js';
const record = (name, timestamp = 1700000000) => ({ string_list_data: [{ value: name, href: `https://www.instagram.com/${name}/`, timestamp }] });
const parse = (names, kind = 'followers') => parseExport(JSON.stringify(kind === 'following' ? { relationships_following: names.map(name => record(name)) } : names.map(name => record(name))), kind + '.json');
test('official JSON shapes, BOM, normalization and split-file deduplication', () => {
  const first = parseExport('\uFEFF' + JSON.stringify([record('Alex'), record('alex'), record('b')]), 'followers_1.json');
  const snapshot = assemble(new Map([['1', first], ['2', parse(['b', 'c'])], ['3', parse(['alex', 'd'], 'following')]]));
  assert.equal(snapshot.followers.size, 3); assert.equal(snapshot.following.size, 2); assert.ok(ready(snapshot));
  assert.equal(first.accounts.get('alex').timestamp, 1700000000);
  assert.deepEqual(insights(snapshot).notBack.map(row => row.username), ['d']);
  assert.deepEqual(insights(snapshot).fans.map(row => row.username), ['b', 'c']);
  assert.deepEqual(insights(snapshot).mutual.map(row => row.username), ['alex']);
});
test('following supports title-only and href-only records', () => {
  const result = parseExport(JSON.stringify({ relationships_following: [{ title: 'Title.Name', string_list_data: [] }, { string_list_data: [{ href: 'https://www.instagram.com/_u/Other.Name' }] }] }), 'following.json');
  assert.deepEqual([...result.accounts.keys()], ['title.name', 'other.name']);
});
test('HTML reads profile anchors without loading scripts or remote resources', () => {
  const html = '<html><h1>Followers</h1><img src="https://tracker.invalid/pixel"><script>throw Error("must not run")</script><a href="https://www.instagram.com/alpha/?a=1&amp;b=2">Alpha</a><a href="https://www.instagram.com/_u/Beta">Beta</a><a href="https://instagram.com.evil.test/notreal">bad</a><a href="javascript:alert(1)">bad</a></html>';
  assert.deepEqual([...parseExport(html, 'followers_2.html').accounts.keys()], ['alpha', 'beta']);
});
test('malformed, mismatched and unknown exports reject instead of giving false results', () => {
  for (const [text, file] of [['{', 'followers.json'], ['{}', 'followers.json'], ['{}', 'pending_follow_requests.json'], ['{"relationships_following":[]}', 'followers.json'], ['<html><h1>Following</h1></html>', 'followers.html'], [JSON.stringify([{}]), 'followers.json'], ['<html>random</html>', 'followers.html']]) assert.throws(() => parseExport(text, file));
});
test('genuinely empty exports are valid, incomplete snapshots stay unready', () => {
  assert.ok(!ready(emptySnapshot()));
  assert.ok(!ready(assemble(new Map([['a', parse([])]]))));
  assert.ok(ready(assemble(new Map([['a', parse([])], ['b', parse([], 'following')]]))));
  assert.equal(parseExport('<html><h1>Followers</h1></html>', 'followers.html').accounts.size, 0);
});
test('historical changes use set differences in the correct direction', () => {
  const snapshot = (f, g) => assemble(new Map([['a', parse(f)], ['b', parse(g, 'following')]]));
  const diff = compare(snapshot(['same', 'new'], ['same', 'new']), snapshot(['same', 'old'], ['same', 'old']));
  assert.deepEqual(diff.lost.map(row => row.username), ['old']); assert.deepEqual(diff.gained.map(row => row.username), ['new']);
  assert.deepEqual(diff.unfollowed.map(row => row.username), ['old']); assert.deepEqual(diff.followed.map(row => row.username), ['new']);
});
test('profile names and file paths are constrained', () => {
  assert.equal(username('<script>'), null); assert.equal(profileName('https://evil.test/name/'), null); assert.equal(profileName('https://instagram.com/p/photo/'), null);
  assert.equal(profileName('javascript:alert(1)'), null); assert.equal(fileKind('connections/followers_and_following/followers_12.json'), 'followers');
  assert.equal(fileKind('close_friends.json'), null);
});
test('CSV quotes fields, uses CRLF and guards spreadsheet formulas', () => {
  const output = csv([{ username: 'alpha' }], '=formula');
  assert.ok(output.startsWith('\uFEFF"username"')); assert.ok(output.includes('\r\n')); assert.ok(output.includes('"\'=formula"'));
  assert.ok(output.includes('https://www.instagram.com/alpha/'));
});
test('large lists remain accurate and demo set counts are coherent', () => {
  const many = Array.from({ length: 20000 }, (_, i) => 'account.' + i);
  assert.equal(parse(many).accounts.size, 20000);
  const { current, previous } = demoSnapshots();
  const result = insights(current);
  assert.equal(current.followers.size, 18); assert.equal(result.notBack.length, 6); assert.equal(result.mutual.length, 12); assert.equal(result.fans.length, 6);
  assert.equal(compare(current, previous).lost.length, 2);
});
