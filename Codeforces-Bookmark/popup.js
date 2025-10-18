/* iPlusCode - Popup Script (MV3)
 * - Safe DOM usage (no innerHTML for dynamic strings)
 * - Handle validation & existence check
 * - Robust friends import (regex fix)
 * - Disable Sync while syncing
 * - Stable sorting with indicators
 * - Notes modal helpers
 */

(function () {
  'use strict';

  // ---------- Utilities ----------
  function $(id) { return document.getElementById(id); }

  function setText(el, text) {
    if (!el) return;
    el.textContent = text == null ? '' : String(text);
  }

  function formatDate(ts) {
    try { return new Date(ts).toLocaleString(); }
    catch { return new Date(ts).toString(); }
  }

  function normalizeProblemKey(url) {
    if (typeof url !== 'string') return null;
    const m =
      url.match(/\/contest\/(\d+)\/problem\/([A-Za-z0-9]+)/) ||
      url.match(/\/gym\/(\d+)\/problem\/([A-Za-z0-9]+)/) ||
      url.match(/\/problemset\/problem\/(\d+)\/([A-Za-z0-9]+)/);
    if (!m) return null;
    return `${m[1]}-${m[2]}`;
  }

  // ---------- Sorting State ----------
  const titleTh = $('th-title');
  const ratingTh = $('th-rating');
  let sortState = { key: 'title', dir: 1 }; // 1=asc, -1=desc

  function setSort(key) {
    if (sortState.key === key) sortState.dir *= -1;
    else { sortState.key = key; sortState.dir = 1; }
    render();
  }

  function applySort(items) {
    const dir = sortState.dir;
    const key = sortState.key;
    items.sort((a, b) => {
      let av, bv;
      if (key === 'rating') {
        const pa = parseInt(a.rating, 10);
        const pb = parseInt(b.rating, 10);
        av = Number.isFinite(pa) ? pa : -Infinity;
        bv = Number.isFinite(pb) ? pb : -Infinity;
      } else {
        av = (a.title || '').toLowerCase();
        bv = (b.title || '').toLowerCase();
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return  1 * dir;
      return (a.originalIndex - b.originalIndex);
    });

    // update indicators
    document.querySelectorAll('.sort-indicator').forEach(s => s.textContent = '');
    const ind = (sortState.dir === 1 ? '▲' : '▼');
    const th = (sortState.key === 'rating' ? ratingTh : titleTh);
    if (th) {
      const span = th.querySelector('.sort-indicator');
      if (span) span.textContent = ind;
    }
  }

  // ---------- Render ----------
  function buildRow(b, idx) {
    const tr = document.createElement('tr');
    if (b.solved) tr.classList.add('solved-row');

    // Solved checkbox (read-only)
    const tdSolved = document.createElement('td');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !!b.solved;
    cb.disabled = true;
    tdSolved.appendChild(cb);

    // Title
    const tdTitle = document.createElement('td');
    const a = document.createElement('a');
    a.href = b.url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = b.title || b.url || 'Problem';
    tdTitle.appendChild(a);

    // Rating
    const tdRating = document.createElement('td');
    setText(tdRating, b.rating ?? '');

    // Tags
    const tdTags = document.createElement('td');
    setText(tdTags, Array.isArray(b.tags) ? b.tags.join(', ') : '');

    // Notes
    const tdNotes = document.createElement('td');
    const btn = document.createElement('button');
    btn.className = 'edit-notes';
    btn.textContent = 'Edit';
    btn.addEventListener('click', () => openNotesModal(idx));
    tdNotes.appendChild(btn);

    tr.append(tdSolved, tdTitle, tdRating, tdTags, tdNotes);
    return tr;
  }

  function render() {
    const ratingFilter = $('filter')?.value || 'All';
    const tagFilterVal = ($('tagFilter')?.value || '').toLowerCase();
    const tbody = $('list');
    if (!tbody) return;

    chrome.storage.sync.get({ bookmarks: [], cf_handle: '', last_sync: null }, ({ bookmarks, cf_handle, last_sync }) => {
      // Toggle setup vs main UI view
      const setup = $('setup');
      const mainUI = $('mainUI');
      if (setup && mainUI) {
        if (!cf_handle) {
          setup.classList.remove('iplus_hidden');
          mainUI.classList.add('iplus_hidden');
        } else {
          setup.classList.add('iplus_hidden');
          mainUI.classList.remove('iplus_hidden');
        }
      }

      let items = bookmarks.map((b, i) => ({ ...b, originalIndex: i }));

      // Filters
      items = items.filter(b => {
        // tag filter
        const passTag = !tagFilterVal || (Array.isArray(b.tags) && b.tags.some(t => (t || '').toLowerCase().includes(tagFilterVal)));
        let passRating = true;
        const r = parseInt(b.rating, 10) || 0;
        if (ratingFilter === '<1200') passRating = r < 1200;
        else if (ratingFilter === '1200-1600') passRating = r >= 1200 && r <= 1600;
        else if (ratingFilter === '>1600') passRating = r > 1600;
        else if (ratingFilter === 'unsolved') passRating = !b.solved;
        return passTag && passRating;
      });

      applySort(items);

      // Rebuild table
      tbody.textContent = '';
      for (const it of items) {
        tbody.appendChild(buildRow(it, it.originalIndex));
      }

      // Last sync
      setText($('lastSync'), last_sync ? `Last sync: ${formatDate(last_sync)}` : '');
    });
  }

  // ---------- Sync ----------
  const syncBtn = $('sync');
  let syncing = false;

  async function runSync() {
    if (syncing) return;
    if (!syncBtn) return;
    syncing = true;
    syncBtn.disabled = true;
    syncBtn.textContent = 'Syncing…';

    try {
      const { cf_handle, bookmarks } = await chrome.storage.sync.get({ cf_handle: '', bookmarks: [] });
      if (!cf_handle) throw new Error('No handle saved');

      const resp = await fetch(`https://codeforces.com/api/user.status?handle=${encodeURIComponent(cf_handle)}&from=1&count=1000`);
      const data = await resp.json();
      if (data.status !== 'OK') throw new Error('API error');

      const solvedSet = new Set();
      for (const sub of data.result || []) {
        if (sub.verdict === 'OK' && sub.problem) {
          const cid = sub.problem.contestId;
          const idx = sub.problem.index;
          if (cid && idx) solvedSet.add(`${cid}-${idx}`);
        }
      }

      const updated = bookmarks.map(b => {
        const key = normalizeProblemKey(b.url);
        if (!key) return b;
        return { ...b, solved: solvedSet.has(key) };
      });

      const last_sync = Date.now();
      await chrome.storage.sync.set({ bookmarks: updated, last_sync });
      render();
    } catch (e) {
      console.warn('Sync failed:', e);
      alert('Failed to sync solved problems.');
    } finally {
      syncing = false;
      syncBtn.disabled = false;
      syncBtn.textContent = '🔄 Sync';
      const { last_sync } = await chrome.storage.sync.get({ last_sync: null });
      setText($('lastSync'), last_sync ? `Last sync: ${formatDate(last_sync)}` : '');
    }
  }

  // ---------- Save Handle ----------
  $('saveHandle')?.addEventListener('click', async () => {
    const el = $('handle');
    const btn = $('saveHandle');
    const handle = (el?.value || '').trim();

    if (!/^[A-Za-z0-9._-]{2,32}$/.test(handle)) {
      if (el) {
        el.focus();
        el.setSelectionRange(0, handle.length);
      }
      alert('Please enter a valid Codeforces handle.');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Saving…';

    try {
      const res = await fetch(`https://codeforces.com/api/user.info?handles=${encodeURIComponent(handle)}`);
      const data = await res.json();
      if (data.status !== 'OK') {
        alert('Handle not found. Please check spelling and try again.');
        return;
      }

      await chrome.storage.sync.set({ cf_handle: handle });

      // Try to fetch friends list (non-blocking)
// Try to fetch friends list (non-blocking)
try {

  const friends = (await fetchFriendsList(handle)).slice(0, 20); // ⬅️ limit here
  await chrome.storage.sync.set({
    cf_friends: friends,
    cf_friends_count: friends.length
  });
  console.log('✅ Friends list saved:', friends.length, friends.slice(0, 10));

} catch (e) {
  console.warn('Fetching friends failed (non-blocking):', e);
}



      render();
      if (typeof runSync === 'function') runSync();

    } catch (e) {
      console.error(e);
      alert('Network error. Please try again.');
    } finally {
      btn.disabled = false;
      btn.textContent = '💾 Save Handle';
    }
  });

  // ---------- Friends Import (robust regex) ----------
// Replace your existing fetchFriendsList with this:
// Scrape ONLY the "My friends" table on /friends (no sidebars)
async function fetchFriendsList(currentHandle) {
  try {
    const res = await fetch('https://codeforces.com/friends', { credentials: 'include' });
    if (!res.ok || res.url.includes('/enter')) {
      throw new Error('Not logged in or blocked');
    }
    const html = await res.text();
    const doc  = new DOMParser().parseFromString(html, 'text/html');

    // Scope to main column so we ignore "Streams", "Top rated", etc.
    const main = doc.querySelector('#pageContent') || doc;

    // The friends live in a datatable inside the main area.
    // Prefer .datatable; fall back to any table that actually contains /profile/ links.
    let table = main.querySelector('table.datatable');
    if (!table) {
      table = Array.from(main.querySelectorAll('table'))
        .find(t => t.querySelector('tbody a[href^="/profile/"]'));
    }
    if (!table) return [];

    // Collect handles from that table only. CF usually uses <a class="rated-user">,
    // but we match href to be safe.
    const anchors = table.querySelectorAll('tbody a[href^="/profile/"]');
    let handles = Array.from(anchors)
      .map(a => (a.textContent || '').trim())
      .filter(h => /^[A-Za-z0-9._-]{2,32}$/.test(h));

    // Deduplicate, drop your own handle if present
    handles = [...new Set(handles)];
    if (currentHandle) handles = handles.filter(h => h !== currentHandle);

    // If you want to cap storage (e.g., 20), do it here:
    // handles = handles.slice(0, 20);

    return handles;
  } catch (e) {
    console.warn('fetchFriendsList error:', e);
    return [];
  }
}




  // ---------- Notes Modal ----------
  let editingIndex = null;
  const notesModal  = $('notesModal');
  const notesText   = $('notesText');
  const saveNoteBtn = $('saveNoteBtn');
  const cancelNoteBtn = $('cancelNoteBtn');
  const closeNotes  = $('closeNotes');

  function openNotesModal(idx) {
    editingIndex = idx;
    chrome.storage.sync.get({ bookmarks: [] }, ({ bookmarks }) => {
      if (!notesModal || !notesText) return;
      notesText.value = bookmarks[idx]?.notes || '';
      notesModal.classList.remove('iplus_hidden');
      notesText.focus();
    });
  }

  function closeNotesModal() {
    if (!notesModal) return;
    notesModal.classList.add('iplus_hidden');
    editingIndex = null;
  }

  closeNotes?.addEventListener('click', closeNotesModal);
  cancelNoteBtn?.addEventListener('click', closeNotesModal);

  saveNoteBtn?.addEventListener('click', () => {
    chrome.storage.sync.get({ bookmarks: [] }, ({ bookmarks }) => {
      if (editingIndex !== null && bookmarks[editingIndex]) {
        bookmarks[editingIndex].notes = notesText?.value || '';
        chrome.storage.sync.set({ bookmarks }, () => {
          closeNotesModal();
          render();
        });
      }
    });
  });

  // ---------- Init Events ----------
  titleTh?.addEventListener('click', () => setSort('title'));
  ratingTh?.addEventListener('click', () => setSort('rating'));
  $('filter')?.addEventListener('change', render);
  $('tagFilter')?.addEventListener('input', render);
  $('resetHandle')?.addEventListener('click', async () => {
    await chrome.storage.sync.set({ cf_handle: '' });
    render();
  });
  $('sync')?.addEventListener('click', runSync);

  // ---------- First render ----------
// ---------- First render ----------
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') render();
});

// Auto-fetch friends once if storage is empty
chrome.storage.sync.get({ cf_handle: '', cf_friends: [] }, async ({ cf_handle, cf_friends }) => {
  if (cf_handle && (!cf_friends || cf_friends.length === 0)) {
    try {
      const friends = (await fetchFriendsList(cf_handle)).slice(0, 20); // ⬅️ same 20-limit
      await chrome.storage.sync.set({
        cf_friends: friends,
        cf_friends_count: friends.length
      });
      console.log('🔁 Auto-fetched friends:', friends.length);
    } catch (e) {
      console.warn('⚠️ Auto-fetch friends failed:', e);
    }
  }
});

render();


})();


