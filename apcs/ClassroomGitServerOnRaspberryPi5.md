# Classroom Git Server on Raspberry Pi 5

Nov 4, 2026 · @Nate

## Overview

The Pace router makes a private classroom Wi-Fi network with no internet. The Raspberry Pi plugs into it and stores a separate Git repository for each student and assignment. Students push code from their Macs over SSH. You create accounts and assignments and collect work with four short scripts.

&#91;embedded content: classroom setup · Macs, router, Pi\]

Students and you both reach the Pi through the router by name, `gitpi.local`. Each student can open only their own folder, and you can read all of them.

**How to read this guide**

- **Run on your Mac** means a normal Terminal window on your Mac. **Run on the Pi** means a Terminal window where you've already run `ssh yourusername@gitpi.local`. Your prompt then reads `yourusername@gitpi:~ $`.
- Replace `yourusername` with the Pi login you create in Part 1, and `jsmith` with a real student username.
- Each step says **what it does** and **why it matters**.
- **Editing files on the Pi:** `nano <file>` opens a text editor inside Terminal. Paste with Cmd+V, save with **Ctrl+O** then Enter, and exit with **Ctrl+X**.

## Part 1 — Flash the SD card (on your Mac)

You don't need a screen or keyboard for the Pi. All of its settings go onto the SD card from your Mac before it ever boots.

### Step 1. Write Pi OS with your settings already in place

1. Install **Raspberry Pi Imager** from raspberrypi.com/software and put the Pi's SD card in your Mac.
2. Choose **Raspberry Pi 5**, then **Raspberry Pi OS Lite (64-bit)**, then your SD card.
3. Click **Edit Settings** and set:
   - **Hostname:** `gitpi`
   - **Username and password:** your teacher login. Write these down.
   - **Wireless LAN:** your *home* Wi-Fi name and password
   - **Services tab:** check **Enable SSH** and choose **Use password authentication**
4. Write the card and put it in the Pi.

**What it does:** puts your login, Wi-Fi, and SSH settings onto the card, so the Pi is reachable from your Mac the first time it boots.

**Why it matters:** SSH is your only way into a Pi with no screen. Current Pi OS ships with SSH off and no default user, so a card set up without these settings can't be reached at all. The hostname `gitpi` is what you and your students will type to find the Pi.

## Part 2 — At home, with internet

This is the only part that needs internet. Do it before the Pi and the student Macs go onto the offline classroom network.

### Step 2. Connect to the Pi from your Mac

Power on the Pi and wait about 2 minutes. Then, **on your Mac**, open Terminal (Applications → Utilities) and run:

```bash
ssh yourusername@gitpi.local
```

Type `yes` the first time, then enter your password.

**What it does:** opens a remote command line on the Pi, so your Mac's Terminal acts as the Pi's screen and keyboard. `gitpi.local` works because the Pi announces its name on the network and Macs listen for it, so you never need its IP address.

**Why it matters:** this is how you'll manage the Pi from now on. Students push code over this same SSH connection.

### Step 3. Update the Pi and install Git

**On the Pi:**

```bash
sudo apt update && sudo apt full-upgrade -y
sudo apt install git -y
```

**What it does:** brings all of the Pi's software up to date, then installs Git.

**Why it matters:** Git is the only server software this setup uses. Updating now gets you security fixes while the Pi still has internet.

### Step 4. Prepare every student Mac

**On each student Mac**, while it has internet, run:

```bash
xcode-select --install
git config --global init.defaultBranch main
```

If you already know each student's username, also set their name and username on their own Mac:

```bash
git config --global user.name "Jane Smith"
git config --global user.email "jsmith@gitpi.local"
```

**What it does:** `xcode-select --install` installs Apple's command-line tools, which include Git. The `config` lines set the branch name and label every commit with who made it.

**Why it matters:**

- Without internet in class, the tools have to be installed ahead of time.
- The Pi's repositories use a branch named `main`. Without the `defaultBranch` setting, some Macs call their branch `master` and push to the wrong place.
- The email address doesn't need to be real. Git only uses it as a label on each commit.

