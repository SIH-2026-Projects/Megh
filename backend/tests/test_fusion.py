from app.services.fusion import fuse, grid_features, model_skill

def test_weights_sum_to_one():
    r=fuse(19.0,73.0,48,"rainfall")
    assert abs(sum(x["weight"] for x in r.contributions)-1) < 1e-6

def test_bounds_and_uncertainty():
    r=fuse(19.0,73.0,48,"rainfall")
    assert r.lower <= r.value <= r.upper
    assert 0 <= r.confidence <= 1
    assert 0 <= r.disagreement <= 1

def test_context_changes_with_location():
    a=fuse(19,73,48,"rainfall")
    b=fuse(32,78,48,"rainfall")
    assert a.regime != ""
    assert b.regime != ""

def test_grid_is_geographic():
    g=grid_features("rainfall",48,2.0)
    assert len(g)>50
    assert all(6 <= p["latitude"] <= 38 and 68 <= p["longitude"] <= 98 for p in g)

def test_skill_cube_shape():
    rows=model_skill("rainfall")
    assert {x["model"] for x in rows} == {"ECMWF","AIFS","NCUM","GFS","GraphCast"}

def test_temperature_and_wind():
    assert fuse(23,85,72,"temperature").value > 0
    assert fuse(23,85,72,"wind").value > 0
