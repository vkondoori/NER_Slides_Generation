# GITHUB_SETUP.md - Guide to Push to GitHub

This guide walks you through creating the GitHub repository and pushing this code.

## Prerequisites

1. GitHub account (you have this: https://github.com/vkondoori)
2. Git installed on your computer
3. GitHub credentials or SSH key configured

## Step-by-Step: Create and Push Repository

### Step 1: Create the Repository on GitHub

1. Go to https://github.com/new
2. Enter repository name: **NER_Slides_Generation**
3. Description (optional): *Automated Google Apps Script for generating NER campaign presentation slides from BigQuery data*
4. Choose visibility:
   - **Public** if you want to share it
   - **Private** if it's internal only
5. Do NOT initialize with README, .gitignore, or license (we have them already)
6. Click "Create repository"

### Step 2: Get Your Repository URL

After creating, GitHub will show you commands. You'll see a URL like:
```
https://github.com/vkondoori/NER_Slides_Generation.git
```

### Step 3: Push the Code (Choose One Method)

#### Option A: HTTPS (Easiest)

```powershell
cd C:\temp\NER_Slides_Generation

# Add the remote repository
git remote add origin https://github.com/vkondoori/NER_Slides_Generation.git

# Rename branch to main (GitHub default)
git branch -M main

# Push all commits
git push -u origin main
```

When prompted for credentials:
- Username: your GitHub username
- Password: your GitHub personal access token (not your password)

**Don't have a Personal Access Token?**
1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Give it `repo` and `write:packages` scopes
4. Copy the token and use it as the password

#### Option B: SSH (More Secure)

```powershell
cd C:\temp\NER_Slides_Generation

# Add the remote repository
git remote add origin git@github.com:vkondoori/NER_Slides_Generation.git

# Rename branch to main
git branch -M main

# Push all commits
git push -u origin main
```

**Don't have SSH set up?**
1. Generate SSH key: `ssh-keygen -t ed25519 -C "your_email@example.com"`
2. Add to GitHub: https://github.com/settings/keys
3. Test connection: `ssh -T git@github.com`

### Step 4: Verify Upload

After running `git push`, you should see:
```
Enumerating objects: ...
Counting objects: ...
Compressing objects: ...
Writing objects: ...
remote: ...
...
 * [new branch]      main -> main
Branch 'main' is set up to track remote branch 'main' from 'origin'.
```

Then visit: https://github.com/vkondoori/NER_Slides_Generation

You should see all your files and the initial commit!

---

## Future Updates

Once your repository is set up, here's how to push future updates:

```powershell
cd C:\temp\NER_Slides_Generation

# Make changes to files...

# Stage your changes
git add .

# Commit with a message
git commit -m "Description of changes"

# Push to GitHub
git push origin main
```

## Quick Reference

| Command | Purpose |
|---------|---------|
| `git status` | See what's changed |
| `git add .` | Stage all changes |
| `git commit -m "message"` | Create a commit |
| `git push origin main` | Push to GitHub |
| `git log --oneline` | View commit history |
| `git branch -a` | List all branches |

## Troubleshooting

### "fatal: remote origin already exists"
```powershell
git remote remove origin
git remote add origin https://github.com/vkondoori/NER_Slides_Generation.git
```

### "Authentication failed"
- Verify your personal access token is correct (not your GitHub password)
- Check GitHub hasn't rate-limited you
- Ensure your credentials are stored: `git config credential.helper`

### "Permission denied (publickey)"
- SSH key not configured properly
- Try HTTPS method instead: `git remote set-url origin https://github.com/vkondoori/NER_Slides_Generation.git`

### "Updates were rejected"
- Someone else pushed to this branch
- Pull first: `git pull origin main` then push again

## Need Help?

GitHub's official guides:
- https://docs.github.com/en/get-started/importing-your-projects-to-github/importing-a-repository-with-github-cli
- https://docs.github.com/en/authentication/connecting-to-github-with-ssh

---

**Repository Location**: C:\temp\NER_Slides_Generation  
**GitHub Profile**: https://github.com/vkondoori  
**Ready to Push**: Yes! ✓
