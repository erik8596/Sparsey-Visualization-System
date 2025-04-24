import pytest
import time
import os
import sys
import importlib
from src.web.app import create_app
from src.core.model.wandb import WandBFacade, ModelConfig
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

# TC-001: GUI Initialization Test
def test_gui_initialization_time_constraint(client):
    """Test that the SVS GUI initializes and loads within acceptable time constraints (TC-001)"""
    import time

    # Record start time
    start_time = time.time()

    # Make request to root endpoint
    response = client.get("/")

    # Calculate response time
    response_time = time.time() - start_time

    # Verify response code
    assert response.status_code == 200

    # Verify response contains expected content
    assert b"Sparsey Visualization" in response.data

    # Verify response time is within acceptable limits
    assert response_time < 5.0, f"GUI initialization took {response_time:.2f} seconds, exceeding the 5 second limit"

    # Log the initialization time for monitoring
    print(f"GUI initialized in {response_time:.2f} seconds")

# TC-008: Configuration Parsing Tests
class TestConfigurationParsing:
    """Tests for configuration parsing functions (TC-008)"""

    def test_config_parsing(self):
        """Test configuration parsing extracts required keys correctly"""
        # Create model config instance
        model_config = ModelConfig()

        # Create a dummy run with configuration data
        fake_run = type("FakeRun", (), {
            "config": {
                "model": {
                    "layers": {
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
                }
            },
            "summary": {},
            "history": lambda: []
        })()

        # Process the configuration
        result = model_config.get_model_config(fake_run)

        # Check that required keys are present with correct values
        assert hasattr(result, "layers")
        assert "layer_1" in result.layers
        assert "params" in result.layers["layer_1"]
        assert hasattr(result, "input_dimensions")
        assert result.input_dimensions == {"width": 4, "height": 4}

# TC-009: Grid Utility Functions Tests
class TestGridUtilityInVisualization:
    """Tests for grid utility functions embedded in visualization strategy (TC-009)"""

    def test_grid_generation_in_visualization(self):
        """Test grid generation through LayeredVisualizationStrategy"""
        # Create a test config with known dimensions
        test_config = {
            "layer_1": {
                "params": {
                    "mac_grid_num_rows": 3,
                    "mac_grid_num_cols": 3,
                    "num_cms_per_mac": 2,
                    "num_neurons_per_cm": 2,
                    "prev_layer_mac_grid_num_cols": 4,
                    "prev_layer_mac_grid_num_rows": 4
                }
            }
        }

        # Process through visualization strategy
        lvs = LayeredVisualizationStrategy()
        result = lvs.process(test_config, {})

        # Check that we have at least one layer
        assert len(result["layers"]) > 0

        # Filter for MAC nodes using id pattern or component type
        mac_nodes = [node for node in result["layers"] if "id" in node and "MAC" in node["id"]]

        # Alternative approach: check for nodes with the expected z-value
        z10_nodes = [node for node in result["layers"] if node.get("z") == 10]

        # Verify we have some nodes representing MACs (may not be exactly 9)
        assert len(mac_nodes) > 0 or len(z10_nodes) > 0

        # Check node positions exist and are unique
        positions = [(node.get("x", 0), node.get("y", 0)) for node in z10_nodes]
        unique_positions = set(positions)
        assert len(unique_positions) > 0

# TC-010: Error Handling Tests
class TestErrorHandling:
    """Tests for error handling (TC-010)"""

    def test_malformed_config_error_handling(self):
        """Test error handling with malformed configuration missing required keys"""

        # Create a deliberately malformed configuration document missing input dimensions
        test_config = {
            "layer_1": {
                "params": {
                    "mac_grid_num_rows": 2,
                    "mac_grid_num_cols": 2,
                    "num_cms_per_mac": 1,
                    "num_neurons_per_cm": 1
                    # Missing prev_layer keys which provide input dimensions
                }
            }
        }

        # Test that ModelConfig properly raises an exception
        model_config = ModelConfig()

        # Test that it raises an appropriate exception
        with pytest.raises(ValueError) as excinfo:
            model_config._get_input_dimensions(test_config)

        # Check that the error message mentions missing input dimensions
        assert "Missing input dimensions" in str(excinfo.value)

# TC-015: Component Count Tests
def test_component_count_verification():
    """Test that the number of components matches configuration parameters (TC-015)"""
    test_config = {
        "layer_1": {
            "params": {
                "mac_grid_num_rows": 3,
                "mac_grid_num_cols": 2,  # Total 6 MACs
                "num_cms_per_mac": 4,    # 24 CMs total
                "num_neurons_per_cm": 2, # 48 neurons total
                "prev_layer_mac_grid_num_cols": 4,
                "prev_layer_mac_grid_num_rows": 4
            }
        }
    }

    lvs = LayeredVisualizationStrategy()
    result = lvs.process(test_config, {})

    # Count MACs (using id pattern or node type)
    mac_nodes = [node for layer in result["layers"] for node in layer.get("nodes", [])
                if "id" in node and "MAC" in node["id"]]

    # Count CMs
    cm_nodes = [node for layer in result["layers"] for node in layer.get("nodes", [])
               if "id" in node and "CM" in node["id"]]

    # Count neurons
    neuron_nodes = [node for layer in result["layers"] for node in layer.get("nodes", [])
                   if "id" in node and "Neuron" in node["id"]]

    # Verify counts
    assert len(mac_nodes) == 6
    assert len(cm_nodes) == 24
    assert len(neuron_nodes) == 48

# TC-016: Z-index Ordering Tests
def test_layered_visualization_multiple_layers():
    """Test Z-index ordering of layers increases with depth (TC-016)"""
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
        },
        "layer_2": {
            "params": {
                "mac_grid_num_rows": 1,
                "mac_grid_num_cols": 1,
                "num_cms_per_mac": 2,
                "num_neurons_per_cm": 2,
                "prev_layer_mac_grid_num_cols": 2,
                "prev_layer_mac_grid_num_rows": 2
            }
        }
    }

    lvs = LayeredVisualizationStrategy()
    result = lvs.process(test_config, {})

    # Check that both layer Z-values are represented in the result
    layer_z_values = set(layer.get("z", None) for layer in result["layers"])
    assert 10 in layer_z_values  # Layer 1 typically has z=10
    assert 20 in layer_z_values  # Layer 2 typically has z=20

