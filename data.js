// Pure parsing and set operations. No networking, persistence, or Instagram API.
export function username(value) {
  if (typeof value !== 'string') return null;
  const name = value.trim().replace(/^@/, '').toLowerCase();
  return /^[a-z0-9._]{1,30}$/.test(name) ? name : null;
}

export function profileName(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !['instagram.com', 'www.instagram.com'].includes(url.hostname)) return null;
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0] === '_u') parts.shift();
    return parts.length === 1 ? username(decodeURIComponent(parts[0])) : null;
  } catch { return null; }
}

export function fileKind(path) {
  const name = path.replaceAll('\\', '/').split('/').pop();
  if (/^followers(?:_\d+)?\.(?:json|html?)$/i.test(name)) return 'followers';
  if (/^following(?:_\d+)?\.(?:json|html?)$/i.test(name)) return 'following';
  return null;
}

function timestamp(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 && number <= 8640000000000 ? number : null;
}

function decode(value) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt);/gi, (whole, entity) => {
    const known = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' };
    if (known[entity.toLowerCase()]) return known[entity.toLowerCase()];
    const number = entity.toLowerCase().startsWith('#x') ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    return number > 0 && number <= 0x10ffff ? String.fromCodePoint(number) : whole;
  });
}

export function parseExport(text, filename) {
  const kind = fileKind(filename);
  if (!kind) throw new Error('Choose followers_1.json / followers.html and following.json / following.html. Unzip your export first.');
  const accounts = new Map();
  let skipped = 0;
  const add = (name, time) => {
    if (!name) { skipped++; return; }
    if (!accounts.has(name)) accounts.set(name, { username: name, timestamp: timestamp(time) });
  };
  if (/\.json$/i.test(filename)) {
    let data;
    try { data = JSON.parse(text.replace(/^\uFEFF/, '')); }
    catch { throw new Error('This JSON file is damaged or incomplete. Try downloading the export again.'); }
    const key = kind === 'following' ? 'relationships_following' : 'relationships_followers';
    const opposite = kind === 'following' ? 'relationships_followers' : 'relationships_following';
    if (data && typeof data === 'object' && !Array.isArray(data) && opposite in data) throw new Error('The contents do not match the filename. Use the original export filenames.');
    const rows = Array.isArray(data) ? data : data?.[key];
    if (!Array.isArray(rows)) throw new Error('Unrecognized Instagram format. Select the original followers and following files.');
    for (const row of rows) {
      if (!row || typeof row !== 'object') { skipped++; continue; }
      const entries = row.string_list_data;
      if (Array.isArray(entries) && entries.length) {
        for (const entry of entries) add(username(entry?.value) || profileName(entry?.href) || (kind === 'following' ? username(row.title) : null), entry?.timestamp);
      } else if (kind === 'following' && username(row.title)) add(username(row.title), null);
      else skipped++;
    }
  } else {
    // Read only anchor text/attributes. Never insert or parse a full untrusted
    // HTML document: exported images, scripts and resources must never load.
    if (!/<html\b|<!doctype\s+html/i.test(text)) throw new Error('This is not a complete Instagram HTML export. Choose the original file.');
    const heading = [...text.matchAll(/<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/gi)].map(m => m[1].replace(/<[^>]*>/g, '').trim().toLowerCase());
    if ((kind === 'following' && heading.includes('followers')) || (kind === 'followers' && heading.includes('following'))) throw new Error('The HTML heading does not match the filename. Use the original export files.');
    let anchors = 0;
    for (const match of text.matchAll(/<a\b([^>]*?)>([\s\S]*?)<\/a\s*>/gi)) {
      const href = match[1].match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
      if (!href) continue;
      const name = profileName(decode(href[1] ?? href[2]));
      if (name) { anchors++; add(name, null); }
    }
    if (!anchors && !heading.includes(kind)) throw new Error('No Instagram accounts found. Check that this is the correct followers or following file.');
  }
  if (skipped) throw new Error(`${skipped} account record(s) could not be read. To avoid misleading results, this file was not imported. Try a fresh JSON export.`);
  return { kind, accounts };
}

export function emptySnapshot() {
  return { followers: new Map(), following: new Map(), files: new Map(), loaded: new Set() };
}

export function assemble(files) {
  const result = emptySnapshot();
  result.files = files;
  for (const file of files.values()) {
    result.loaded.add(file.kind);
    for (const [name, account] of file.accounts) result[file.kind].set(name, account);
  }
  return result;
}

export function ready(snapshot) { return snapshot.loaded.has('followers') && snapshot.loaded.has('following'); }
const difference = (a, b) => [...a.values()].filter(account => !b.has(account.username));
export function insights(snapshot) {
  const { followers, following } = snapshot;
  return {
    notBack: difference(following, followers),
    fans: difference(followers, following),
    mutual: [...following.values()].filter(account => followers.has(account.username)),
    following: [...following.values()], followers: [...followers.values()],
  };
}

export function compare(current, previous) {
  return {
    lost: difference(previous.followers, current.followers),
    gained: difference(current.followers, previous.followers),
    unfollowed: difference(previous.following, current.following),
    followed: difference(current.following, previous.following),
  };
}

export function csv(rows, category) {
  const quote = value => {
    let text = String(value ?? '');
    if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return '\uFEFF' + [['username', 'profile_url', 'category'], ...rows.map(row => [row.username, `https://www.instagram.com/${row.username}/`, category])].map(row => row.map(quote).join(',')).join('\r\n');
}

export function demoSnapshots() {
  const names = ['alex.travels', 'mila.studio', 'jasper.jpg', 'the.weekend.edit', 'olivia.writes', 'noah.wav', 'luna.archive', 'kai.creates', 'flora.film', 'leo.and.light', 'sophie.design', 'jules.coffee', 'river.reads', 'ava.outdoors', 'elliot.frames', 'the.slow.morning', 'rowan.sketch', 'isla.cooks', 'finn.music', 'ivy.grows', 'arden.walks', 'maya.makes', 'nora.notes', 'owen.runs'];
  const map = list => new Map(list.map(name => [name, { username: name, timestamp: null }]));
  const make = (followers, following) => ({ followers: map(followers), following: map(following), loaded: new Set(['followers', 'following']), files: new Map() });
  return {
    current: make([...names.slice(0, 12), ...names.slice(18)], names.slice(0, 18)),
    previous: make([...names.slice(0, 10), names[14], names[15], ...names.slice(18, 22)], names.slice(0, 16)),
  };
}
