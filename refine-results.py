#!/usr/bin/env python3
"""
refine-results.py — Job Scraper Results Refiner

Reads multiple job-scraper HTML result files, aggregates and deduplicates
entries across keyword searches, and produces a ranked HTML report.

Jobs appearing in more searches are ranked higher.
All original data (Easy Apply, links, company, site) is preserved.

Usage:
    python refine-results.py
    python refine-results.py results-reed-soc-analyst.html results-reed-cyber-security-analyst.html
"""

import sys
import os
import re
import glob
from datetime import datetime
from collections import defaultdict


# ─────────────────────────────────────────────
# PARSE HTML RESULTS FILES
# ─────────────────────────────────────────────

def parse_results_file(filepath):
    """Parse a job-scraper HTML results file and extract job entries."""
    with open(filepath, 'r', encoding='utf-8') as f:
        html = f.read()

    jobs = []

    # Extract keyword from the h1 heading (try multiple patterns)
    keyword_match = (
        re.search(r'Job Scraper Results\s*[—–\-]+\s*(.+?)\s*</h1>', html, re.IGNORECASE) or
        re.search(r'<h1[^>]*>.*?[—–\-]+\s*(.+?)\s*</h1>', html, re.IGNORECASE | re.DOTALL) or
        re.search(r'<title>[^<]*?[—–\-]+\s*(.+?)\s*</title>', html, re.IGNORECASE)
    )
    if keyword_match:
        keyword = keyword_match.group(1).strip()
    else:
        # Smart filename fallback: strip prefix/suffix and convert hyphens to spaces
        # e.g. results-all-cyber-security-analyst.html → cyber security analyst
        #      results-reed-soc-analyst.html → soc analyst
        basename = os.path.basename(filepath)
        basename = re.sub(r'^results-(?:all|reed|indeed|totaljobs)-', '', basename)
        basename = re.sub(r'\.html$', '', basename)
        keyword = basename.replace('-', ' ')

    # Extract each job entry block
    # Each job is wrapped in a <div style="margin:14px 0;..."> block
    job_blocks = re.findall(
        r'<div style="margin:14px 0;[^"]*">(.*?)</div>\s*(?=<div style="margin:|<div style="margin-top:|</div>)',
        html, re.DOTALL
    )

    for block in job_blocks:
        # Skip flagged section entries (they have opacity:0.6 and ✕ badge)
        if '✕' in block and 'background:#c0392b' in block:
            continue

        # Extract URL and title — Reed jobs have <a href>, others have <strong>
        reed_match = re.search(
            r'<a href="(https://www\.reed\.co\.uk[^"]+)"[^>]*>([^<]+)</a>',
            block
        )
        other_match = re.search(
            r'<strong>([^<]+)</strong>.*?<a href="(https://(?:uk\.indeed\.com|www\.totaljobs\.com)[^"]+)"',
            block, re.DOTALL
        )

        if reed_match:
            url = reed_match.group(1)
            title = reed_match.group(2).strip()
            site = 'Reed'
        elif other_match:
            title = other_match.group(1).strip()
            url = other_match.group(2)
            site = 'Indeed' if 'indeed.com' in url else 'TotalJobs'
        else:
            continue

        # Clean title — remove occurrence suffix like (1/2)
        title = re.sub(r'\s*\(\d+/\d+\)\s*$', '', title).strip()

        # Extract company name
        company_match = re.search(r'—\s*([^<\n]+?)(?:\s*</span>|\s*$)', block)
        company = company_match.group(1).strip() if company_match else ''

        # Easy Apply badge
        easy_apply = 'EASY APPLY' in block

        # SEEN BEFORE badge
        seen_before = 'SEEN BEFORE' in block

        jobs.append({
            'title': title,
            'company': company,
            'url': url,
            'site': site,
            'easy_apply': easy_apply,
            'seen_before': seen_before,
            'keyword': keyword,
            'source_file': filepath,
        })

    return keyword, jobs


# ─────────────────────────────────────────────
# AGGREGATE ACROSS FILES
# ─────────────────────────────────────────────