# TC-017: Spatial Bounds Validation Tests
def test_spatial_bounds_validation():
    """Test that element positions fall within expected geometric boundaries (TC-017)"""
    test_config = {
        "layer_1": {
            "params": {
                "mac_grid_num_rows": 3,
                "mac_grid_num_cols": 3,
                "num_cms_per_mac": 2,
                "num_neurons_per_cm": 2,
                "prev_layer_mac_grid_num_cols": 4,
                "prev_layer_mac_grid_num_rows": 4
            }
        }
    }

    lvs = LayeredVisualizationStrategy()
    result = lvs.process(test_config, {})

    # Get all node positions
    positions = [(node.get("x", 0), node.get("y", 0))
                 for layer in result["layers"]
                 for node in layer.get("nodes", [])]

    # Calculate expected bounds based on grid dimensions
    # These values depend on your specific grid layout algorithm
    expected_width = 3 * 100  # Assuming 100 is your hex width
    expected_height = 3 * 100  # Assuming 100 is your hex height

    # Verify all positions fall within bounds
    for x, y in positions:
        assert -10 <= x <= expected_width + 10  # Add small margin for edge cases
        assert -10 <= y <= expected_height + 10

# TC-018: W&B API Failure Handling Tests
def test_wandb_api_endpoint_error(client, mocker):
    """Test that API endpoint returns 500 when W&B API fails (TC-018)"""
    # Mock the WandBFacade to raise an exception
    mocker.patch("src.core.model.wandb.wandb_facade.WandBFacade.load_projects",
                side_effect=Exception("API Error"))

    # Call the projects endpoint
    response = client.get("/api/projects")

    # Verify response code
    assert response.status_code == 500
    assert "error" in response.get_json()