### Step 5. Shut the Pi down

**On the Pi:**

```bash
sudo shutdown now
```

Wait for the green light to stop flashing before you unplug it.

**Why it matters:** pulling the power while the Pi is running can corrupt the SD card. Use this every time you power it off.

## Part 3 — Set up the server (in the classroom)

From here on, everything happens on the Pace network. No internet is needed.

### Step 6. Connect the Pi to the Pace router

1. Plug the Pi into one of the **yellow LAN ports** on the Pace router with an Ethernet cable, then power it on.
2. Join your Mac to the classroom Wi-Fi.
3. Wait about 2 minutes. Then, **on your Mac**:

```bash
ping gitpi.local
```

If replies come back, press **Ctrl+C** and SSH in with `ssh yourusername@gitpi.local`.

**What it does:** confirms your Mac can find the Pi by name across the router. The Pi is on a cable and the Macs are on Wi-Fi, and the router has to pass name announcements between the two.

**Why it matters:** every student command uses `gitpi.local`. If it fails here, it will fail for students too. See **Troubleshooting** at the end of this guide.

### Step 7. Allow Git's restricted shell as a login shell

**On the Pi:**

```bash
echo /usr/bin/git-shell | sudo tee -a /etc/shells
```

**What it does:** `git-shell` comes with Git. It's a login shell that allows push and pull and nothing else. A student who tries `ssh jsmith@gitpi.local` sees `fatal: Interactive git shell is not enabled` and is disconnected. `/etc/shells` is Linux's list of approved login shells.

**Why it matters:** students need SSH logins to push code, but they shouldn't be able to browse your Pi or run programs on it.

### Step 8. Create a `students` group and restrict its SSH access

**On the Pi:**

```bash
sudo groupadd students
sudo tee /etc/ssh/sshd_config.d/students.conf > /dev/null <<'EOF'
Match Group students
    AllowTcpForwarding no
    X11Forwarding no
    PermitTTY no
EOF
sudo systemctl restart ssh
```

**What it does:** creates a group for all student accounts, then writes an SSH rule file for that group. The rules turn off SSH's extra features for students: network tunnels, remote windows, and interactive terminals. The last line restarts SSH so the rules take effect.

**Why it matters:** `git-shell` blocks commands, and these rules close the side doors SSH would otherwise leave open. Your own account isn't in the group, so you keep full access.

### Step 9. Create the repository folder

**On the Pi:**

```bash
sudo mkdir -p /srv/git
git config --global --add safe.directory '*'
```

**What it does:**

- `/srv/git` is where every student's repositories will live, one folder per student. `/srv` is the standard Linux location for data a server hands out to others.
- The `safe.directory` line tells Git that you trust repositories owned by other users.

**Why it matters:** newer versions of Git refuse to open a repository owned by someone else. That's a security feature, but you need to open every student's repository to grade it.

## Part 4 — Install the teacher scripts

Four scripts handle all the routine work. Each block below creates one script and makes it runnable, so paste each block into your Pi session whole.

| Script | How you run it | What it does |
| --- | --- | --- |
| `add-students` | `sudo add-students students.txt` | Creates student accounts and folders, and saves their passwords |
| `new-assignment` | `sudo new-assignment lab1` | Creates an empty `lab1` repository for every student |
| `install-keys` | `sudo install-keys` | Installs students' SSH keys so they can push without a password |
| `collect` | `collect lab1` | Copies every student's `lab1` into `~/review/lab1` and shows who submitted |

**How each block works:** `sudo tee <file> <<'SCRIPT'` writes everything up to the line `SCRIPT` into that file, and `chmod +x` makes the file runnable. Saving the scripts in `/usr/local/bin` lets you run them by name from any folder. They use `$SUDO_USER`, which is your own username, so nothing in them needs editing.

### Step 10. `add-students`

