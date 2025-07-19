// content.js
(async function () {
  // ────────── SHOW/HIDE TAGS TOGGLE ──────────
  // 1. Inject CF-ish styling for our toggle button
  const style = document.createElement('style');
  style.textContent = `
    .cf-toggle-tags {
      display: inline-block;
      margin-left: 8px;
      padding: 2px 6px;
      font-size: 12px;
      font-weight: 500;
      color: #3c3c3c;
      background: #f2f3f5;
      border: 1px solid #dcdfe3;
      border-radius: 2px;
      cursor: pointer;
    }
    .cf-toggle-tags:hover {
      background: #e5e6e9;
    }
  `;
  document.head.appendChild(style);

  // 2. Find the CF “Problem tags” roundbox
const roundboxes = document.querySelectorAll('div.roundbox');
let tagsBox = null, headerEl = null;

for (let box of roundboxes) {
  // look for the header div with classes "caption titled"
  const header = box.querySelector('div.caption.titled');
  const txt = header?.textContent.trim() || '';
  if (txt.includes('Problem tags')) {
    tagsBox = box;
    headerEl = header;
    break;
  }
}



  if (tagsBox && headerEl) {
    // 3. Locate the individual tag‐badge elements
    const tagBadges = tagsBox.querySelectorAll('.tag-box');
    // hide them by default
    tagBadges.forEach(b => b.style.display = 'none');

    // 4. Create our toggle button
    const btn = document.createElement('button');
    btn.textContent = 'Show Tags';
    btn.className = 'cf-toggle-tags';
    btn.onclick = () => {
      const showing = btn.textContent === 'Hide Tags';
      tagBadges.forEach(b => b.style.display = showing ? 'none' : '');
      btn.textContent = showing ? 'Show Tags' : 'Hide Tags';
    };

    // 5. Inject it into the header, on the right
    headerEl.style.display = 'flex';
    headerEl.style.alignItems = 'center';
    headerEl.appendChild(btn);
  }
  // ────────── end show/hide tags toggle ──────────

  

  // ────────── your existing bookmark + solved‐badge logic ──────────
  const titleEl = document.querySelector('.problem-statement .title');
  if (!titleEl) return;

  const username = document.querySelector('a[href^="/profile/"]')?.textContent.trim();
  const btnBookmark = document.createElement('button');
  btnBookmark.textContent = '🔖 Bookmark';
  btnBookmark.className = 'cf-button';

  const removeBtn = document.createElement('button');
  removeBtn.textContent = '❌ Remove';
  removeBtn.className = 'cf-button red';

  // === RATING & TAGS EXTRACTION ===
  const tagsArr = [...document.querySelectorAll('.tag-box')]
    .map(el => el.textContent.trim());
  const starTag = tagsArr.find(t => t.startsWith('*'));
  const rating = starTag ? parseInt(starTag.slice(1), 10) : 0;

  const problem = {
    title: titleEl.textContent.trim(),
    url: window.location.href,
    rating,
    tags: tagsArr,
    savedAt: new Date().toISOString(),
    solved: false,
    notes: ""
  };

  [btnBookmark, removeBtn].forEach(el => titleEl.appendChild(el));

  // reuse your existing .cf-button CSS injection
  const style2 = document.createElement('style');
  style2.textContent = `
    .cf-button {
      margin-left: 10px;
      background: #e1ecf4;
      border: 1px solid #a5c4dc;
      padding: 3px 8px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
    }
    .cf-button.red {
      background: #f8d7da;
      border-color: #f5c6cb;
    }
  `;
  document.head.appendChild(style2);
  
  btnBookmark.onclick = () => {
    chrome.storage.sync.get({ bookmarks: [] }, ({ bookmarks }) => {
      if (!bookmarks.some(b => b.url === problem.url)) {
        chrome.storage.sync.set({ bookmarks: [...bookmarks, problem] }, () => alert('Problem bookmarked!'));
      } else {
        alert('Already bookmarked.');
      }
    });
  };

  removeBtn.onclick = () => {
    chrome.storage.sync.get({ bookmarks: [] }, ({ bookmarks }) => {
      const updated = bookmarks.filter(b => b.url !== problem.url);
      chrome.storage.sync.set({ bookmarks: updated }, () => alert('Removed from bookmarks.'));
    });
  };

  // ────────── solved‐badge logic ──────────
  const url = window.location.href;
  const match =
    url.match(/\/contest\/(\d+)\/problem\/([A-Za-z0-9]+)/) ||
    url.match(/\/gym\/(\d+)\/problem\/([A-Za-z0-9]+)/) ||
    url.match(/\/problemset\/problem\/(\d+)\/([A-Za-z0-9]+)/) ||
    url.match(/\/edu\/[^\/]+\/practice\/contest\/(\d+)\/problem\/([A-Za-z0-9]+)/);

  if (username && match) {
    const [, contestId, problemIndex] = match;
    fetch(`https://codeforces.com/api/user.status?handle=${username}&from=1&count=1000`)
      .then(res => res.json())
      .then(data => {
        if (data.status === "OK" &&
            data.result.some(sub =>
              sub.verdict === "OK" &&
              sub.problem.contestId == contestId &&
              sub.problem.index === problemIndex
            )) {
          addSidebarSolvedBadge();
        }
      }).catch(e => console.warn("API fetch error:", e));
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
      <span style="color: green; font-size: 16px; line-height: 1;">✔</span>
    `;
    sidebar.prepend(badge);
  }
})();