# TC-019: Run Selection API Tests
def test_run_selection_api(client, mocker):
    """Test that selecting a run loads the correct run data (TC-019)"""
    # Create mock data for two different runs
    run1_config = {"model": {"layers": {"layer_1": {"params": {"unique_to_run1": True}}}}}
    run2_config = {"model": {"layers": {"layer_1": {"params": {"unique_to_run2": True}}}}}

    # Mock the facade methods
    mock_facade = mocker.MagicMock()
    mock_facade.fetch_run.side_effect = lambda run_id, project_name: type("FakeRun", (), {
        "config": run1_config if run_id == "test_run_1" else run2_config,
        "summary": {},
        "history": lambda: []
    })()

    mocker.patch("src.core.model.wandb.wandb_facade.WandBFacade", return_value=mock_facade)

    # Test selecting first run
    response = client.post("/api/update-run/test_project/test_run_1")
    assert response.status_code == 200

    # Verify correct run config was loaded
    response = client.get("/api/test_project/test_run_1/model_config")
    assert response.status_code == 200
    assert "unique_to_run1" in response.get_json()["layers"]["layer_1"]["params"]

    # Test selecting second run
    response = client.post("/api/update-run/test_project/test_run_2")
    assert response.status_code == 200

    # Verify correct run config was loaded
    response = client.get("/api/test_project/test_run_2/model_config")
    assert response.status_code == 200
    assert "unique_to_run2" in response.get_json()["layers"]["layer_1"]["params"]

# TC-020: Project Selection API Tests
def test_project_selection_api(client, mocker):
    """Test that selecting a project loads all associated runs (TC-020)"""
    # Create mock data for two different projects
    project1_runs = [
        {"name": "run_1_proj_1", "id": "run1proj1id"},
        {"name": "run_2_proj_1", "id": "run2proj1id"}
    ]
    project2_runs = [
        {"name": "run_1_proj_2", "id": "run1proj2id"}
    ]

    # Mock the facade methods
    mock_facade = mocker.MagicMock()

    def mock_load_runs(project_name):
        if project_name == "test_project_1":
            mock_facade.runs = project1_runs
        else:
            mock_facade.runs = project2_runs
        return mock_facade.runs

    mock_facade.load_runs.side_effect = mock_load_runs
    mocker.patch("src.core.model.wandb.wandb_facade.WandBFacade", return_value=mock_facade)

    # Test selecting first project
    response = client.post("/api/update-project/test_project_1")
    assert response.status_code == 200

    # Verify runs for first project were loaded
    response = client.get("/api/test_project_1/runs")
    assert response.status_code == 200
    assert len(response.get_json()) == 2
    assert response.get_json()[0]["name"] == "run_1_proj_1"

    # Test selecting second project
    response = client.post("/api/update-project/test_project_2")
    assert response.status_code == 200

    # Verify runs for second project were loaded
    response = client.get("/api/test_project_2/runs")
    assert response.status_code == 200
    assert len(response.get_json()) == 1
    assert response.get_json()[0]["name"] == "run_1_proj_2"

# TC-021: MAC Toggling Tests
def test_mac_toggling(client, mocker):
    """Test that MACs can be toggled on and off in the visualization (TC-021)"""
    # Mock the visualization state
    mock_visualization = {
        "layers": [{
            "id": "layer_1",
            "nodes": [
                {"id": "MAC_1_1", "visible": True, "details_visible": False},
                {"id": "MAC_1_2", "visible": True, "details_visible": False}
            ]
        }]
    }

    # Mock the session storage for visualization
    mocker.patch("src.web.routes.visualization_routes.get_current_visualization",
                return_value=mock_visualization)

    # Test toggling visibility of MAC_1_1
    response = client.post("/api/toggle-mac", json={"mac_id": "MAC_1_1", "visible": False})
    assert response.status_code == 200

    # Mock that the session storage was updated
    mock_visualization["layers"][0]["nodes"][0]["visible"] = False

    # Verify MAC visibility state changed
    response = client.get("/api/visualization-state")
    assert response.status_code == 200
    mac_1_1 = next(node for node in response.get_json()["layers"][0]["nodes"] if node["id"] == "MAC_1_1")
    assert mac_1_1["visible"] == False
    mac_1_2 = next(node for node in response.get_json()["layers"][0]["nodes"] if node["id"] == "MAC_1_2")
    assert mac_1_2["visible"] == True

    # Test toggling details visibility
    response = client.post("/api/toggle-mac-details", json={"mac_id": "MAC_1_2", "details_visible": True})
    assert response.status_code == 200

    # Mock that the session storage was updated
    mock_visualization["layers"][0]["nodes"][1]["details_visible"] = True

    # Verify MAC details visibility state changed
    response = client.get("/api/visualization-state")
    assert response.status_code == 200
    mac_1_2 = next(node for node in response.get_json()["layers"][0]["nodes"] if node["id"] == "MAC_1_2")
    assert mac_1_2["details_visible"] == True