```bash
sudo tee /usr/local/bin/add-students > /dev/null <<'SCRIPT'
#!/bin/bash
# Usage: sudo add-students students.txt
TEACHER=$SUDO_USER
OUT=/home/$TEACHER/student-passwords.txt
while read -r u || [ -n "$u" ]; do
  u=${u%$'\r'}
  [ -z "$u" ] && continue
  if id "$u" &>/dev/null; then echo "skip $u (already exists)"; continue; fi
  pw=$(tr -dc 'a-km-z2-9' </dev/urandom | head -c 8)
  useradd -m -s /usr/bin/git-shell -G students "$u"
  echo "$u:$pw" | chpasswd
  mkdir -p /srv/git/$u
  chown $u:$TEACHER /srv/git/$u
  chmod 2750 /srv/git/$u
  echo "$u  $pw" >> $OUT
  echo "added $u"
done < "$1"
chown $TEACHER $OUT; chmod 600 $OUT
SCRIPT
sudo chmod +x /usr/local/bin/add-students
```

**What it does:** for each username in the file, it:

- creates a Linux account that uses `git-shell` and belongs to the `students` group
- gives it a random 8-character password, skipping look-alike characters such as `l`, `1`, and `0`
- creates the student's folder at `/srv/git/<username>`
- adds the username and password to `~/student-passwords.txt`, which only you can read

It skips names that already exist, so you can rerun it with an updated list.

**Why it matters:** the folder permissions `2750` keep students apart:

- `7`: the student can read and write their own folder
- `5`: your group can read it, so you can grade it
- `0`: other students can't see inside it at all
- `2`: anything created inside stays readable by you

The passwords are random because `git-shell` users can't change their own passwords.

### Step 11. `new-assignment`

```bash
sudo tee /usr/local/bin/new-assignment > /dev/null <<'SCRIPT'
#!/bin/bash
# Usage: sudo new-assignment lab1
TEACHER=$SUDO_USER
[ -z "$1" ] && { echo "Usage: sudo new-assignment <name>"; exit 1; }
for u in $(getent group students | cut -d: -f4 | tr ',' ' '); do
  repo=/srv/git/$u/$1.git
  [ -d "$repo" ] && continue
  git init -q --bare --shared=group -b main "$repo"
  cat > "$repo/hooks/post-receive" <<'HOOK'
#!/bin/sh
echo "$(date '+%Y-%m-%d %H:%M:%S')  $USER pushed" >> push-log.txt
HOOK
  chmod +x "$repo/hooks/post-receive"
  chown -R $u:$TEACHER "$repo"
  echo "created $repo"
done
SCRIPT
sudo chmod +x /usr/local/bin/new-assignment
```

**What it does:** creates an empty repository named `<assignment>.git` inside each student's folder, so every student gets their own copy. Students added later get it too if you rerun the command, and existing repositories are left alone.

- `--bare` creates a repository with only Git's history and no working copy of the files. Servers use bare repositories because nobody edits files on the server. People only push and pull.
- `--shared=group` makes every file Git writes during a push belong to your group, so you can always read it.
- `post-receive` is a **hook**: a script Git runs automatically after every push. This one records the Pi's time and the student's name in `push-log.txt`.

**Why it matters:** students can't create repositories themselves, so you control what exists. The push log is your record of when work actually arrived. Commit times come from the student's Mac and can be wrong or changed.

### Step 12. `install-keys`

```bash
sudo tee /usr/local/bin/install-keys > /dev/null <<'SCRIPT'
#!/bin/bash
# Usage: sudo install-keys
for u in $(getent group students | cut -d: -f4 | tr ',' ' '); do
  key=$(git -c safe.directory='*' -C /srv/git/$u/keys.git show main:id_ed25519.pub 2>/dev/null)
  if [ -z "$key" ]; then echo "$u: no key yet"; continue; fi
  mkdir -p /home/$u/.ssh
  echo "restrict $key" > /home/$u/.ssh/authorized_keys
  chown -R $u:$u /home/$u/.ssh
  chmod 700 /home/$u/.ssh
  chmod 600 /home/$u/.ssh/authorized_keys
  echo "$u: key installed"
done
SCRIPT
sudo chmod +x /usr/local/bin/install-keys
```

**What it does:**