def aggregate_jobs(all_jobs_by_keyword):
    """
    Aggregate jobs across keyword searches.
    Key = normalised title + company.
    Score = number of distinct keyword searches the job appeared in.
    """
    # job_key -> list of appearances (one per keyword search)
    job_map = defaultdict(list)

    for keyword, jobs in all_jobs_by_keyword.items():
        seen_keys_this_keyword = set()
        for job in jobs:
            key = f"{job['title'].lower().strip()}||{job['company'].lower().strip()}"
            if key not in seen_keys_this_keyword:
                job_map[key].append(job)
                seen_keys_this_keyword.add(key)

    aggregated = []
    for key, appearances in job_map.items():
        # Use the first appearance as the canonical entry
        canonical = appearances[0].copy()
        canonical['search_count'] = len(appearances)
        canonical['keywords_found_in'] = [a['keyword'] for a in appearances]
        # Preserve easy_apply if any appearance has it
        canonical['easy_apply'] = any(a['easy_apply'] for a in appearances)
        # Preserve seen_before if any appearance has it
        canonical['seen_before'] = any(a['seen_before'] for a in appearances)
        aggregated.append(canonical)

    # Sort: by search_count desc, then company name asc within each tier
    aggregated.sort(key=lambda j: (
        -j['search_count'],
        j['company'].lower() if j['company'] else 'zzz'
    ))

    return aggregated


# ─────────────────────────────────────────────
# FREQUENCY ANALYSIS — TIER 1 NOISE DETECTION
# ─────────────────────────────────────────────

# Words to ignore when analysing title frequency — too common to be signal
STOP_WORDS = {
    'a', 'an', 'the', 'and', 'or', 'of', 'in', 'to', 'for', 'with',
    'at', 'by', 'from', 'on', 'is', 'as', 'into', 'it', 'be', 'its',
    '-', '&', '/', '(', ')', ',', '.',
}

def extract_title_words(title):
    """Extract significant words from a job title."""
    words = re.findall(r"[a-zA-Z]+(?:'[a-zA-Z]+)?", title.lower())
    return [w for w in words if w not in STOP_WORDS and len(w) > 1]

def detect_likely_irrelevant(tier1):
    """
    Within tier1, find jobs whose titles contain ONLY words that appear
    very rarely (<=2 occurrences) across all tier1 titles.
    These are statistical outliers — noise that doesn't fit the result set.
    Returns (likely_relevant, likely_irrelevant).
    """
    if not tier1:
        return tier1, []

    # Count how many tier1 titles each word appears in
    word_freq = defaultdict(int)
    for job in tier1:
        words = set(extract_title_words(job['title']))
        for w in words:
            word_freq[w] += 1

    # A job is "likely irrelevant" if ALL its significant words are rare (<=2)
    likely_irrelevant = []
    likely_relevant = []
    for job in tier1:
        words = extract_title_words(job['title'])
        if not words:
            likely_relevant.append(job)
            continue
        max_freq = max(word_freq[w] for w in words)
        if max_freq <= 2:
            likely_irrelevant.append(job)
        else:
            likely_relevant.append(job)

    return likely_relevant, likely_irrelevant


# ─────────────────────────────────────────────
# HIGH VOLUME RECRUITER DETECTION
# ─────────────────────────────────────────────

HIGH_VOLUME_THRESHOLD = 6

def detect_high_volume_recruiters(aggregated, threshold=HIGH_VOLUME_THRESHOLD):
    """
    Find companies/recruiters that appear >= threshold times across all results.
    Pull those jobs out into a separate list.
    Returns (clean_aggregated, high_volume_groups).
    high_volume_groups = list of (company, [jobs]) sorted by count desc.
    """
    # Count per company across entire result set
    company_counts = defaultdict(int)
    for job in aggregated:
        if job['company']:
            company_counts[job['company'].strip()] += 1

    high_volume_companies = {
        c for c, count in company_counts.items() if count >= threshold
    }

    if not high_volume_companies:
        return aggregated, []

    clean = [j for j in aggregated if j['company'].strip() not in high_volume_companies]
    pulled = [j for j in aggregated if j['company'].strip() in high_volume_companies]

    # Group by company, sorted by count desc then company name asc
    groups = defaultdict(list)
    for job in pulled:
        groups[job['company'].strip()].append(job)

    high_volume_groups = sorted(
        groups.items(),
        key=lambda x: (-len(x[1]), x[0].lower())
    )

    return clean, high_volume_groups


