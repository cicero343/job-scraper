# job-scraper

A Playwright-based automation script that searches the UK job sites Reed, Indeed, and TotalJobs, filters results by job title keywords, and generates a browsable HTML report with duplicate and spam detection.

<img width="560" height="345" alt="image" src="https://github.com/user-attachments/assets/b1ef5901-c3b2-4d79-8be8-5b3c35c4ea74" />

## Overview

job-scraper automates job searching across Reed, Indeed, and TotalJobs, combining results into a single clean HTML report. Enter your parameters once and the script does the rest.

## Why use this instead of the sites directly?

Job sites give you a list — job-scraper gives you an organised, filtered, deduplicated report you can actually work with.

**Filtering the sites can't do**

Exclude specific words from job titles — something no job site offers natively. Filter out manager, lead, contract, or any other terms you don't want.

**Cross-site deduplication**

The same role posted across multiple sites is detected and marked so you don't waste time on listings you've already seen in the same report.

**Persistent seen tracking**

Repeat the same search tomorrow and previously encountered listings are marked as seen before, so you can focus on what's new.

**Spam and bootcamp detection**

Listings appearing four or more times are automatically quarantined at the bottom of the report — typically bulk postings or bootcamp advertisements rather than genuine vacancies.

**Company grouping**

Results are sorted by company within each site so you can see everything a given employer is advertising at a glance.

**Report badges at a glance**

| Badge | Meaning |
| --- | --- |
| 🟠 **SEEN BEFORE** | Appeared in a previous run for this keyword |
| 🟣 **DUPLICATE** | Appeared on more than one site in this run |
| 🩷 **⚡ EASY APPLY** | One-click application available (Reed only) |
| 🔴 **✕ N×** | Flagged — appeared 4 or more times, likely spam or a bootcamp |

## What's included

| File | Purpose |
| --- | --- |
| `job-scraper.ts` | The main script — run via the launch script, or directly with `npx tsx job-scraper.ts` |
| `job-scraper-launch.ps1` | Windows launcher — handles setup and starts the tool |
| `job-scraper-launch.sh` | Mac / Linux launcher — handles setup and starts the tool |
| `refine-results.py` | Optional second pass — aggregates multiple search results, ranks by relevance, and filters noise |

## Requirements

- [Node.js](https://nodejs.org/) v18 or higher — handled automatically by the launch script
- A session cookie file (.json) for Indeed and/or TotalJobs — optional but recommended (see Authentication)

## Getting started

Clone the repository:

```bash
git clone https://github.com/yourusername/job-scraper.git
cd job-scraper
```

### Windows

If you have not run PowerShell scripts before, you may need to allow scripts first. Open PowerShell as Administrator and run the following two commands:

```powershell
Unblock-File .\job-scraper-launch.ps1
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

Then to launch the script:

```powershell
.\job-scraper-launch.ps1
```

### Mac / Linux

Make the script executable once after cloning:

```bash
chmod +x job-scraper-launch.sh
```

Then to launch the script:

```bash
./job-scraper-launch.sh
```

The launch script will check for Node.js, install dependencies, and install the Playwright browser if needed before starting the tool. On subsequent runs it skips straight to launching.

## Authentication

Reed works without any authentication and is the most reliable option. Indeed and TotalJobs may return limited or no results without a valid session. Indeed in particular has aggressive bot detection — results may vary regardless of cookie status.

If you have a session cookie file in JSON format for either site, you can provide the path at the prompt when selecting those sites. If you do not have one, simply press Enter to skip — the script will still run but results may be limited.

> **Important:** Never commit cookie files to a public repository. They contain your personal session data. The `.gitignore` in this repo excludes common cookie filenames by default.
> 

## Usage

Run the appropriate launch script for your OS (see Getting Started above). You will be prompted for the following:

| Prompt | Options |
| --- | --- |
| Site selection | `1` Reed (default), `2` Indeed, `3` TotalJobs, `4` All sites |
| Cookie file path | Path to your session cookie JSON, or press Enter to skip (Indeed/TotalJobs only) |
| Job title keywords | Free text, max 50 characters (e.g. `teacher`) |
| Location | Town name or postcode (e.g. `London` or `SE10 9RB`) |
| Radius | `5`, `10`, `20`, or `30` miles |
| Minimum salary | `30000`, `40000`, or `any` |
| Date posted | `1`, `3`, `7`, `14` days, or `any` |
| Exclude keywords | Comma separated list of words to filter out of job titles (e.g. `manager,lead,director`), or press Enter to skip |

## Output files

| File | Description |
| --- | --- |
| `results-{keyword}.html` | Browsable HTML report for this search term. Open in any browser. |
| `results-aggregated.html` | Combined report produced by `refine-results.py`. |
| `seen-{keyword}.json` | Persistent record of all job IDs seen for this keyword across previous runs. Delete this file to reset tracking for that keyword. |
| `indeed-browser-context.json` | Saved Indeed browser state for returning-user simulation. Generated automatically on first run. |
| `job-scraper-config.json` | Stores your last used cookie file paths for Indeed and TotalJobs. Generated automatically. |

## Refining results across multiple searches

After running job-scraper with two or more different keyword searches, you can use `refine-results.py` to aggregate and rank the combined results.

```bash
python refine-results.py
```

Run it from the same folder as your results files. It will auto-detect all `results-*.html` files and ask you to confirm before proceeding. You can also pass specific files as arguments:

```bash
python refine-results.py results-all-systems-analyst.html results-all-systems-engineer.html
```

It produces a single `results-aggregated.html` report with jobs ranked by how many of your searches they appeared in. Jobs appearing in all searches are surfaced at the top. It also automatically separates out:

- **Likely irrelevant** — titles whose words appear rarely across the result set, flagging outliers that slipped through keyword matching
- **High volume recruiters** — companies posting 6 or more listings, separated for review as they may be aggregators rather than direct hirers

Requires Python 3 — no additional packages needed.

## Disclaimer

This tool is intended for personal, educational use only. It demonstrates browser automation and web scraping techniques using Playwright. Please review the terms of service of any site you interact with before use. The author accepts no responsibility for any consequences arising from its use.

## License

MIT License — see [LICENSE](https://claude.ai/chat/LICENSE) for details.