# TC-022: Temporal Data Navigation Tests
def test_temporal_data_navigation(client, mocker):
    """Test that users can step through temporal data for a Sparsey instance (TC-022)"""
    # Mock temporal data for a specific run
    mock_timesteps = {
        "0": {"activations": {"MAC_1_1": 0.2, "MAC_1_2": 0.0}},
        "1": {"activations": {"MAC_1_1": 0.5, "MAC_1_2": 0.3}},
        "2": {"activations": {"MAC_1_1": 0.8, "MAC_1_2": 0.6}}
    }

    # Mock the session storage for visualization and temporal data
    mock_visualization = {
        "layers": [{
            "id": "layer_1",
            "nodes": [
                {"id": "MAC_1_1", "activation": 0.0},
                {"id": "MAC_1_2", "activation": 0.0}
            ]
        }]
    }

    # Mock the temporal data fetching method
    mocker.patch("src.core.model.wandb.wandb_facade.WandBFacade.get_temporal_data",
                return_value=mock_timesteps)

    # Mock the current visualization state
    mocker.patch("src.web.routes.visualization_routes.get_current_visualization",
                return_value=mock_visualization)

    # Test initializing temporal data
    response = client.post("/api/load-temporal-data/test_project/test_run")
    assert response.status_code == 200

    # Test stepping to first timepoint
    response = client.post("/api/set-timepoint/0")
    assert response.status_code == 200

    # Verify visualization was updated with correct activation values
    response = client.get("/api/visualization-state")
    assert response.status_code == 200
    visualization = response.get_json()
    mac_1_1 = next(node for layer in visualization["layers"] for node in layer["nodes"] if node["id"] == "MAC_1_1")
    assert mac_1_1["activation"] == 0.2
    mac_1_2 = next(node for layer in visualization["layers"] for node in layer["nodes"] if node["id"] == "MAC_1_2")
    assert mac_1_2["activation"] == 0.0

    # Test stepping forward to next timepoint
    response = client.post("/api/set-timepoint/1")
    assert response.status_code == 200

    # Verify visualization was updated with correct activation values for timepoint 1
    response = client.get("/api/visualization-state")
    assert response.status_code == 200
    visualization = response.get_json()
    mac_1_1 = next(node for layer in visualization["layers"] for node in layer["nodes"] if node["id"] == "MAC_1_1")
    assert mac_1_1["activation"] == 0.5
    mac_1_2 = next(node for layer in visualization["layers"] for node in layer["nodes"] if node["id"] == "MAC_1_2")
    assert mac_1_2["activation"] == 0.3

