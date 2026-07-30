#!/usr/bin/env python3
"""Generate data/p5-classes.json from the official TEI p5subset.

Usage:
    curl -sL -o p5subset.xml "https://www.tei-c.org/Vault/P5/current/xml/tei/odd/p5subset.xml"
    python3 tools/generate-classes.py p5subset.xml

Re-run at every TEI release. The coverage test in test/run.js fails if a new
element or module has no assignment path: that failure is the feature.
"""
import sys, json, os
import xml.etree.ElementTree as ET

T = '{http://www.tei-c.org/ns/1.0}'
NS = {'tei': 'http://www.tei-c.org/ns/1.0'}

src = sys.argv[1] if len(sys.argv) > 1 else 'p5subset.xml'
out = os.path.join(os.path.dirname(__file__), '..', 'data', 'p5-classes.json')

root = ET.parse(src).getroot()

version = ''
for e in root.iter(T + 'edition'):
    version = ''.join(e.itertext()).strip()
    break

elements = {}
for spec in root.iter(T + 'elementSpec'):
    member = [m.get('key') for m in spec.findall('.//tei:classes/tei:memberOf', NS)]
    elements[spec.get('ident')] = {
        'module': spec.get('module', ''),
        'memberOf': member,
    }

classes = {}
for spec in root.iter(T + 'classSpec'):
    member = [m.get('key') for m in spec.findall('.//tei:classes/tei:memberOf', NS)]
    classes[spec.get('ident')] = {
        'type': spec.get('type', ''),
        'memberOf': member,
    }

data = {'source': 'p5subset', 'version': version,
        'elements': elements, 'classes': classes}
with open(out, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
print(f"{out}: {len(elements)} elements, {len(classes)} classes, TEI version: {version or '?'}")
