/**
 * ============================================================================
 * PLACEHOLDER CONTENT — swap this for your real resume.
 * ============================================================================
 *
 * One entry here produces one coin monument in the city, one minimap marker and
 * one panel. Add or remove entries and the world updates itself: monument
 * placement, the objective counter and the minimap all read from this array's
 * length. Six is a comfortable number for an 8x8 city.
 *
 * Every field is plain text and is rendered with `textContent`, so apostrophes,
 * ampersands and angle brackets are all safe to paste in as-is.
 *
 *   id       short slug, used as the DOM/debug key
 *   title    panel heading, and the name shown on the Mission Passed banner
 *   tag      small label above the heading
 *   subtitle one line under the heading
 *   meta     optional label/value rows, rendered as a definition list
 *   body     paragraphs and/or bullet groups:
 *              { text: '...' }                     a paragraph
 *              { heading: '...', items: [...] }    a titled bullet list
 */

export const RESUME = [
  {
    id: 'about',
    tag: 'Monument 01',
    title: 'About Me',
    subtitle: 'Placeholder bio — replace with your own summary.',
    meta: [
      { label: 'Based in', value: 'Your City, Country' },
      { label: 'Role', value: 'Your Current Title' },
      { label: 'Status', value: 'Open to opportunities' },
    ],
    body: [
      {
        text:
          'This is placeholder text. Write two or three sentences describing who you are, ' +
          'what you build, and what you are looking for next. Keep it conversational — this ' +
          'is the first panel most people will read.',
      },
      {
        text:
          'A second short paragraph works well for the thing that makes you distinctive: a ' +
          'domain you know deeply, a product you shipped, or the kind of problem you enjoy.',
      },
    ],
  },
  {
    id: 'experience',
    tag: 'Monument 02',
    title: 'Experience',
    subtitle: 'Placeholder roles — replace with your work history.',
    body: [
      {
        heading: 'Senior Position — Company Name',
        items: [
          '2023 — Present · Placeholder achievement with a number attached to it.',
          'Placeholder responsibility describing scope, team size or systems owned.',
          'Placeholder outcome: what changed because you were there.',
        ],
      },
      {
        heading: 'Previous Position — Earlier Company',
        items: [
          '2021 — 2023 · Placeholder achievement.',
          'Placeholder responsibility.',
        ],
      },
      {
        heading: 'First Position — First Company',
        items: ['2019 — 2021 · Placeholder achievement.'],
      },
    ],
  },
  {
    id: 'projects',
    tag: 'Monument 03',
    title: 'Projects',
    subtitle: 'Placeholder projects — replace with your best work.',
    body: [
      {
        heading: 'Project One',
        items: [
          'One line on what it does and who it is for.',
          'One line on the interesting technical problem you solved.',
        ],
      },
      {
        heading: 'Project Two',
        items: ['What it does.', 'Why it was hard.'],
      },
      {
        text:
          'This city is itself a project — a Three.js open world with a procedural grid, ' +
          'arcade driving and AI traffic. Swap this paragraph for something of your own.',
      },
    ],
  },
  {
    id: 'skills',
    tag: 'Monument 04',
    title: 'Skills',
    subtitle: 'Placeholder skills — replace with your real stack.',
    body: [
      {
        heading: 'Languages',
        items: ['Placeholder, Placeholder, Placeholder'],
      },
      {
        heading: 'Frameworks & Tools',
        items: ['Placeholder, Placeholder, Placeholder'],
      },
      {
        heading: 'Other',
        items: ['Placeholder — testing, infrastructure, design, whatever applies.'],
      },
    ],
  },
  {
    id: 'education',
    tag: 'Monument 05',
    title: 'Education',
    subtitle: 'Placeholder education — replace with your own.',
    meta: [
      { label: 'Degree', value: 'Your Degree' },
      { label: 'Institution', value: 'Your University' },
      { label: 'Years', value: '20XX — 20XX' },
    ],
    body: [
      {
        text:
          'Placeholder line for coursework, honours, thesis topic or anything else worth ' +
          'calling out. Delete this section entirely if it is not relevant.',
      },
      {
        heading: 'Certifications',
        items: ['Placeholder certification', 'Placeholder certification'],
      },
    ],
  },
  {
    id: 'contact',
    tag: 'Monument 06',
    title: 'Get In Touch',
    subtitle: 'Placeholder contact details — replace with your own.',
    meta: [
      { label: 'Email', value: 'you@example.com' },
      { label: 'GitHub', value: 'github.com/yourhandle' },
      { label: 'LinkedIn', value: 'linkedin.com/in/yourhandle' },
    ],
    body: [
      {
        text:
          'Closing line — say what you would like the reader to do next. Thanks for ' +
          'driving all the way out here.',
      },
    ],
  },
];