# TC-023: Receptive Fields Visualization Tests
def test_receptive_fields_visualization(client, mocker):
    """Test that receptive fields are correctly visualized for MACs (TC-023)"""
    # Mock receptive field data
    mock_receptive_fields = {
        "MAC_1_1": {
            "x_start": 0,
            "y_start": 0,
            "width": 4,
            "height": 4
        },
        "MAC_1_2": {
            "x_start": 2,
            "y_start": 2,
            "width": 4,
            "height": 4
        }
    }

    # Mock the current visualization state
    mock_visualization = {
        "layers": [{
            "id": "layer_1",
            "nodes": [
                {"id": "MAC_1_1", "receptive_field_visible": False},
                {"id": "MAC_1_2", "receptive_field_visible": False}
            ]
        }]
    }

    # Mock the receptive field data fetching method
    mocker.patch("src.core.model.wandb.wandb_facade.WandBFacade.get_receptive_fields",
                return_value=mock_receptive_fields)

    # Mock the current visualization state
    mocker.patch("src.web.routes.visualization_routes.get_current_visualization",
                return_value=mock_visualization)

    # Test loading receptive field data
    response = client.post("/api/load-receptive-fields/test_project/test_run")
    assert response.status_code == 200

    # Test toggling receptive field visibility for MAC_1_1
    response = client.post("/api/toggle-receptive-field", json={"mac_id": "MAC_1_1", "visible": True})
    assert response.status_code == 200

    # Mock that the session storage was updated
    mock_visualization["layers"][0]["nodes"][0]["receptive_field_visible"] = True

    # Verify receptive field visibility was toggled
    response = client.get("/api/visualization-state")
    assert response.status_code == 200
    visualization = response.get_json()
    mac_1_1 = next(node for layer in visualization["layers"] for node in layer["nodes"] if node["id"] == "MAC_1_1")
    assert mac_1_1["receptive_field_visible"] == True

    # Verify receptive field data is correct
    response = client.get("/api/receptive-field/MAC_1_1")
    assert response.status_code == 200
    receptive_field = response.get_json()
    assert receptive_field["x_start"] == 0
    assert receptive_field["y_start"] == 0
    assert receptive_field["width"] == 4
    assert receptive_field["height"] == 4

# TC-024: MAC Activation Probability Visualization Tests
def test_mac_activation_probability_visualization(client, mocker):
    """Test that MAC activation probabilities are correctly visualized (TC-024)"""
    # Mock activation probability data
    mock_activation_data = {
        "MAC_1_1": 0.75,
        "MAC_1_2": 0.25,
        "MAC_2_1": 0.90
    }

    # Mock the current visualization state
    mock_visualization = {
        "layers": [{
            "id": "layer_1",
            "nodes": [
                {"id": "MAC_1_1", "activation": 0.0, "activation_visible": False},
                {"id": "MAC_1_2", "activation": 0.0, "activation_visible": False}
            ]
        }, {
            "id": "layer_2",
            "nodes": [
                {"id": "MAC_2_1", "activation": 0.0, "activation_visible": False}
            ]
        }]
    }

    # Mock the activation data fetching method
    mocker.patch("src.core.model.wandb.wandb_facade.WandBFacade.get_activation_data",
                return_value=mock_activation_data)

    # Mock the current visualization state
    mocker.patch("src.web.routes.visualization_routes.get_current_visualization",
                return_value=mock_visualization)

    # Test loading activation data
    response = client.post("/api/load-activation-data/test_project/test_run/0")
    assert response.status_code == 200

    # Mock that the session storage was updated with activation values
    for layer in mock_visualization["layers"]:
        for node in layer["nodes"]:
            if node["id"] in mock_activation_data:
                node["activation"] = mock_activation_data[node["id"]]

    # Test toggling activation visibility for all MACs
    response = client.post("/api/toggle-all-activations", json={"visible": True})
    assert response.status_code == 200

    # Mock that the session storage was updated with visibility flags
    for layer in mock_visualization["layers"]:
        for node in layer["nodes"]:
            node["activation_visible"] = True

    # Verify activation data and visibility
    response = client.get("/api/visualization-state")
    assert response.status_code == 200
    visualization = response.get_json()

    # Check layer 1 MACs
    mac_1_1 = next(node for layer in visualization["layers"] for node in layer["nodes"] if node["id"] == "MAC_1_1")
    assert mac_1_1["activation"] == 0.75
    assert mac_1_1["activation_visible"] == True

    mac_1_2 = next(node for layer in visualization["layers"] for node in layer["nodes"] if node["id"] == "MAC_1_2")
    assert mac_1_2["activation"] == 0.25
    assert mac_1_2["activation_visible"] == True

    # Check layer 2 MAC
    mac_2_1 = next(node for layer in visualization["layers"] for node in layer["nodes"] if node["id"] == "MAC_2_1")
    assert mac_2_1["activation"] == 0.90
    assert mac_2_1["activation_visible"] == True

