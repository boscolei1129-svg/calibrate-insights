import { parseExport, emptySnapshot, assemble, ready, insights, compare, csv, demoSnapshots } from './data.js';

const $ = id => document.getElementById(id);
const format = number => number.toLocaleString();
const labels = { notBack: 'Not following back', mutual: 'Mutuals', fans: 'Fans', followers: 'Followers', following: 'Following' };
const descriptions = {
  notBack: 'You follow these accounts; they aren’t in your followers export.',
  mutual: 'You follow each other, according to your export.',
  fans: 'These accounts follow you; you don’t follow them back.',
  followers: 'Everyone in your imported followers list.',
  following: 'Everyone in your imported following list.',
};
const changeLabels = { lost: 'No longer in followers', gained: 'New in followers', unfollowed: 'You no longer follow', followed: 'You started following' };
let current = emptySnapshot();
let previous = emptySnapshot();
let demo = false;
let active = 'notBack';
let change = 'lost';
let page = 0;
let currentGeneration = 0;
let previousGeneration = 0;
const PAGE_SIZE = 12;
const MAX_FILE_BYTES = 50 * 1024 * 1024;

function notify(message, error = false) {
  $('notice').textContent = message;
  $('notice').classList.toggle('error', error);
  $('notice').hidden = !message;
}

async function importFiles(fileList, target) {
  const files = [...fileList];
  if (!files.length) return;
  const isCurrent = target === 'current';
  const generation = isCurrent ? ++currentGeneration : ++previousGeneration;
  const stillActive = () => generation === (isCurrent ? currentGeneration : previousGeneration);
  const button = $(isCurrent ? 'choose-current' : 'choose-previous');
  button.disabled = true;
  button.textContent = 'Reading locally…';
  notify('Reading files on your device…');
  try {
    if (files.some(file => file.size > MAX_FILE_BYTES) || files.reduce((total, file) => total + file.size, 0) > MAX_FILE_BYTES * 2) throw new Error('Please select only the followers and following files (up to 50 MB per file, 100 MB per selection).');
    // Commit only after every selected file parses. Failed imports never turn
    // into partial comparisons or silently replace the last valid snapshot.
    const baseline = demo ? emptySnapshot() : (isCurrent ? current : previous);
    const nextFiles = new Map(baseline.files);
    for (const file of files) {
      const parsed = parseExport(await file.text(), file.name);
      if (!stillActive()) return;
      nextFiles.set(file.name.toLowerCase(), { ...parsed, name: file.name });
    }
    if (!stillActive()) return;
    if (demo) { current = emptySnapshot(); previous = emptySnapshot(); demo = false; resetHistoryControls(); }
    if (isCurrent) current = assemble(nextFiles);
    else previous = assemble(nextFiles);
    $('confirm-history').checked = false;
    page = 0;
    render();
    const snapshot = isCurrent ? current : previous;
    const missing = ['followers', 'following'].filter(kind => !snapshot.loaded.has(kind));
    notify(missing.length ? `Files added to ${isCurrent ? 'current' : 'older'} export. Add the ${missing.join(' and ')} file(s) to complete this snapshot.` : `${isCurrent ? 'Current' : 'Older'} export ready. Check that every follower part is included and the export uses All time.`);
  } catch (error) {
    if (stillActive()) notify(`${error.message}\nNothing from this selection was added. Any earlier data is unchanged.`, true);
  } finally {
    if (stillActive()) {
      button.disabled = false;
      button.textContent = isCurrent ? 'Choose files' : 'Choose older files';
    }
    $(isCurrent ? 'current-files' : 'previous-files').value = '';
  }
}

function resetHistoryControls() {
  $('previous-date').value = '';
  $('current-date').value = '';
  $('confirm-history').checked = false;
}

function restoreButtons() {
  $('choose-current').disabled = false;
  $('choose-current').textContent = 'Choose files';
  $('choose-previous').disabled = false;
  $('choose-previous').textContent = 'Choose older files';
}

