# Checkpoint: plan

Checkpoint is our own version of Formative for Mr. Petruescu's classes. It will be hosted at **checkpoint.mrpetruescu.com**. "Checkpoint" is a placeholder name. Pick any name and subdomain you like: it's a find-and-replace. Don't use "Formative", because that's another company's product name.

This folder has two things:

1. **A working prototype** (`index.html` plus `css/` and `js/`). It has the full teacher and student interface, laid out like Formative. Data is saved only in the browser it runs in.
2. **This plan**: how to turn the prototype into the hosted version, what it costs ($0), and in what order to build it.

---

## Try the prototype

Open `checkpoint/index.html` in Chrome. Double-clicking the file works. No install needed.

- **Activities** is the main page. Each activity is a row and each class is a column. The icon in each cell shows the status: 🔒 locked, ⚡ open and student-paced, 🖥 teacher-paced. The number shows how many students responded. Click the icon for the same menu Formative has: Adjust settings, Submit for students, Pause, Switch pacing, Open/Lock, Spin for a student, Manage class. The menu also has **Export this class**.
- Click an activity to get the **Edit** and **Responses** tabs. Insights is left out.
  - **Edit:** the add menu matches Formative's. The blue items work now. Grey items are planned, and each is labeled with its phase. To write math, type `$$`, then the LaTeX, then `$$` again; it becomes rendered math the moment you close it. A preview pops up while you type. Click a formula to edit it again. To mark the right answer on a multiple-choice question, click its circle.
  - **Responses:** all classes on one page. Expand a class to see each student. Correct answers are green, wrong ones red, and blank submissions show ⦸. Click any cell to change its points. **Export CSV** is at the top right.
- **Teacher-paced lessons:** "IM1Aint Week 9" is open as teacher-paced for Monday. Click its 🖥 icon to open the waiting room. Then go to **Classes**, choose **Open as a student**, and pick a name. Do this in two or three tabs, choosing a different student in each. Now press Start, Next, and Pause students in the teacher tab and watch the student tabs follow.
- **Reports & export:** a gradebook CSV, a CSV of every answer for one activity, and a full backup and restore.
- The sample students are made up. **Reports → Reset** puts the sample data back.

---

## The "teacher hasn't started" problem, and how this design prevents it

Formative sometimes tells students a teacher-paced lesson hasn't started when it has. We can't see Formative's code. The usual cause of this kind of bug is a student's screen holding an **old copy** of the lesson state. That can happen after a missed live update, a laptop that slept, a school network that quietly dropped the connection, or a page that loaded before you pressed Start.

Checkpoint is built so a stale screen can't happen without anyone noticing:

1. **One record holds the truth for a live lesson:** `live/{assignment}` = which question is showing, paused or not, ended or not, plus a version number (`rev`). Every change you make bumps `rev`. Student screens are always drawn from this record, never from a saved copy.
2. **Reconnects re-send the current state**, not just the changes. The live database (Firebase Realtime Database) does this on its own. A student whose Wi-Fi blinks gets the current question as soon as it's back.
3. **Every student screen reports the `rev` it is showing.** Your live screen labels each student **Up to date**, **Updating…**, or **Not here**. If someone is stuck on an old question, you get a yellow warning with their name. This already works in the prototype.
4. **"Here" is based on the real connection.** The server notices when a student's connection drops (`onDisconnect`), so the list doesn't depend on a timer that a background tab can slow down.
5. **Backups for the backup:** if a student screen hears nothing for 15 seconds, it re-reads the state from the server. It also re-reads the moment a student switches back to the tab, for example from Zoom. Students also get a **Check again** link and a "Reconnecting…" banner whenever they're offline.
6. **Answers are never lost.** Answers given offline are queued and sent on reconnect. A student sees "Saved ✓" only after the server confirms it.

---

## What to build it with (free at your size)

