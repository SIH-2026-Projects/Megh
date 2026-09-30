from fastapi.testclient import TestClient
from app.main import app

client=TestClient(app)

def test_health():
    assert client.get('/api/v1/health').status_code==200

def test_forecast_contract():
    r=client.post('/api/v1/forecast',json={'variable':'rainfall','lead_hours':48,'latitude':19,'longitude':73})
    assert r.status_code==200
    body=r.json()
    assert body['point']['latitude']==19
    assert abs(sum(x['weight'] for x in body['point']['contributions'])-1)<1e-6
    assert body['point']['top_model'] in {'ECMWF','AIFS','NCUM','GFS','GraphCast'}
    assert 0 <= body['point']['top_weight'] <= 1

def test_operational_endpoints():
    assert client.get('/api/v1/hazards').status_code==200
    assert client.get('/api/v1/operations/cycle').status_code==200