function loadDemo() {
  currentGeneration++; previousGeneration++;
  ({ current, previous } = demoSnapshots());
  demo = true;
  active = 'notBack'; page = 0; change = 'lost';
  $('search').value = '';
  $('sort').value = 'az';
  $('previous-date').value = '2026-10-01';
  $('current-date').value = '2026-11-01';
  $('confirm-history').checked = true;
  restoreButtons(); render();
  notify('Demo mode · All accounts and dates are illustrative. Choose your own files to start a private analysis.');
}

function clearAll() {
  currentGeneration++; previousGeneration++;
  current = emptySnapshot(); previous = emptySnapshot();
  demo = false; page = 0; active = 'notBack'; change = 'lost';
  $('search').value = ''; $('sort').value = 'az';
  $('current-files').value = ''; $('previous-files').value = '';
  resetHistoryControls(); restoreButtons(); render();
  notify('All imported data has been cleared from this tab. Your original files and downloaded CSVs are unchanged.');
}

function visibleRows() {
  if (!ready(current)) return [];
  const query = $('search').value.trim().replace(/^@/, '').toLowerCase();
  const direction = $('sort').value === 'za' ? -1 : 1;
  return insights(current)[active].filter(row => row.username.includes(query)).sort((a, b) => direction * a.username.localeCompare(b.username));
}

function accountList(rows, relation) {
  const list = document.createElement('ul');
  list.className = 'account-list';
  for (const row of rows) {
    const item = document.createElement('li'); item.className = 'account-row';
    const avatar = document.createElement('span'); avatar.className = 'avatar'; avatar.setAttribute('aria-hidden', 'true'); avatar.textContent = row.username.slice(0, 2).toUpperCase();
    const name = document.createElement('span'); name.className = 'account-name'; name.textContent = '@' + row.username;
    const tag = document.createElement('span'); tag.className = 'relationship-tag'; tag.textContent = relation;
    const link = document.createElement(demo ? 'span' : 'a'); link.className = 'profile-link';
    if (!demo) { link.href = `https://www.instagram.com/${row.username}/`; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.setAttribute('aria-label', `View @${row.username} on Instagram`); }
    link.textContent = demo ? 'Example' : 'View profile';
    item.append(avatar, name, tag, link); list.append(item);
  }
  return list;
}

function showEmpty(title, description, allowDemo = false) {
  const box = document.createElement('div'); box.className = 'empty-state';
  const icon = document.createElement('span'); icon.className = 'empty-orbit'; icon.textContent = '◎'; icon.setAttribute('aria-hidden', 'true');
  const heading = document.createElement('h3'); heading.textContent = title;
  const text = document.createElement('p'); text.textContent = description;
  box.append(icon, heading, text);
  if (allowDemo) { const button = document.createElement('button'); button.className = 'button secondary'; button.textContent = 'Explore the demo'; button.addEventListener('click', loadDemo); box.append(button); }
  $('results').replaceChildren(box);
}

function renderList() {
  for (const button of document.querySelectorAll('[data-list]')) {
    const selected = button.dataset.list === active;
    button.setAttribute('aria-selected', String(selected)); button.tabIndex = selected ? 0 : -1;
  }
  $('results').setAttribute('aria-labelledby', 'tab-' + active);
  const complete = ready(current);
  $('list-subtitle').textContent = complete ? descriptions[active] : 'Add both followers and following to see accurate results.';
  const rows = visibleRows();
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  page = Math.min(page, pages - 1);
  if (!complete) showEmpty(current.loaded.size ? 'One more piece of the picture' : 'Your circle starts here', current.loaded.size ? `Add your ${current.loaded.has('followers') ? 'following' : 'followers'} file(s). Include all parts from the same export.` : 'Add your export to see your connections, or take a look around with demo data.', !current.loaded.size);
  else if (!rows.length) showEmpty($('search').value.trim() ? 'No matching usernames' : 'All clear here', $('search').value.trim() ? 'Try another search or switch to a different list.' : 'There are no accounts in this category in your imported snapshot.');
  else $('results').replaceChildren(accountList(rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), labels[active]));
  $('result-count').textContent = complete ? `${rows.length ? `${format(page * PAGE_SIZE + 1)}–${format(Math.min((page + 1) * PAGE_SIZE, rows.length))} of ` : ''}${format(rows.length)} accounts${demo ? ' · Demo' : ''}` : 'Ready when you are';
  $('page-label').textContent = complete && rows.length ? `${page + 1} / ${pages}` : '';
  $('prev-page').disabled = !complete || page === 0;
  $('next-page').disabled = !complete || page >= pages - 1;
  $('export-csv').disabled = !complete || !rows.length;
}

