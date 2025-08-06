---
layout: default
title: Privacy Policy
---

# Privacy Policy – iPlusCode Chrome Extension

The **iPlusCode** Chrome extension helps you track Codeforces problems, view your friends’ accepted submissions, and maintain private notes. All data is stored **locally** on your device or within your **Chrome account sync storage**, and is only accessible to **you**.

---

## What We Store

- Your Codeforces handle  
- Bookmarked problems  
- Optional personal notes  
- A cached list of your Codeforces friends (for display purposes only)  
- Cached friend submissions for solved problems (stored locally for performance)

All of this data is managed using `chrome.storage.sync`, and **never leaves your device or browser**.

---

## What We Do Not Do

- ❌ Collect personal or sensitive data  
- ❌ Track your browsing activity  
- ❌ Use cookies or localStorage  
- ❌ Send data to any external server (we don’t have one)  
- ❌ Access your passwords, login sessions, or authentication credentials  

---

## Permissions Explanation

The extension requests access to:

```json
"host_permissions": ["https://codeforces.com/*"]
```

This permission is necessary to support the core features of the extension. Specifically, it allows the extension to:

* ✅ Access your \[public] submission history using the Codeforces API to highlight which problems you've solved.
* ✅ Load the `/friends` page (when you're already logged in) to extract your Codeforces friends list, used to display their accepted codes on problems.
* ✅ Access problem pages and submission pages to extract and display accepted submissions from friends (triggered only when the user clicks “Show Codes”).

These actions:

* Are all triggered by **user interaction** (e.g., clicking buttons in the popup or on a problem page).
* Use only **publicly available data** from Codeforces or pages you're authenticated on.
* **Do not** access, read, or store your Codeforces login credentials or sessions.
* Do **not** automate navigation, manipulate browser tabs, or scrape beyond your interactions.

---

## Data Removal

All stored data is tied to your Chrome profile and automatically deleted when:

* You uninstall the extension.
* You clear Chrome’s sync storage manually.

---

**Contact**: [vvkvohra1102@gmail.com](mailto:vvkvohra1102@gmail.com)

---


