Date rules for agecalculator.com
================================

Figures below are taken from the unit tests in tests/age.test.js, which
exercise docs/dates.js. The calculator uses the civil Gregorian calendar
and does not use JavaScript Date overflow (so 31 January plus one month
is never turned into 2 or 3 March by accident).

How a month is counted
----------------------
A completed month lands on the same date next month. If that date does
not exist, it rolls to the 1st of the next month. So 31 January plus one
month is 1 March, in both leap years and common years, and a 29 February
birthday in a common year is counted on 1 March. This site does not use
the last day of February. Common date libraries (for example date-fns,
Python’s dateutil and Java’s LocalDate) use the last day of the month
instead, so around month ends other tools can differ by a day or two.

Age is completed years first, then the leftover completed months, then
the leftover days. Totals in days, weeks and hours measure the same
span in one unit; they are not added on to the years-months-days age.
Hours are counted from midnight.

Leap years follow the usual Gregorian rule: a year is a leap year if it
divides by 4, unless it is a century that does not divide by 400. So
2000 and 2024 are leap years; 1900 and 2100 are not.

Worked examples (from the test suite)
-------------------------------------
Dates are written day-month-year. “On” is the date the age is worked
out for.

1. Born 14 March 1988, on 16 November 2026
   38 years, 8 months and 2 days (14,126 days; 2,018 weeks exactly;
   339,024 hours from midnight). Next birthday: Sunday 14 March 2027,
   in 118 days, turning 39.

2. Born 15 March 1995, on 16 November 2026 (the homepage example)
   31 years, 8 months and 1 day (11,569 days). Next birthday: Monday
   15 March 2027, in 119 days, turning 32.

3. Born 16 November 1990, on 16 November 2026 (birthday today)
   36 years, 0 months and 0 days (13,149 days). Next birthday is today,
   turning 36.

4. Born 17 November 1990, on 16 November 2026 (the day before the
   birthday)
   35 years, 11 months and 30 days (13,148 days). Next birthday:
   Tuesday 17 November 2026, in 1 day, turning 36.

5. Born 15 November 1990, on 16 November 2026 (the day after the
   birthday)
   36 years, 0 months and 1 day (13,150 days). Next birthday: Monday
   15 November 2027, in 364 days, turning 37.

6. Born 16 November 2026, on 16 November 2026 (born today)
   0 years, 0 months and 0 days. The day they were born. Next birthday
   is 16 November 2027, turning 1.

7. Born 29 February 2000, on 1 March 2001
   1 year, 0 months and 0 days (366 days). The birthday is counted
   today and is shifted to 1 March.

8. Born 29 February 2000, on 28 February 2001
   0 years, 11 months and 30 days (365 days). Next birthday: Thursday
   1 March 2001, in 1 day, turning 1 (shifted).

9. Born 29 February 2000, on 29 February 2004
   4 years, 0 months and 0 days (1,461 days). The birthday is today
   and is not shifted, because 2004 is a leap year.

10. Born 29 February 2000, on 16 November 2026
    26 years, 8 months and 18 days (9,757 days). Next birthday: Monday
    1 March 2027, in 105 days, turning 27 (shifted).

11. Born 31 January 2000, on 29 February 2000
    0 years, 0 months and 29 days (29 days). Even in a leap year this
    is not yet one completed month.

12. Born 31 January 2000, on 1 March 2000
    0 years, 1 month and 0 days (30 days). One month after 31 January
    is 1 March, not 29 February.

13. Born 31 January 2001, on 28 February 2001
    0 years, 0 months and 28 days (28 days). On 1 March 2001 it is
    0 years, 1 month and 0 days (29 days).

14. Born 31 March 2020, on 30 April 2020
    0 years, 0 months and 30 days (30 days). On 1 May 2020 it is
    0 years, 1 month and 0 days (31 days). There is no 31 April, so
    one month after 31 March is 1 May.

15. Adding months (same roll-to-the-1st rule)
    31 January 2026 plus 1 month → 1 March 2026
    31 January 2024 plus 1 month → 1 March 2024 (leap year; not 29 February)
    31 May 2026 plus 1 month → 1 July 2026
    29 February 2024 plus 12 months → 1 March 2025
    29 February 2024 plus 48 months → 29 February 2028
    31 December 2019 plus 2 months → 1 March 2020

Other cases from the same tests
-------------------------------
A date of birth of 1 January 2027, on 16 November 2026, is not born yet
(46 days until birth).

Korean ages for someone born 15 March 1995, on 16 November 2026:
international age 31, counting age 32, year age 31.

Days between 16 November 2026 and 23 November 2026: 7 days, of which
5 are weekdays and 2 are weekend days (the start date is included and
the end date is not).
