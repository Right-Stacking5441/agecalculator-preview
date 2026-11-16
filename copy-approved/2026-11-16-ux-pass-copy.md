# agecalculator.com: UX pass copy (16 November 2026)

Preview only. Final wording for the UX pass in /workspace/agecalculator-ui-wip/SPEC.md section 16.4. Control names were checked against the UX mock-up in /workspace/agecalculator-ui-wip/ux/site (app.js and the built HTML), because the repo at /workspace/agecalculator/docs (fb6d815) does not have the UX pass yet: it still has the old D/M/Y row, "As of" and the Korean checkbox. The page .md files in this folder have been updated to match and stay the source of truth.

## 1. Intro lines (one line under each H1, replaces the old lede)

Word counts split on spaces, so "years;months;days" and "8;4;12" count as one word each.

- **/** (main phrase: age calculator (also "how old am I"); 30 words)
  How old am I today? Type your date of birth and this age calculator gives your exact age in years, months and days, with the date of your next birthday.
- **/past** (main phrase: how old was I; 34 words)
  How old was I on that day? Add your date of birth and any past date, such as an exam, a wedding or a date a form asks about, to see your age then.
- **/difference** (main phrase: age difference calculator; 24 words)
  Put in two dates of birth and the age difference calculator tells you who is older and by how much, down to the day.
- **/days-between-dates** (main phrase: days between dates; 26 words)
  Count the days between dates, say from today to a deadline, and see how many of them are weekdays and how many fall at the weekend.
- **/chronological-age** (main phrase: chronological age calculator; 27 words)
  For test forms and reports, the chronological age calculator gives a child's age on the test date as years;months;days, such as 8;4;12, ready to copy or print.
- **/dog-age** (main phrase: dog age calculator; 27 words)
  Enter your dog's age and adult size, and the dog age calculator reads their age in human years from the AAHA-published chart, not the old times-seven rule.
- **/cat-age** (main phrase: cat age calculator; 30 words)
  Turn your cat's age into human years with this cat age calculator. It reads the figure from the AAHA-published chart and tells you which life stage your cat has reached.
- **/korean-age** (main phrase: Korean age calculator; 34 words)
  The Korean age calculator puts international age, Korean age and year age side by side for one date of birth, so you can see why a Korean age runs one or two years higher.
- **/birthday-countdown** (main phrase: birthday countdown; 31 words)
  Our birthday countdown tells you how many days are left until the next birthday and what day of the week it falls on, with a clock ticking down to midnight tonight.
- **/how-old-will-i-be** (main phrase: how old will I be; 33 words)
  How old will I be in 2050, or in any other year? Put in your date of birth and a year to see the age you reach and the day you reach it.
- **/what-year-was-i-born** (main phrase: what year was I born; 32 words)
  What year was I born, if I'm 31? Type your age and whether you've had your birthday yet this year, and you'll get the year, or both years if you're not sure.

Accuracy notes: the next birthday is on the homepage card; the /chronological-age card has Copy and Print slip; the dog chart needs adult size; cats show a life stage; the countdown's midnight clock is on the card, not behind More; "Not sure" is a real option on /what-year-was-i-born.

## 2. Copy that described the old screen

FAQ answers below are the exact final strings. The FAQPage JSON-LD must use the same text.

**/ (home.md), FAQ "Does this use Korean age or international age?"**
- Before: International age: you start at 0 and add a year on each birthday. Tick Show Korean age to see the traditional count beside it.
- After: International age: you start at 0 and add a year on each birthday. Open More under your result to see your Korean age beside it.

**/ (home.md), body, "Other ways of counting age"**
- Before: Tick Show Korean age to add it to your result, or use the [Korean age calculator](/korean-age) to see all three side by side.
- After: Your Korean age is under More in your result, or use the [Korean age calculator](/korean-age) to see all three side by side.

**/how-old-will-i-be FAQ "Can I check my age on a specific future day?"**
- Before: Yes. Press Change next to "Or pick" and type the date. The result then gives years, months and days on that day.
- After: Yes. Press Change next to "Or use an exact date" and type the date. The result then gives years, months and days on that day.

**/cat-age, body (first paragraph)**
- Before: If you leave the boxes empty, the result area shows a short chart of common ages instead.
- After: Before you type an age, the result card has a short chart of common ages under "Cat age chart".

