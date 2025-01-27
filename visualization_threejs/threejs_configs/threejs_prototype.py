import yaml
from threejs_configs.threejs_grid_utils import hex_grid, cm_centers, neuron_centers

def initialize_threejs_svs(model_path):
    """Load and process Sparsey model configurations from YAML for Three.js visualization."""
    try:
        with open(model_path, 'r') as file:
            network_config = yaml.safe_load(file)
    except Exception as e:
        raise ValueError(f"Error loading model configuration: {e}")

    print(f"Loaded network configuration: {network_config}")

    layers_config = network_config.get('layers', [])
    if not layers_config:
        raise ValueError("No layers found in configuration!")

    visualization_data = []

    for idx, layer in enumerate(layers_config):
        print(f"Processing layer {idx}: {layer}")

        rows = layer['params'].get('mac_grid_num_rows', 1)
        cols = layer['params'].get('mac_grid_num_cols', 1)
        num_cms = layer['params'].get('num_cms_per_mac', 1)
        num_neurons = layer['params'].get('num_neurons_per_cm', 1)

        # Generate MAC positions using updated Three.js spacing
        mac_positions = hex_grid(rows, cols, hex_size=1.5)
        z = idx * 10  # Increase spacing between layers for better visualization

        for mac_x, mac_y in mac_positions:
            visualization_data.append({
                "type": "mac",
                "x": mac_x,
                "y": mac_y,
                "z": z
            })

            # Generate CM positions within each MAC
            cm_positions = cm_centers(mac_x, mac_y, size=0.7, num_cms=num_cms)
            for cm_x, cm_y in cm_positions:
                visualization_data.append({
                    "type": "cm",
                    "x": cm_x,
                    "y": cm_y,
                    "z": z
                })

                # Generate Neurons within each CM
                neuron_positions = neuron_centers(cm_x, cm_y, radius=0.1, num_neurons=num_neurons)
                for neuron_x, neuron_y in neuron_positions:
                    visualization_data.append({
                        "type": "neuron",
                        "x": neuron_x,
                        "y": neuron_y,
                        "z": z
                    })

    return visualization_data
