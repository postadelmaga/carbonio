#!/usr/bin/env python3
"""
build.py — genera le versioni tradotte del sito dal sorgente italiano.

L'italiano in index.html resta l'unica copia autoritativa: da lì lo script
estrae le unità traducibili (il contenuto dei blocchi che contengono solo
testo e tag inline, più alcuni attributi), le cerca in i18n/<lingua>.json e
scrive en/index.html, es/index.html, zh/index.html.

  ./build.py --extract        scrive i18n/_chiavi.json con le unità da tradurre
  ./build.py                  genera le pagine tradotte (fallisce se manca una voce)
  ./build.py --allow-missing  genera lasciando in italiano le voci mancanti

Perché le chiavi contengono anche i tag inline (<b>, <abbr>, <span>): così la
traduzione conserva grassetti e agganci ai dati in diretta, e se il markup
italiano cambia la voce non combacia più e il build lo dice, invece di
lasciare silenziosamente una frase vecchia.
"""
import json, re, sys, os
from bs4 import BeautifulSoup, NavigableString, Tag

QUI = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(QUI, 'index.html')
LINGUE = {'en': 'English', 'es': 'Español', 'zh': '中文'}

INLINE = {'b','i','em','strong','abbr','span','small','a','sub','sup','br','code','u','mark'}
SALTA   = {'script','style','svg','head'}
ATTR_TRAD = ('title','aria-label','alt','placeholder')

def contenitore(tag):
    """True se il tag non è una frase ma un involucro di più unità distinte:
    la barra di navigazione, le quattro cifre dell'apertura, una didascalia con
    la variante telefono e quella desktop. Regola: niente testo nudo e due o più
    figli con testo; con un figlio solo si guarda dentro quel figlio, così un
    <li> che avvolge un <a> non conta come unità unica."""
    nudo = any(isinstance(c, NavigableString) and c.strip() for c in tag.children)
    if nudo: return False
    figli = [c for c in tag.children if isinstance(c, Tag) and c.get_text(strip=True)]
    if len(figli) >= 2: return True
    if len(figli) == 1: return contenitore(figli[0])
    return False

def solo_inline(tag):
    """True se il contenuto del tag è UNA unità di testo: c'è del testo, non ci
    sono figli di blocco, e non è un involucro di unità separate."""
    ha_testo = False
    for c in tag.children:
        if isinstance(c, NavigableString):
            if c.strip(): ha_testo = True
        elif isinstance(c, Tag):
            if c.name not in INLINE: return False
            if c.get_text(strip=True): ha_testo = True
    return ha_testo and not contenitore(tag)

def unita(soup):
    """Ritorna la lista ordinata dei tag il cui contenuto va tradotto."""
    fuori = []
    def visita(tag):
        for c in tag.children:
            if not isinstance(c, Tag): continue
            if c.name in SALTA: continue
            if solo_inline(c):
                fuori.append(c)
            else:
                visita(c)
    visita(soup.body)
    return fuori

def chiave(tag):
    """innerHTML del tag, normalizzato dove il parser si discosta dal sorgente."""
    return ''.join(str(x) for x in tag.contents).strip().replace('<br/>', '<br>')

def dentro_selettore(tag):
    """I nomi delle lingue nel selettore non si traducono mai: «English» resta
    English anche nella pagina cinese, altrimenti chi cerca la propria lingua
    non la riconosce. La bandiera e il codice li scrive il build."""
    for p in tag.parents:
        c = p.get('class') or []
        if 'lang' in c: return True
    return False

def raccogli(soup):
    testi, attributi = [], []
    for t in unita(soup):
        if dentro_selettore(t): continue
        k = chiave(t)
        # I numeri puri restano unità traducibili: in inglese e cinese la virgola
        # decimale diventa un punto, e «40,9» va scritto «40.9».
        if k: testi.append(k)
    # Gli attributi si raccolgono anche dentro gli <svg>: il testo dei grafici lo
    # scrive JavaScript, ma aria-label e' una frase fissa che descrive la figura
    # a chi usa un lettore di schermo, e va tradotta come il resto.
    for t in soup.find_all(True):
        if t.name in ('script', 'style') or dentro_selettore(t): continue
        for a in ATTR_TRAD:
            v = t.get(a)
            if v and not re.fullmatch(r'[\d\s.,%+\-–—·/]+', v): attributi.append(v)
    for t in soup.head.find_all('meta') if soup.head else []:
        if t.get('name') in ('description',) or t.get('property') in ('og:title','og:description','twitter:title','twitter:description'):
            if t.get('content'): attributi.append(t['content'])
    if soup.head and soup.head.title: attributi.append(soup.head.title.string or '')
    # dedup conservando l'ordine
    vis, fuori = set(), []
    for k in testi + attributi:
        k = k.strip()
        if k and k not in vis:
            vis.add(k); fuori.append(k)
    return fuori

LANG_META = {
    'en': {'lang':'en', 'locale':'en_GB', 'dec':'.', 'fl':'🇬🇧', 'lc':'EN'},
    'es': {'lang':'es', 'locale':'es_ES', 'dec':',', 'fl':'🇪🇸', 'lc':'ES'},
    'zh': {'lang':'zh', 'locale':'zh_CN', 'dec':'.', 'fl':'🇨🇳', 'lc':'中文'},
}

def sostituisci(src, chiave, valore, errori):
    """Sostituisce il contenuto di un'unità lasciando intatto tutto il resto del
    file: si cerca la chiave fra un '>' e un '<', con gli spazi che ci sono."""
    pat = re.compile(r'(>)(\s*)' + re.escape(chiave) + r'(\s*)(<)', re.S)
    nuovo, n = pat.subn(lambda m: m.group(1)+m.group(2)+valore.replace('\\','\\\\')+m.group(3)+m.group(4), src)
    if n == 0: errori.append(chiave)
    return nuovo

