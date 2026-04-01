#!/usr/bin/env python3
"""Extract text from DOCX files in the PRD folder."""
import zipfile
import xml.etree.ElementTree as ET
import os
import sys

def extract_docx(filepath):
    """Extract paragraphs and table cells from a .docx file."""
    z = zipfile.ZipFile(filepath)
    xml_content = z.read('word/document.xml')
    root = ET.fromstring(xml_content)
    ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
    
    output = []
    
    # Extract paragraphs
    for p in root.findall('.//w:p', ns):
        texts = [t.text for t in p.findall('.//w:t', ns) if t.text]
        line = ''.join(texts).strip()
        if line:
            output.append(line)
    
    return '\n'.join(output)

if __name__ == '__main__':
    prd_dir = os.path.join(os.path.dirname(__file__), 'PRD')
    
    files = [
        'FPE_Dashboard_Wireframes_v4.docx',
        'FPE_Traceability_Matrix_v3.docx',
    ]
    
    for fname in files:
        fpath = os.path.join(prd_dir, fname)
        if os.path.exists(fpath):
            print(f"\n{'='*80}")
            print(f"FILE: {fname}")
            print(f"{'='*80}")
            text = extract_docx(fpath)
            print(text)
        else:
            print(f"NOT FOUND: {fpath}")
