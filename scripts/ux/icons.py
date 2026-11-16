"""Bespoke pen-line icons for agecalculator.com. Drawn by hand for this site: 24-unit grid, one 1.7 stroke,
round ends, slightly uneven lines so they sit with the biro ring. Not from any icon set."""
P = {
 'cake': 'M4.2 20.6c5.3.3 10.4.2 15.6-.1M5.3 20.3l.2-7.3c4.4-.6 8.7-.5 13.1.1l.1 7.1M5.4 15.5c1.2 1.1 2.3 1.1 3.3.1 1.1-1 2.2-1 3.2 0 1.1 1 2.2.9 3.3-.1 1.1-1 2.1-.9 3.3.2M12 12.5V8.6M12 6.7c-1-.9-.9-2.2.1-3.3.9 1.2 1 2.4-.1 3.3z',
 'clock': 'M12 3.4c4.9-.1 8.6 3.7 8.6 8.5 0 4.8-3.8 8.7-8.7 8.6-4.7-.1-8.4-3.9-8.3-8.7.1-4.6 3.6-8.3 8.6-8.5.6 0 1.2.1 1.7.2M12 7.4v4.8l3.1 2.1',
 'printer': 'M7.1 9V3.9h9.7V9M5.8 17.3H4.4c-.6 0-1.1-.4-1.1-1V10.1c0-.6.5-1.1 1.1-1.1h15.3c.6 0 1 .5 1 1.1v6.2c0 .6-.4 1-1 1h-1.5M7.1 14.1l9.9.1-.1 6.3H7.2z',
 'copy': 'M8.7 8.4l10.4.1-.1 12H8.6zM15.3 8.3V4.2L4.9 4.3l-.1 12.1h3.7',
 'boxes': 'M3.4 8.9l4.7.1v6.1H3.5zM10 9h4.3l.1 6h-4.4zM16.4 8.9h4.2v6.2h-4.2z',
 'chev': 'M6.5 9.4c1.9 1.7 3.7 3.4 5.5 5.2 1.8-1.8 3.6-3.6 5.5-5.3',
 'tick': 'M4.6 12.8c1.5 1.3 2.9 2.7 4.1 4.3 3.1-4.2 6.5-8 10.6-11.2',
 'menu': 'M4 7.2c5.4-.3 10.7-.2 16 .1M4 12.1c5.3-.2 10.6-.1 16 0M4 16.9c3.6-.2 7.2-.2 10.8 0',
 'plus': 'M12 5.3v13.5M5.2 12.1c4.5-.2 9-.2 13.6 0',
}
def icon(name, cls=''):
    return f'<svg class="ic ic-{name}{(" " + cls) if cls else ""}" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="{P[name]}"/></svg>'