Real labels checked: the card's disclosure is `<summary>More</summary>` (app.js `more()`); Korean age sits in it on the homepage card with Hours, Chronological age and Born on a. The cat empty card's disclosure is titled "Cat age chart" (once an age is typed, that card's More holds only the old "x 7" figure, so the chart is described as being there before you type). The how-old-will-i-be settings line is "Or use an exact date" with a Change button.

### Other old-UI descriptions found by the grep, and fixed

**home.md, body**
- Before: Below that, the same stretch of time is given in single units: total months, weeks, days and hours.
- After: Below that, the same stretch of time is given in single units: total months, weeks and days, with hours under More.

**home.md, body**
- Before: Your result shows that line as well.
- After: Your result shows that line too, under More.

**past.md, body**
- Before: The result also shows the birthday that came next after that date, and the same span in months, weeks and days.
- After: The result also shows the birthday that came next after that date, how many days you had lived by then, and how long ago the date was.

**past.md, body**
- Before: Today's date comes from your device's time zone, which is shown and can be changed.
- After: Today's date comes from your device's time zone, which you can change under Time zone.

**difference.md, body**
- Before: It also says who is older, by how many days in total, and gives the same gap in weeks and months. Names are optional.
- After: It also says who is older and by how many days, and under More gives the same gap in weeks and months. Names are optional: open Add names to type them.

**dog-age.md, body**
- Before: Beside it you'll see a second estimate from a 2020 DNA study, and the old "times seven" figure, ...
- After: Under More you'll see a second estimate from a 2020 DNA study, and the old "times seven" figure, ...

**birthday-countdown.md, body**
- Before: Under that you'll find the same wait in weeks, whether the birthday lands on a weekend, how many birthdays have gone by so far, and a clock counting down to midnight tonight.
- After: Under that you'll find the same wait in weeks and a clock counting down to midnight tonight. Open More to see whether the birthday lands on a weekend and how many birthdays have gone by so far.

**birthday-countdown.md, body**
- Before: **Weekend birthday?** tells you whether the date is a Saturday or Sunday. **Birthdays so far** is ...
- After: Under More, **Weekend birthday?** tells you whether the date is a Saturday or Sunday, and **Birthdays so far** is ...

**birthday-countdown.md, FAQ "What day of the week is my birthday this year?" (exact final string)**
- Before: The result names the weekday for your next birthday, and the line "Weekend birthday?" says whether it falls on a Saturday or Sunday.
- After: The result names the weekday for your next birthday, and the line "Weekend birthday?", under More, says whether it falls on a Saturday or Sunday.

**how-old-will-i-be.md, meta description**
- Before: ... Or pick an exact future date for years, months and days.
- After: ... Or choose an exact future date for years, months and days.

**how-old-will-i-be.md, body**
- Before: The result also lists your age on 1 January and on 31 December of that year, the weekday your birthday falls on, and how many days there are from today until it.
- After: The result also lists your age on 1 January and on 31 December of that year. Under More are the weekday your birthday falls on and how many days there are from today until it.

Checked and left alone because they still match: "Tick 'Count the end day too'" on /days-between-dates (still a visible checkbox); "press Change" on /, /how-old-will-i-be and /what-year-was-i-born (the Change button is still there); "Choose 'Not sure'" on /what-year-was-i-born; "the line underneath says how it has read your entry" on / (the readback line is still under the box); the copy and print buttons on /chronological-age; the three ages side by side on /korean-age.

Not changed, needs a decision: home.md still has a "## More calculators" link list. The UX pass removes that section and puts a "More calculators" row at the top of the content instead. I left it in the .md file; say if it should go.

## 3. UI labels

- **"Use boxes"**: approved. It is short and sits next to a boxes icon, and the aria-label "Type day, month and year in separate boxes" spells it out for screen readers.
- **"Add names" / "Add a name"**: approved.
- **"turning 39"**: approved. It reads well after the dot separator ("Next birthday Sun 14 Mar 2027 · 118 days · turning 39") and on /past.
- **"Weekdays" note**: change it. The code (dates.js `between`, app.js line 332) counts every Monday to Friday in the span and takes nothing out for bank holidays; with "Count the end day too" ticked it adds the end day if that is a weekday. Use: **"Mon to Fri, bank holidays still counted"**. "Mon to Fri" avoids a dash altogether, which also keeps it clean if anyone greps the code. Developer: the current string in app.js is "Mon(en dash)Fri, no bank holidays removed", so it has an en dash between Mon and Fri.
- **"Or use an exact date"**: approved. It reads as one line with the button: "Or use an exact date [Change]".
- **Headings "How to use the {tool}" / "{Tool} FAQs"**: the pattern works for the age calculator, age difference calculator, chronological age calculator, dog age calculator, cat age calculator, Korean age calculator and birthday countdown. Four pages need overrides because their tool name is a question or a plain phrase ("How to use the how old was I?" does not work). Final headings:
  - / : How to use the age calculator / Age calculator FAQs
  - /past: How to find your age on a past date / **Past age FAQs** (instead of the draft's "Past date age FAQs", which stacks three nouns; this pairs with "Future age FAQs")
  - /difference: How to use the age difference calculator / Age difference FAQs
  - /days-between-dates: How to count the days between dates / Days between dates FAQs
  - /chronological-age: How to use the chronological age calculator / Chronological age FAQs
  - /dog-age: How to use the dog age calculator / Dog age FAQs
  - /cat-age: How to use the cat age calculator / Cat age FAQs
  - /korean-age: How to use the Korean age calculator / Korean age FAQs
  - /birthday-countdown: How to use the birthday countdown / Birthday countdown FAQs
  - /how-old-will-i-be: How to work out a future age / Future age FAQs
  - /what-year-was-i-born: How to find your birth year / Birth year FAQs

  None of these repeat an existing H2 on its page.

Developer note outside the copy: the empty-card placeholder in app.js `ph()` renders an en dash as the big number. It is aria-hidden, but if the no-dash rule covers visible UI, it should be a hyphen or a different mark.

## 4. Page .md files changed

In every one of the 11 page files: the "Line under the H1" is the new intro line, the untitled first section under "## Body" now opens with its heading from section 3, and "## Questions people ask" is renamed to the page's FAQ heading. On top of that:

- home.md: two Korean age lines, hours under More, chronological line under More
- past.md: what the result shows, Time zone
- difference.md: More and Add names
- dog-age.md: DNA and "times seven" figures under More
- cat-age.md: the empty-card chart
- birthday-countdown.md: More (body x2, FAQ)
- how-old-will-i-be.md: meta, body, FAQ
- days-between-dates.md, chronological-age.md, korean-age.md, what-year-was-i-born.md: intro, first heading and FAQ heading only

Not changed: privacy.md, embed.md, widget.md.
