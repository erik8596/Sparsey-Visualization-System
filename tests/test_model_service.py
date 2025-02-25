import pytest

# Skip the tests in this file if wandb is not installed.
pytest.importorskip("wandb", reason="wandb module not installed")
import wandb  # Now wandb is imported only if available

from services.model_service import (
    get_projects,
    get_runs_from_project,
    fetch_wandb_model,
    process_visualization_data
)

def test_get_projects(mocker):
    # Create fake project objects with a 'name' attribute.
    FakeProject = type("FakeProject", (), {})
    proj1 = FakeProject()
    proj1.name = "TestProject1"
    proj2 = FakeProject()
    proj2.name = "TestProject2"
    fake_projects = [proj1, proj2]

    # Patch wandb.Api() so that get_projects uses our fake projects.
    fake_api = mocker.patch("wandb.Api")
    fake_instance = fake_api.return_value
    fake_instance.projects.return_value = fake_projects

    projects = get_projects()
    expected = [
        {"label": "TestProject1", "value": "TestProject1"},
        {"label": "TestProject2", "value": "TestProject2"}
    ]
    assert projects == expected

def test_get_runs_from_project(mocker):
    # Create fake run objects with 'name' and 'id' attributes.
    FakeRun = type("FakeRun", (), {})
    run1 = FakeRun()
    run1.name = "Run1"
    run1.id = "id1"
    run2 = FakeRun()
    run2.name = "Run2"
    run2.id = "id2"
    fake_runs = [run1, run2]

    fake_api = mocker.patch("wandb.Api")
    fake_instance = fake_api.return_value
    fake_instance.runs.return_value = fake_runs

    runs = get_runs_from_project("dummy_entity", "dummy_project")
    expected = [
        {"label": "Run1", "value": "id1"},
        {"label": "Run2", "value": "id2"}
    ]
    assert runs == expected

def test_process_visualization_data():
    # Create a fake model_config structure similar to what is stored in WandB.
    model_config = {
        "layer_1": {
            "params": {
                "mac_grid_num_rows": 2,
                "mac_grid_num_cols": 2,
                "num_cms_per_mac": 1,
                "num_neurons_per_cm": 1,
                "prev_layer_mac_grid_num_cols": 4,
                "prev_layer_mac_grid_num_rows": 4
            }
        },
        "layer_2": {
            "params": {
                "mac_grid_num_rows": 1,
                "mac_grid_num_cols": 1,
                "num_cms_per_mac": 1,
                "num_neurons_per_cm": 1,
                "prev_layer_mac_grid_num_cols": 2,
                "prev_layer_mac_grid_num_rows": 2
            }
        }
    }

    result = process_visualization_data(model_config)
    # Check that the processed data contains required keys.
    assert "layers" in result
    assert "input_dimensions" in result

    expected_dimensions = {"width": 4, "height": 4}
    assert result["input_dimensions"] == expected_dimensions

    # Ensure that some renderable layer objects have been created.
    assert isinstance(result["layers"], list)
    assert len(result["layers"]) > 0

def test_fetch_wandb_model(mocker):
    # Create a fake run object with nested config for model data.
    FakeRun = type("FakeRun", (), {})
    fake_run = FakeRun()
    fake_run.config = {
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
    fake_api = mocker.patch("wandb.Api")
    fake_instance = fake_api.return_value
    fake_instance.run.return_value = fake_run

    result = fetch_wandb_model("dummy_run_id", "dummy_project")
    assert "config" in result
    assert "input_dimensions" in result

    expected_dimensions = {"width": 5, "height": 5}
    assert result["input_dimensions"] == expected_dimensions
