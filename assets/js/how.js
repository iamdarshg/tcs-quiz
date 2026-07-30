// Static primer page. Content, not logic.

export function viewHow() {
  return `
  <div class="page-head">
    <h1>How CLAT actually tests general knowledge</h1>
    <p class="sub">Worth ten minutes before you start reading months. The section is not a quiz, and people who prepare for it like a quiz lose marks they did not need to lose.</p>
  </div>

  <div class="topic-body">
    <article>
      <div class="prose">
        <h3>The shape of the paper</h3>
        <p>CLAT is 120 questions in 120 minutes, one mark for a correct answer and a quarter mark off for a wrong one. Unattempted questions cost nothing, which matters more than most aspirants act like it does. Five sections:</p>
        <ul>
          <li><strong>Current Affairs including General Knowledge</strong> — 28 to 32 questions, about 25% of the paper</li>
          <li><strong>Legal Reasoning</strong> — 28 to 32 questions</li>
          <li><strong>English Language</strong> — 22 to 26 questions</li>
          <li><strong>Logical Reasoning</strong> — 22 to 26 questions</li>
          <li><strong>Quantitative Techniques</strong> — 10 to 14 questions</li>
        </ul>
        <p>So the GK section is tied with legal reasoning for the largest block of marks in the paper. It is also the one section where you can walk in already knowing the answers, which is why it decides so many ranks.</p>

        <h3>Everything is a passage</h3>
        <p>Since the 2020 revision, nothing in this section is a standalone one-liner. You get 450 words lifted or adapted from a newspaper — usually The Hindu, the Indian Express, or a wire agency — and then four to six questions hanging off it. The passage gives you the news event. The questions mostly do not.</p>
        <p>That gap is the whole design. A passage about a UN Security Council vote will tell you the vote happened and roughly why. The questions will ask you which countries hold permanent seats, what the veto is, which year the UN was founded, and which body the passage is contrasting the Council with. None of that is in the text. The passage is a doorway into a body of knowledge the paper assumes you already walked around in.</p>

        <h3>The five question types you keep meeting</h3>
        <p>Across past papers the questions sort into a small number of shapes. Recognising which one you are looking at is half the work.</p>
        <ul>
          <li><strong>Direct recall attached to the passage.</strong> "Who is the current Secretary-General of the UN?" Free marks if you know it, zero if you do not. No reasoning will rescue you.</li>
          <li><strong>The corollary.</strong> The passage mentions an event; the question asks about the institution, treaty, or precedent behind it. This is where the connection maps on this site earn their keep.</li>
          <li><strong>Static GK smuggled in.</strong> A current affairs passage on a wildlife sanctuary asks which state it is in, which river runs through it, which schedule of the Wildlife Protection Act covers the species. Half the section is really static.</li>
          <li><strong>Which of the following is correct.</strong> Four statements, pick the true one or the combination. Punishing, because being 75% sure of three statements does not get you there.</li>
          <li><strong>Inference from the passage alone.</strong> The rare question you can answer without outside knowledge. Do these first.</li>
        </ul>

        <h3>What the section actually rewards</h3>
        <p>Breadth beats depth, up to a point. The paper would rather you knew one solid fact about forty events than everything about five. But the forty facts have to be the right kind: names, years, numbers, headquarters, article numbers, who succeeded whom. "India signed a trade agreement with the EU" is not a fact you can be tested on. "India and the EU concluded their FTA after negotiations that restarted in June 2022, covering roughly a fifth of India's merchandise trade" contains four.</p>
        <p>The other thing it rewards is connection. Examiners build questions by walking outward from a news event to the things attached to it. If you have only stored the event, you can answer one question. If you have stored the event plus its history, its institution, its rival, and its Indian equivalent, you can answer the whole set.</p>

        <h3>The static half nobody plans for</h3>
        <p>Roughly a third to a half of the section is not really current at all. Constitutional provisions, landmark judgments, national symbols, geography, the founding years and headquarters of international organisations, awards and their fields, sports trophies, books and authors. It is finite and it does not change. It is also the part most aspirants leave until three weeks before the exam, which is a strange choice given that it is the only part that cannot go stale.</p>

        <h3>What to do with a wrong answer</h3>
        <p>The negative marking is 0.25, so a blind guess across four options breaks even in expectation and a guess where you have eliminated one option is clearly worth taking. Pure blind guessing on questions where you recognise nothing is not worth it once you account for the questions you are misreading under time pressure. Eliminate one, then commit.</p>

        <h3>How this site is meant to be used</h3>
        <ul>
          <li><strong>Read a month top to bottom, in rank order.</strong> The ranking is a claim about exam probability, so the first twelve topics deserve real attention and the tail deserves a skim.</li>
          <li><strong>Open the map on every deep topic.</strong> The centre is the news. The first ring is what an examiner reaches for immediately. Anything on the first ring you cannot explain out loud is a gap.</li>
          <li><strong>Do not quiz until you have read.</strong> Testing yourself on material you have never seen produces a score, not learning.</li>
          <li><strong>Then quiz narrow.</strong> One month, one category, ten questions. Wide random papers feel productive and teach you less than drilling the thing you just got wrong.</li>
        </ul>
      </div>
    </article>

    <aside class="side">
      <div class="box">
        <h4>The section at a glance</h4>
        <dl class="facts">
          <div><dt>Questions</dt><dd>28–32 of 120</dd></div>
          <div><dt>Share of paper</dt><dd>About 25%</dd></div>
          <div><dt>Format</dt><dd>Passage of ~450 words, then 4–6 questions</dd></div>
          <div><dt>Marking</dt><dd>+1 correct, −0.25 wrong, 0 blank</dd></div>
          <div><dt>Total time</dt><dd>120 minutes for the whole paper</dd></div>
          <div><dt>Realistic budget</dt><dd>20–24 minutes on this section</dd></div>
          <div><dt>Source material</dt><dd>The Hindu, Indian Express, PIB, wire copy</dd></div>
          <div><dt>Current affairs window</dt><dd>Roughly the 12 months before the exam</dd></div>
        </dl>
      </div>
      <div class="box">
        <h4>A working routine</h4>
        <div class="why">One month of this site per week gets you through a year of current affairs in three months with room to revise. Read Monday to Thursday, quiz that month on Friday, and re-quiz the previous month on Saturday. The second pass is where the retention actually happens.</div>
      </div>
    </aside>
  </div>`;
}