function renderFiles() {
  $('file-details').hidden = demo || !current.files.size;
  $('file-list').replaceChildren();
  for (const file of current.files.values()) {
    const li = document.createElement('li'); li.textContent = `${file.name} · ${format(file.accounts.size)} ${file.kind}`; $('file-list').append(li);
  }
  const summary = demo ? 'Demo data · Two illustrative snapshots' : current.loaded.size ? `${current.files.size} current file(s) · ${ready(current) ? 'Both lists loaded' : 'Snapshot incomplete'} · Kept in this tab only` : 'No export loaded yet';
  $('dataset-label').textContent = summary;
  document.querySelector('.dataset-bar').classList.toggle('demo', demo);
  $('clear-data').hidden = !demo && !current.files.size && !previous.files.size;
  $('previous-status').textContent = demo ? 'Demo · Older illustrative snapshot loaded' : previous.files.size ? `${previous.files.size} older file(s) · ${ready(previous) ? 'Both lists loaded' : 'Snapshot incomplete'} · ${[...previous.files.values()].map(file => file.name).join(', ')}` : 'No older export loaded';
  $('clear-previous').hidden = !previous.loaded.size;
}

function historyReady() {
  return ready(current) && ready(previous) && $('confirm-history').checked && $('previous-date').value && $('current-date').value && $('previous-date').value < $('current-date').value;
}