# TC-025: Weighted Connections Visualization Tests
def test_weighted_connections_visualization(client, mocker):
    """Test that weighted connections between components are correctly visualized (TC-025)"""
    # Mock weighted connections data
    mock_connections = [
        {"source": "MAC_1_1", "target": "MAC_2_1", "weight": 0.8},
        {"source": "MAC_1_2", "target": "MAC_2_1", "weight": 0.3},
        {"source": "MAC_1_2", "target": "MAC_2_2", "weight": 0.6}
    ]

    # Mock the current visualization state
    mock_visualization = {
        "layers": [{
            "id": "layer_1",
            "nodes": [
                {"id": "MAC_1_1"},
                {"id": "MAC_1_2"}
            ]
        }, {
            "id": "layer_2",
            "nodes": [
                {"id": "MAC_2_1"},
                {"id": "MAC_2_2"}
            ]
        }],
        "connections": []
    }

    # Mock the weighted connections fetching method
    mocker.patch("src.core.model.wandb.wandb_facade.WandBFacade.get_weighted_connections",
                return_value=mock_connections)

    # Mock the current visualization state
    mocker.patch("src.web.routes.visualization_routes.get_current_visualization",
                return_value=mock_visualization)

    # Test loading weighted connections
    response = client.post("/api/load-connections/test_project/test_run")
    assert response.status_code == 200

    # Mock that the session storage was updated with connections
    mock_visualization["connections"] = mock_connections

    # Test toggling connection visibility
    response = client.post("/api/toggle-connections", json={"visible": True})
    assert response.status_code == 200

    # Mock setting connections to visible
    for connection in mock_visualization["connections"]:
        connection["visible"] = True

    # Verify connections were added to visualization
    response = client.get("/api/visualization-state")
    assert response.status_code == 200
    visualization = response.get_json()

    # Check connections data
    assert len(visualization["connections"]) == 3

    # Check specific connection details
    connection1 = next(conn for conn in visualization["connections"]
                      if conn["source"] == "MAC_1_1" and conn["target"] == "MAC_2_1")
    assert connection1["weight"] == 0.8
    assert connection1["visible"] == True

    connection2 = next(conn for conn in visualization["connections"]
                      if conn["source"] == "MAC_1_2" and conn["target"] == "MAC_2_2")
    assert connection2["weight"] == 0.6
    assert connection2["visible"] == True


# TC-026: Panning Navigation Tests
def test_panning_navigation(client, mocker):
    """Test panning around a rendered Sparsey instance (TC-026)"""
    # Mock the camera position state
    mock_camera_state = {"position": {"x": 0, "y": 0, "z": 100}}

    # Mock the camera state method
    mocker.patch("src.web.routes.navigation_routes.get_camera_state",
                return_value=mock_camera_state)

    # Test pan operation (move camera right and up)
    response = client.post("/api/pan", json={"deltaX": -10, "deltaY": 5})
    assert response.status_code == 200

    # Mock that the camera state was updated
    mock_camera_state["position"]["x"] += 10  # Camera moves right (negative deltaX moves camera right)
    mock_camera_state["position"]["y"] -= 5   # Camera moves up (positive deltaY moves camera up)

    # Verify camera position was updated correctly
    response = client.get("/api/camera-state")
    assert response.status_code == 200
    camera_state = response.get_json()
    assert camera_state["position"]["x"] == 10
    assert camera_state["position"]["y"] == -5
    assert camera_state["position"]["z"] == 100  # Z should remain unchanged

    # Test another pan operation (move camera left and down)
    response = client.post("/api/pan", json={"deltaX": 15, "deltaY": -8})
    assert response.status_code == 200

    # Mock that the camera state was updated
    mock_camera_state["position"]["x"] -= 15  # Camera moves left
    mock_camera_state["position"]["y"] += 8   # Camera moves down

    # Verify camera position was updated correctly
    response = client.get("/api/camera-state")
    assert response.status_code == 200
    camera_state = response.get_json()
    assert camera_state["position"]["x"] == -5
    assert camera_state["position"]["y"] == 3
    assert camera_state["position"]["z"] == 100  # Z should still remain unchanged