- reads the public key each student pushed to their `keys` repository (Part 5 shows how)
- writes it to that student's `authorized_keys`, the file SSH checks for keys it accepts
- adds `restrict` in front of each key, which turns off SSH's extra features for that key as a second layer of protection

**Why it matters:**

- Students can't install their own key, because `git-shell` blocks the usual tool for that.
- SSH ignores keys stored with loose permissions, so the strict `700` and `600` settings are required.
- You can rerun it anytime, for example after a late student pushes their key.

### Step 13. `collect`

```bash
sudo tee /usr/local/bin/collect > /dev/null <<'SCRIPT'
#!/bin/bash
# Usage: collect lab1   (no sudo)
[ -z "$1" ] && { echo "Usage: collect <name>"; exit 1; }
mkdir -p ~/review/$1
for repo in /srv/git/*/$1.git; do
  u=$(basename "$(dirname "$repo")")
  rm -rf ~/review/$1/$u
  git clone -q "$repo" ~/review/$1/$u 2>/dev/null
  echo "$u: $(git -C "$repo" log -1 --format='%cd  %s' 2>/dev/null || echo 'NO SUBMISSION')"
done
SCRIPT
sudo chmod +x /usr/local/bin/collect
```

**What it does:** makes a fresh copy of each student's work in `~/review/<assignment>/<student>/`. It also prints one line per student with their latest commit, or `NO SUBMISSION`.

**Why it matters:** this gives you a one-screen status for the whole class plus working copies you can open and run. The review copies are rebuilt on each run, so they always match the latest pushes.

## Part 5 — Onboard your students

Do this once per class at the start of the year. Afterward, students push and pull without typing a password.

### Step 14. Create the accounts

**On your Mac**, make a file named `students.txt` with one username per line, such as `jsmith`. Use lowercase letters and no spaces. In TextEdit, choose **Format → Make Plain Text** before you save it to the Desktop. Then copy it to the Pi:

```bash
scp ~/Desktop/students.txt yourusername@gitpi.local:~
```

**On the Pi:**

```bash
sudo add-students students.txt
cat ~/student-passwords.txt
```

Print or copy the list and hand each student their username and password.

**What it does:** `scp` (secure copy) moves a file from your Mac to the Pi over SSH, and `add-students` creates the accounts.

**Why it matters:** students need their password one time, to turn in their key in Step 16. It's also their backup if their key is ever lost.

### Step 15. Create the `keys` assignment

**On the Pi:**

```bash
sudo new-assignment keys
```

**Why it matters:** the classroom network has no email or file sharing, but students can already push files to you. This repository is how they hand in their public key.

### Step 16. Students create a key and turn it in

Each student, **on their Mac**:

```bash
ssh-keygen -t ed25519
```

They press **Enter** at all three prompts. Then:

```bash
git clone jsmith@gitpi.local:/srv/git/jsmith/keys.git
cp ~/.ssh/id_ed25519.pub keys/
cd keys
git add .
git commit -m "my key"
git push -u origin main
```

The first connection asks them to type `yes` to trust the Pi. Then they enter their password.

**What it does:** `ssh-keygen` creates a matching pair of files. The **private key** (`id_ed25519`) never leaves the Mac. The **public key** (`id_ed25519.pub`) is safe to share. Think of the public key as a padlock that only the student's private key opens. The student then pushes the padlock to the Pi.

**Why it matters:**

- Pressing Enter at every prompt means no passphrase. A passphrase would make Git ask for something every time, which defeats the purpose.
- The tradeoff: anyone who can use that Mac account can push as that student. That's fine when each student has their own Mac.

### Step 17. Install the keys

**On the Pi:**

```bash
sudo install-keys
```

To check that it worked, a student runs `ssh jsmith@gitpi.local` **on their Mac**. If they see `fatal: Interactive git shell is not enabled` without being asked for a password, their key works.

**Why it matters:** from now on, `git clone`, `git pull`, and `git push` connect without a password. If a student gets a new Mac or loses their key, they repeat Step 16 using their password, and you rerun `install-keys`.

