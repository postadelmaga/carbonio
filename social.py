#!/usr/bin/env python3
"""
social.py — disegna la cartolina di anteprima (Open Graph) per ogni lingua.

Facebook, LinkedIn, WhatsApp e Telegram non guardano la pagina: guardano
og:image. La pagina non ha nemmeno un <img>, i grafici sono SVG scritti da
JavaScript, e senza questa immagine il collegamento si incolla nudo, senza
riquadro. Qui la cartolina si disegna a mano, una per lingua, con gli stessi
colori e le stesse cifre dell'apertura.

  ./social.py              scrive assets/social-it.png e le altre tre
  ./social.py --svg        lascia anche gli SVG intermedi, per guardarli

Serve rsvg-convert (pacchetto librsvg). I caratteri Archivo e IBM Plex Mono si
scaricano da Google Fonts al primo giro e restano in .fonts-cache/ (ignorata da
git): se mancano si ripiega sui caratteri di sistema e la cartolina esce lo
stesso, solo con un'altra grazia.
"""
import json, os, re, shutil, subprocess, sys, tempfile
from urllib.request import urlopen, Request

QUI = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(QUI, '.fonts-cache')

W, H = 1200, 630          # la misura che Facebook ritaglia meno di tutte
M = 64                    # margine laterale
BARW = W - 2 * M

C = dict(ground='#F1F4F4', ink='#0E1B21', ink2='#455A61', ink3='#72868C',
         rule='#D2DBDC', source='#eb6834', ocean='#2a78d6', land='#1baf7a',
         atmos='#38474D')

# Le quattro cifre dell'apertura, medie 2015-2024 del Global Carbon Budget 2025.
# 11,8 + 8,7 + 20,4 = 40,9: la somma deve tornare, altrimenti la barra mente.
EMESSO, OCEANO, VEGETAZIONE, ARIA = 40.9, 11.8, 8.7, 20.4

LINGUE = {
 'it': dict(
   eyebrow='GLOBAL CARBON BUDGET 2025',
   titolo=('Il carbonio che ', 'resta'),
   deck='Ogni anno oceani e vegetazione ne assorbono circa la metà, gratis.',
   emesso='Emesso 40,9 GtCO₂ / anno', periodo='medie 2015–2024', totale='40,9',
   voci=[('11,8', 'oceano'), ('8,7', 'vegetazione'), ('20,4', 'resta in aria')]),
 'en': dict(
   eyebrow='GLOBAL CARBON BUDGET 2025',
   titolo=('The carbon that ', 'stays'),
   deck='Every year the ocean and vegetation absorb about half of it, for free.',
   emesso='Emitted 40.9 GtCO₂ / year', periodo='2015–2024 averages', totale='40.9',
   voci=[('11.8', 'ocean'), ('8.7', 'vegetation'), ('20.4', 'stays in the air')]),
 'es': dict(
   eyebrow='GLOBAL CARBON BUDGET 2025',
   titolo=('El carbono que ', 'queda'),
   deck='Cada año el océano y la vegetación absorben cerca de la mitad, gratis.',
   emesso='Emitido 40,9 GtCO₂ / año', periodo='medias 2015–2024', totale='40,9',
   voci=[('11,8', 'océano'), ('8,7', 'vegetación'), ('20,4', 'queda en el aire')]),
 'zh': dict(
   eyebrow='全球碳预算 2025',
   titolo=('留下来的', '碳'),
   deck='海洋与植被每年无偿吸收其中大约一半。',
   emesso='排放 40.9 GtCO₂ / 年', periodo='2015–2024 年平均', totale='40.9',
   voci=[('11.8', '海洋'), ('8.7', '植被'), ('20.4', '留在空气中')]),
}

SANS = "Archivo, 'Noto Sans CJK SC', 'Liberation Sans', sans-serif"
MONO = "'IBM Plex Mono', 'Noto Sans CJK SC', 'Liberation Mono', monospace"


def scarica_font():
    """Archivo e IBM Plex Mono da Google Fonts, una volta sola."""
    if os.path.isdir(CACHE) and [f for f in os.listdir(CACHE) if f.endswith('.ttf')]:
        return CACHE
    url = ('https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;700;800'
           '&family=IBM+Plex+Mono:wght@500;600&display=swap')
    try:
        css = urlopen(Request(url, headers={'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64)'}),
                      timeout=30).read().decode()
        os.makedirs(CACHE, exist_ok=True)
        for u in sorted(set(re.findall(r'https://[^)]*\.ttf', css))):
            dest = os.path.join(CACHE, os.path.basename(u))
            if not os.path.exists(dest):
                open(dest, 'wb').write(urlopen(u, timeout=30).read())
        return CACHE
    except Exception as e:
        print('  (caratteri non scaricati: %s — si usano quelli di sistema)' % e)
        return None


