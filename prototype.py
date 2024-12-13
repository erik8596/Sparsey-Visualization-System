import yaml
from render_manager import RenderManager
from grid_utils import hex_grid, cm_centers, neuron_centers

def initialize_svs(model_path):
    # Load Sparsey model configurations from YAML
    try:
        with open(model_path, 'r') as file:
            network_config = yaml.safe_load(file)
    except Exception as e:
        raise ValueError(f"Error loading model configuration: {e}")

    print(f"Loaded network configuration: {network_config}")

    layers_config = network_config.get('layers', [])
    if not layers_config:
        raise ValueError("No layers found in configuration!")

    # Initialize Render Manager
    render_manager = RenderManager()

    for idx, layer in enumerate(layers_config):
        print(f"Processing layer {idx}: {layer}")

        rows = layer['params'].get('mac_grid_num_rows', 1)
        cols = layer['params'].get('mac_grid_num_cols', 1)
        num_cms = layer['params'].get('num_cms_per_mac', 1)
        num_neurons = layer['params'].get('num_neurons_per_cm', 1)

        # Generate MAC positions
        mac_positions = hex_grid(rows, cols)

        z = idx * 5  # Z offset for layers

        for mac_x, mac_y in mac_positions:
            render_manager.add_mac(mac_x, mac_y, z, size=1)

            # Generate CM positions within each MAC
            cm_positions = cm_centers(mac_x, mac_y, size=0.5, num_cms=num_cms)
            render_manager.add_cm(cm_positions, z, size=0.2)

            # Generate Neurons within each CM
            for cm_x, cm_y in cm_positions:
                neuron_positions = neuron_centers(cm_x, cm_y, radius=0.05, num_neurons=num_neurons)
                render_manager.add_neurons(neuron_positions, z, radius=0.05)

    print("Rendering visualization...")
    render_manager.show()