## Part 6 — Everyday use

### Start and end of the day

- **Start:** power on the router and the Pi, then wait about 2 minutes. The Pi starts SSH on its own, and nothing else needs to run.
- **End:** **on your Mac**, run `ssh yourusername@gitpi.local`, then `sudo shutdown now`. Unplug the Pi after its green light stops flashing.

### Give an assignment

**On the Pi:**

```bash
sudo new-assignment lab1
```

### How students submit work

The first time, **on their Mac**:

```bash
git clone jsmith@gitpi.local:/srv/git/jsmith/lab1.git
cd lab1
# write or copy in their code, then:
git add .
git commit -m "Lab 1 complete"
git push -u origin main
```

After that, whenever they make changes:

```bash
git add .
git commit -m "Fixed the loop bug"
git push
```

- `clone` downloads the empty assignment and remembers where it came from. The warning "You appear to have cloned an empty repository" is normal.
- `add` and `commit` save a snapshot of their code on their Mac.
- `push` sends the snapshots to the Pi. `-u origin main` remembers where to send them, so later pushes need only `git push`.

### Review their work

**On the Pi:**

```bash
collect lab1                                     # status for the class + review copies
git -C /srv/git/jsmith/lab1.git log --oneline    # every commit one student made
cat /srv/git/jsmith/lab1.git/push-log.txt        # when each push arrived (Pi's clock)
```

To review on your Mac instead, **on your Mac**:

```bash
scp -r yourusername@gitpi.local:~/review/lab1 ~/Desktop/              # the whole class
git clone yourusername@gitpi.local:/srv/git/jsmith/lab1.git            # one student
```

### Back up every week or two

**On the Pi:**

```bash
sudo tar czf /tmp/git-backup.tgz /srv/git && sudo chown $USER /tmp/git-backup.tgz
```

**On your Mac:**

```bash
scp yourusername@gitpi.local:/tmp/git-backup.tgz ~/Desktop/git-backup-$(date +%F).tgz
```

**What it does:** `tar czf` packs every student repository into one compressed file, and `scp` copies it to your Mac with today's date in the name.

**Why it matters:** SD cards fail without warning, and all student work lives in `/srv/git`.

### Keep the clock right

With no internet, the Pi can't set its own clock, and the push log is only as accurate as that clock. If you use push times for deadlines, add the official Raspberry Pi 5 **RTC battery**, which plugs into the board. Or set the clock by hand at the start of class, **on the Pi**:

```bash
sudo date -s "2026-11-05 08:00"
```

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `ping gitpi.local` says "cannot resolve" | Check that the Pi's Ethernet cable is in a yellow port and wait 2 minutes. If it still fails, open `http://192.168.1.254`, find gitpi in the device list, and reserve it a fixed address under **Settings → LAN → IP Address Allocation**. Then use that IP address in place of `gitpi.local`. |
| `Permission denied` when cloning or pushing | The username in front of `@` and the folder name in the path must match, as in `jsmith@gitpi.local:/srv/git/jsmith/...`. Then check the password. |
| `src refspec main does not match any` | The student hasn't committed yet, or their branch is called `master`. Run `git commit` first. If it's still failing, run `git branch -M main` and push again. |
| Still asked for a password after Step 17 | Rerun `sudo install-keys` and check that the student's line says `key installed`. The file in their `keys` repository must be named exactly `id_ed25519.pub`. |
| `REMOTE HOST IDENTIFICATION HAS CHANGED` | This happens after you re-flash the Pi. On each Mac, run `ssh-keygen -R gitpi.local`, then connect again. |
| `detected dubious ownership` on the Pi | Rerun the `safe.directory` line from Step 9. |
| A student forgot their password | On the Pi: `echo "jsmith:newpassword" \| sudo chpasswd` |
| A student joins mid-year | Put their username in a new file and run `sudo add-students newstudent.txt`. Then rerun `sudo new-assignment <name>` for each assignment you've given, including `keys`. Existing repositories are skipped. Run `ls /srv/git/<any student>` to see which assignments exist. |
