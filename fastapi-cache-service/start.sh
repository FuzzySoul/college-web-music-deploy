#!/bin/bash
cd "$(dirname "$0")"
pip install -i https://pypi.tuna.tsinghua.edu.cn/simple -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
