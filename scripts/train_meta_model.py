"""Train a MEGH contextual error model from a hindcast CSV.

Input columns:
model,valid_time,lead_hours,variable,latitude,longitude,value,observation,regime

Output is a joblib artifact that can be loaded by a production fusion worker.
"""
import argparse
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import joblib
import pandas as pd
from backend.app.services.learning import ModelErrorLearner

parser=argparse.ArgumentParser()
parser.add_argument('--input',required=True)
parser.add_argument('--output',default='artifacts/megh_error_model.joblib')
args=parser.parse_args()
frame=pd.read_csv(args.input)
frame['valid_time']=pd.to_datetime(frame['valid_time'],utc=True)
frame['month']=frame['valid_time'].dt.month
frame['absolute_error']=(frame['value']-frame['observation']).abs()
model=ModelErrorLearner().fit(frame)
Path(args.output).parent.mkdir(parents=True,exist_ok=True)
joblib.dump(model,args.output)
print(f'saved {args.output}')
