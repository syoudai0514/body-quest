"""Convert the official MEXT workbook; run with Python + openpyxl.
Usage: python scripts/import-food-composition.py /path/to/downloaded.xlsx
The downloaded file is not a repository dependency; the generated JSON is offline data.
"""
import hashlib, json, math, re, sys
from pathlib import Path
import openpyxl
SOURCE='https://www.mext.go.jp/content/20260327-mxt_kagsei-mext-000029402_02.xlsx'
path=Path(sys.argv[1]); rows=list(openpyxl.load_workbook(path,read_only=True,data_only=True).worksheets[0].values)
header=rows[11]
assert header[6]=='ENERC_KCAL' and header[9]=='PROT-' and header[12]=='FAT-' and header[20]=='CHOCDF-', 'Workbook columns changed; review before importing'
def number(value):
 if isinstance(value,(int,float)):return value if math.isfinite(value) and value>=0 else None
 text=str(value).strip()
 if text in ('Tr','(Tr)'):return 0
 match=re.fullmatch(r'\(?([0-9]+(?:\.[0-9]+)?)\)?',text)
 return float(match[1]) if match else None
foods=[]; skipped=[]
for row in rows[12:]:
 code=str(row[1])
 if not re.fullmatch(r'\d{5}',code) or not isinstance(row[3],str):continue
 values=[number(row[i]) for i in [6,9,12,20]]
 if any(v is None for v in values):skipped.append(code);continue
 name=re.sub(r'\s+',' ',row[3]).strip()
 flags='推定値を含む' if any('(' in str(row[i]) or 'Tr' in str(row[i]) for i in [6,9,12,20]) else ''
 foods.append([code,name,*values,flags])
assert len(foods)>2000 and len({r[0] for r in foods})==len(foods)
result={'edition':'日本食品標準成分表（八訂）増補2023年・2026年3月27日訂正データから引用','sourceUrl':SOURCE,'sourceSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'basis':'可食部100gあたり','notes':'Tr（微量）は0として計算。括弧付き推定値は数値を使用。4成分の欠測値は推測せず検索対象から除外。','omitted':skipped,'foods':foods}
out=Path('public/food-composition.json');out.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n')
print(f'{len(foods)} foods; {len(skipped)} omitted; {out.stat().st_size} bytes')
