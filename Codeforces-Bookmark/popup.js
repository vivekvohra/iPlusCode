

document.getElementById('filter')?.addEventListener('change', render);
// new: tag‐text filter
document.getElementById('tagFilter')?.addEventListener('input', render);

document.getElementById('sync')?.addEventListener('click', syncSolved);




document.getElementById('saveHandle')?.addEventListener('click', () => {
  const handle = document.getElementById('handle').value.trim();
  if (!handle) {
    return alert("Please enter a Codeforces handle.");
  }

  // Validate via CF API before saving
  fetch(`https://codeforces.com/api/user.info?handles=${handle}`)
    .then(res => res.json())
    .then(data => {
      if (data.status === "OK") {
        // Valid handle, now save it
        chrome.storage.sync.set({ cf_handle: handle }, () => {
          document.getElementById('setup').classList.add('iplus_hidden');
          document.getElementById('mainUI').classList.remove('iplus_hidden');
          render();
          syncSolved();
        });
      } else {
        alert("Handle not found. Please check spelling and try again.");
      }
    })
    .catch(err => {
      console.error("Error validating handle:", err);
      alert("Network error while validating handle.");
    });
});


function render() {
  const ratingFilter = document.getElementById('filter').value;
  const tagFilterVal = document.getElementById('tagFilter').value.toLowerCase();

  chrome.storage.sync.get(
    { bookmarks: [], cf_handle: '', last_sync: null },
    ({ bookmarks, last_sync }) => {

      // keep track of each item’s original index in `bookmarks`
      let items = bookmarks.map((b, i) => ({ ...b, originalIndex: i }));

      // 1) Rating / solved filter
      items = items.filter(p => {
        if (ratingFilter === '<1200') return p.rating < 1200;
        if (ratingFilter === '1200-1600')
          return p.rating >= 1200 && p.rating <= 1600;
        if (ratingFilter === '>1600') return p.rating > 1600;
        if (ratingFilter === 'unsolved') return !p.solved;
        return true;
      });

      // 2) Tag‐text filter
      if (tagFilterVal) {
        items = items.filter(p =>
          (p.tags || []).some(t => t.toLowerCase().includes(tagFilterVal))
        );
      }
      //  future sort add 

      // 4) Render rows
      const list = document.getElementById('list');
      list.innerHTML = '';
      items.forEach((p, idx) => {
        const row = document.createElement('tr');
        if (p.solved) row.classList.add('solved-row');

        // solved checkbox
        const solvedCell = document.createElement('td');
        const chk = document.createElement('input');
        chk.type = 'checkbox'; chk.checked = p.solved; chk.disabled = true;
        solvedCell.appendChild(chk);

        // title link
        const linkCell = document.createElement('td');
        const a = document.createElement('a');
        a.href = p.url; a.textContent = p.title; a.target = '_blank';
        linkCell.appendChild(a);

        // rating
        const ratingCell = document.createElement('td');
        ratingCell.textContent = p.rating;

        // tags
        const tagsCell = document.createElement('td');
        tagsCell.textContent = (p.tags || []).join(', ');

        // notes button
        const notesCell = document.createElement('td');
        const btn = document.createElement('button');
        btn.textContent = '📝'; btn.className = 'edit-notes';
        // use the original index, not the filtered index!
        btn.onclick = () => openNotesEditor(p, p.originalIndex);
        notesCell.appendChild(btn);

        [solvedCell, linkCell, ratingCell, tagsCell, notesCell].forEach(c =>
          row.appendChild(c)
        );
        list.appendChild(row);
      });

      // last sync timestamp
      const lastSyncEl = document.getElementById('lastSync');
      lastSyncEl.textContent = last_sync
        ? `Last sync: ${new Date(last_sync).toLocaleString()}`
        : 'No sync yet.';
    }
  );
}


function syncSolved() {
  chrome.storage.sync.get({ bookmarks: [], cf_handle: '' }, ({ bookmarks, cf_handle }) => {
    if (!cf_handle) {
      alert("Please enter your Codeforces handle first.");
      return;
    }

    fetch(`https://codeforces.com/api/user.status?handle=${cf_handle}&from=1&count=1000`)
      .then(res => res.json())
      .then(data => {
        if (data.status !== "OK") throw new Error("API error");

    const updated = bookmarks.map(b => {
      const url = b.url;
      const match =
        url.match(/\/contest\/(\d+)\/problem\/([A-Za-z0-9]+)/) ||
        url.match(/\/gym\/(\d+)\/problem\/([A-Za-z0-9]+)/) ||
        url.match(/\/problemset\/problem\/(\d+)\/([A-Za-z0-9]+)/) ||
        url.match(/\/edu\/[^\/]+\/practice\/contest\/(\d+)\/problem\/([A-Za-z0-9]+)/);
          // if it’s not a CF‐problem URL we know how to parse, mark it unsolved
          if (!match) return { ...b, solved: false };

          const [, contestId, index] = match;
          const solved = data.result.some(sub =>
            sub.verdict === "OK" &&
            sub.problem.contestId == contestId &&
            sub.problem.index === index
          );

          // always overwrite, true or false
          return { ...b, solved };
        });

        chrome.storage.sync.set({
          bookmarks: updated,
          last_sync: new Date().toISOString()
        }, render);
      })
      .catch(e => {
        console.warn("Sync error:", e);
        alert("Failed to sync solved problems.");
      });
  });
}

// INIT
chrome.storage.sync.get(['cf_handle'], ({ cf_handle }) => {
  if (cf_handle) {
    document.getElementById('setup').classList.add('iplus_hidden');
    document.getElementById('mainUI').classList.remove('iplus_hidden');

    render();        // Immediate UI update
    syncSolved();    // Background refresh
  } else {
    document.getElementById('setup').classList.remove('iplus_hidden');
    document.getElementById('mainUI').classList.add('iplus_hidden');
  }
});
// allow user to change their saved handle
document.getElementById('resetHandle')?.addEventListener('click', () => {
  chrome.storage.sync.remove('cf_handle', () => {
    // show setup, hide main UI
    document.getElementById('setup').classList.remove('iplus_hidden');
    document.getElementById('mainUI').classList.add('iplus_hidden');
    // clear the input field
    document.getElementById('handle').value = '';
  });
});

let editingIndex = null;

const notesModal = document.getElementById('notesModal');
const notesText = document.getElementById('notesText');
const closeNotes = document.getElementById('closeNotes');
const saveNoteBtn = document.getElementById('saveNoteBtn');
const cancelNoteBtn = document.getElementById('cancelNoteBtn');
notesModal.classList.add('iplus_hidden');


function openNotesEditor(problem, index) {
  if(!problem || typeof index !== 'number') return;
  if(!document.body.contains(notesModal)) return ;
  editingIndex = index;
  notesText.value = problem.notes || "";
  notesModal.classList.remove('iplus_hidden');
}

closeNotes.onclick = cancelNoteBtn.onclick = () => {
  notesModal.classList.add('iplus_hidden');
  editingIndex = null;
};

saveNoteBtn.onclick = () => {
  chrome.storage.sync.get({ bookmarks: [] }, ({ bookmarks }) => {
    if (editingIndex !== null && bookmarks[editingIndex]) {
      bookmarks[editingIndex].notes = notesText.value;
      chrome.storage.sync.set({ bookmarks }, () => {
        notesModal.classList.add('iplus_hidden');
        editingIndex = null;
        render();
      });
    }
  });
};