def sostituisci_attr(src, chiave, valore, errori):
    pat = re.compile(r'((?:title|aria-label|alt|content)=")' + re.escape(chiave) + r'(")')
    nuovo, n = pat.subn(lambda m: m.group(1)+valore+m.group(2), src)
    if n == 0: errori.append('[attr] ' + chiave)
    return nuovo

def genera(codice, dizionario, permissivo):
    meta = LANG_META[codice]
    src = open(SRC, encoding='utf-8').read()
    soup = BeautifulSoup(src, 'html.parser')
    html_dict = dizionario.get('html', {})
    mancanti, non_trovate = [], []

    # Dalla chiave piu' lunga alla piu' corta: «Italia» e «osservato» compaiono
    # anche dentro unita' piu' grandi, e sostituendole prima le spezzerebbero.
    for k in sorted(raccogli(soup), key=len, reverse=True):
        v = html_dict.get(k)
        if v is None:
            mancanti.append(k); continue
        if v == k: continue
        if k not in src:
            continue   # gia' tradotta dentro un'unita' piu' grande che la contiene
        if re.search(r'(?:title|aria-label|alt|content)="' + re.escape(k) + '"', src):
            src = sostituisci_attr(src, k, v, non_trovate)
        else:
            src = sostituisci(src, k, v, non_trovate)

    # radice del documento
    src = src.replace('<html lang="it" data-lingua="it"', '<html lang="%s" data-lingua="%s"' % (meta['lang'], codice))
    src = src.replace('<meta property="og:locale" content="it_IT">', '<meta property="og:locale" content="%s">' % meta['locale'])
    src = src.replace('<link rel="canonical" href="__ROOT__/">', '<link rel="canonical" href="__ROOT__/%s/">' % codice)
    src = src.replace('<meta property="og:url" content="__ROOT__/">', '<meta property="og:url" content="__ROOT__/%s/">' % codice)
    # le pagine stanno in una sottocartella: percorsi assoluti per gli asset
    src = re.sub(r'(href|src)="assets/', r'\1="/assets/', src)
    # selettore: bandiera corrente e spunta sulla lingua attiva
    src = src.replace('<summary title="Lingua · Language"><span class="fl">🇮🇹</span><span class="lc">IT</span></summary>',
                      '<summary title="Lingua · Language"><span class="fl">%s</span><span class="lc">%s</span></summary>' % (meta['fl'], meta['lc']))
    src = src.replace('data-lang="it" hreflang="it" aria-current="true"', 'data-lang="it" hreflang="it"')
    src = src.replace('data-lang="%s" hreflang="%s"' % (codice, codice), 'data-lang="%s" hreflang="%s" aria-current="true"' % (codice, codice))
    # stringhe dei grafici e dei messaggi, lette da T() nei tre JavaScript
    js = dict(dizionario.get('js', {}))
    js['_dec'] = meta['dec']
    blocco = '<script>window.I18N=' + json.dumps(js, ensure_ascii=False, separators=(',', ':')) + ';</script>'
    src = src.replace('<link rel="stylesheet" href="/assets/style.css">', blocco + '\n<link rel="stylesheet" href="/assets/style.css">', 1)

    fuori = os.path.join(QUI, codice)
    os.makedirs(fuori, exist_ok=True)
    open(os.path.join(fuori, 'index.html'), 'w', encoding='utf-8').write(src)
    return mancanti, non_trovate

def main():
    soup = BeautifulSoup(open(SRC, encoding='utf-8').read(), 'html.parser')
    chiavi = raccogli(soup)
    if '--extract' in sys.argv:
        js = []
        for f in ('charts.js', 'live.js', 'slides.js'):
            testo = open(os.path.join(QUI, 'assets', f), encoding='utf-8').read()
            for m in re.finditer(r"\b(?:T|tr)\('((?:[^'\\]|\\.)*)'\)", testo):
                k = m.group(1).replace("\\'", "'")
                if k not in js: js.append(k)
        p = os.path.join(QUI, 'i18n', '_chiavi.json')
        json.dump({'html': chiavi, 'js': js}, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        par = sum(len(k.split()) for k in chiavi)
        print(f'{len(chiavi)} unità di pagina (circa {par} parole) + {len(js)} stringhe dai grafici → {p}')
        return
    permissivo = '--allow-missing' in sys.argv
    quali = [a for a in sys.argv[1:] if a in LANG_META] or list(LANG_META)
    guai = 0
    for codice in quali:
        f = os.path.join(QUI, 'i18n', codice + '.json')
        if not os.path.exists(f):
            print('  %s: manca %s, saltata' % (codice, f)); guai += 1; continue
        d = json.load(open(f, encoding='utf-8'))
        mancanti, non_trovate = genera(codice, d, permissivo)
        stato = 'ok' if not mancanti and not non_trovate else 'INCOMPLETA'
        print('  %s/index.html  %s  (%d voci mancanti, %d non agganciate)' % (codice, stato, len(mancanti), len(non_trovate)))
        for k in mancanti[:5]:   print('     manca:      ' + k[:90])
        for k in non_trovate[:5]: print('     non trovata: ' + k[:90])
        if (mancanti or non_trovate) and not permissivo: guai += 1
    if guai and not permissivo:
        print('\nAlcune lingue sono incomplete. Con --allow-missing genero lo stesso.')
        sys.exit(1)

if __name__ == '__main__':
    main()
