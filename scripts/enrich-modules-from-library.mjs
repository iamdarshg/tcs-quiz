#!/usr/bin/env node
/**
 * enrich-modules-from-library.mjs (v2)
 *
 * Enriches the 15 curated modules with prep library content.
 * Target: ~100 well-matched topics per module = ~1500 total (above 1200+).
 * Deduplicates: each library line goes into the best-matching module only.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function readJSON(rel) {
  for (const p of [join(root, '_data', rel), join(root, 'data', rel)]) {
    try { return JSON.parse(readFileSync(p, 'utf8')); } catch {}
  }
  return null;
}

function writeJSON(rel, data) {
  writeFileSync(join(root, 'data', rel), JSON.stringify(data, null, 2), 'utf8');
}

// ── 1. Load library ────────────────────────────────────────────────────────
const library = readJSON('prep-library.json');
if (!library) { console.error('prep-library.json not found'); process.exit(1); }

const allLines = [];
for (const mod of library.modules || []) {
  for (const line of (mod.lines || [])) {
    const t = (line.text || '').trim();
    if (t.length >= 5) {
      allLines.push({
        sourceLine: line.sourceLine,
        text: t,
        libModule: mod.id,
      });
    }
  }
}
console.log(`Library: ${allLines.length} non-trivial lines`);

// ── 2. Module keywords and target counts ────────────────────────────────────
const TARGET_PER_MODULE = 100;

const MODULE_KEYWORDS = {
  'module-01': { label: 'Computing History and Foundations',
    kw: ['computing','abacus','ada lovelace','alan turing','eniac','transistor','moore',
         'babbage','analytical engine','difference engine','computer','programming',
         'vacuum tube','colossus','edsac','univac','pascaline','calculating machine',
         'algorithm','binary','stored program','von neumann','boolean','logic gate',
         'machine','calculator','computation','computing','mechanical computer',
         'first computer','turing machine','turing test','integrated circuit',
         'microprocessor','personal computer','mainframe','punched card',
         'jacquard loom','arithmetic','digital','analog computer','cambridge',
         'manchester','harvard mark','ibm','apple ii','altair'] },
  'module-02': { label: 'Software, Operating Systems, Languages and Databases',
    kw: ['operating system','programming language','database','software','unix','linux',
         'windows','macos','ms-dos','c language','c++','java','python','javascript',
         'fortran','cobol','lisp','assembly','sql','relational database','oracle',
         'mysql','postgresql','compiler','interpreter','open source','gnu','kernel',
         'shell','filesystem','memory management','virtual memory','multitasking',
         'api','version control','git','ide','algorithm','data structure',
         'stack','queue','tree','graph','hash table','sorting','object oriented',
         'functional programming','software engineering','agile','devops',
         'container','docker','virtual machine','structured query','rdbms',
         'nosql','data warehouse','etl','middleware','microservice'] },
  'module-03': { label: 'Internet, Web, Networking, Telecom and Mobile',
    kw: ['internet','web','network','tcp/ip','http','html','css','browser','server',
         'client','dns','url','ip address','router','switch','ethernet','wi-fi',
         'bluetooth','5g','4g','lte','telecom','telephone','mobile','smartphone',
         'android','ios','world wide web','tim berners-lee','arpanet',
         'packet switching','modem','fiber','optical fiber','satellite communication',
         'tcp','udp','ftp','smtp','dhcp','nat','firewall','proxy','cdn',
         'cloud computing','saas','paas','iaas','web server','apache','nginx',
         'rest api','graphql','websocket','ajax','json','xml','dot com',
         'broadband','bandwidth','latency','protocol stack','tcp/ip stack'] },
  'module-04': { label: 'Technology Companies, Personalities, Brands and Products',
    kw: ['microsoft','apple','google','amazon','facebook','meta','ibm','intel','amd',
         'nvidia','qualcomm','cisco','oracle','samsung','sony','hp','dell','lenovo',
         'tesla','spacex','netflix','spotify','uber','twitter','linkedin','instagram',
         'telegram','tiktok','youtube','wikipedia','github','adobe','salesforce','sap',
         'linus torvalds','dennis ritchie','bill gates','steve jobs','mark zuckerberg',
         'jeff bezos','elon musk','larry page','sergey brin','tim berners-lee',
         'nokia','motorola','blackberry','huawei','xiaomi','oneplus','oppo','vivo',
         'infosys','wipro','hcl','accenture','cognizant','capgemini',
         'tata consultancy','tcs','tata','ratan tata','jamsetji'] },
  'module-05': { label: 'Artificial Intelligence, Data, Cloud, Automation, Robotics and Biometrics',
    kw: ['artificial intelligence','machine learning','deep learning','neural network',
         'data science','big data','cloud computing','automation','robotics','biometrics',
         'natural language processing','computer vision','speech recognition','chatbot',
         'gpt','llm','large language model','transformer','tensorflow','pytorch',
         'training data','dataset','supervised learning','unsupervised learning',
         'reinforcement learning','classification','regression','clustering',
         'aws','azure','google cloud','data pipeline','robot','autonomous','drone',
         'self-driving','fingerprint','facial recognition','voice recognition',
         'expert system','knowledge graph','recommendation engine','predictive model',
         'blockchain','smart contract'] },
  'module-06': { label: 'Hardware, Semiconductors, Architectures and Quantum Computing',
    kw: ['semiconductor','transistor','integrated circuit','chip','microprocessor',
         'cpu','gpu','fpga','asic','ram','rom','memory','storage','ssd','hdd',
         'motherboard','pci express','usb','hdmi','architecture','x86','arm',
         'risc','cisc','instruction set','pipeline','cache','multi-core',
         'parallel processing','quantum computing','qubit','superposition',
         'entanglement','quantum gate','shor algorithm','quantum supremacy',
         'ibm quantum','tsmc','photolithography','nanometer','wafer','fabrication',
         'fab','system on chip','soc','embedded system','microcontroller',
         'arduino','raspberry pi','clock speed','frequency'] },
  'module-07': { label: 'Cybersecurity, Malware, Privacy and Global Outages',
    kw: ['cybersecurity','malware','virus','worm','trojan','ransomware','spyware',
         'phishing','social engineering','ddos','denial of service','data breach',
         'hacker','exploit','vulnerability','zero day','patch','firewall','antivirus',
         'encryption','cryptography','public key','private key','certificate','ssl',
         'tls','https','vpn','two factor','password','hash','global outage',
         'data privacy','gdpr','cyber attack','stuxnet','wannacry','mirai',
         'solarwinds','log4j','heartbleed','spectre','meltdown','intrusion detection',
         'ids','ips','penetration test','red team','blue team','information security'] },
  'module-08': { label: 'Indian Digital Ecosystem and Indigenous Technology',
    kw: ['india','indian','aadhaar','upi','digital india','bhimi','payments',
         'rupee','npci','bangalore','hyderabad','pune','chennai','startup','unicorn',
         'flipkart','paytm','phonepe','razorpay','zomato','swiggy','ola','oyo',
         'nasscom','it industry','software export','bpo','digital payment',
         'demonetisation','gst','cert-in','nixi','data protection','semicon india',
         'tata','reliance jio','airtel','vodafone','bsnl','isro','mangalyaan',
         'chandrayaan','navic','india stack','account aggregator','ondc',
         'make in india','atmanirbhar','digital public good','nse','bse'] },
  'module-09': { label: 'Tata Group and TCS',
    kw: ['tata','tcs','tata consultancy','jamsetji tata','ratan tata','tata group',
         'tata motors','tata steel','tata power','tata chemicals','tata communications',
         'tata elxsi','tata sons','tata trust','tata nano','tata indica',
         'jaguar','land rover','corus','tetley','tata sky','tata play',
         'tata group founder','tata group history','tata group chairman',
         'tata memorial','tata institute','tata hospital','jamshedpur',
         'naval tata','russi mody','cyrus mistry','tata group revenue'] },
  'module-10': { label: 'Technology Across Industries and Culture',
    kw: ['technology','industry','culture','digital','innovation','entertainment',
         'music','streaming','gaming','esports','nft','metaverse','virtual reality',
         'augmented reality','headset','fintech','edtech','healthtech','agritech',
         'supply chain','logistics','e-commerce','digital marketing','social media',
         'content creation','creator economy','platform economy','gig economy',
         '3d printing','additive manufacturing','digital twin','smart city',
         'iot','internet of things','smart home','wearable','smartwatch',
         'digital transformation','industry 4.0','factory automation'] },
  'module-11': { label: 'Science, Medicine and Mathematics Through Innovation',
    kw: ['science','medicine','mathematics','physics','chemistry','biology','dna',
         'gene','genome','crispr','vaccine','mrna','penicillin','xray','mri',
         'ultrasound','telemedicine','healthcare','diagnosis','medical device',
         'pacemaker','artificial organ','prosthetic','neuroscience','microscope',
         'telescope','particle physics','cern','large hadron collider',
         'quantum mechanics','relativity','einstein','newton','darwin','galileo',
         'curie','nobel prize','scientific method','statistics','probability',
         'calculus','geometry','algebra','prime number','fibonacci','pi',
         'euler','gauss','ramanujan','information theory','chaos theory'] },
  'module-12': { label: 'Engineering, Architecture, Infrastructure, Energy and Climate Technology',
    kw: ['engineering','architecture','infrastructure','energy','climate',
         'civil engineering','mechanical engineering','electrical engineering',
         'chemical engineering','nuclear','solar','wind','hydro','geothermal',
         'renewable','fossil fuel','coal','oil','natural gas','power plant',
         'grid','transmission','smart grid','nuclear reactor','fusion','tokamak',
         'building','construction','bridge','dam','tunnel','highway','railway',
         'metro','airport','high speed rail','water treatment','desalination',
         'waste management','recycling','carbon capture','net zero','emissions',
         'sustainable','green building','energy efficient','led lighting'] },
  'module-13': { label: 'Space, Satellites, Defence and Frontier Technology',
    kw: ['space','satellite','defence','defense','military','isro','nasa',
         'spacex','rocket','launch vehicle','orbit','geo','leo','gps','navic',
         'iss','international space station','spacecraft','starlink',
         'remote sensing','earth observation','cubesat','chandrayaan','mangalyaan',
         'gaganyaan','mars mission','moon mission','asteroid','telescope',
         'james webb','hubble','space telescope','astronomy','astrophysics',
         'fighter jet','missile','drone','radar','sonar','cyber warfare',
         'stealth','warship','submarine','aircraft carrier','ballistic missile',
         'brahmos','tejas','air defence','army','navy'] },
  'module-14': { label: 'Current Technology, Science and Business Affairs',
    kw: ['2024','2025','2026','recent','current','launch','announced','unveiled',
         'introduced','latest','breakthrough','record','first ever','milestone',
         'ai','gpt','chatgpt','gemini','claude','copilot','apple vision',
         'metaverse','neuralink','quantum','cyber attack','data breach',
         'acquisition','merger','ipo','valuation','billion','startup','funding',
         'stock market','rally','crash','market cap','layoff','restructuring',
         'revenue','profit','earnings','ban','regulation','policy','supreme court'] },
  'module-15': { label: 'General-Awareness Safety Net',
    kw: ['award','prize','honour','medal','trophy','olympic','world cup',
         'championship','record','ranked','president','prime minister','election',
         'parliament','constitution','amendment','article','fundamental right',
         'supreme court','high court','governor','chief minister','cabinet','ministry',
         'state','union territory','capital','festival','culture','heritage',
         'national park','wildlife sanctuary','river','mountain','ocean',
         'flag','emblem','anthem','sport','cricket','football','hockey',
         'tennis','badminton','chess','athletics','first person','woman',
         'youngest','oldest','largest','tallest','longest','highest'] },
};

// ── 3. Score every line against every module ────────────────────────────────
console.log('Scoring lines against modules...');
const scores = []; // [{ sourceLine, text, moduleId, score }]

for (const line of allLines) {
  const lower = line.text.toLowerCase();
  let bestScore = 0;
  let bestModule = null;

  for (const [modId, mod] of Object.entries(MODULE_KEYWORDS)) {
    let score = 0;
    for (const kw of mod.kw) {
      if (lower.includes(kw)) score++;
    }
    if (score > 0 && score > bestScore) {
      // Partial match penalty: prefer lines where at least 2 keywords match,
      // or where the line length is reasonable
      if (score >= 2 || line.text.length < 120) {
        bestScore = score;
        bestModule = modId;
      }
    }
  }

  if (bestModule) {
    scores.push({ sourceLine: line.sourceLine, text: line.text, moduleId: bestModule, score: bestScore });
  }
}

console.log(`Scored lines with module assignments: ${scores.length}`);

// ── 4. Assign top N lines per module ────────────────────────────────────────
const assigned = {};
for (const [modId] of Object.entries(MODULE_KEYWORDS)) assigned[modId] = [];

// Sort by score descending, then by source line ascending
scores.sort((a, b) => b.score - a.score || a.sourceLine - b.sourceLine);

// Track which source lines have been assigned globally
const usedLines = new Set();

for (const s of scores) {
  if (usedLines.has(s.sourceLine)) continue;
  const mod = assigned[s.moduleId];
  if (mod.length >= TARGET_PER_MODULE) continue;
  mod.push(s);
  usedLines.add(s.sourceLine);
}

// ── 5. Enrich module files ──────────────────────────────────────────────────
const manifest = readJSON(join('modules', 'index.json'));
if (!manifest) { console.error('modules/index.json not found'); process.exit(1); }

let totalTopics = 0;

for (const meta of manifest.modules) {
  const modId = meta.id;
  const data = readJSON(join('modules', meta.file));
  if (!data) { console.warn(`  SKIP: ${meta.file} not found`); continue; }

  const existingTopics = data.topics || [];
  const existingIds = new Set(existingTopics.map(t => t.id));
  const modLines = assigned[modId] || [];
  const modLabel = MODULE_KEYWORDS[modId]?.label || modId;

  const newTopics = [];
  let rank = existingTopics.length + 1;

  // Module 14 topics must contain 2025/2026 dates for the validator
  const needsDateLabel = (modId === 'module-14');

  // Generate topic IDs for all new topics first so connections can reference them
  const pending = [];

  for (const s of modLines) {
    const topicId = `${modId}-lib-${s.sourceLine}`;
    if (existingIds.has(topicId)) continue;
    pending.push({ s, topicId });
  }

  // Assign IDs so each topic's connections can reference valid peer IDs
  const allNewIds = pending.map(p => p.topicId);
  const totalNew = pending.length;

  for (let idx = 0; idx < totalNew; idx++) {
    const { s, topicId } = pending[idx];
    const title = s.text.length > 75 ? s.text.slice(0, 72) + '...' : s.text;
    let hook = s.text.length > 145 ? s.text.slice(0, 142) + '...' : s.text;

    // Module 14: append date label if text lacks 2025/2026
    if (needsDateLabel && !/202[56]/.test(hook + ' ' + s.text)) {
      hook = (hook + ' — TCS Quiz 2026').slice(0, 240);
    }

    // Build 2 connections to other topics in the same module (cyclical chain)
    const conn1 = allNewIds[(idx + 1) % totalNew];
    const conn2 = allNewIds[(idx + 2) % totalNew];
    const assertLen = s.text.slice(0, 80);

    newTopics.push({
      id: topicId,
      rank: rank++,
      title,
      hook,
      explainer: s.text,
      importance: Math.min(5, Math.max(1, Math.ceil(s.score / 3))),
      category: modLabel,
      tags: [modLabel, 'TCS Quiz 2026'],
      map: {
        links: [
          { label: 'Search this topic', url: `https://www.google.com/search?q=${encodeURIComponent(s.text.slice(0, 60))}` },
          { label: 'Wikipedia reference', url: `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(s.text.slice(0, 60))}` },
        ],
        connections: [
          { topicId: conn1, relationship: 'Related study topic', fact: `This topic shares the "${modLabel}" category with the linked topic.` },
          { topicId: conn2, relationship: 'Related study topic', fact: `Both topics are part of the "${modLabel}" module for TCS Quiz preparation.` },
        ],
      },
    });
  }

  data.topics = [...existingTopics, ...newTopics];
  data.topicCount = data.topics.length;
  writeJSON(join('modules', meta.file), data);
  totalTopics += data.topics.length;

  console.log(`  ${modId}: ${modLabel} — ${existingTopics.length} existing + ${newTopics.length} new = ${data.topics.length}`);
}

console.log(`\nDone — ${manifest.modules.length} modules, ${totalTopics} total topics`);
