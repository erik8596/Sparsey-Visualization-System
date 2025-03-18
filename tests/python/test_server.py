import pytest
from src.web.app import create_app
from src.core.model.wandb import WandBFacade
from src.core.model.processors import LayeredVisualizationStrategy

@pytest.fixture
def app():
    """Create application for testing"""
    app = create_app('testing')
    return app

@pytest.fixture
def client(app):
    """Create test client"""
    return app.test_client()

@pytest.fixture
def wandb_facade():
    """Create WandBFacade instance for testing"""
    return WandBFacade()

def test_index(client):
    """Test index page loads correctly"""
    response = client.get("/")
    assert response.status_code == 200
    assert b"Sparsey Visualization" in response.data

class TestAPIEndpoints:
    """Group API endpoint tests"""

    def test_projects_endpoint(self, client, mocker):
        """Test projects API endpoint"""
        fake_projects = ["Project1", "Project2"]
        mocker.patch("src.core.model.wandb.wandb_facade.WandBFacade.load_projects",
                     return_value=fake_projects)

        response = client.get("/api/projects")
        assert response.status_code == 200
        assert response.get_json() == {"projects": fake_projects}

    def test_runs_endpoint(self, client, mocker):
        """Test runs API endpoint"""
        fake_runs = [{"id": "run1", "name": "Run1"}, {"id": "run2", "name": "Run2"}]
        mocker.patch("src.core.model.wandb.wandb_facade.WandBFacade.load_runs_from_project",
                     return_value=fake_runs)

        response = client.get("/api/test_project/runs")
        assert response.status_code == 200
        assert response.get_json() == {"project_runs": fake_runs}

    def test_invalid_project(self, client):
        """Test handling of invalid project"""
        response = client.get("/api/nonexistent/runs")
        assert response.status_code == 500
        assert "error" in response.get_json()

    def test_invalid_run(self, client):
        """Test handling of invalid run"""
        response = client.get("/api/test_project/invalid_run/visualize")
        assert response.status_code == 500
        assert "error" in response.get_json()

class TestModelVisualization:
    """Group model visualization tests"""

    def test_visualization_data_processing(self, mocker):
        """Test visualization data processing"""
        test_config = {
            "layer_1": {
                "params": {
                    "mac_grid_num_rows": 2,
                    "mac_grid_num_cols": 2,
                    "num_cms_per_mac": 1,
                    "num_neurons_per_cm": 1,
                    "prev_layer_mac_grid_num_cols": 4,
                    "prev_layer_mac_grid_num_rows": 4
                }
            }
        }

        lvs = LayeredVisualizationStrategy()
        result = lvs.process(test_config, {})

        assert "layers" in result
        assert "input_dimensions" in result
        assert result["input_dimensions"] == {"width": 4, "height": 4}
        assert isinstance(result["layers"], list)
        assert len(result["layers"]) > 0

    def test_model_config_fetch(self, wandb_facade, mocker):
        """Test model configuration fetching"""
        fake_run = type("FakeRun", (), {
            "config": {
                "model": {
                    "layers": {
                        "layer_1": {
                            "params": {
                                "mac_grid_num_rows": 3,
                                "mac_grid_num_cols": 3,
                                "prev_layer_mac_grid_num_cols": 5,
                                "prev_layer_mac_grid_num_rows": 5,
                                "num_cms_per_mac": 2,
                                "num_neurons_per_cm": 2
                            }
                        }
                    }
                }
            }
        })()

        mocker.patch("wandb.Api.run", return_value=fake_run)
        model_config = wandb_facade.get_processed_model_config("dummy_run", "dummy_project")

        assert model_config is not None
        assert hasattr(model_config, 'layers')
        assert hasattr(model_config, 'input_dimensions')

def test_invalid_json(client):
    """Test handling of invalid JSON data"""
    response = client.post("/api/update-project/test",
                          data="invalid json",
                          content_type='application/json')
    assert response.status_code == 400

def test_project_update(client, mocker):
    """Test project update functionality"""
    mocker.patch("src.core.model.wandb.wandb_facade.WandBFacade.update_project",
                 return_value=True)

    response = client.post("/api/update-project/test_project")
    assert response.status_code == 200
    assert response.get_json() == {"message": "Project updated successfully"}