# ─────────────────────────────────────────────
# GENERATE HTML REPORT
# ─────────────────────────────────────────────

def generate_report(aggregated, keywords, source_files, high_volume_groups=None):
    """Generate the aggregated HTML report."""
    today = datetime.now().strftime('%d/%m/%Y')
    num_searches = len(keywords)

    # Split into tiers
    tier3 = [j for j in aggregated if j['search_count'] == num_searches and num_searches > 1]
    tier2 = [j for j in aggregated if 1 < j['search_count'] < num_searches]
    tier1_all = [j for j in aggregated if j['search_count'] == 1]

    # Further split tier1 into relevant and likely irrelevant via frequency analysis
    tier1, tier1_noise = detect_likely_irrelevant(tier1_all)

    # Total shown in header = everything except high volume (they're reviewed separately)
    total = len(aggregated)

    tier_labels = {
        num_searches: f'⭐ Appeared in all {num_searches} searches',
    }

    def render_job(job, index):
        # Search count badge — always first
        if job['search_count'] == num_searches and num_searches > 1:
            search_badge = f'<span style="background:#27ae60;color:#fff;padding:2px 6px;border-radius:4px;font-size:0.75rem;margin-right:6px;">✓ {job["search_count"]}/{num_searches} searches</span>'
        elif job['search_count'] > 1:
            search_badge = f'<span style="background:#2980b9;color:#fff;padding:2px 6px;border-radius:4px;font-size:0.75rem;margin-right:6px;">{job["search_count"]}/{num_searches} searches</span>'
        else:
            search_badge = f'<span style="background:#95a5a6;color:#fff;padding:2px 6px;border-radius:4px;font-size:0.75rem;margin-right:6px;">1/{num_searches} search</span>'

        # Secondary badges
        badges = ''
        if job['easy_apply']:
            badges += '<span style="background:#e91e8c;color:#fff;padding:2px 6px;border-radius:4px;font-size:0.75rem;margin-right:6px;">⚡ EASY APPLY</span>'
        if job['seen_before']:
            badges += '<span style="background:#e67e22;color:#fff;padding:2px 6px;border-radius:4px;font-size:0.75rem;margin-right:6px;">SEEN BEFORE</span>'

        site_badge = f'<span style="color:#999;font-size:0.75rem;margin-right:6px;">[{job["site"]}]</span>'

        if job['site'] == 'Reed':
            title_el = f'<a href="{job["url"]}" style="font-weight:bold;color:#1a1a1a;text-decoration:none;" onmouseover="this.style.textDecoration=\'underline\'" onmouseout="this.style.textDecoration=\'none\'">{job["title"]}</a>'
            url_el = ''
        else:
            title_el = f'<strong>{job["title"]}</strong>'
            url_el = f'<br><a href="{job["url"]}" style="font-size:0.85rem;">{job["url"]}</a>'

        keywords_found = ', '.join(job['keywords_found_in'])
        opacity = '0.5' if job['seen_before'] else '1'

        return f'''
        <div style="margin:14px 0;opacity:{opacity};">
          <span style="color:#999;font-size:0.85rem;margin-right:8px;">{index}.</span>
          {search_badge}{badges}{site_badge}
          {title_el}
          {f'<span style="color:#666;margin-left:8px;">— {job["company"]}</span>' if job["company"] else ''}
          {url_el}
          <div style="color:#aaa;font-size:0.75rem;margin-top:2px;margin-left:20px;">Found in: {keywords_found}</div>
        </div>'''

    def render_section(jobs, heading, start_index):
        if not jobs:
            return '', start_index
        rows = ''
        idx = start_index
        for job in jobs:
            rows += render_job(job, idx)
            idx += 1
        section = f'''
      <div style="margin-top:2rem;">
        <h3 style="border-bottom:2px solid #333;padding-bottom:0.5rem;">{heading}</h3>
        <p style="color:#666;font-size:0.85rem;">{len(jobs)} result{"s" if len(jobs) != 1 else ""}</p>
        {rows}
      </div>'''
        return section, idx

    # Build sections
    idx = 1
    sections = ''

    if tier3:
        s, idx = render_section(tier3, tier_labels[num_searches], idx)
        sections += s

    if tier2 and num_searches > 2:
        s, idx = render_section(tier2, 'Appeared in 2 searches', idx)
        sections += s

    if tier1:
        opacity_note = ' — <span style="color:#888;font-size:0.85rem;">lower confidence</span>' if num_searches > 1 else ''
        s, idx = render_section(tier1, f'Appeared in 1 search only{opacity_note}', idx)
        sections += s

    # Likely irrelevant (noise) sub-section
    if tier1_noise:
        noise_rows = ''
        for job in tier1_noise:
            noise_rows += render_job(job, idx)
            idx += 1
        sections += f'''
      <div style="margin-top:2rem;opacity:0.6;">
        <h3 style="border-bottom:2px solid #bbb;padding-bottom:0.5rem;color:#888;">
          🔍 Likely irrelevant — low frequency terms
        </h3>
        <p style="color:#888;font-size:0.85rem;">
          {len(tier1_noise)} result{"s" if len(tier1_noise) != 1 else ""} &middot;
          These titles contain words that appear rarely across all results,
          suggesting they are outside the target field.
        </p>
        {noise_rows}
      </div>'''

    # High volume recruiters section
    if high_volume_groups:
        hv_rows = ''
        for company, jobs in high_volume_groups:
            hv_rows += f'<div style="margin-top:1.25rem;">'
            hv_rows += f'<p style="font-weight:bold;margin-bottom:4px;">{company} <span style="color:#999;font-weight:normal;font-size:0.85rem;">— {len(jobs)} listing{"s" if len(jobs) != 1 else ""}</span></p>'
            for job in jobs:
                hv_rows += render_job(job, idx)
                idx += 1
            hv_rows += '</div>'

        sections += f'''
      <div style="margin-top:2rem;opacity:0.6;">
        <h3 style="border-bottom:2px solid #bbb;padding-bottom:0.5rem;color:#888;">
          📋 High volume recruiters — {HIGH_VOLUME_THRESHOLD}+ listings
        </h3>
        <p style="color:#888;font-size:0.85rem;">
          These recruiters posted {HIGH_VOLUME_THRESHOLD} or more jobs in these results,
          which may indicate aggregator behaviour or bulk posting rather than direct hiring.
          Grouped here for review.
        </p>
        {hv_rows}
      </div>'''

    noise_count = len(tier1_noise)
    hv_count = sum(len(jobs) for _, jobs in high_volume_groups) if high_volume_groups else 0
    # total already excludes high volume (removed before generate_report was called)
    # so reviewed = everything in aggregated minus the noise
    reviewed_count = total - noise_count
    source_list = ', '.join(os.path.basename(f) for f in source_files)
    keyword_list = ', '.join(f'<em>{k}</em>' for k in keywords)

    return f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Aggregated Job Results</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 860px; margin: 40px auto; padding: 0 20px; color: #1a1a1a; line-height: 1.5; }}
    h1 {{ font-size: 1.6rem; margin-bottom: 0.25rem; }}
    h3 {{ font-size: 1.1rem; margin-bottom: 0.25rem; }}
    a {{ color: #1a1a1a; }}
  </style>
</head>
<body>
  <h1>Aggregated Job Results</h1>
  <p style="color:#666;font-size:0.85rem;">
    {today} &middot; {total + hv_count} unique jobs across {num_searches} searches &middot; Sources: {source_list}
    {f'&middot; <strong>{reviewed_count}</strong> reviewed &middot; <span style="color:#aaa">{noise_count} likely irrelevant &middot; {hv_count} high volume</span>' if noise_count or hv_count else ''}
  </p>
  <p style="color:#666;font-size:0.85rem;">Keywords: {keyword_list}</p>
  <p style="font-size:0.85rem;margin-top:1rem;">
    <span style="background:#27ae60;color:#fff;padding:1px 5px;border-radius:3px;">✓ N/N searches</span> = appeared in all searches &nbsp;
    <span style="background:#2980b9;color:#fff;padding:1px 5px;border-radius:3px;">N/N searches</span> = appeared in some searches &nbsp;
    <span style="background:#95a5a6;color:#fff;padding:1px 5px;border-radius:3px;">1/N search</span> = appeared once only &nbsp;
    <span style="background:#e91e8c;color:#fff;padding:1px 5px;border-radius:3px;">⚡ EASY APPLY</span> = one-click application (Reed only) &nbsp;
    <span style="background:#e67e22;color:#fff;padding:1px 5px;border-radius:3px;">SEEN BEFORE</span> = appeared in a previous run
  </p>
  <hr style="margin:1.5rem 0;border:none;border-top:1px solid #eee;">
  {sections}
</body>
</html>'''


# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────

def main():
    print('\n  job-scraper — Results Refiner\n')

    # Determine files to process
    if len(sys.argv) > 1:
        # Files passed as arguments
        files = sys.argv[1:]
        missing = [f for f in files if not os.path.exists(f)]
        if missing:
            print(f'  ⚠  File(s) not found: {", ".join(missing)}')
            sys.exit(1)
    else:
        # Auto-detect results HTML files (exclude aggregated)
        files = sorted([
            f for f in glob.glob('results-*.html')
            if 'aggregated' not in f
        ])

        if not files:
            print('  No results-*.html files found in the current directory.')
            print('  Run from the same folder as your results files, or pass file paths as arguments.')
            sys.exit(1)

        print(f'  Found {len(files)} results file(s):')
        for f in files:
            print(f'    - {f}')

        answer = input('\n  Load these files? (y/n): ').strip().lower()
        if answer != 'y':
            raw = input('  Enter file paths separated by spaces: ').strip()
            files = [f.strip().strip('"\'') for f in raw.split() if f.strip()]
            missing = [f for f in files if not os.path.exists(f)]
            if missing:
                print(f'  ⚠  File(s) not found: {", ".join(missing)}')
                sys.exit(1)

    if len(files) < 2:
        print('  ⚠  Please provide at least 2 results files to aggregate.')
        sys.exit(1)

    # Parse all files
    print('\n  Parsing files...')
    all_jobs_by_keyword = {}
    source_files = []

    for filepath in files:
        keyword, jobs = parse_results_file(filepath)
        if keyword in all_jobs_by_keyword:
            keyword = f'{keyword} ({os.path.basename(filepath)})'
        all_jobs_by_keyword[keyword] = jobs
        source_files.append(filepath)
        print(f'  ✓  {os.path.basename(filepath)} — {len(jobs)} jobs ({keyword})')

    # Aggregate
    print('\n  Aggregating...')
    aggregated = aggregate_jobs(all_jobs_by_keyword)
    keywords = list(all_jobs_by_keyword.keys())

    # High volume recruiter detection — pull out before tier counting
    aggregated, high_volume_groups = detect_high_volume_recruiters(aggregated)

    tier_counts = {}
    n = len(keywords)
    for job in aggregated:
        sc = job['search_count']
        tier_counts[sc] = tier_counts.get(sc, 0) + 1

    print(f'  {len(aggregated)} unique jobs total (excluding high volume recruiters)')
    if n > 1:
        if n in tier_counts:
            print(f'  ⭐ {tier_counts[n]} appeared in all {n} searches')
        for k in sorted(tier_counts.keys(), reverse=True):
            if k != n and k != 1:
                print(f'  🔵 {tier_counts[k]} appeared in {k} searches')
        if 1 in tier_counts:
            print(f'  ⚪ {tier_counts[1]} appeared in 1 search only')
    if high_volume_groups:
        hv_total = sum(len(jobs) for _, jobs in high_volume_groups)
        print(f'  📋 {hv_total} jobs from {len(high_volume_groups)} high volume recruiter(s) separated')

    # Generate report
    html = generate_report(aggregated, keywords, source_files, high_volume_groups)
    outfile = 'results-aggregated.html'
    with open(outfile, 'w', encoding='utf-8') as f:
        f.write(html)

    print(f'\n  ✓  Report saved to {outfile}\n')


if __name__ == '__main__':
    main()