def esc(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def disegna(L):
    d = LINGUE[L]
    cjk = (L == 'zh')
    tit_size = 84 if not cjk else 76
    o = []
    add = o.append
    add('<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" '
        'viewBox="0 0 %d %d">' % (W, H, W, H))
    add('<rect width="%d" height="%d" fill="%s"/>' % (W, H, C['ground']))
    # la striscia in alto ripete la proporzione della barra: chi vede solo la
    # miniatura quadrata di WhatsApp coglie comunque le tre parti
    x = 0
    for q, col in ((OCEANO, 'ocean'), (VEGETAZIONE, 'land'), (ARIA, 'atmos')):
        w = W * q / EMESSO
        add('<rect x="%.1f" y="0" width="%.1f" height="7" fill="%s"/>' % (x, w + .5, C[col]))
        x += w

    # occhiello
    add('<text x="%d" y="104" font-family="%s" font-size="19" font-weight="600" '
        'letter-spacing="%s" fill="%s">%s</text>'
        % (M, MONO, '0' if cjk else '2.6', C['ink3'], esc(d['eyebrow'])))
    # titolo: l'ultima parola nel colore della sorgente, come in pagina
    add('<text x="%d" y="212" font-family="%s" font-size="%d" font-weight="800" '
        'letter-spacing="-1.5" fill="%s">%s<tspan fill="%s">%s</tspan></text>'
        % (M, SANS, tit_size, C['ink'], esc(d['titolo'][0]), C['source'], esc(d['titolo'][1])))
    # sommario
    add('<text x="%d" y="266" font-family="%s" font-size="29" font-weight="400" '
        'fill="%s">%s</text>' % (M, SANS, C['ink2'], esc(d['deck'])))

    # didascalia della barra
    ybar, hbar = 372, 76
    add('<text x="%d" y="%d" font-family="%s" font-size="20" font-weight="600" '
        'fill="%s">%s</text>' % (M, ybar - 18, SANS, C['ink'], esc(d['emesso'])))
    add('<text x="%d" y="%d" font-family="%s" font-size="17" font-weight="500" '
        'text-anchor="end" fill="%s">%s</text>'
        % (W - M, ybar - 18, MONO, C['ink3'], esc(d['periodo'])))

    # la barra: 40,9 divise in oceano, vegetazione, aria
    add('<clipPath id="r"><rect x="%d" y="%d" width="%d" height="%d" rx="10"/></clipPath>'
        % (M, ybar, BARW, hbar))
    add('<g clip-path="url(#r)">')
    x = M
    tagli = []
    for q, col in ((OCEANO, 'ocean'), (VEGETAZIONE, 'land'), (ARIA, 'atmos')):
        w = BARW * q / EMESSO
        add('<rect x="%.1f" y="%d" width="%.1f" height="%d" fill="%s"/>'
            % (x, ybar, w - 4, hbar, C[col]))
        tagli.append((x, w, col))
        x += w
    add('</g>')

    # sotto ogni fetta: la cifra nel suo colore e una parola sola
    for (x, w, col), (cifra, voce) in zip(tagli, d['voci']):
        add('<text x="%.1f" y="%d" font-family="%s" font-size="40" font-weight="700" '
            'fill="%s">%s</text>' % (x, ybar + hbar + 50, SANS, C[col], esc(cifra)))
        add('<text x="%.1f" y="%d" font-family="%s" font-size="%d" font-weight="400" '
            'fill="%s">%s</text>'
            % (x, ybar + hbar + 82, SANS, 22 if not cjk else 23, C['ink2'], esc(voce)))

    # piede
    add('<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="%s" stroke-width="1"/>'
        % (M, H - 54, W - M, H - 54, C['rule']))
    add('<text x="%d" y="%d" font-family="%s" font-size="19" font-weight="500" '
        'fill="%s">co2-info.duckdns.org</text>' % (M, H - 24, MONO, C['ink3']))
    add('<text x="%d" y="%d" font-family="%s" font-size="19" font-weight="500" '
        'text-anchor="end" fill="%s">%s = %s</text>'
        % (W - M, H - 24, MONO, C['ink3'],
           ' + '.join(c for c, _ in d['voci']), d['totale']))
    add('</svg>')
    return '\n'.join(o)


def main():
    fonts = scarica_font()
    if not shutil.which('rsvg-convert'):
        sys.exit('Manca rsvg-convert: installa librsvg.')
    env = dict(os.environ)
    tmp = None
    if fonts:
        # un fontconfig usa e getta: i caratteri scaricati piu' quelli di
        # sistema, che servono per il cinese
        tmp = tempfile.mkdtemp()
        open(os.path.join(tmp, 'fonts.conf'), 'w').write(
            '<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig>'
            '<dir>%s</dir><dir>/usr/share/fonts</dir><dir>~/.local/share/fonts</dir>'
            '<cachedir>%s/cache</cachedir></fontconfig>' % (fonts, tmp))
        env['FONTCONFIG_FILE'] = os.path.join(tmp, 'fonts.conf')
    for L in LINGUE:
        svg = os.path.join(QUI, 'assets', 'social-%s.svg' % L)
        png = os.path.join(QUI, 'assets', 'social-%s.png' % L)
        open(svg, 'w', encoding='utf-8').write(disegna(L))
        subprocess.run(['rsvg-convert', '-w', str(W), '-h', str(H), '-o', png, svg],
                       check=True, env=env)
        if '--svg' not in sys.argv:
            os.remove(svg)
        print('  %s  (%d kB)' % (os.path.relpath(png, QUI), os.path.getsize(png) // 1024))
    if tmp:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == '__main__':
    main()