| Piece | Choice | Why |
|---|---|---|
| Web hosting | **Firebase Hosting** | Free, fast, automatic HTTPS, easy custom subdomain. |
| Teacher sign-in | **Firebase Auth, Google sign-in** | You sign in with your Google account, and only your account can open the teacher side. |
| Student sign-in | **Firebase Auth, anonymous sign-in, plus class link, name, and PIN** | No student accounts or emails. Works on any device. See *Student sign-in* below. |
| Saved data (classes, activities, responses) | **Cloud Firestore** | Durable, works offline, has per-record security rules. |
| Live lesson state and who's here | **Firebase Realtime Database** | Built for exactly this: instant updates and real connection tracking. |
| Math | **KaTeX**, served from our own site | Fast, and doesn't depend on a third-party CDN that a school filter might block. |
| Code and deploys | **This GitHub repo + GitHub Actions** | Push to `main` and the site updates in about a minute. |

**Why not something else?**
- **Google Sheets + Apps Script:** too slow for live lessons, with no real-time updates and tight quotas.
- **Supabase:** a good product, but free projects [pause after a week of low activity](https://supabase.com/docs/guides/platform/free-project-pausing). A school break would pause it.
- **Writing our own server:** more code to keep running. Firebase covers the hard parts (live sync, sign-in, security) for free.

### Cost

Expected: **$0 a month.** Firebase's free (Spark) plan limits, from [Firebase's pricing docs](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans):

| Limit | Free plan | Your likely use |
|---|---|---|
| Firestore writes | 20,000 / day | ~10 students × 10 questions × a few edits ≈ 300 per class session |
| Firestore reads | 50,000 / day | a few thousand on a busy day |
| Realtime Database connections | 100 at once | one class at a time, ~15 |
| Hosting transfer | 10 GB / month | ~0.5 MB per student visit, so well under 1 GB |

The one thing to watch is the **100 connections at once** limit. Running one live lesson for more than about 95 students at the same time would need the pay-as-you-go plan.

**File uploads** (audio, video, and file responses; big images) need Cloud Storage, which now [requires the pay-as-you-go Blaze plan](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024). Blaze still includes a free amount that a few classes won't exceed. If you want uploads, switch to Blaze and set a $1 budget alert. Until then, images are shrunk and stored inline (the prototype already does this).

---

## Putting it on checkpoint.mrpetruescu.com

1. Make a Firebase project at console.firebase.google.com (free plan, US location).
2. In **Hosting → Add custom domain**, enter `checkpoint.mrpetruescu.com`.
3. Firebase shows one or two DNS records, usually a TXT record to prove you own the domain and an A record. Add them wherever mrpetruescu.com's DNS is managed (for example Squarespace, GoDaddy, or Cloudflare).
4. HTTPS turns on by itself, usually within an hour and at most 24 hours.

Addresses once it's live:
- `checkpoint.mrpetruescu.com`: teacher side (Google sign-in)
- `checkpoint.mrpetruescu.com/j/MOAARD`: a class's student join link
- Your main site at mrpetruescu.com isn't touched.

---

## How the data is organized

```
Firestore (saved)
  classes/{classId}                         name, short label, join code, order
  classes/{classId}/students/{studentId}    name
  classes/{classId}/students/{studentId}/private/pin    PIN (students can't read this)
  joinCodes/{code}                          → classId (lets a join link find its class)
  activities/{activityId}                   title, questions (with answer keys), dates
  assignments/{assignmentId}                activityId, classId, mode (student/teacher), open, paused
  assignments/{assignmentId}/student/content   the activity WITHOUT answer keys
  responses/{assignmentId}_{studentId}      answers {questionId: answer}, scores {questionId: points you set},
                                            submitted, startedAt, updatedAt
  devices/{signInId}                        → classId, studentId (which student this device is)

Realtime Database (live)
  live/{assignmentId}                       index, paused, ended, rev
  presence/{assignmentId}/{studentId}       online (cleared automatically on disconnect), rev
```

The prototype uses these same paths (see `js/store.js`). That's why moving to Firebase is mostly a matter of rewriting that one file.

### Security rules (who can see what)

