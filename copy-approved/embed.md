# Page copy: /embed

- **Title:** Put the Age Calculator on Your Website
- **Meta description:** Free embed code for the agecalculator.com age calculator. Paste an iframe or a self-sizing script; no adverts inside, no cookies.
- **H1:** Put this age calculator on your site
- **Indexing:** noindex (instructions page, per SEO spec section 4.1)

---

## Body

You can put the same age calculator that runs on our homepage on your own site for free. It works out a visitor's age in years, months and days from their date of birth, with the option to pick another "age on" date and time zone. There are no adverts inside it. All we ask is that you keep the credit link underneath.

## Simplest: an iframe

Paste this anywhere you can add HTML, including WordPress, Squarespace and Google Sites:

```html
<iframe src="https://agecalculator.com/widget" title="Age calculator" width="100%" height="760" style="border:0;max-width:440px" loading="lazy"></iframe>
<p><a href="https://agecalculator.com/">Age calculator by agecalculator.com</a></p>
```

The frame is 760 pixels tall, which fits the result at the full 440-pixel width. On narrower screens the result can run longer and the frame then scrolls inside itself, so use the script below if you'd rather the frame grow to fit.

## Or a script that sizes itself

```html
<div data-agecalculator></div>
<script src="https://agecalculator.com/embed.js" async></script>
<p><a href="https://agecalculator.com/">Age calculator by agecalculator.com</a></p>
```

The script puts the same calculator inside the `div` and adjusts its height as the result grows, so there's no inner scroll bar. You can use more than one `div` on a page.

## Width and size

Both versions fill the width they are given, up to 440 pixels. To make the calculator narrower, lower the `max-width` in the iframe's style; it works from 300 pixels up. The script version uses the same 440-pixel maximum.

## Starting with a date filled in

The iframe version can open with a date already in place. Add it to the address:

```html
<iframe src="https://agecalculator.com/widget?dob=15%20March%201995&tz=Europe/London" title="Age calculator" width="100%" height="760" style="border:0;max-width:440px" loading="lazy"></iframe>
```

`dob` fills in the date of birth (written in words or numbers, with spaces as `%20`), `on` sets the "age on" date, and `tz` sets the time zone used for "today". Without `tz`, the calculator uses each visitor's own time zone. The script version doesn't take these options.

## What your visitors get

The calculator reads dates the way people type them, such as 15 March 1995 or 15/03/1995. It shows age in years, months and days, the next birthday, and the same span in months, weeks, days and hours. A 29 February birthday counts on 1 March in common years.

Dates are worked out in the visitor's browser and aren't sent to us. The calculator sets no cookies. Links inside it open in a new tab, so visitors don't leave your page.

## The credit link

Please keep the line "Age calculator by agecalculator.com" with its link, as in the snippets. The same credit also appears inside the calculator.
