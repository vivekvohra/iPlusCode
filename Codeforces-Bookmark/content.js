// content.js
(async function() {
  const MAX_FRIENDS = 20;
  const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes in milliseconds

// add after CACHE_DURATION
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function guessLangClass(lang) {
  if (!lang) return 'lang-cpp';
  const L = lang.toLowerCase();
  if (L.includes('python')) return 'lang-py';
  if (L.includes('java')) return 'lang-java';
  if (L.includes('kotlin')) return 'lang-kotlin';
  if (L.includes('go')) return 'lang-go';
  if (L.includes('js') || L.includes('node')) return 'lang-js';
  if (L.includes('pypy')) return 'lang-py';
  if (L.includes('c++') || L.includes('gcc') || L.includes('clang')) return 'lang-cpp';
  if (L.includes('c#')) return 'lang-cs';
  if (L.includes('rust')) return 'lang-rs';
  return 'lang-cpp';
}




  // Utility – get current problem key as "<contestId>-<index>"
  function getCurrentProblemKey() {
    const match = location.href.match(/\/contest\/(\d+)\/problem\/([A-Za-z0-9]+)/) ||
                  location.href.match(/\/gym\/(\d+)\/problem\/([A-Za-z0-9]+)/) ||
                  location.href.match(/\/problemset\/problem\/(\d+)\/([A-Za-z0-9]+)/) ||
                  location.href.match(/\/edu\/[^\/]+\/practice\/contest\/(\d+)\/problem\/([A-Za-z0-9]+)/);
    return match ? `${match[1]}-${match[2]}` : null;
  }

  // Inject "Show Tags" toggle button for problem tags
  const roundboxes = document.querySelectorAll('div.roundbox');
  let tagsBox = null, headerEl = null;
  for (let box of roundboxes) {
    const header = box.querySelector('div.caption.titled');
    if (header && header.textContent.trim().includes('Problem tags')) {
      tagsBox = box;
      headerEl = header;
      break;
    }
  }
  if (tagsBox && headerEl) {
    const tagBadges = tagsBox.querySelectorAll('.tag-box');
    // Hide all tag badges by default
    tagBadges.forEach(b => b.style.display = 'none');

    const btnToggle = document.createElement('button');
    btnToggle.textContent = 'Show Tags';
    btnToggle.className = 'cf-toggle-tags';
    btnToggle.onclick = () => {
      const showing = btnToggle.textContent === 'Hide Tags';
      tagBadges.forEach(b => b.style.display = showing ? 'none' : '');
      btnToggle.textContent = showing ? 'Show Tags' : 'Hide Tags';
    };

    // Adjust header layout and append toggle button
    headerEl.style.display = 'flex';
    headerEl.style.alignItems = 'center';
    headerEl.appendChild(btnToggle);
  }

  // 📌 Bookmark and Remove buttons
  const titleEl = document.querySelector('.problem-statement .title');
  if (!titleEl) return;  // stop if not on a problem page
  const username = document.querySelector('a[href^="/profile/"]')?.textContent.trim() || '';

  const btnBookmark = document.createElement('button');
  btnBookmark.textContent = '🔖 Bookmark';
  btnBookmark.className = 'cf-button';
  const btnRemove = document.createElement('button');
  btnRemove.textContent = '❌ Remove';
  btnRemove.className = 'cf-button red';

  // Collect problem info (tags, rating, etc.)
  const tagsArr = Array.from(document.querySelectorAll('.tag-box'), el => el.textContent.trim());
  const starTag = tagsArr.find(t => t.startsWith('*'));
  const rating = starTag ? parseInt(starTag.slice(1), 10) : 0;
  const problem = {
    title: titleEl.textContent.trim(),
    url: window.location.href,
    rating,
    tags: tagsArr,
    savedAt: new Date().toISOString(),
    solved: false,
    notes: ''
  };

  titleEl.appendChild(btnBookmark);
  titleEl.appendChild(btnRemove);

  // Bookmark button: save problem to chrome.storage.sync
  btnBookmark.onclick = () => {
    chrome.storage.sync.get({ bookmarks: [] }, ({ bookmarks }) => {
      if (!bookmarks.some(b => b.url === problem.url)) {
        chrome.storage.sync.set({ bookmarks: [...bookmarks, problem] }, () => {
          alert('Problem bookmarked!');
        });
      } else {
        alert('Already bookmarked.');
      }
    });
  };

  // Remove button: delete problem from chrome.storage.sync
  btnRemove.onclick = () => {
    chrome.storage.sync.get({ bookmarks: [] }, ({ bookmarks }) => {
      const updated = bookmarks.filter(b => b.url !== problem.url);
      chrome.storage.sync.set({ bookmarks: updated }, () => {
        alert('Removed from bookmarks.');
      });
    });
  };

  // ✅ Solved problem badge (adds a "Solved ✔" label in the sidebar if user solved this problem)
  const problemKey = getCurrentProblemKey();
  if (username && problemKey) {
    const [contestId, problemIndex] = problemKey.split('-');
    fetch(`https://codeforces.com/api/user.status?handle=${username}&from=1&count=1000`)
      .then(res => res.json())
      .then(data => {
        if (data.status === 'OK' && data.result.some(sub =>
              sub.verdict === 'OK' &&
              sub.problem.contestId == contestId &&
              sub.problem.index === problemIndex)) {
          addSidebarSolvedBadge();
        }
      })
      .catch(e => console.warn('API fetch error:', e));
  }

  function addSidebarSolvedBadge() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    const badge = document.createElement('div');
    badge.style.cssText = `
      display: flex;
      align-items: center;
      font-weight: bold;
      margin-bottom: 8px;
      font-size: 14px;
    `;
    badge.innerHTML = `
      <span style="margin-right:4px;">Solved</span>
      <span style="color: green; font-size: 16px; line-height:1;">✔</span>`;
    sidebar.prepend(badge);
  }



  // 🧠 Fetch friends' accepted codes for this problem (up to MAX_FRIENDS)
// Prefer contest.status; fall back to user.status if needed.
// Keeps your MAX_FRIENDS + 700ms throttle and redirect-proof submission URLs.
async function fetchFriendsAcceptedCodes(contestId, index) {
  const { cf_friends = [] } = await chrome.storage.sync.get('cf_friends');
  if (!cf_friends.length) return [];

  // Normalize once
  const cidNum = Number(contestId);
  const idxNorm = String(index).toUpperCase().replace(/\s+/g, '').trim();

  const results = [];
  for (const handle of cf_friends.slice(0, MAX_FRIENDS)) {
    try {
      let accepted = null;

      // 1) contest.status (fast)
      try {
        const r1 = await fetch(
          `https://codeforces.com/api/contest.status?contestId=${cidNum}&handle=${encodeURIComponent(handle)}`
        );
        const d1 = await r1.json();
        if (d1.status === 'OK') {
          accepted = (d1.result || [])
            .filter(s => s.verdict === 'OK'
              && String(s.problem?.index).toUpperCase().replace(/\s+/g,'').trim() === idxNorm)
            .sort((a,b) => b.creationTimeSeconds - a.creationTimeSeconds)[0] || null;
        }
      } catch (_) {}

      // 2) user.status (fallback)
      if (!accepted) {
        const r2 = await fetch(
          `https://codeforces.com/api/user.status?handle=${encodeURIComponent(handle)}&from=1&count=1000`
        );
        const d2 = await r2.json();
        if (d2.status === 'OK') {
          accepted = (d2.result || [])
            .filter(s => s.verdict === 'OK'
              && Number(s.problem?.contestId) === cidNum
              && String(s.problem?.index).toUpperCase().replace(/\s+/g,'').trim() === idxNorm)
            .sort((a,b) => b.creationTimeSeconds - a.creationTimeSeconds)[0] || null;
        }
      }

      if (!accepted) {
        console.debug(`[friends-codes] ${handle}: no OK sub for ${cidNum}-${idxNorm}`);
        await sleep(700);
        continue;
      }

      const subId = accepted.id;
      const lang  = accepted.programmingLanguage || '';

      // ✅ Always try all known routes (don’t depend on current page path)
      const urls = [
        `https://codeforces.com/contest/${cidNum}/submission/${subId}`,
        `https://codeforces.com/problemset/submission/${cidNum}/${subId}`,
        `https://codeforces.com/gym/${cidNum}/submission/${subId}`,
      ];

      let code = '', subUrl = '';
      for (const u of urls) {
        const subRes = await fetch(u, { credentials: 'include' });
        if (!subRes.ok) continue;

        const html = await subRes.text();
        const doc  = new DOMParser().parseFromString(html, 'text/html');
        const pre  = doc.querySelector('#program-source-text, pre.program-source, pre');

        if (pre && pre.textContent) {
          code = pre.textContent;

          // Prefer canonical submission URL; otherwise use the working request URL
          const canonical =
            doc.querySelector('link[rel="canonical"][href*="/submission/"]')?.href ||
            doc.querySelector('meta[property="og:url"][content*="/submission/"]')?.content;
          const picked = canonical ? new URL(canonical, 'https://codeforces.com').toString() : u;
          subUrl = picked.includes('?') ? picked : `${picked}?f0a28=1`;

          if (subRes.url && subRes.url !== u) {
            console.debug('[friends-codes] rewrite:', { requested: u, final: subRes.url, used: subUrl });
          }
          break;
        }
      }

      if (!code) {
        console.debug(`[friends-codes] ${handle}: code page not found for sub ${subId}`);
        await sleep(700);
        continue;
      }

      results.push({ friend: handle, code, subUrl, lang });
    } catch (e) {
      console.warn('Error fetching code for friend:', handle, e);
    }
    await sleep(700);
  }

  console.debug(`[friends-codes] results: ${results.length}`);
  return results;
}





function displayFriendsCodesModal(results) {
  const modal = document.createElement('div');
  modal.className = 'iplus_modal';

  const content = document.createElement('div');
  content.className = 'modal-content';

  const closeBtn = document.createElement('span');
  closeBtn.className = 'close-button';
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', () => modal.remove());

  const h3 = document.createElement('h3');
  h3.textContent = "Friends' Accepted Codes";

  content.appendChild(closeBtn);
  content.appendChild(h3);

  if (!results.length) {
    const p = document.createElement('p');
    p.textContent = 'No friends have solved this problem.';
    content.appendChild(p);
  } else {
    for (const r of results) {
      const block = document.createElement('div');
      block.style.marginBottom = '20px';

      const strong = document.createElement('strong');

      const profA = document.createElement('a');
      profA.href = `https://codeforces.com/profile/${r.friend}`;
      profA.target = '_blank';
      profA.rel = 'noopener';
      profA.textContent = r.friend;
      strong.appendChild(profA);

      const dash = document.createTextNode(' – ');

      const subA = document.createElement('a');
      subA.href = r.subUrl;
      subA.target = '_blank';
      subA.rel = 'noopener noreferrer';
      subA.textContent = 'Submission';
      subA.addEventListener('click', (e) => e.stopPropagation());

      const pre = document.createElement('pre');
      pre.className = `prettyprint linenums ${guessLangClass(r.lang)}`;
      pre.textContent = r.code;

      block.appendChild(strong);
      block.appendChild(dash);
      block.appendChild(subA);
      block.appendChild(pre);
      content.appendChild(block);
    }
  }

  modal.appendChild(content);
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);

  if (window.PR && typeof window.PR.prettyPrint === 'function') {
    try { window.PR.prettyPrint(); } catch {}
  }
}




  // 👉 Inject sidebar section for "Friends’ Accepted Codes"
  const sidebar = document.getElementById('sidebar');
  if (sidebar && problemKey) {
    // Load any cached friend codes for this problem from storage
    const data = await chrome.storage.sync.get('friendCache');
    const friendCache = data.friendCache || {};
    const cacheEntry = friendCache[problemKey];
    const friendCodesCache = {};  // in-page cache state
    if (cacheEntry && cacheEntry.timestamp && Date.now() - cacheEntry.timestamp < CACHE_DURATION) {
      // Use cached results (valid < 10 minutes)
      friendCodesCache[problemKey] = { status: 'done', results: cacheEntry.results };
    } else {
      friendCodesCache[problemKey] = { status: 'idle', results: null };
      if (cacheEntry) {
        // Remove expired cache entry to keep storage clean
        delete friendCache[problemKey];
        chrome.storage.sync.set({ friendCache });
      }
    }

    // Build the sidebar UI box with a "Show Codes" link
    const box = document.createElement('div');
    box.className = 'roundbox sidebox';
    box.innerHTML = `
      <div class="caption titled">→ Friends’ Accepted Codes<div class="top-links"></div></div>
      <ul class="content-list"><li><a href="#" id="showFriendsCodes">Show Codes</a></li></ul>`;
    sidebar.appendChild(box);

    // Handle click on "Show Codes"
    box.querySelector('#showFriendsCodes').onclick = async (e) => {
      e.preventDefault();
      const cache = friendCodesCache[problemKey];
      if (cache.status === 'done') {
        // Already fetched in last 10 min – show cached results
        displayFriendsCodesModal(cache.results);
        return;
      }
      if (cache.status === 'fetching') {
        return; // if a fetch is in progress, ignore additional clicks
      }
      // Show a temporary modal indicating loading
      const loadingModal = document.createElement('div');
      loadingModal.className = 'iplus_modal';
      const inner = document.createElement('div');
      inner.className = 'modal-content';
      const p = document.createElement('p');
      p.textContent = "Fetching friends' codes...";
      inner.appendChild(p);
      loadingModal.appendChild(inner);
      document.body.appendChild(loadingModal);




      cache.status = 'fetching';
      const [contestId, index] = problemKey.split('-');
      const results = await fetchFriendsAcceptedCodes(contestId, index);
      loadingModal.remove();
      // Update caches with the new results
      friendCodesCache[problemKey] = { status: 'done', results };
      displayFriendsCodesModal(results);
      // Persist the fetched codes to chrome.storage with timestamp
      const storageData = await chrome.storage.sync.get({ friendCache: {} });
      const newCache = storageData.friendCache;
      newCache[problemKey] = { timestamp: Date.now(), results };
      chrome.storage.sync.set({ friendCache: newCache });
    };
  }
})();