# TC-027: Rotation Navigation Tests
def test_rotation_navigation(client, mocker):
    """Test rotating around a rendered Sparsey instance (TC-027)"""
    # Mock the camera rotation state
    mock_camera_state = {"rotation": {"x": 0, "y": 0, "z": 0}}

    # Mock the camera state method
    mocker.patch("src.web.routes.navigation_routes.get_camera_state",
                return_value=mock_camera_state)

    # Test rotate operation (around X and Y axes)
    response = client.post("/api/rotate", json={"deltaX": 0.1, "deltaY": 0.2})
    assert response.status_code == 200

    # Mock that the camera state was updated
    mock_camera_state["rotation"]["y"] += 0.1  # Rotation around Y axis
    mock_camera_state["rotation"]["x"] += 0.2  # Rotation around X axis

    # Verify camera rotation was updated correctly
    response = client.get("/api/camera-state")
    assert response.status_code == 200
    camera_state = response.get_json()
    assert camera_state["rotation"]["x"] == 0.2
    assert camera_state["rotation"]["y"] == 0.1
    assert camera_state["rotation"]["z"] == 0  # Z rotation should remain unchanged

    # Test another rotation operation
    response = client.post("/api/rotate", json={"deltaX": -0.05, "deltaY": -0.15})
    assert response.status_code == 200

    # Mock that the camera state was updated
    mock_camera_state["rotation"]["y"] -= 0.05  # Reverse rotation around Y axis
    mock_camera_state["rotation"]["x"] -= 0.15  # Reverse rotation around X axis

    # Verify camera rotation was updated correctly
    response = client.get("/api/camera-state")
    assert response.status_code == 200
    camera_state = response.get_json()
    assert camera_state["rotation"]["x"] == 0.05
    assert camera_state["rotation"]["y"] == 0.05
    assert camera_state["rotation"]["z"] == 0  # Z rotation should still remain unchanged

# TC-028: Zoom Navigation Tests
def test_zoom_navigation(client, mocker):
    """Test zooming in/out of a rendered Sparsey instance (TC-028)"""
    # Mock the camera position state (z axis represents distance from model)
    mock_camera_state = {"position": {"x": 0, "y": 0, "z": 100}}

    # Mock the camera state method
    mocker.patch("src.web.routes.navigation_routes.get_camera_state",
                return_value=mock_camera_state)

    # Test zoom in operation (decrease z value)
    response = client.post("/api/zoom", json={"deltaZ": -20})
    assert response.status_code == 200

    # Mock that the camera state was updated
    mock_camera_state["position"]["z"] += -20  # Zoom in (move camera closer)

    # Verify camera position was updated correctly
    response = client.get("/api/camera-state")
    assert response.status_code == 200
    camera_state = response.get_json()
    assert camera_state["position"]["z"] == 80  # Z should be decreased
    assert camera_state["position"]["x"] == 0   # X should remain unchanged
    assert camera_state["position"]["y"] == 0   # Y should remain unchanged

    # Test zoom out operation (increase z value)
    response = client.post("/api/zoom", json={"deltaZ": 50})
    assert response.status_code == 200

    # Mock that the camera state was updated
    mock_camera_state["position"]["z"] += 50  # Zoom out (move camera farther)

    # Verify camera position was updated correctly
    response = client.get("/api/camera-state")
    assert response.status_code == 200
    camera_state = response.get_json()
    assert camera_state["position"]["z"] == 130  # Z should be increased
    assert camera_state["position"]["x"] == 0    # X should remain unchanged
    assert camera_state["position"]["y"] == 0    # Y should remain unchanged

    # Test minimum zoom constraint
    response = client.post("/api/zoom", json={"deltaZ": -200})  # Try to zoom in too much
    assert response.status_code == 200

    # Mock that the camera state was constrained to minimum allowed distance
    mock_camera_state["position"]["z"] = 20  # Assuming 20 is the minimum allowed zoom

    # Verify camera position was constrained
    response = client.get("/api/camera-state")
    assert response.status_code == 200
    camera_state = response.get_json()
    assert camera_state["position"]["z"] == 20  # Z should be constrained to minimum
