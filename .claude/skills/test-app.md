# Skill: test-app

End-to-end smoke test for the WithoutBorder application using Playwright MCP.
Tests the home page, chat navigation, message sending, and verifies the message appears in the conversation.

---

## Configuration

| Parameter | Default | Override |
|---|---|---|
| `TARGET_URL` | `http://localhost:3000` | Pass `demo` to use `https://wb.canadaquebec.ca` |

When the user says **"test demo"** or passes `demo` as an argument, use `https://wb.canadaquebec.ca`.
Otherwise default to `http://localhost:3000`.

---

## Steps

### 1. Navigate to the home page

Call `mcp__playwright__browser_navigate` with the target URL.

```
url: <TARGET_URL>
```

Take a screenshot immediately after navigation to capture the initial state.

Call `mcp__playwright__browser_take_screenshot` — label it **"Home page"**.

---

### 2. Capture accessibility snapshot

Call `mcp__playwright__browser_snapshot` to understand the current DOM structure.

Identify:
- Whether a login/auth screen is shown (look for `input[type="password"]`, text "Login", "Sign in")
- Whether the chat layout is already visible (look for `wb-chat-layout`, sidebar, "WithoutBorder" header text, "Équipes" / "Binômes" / "Agents IA" section labels)

**If a login screen is present:**
- The app may require authentication. In AUTH_DISABLED mode (demo/local) it should auto-redirect.
- Wait 2 seconds using `mcp__playwright__browser_wait_for` with `{ "time": 2000 }`, then take another snapshot.
- If still on login, report: "Authentication required — test aborted. Enable AUTH_DISABLED mode or provide credentials."

---

### 3. Navigate to the chat

The Angular router maps `/chat` as the main layout and `/chat/:channelId` for a specific conversation.

**Strategy A — click a channel in the sidebar:**

From the snapshot, look for sidebar navigation buttons. The sidebar contains three sections:
- **Équipes** — team channels, buttons identified by text like `# 1`, `# 2` followed by channel name
- **Binômes** — DM pairs
- **Agents IA** — AI agents with an `IA` badge

Click the first available channel button. Use `mcp__playwright__browser_click` with the element selector from the snapshot (e.g., `button` containing a channel name).

**Strategy B — navigate directly by URL:**

If no channel buttons are visible, call `mcp__playwright__browser_navigate` with `<TARGET_URL>/chat`.

Wait for the page to load: `mcp__playwright__browser_wait_for` with `{ "selector": "wb-conversation, wb-welcome" }`.

Take a screenshot — label it **"Chat view"**.

---

### 4. Open a conversation

Once the chat layout is loaded, ensure a conversation is open (URL should be `/chat/:someId`).

If only the welcome screen (`wb-welcome`) is visible (empty state with the "💬 Démarrez la conversation" message), click any channel in the sidebar to open it.

Take a screenshot after the conversation loads — label it **"Conversation open"**.

---

### 5. Locate the message input

The message composer is a `textarea` element with:
- `placeholder="Envoyer un message..."`
- Angular binding `[(ngModel)]="messageText"`
- Located inside `.dark:bg-brand-darkPanel` > `textarea`

The most reliable CSS selector is:

```
textarea[placeholder="Envoyer un message..."]
```

Verify it exists in the current snapshot before proceeding.

---

### 6. Type a test message

Call `mcp__playwright__browser_click` on the textarea selector to focus it.

Then call `mcp__playwright__browser_type` with:
```
element: textarea[placeholder="Envoyer un message..."]
text: "Test message from Claude Code — skill test-app [timestamp]"
```

Replace `[timestamp]` with the current time (e.g., `14:32`).

Take a screenshot — label it **"Message typed"**.

---

### 7. Submit the message

**Option A — press Enter (preferred):**

Call `mcp__playwright__browser_press_key` with:
```
key: Enter
```

Note: `Shift+Enter` inserts a newline; plain `Enter` triggers `sendMessage()` (see `onKeydown` handler in `conversation.component.ts`).

**Option B — click the send button:**

The send button uses `title="Envoyer (Entrée)"` and is the last `button` in the bottom toolbar of the composer. Use the selector:

```
button[title="Envoyer (Entrée)"]
```

Call `mcp__playwright__browser_click` on that button.

---

### 8. Wait for the message to appear

Call `mcp__playwright__browser_wait_for` with:
```
{ "selector": "wb-message-bubble", "timeout": 5000 }
```

Then take a screenshot — label it **"After send"**.

---

### 9. Verify the message is visible

Call `mcp__playwright__browser_snapshot` to get the updated DOM.

Search the snapshot text for the message content typed in step 6 (the phrase "Test message from Claude Code").

**Check:**
- The message text appears inside a `wb-message-bubble` component
- The message bubble structure: avatar + sender metadata (username, time, language badge) + bubble div with the text
- If `isOwn` is true (sent by current user), the bubble uses `own` CSS classes

---

### 10. Report results

Print a summary using this format:

```
--- test-app results ---
Target URL  : <URL>
Home page   : [PASS/FAIL] — <detail>
Chat nav    : [PASS/FAIL] — <detail>
Msg typed   : [PASS/FAIL] — <detail>
Msg sent    : [PASS/FAIL] — <detail>
Msg visible : [PASS/FAIL] — <detail>
Overall     : [PASS / FAIL]
```

If any step fails, include the exact error or observation and the label of the last successful screenshot.

---

## Key selectors reference

| Element | Selector |
|---|---|
| Message textarea | `textarea[placeholder="Envoyer un message..."]` |
| Send button | `button[title="Envoyer (Entrée)"]` |
| Message bubbles | `wb-message-bubble` |
| Messages scroll area | `div.custom-scrollbar` (inside `wb-conversation`) |
| Channel nav buttons (teams) | `aside button` containing `#` number + channel name |
| Active channel nav item | `button.nav-item-active` |
| Sidebar agents section | `button` inside `li` with agent name + `IA` badge span |
| Conversation header | `wb-conversation header h2` |
| Load more button | `button` with text "Charger les messages précédents" |

## Angular component selectors

| Component | HTML selector |
|---|---|
| App root | `app-root` |
| Chat layout | `wb-chat-layout` |
| Conversation | `wb-conversation` |
| Message bubble | `wb-message-bubble` |
| Welcome screen | `wb-welcome` |

## URL routing

| Route | Description |
|---|---|
| `/` | Redirects to `/chat` |
| `/chat` | Chat layout with welcome screen |
| `/chat/:channelId` | Chat layout with specific conversation open |
| `/profile` | User profile page |