- **You** can read and change everything. The rules allow only your Google account.
- **Answer keys never reach student devices.** When you open an assignment, the app saves a copy of the activity without correct answers, and students read only that copy. Auto-grading runs on your screen when you view Responses, the same way the prototype does it. That means no server code is needed.
- **A student can only:** read their own class's open assignments, write their own response while the assignment is open and not paused, and update their own presence. Students can't change scores, see other students' answers, or touch `live/`.
- Rules check all of this on Google's servers, so a student can't get around it by editing the page.

### Student sign-in

The default needs no IT involvement:
1. The student opens the class link. Behind the scenes, the device is signed in anonymously.
2. They tap their name.
3. The first time, they make a 4-digit PIN. On a new device, they enter that PIN. The security rules check the PIN against `private/pin`, which students can't read. No server code is needed.
4. You can reset a student's PIN from the Classes page.

Optional upgrade: let students sign in with their **school Google accounts**. That gives stronger identity and nothing to remember. However, district Google admins usually block outside apps for students under 18 until IT approves them. If your district approves the app, this is a small switch to turn on.

---

## Exporting data (free, any time)

- **CSV per activity:** every answer and every point, for all classes or one class. Already built.
- **Gradebook CSV:** each student × each activity, as percentages. Already built.
- **Full backup:** one JSON file with everything. It can be restored, and it's how prototype data moves into the hosted version. Already built.
- Later: a **"Send to Google Sheets"** button using your Google sign-in, and an automatic weekly backup to a private GitHub repo.

---

## Build order

**Phase 0: prototype (done, this folder).** Interface, editor with `$$` math, six question types (multiple choice, multiple selection, true/false, short answer, numeric, free response) plus text, image, video, and embed blocks, Responses grid with grading overrides, the teacher-paced live screen with the up-to-date check, student join and answer screens, CSV and backup export.

**Phase 1: hosted, student-paced.** This is enough to stop using Formative for regular assignments.
- Firebase project, Google sign-in for you, the checkpoint.mrpetruescu.com address, deploys from GitHub.
- Replace `js/store.js` with the Firebase version (same functions, so the screens don't change).
- Join codes, student name + PIN, and the student copy without answer keys.
- Proper page addresses (`/j/CODE` instead of `#/j/CODE`).
- Import your prototype backup.

**Phase 2: live lessons and more question types.**
- Teacher-paced lessons on the Realtime Database: live state, presence, up-to-date checks, pause, end.
- Question types: Drawing, Dropdown, Fill in the blank, Matching, Resequence.
- Settings: show correct answers after submitting, shuffle choices, due dates.
- A math keyboard for students' answers (MathLive), plus bold, italics, and lists in question text.

**Phase 3: extras, as you want them.**
- With file uploads (Blaze plan): Audio/Video/File response, uploading large images.
- Graphing, Number line, Hot spot, Hot text, Categorize, Drag and drop, Match table grid, Paired passages, Slides, Audio.
- Google Sheets export, automatic backups, reports across activities.

---

## How the prototype files carry over

| File | What it does | In the hosted version |
|---|---|---|
| `js/store.js` | Saves and syncs data (browser storage + live sync between tabs) | **Rewritten** for Firestore and Realtime Database, same functions |
| `js/math.js` | `$$` math editor and rendering | Kept |
| `js/questions.js` | Question types: editing, student view, grading | Kept. New types are added here |
| `js/teacher.js`, `editor.js`, `responses.js`, `live.js` | Teacher screens | Kept, plus a sign-in screen |
| `js/student.js` | Student screens | Kept, plus PIN and the copy without answer keys |
| `index.html` | Loads everything | Also loads Firebase. KaTeX served from our site |

---

## Before students use it

- **Student privacy.** Names and answers are student records. Check whether your district needs to approve a tool that stores them; many California districts use a standard student data privacy agreement. Keeping data small helps: first name and last initial is enough, and there are no emails or birthdays.
- Choose a **US data location** when making the Firebase project.

## Decisions for you

1. **Name and subdomain.** "Checkpoint" at checkpoint.mrpetruescu.com is a placeholder.
2. **Student sign-in.** Name + PIN (default, no IT needed) or school Google accounts (needs IT approval)?
3. **Showing correct answers.** After students submit, should they see the correct answers, or only that they submitted?