function saveCsv(rows, category) {
  if (!rows.length) return;
  const url = URL.createObjectURL(new Blob([csv(rows, category)], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = `calibrate-${demo ? 'demo-' : ''}${category}.csv`; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  notify(`CSV prepared with ${format(rows.length)} account(s). Keep this file private: it contains usernames.`);
}

function renderHistory() {
  const enabled = Boolean(historyReady());
  $('history-summary').hidden = !enabled; $('history-results').hidden = !enabled;
  $('history-summary').replaceChildren(); $('history-results').replaceChildren();
  let message = 'Add both exports and their dates to enable comparison.';
  if (ready(current) && ready(previous)) {
    if (!$('previous-date').value || !$('current-date').value) message = 'Enter the dates when the two exports were created.';
    else if ($('previous-date').value >= $('current-date').value) message = 'The older export date must be before the current export date.';
    else if (!$('confirm-history').checked) message = 'Confirm both snapshots are complete and belong to the same account.';
    else message = `${demo ? 'Demo comparison · ' : ''}${$('previous-date').value} to ${$('current-date').value} · Select a category to view and export its accounts.`;
  }
  $('history-notice').textContent = message;
  if (!enabled) return;
  const changes = compare(current, previous);
  for (const [key, label] of Object.entries(changeLabels)) {
    const button = document.createElement('button'); button.className = 'history-tile'; button.setAttribute('aria-pressed', String(key === change));
    const number = document.createElement('strong'); number.textContent = format(changes[key].length);
    button.append(number, document.createTextNode(label));
    button.addEventListener('click', () => { change = key; renderHistory(); $('history-summary').querySelector(`[data-change="${key}"]`).focus(); });
    button.dataset.change = key; $('history-summary').append(button);
  }
  const rows = changes[change].sort((a, b) => a.username.localeCompare(b.username));
  const heading = document.createElement('div'); heading.className = 'history-results-heading';
  const title = document.createElement('p'); title.textContent = `${changeLabels[change]} · ${format(rows.length)} accounts`;
  const exportButton = document.createElement('button'); exportButton.className = 'button secondary'; exportButton.textContent = 'Export changes CSV'; exportButton.disabled = !rows.length; exportButton.addEventListener('click', () => saveCsv(rows, change));
  heading.append(title, exportButton); $('history-results').append(heading);
  const holder = document.createElement('div'); holder.className = 'history-results-list';
  // Cap the live DOM for large histories. CSV always includes the full category.
  holder.append(accountList(rows.slice(0, 200), changeLabels[change]));
  if (rows.length > 200) { const note = document.createElement('p'); note.className = 'small-note'; note.textContent = 'Showing the first 200 usernames. Export CSV for the complete category.'; holder.append(note); }
  if (!rows.length) { const note = document.createElement('p'); note.className = 'small-note'; note.textContent = 'No changes in this category between these snapshots.'; holder.append(note); }
  $('history-results').append(holder);
}

function render() {
  const complete = ready(current);
  const data = insights(current);
  for (const key of Object.keys(labels)) $('count-' + key).textContent = complete ? format(data[key].length) : '—';
  for (const key of ['followers', 'following', 'mutual', 'notBack']) $('stat-' + key).textContent = complete ? format(data[key].length) : '—';
  const percent = complete && current.following.size ? Math.round(data.mutual.length / current.following.size * 100) : null;
  $('mutual-percent').textContent = percent === null ? '—' : percent + '%';
  $('mutual-ring').style.background = `conic-gradient(#6945d8 0% ${percent ?? 0}%, #ebe6f6 ${percent ?? 0}% 100%)`;
  $('mutual-ring').setAttribute('aria-label', percent === null ? 'Mutual share unavailable: no following accounts loaded' : `${percent}% of following accounts are mutual`);
  $('balance-mutual').textContent = complete ? format(data.mutual.length) : '—';
  $('balance-oneway').textContent = complete ? format(data.notBack.length) : '—';
  renderFiles(); renderList(); renderHistory();
}

$('choose-current').addEventListener('click', () => $('current-files').click());
$('choose-previous').addEventListener('click', () => $('previous-files').click());
$('current-files').addEventListener('change', event => importFiles(event.target.files, 'current'));
$('previous-files').addEventListener('change', event => importFiles(event.target.files, 'previous'));
$('try-demo').addEventListener('click', loadDemo);
$('clear-data').addEventListener('click', clearAll);
$('clear-previous').addEventListener('click', () => { previousGeneration++; previous = emptySnapshot(); $('previous-files').value = ''; $('previous-date').value = ''; $('confirm-history').checked = false; restoreButtons(); render(); });
$('search').addEventListener('input', () => { page = 0; renderList(); });
$('sort').addEventListener('change', () => { page = 0; renderList(); });
$('prev-page').addEventListener('click', () => { page--; renderList(); });
$('next-page').addEventListener('click', () => { page++; renderList(); });
$('export-csv').addEventListener('click', () => saveCsv(visibleRows(), active));
for (const button of document.querySelectorAll('[data-list]')) {
  button.addEventListener('click', () => { active = button.dataset.list; page = 0; renderList(); });
  button.addEventListener('keydown', event => {
    const buttons = [...document.querySelectorAll('[data-list]')];
    const index = buttons.indexOf(button);
    const next = event.key === 'ArrowRight' ? (index + 1) % buttons.length : event.key === 'ArrowLeft' ? (index - 1 + buttons.length) % buttons.length : event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : null;
    if (next === null) return;
    event.preventDefault(); buttons[next].click(); buttons[next].focus();
  });
}
for (const id of ['previous-date', 'current-date', 'confirm-history']) $(id).addEventListener('change', renderHistory);
const dropZone = document.querySelector('.import-card');
dropZone.addEventListener('dragover', event => { event.preventDefault(); dropZone.classList.add('dragging'); });
dropZone.addEventListener('dragleave', event => { if (!dropZone.contains(event.relatedTarget)) dropZone.classList.remove('dragging'); });
dropZone.addEventListener('drop', event => { event.preventDefault(); dropZone.classList.remove('dragging'); importFiles(event.dataTransfer.files, 'current'); });
function syncNavigation() {
  const section = ['overview', 'connections', 'history'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'overview';
  for (const link of document.querySelectorAll('[data-section]')) {
    link.classList.toggle('active', link.dataset.section === section);
    if (link.dataset.section === section) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
  }
  if (['guide', 'privacy'].includes(location.hash.slice(1))) $(location.hash.slice(1)).open = true;
}
window.addEventListener('hashchange', syncNavigation);
syncNavigation(); render();
