#!/usr/bin/env python3
"""
sync.py — shim di compatibilita'.

L'implementazione vive in tools/sync.py dalla v2.0.0. Questo file resta
alla root perche' le installazioni v1 lanciano `python <root>/sync.py`.
"""
import os
import runpy
import sys

_here = os.path.dirname(os.path.abspath(__file__))
_impl = os.path.join(_here, 'tools', 'sync.py')

if not os.path.isfile(_impl):
    sys.stderr.write("Errore: tools/sync.py mancante. Riesegui l'installazione (skill llm-wiki-setup).\n")
    sys.exit(1)

sys.path.insert(0, os.path.join(_here, 'tools'))
runpy.run_path(_impl, run_name='__main__')
